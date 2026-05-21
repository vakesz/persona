import { I18nProvider as LinguiI18nProvider } from '@lingui/react';
import { useMutation, useQuery } from 'convex/react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
 *
 * On first sign-in (`remoteLocale === null`), we push the user's pre-login
 * locale up to Convex so they don't lose the choice they made on the
 * landing page. After that, remote changes win.
 */
export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = resolveInitialLocale();
    activateLocale(initial);
    return initial;
  });
  // Tracks whether we've performed the first-sign-in upsync, so user
  // signing out then back in doesn't double-push.
  const firstSyncDone = useRef(false);

  const remoteLocale = useQuery(api.userPreferences.getMyLocale);
  const persistLocale = useMutation(api.userPreferences.setMyLocale);

  useEffect(() => {
    if (remoteLocale === undefined) return;
    if (remoteLocale === null) {
      // Authenticated user has no stored preference yet. Persist the current
      // local pick once so the next sign-in (even cross-device) starts from
      // it. Only the first time per provider mount.
      if (!firstSyncDone.current) {
        firstSyncDone.current = true;
        persistLocale({ locale }).catch((error: unknown) => {
          console.warn('Initial locale sync to Convex failed:', error);
        });
      }
      return;
    }
    if (!isLocale(remoteLocale)) return;
    firstSyncDone.current = true;
    if (remoteLocale !== locale) {
      setLocaleState(remoteLocale);
      activateLocale(remoteLocale);
      writeStoredLocale(remoteLocale);
    }
  }, [remoteLocale, locale, persistLocale]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      setLocaleState(next);
      activateLocale(next);
      writeStoredLocale(next);
      if (remoteLocale !== undefined) {
        firstSyncDone.current = true;
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
