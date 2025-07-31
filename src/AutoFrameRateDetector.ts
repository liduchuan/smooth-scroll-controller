// 显示器信息接口
interface DisplayInfo {
  frameRate: number;
  screenWidth: number;
  screenHeight: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelDepth: number;
  devicePixelRatio: number;
  isHighDPI: boolean;
  displayType: string;
}

// 帧率检测结果接口
interface FrameRateResult {
  frameRate: number;
  confidence: number;
  sampleCount: number;
  detectionTime: number;
}

// 监控回调函数类型
type FrameRateCallback = (frameRate: number) => void;

// 停止监控函数类型
type StopMonitoringFunction = () => void;

// 显示器类型枚举
enum DisplayType {
  GAMING_240HZ_PLUS = 'Gaming Monitor (240Hz+)',
  GAMING_144HZ = 'Gaming Monitor (144Hz)',
  HIGH_REFRESH_120HZ = 'High Refresh Monitor (120Hz)',
  ENHANCED_75HZ = 'Enhanced Monitor (75Hz)',
  RETINA_4K_60HZ = 'Retina/4K Monitor (60Hz)',
  STANDARD_60HZ = 'Standard Monitor (60Hz)',
  LOW_POWER_30HZ = 'Low Power/Mobile Display',
  CUSTOM = 'Custom Refresh Rate'
}


export class AutoFrameRateDetector {
  private isDetecting: boolean = false;
  private detectionPromise: Promise<number> | null = null;
  private cachedFrameRate: number | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheValidityMs: number = 5000;

  constructor() {
    this.getPreciseFrameRate();
  }

  /**
   * 获取精准帧率 - 无需任何参数
   * 自动检测显示器配置并返回精准帧率
   */
  public async getPreciseFrameRate(): Promise<number> {
    // 检查缓存是否有效
    if (this.cachedFrameRate &&
      (Date.now() - this.cacheTimestamp) < this.cacheValidityMs) {
      return this.cachedFrameRate;
    }

    // 如果正在检测，返回现有的Promise
    if (this.isDetecting && this.detectionPromise) {
      return this.detectionPromise;
    }

    // 开始新的检测
    this.isDetecting = true;
    this.detectionPromise = this._detectFrameRate();

    try {
      const frameRate = await this.detectionPromise;
      this.cachedFrameRate = frameRate;
      this.cacheTimestamp = Date.now();
      return frameRate;
    } finally {
      this.isDetecting = false;
    }
  }

  /**
   * 获取详细的帧率检测结果
   */
  public async getDetailedFrameRate(): Promise<FrameRateResult> {
    const startTime = performance.now();
    const frameRate = await this.getPreciseFrameRate();
    const detectionTime = performance.now() - startTime;

    return {
      frameRate,
      confidence: this._calculateConfidence(frameRate),
      sampleCount: this._getLastSampleCount(),
      detectionTime
    };
  }

  /**
   * 内部帧率检测方法
   */
  private async _detectFrameRate(): Promise<number> {
    return new Promise<number>((resolve) => {
      const measurements: number[] = [];
      const maxSamples: number = 120;
      const minSamples: number = 30;
      let lastTimestamp: number = 0;
      let sampleCount: number = 0;
      const startTime: number = performance.now();

      const measureFrame = (timestamp: number): void => {
        if (lastTimestamp > 0) {
          const frameDelta: number = timestamp - lastTimestamp;
          // 过滤异常值
          if (frameDelta < 100) {
            measurements.push(frameDelta);
            sampleCount++;
          }
        }

        lastTimestamp = timestamp;

        // 检查是否收集足够样本或超时
        const elapsed: number = performance.now() - startTime;
        if (sampleCount >= maxSamples ||
          (sampleCount >= minSamples && elapsed > 3000)) {

          const frameRate = this._calculatePreciseFrameRate(measurements);
          resolve(frameRate);
          return;
        }

        requestAnimationFrame(measureFrame);
      };

      requestAnimationFrame(measureFrame);
    });
  }

  /**
   * 计算精准帧率
   */
  private _calculatePreciseFrameRate(measurements: number[]): number {
    if (measurements.length === 0) return 60;

    // 移除极值
    const sorted: number[] = [...measurements].sort((a, b) => a - b);
    const trimCount: number = Math.floor(sorted.length * 0.05);
    const trimmed: number[] = sorted.slice(trimCount, -trimCount || undefined);

    // 计算平均帧间隔
    const avgFrameTime: number = trimmed.reduce((sum, time) => sum + time, 0) / trimmed.length;
    const rawFrameRate: number = 1000 / avgFrameTime;

    // 自动识别标准刷新率
    const standardRates: number[] = [30, 60, 75, 90, 100, 120, 144, 165, 240, 360];
    let closestRate: number = rawFrameRate;
    let minDiff: number = Infinity;

    for (const rate of standardRates) {
      const diff: number = Math.abs(rawFrameRate - rate);
      if (diff < minDiff && diff < rate * 0.1) {
        minDiff = diff;
        closestRate = rate;
      }
    }

    return minDiff < rawFrameRate * 0.1 ? closestRate : Math.round(rawFrameRate * 10) / 10;
  }

  /**
   * 获取详细的显示器信息
   */
  public async getDisplayInfo(): Promise<DisplayInfo> {
    const frameRate: number = await this.getPreciseFrameRate();

    const screenInfo: DisplayInfo = {
      frameRate,
      screenWidth: screen.width,
      screenHeight: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      devicePixelRatio: window.devicePixelRatio || 1,
      isHighDPI: (window.devicePixelRatio || 1) > 1,
      displayType: this._guessDisplayType(frameRate, (window.devicePixelRatio || 1) > 1)
    };

    return screenInfo;
  }

  /**
   * 推测显示器类型
   */
  private _guessDisplayType(frameRate: number, isHighDPI: boolean): string {
    if (frameRate >= 240) return DisplayType.GAMING_240HZ_PLUS;
    if (frameRate >= 144) return DisplayType.GAMING_144HZ;
    if (frameRate >= 120) return DisplayType.HIGH_REFRESH_120HZ;
    if (frameRate === 75) return DisplayType.ENHANCED_75HZ;
    if (frameRate === 60) {
      return isHighDPI ? DisplayType.RETINA_4K_60HZ : DisplayType.STANDARD_60HZ;
    }
    if (frameRate === 30) return DisplayType.LOW_POWER_30HZ;
    return `${DisplayType.CUSTOM} (${frameRate}Hz)`;
  }

  /**
   * 计算检测置信度
   */
  private _calculateConfidence(frameRate: number): number {
    const standardRates: number[] = [30, 60, 75, 120, 144, 240];
    const minDiff: number = Math.min(...standardRates.map(rate => Math.abs(frameRate - rate)));
    return Math.max(0, 100 - (minDiff / frameRate * 100));
  }

  /**
   * 获取最后一次采样数量
   */
  private _getLastSampleCount(): number {
    // 这里可以存储实际的采样数量
    return 60; // 默认值
  }

  /**
   * 实时监控帧率变化
   */
  public startRealtimeMonitoring(
    callback: FrameRateCallback,
    interval: number = 1000
  ): StopMonitoringFunction {
    let isMonitoring: boolean = true;

    const monitor = async (): Promise<void> => {
      if (!isMonitoring) return;

      try {
        this.cachedFrameRate = null; // 强制重新检测
        const currentFrameRate: number = await this.getPreciseFrameRate();
        callback(currentFrameRate);
      } catch (error) {
        console.warn('Frame rate monitoring error:', error);
      }

      setTimeout(monitor, interval);
    };

    monitor();

    return (): void => {
      isMonitoring = false;
    };
  }

  /**
   * 获取同步版本的帧率（使用缓存）
   */
  public getCurrentFrameRateSync(): number {
    return this.cachedFrameRate || 60;
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cachedFrameRate = null;
    this.cacheTimestamp = 0;
  }
}
