import { AutoFrameRateDetector } from "./AutoFrameRateDetector";

interface SmoothScrollControllerOptions {
  container: HTMLElement;
}
export default class SmoothScrollController extends AutoFrameRateDetector {
  private options: SmoothScrollControllerOptions;

  private timer: NodeJS.Timeout | null = null;

  private async measureFrameTime(): Promise<number> {
    const result = await this.getPreciseFrameRate();
    return result;
  }

  private get container() {
    return this.options.container;
  }

  constructor(options: SmoothScrollControllerOptions) {
    super();
    this.options = options;
    if (!this.options.container) {
      throw new Error("container is required");
    }
  }

  public async scrollBottom(): Promise<void> {
    if (this.timer) {
      return;
    }
    const frameTime = 1000 / (await this.measureFrameTime());
    this.timer = setInterval(() => {
      requestAnimationFrame(() => {
        if (this.container.scrollTop + this.container.clientHeight >= this.container.scrollHeight) {
          this.timer && clearInterval(this.timer);
          this.timer = null;
          return;
        }
        this.container.scrollTop += 0.5;
      })
    }, frameTime);
  }

  public async scrollBottomImmediate() {
    requestIdleCallback(() => {
      this.container.scrollTop = this.container.scrollHeight;
    }, { timeout: 1000 });
  }
}
