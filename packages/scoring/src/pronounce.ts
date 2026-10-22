/**
 * Goodness of pronunciation from phoneme posteriors, for the in-browser check. The same method as
 * services/speech/pronounce.py (keep the two in step): force-align the expected phones to the
 * frames with CTC Viterbi, then score each phone by how strong it was near its aligned frames
 * compared with the strongest phone heard there.
 */
import type { PronunciationReport } from './speaking.ts';

/** Frame-by-phone probabilities: `data[t * size + v]`. */
export type Posteriors = { data: Float32Array | number[]; frames: number; size: number };

const WINDOW = 2;
const PRESENT = 0.5;

/** Phones the model knows. An unknown phone is split into known pieces, or dropped. */
export function toVocab(phones: string[], vocab: Record<string, number>): string[] {
  const out: string[] = [];
  for (const p of phones) {
    if (p in vocab) {
      out.push(p);
      continue;
    }
    let i = 0;
    while (i < p.length) {
      let j = p.length;
      while (j > i && !(p.slice(i, j) in vocab)) j--;
      if (j > i) {
        out.push(p.slice(i, j));
        i = j;
      } else i++;
    }
  }
  return out;
}

/** Viterbi CTC forced alignment: the first and last frame of each target, or null when the audio
 * is too short for the targets. */
export function ctcAlign(
  logp: Posteriors,
  targets: number[],
  blank: number,
): [number, number][] | null {
  const { frames, size, data } = logp;
  const ext = [blank];
  for (const t of targets) ext.push(t, blank);
  const S = ext.length;
  const skip = ext.map((e, s) => s >= 2 && e !== blank && e !== ext[s - 2]);
  let score = new Float64Array(S).fill(-Infinity);
  score[0] = data[ext[0]!]!;
  if (S > 1) score[1] = data[ext[1]!]!;
  const back = new Uint8Array(frames * S);
  for (let t = 1; t < frames; t++) {
    const next = new Float64Array(S);
    for (let s = 0; s < S; s++) {
      let best = score[s]!;
      let choice = 0;
      if (s >= 1 && score[s - 1]! > best) {
        best = score[s - 1]!;
        choice = 1;
      }
      if (skip[s] && score[s - 2]! > best) {
        best = score[s - 2]!;
        choice = 2;
      }
      next[s] = best + data[t * size + ext[s]!]!;
      back[t * S + s] = choice;
    }
    score = next;
  }
  const end = S === 1 || score[S - 1]! >= score[S - 2]! ? S - 1 : S - 2;
  if (!Number.isFinite(score[end]!)) return null;
  const path = new Int32Array(frames);
  let s = end;
  for (let t = frames - 1; t >= 0; t--) {
    path[t] = s;
    s -= back[t * S + s]!;
  }
  const spans: [number, number][] = [];
  for (let k = 0; k < targets.length; k++) {
    let first = -1;
    let last = -1;
    for (let t = 0; t < frames; t++)
      if (path[t] === 2 * k + 1) {
        if (first < 0) first = t;
        last = t;
      }
    if (first < 0) return null;
    spans.push([first, last]);
  }
  return spans;
}

/** 0-100 for each target. */
export function gopScores(
  probs: Posteriors,
  spans: [number, number][],
  targets: number[],
  blank: number,
): number[] {
  const { frames, size, data } = probs;
  return spans.map(([a, b], k) => {
    const tok = targets[k]!;
    let expected = 0;
    let strongest = 0;
    for (let t = Math.max(0, a - WINDOW); t < Math.min(frames, b + WINDOW + 1); t++) {
      expected = Math.max(expected, data[t * size + tok]!);
      for (let v = 0; v < size; v++)
        if (v !== blank) strongest = Math.max(strongest, data[t * size + v]!);
    }
    return Math.min(100, Math.round((100 * expected) / Math.max(strongest, PRESENT)));
  });
}

/** Softmax over each frame of raw logits. */
export function softmaxFrames(logits: Float32Array, frames: number, size: number): Posteriors {
  const data = new Float32Array(logits.length);
  for (let t = 0; t < frames; t++) {
    let max = -Infinity;
    for (let v = 0; v < size; v++) max = Math.max(max, logits[t * size + v]!);
    let sum = 0;
    for (let v = 0; v < size; v++)
      sum += data[t * size + v] = Math.exp(logits[t * size + v]! - max);
    for (let v = 0; v < size; v++) data[t * size + v]! /= sum;
  }
  return { data, frames, size };
}

/**
 * Scores the sounds of each word. `phones[i]` is word i's expected phones, space separated (from
 * content/phones.json).
 */
export function assessSounds(
  probs: Posteriors,
  model: { vocab: Record<string, number>; blank: number; engine: string },
  words: string[],
  phones: string[],
): PronunciationReport | null {
  const perWord = phones.map((p) => toVocab(p.split(' ').filter(Boolean), model.vocab));
  const targets = perWord.flat().map((p) => model.vocab[p]!);
  if (!targets.length || probs.frames < 1) return null;
  const logp = {
    ...probs,
    data: Float32Array.from(probs.data, (p) => Math.log(Math.min(1, Math.max(1e-10, p)))),
  };
  const spans = ctcAlign(logp, targets, model.blank);
  if (!spans) return null;
  const scores = gopScores(probs, spans, targets, model.blank);
  let k = 0;
  const out = words.map((word, i) => {
    const ps = (perWord[i] ?? []).map((phone) => ({ phone, score: scores[k++]! }));
    const score = ps.length ? Math.round(ps.reduce((n, p) => n + p.score, 0) / ps.length) : 0;
    return { word, score, phones: ps };
  });
  const scored = out.filter((w) => w.phones.length);
  return {
    engine: model.engine,
    score: scored.length ? Math.round(scored.reduce((n, w) => n + w.score, 0) / scored.length) : 0,
    words: out,
  };
}
