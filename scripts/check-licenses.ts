// Fails if an installed npm package has a licence we must ask about first (AGENTS.md section 3):
// GPL or AGPL family, non-commercial, or no licence at all. Our own package is skipped.
import { readFileSync } from 'node:fs';

type Lock = { packages: Record<string, { license?: string; dev?: boolean }> };
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as Lock;
const RESTRICTED = /\b(A?GPL|LGPL|SSPL|BUSL|CC-BY-NC|Commons-Clause)/i;
// Packages reviewed and accepted despite matching the pattern, with the reason.
const ALLOWED: Record<string, string> = {};

const problems = Object.entries(lock.packages)
  .filter(([path]) => path.startsWith('node_modules/'))
  .map(([path, p]) => ({
    name: path.slice(path.lastIndexOf('node_modules/') + 13),
    license: p.license,
  }))
  .filter(({ name, license }) => !ALLOWED[name] && (!license || RESTRICTED.test(license)));

for (const p of problems) console.error(`${p.name}: ${p.license ?? 'no licence declared'}`);
console.log(
  `${Object.keys(lock.packages).length - 1} packages checked; ${problems.length} need review`,
);
process.exit(problems.length ? 1 : 0);
