import { i18n } from '@lingui/core';

import { messages as enMessages } from './locales/en/messages';
import { messages as huMessages } from './locales/hu/messages';
import { LOCALE_BCP47, type Locale } from './locales';

// Plural rules are bundled with the compiled `.ts` catalogs in Lingui v6 —
// no separate `loadLocaleData` call needed.
i18n.load({ en: enMessages, hu: huMessages });

/** Activates a locale on the shared i18n instance and reflects it in the DOM. */
export function activateLocale(locale: Locale): void {
  i18n.activate(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = LOCALE_BCP47[locale];
  }
}

export { i18n };
