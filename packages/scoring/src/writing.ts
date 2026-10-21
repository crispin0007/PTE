/**
 * Writing checks that can be scored without a language model: form (length, one sentence, layout)
 * and spelling, following the trait bands in Pearson's Score Guide. Grammar is scored when a
 * grammar checker (LanguageTool) is available. Content, vocabulary and the other traits need a
 * language model and are reported as not scored yet.
 */
import { wordCount } from '@openpte/schema/text';
import type { ScoreResult } from './objective.ts';

export type WritingRule = 'writing_swt' | 'writing_sst' | 'writing_essay';

export type Trait = {
  name: string;
  score: number;
  max: number;
  /** False for traits this version cannot score yet; they are listed but not counted. */
  scored: boolean;
  note: string;
};

export type WritingResult = ScoreResult & {
  traits: Trait[];
  words: number;
  /** Grammar issues found, when a grammar checker ran. */
  grammar?: GrammarIssue[];
};

/** One problem a grammar checker reported, as character offsets into the answer. */
export type GrammarIssue = {
  offset: number;
  length: number;
  message: string;
  replacements: string[];
  category: string;
};

/** Counts sentences by their end punctuation. A trailing fragment without a full stop counts too. */
export function sentenceCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  // A sentence ends at . ! or ? followed by a space and a capital letter or digit, or at the end.
  const ends = t.match(/[.!?]+["')\]]*(?=\s+["'(]?[A-Z0-9])/g)?.length ?? 0;
  return ends + 1;
}

/** Layout problems that score 0 for form in SST and Essay: all capitals, no punctuation, bullets. */
export function layoutProblem(text: string): string | null {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length > 20 && letters === letters.toUpperCase()) return 'written all in capitals';
  if (wordCount(text) > 15 && !/[.!?,;:]/.test(text)) return 'no punctuation';
  if (/^\s*([-*•]|\d+[.)])\s/m.test(text)) return 'uses bullet points or a list';
  return null;
}

function formTrait(rule: WritingRule, text: string, words: number): Trait {
  if (rule === 'writing_swt') {
    const sentences = sentenceCount(text);
    const ok = sentences === 1 && words >= 5 && words <= 75;
    const why =
      sentences !== 1
        ? `${sentences} sentences; it must be exactly one`
        : words < 5 || words > 75
          ? `${words} words; it must be 5 to 75`
          : `one sentence of ${words} words`;
    return { name: 'Form', score: ok ? 1 : 0, max: 1, scored: true, note: why };
  }
  const problem = layoutProblem(text);
  const [full, partLow, partHigh, hardLow, hardHigh] =
    rule === 'writing_sst' ? [[50, 70], 40, 100, 40, 100] : [[200, 300], 120, 380, 120, 380];
  const [lo, hi] = full as number[];
  let score = 0;
  let note: string;
  if (problem) note = `${problem}, which scores 0`;
  else if (words >= lo! && words <= hi!) {
    score = 2;
    note = `${words} words, within ${lo} to ${hi}`;
  } else if (words >= (partLow as number) && words <= (partHigh as number)) {
    score = 1;
    note = `${words} words; ${lo} to ${hi} scores full marks`;
  } else {
    note = `${words} words; under ${hardLow} or over ${hardHigh} scores 0`;
  }
  return { name: 'Form', score, max: 2, scored: true, note };
}

/** Pearson's spelling band: 2 with no errors, 1 with one error, 0 with more. */
function spellingTrait(misspelled: string[]): Trait {
  const n = misspelled.length;
  return {
    name: 'Spelling',
    score: n === 0 ? 2 : n === 1 ? 1 : 0,
    max: 2,
    scored: true,
    note:
      n === 0
        ? 'no spelling errors found'
        : `${n} possible error${n === 1 ? '' : 's'}: ${misspelled.join(', ')}`,
  };
}

/**
 * Grammar band: 2 for no errors, 1 for a few, 0 for many. "A few" scales with length: one error
 * in a one-sentence summary, up to 2 in a spoken-text summary and up to 4 in an essay.
 */
const FEW_ERRORS: Record<WritingRule, number> = {
  writing_swt: 1,
  writing_sst: 2,
  writing_essay: 4,
};

export function grammarTrait(rule: WritingRule, issues: GrammarIssue[]): Trait {
  const n = issues.length;
  const score = n === 0 ? 2 : n <= FEW_ERRORS[rule] ? 1 : 0;
  const list = issues
    .slice(0, 3)
    .map((i) => i.message.replace(/\.$/, ''))
    .join('; ');
  return {
    name: 'Grammar',
    score,
    max: 2,
    scored: true,
    note:
      n === 0
        ? 'no grammar errors found'
        : `${n} possible error${n === 1 ? '' : 's'}: ${list}${n > 3 ? '; …' : ''}`,
  };
}

const LATER: Record<WritingRule, [string, number][]> = {
  writing_swt: [
    ['Content', 4],
    ['Grammar', 2],
    ['Vocabulary', 2],
  ],
  writing_sst: [
    ['Content', 4],
    ['Grammar', 2],
    ['Vocabulary', 2],
  ],
  writing_essay: [
    ['Content', 6],
    ['Development, structure and coherence', 6],
    ['Grammar', 2],
    ['General linguistic range', 6],
    ['Vocabulary range', 2],
  ],
};

export function scoreWriting(
  rule: WritingRule,
  text: string,
  misspelled: string[],
  grammar?: GrammarIssue[],
): WritingResult {
  const words = wordCount(text);
  const form = formTrait(rule, text, words);
  const traits: Trait[] = [form];
  if (rule !== 'writing_swt') traits.push(spellingTrait(misspelled));
  if (grammar) traits.push(grammarTrait(rule, grammar));
  // Pearson does not score the other traits when form is 0; neither do we.
  if (form.score === 0) for (const t of traits.slice(1)) Object.assign(t, { score: 0 });
  for (const [name, max] of LATER[rule]) {
    if (grammar && name === 'Grammar') continue;
    traits.push({
      name,
      score: 0,
      max,
      scored: false,
      note: 'not scored yet; compare with the sample answer',
    });
  }
  const counted = traits.filter((t) => t.scored);
  const working = counted.map((t) => `${t.name}: ${t.score} of ${t.max} (${t.note})`);
  if (form.score === 0 && counted.length > 1)
    working.push('Form scored 0, so the other traits score 0 as well');
  return {
    rule,
    score: counted.reduce((n, t) => n + t.score, 0),
    max: counted.reduce((n, t) => n + t.max, 0),
    working,
    traits,
    words,
    ...(grammar ? { grammar } : {}),
  };
}
