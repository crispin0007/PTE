/**
 * Scoring for the question types with one right answer. Each function follows the rule named in
 * rules.ts, which follows Pearson's published Score Guide for PTE Academic. Results carry the
 * arithmetic so the result screen can show how the score was reached.
 */
import type { ScoringRuleId } from './rules.ts';

export type Mark = 'right' | 'wrong' | 'missed';

export type ScoreResult = {
  rule: ScoringRuleId;
  score: number;
  max: number;
  /** Plain-English lines that add up to the score, e.g. "3 correct options: +3". */
  working: string[];
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** mcq_single: 1 for the correct option, otherwise 0. */
export function scoreMcqSingle(answer: number, chosen: number | null): ScoreResult {
  const right = chosen === answer;
  return {
    rule: 'mcq_single',
    score: right ? 1 : 0,
    max: 1,
    working: [
      chosen === null
        ? 'No option chosen: 0'
        : right
          ? 'Correct option chosen: 1'
          : 'Incorrect option chosen: 0',
    ],
  };
}

/** mcq_multiple_negative: +1 per correct option chosen, -1 per incorrect option chosen, minimum 0. */
export function scoreMcqMultiple(answers: number[], chosen: number[]): ScoreResult {
  const key = new Set(answers);
  const picked = new Set(chosen);
  const right = [...picked].filter((c) => key.has(c)).length;
  const wrong = picked.size - right;
  const raw = right - wrong;
  const working = [`${plural(right, 'correct option')} chosen: +${right}`];
  if (wrong) working.push(`${plural(wrong, 'incorrect option')} chosen: -${wrong}`);
  if (raw < 0) working.push(`Total ${raw} is raised to the minimum of 0`);
  return { rule: 'mcq_multiple_negative', score: Math.max(0, raw), max: answers.length, working };
}

/**
 * reorder_adjacent_pairs: 1 point for each pair of neighbouring paragraphs that also sit next to
 * each other, in that order, in the correct sequence. `order` lists paragraph indexes as placed.
 */
export function scoreReorder(
  paragraphCount: number,
  order: number[],
): ScoreResult & {
  pairs: boolean[];
} {
  // In the correct sequence paragraph i is followed by paragraph i + 1.
  const pairs = order.slice(1).map((p, i) => p === order[i]! + 1);
  const score = pairs.filter(Boolean).length;
  const max = paragraphCount - 1;
  return {
    rule: 'reorder_adjacent_pairs',
    score,
    max,
    pairs,
    working: [`${score} of ${plural(max, 'neighbouring pair')} in the right order: ${score}`],
  };
}

/** Normalises a typed or chosen word for comparison: trims and ignores case. */
const norm = (s: string) => s.trim().toLowerCase();

/**
 * fib_per_blank and fib_per_blank_spelling: 1 per correctly filled blank. Typed blanks
 * (Listening) must be spelled exactly; case and surrounding spaces are ignored.
 */
export function scoreBlanks(
  expected: string[],
  given: (string | null)[],
  rule: 'fib_per_blank' | 'fib_per_blank_spelling' = 'fib_per_blank',
): ScoreResult & { marks: Mark[] } {
  const marks: Mark[] = expected.map((e, i) => {
    const g = given[i];
    if (g === null || g === undefined || !g.trim()) return 'missed';
    return norm(g) === norm(e) ? 'right' : 'wrong';
  });
  const score = marks.filter((m) => m === 'right').length;
  return {
    rule,
    score,
    max: expected.length,
    marks,
    working: [
      `${score} of ${plural(expected.length, 'blank')} correct${rule === 'fib_per_blank_spelling' ? ' (spelling must be exact)' : ''}: ${score}`,
    ],
  };
}

/** hiw_plus_minus: +1 per correctly clicked word, -1 per wrongly clicked word, minimum 0. */
export function scoreHighlightIncorrect(swapIndexes: number[], clicked: number[]): ScoreResult {
  const key = new Set(swapIndexes);
  const picked = new Set(clicked);
  const right = [...picked].filter((c) => key.has(c)).length;
  const wrong = picked.size - right;
  const raw = right - wrong;
  const working = [`${plural(right, 'changed word')} found: +${right}`];
  if (wrong) working.push(`${plural(wrong, 'correct word')} clicked by mistake: -${wrong}`);
  if (raw < 0) working.push(`Total ${raw} is raised to the minimum of 0`);
  return { rule: 'hiw_plus_minus', score: Math.max(0, raw), max: swapIndexes.length, working };
}

/** Splits a sentence into comparable words: lower case, punctuation removed except inner apostrophes and hyphens. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter(Boolean);
}

/**
 * wfd_per_word: 1 point per word of the reference sentence that appears in the response, spelled
 * correctly. Each response word can match one reference word; order does not matter.
 */
export function scoreDictation(
  sentence: string,
  typed: string,
): ScoreResult & {
  marks: { word: string; found: boolean }[];
} {
  const pool = new Map<string, number>();
  for (const w of words(typed)) pool.set(w, (pool.get(w) ?? 0) + 1);
  const marks = words(sentence).map((word) => {
    const n = pool.get(word) ?? 0;
    if (n > 0) pool.set(word, n - 1);
    return { word, found: n > 0 };
  });
  const score = marks.filter((m) => m.found).length;
  return {
    rule: 'wfd_per_word',
    score,
    max: marks.length,
    marks,
    working: [`${score} of ${plural(marks.length, 'word')} written correctly: ${score}`],
  };
}
