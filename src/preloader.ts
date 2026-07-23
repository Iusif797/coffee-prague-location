import './preloader.css';

const READY_HOLD_MS = 420;
const CONTENT_EXIT_MS = 300;
const CURTAIN_MS = 840;
const REDUCED_HOLD_MS = 120;
const REDUCED_CURTAIN_MS = 260;

export interface Preloader {
  setProgress(fraction: number): void;
  finish(): void;
  dismiss(): void;
}

const inertPreloader: Preloader = {
  setProgress: () => undefined,
  finish: () => undefined,
  dismiss: () => undefined,
};

export const initializePreloader = (): Preloader => {
  const overlay = document.getElementById('preloader');
  const percent = document.getElementById('preloader-percent');
  if (!overlay || !percent) return inertPreloader;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hiding = false;

  const applyFraction = (fraction: number): void => {
    const safeFraction = Math.max(0, Math.min(1, fraction));
    overlay.style.setProperty('--fill', safeFraction.toFixed(3));
    percent.textContent = String(Math.round(safeFraction * 100));
  };

  const unlockScroll = (): void => {
    document.body.classList.remove('is-loading');
  };

  const removeOverlay = (): void => {
    unlockScroll();
    overlay.remove();
  };

  const finish = (): void => {
    if (hiding) return;
    hiding = true;
    applyFraction(1);
    overlay.classList.add('is-full');

    const holdDelay = reduceMotion ? REDUCED_HOLD_MS : READY_HOLD_MS;
    const exitDelay = reduceMotion ? 0 : CONTENT_EXIT_MS;
    const curtainDelay = reduceMotion ? REDUCED_CURTAIN_MS : CURTAIN_MS;

    window.setTimeout(() => {
      unlockScroll();
      overlay.classList.add('is-leaving');
      window.setTimeout(() => {
        overlay.classList.add('is-done');
        window.setTimeout(removeOverlay, curtainDelay);
      }, exitDelay);
    }, holdDelay);
  };

  const dismiss = (): void => {
    if (hiding) return;
    hiding = true;
    removeOverlay();
  };

  return {
    setProgress: (fraction) => {
      if (!hiding) applyFraction(fraction);
    },
    finish,
    dismiss,
  };
};
