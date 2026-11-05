import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['source'] },
  server: {
    port: 5173,
    // Same-origin in dev too: the browser only ever talks to this origin.
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    // Keep every script external so the strict CSP (script-src 'self') holds.
    modulePreload: { polyfill: false },
  },
});
