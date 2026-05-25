import { formatter } from '@lingui/format-po';

export default {
  locales: ['en', 'hu'],
  sourceLocale: 'en',
  fallbackLocales: { default: 'en' },
  catalogs: [
    {
      path: '<rootDir>/../src/i18n/locales/{locale}/messages',
      include: ['../src'],
      exclude: ['**/node_modules/**', '**/*.test.*', '../src/routeTree.gen.ts'],
    },
  ],
  format: formatter({ lineNumbers: false }),
  compileNamespace: 'ts',
};
