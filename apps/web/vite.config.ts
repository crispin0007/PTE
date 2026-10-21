import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { contentPlugin } from './scripts/vite-content-plugin.ts';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  // Relative base so the same build works on GitHub Pages project sites and any static host.
  base: './',
  plugins: [react(), tailwindcss(), contentPlugin(repoRoot)],
});
