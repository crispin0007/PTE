import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse } from 'yaml';
import { validateBank, type SourceFile, type ValidationResult } from '../../src/schema/validate.ts';

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : /\.ya?ml$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

export function readYaml(path: string): unknown {
  return parse(readFileSync(path, 'utf8'));
}

/** Reads content/ and content-assets/ under `root` and validates them. */
export function loadContent(root: string): ValidationResult {
  const toPosix = (p: string) => relative(root, p).split(sep).join('/');
  const files: SourceFile[] = [];
  const parseErrors: string[] = [];
  for (const path of walk(join(root, 'content', 'questions')).sort()) {
    try {
      files.push({ path: toPosix(path), data: readYaml(path) });
    } catch (e) {
      parseErrors.push(`${toPosix(path)}: invalid YAML: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  const assetsDir = join(root, 'content-assets');
  const result = validateBank(readYaml(join(root, 'content', 'item-types.yaml')), files, {
    exists: (p) => existsSync(join(assetsDir, p)),
    hasSidecar: (p) => existsSync(join(assetsDir, p.replace(/\.[^.]+$/, '.meta.yaml'))),
  });
  result.errors.unshift(...parseErrors);
  return result;
}
