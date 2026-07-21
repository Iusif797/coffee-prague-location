import { FrameStore, type RenderableFrame } from './frame-store';

interface SequenceElements {
  canvas: HTMLCanvasElement;
  story: HTMLElement;
  heroCopy: HTMLElement;
  scrollCue: HTMLElement;
  railProgress: HTMLElement;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const smoothstep = (start: number, end: number, value: number): number => {
  const amount = clamp01((value - start) / (end - start));
  return amount * amount * (3 - 2 * amount);
};

export class ScrollSequence {
  private readonly context: CanvasRenderingContext2D;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private targetFrame = 0;
  private scrollDirection = 1;
  private progress = 0;
  private rafId = 0;
  private resizeRafId = 0;
  private resizePending = true;
  private lastDrawnIndex = -1;
  private viewportWidth = window.innerWidth;
  private viewportHeight = window.innerHeight;
  private storyStart = 0;
  private scrollDistance = 1;
  private stageHeight = window.innerHeight;
  private lastLayoutWidth = 0;
  private sequenceActive = true;

  constructor(
    private readonly elements: SequenceElements,
    private readonly frames: FrameStore,
  ) {
    const context = elements.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D context is unavailable');
    this.context = context;
  }

  start(): void {
    this.frames.onFrameReady = () => this.scheduleRender();
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    window.addEventListener('resize', this.handleResize, { passive: true });
    this.reducedMotion.addEventListener('change', this.handleMotionPreference);
    this.updateLayoutMetrics();
    this.handleScroll();
  }

  private readonly handleScroll = (): void => {
    const scrollPosition = window.scrollY;
    const nextProgress = clamp01((scrollPosition - this.storyStart) / this.scrollDistance);
    const nextTargetFrame = nextProgress * (this.frames.count - 1);
    const targetDelta = nextTargetFrame - this.targetFrame;
    if (Math.abs(targetDelta) > 0.05) this.scrollDirection = targetDelta > 0 ? 1 : -1;
    const shouldBeActive = scrollPosition <= this.storyStart + this.scrollDistance + this.stageHeight;
    const activeChanged = shouldBeActive !== this.sequenceActive;
    if (activeChanged) {
      this.sequenceActive = shouldBeActive;
      this.frames.setActive(shouldBeActive);
    }
    if (
      Math.abs(nextProgress - this.progress) < 0.0001
      && !this.resizePending
      && !activeChanged
    ) return;

    this.progress = nextProgress;
    this.targetFrame = nextTargetFrame;

    this.scheduleRender();
  };

  private readonly handleResize = (): void => {
    // Mobile browser chrome changes innerHeight during a gesture. The sticky
    // stage uses stable `svh`, so height-only resize events must not rebuild it.
    if (Math.abs(window.innerWidth - this.lastLayoutWidth) < 2) return;
    if (this.resizeRafId) return;
    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = 0;
      this.resizePending = true;
      this.updateLayoutMetrics();
      this.handleScroll();
    });
  };

  private readonly handleMotionPreference = (): void => {
    this.scheduleRender();
  };

  private updateLayoutMetrics(): void {
    this.lastLayoutWidth = window.innerWidth;
    const stage = this.elements.canvas.parentElement;
    const stageHeight = Math.max(1, stage?.clientHeight ?? window.innerHeight);
    this.stageHeight = stageHeight;
    const mobile = window.innerWidth < 820 || window.matchMedia('(pointer: coarse)').matches;
    const naturalDistance = this.frames.count * (mobile ? 16 : 18);
    const distance = Math.max(
      stageHeight * (mobile ? 4.8 : 4.5),
      Math.min(naturalDistance, stageHeight * 6.5),
    );
    this.elements.story.style.height = `${Math.round(stageHeight + distance)}px`;
    this.storyStart = this.elements.story.offsetTop;
    this.scrollDistance = distance;
  }

  private scheduleRender(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(this.render);
  }

  private readonly render = (): void => {
    this.rafId = 0;

    if (this.resizePending) this.resizeCanvas();

    const frameIndex = Math.round(this.targetFrame);
    this.frames.warmAround(frameIndex, this.scrollDirection);
    const loadedFrame = this.frames.nearest(frameIndex);
    if (loadedFrame && (loadedFrame.index !== this.lastDrawnIndex || this.resizePending)) {
      this.drawCover(loadedFrame.image);
      this.lastDrawnIndex = loadedFrame.index;
      this.elements.canvas.dataset.frame = String(loadedFrame.index);
    }

    this.updateOverlays();
    this.resizePending = false;
  };

  private resizeCanvas(): void {
    this.viewportWidth = Math.max(1, this.elements.canvas.clientWidth);
    this.viewportHeight = Math.max(1, this.elements.canvas.clientHeight);
    const sourceWidth = this.frames.sourceWidth;
    const sourceHeight = this.frames.sourceHeight;
    const coverScale = Math.max(
      this.viewportWidth / sourceWidth,
      this.viewportHeight / sourceHeight,
    );
    const sourceLimitedScale = 1 / coverScale;
    const renderScale = Math.min(window.devicePixelRatio || 1, 2, sourceLimitedScale);

    this.elements.canvas.width = Math.max(1, Math.round(this.viewportWidth * renderScale));
    this.elements.canvas.height = Math.max(1, Math.round(this.viewportHeight * renderScale));
    this.elements.canvas.style.width = `${this.viewportWidth}px`;
    this.elements.canvas.style.height = `${this.viewportHeight}px`;
    this.context.setTransform(
      this.elements.canvas.width / this.viewportWidth,
      0,
      0,
      this.elements.canvas.height / this.viewportHeight,
      0,
      0,
    );
    this.lastDrawnIndex = -1;
  }

  private drawCover(image: RenderableFrame): void {
    const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
    const imageRatio = sourceWidth / sourceHeight;
    const viewportRatio = this.viewportWidth / this.viewportHeight;
    let width = this.viewportWidth;
    let height = this.viewportHeight;

    if (imageRatio > viewportRatio) width = height * imageRatio;
    else height = width / imageRatio;

    const focalPointX = this.viewportWidth <= 700 ? 0.58 : 0.5;
    const x = (this.viewportWidth - width) * focalPointX;
    const y = (this.viewportHeight - height) / 2;
    this.context.fillStyle = '#17130f';
    this.context.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    this.context.drawImage(image, x, y, width, height);
  }

  private updateOverlays(): void {
    const introOpacity = 1 - smoothstep(0.1, 0.38, this.progress);
    const cueOpacity = 1 - smoothstep(0.015, 0.14, this.progress);
    this.elements.heroCopy.style.setProperty('--copy-opacity', introOpacity.toFixed(3));
    this.elements.heroCopy.style.setProperty('--copy-shift', `${(1 - introOpacity) * -22}px`);
    this.elements.scrollCue.style.opacity = cueOpacity.toFixed(3);
    this.elements.railProgress.style.transform = `scaleY(${this.progress.toFixed(4)})`;
  }
}
