export type Locale = 'cs' | 'en' | 'ru';

const translations = {
  cs: {
    metaTitle: 'Teplé světlo — kavárna',
    metaDescription: 'Filmový příběh kávy — od prvního pohledu až po poslední doušek.',
    brandTop: 'Teplé',
    brandBottom: 'světlo',
    brandHomeLabel: 'Teplé světlo — na začátek',
    navLabel: 'Hlavní navigace',
    navStory: 'Příběh',
    navPhilosophy: 'Filozofie',
    navMenu: 'Menu',
    languageLabel: 'Vyberte jazyk',
    storyLabel: 'Filmový příběh kávy',
    posterAlt: 'Hostka v útulné kavárně',
    heroEyebrow: 'Příběh v každém doušku',
    heroTitle: 'Káva, kterou<br />chcete cítit',
    heroSubtitle: 'Každý záběr přináší nový zážitek',
    scrollCue: 'Posuňte se a prožijte příběh',
    loadingPrepare: 'Připravujeme příběh',
    loadingProgress: 'Načteno {percentage} %',
    loadingProgressFailed: 'Načteno {percentage} % · přeskočeno: {failed}',
    loadingReady: 'Příběh je připraven',
    loadingReadyFailed: 'Příběh je připraven · přeskočeno: {failed}',
    fallbackCanvas: 'Animace není dostupná — zobrazujeme první záběr',
    fallbackImages: 'Obrázky se nepodařilo načíst — zobrazujeme statický záběr',
    fallbackStart: 'Animaci se nepodařilo spustit — zobrazujeme první záběr',
    afterKicker: 'Teplé světlo · čerstvé pražení',
    afterTitle: 'Stvořeno pro opravdové milovníky kávy',
    afterCopy: 'Tiché ráno, přesné mletí a několik minut jen pro vás. Pečlivě spojujeme vše, z čeho vzniká váš oblíbený rituál.',
    principlesLabel: 'Naše principy',
    principleOne: 'Výběrová zrna',
    principleTwo: 'Šetrné pražení',
    principleThree: 'Precizní příprava',
    menuKicker: 'Autorská kolekce · 2026',
    menuTitle: 'Káva s<br /><em>charakterem</em>',
    menuLead: 'Čtyři nápoje pro pomalá setkání. Známé chutě, čerstvé pražení a jeden nečekaný tón v každém šálku.',
    pistachioName: 'Pistáciové latté',
    pistachioDescription: 'Dvojité espresso · pistáciový krém · mléko',
    pistachioAlt: 'Pistáciové latté v keramickém šálku',
    caramelName: 'Slaný karamel',
    caramelDescription: 'Flat white · domácí karamel · mořská sůl',
    caramelAlt: 'Flat white se slaným karamelem v tmavém šálku',
    mochaName: 'Pomerančová moka',
    mochaDescription: 'Espresso · hořká čokoláda · pomerančová kůra',
    mochaAlt: 'Pomerančová moka v průhledné sklenici',
    tonicName: 'Espresso tonic',
    tonicDescription: 'Výběrové espresso · tonic · grapefruit',
    tonicAlt: 'Espresso tonic s ledem a grapefruitem',
    alternativeMilk: 'Alternativní mléko',
    footerTagline: 'Káva, kvůli které stojí za to zpomalit.',
    footerVisit: 'Navštivte nás',
    footerAddress: 'Kávová 24, Praha 2',
    footerHours: 'Otevírací doba',
    footerWeekdays: 'Po–Pá · 08:00–20:00',
    footerWeekend: 'So–Ne · 09:00–20:00',
    footerContact: 'Kontakt',
    footerLegal: '© 2026 Teplé světlo. Všechna práva vyhrazena.',
    footerBack: 'Nahoru ↑',
    noScript: 'Zapněte JavaScript, abyste mohli příběh sledovat v pohybu.',
  },
  en: {
    metaTitle: 'Warm Light — coffee house',
    metaDescription: 'A cinematic coffee story — from the first glance to the final sip.',
    brandTop: 'Warm',
    brandBottom: 'light',
    brandHomeLabel: 'Warm Light — back to the beginning',
    navLabel: 'Primary navigation',
    navStory: 'Story',
    navPhilosophy: 'Philosophy',
    navMenu: 'Menu',
    languageLabel: 'Choose language',
    storyLabel: 'A cinematic coffee story',
    posterAlt: 'A guest in a cosy coffee house',
    heroEyebrow: 'A story in every sip',
    heroTitle: 'Coffee made<br />to be felt',
    heroSubtitle: 'Every frame brings a new impression',
    scrollCue: 'Scroll to experience the story',
    loadingPrepare: 'Preparing the story',
    loadingProgress: 'Loaded {percentage}%',
    loadingProgressFailed: 'Loaded {percentage}% · skipped: {failed}',
    loadingReady: 'The story is ready',
    loadingReadyFailed: 'The story is ready · skipped: {failed}',
    fallbackCanvas: 'Animation is unavailable — showing the first frame',
    fallbackImages: 'Images could not be loaded — showing a still frame',
    fallbackStart: 'Animation could not start — showing the first frame',
    afterKicker: 'Warm Light · freshly roasted',
    afterTitle: 'Created for true coffee lovers',
    afterCopy: 'A quiet morning, a precise grind and a few minutes just for you. We carefully bring together everything that makes your favourite ritual.',
    principlesLabel: 'Our principles',
    principleOne: 'Selected beans',
    principleTwo: 'Gentle roasting',
    principleThree: 'Precise preparation',
    menuKicker: 'Signature collection · 2026',
    menuTitle: 'Coffee with<br /><em>character</em>',
    menuLead: 'Four drinks made for unhurried meetings. Familiar flavours, fresh roasting and one unexpected note in every cup.',
    pistachioName: 'Pistachio latte',
    pistachioDescription: 'Double espresso · pistachio cream · milk',
    pistachioAlt: 'Pistachio latte in a ceramic cup',
    caramelName: 'Salted caramel',
    caramelDescription: 'Flat white · house caramel · sea salt',
    caramelAlt: 'Salted caramel flat white in a dark cup',
    mochaName: 'Orange mocha',
    mochaDescription: 'Espresso · dark chocolate · orange zest',
    mochaAlt: 'Orange mocha in a clear glass',
    tonicName: 'Espresso tonic',
    tonicDescription: 'Specialty espresso · tonic · grapefruit',
    tonicAlt: 'Espresso tonic with ice and grapefruit',
    alternativeMilk: 'Alternative milk',
    footerTagline: 'Coffee worth slowing down for.',
    footerVisit: 'Visit us',
    footerAddress: 'Kávová 24, Prague 2',
    footerHours: 'Opening hours',
    footerWeekdays: 'Mon–Fri · 08:00–20:00',
    footerWeekend: 'Sat–Sun · 09:00–20:00',
    footerContact: 'Contact',
    footerLegal: '© 2026 Warm Light. All rights reserved.',
    footerBack: 'Back to top ↑',
    noScript: 'Enable JavaScript to experience the story in motion.',
  },
  ru: {
    metaTitle: 'Тёплый свет — кофейня',
    metaDescription: 'Кинематографическая история кофе — от первого взгляда до последнего глотка.',
    brandTop: 'Тёплый',
    brandBottom: 'свет',
    brandHomeLabel: 'Тёплый свет — в начало',
    navLabel: 'Основная навигация',
    navStory: 'История',
    navPhilosophy: 'Философия',
    navMenu: 'Меню',
    languageLabel: 'Выберите язык',
    storyLabel: 'Кинематографическая история кофе',
    posterAlt: 'Гостья в уютной кофейне',
    heroEyebrow: 'История в каждом глотке',
    heroTitle: 'Кофе, который<br />хочется почувствовать',
    heroSubtitle: 'Каждый кадр — новое впечатление',
    scrollCue: 'Листайте, чтобы почувствовать',
    loadingPrepare: 'Подготавливаем историю',
    loadingProgress: 'Загружено {percentage}%',
    loadingProgressFailed: 'Загружено {percentage}% · пропущено: {failed}',
    loadingReady: 'История готова',
    loadingReadyFailed: 'История готова · пропущено: {failed}',
    fallbackCanvas: 'Анимация недоступна — показываем первый кадр',
    fallbackImages: 'Не удалось загрузить изображения — показываем статичный кадр',
    fallbackStart: 'Не удалось запустить анимацию — показываем первый кадр',
    afterKicker: 'Тёплый свет · свежая обжарка',
    afterTitle: 'Создано для настоящих ценителей кофе',
    afterCopy: 'Тихое утро, точный помол и несколько минут только для себя. Мы бережно собираем всё, из чего рождается ваш любимый ритуал.',
    principlesLabel: 'Наши принципы',
    principleOne: 'Отборное зерно',
    principleTwo: 'Бережная обжарка',
    principleThree: 'Точная подача',
    menuKicker: 'Авторская коллекция · 2026',
    menuTitle: 'Кофе с<br /><em>характером</em>',
    menuLead: 'Четыре напитка, созданных для неспешных встреч. Знакомые вкусы, свежая обжарка и одна неожиданная нота в каждой чашке.',
    pistachioName: 'Фисташковый латте',
    pistachioDescription: 'Двойной эспрессо · фисташковая крема · молоко',
    pistachioAlt: 'Фисташковый латте в керамической чашке',
    caramelName: 'Солёная карамель',
    caramelDescription: 'Флэт уайт · домашняя карамель · морская соль',
    caramelAlt: 'Флэт уайт с солёной карамелью в тёмной чашке',
    mochaName: 'Апельсиновая мокка',
    mochaDescription: 'Эспрессо · тёмный шоколад · цедра апельсина',
    mochaAlt: 'Апельсиновая мокка в прозрачном стакане',
    tonicName: 'Эспрессо-тоник',
    tonicDescription: 'Выборочный эспрессо · тоник · грейпфрут',
    tonicAlt: 'Эспрессо-тоник со льдом и грейпфрутом',
    alternativeMilk: 'Альтернативное молоко',
    footerTagline: 'Кофе, ради которого хочется замедлиться.',
    footerVisit: 'Ждём вас',
    footerAddress: 'Кавова 24, Прага 2',
    footerHours: 'Часы работы',
    footerWeekdays: 'Пн–Пт · 08:00–20:00',
    footerWeekend: 'Сб–Вс · 09:00–20:00',
    footerContact: 'Контакты',
    footerLegal: '© 2026 Тёплый свет. Все права защищены.',
    footerBack: 'Наверх ↑',
    noScript: 'Включите JavaScript, чтобы увидеть историю в движении.',
  },
} as const;

export type TranslationKey = keyof typeof translations.cs;

let activeLocale: Locale = 'cs';

export const translate = (
  key: TranslationKey,
  values: Record<string, string | number> = {},
): string => {
  let text: string = translations[activeLocale][key];
  Object.entries(values).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
};

const setLocale = (locale: Locale, persist = true): void => {
  activeLocale = locale;
  document.documentElement.lang = locale;
  document.title = translate('metaTitle');
  document.querySelector<HTMLMetaElement>('meta[name="description"]')
    ?.setAttribute('content', translate('metaDescription'));

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n as TranslationKey;
    element.textContent = translate(key);
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((element) => {
    const key = element.dataset.i18nHtml as TranslationKey;
    element.innerHTML = translate(key);
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach((element) => {
    const key = element.dataset.i18nLabel as TranslationKey;
    element.setAttribute('aria-label', translate(key));
  });

  document.querySelectorAll<HTMLImageElement>('[data-i18n-alt]').forEach((element) => {
    const key = element.dataset.i18nAlt as TranslationKey;
    element.alt = translate(key);
  });

  document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach((button) => {
    const selected = button.dataset.language === locale;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('is-active', selected);
  });

  if (persist) {
    try {
      window.localStorage.setItem('coffee-locale', locale);
    } catch {
      // The language still works when browser storage is unavailable.
    }
  }

  window.dispatchEvent(new CustomEvent<Locale>('languagechange', { detail: locale }));
};

export const initializeI18n = (): void => {
  let initialLocale: Locale = 'cs';
  try {
    const stored = window.localStorage.getItem('coffee-locale');
    if (stored === 'cs' || stored === 'en' || stored === 'ru') initialLocale = stored;
  } catch {
    // Czech remains the default when browser storage is unavailable.
  }

  document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach((button) => {
    button.addEventListener('click', () => {
      const locale = button.dataset.language;
      if (locale === 'cs' || locale === 'en' || locale === 'ru') setLocale(locale);
    });
  });

  setLocale(initialLocale, false);
};
