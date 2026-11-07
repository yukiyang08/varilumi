import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// dist/embed.js: the lab as one script that varilumi.com loads into its own page (see src/embed.tsx).
// Images and data still come from GitHub Pages, so every URL is absolute.
export default defineConfig({
  base: 'https://yukiyang08.github.io/varilumi/',
  plugins: [react()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // the normal build is already in dist
    lib: { entry: 'src/embed.tsx', formats: ['es'], fileName: () => 'embed.js' },
  },
});
