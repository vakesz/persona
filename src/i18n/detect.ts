import { DEFAULT_LOCALE, isLocale, type Locale } from './locales';

const STORAGE_KEY = 'persona.locale';
const URL_PARAM = 'locale';

function readUrlLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = new URL(window.location.href).searchParams.get(URL_PARAM);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage may be disabled (private mode, quota). Best-effort only.
  }
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const candidates = [navigator.language, ...navigator.languages];
  for (const candidate of candidates) {
    const base = candidate.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Priority: `?locale=…` URL param > stored preference > browser default. */
export function resolveInitialLocale(): Locale {
  return readUrlLocale() ?? readStoredLocale() ?? detectBrowserLocale();
}
