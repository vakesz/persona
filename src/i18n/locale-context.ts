import { createContext } from 'react';

import type { Locale } from './locales';

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);
