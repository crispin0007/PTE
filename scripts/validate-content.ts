// Validates every question and asset. Used by CI and `npm run validate`.
// Exits 1 on any error. Warnings (such as audio not generated yet) do not fail the run.
import { loadContent } from '@openpte/schema/node';

const verbose = process.argv.includes('--verbose');
const { errors, warnings, questions, registry } = loadContent(process.cwd());

for (const e of errors) console.error(`ERROR ${e}`);
const audio = warnings.filter((w) => w.includes('audio not generated'));
for (const w of warnings) if (verbose || !audio.includes(w)) console.warn(`WARN  ${w}`);
if (audio.length && !verbose)
  console.warn(`WARN  ${audio.length} audio files not generated yet (--verbose to list)`);

console.log(
  `${questions.length} valid questions across ${registry.length} item types; ${errors.length} errors, ${warnings.length} warnings`,
);
process.exit(errors.length ? 1 : 0);
