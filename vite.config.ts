import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { contentPlugin } from './scripts/vite-content-plugin.ts';

export default defineConfig({
  // Relative base so the same build works on GitHub Pages project sites and any static host.
  base: './',
  plugins: [react(), tailwindcss(), contentPlugin()],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
