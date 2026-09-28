import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    passWithNoTests: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/e2e/**', 'tests/recognition-eval/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/tiles/**', 'lib/scoring/**', 'lib/game/**'],
      thresholds: { branches: 95 },
    },
  },
});
