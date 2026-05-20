import { I18nProvider as LinguiI18nProvider } from '@lingui/react';
import { useMutation, useQuery } from 'convex/react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '@convex/_generated/api';

import { resolveInitialLocale, writeStoredLocale } from './detect';
import { activateLocale, i18n } from './index';
import { LocaleContext, type LocaleContextValue } from './locale-context';
import { isLocale, type Locale } from './locales';

export interface I18nProviderProps {
  children: ReactNode;
}

/**
 * Activates the resolved locale on the shared `i18n` instance synchronously so
 * the first render is already translated, then syncs to/from Convex when an
 * authenticated user has a stored preference.
 */
export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = resolveInitialLocale();
    activateLocale(initial);
    return initial;
  });

  const remoteLocale = useQuery(api.userPreferences.getMyLocale);
  const persistLocale = useMutation(api.userPreferences.setMyLocale);

  useEffect(() => {
    if (remoteLocale === undefined || remoteLocale === null) return;
    if (!isLocale(remoteLocale)) return;
    if (remoteLocale !== locale) {
      setLocaleState(remoteLocale);
      activateLocale(remoteLocale);
      writeStoredLocale(remoteLocale);
    }
  }, [remoteLocale, locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      setLocaleState(next);
      activateLocale(next);
      writeStoredLocale(next);
      if (remoteLocale !== undefined) {
        persistLocale({ locale: next }).catch((error: unknown) => {
          console.error('Failed to persist locale to Convex:', error);
        });
      }
    },
    [locale, persistLocale, remoteLocale],
  );

  const contextValue = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale }),
    [locale, setLocale],
  );

  return (
    <LocaleContext value={contextValue}>
      <LinguiI18nProvider i18n={i18n}>{children}</LinguiI18nProvider>
    </LocaleContext>
  );
}
