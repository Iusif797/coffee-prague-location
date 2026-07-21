import './styles.css';
import { FrameStore, loadFrameManifest } from './frame-store';
import { initializeI18n, translate, type TranslationKey } from './i18n';
import { ScrollSequence } from './scroll-sequence';

const requiredElement = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
};

const showFallback = (key: TranslationKey): void => {
  document.body.classList.add('is-fallback');
  const label = requiredElement<HTMLElement>('#load-label');
  const message = translate(key);
  label.textContent = message;
  console.error(message);
};

let latestLoading = { settled: 0, total: 0, failed: 0 };

const updateLoading = (
  settled: number,
  total: number,
  failed: number,
): void => {
  latestLoading = { settled, total, failed };
  const status = requiredElement<HTMLElement>('#load-status');
  const label = requiredElement<HTMLElement>('#load-label');
  const bar = requiredElement<HTMLElement>('#load-bar');
  if (total === 0) {
    label.textContent = translate('loadingPrepare');
    return;
  }
  const percentage = Math.round((settled / total) * 100);

  bar.style.transform = `scaleX(${settled / total})`;
  label.textContent = failed > 0
    ? translate('loadingProgressFailed', { percentage, failed })
    : translate('loadingProgress', { percentage });

  if (settled === total) {
    label.textContent = failed > 0
      ? translate('loadingReadyFailed', { failed })
      : translate('loadingReady');
    window.setTimeout(() => status.classList.add('is-complete'), 450);
  }
};

const initializeReveals = (): void => {
  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  document.body.classList.add('has-reveal-motion');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );

  elements.forEach((element) => observer.observe(element));
};

const start = async (): Promise<void> => {
  const canvas = requiredElement<HTMLCanvasElement>('#coffee-canvas');
  if (!canvas.getContext) {
    showFallback('fallbackCanvas');
    return;
  }

  try {
    const { manifest, manifestUrl } = await loadFrameManifest();
    const frames = new FrameStore(manifest, manifestUrl);
    frames.onProgress = updateLoading;

    const firstFrame = await frames.load(0);
    if (!firstFrame) {
      showFallback('fallbackImages');
      return;
    }

    document.body.classList.add('is-ready');
    const sequence = new ScrollSequence(
      {
        canvas,
        story: requiredElement<HTMLElement>('#coffee-story'),
        heroCopy: requiredElement<HTMLElement>('#hero-copy'),
        scrollCue: requiredElement<HTMLElement>('#scroll-cue'),
        railProgress: requiredElement<HTMLElement>('#frame-rail-progress'),
      },
      frames,
    );
    sequence.start();

    const initialCount = Math.min(manifest.count, window.innerWidth < 700 ? 8 : 11);
    const initialFrames = Array.from({ length: initialCount }, (_, index) => index);
    await frames.loadBatch(initialFrames, 2);
    void frames.preloadAll();
  } catch (error) {
    console.error(error);
    showFallback('fallbackStart');
  }
};

initializeI18n();
window.addEventListener('languagechange', () => {
  updateLoading(latestLoading.settled, latestLoading.total, latestLoading.failed);
});
initializeReveals();
void start();
