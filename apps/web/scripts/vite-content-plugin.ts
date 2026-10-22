import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import type { Plugin } from 'vite';
import type { Question } from '@openpte/schema';
import { loadContent } from '@openpte/schema/node';

const CATALOG = 'virtual:openpte/catalog';
const TYPE_PREFIX = 'virtual:openpte/type/';
const PHONES = 'virtual:openpte/phones';
const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Compiles content/ YAML into virtual modules at build time:
 * - `virtual:openpte/catalog`: the item-type registry, question counts and one lazy loader per type
 * - `virtual:openpte/type/<type>`: that type's questions, so each type is its own small chunk
 * - `virtual:openpte/phones`: expected sounds per word for the in-browser pronunciation check
 *   (content/phones.json, made by services/speech/make_phones.py), loaded only when used
 * Invalid content fails the build. Only `published` questions ship, unless
 * OPENPTE_INCLUDE_UNREVIEWED=1 is set (always on in dev), which adds `in_review` ones.
 * `root` is the repo root, where content/ and content-assets/ live.
 */
export function contentPlugin(root: string): Plugin {
  let includeUnreviewed = process.env.OPENPTE_INCLUDE_UNREVIEWED === '1';
  let byType = new Map<string, Question[]>();
  let registryJson = '[]';

  function load(fail: (msg: string) => void) {
    const result = loadContent(root);
    if (result.errors.length) fail(`Invalid content:\n${result.errors.join('\n')}`);
    const allowed = new Set(includeUnreviewed ? ['published', 'in_review'] : ['published']);
    byType = new Map(result.registry.map((d) => [d.id, [] as Question[]]));
    for (const { question } of result.questions) {
      if (allowed.has(question.status)) byType.get(question.type)?.push(question);
    }
    registryJson = JSON.stringify(result.registry.filter((d) => d.enabled));
  }

  return {
    name: 'openpte-content',
    configResolved(config) {
      if (config.command === 'serve') includeUnreviewed = true;
    },
    buildStart() {
      load((msg) => this.error(msg));
      for (const path of ['content/item-types.yaml', 'content/questions'])
        this.addWatchFile(join(root, path));
    },
    resolveId(id) {
      if (id === CATALOG || id === PHONES || id.startsWith(TYPE_PREFIX)) return '\0' + id;
    },
    load(id) {
      if (id === '\0' + CATALOG) {
        const counts = Object.fromEntries([...byType].map(([t, qs]) => [t, qs.length]));
        const loaders = [...byType.keys()]
          .map(
            (t) =>
              `  ${JSON.stringify(t)}: () => import(${JSON.stringify(TYPE_PREFIX + t)}).then((m) => m.default),`,
          )
          .join('\n');
        const assets = [...byType.values()]
          .flat()
          .flatMap((q) => [(q as { image?: string }).image, (q as { audio?: string }).audio])
          .filter((a): a is string => !!a && existsSync(join(root, 'content-assets', a)));
        return [
          `export const registry = ${registryJson};`,
          `export const availableAssets = ${JSON.stringify(assets)};`,
          `export const counts = ${JSON.stringify(counts)};`,
          `export const includesUnreviewed = ${includeUnreviewed};`,
          `export const loaders = {\n${loaders}\n};`,
        ].join('\n');
      }
      if (id === '\0' + PHONES) {
        // All of them, not only shipped questions: with an API, questions come from the database.
        const file = join(root, 'content/phones.json');
        return `export default ${existsSync(file) ? readFileSync(file, 'utf8') : '{}'};`;
      }
      if (id.startsWith('\0' + TYPE_PREFIX)) {
        const type = id.slice(TYPE_PREFIX.length + 1);
        return `export default ${JSON.stringify(byType.get(type) ?? [])};`;
      }
    },
    configureServer(server) {
      const reload = () => {
        try {
          load((msg) => {
            throw new Error(msg);
          });
        } catch (e) {
          server.config.logger.error((e as Error).message);
        }
        for (const mod of server.moduleGraph.getModulesByFile('\0' + CATALOG) ?? [])
          server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('change', (f) => f.includes(`${join(root, 'content')}`) && reload());
      // Serve content-assets/ in dev; the build copies the referenced files (generateBundle below).
      server.middlewares.use('/content-assets', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '').split('?')[0]!)).replace(
          /^([/\\])+/,
          '',
        );
        const file = join(root, 'content-assets', rel);
        if (rel.startsWith('..') || !existsSync(file) || !MIME[extname(file)]) return next();
        res.setHeader('Content-Type', MIME[extname(file)]!);
        createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const qs of byType.values()) {
        for (const q of qs) {
          for (const asset of [(q as { image?: string }).image, (q as { audio?: string }).audio]) {
            const file = asset && join(root, 'content-assets', asset);
            if (file && existsSync(file)) {
              this.emitFile({
                type: 'asset',
                fileName: `content-assets/${asset}`,
                source: readFileSync(file),
              });
            }
          }
        }
      }
    },
  };
}
