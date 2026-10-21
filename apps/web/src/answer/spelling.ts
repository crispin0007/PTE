import usAff from '@dict/en-us/index.aff?url';
import usDic from '@dict/en-us/index.dic?url';
import gbAff from '@dict/en-gb/index.aff?url';
import gbDic from '@dict/en-gb/index.dic?url';

type Checker = (word: string) => boolean;
let loading: Promise<Checker> | null = null;

async function dictionary(aff: string, dic: string) {
  const [a, d] = await Promise.all([fetch(aff), fetch(dic)].map((p) => p.then((r) => r.text())));
  return { aff: a!, dic: d! };
}

/**
 * Loads Hunspell British and American English dictionaries on first use (about 1 MB, cached by
 * the browser). PTE accepts either spelling, so a word is correct if either dictionary has it.
 */
export function loadSpeller(): Promise<Checker> {
  loading ??= Promise.all([
    import('nspell'),
    dictionary(gbAff, gbDic),
    dictionary(usAff, usDic),
  ]).then(([{ default: nspell }, gb, us]) => {
    const g = nspell(gb);
    const u = nspell(us);
    return (w: string) => g.correct(w) || u.correct(w);
  });
  loading.catch(() => (loading = null));
  return loading;
}

/** Unique words the dictionaries do not know. Acronyms, numbers and URLs are skipped. */
export async function misspellings(text: string): Promise<string[]> {
  const correct = await loadSpeller();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(/[A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z]/g)) {
    const word = m[0].replace(/’/g, "'");
    if (word.length > 1 && word === word.toUpperCase()) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const parts = word.split('-');
    if (!parts.every((p) => !p || correct(p) || correct(p.toLowerCase()))) out.push(word);
  }
  return out;
}
