import { defineConfig } from 'vite';

// Relative asset paths work under any GitHub Pages sub-path (/<repo-name>/), even after a repo rename.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
