import { useContext } from 'react';

import { LocaleContext } from './locale-context';
import type { Locale } from './locales';

export interface UseLocale {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

/** Reads the active locale controller from the app-level i18n provider. */
export function useLocale(): UseLocale {
  const ctx = useContext(LocaleContext);
  if (ctx === null) {
    throw new Error('useLocale must be used inside <I18nProvider>.');
  }
  return ctx;
}
