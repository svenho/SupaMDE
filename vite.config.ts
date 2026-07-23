/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'SupaMDE',
      fileName: () => 'supamde.mjs',
      formats: ['es'],
    },
    sourcemap: true,
    rollupOptions: {
      // CM6/Lezer sind Peer Dependencies — nicht ins Bundle ziehen.
      external: /^@(codemirror|lezer)\//,
      output: {
        exports: 'named',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**'],
    },
  },
});
