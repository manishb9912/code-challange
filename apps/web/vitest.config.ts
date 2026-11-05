import { defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineProject({
  plugins: [react()],
  resolve: { conditions: ['source'] },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
