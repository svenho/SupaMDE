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
      external: /^(@(codemirror|lezer)\/|katex($|\/))/,
      output: {
        exports: 'named',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Vitest verarbeitet CSS standardmässig NICHT — `?inline`-Importe lieferten
    // dann leere Strings und der Inject-Test prüfte nur Newlines. Der Build ist
    // davon unberührt; das Flag gilt allein dem Testlauf.
    css: true,
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**'],
    },
  },
});
