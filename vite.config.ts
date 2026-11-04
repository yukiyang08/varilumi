import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' so the build works under any sub-path (GitHub Pages, iframe embeds, previews).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
});
