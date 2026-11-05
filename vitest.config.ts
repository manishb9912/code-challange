import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/shared', 'apps/api', 'apps/web'],
    coverage: {
      provider: 'v8',
      include: ['packages/shared/src/**', 'apps/api/src/**', 'apps/web/src/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
      reporter: ['text-summary', 'html'],
      // Business logic must stay well covered; never lower these to get green.
      thresholds: {
        'apps/api/src/domain/**': { lines: 80 },
        'apps/api/src/services/**': { lines: 80 },
      },
    },
  },
});
