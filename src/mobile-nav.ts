import { translate } from './i18n';

const MOBILE_NAV_QUERY = '(max-width: 700px)';

export const initializeMobileNav = (): void => {
  const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
  const panel = document.querySelector<HTMLElement>('#masthead-panel');
  const backdrop = document.querySelector<HTMLElement>('.nav-backdrop');

  if (!toggle || !panel || !backdrop) return;

  const mobileQuery = window.matchMedia(MOBILE_NAV_QUERY);

  const setOpen = (open: boolean): void => {
    const isOpen = open && mobileQuery.matches;
    document.body.classList.toggle('is-nav-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    panel.setAttribute('aria-hidden', mobileQuery.matches ? String(!isOpen) : 'false');
    backdrop.hidden = !isOpen;
    toggle.setAttribute('aria-label', translate(isOpen ? 'menuClose' : 'menuOpen'));
  };

  toggle.addEventListener('click', () => {
    setOpen(!document.body.classList.contains('is-nav-open'));
  });

  backdrop.addEventListener('click', () => setOpen(false));

  panel.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  panel.querySelectorAll('[data-language]').forEach((button) => {
    button.addEventListener('click', () => setOpen(false));
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('is-nav-open')) {
      setOpen(false);
      toggle.focus();
    }
  });

  mobileQuery.addEventListener('change', () => setOpen(false));
  window.addEventListener('languagechange', () => {
    setOpen(document.body.classList.contains('is-nav-open'));
  });

  setOpen(false);
};
