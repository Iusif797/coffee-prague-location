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
  private resizePending = true;
  private lastDrawnIndex = -1;
  private viewportWidth = window.innerWidth;
  private viewportHeight = window.innerHeight;

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
    window.addEventListener('orientationchange', this.handleResize, { passive: true });
    this.reducedMotion.addEventListener('change', this.handleMotionPreference);
    this.updateSectionHeight();
    this.handleScroll();
  }

  private readonly handleScroll = (): void => {
    const bounds = this.elements.story.getBoundingClientRect();
    const scrollableDistance = Math.max(1, bounds.height - window.innerHeight);
    this.progress = clamp01(-bounds.top / scrollableDistance);
    const nextTargetFrame = this.progress * (this.frames.count - 1);
    const targetDelta = nextTargetFrame - this.targetFrame;
    if (Math.abs(targetDelta) > 0.05) this.scrollDirection = targetDelta > 0 ? 1 : -1;
    this.targetFrame = nextTargetFrame;

    this.scheduleRender();
  };

  private readonly handleResize = (): void => {
    this.resizePending = true;
    this.updateSectionHeight();
    this.handleScroll();
  };

  private readonly handleMotionPreference = (): void => {
    this.scheduleRender();
  };

  private updateSectionHeight(): void {
    const viewportHeight = window.innerHeight;
    const naturalDistance = this.frames.count * (window.innerWidth < 700 ? 14 : 16);
    const distance = Math.max(
      viewportHeight * (window.innerWidth < 700 ? 4.2 : 4.5),
      Math.min(naturalDistance, viewportHeight * 6.5),
    );
    this.elements.story.style.height = `${Math.round(viewportHeight + distance)}px`;
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
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
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

    const x = (this.viewportWidth - width) / 2;
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
