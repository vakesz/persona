import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { I18nProvider } from '@/i18n/provider';
import { convex } from '@/lib/convex';
import { router } from '@/router';
import '@/styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </ConvexAuthProvider>
  </StrictMode>,
);
