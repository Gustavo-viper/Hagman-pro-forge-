import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES, type Locale } from '@fandom/shared';
import en from '../i18n/locales/en.json';
import ptBR from '../i18n/locales/pt-BR.json';

const STORAGE_KEY = 'fandom.locale';

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* storage unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : DEFAULT_LOCALE;
  return nav.toLowerCase().startsWith('pt') ? 'pt-BR' : nav.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LOCALE;
}

void i18n.use(initReactI18next).init({
  resources: { 'pt-BR': { translation: ptBR }, en: { translation: en } },
  lng: detectLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  interpolation: { escapeValue: false }, // React already escapes output.
  returnNull: false,
});

const syncHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
};
syncHtmlLang(i18n.language);
i18n.on('languageChanged', (lng) => {
  syncHtmlLang(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
});

export function currentLocale(): Locale {
  return isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}

export default i18n;
