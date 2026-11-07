import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the build works at any address (D-009).
  base: './',
  build: {
    // Keeps Vite's own code out of the bundle, so `NOTICE` stays complete.
    modulePreload: { polyfill: false },
    // three.js alone is about 530 kB, so the default limit of 500 would always warn.
    chunkSizeWarningLimit: 800,
  },
});
