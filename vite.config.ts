/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'SupaMDE',
      fileName: (format) => (format === 'es' ? 'supamde.mjs' : 'supamde.js'),
      formats: ['es', 'umd'],
    },
    sourcemap: true,
    rollupOptions: {
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
