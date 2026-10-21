import type { Attempt } from './history.ts';
import { latestAttempts, statusOf } from './history.ts';

const DAY = 86_400_000;

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function answeredOn(attempts: Attempt[], now: number): number {
  const today = dayKey(now);
  return attempts.filter((a) => dayKey(a.at) === today).length;
}

/** Questions answered on each of the last `days` days, oldest first. */
export function dailyCounts(attempts: Attempt[], now: number, days = 30) {
  const counts = new Map<string, { n: number; score: number; max: number }>();
  for (const a of attempts) {
    const k = dayKey(a.at);
    const c = counts.get(k) ?? { n: 0, score: 0, max: 0 };
    counts.set(k, { n: c.n + 1, score: c.score + a.score, max: c.max + a.max });
  }
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(now - (days - 1 - i) * DAY);
    const c = counts.get(day);
    return { day, n: c?.n ?? 0, accuracy: c && c.max ? c.score / c.max : null };
  });
}

export type Accuracy = { score: number; max: number; questions: number; accuracy: number | null };

/** Accuracy from each question's latest attempt, grouped by `key`. */
export function accuracyBy(attempts: Attempt[], key: 'skill' | 'type'): Map<string, Accuracy> {
  const out = new Map<string, Accuracy>();
  for (const a of latestAttempts(attempts).values()) {
    const k = a[key];
    const c = out.get(k) ?? { score: 0, max: 0, questions: 0, accuracy: null };
    const next = { score: c.score + a.score, max: c.max + a.max, questions: c.questions + 1 };
    out.set(k, { ...next, accuracy: next.max ? next.score / next.max : null });
  }
  return out;
}

/** Minimum answered questions before an overall estimate is shown. */
export const ESTIMATE_MIN = 20;

/**
 * A rough overall practice estimate on the 10-90 scale: the average accuracy of the skills
 * practised, mapped linearly onto 10-90. It is a progress signal, not a prediction.
 */
export function overallEstimate(bySkill: Map<string, Accuracy>): number | null {
  const accs = [...bySkill.values()].map((s) => s.accuracy).filter((a): a is number => a !== null);
  const questions = [...bySkill.values()].reduce((n, s) => n + s.questions, 0);
  if (!accs.length || questions < ESTIMATE_MIN) return null;
  const mean = accs.reduce((a, b) => a + b, 0) / accs.length;
  return Math.round(10 + 80 * mean);
}

/** Questions whose latest attempt lost marks, newest first. */
export function mistakeQueue(attempts: Attempt[]): Attempt[] {
  return [...latestAttempts(attempts).values()]
    .filter((a) => {
      const s = statusOf(a);
      return s === 'wrong' || s === 'partial';
    })
    .sort((a, b) => b.at - a.at);
}

/**
 * Types to practise next: the weakest practised types first (lowest accuracy), then types not
 * tried yet, in the order given.
 */
export function suggestTypes(
  attempts: Attempt[],
  candidates: string[],
  count = 3,
): { type: string; reason: 'weak' | 'new' }[] {
  const byType = accuracyBy(attempts, 'type');
  const weak = candidates
    .filter((t) => byType.get(t)?.accuracy != null && byType.get(t)!.accuracy! < 0.8)
    .sort((a, b) => byType.get(a)!.accuracy! - byType.get(b)!.accuracy!)
    .map((type) => ({ type, reason: 'weak' as const }));
  const fresh = candidates
    .filter((t) => !byType.has(t))
    .map((type) => ({ type, reason: 'new' as const }));
  return [...weak, ...fresh].slice(0, count);
}
