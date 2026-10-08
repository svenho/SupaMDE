import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Statischer Build der Demo (example/) für GitHub Pages.
export default defineConfig({
  root: resolve(import.meta.dirname, 'example'),
  base: '/SupaMDE/',
  build: {
    outDir: resolve(import.meta.dirname, 'dist-demo'),
    emptyOutDir: true,
  },
});
