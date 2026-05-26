import { resolve } from 'node:path';

import { lingui } from '@lingui/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui({ configPath: 'config/lingui.config.ts' }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      '@convex': resolve(import.meta.dirname, './convex'),
    },
  },
  server: {
    port: 5173,
  },
});
