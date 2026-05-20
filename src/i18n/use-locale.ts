import { useContext } from 'react';

import { LocaleContext } from './locale-context';
import type { Locale } from './locales';

export interface UseLocale {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

export function useLocale(): UseLocale {
  const ctx = useContext(LocaleContext);
  if (ctx === null) {
    throw new Error('useLocale must be used inside <I18nProvider>.');
  }
  return ctx;
}
