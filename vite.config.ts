import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any static host path (e.g. GitHub Pages).
  base: './',
  build: {
    // Three.js alone is ~600 kB minified; one bundle is fine for this app.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: true,
  },
});
