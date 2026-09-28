import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// The pure domain core must never import the framework, storage or the network (ADR-75).
const FORBIDDEN_IN_CORE = [
  { name: 'react', message: 'lib/tiles, lib/scoring and lib/game must stay framework-free.' },
  { name: 'react-dom', message: 'lib/tiles, lib/scoring and lib/game must stay framework-free.' },
  { name: 'dexie', message: 'The domain core has no I/O; storage lives in lib/db.' },
  { name: 'zustand', message: 'The domain core has no state store; stores/ wraps it.' },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'coverage/**',
    'next-env.d.ts',
    'public/sw.js',
    'public/swe-worker-*.js',
  ]),
  {
    rules: {
      // ADR-59: no raw HTML rendering.
      'react/no-danger': 'error',
    },
  },
  {
    files: ['lib/tiles/**', 'lib/scoring/**', 'lib/game/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: FORBIDDEN_IN_CORE,
          patterns: [
            { group: ['next', 'next/*'], message: 'The domain core must not import Next.js.' },
            {
              group: ['@/components/*', '@/stores/*', '@/lib/db/*'],
              message: 'Core cannot depend on UI, stores or storage.',
            },
          ],
        },
      ],
    },
  },
]);
