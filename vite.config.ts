import { defineConfig } from 'vite';

// GitHub Pages serves project sites from /<repo-name>/; the deploy workflow sets BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
