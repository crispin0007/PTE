/**
 * Speaking scores from a timed transcript (words with start and end times, from the speech
 * service). Content follows Pearson's published trait descriptions; fluency is estimated from
 * speech rate, long pauses, fillers and repeats. Pronunciation needs the phoneme model (step 2.4);
 * until then it is estimated from how confidently the words were recognised.
 */
import { words } from './objective.ts';
import type { ScoreResult } from './objective.ts';
import type { Trait } from './writing.ts';

export type TimedWord = { word: string; start: number; end: number; probability?: number };
export type TimedTranscript = { words: TimedWord[]; duration: number };

export type SpeakingRule =
  | 'speaking_read_aloud'
  | 'speaking_repeat_sentence'
  | 'speaking_open_response'
  | 'speaking_short_answer';

export type WordMark = { word: string; status: 'said' | 'missed' | 'changed'; heard?: string };

export type SpeakingResult = ScoreResult & {
  traits: Trait[];
  /** Reference words marked (Read Aloud, Repeat Sentence). */
  marks?: WordMark[];
  /** Key points with whether the answer covered them (open responses). */
  points?: { point: string; covered: boolean }[];
  fluency: FluencyStats;
};

export type FluencyStats = {
  wordsPerMinute: number;
  longPauses: number;
  fillers: number;
  repeats: number;
  /** Seconds of silence before the first word. */
  lead: number;
};

const FILLERS = new Set(['um', 'uh', 'er', 'erm', 'ah', 'hmm', 'mm', 'uhm']);
export const LONG_PAUSE_S = 1;

/** Spoken words without fillers, normalised like dictation. */
function spokenWords(t: TimedTranscript): string[] {
  return t.words.flatMap((w) => words(w.word)).filter((w) => !FILLERS.has(w));
}

export function fluencyStats(t: TimedTranscript): FluencyStats {
  const ws = t.words;
  if (!ws.length)
    return { wordsPerMinute: 0, longPauses: 0, fillers: 0, repeats: 0, lead: t.duration };
  let longPauses = 0;
  for (let i = 1; i < ws.length; i++)
    if (ws[i]!.start - ws[i - 1]!.end >= LONG_PAUSE_S) longPauses++;
  const tokens = ws.flatMap((w) => words(w.word));
  const fillers = tokens.filter((w) => FILLERS.has(w)).length;
  const content = tokens.filter((w) => !FILLERS.has(w));
  const repeats = content.filter((w, i) => i > 0 && w === content[i - 1]).length;
  const speaking = Math.max(0.5, ws.at(-1)!.end - ws[0]!.start);
  return {
    wordsPerMinute: Math.round((content.length / speaking) * 60),
    longPauses,
    fillers,
    repeats,
    lead: Math.round(ws[0]!.start * 10) / 10,
  };
}

/**
 * Fluency on Pearson's 0-5 scale, estimated: start at 5 and take off for each long pause, for
 * every two fillers or repeats, and for a pace far from natural speech (about 100-180 words a
 * minute). Very short answers cannot be fluent.
 */
export function fluencyScore(s: FluencyStats, wordCount: number): { score: number; note: string } {
  if (wordCount < 3) return { score: 0, note: 'too little speech to judge' };
  let score = 5;
  const notes: string[] = [];
  if (s.longPauses) {
    score -= s.longPauses;
    notes.push(`${s.longPauses} long pause${s.longPauses === 1 ? '' : 's'}`);
  }
  const hesitations = s.fillers + s.repeats;
  if (hesitations) {
    score -= Math.floor(hesitations / 2);
    notes.push(
      `${hesitations} filler${hesitations === 1 ? '' : 's'} or repeat${hesitations === 1 ? '' : 's'}`,
    );
  }
  if (s.wordsPerMinute < 80 || s.wordsPerMinute > 200) {
    score -= 2;
    notes.push(`${s.wordsPerMinute} words a minute (${s.wordsPerMinute < 80 ? 'slow' : 'rushed'})`);
  } else if (s.wordsPerMinute < 100 || s.wordsPerMinute > 180) {
    score -= 1;
    notes.push(`${s.wordsPerMinute} words a minute`);
  } else notes.push(`steady pace, ${s.wordsPerMinute} words a minute`);
  return { score: Math.max(0, score), note: notes.join(', ') };
}

/** Estimated from recognition confidence until the phoneme model is in place. */
function pronunciationTrait(t: TimedTranscript): Trait {
  const probs = t.words.map((w) => w.probability).filter((p): p is number => p !== undefined);
  if (!probs.length)
    return {
      name: 'Pronunciation',
      score: 0,
      max: 5,
      scored: false,
      note: 'needs the speech service',
    };
  const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
  const score =
    mean >= 0.9 ? 5 : mean >= 0.8 ? 4 : mean >= 0.7 ? 3 : mean >= 0.55 ? 2 : mean >= 0.4 ? 1 : 0;
  return {
    name: 'Pronunciation',
    score,
    max: 5,
    scored: true,
    note: `estimated from how clearly words were recognised (${Math.round(mean * 100)}%)`,
  };
}

/**
 * Aligns the reference words with what was said (word-level edit distance) and marks each
 * reference word as said, missed or changed.
 */
export function alignWords(reference: string[], spoken: string[]): WordMark[] {
  const n = reference.length;
  const m = spoken.length;
  const d = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (reference[i - 1] === spoken[j - 1] ? 0 : 1),
      );
  const marks: WordMark[] = [];
  let i = n;
  let j = m;
  // Walk back preferring a match, then an extra spoken word, then a missed word, and only then a
  // changed word, so that the marking keeps as many words "said" as possible.
  while (i > 0) {
    const here = d[i]![j]!;
    if (j > 0 && reference[i - 1] === spoken[j - 1] && here === d[i - 1]![j - 1]) {
      marks.push({ word: reference[i - 1]!, status: 'said' });
      i--;
      j--;
    } else if (j > 0 && here === d[i]![j - 1]! + 1) {
      j--;
    } else if (here === d[i - 1]![j]! + 1) {
      marks.push({ word: reference[i - 1]!, status: 'missed' });
      i--;
    } else {
      marks.push({ word: reference[i - 1]!, status: 'changed', heard: spoken[j - 1] });
      i--;
      j--;
    }
  }
  return marks.reverse();
}

const STOP = new Set(
  'a an the of to in on at for and or but is are was were be been it its this that these those with by from as than then so such can could will would should may might do does did has have had not no very more most less least there their they them he she his her we our you your i'.split(
    ' ',
  ),
);
/** Crude stemming so "rising" matches "rise" and "cities" matches "city". */
const stem = (w: string) =>
  w
    .replace(/(ies|ied)$/, 'y')
    .replace(/(ing|ed|es|s)$/, '')
    .slice(0, 6);
const contentWords = (text: string) => [
  ...new Set(
    words(text)
      .filter((w) => !STOP.has(w) && w.length > 2)
      .map(stem),
  ),
];

/** A key point counts as covered when at least half of its content words were said. */
export function coverKeyPoints(points: string[], spoken: string[]) {
  const said = new Set(spoken.map(stem));
  return points.map((point) => {
    const cw = contentWords(point);
    const hit = cw.filter((w) => said.has(w)).length;
    return { point, covered: cw.length > 0 && hit / cw.length >= 0.5 };
  });
}

type Reference =
  | { rule: 'speaking_read_aloud' | 'speaking_repeat_sentence'; text: string }
  | { rule: 'speaking_open_response'; keyPoints: string[] }
  | { rule: 'speaking_short_answer'; accepted: string[] };

export function scoreSpeaking(ref: Reference, t: TimedTranscript): SpeakingResult {
  const spoken = spokenWords(t);
  const stats = fluencyStats(t);
  const fluency = fluencyScore(stats, spoken.length);
  const traits: Trait[] = [];
  let marks: WordMark[] | undefined;
  let points: SpeakingResult['points'];

  if (ref.rule === 'speaking_short_answer') {
    const said = ` ${spoken.join(' ')} `;
    const ok = ref.accepted.some((a) => said.includes(` ${words(a).join(' ')} `));
    traits.push({
      name: 'Vocabulary',
      score: ok ? 1 : 0,
      max: 1,
      scored: true,
      note: ok ? 'an accepted answer was said' : `expected: ${ref.accepted.join(' or ')}`,
    });
  } else {
    if (ref.rule === 'speaking_open_response') {
      points = coverKeyPoints(ref.keyPoints, spoken);
      const covered = points.filter((p) => p.covered).length;
      traits.push({
        name: 'Content',
        score: Math.round((5 * covered) / points.length),
        max: 5,
        scored: true,
        note: `${covered} of ${points.length} key points covered`,
      });
    } else {
      const reference = words(ref.text);
      marks = alignWords(reference, spoken);
      const said = marks.filter((m) => m.status === 'said').length;
      const share = reference.length ? said / reference.length : 0;
      // Repeat Sentence content is 0-3 in Pearson's guide; Read Aloud counts every word.
      const content =
        ref.rule === 'speaking_repeat_sentence'
          ? { score: share >= 0.999 ? 3 : share >= 0.5 ? 2 : share > 0.1 ? 1 : 0, max: 3 }
          : { score: said, max: reference.length };
      traits.push({
        name: 'Content',
        ...content,
        scored: true,
        note: `${said} of ${reference.length} words said correctly, in order`,
      });
    }
    traits.push(pronunciationTrait(t));
    traits.push({
      name: 'Oral fluency',
      score: fluency.score,
      max: 5,
      scored: true,
      note: fluency.note,
    });
  }

  const counted = traits.filter((x) => x.scored);
  return {
    rule: ref.rule,
    score: counted.reduce((n, x) => n + x.score, 0),
    max: counted.reduce((n, x) => n + x.max, 0),
    working: counted.map((x) => `${x.name}: ${x.score} of ${x.max} (${x.note})`),
    traits,
    marks,
    points,
    fluency: stats,
  };
}
