import { createRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

/** TanStack Router instance wired to the generated file-route tree. */
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
