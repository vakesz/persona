export const LOCALES = ['en', 'hu'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  hu: 'Magyar',
};

/** BCP-47 tags used for `Intl.*` formatters and `<html lang>`. */
export const LOCALE_BCP47: Record<Locale, string> = {
  en: 'en-US',
  hu: 'hu-HU',
};

/** Runtime guard for persisted, URL, and browser-provided locale values. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
