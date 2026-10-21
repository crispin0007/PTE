import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { contentPlugin } from './scripts/vite-content-plugin.ts';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
// The Hunspell dictionaries only export a Node loader, so point at their folders directly and
// load the .aff and .dic files as URLs (they are fetched only when a writing answer is checked).
const dictDir = (name: string) => dirname(fileURLToPath(import.meta.resolve(name)));

export default defineConfig({
  // Relative base so the same build works on GitHub Pages project sites and any static host.
  base: './',
  plugins: [react(), tailwindcss(), contentPlugin(repoRoot)],
  resolve: {
    alias: {
      '@dict/en-us': dictDir('dictionary-en'),
      '@dict/en-gb': dictDir('dictionary-en-gb'),
    },
  },
});
