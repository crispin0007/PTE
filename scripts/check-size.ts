// Fails if the JavaScript loaded on first visit is over budget. Phones on slow connections are the audience.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 150;
const html = readFileSync('dist/index.html', 'utf8');
const entries = [
  ...html.matchAll(/<script[^>]+src="\.?\/?([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\.?\/?([^"]+\.js)"/g),
].map((m) => m[1]!);
if (!entries.length) {
  console.error('No script found in dist/index.html; run npm run build first.');
  process.exit(1);
}
const kb =
  entries.reduce((sum, f) => sum + gzipSync(readFileSync(join('dist', f))).length, 0) / 1024;
const lazy = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).length - entries.length;
console.log(
  `Initial JS: ${kb.toFixed(1)} KB gzipped (budget ${BUDGET_KB} KB); ${lazy} lazy chunks`,
);
process.exit(kb > BUDGET_KB ? 1 : 0);
