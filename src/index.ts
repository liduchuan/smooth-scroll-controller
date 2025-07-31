interface SmoothScrollControllerOptions {
  container: HTMLElement;
}
export default class SmoothScrollController {
  private options: SmoothScrollControllerOptions;

  private timer: NodeJS.Timeout | null = null;

  private measureFrameTime(): Promise<number> {
    return new Promise((resolve) => {
      let startTime = performance.now();
      requestAnimationFrame(() => {
        let endTime = performance.now();
        let frameTime = endTime - startTime;
        resolve(frameTime);
      });
    });
  }

  private get container() {
    return this.options.container;
  }

  constructor(options: SmoothScrollControllerOptions) {
    this.options = options;
    if (!this.options.container) {
      throw new Error("container is required");
    }
  }

  public async scrollBottom(): Promise<void> {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(async () => {
      if (this.container.scrollTop + this.container.clientHeight >= this.container.scrollHeight) {
        this.timer && clearInterval(this.timer);
        this.timer = null;
        return;
      }
      this.container.scrollTop += 0.5;
    }, await this.measureFrameTime());
  }

  public async scrollBottomImmediate() {
    await this.measureFrameTime();
    this.container.scrollTop = this.container.scrollHeight;
  }
}
