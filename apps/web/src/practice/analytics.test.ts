import { describe, expect, it } from 'vitest';
import {
  accuracyBy,
  answeredOn,
  dailyCounts,
  mistakeQueue,
  overallEstimate,
  suggestTypes,
} from './analytics.ts';
import type { Attempt } from './history.ts';

const NOW = new Date(2026, 9, 21, 12).getTime();
const DAY = 86_400_000;
const at = (
  questionId: string,
  type: string,
  skill: string,
  score: number,
  max: number,
  daysAgo = 0,
): Attempt => ({ questionId, type, skill, score, max, at: NOW - daysAgo * DAY });

const attempts = [
  at('r1', 'reading_mcq_single', 'reading', 1, 1),
  at('r2', 'reading_mcq_single', 'reading', 0, 1, 1),
  at('l1', 'listening_fib', 'listening', 2, 4, 2),
  // r2 retried today with full marks; only the latest attempt counts for accuracy.
  at('r2', 'reading_mcq_single', 'reading', 1, 1),
];

describe('analytics', () => {
  it('counts today and the last 30 days', () => {
    expect(answeredOn(attempts, NOW)).toBe(2);
    const days = dailyCounts(attempts, NOW);
    expect(days).toHaveLength(30);
    expect(days.at(-1)).toMatchObject({ n: 2, accuracy: 1 });
    expect(days.at(-2)).toMatchObject({ n: 1, accuracy: 0 });
    expect(days.at(-4)).toMatchObject({ n: 0, accuracy: null });
  });

  it('uses the latest attempt for accuracy', () => {
    const bySkill = accuracyBy(attempts, 'skill');
    expect(bySkill.get('reading')).toMatchObject({ score: 2, max: 2, accuracy: 1 });
    expect(bySkill.get('listening')?.accuracy).toBe(0.5);
  });

  it('only estimates after enough questions', () => {
    expect(overallEstimate(accuracyBy(attempts, 'skill'))).toBeNull();
    const many = Array.from({ length: 20 }, (_, i) => at(`q${i}`, 't', 'reading', i % 2, 1));
    // Accuracy 0.5 -> 10 + 40 = 50.
    expect(overallEstimate(accuracyBy(many, 'skill'))).toBe(50);
  });

  it('queues mistakes and suggests weak then new types', () => {
    expect(mistakeQueue(attempts).map((a) => a.questionId)).toEqual(['l1']);
    expect(
      suggestTypes(attempts, ['reading_mcq_single', 'listening_fib', 'writing_essay']),
    ).toEqual([
      { type: 'listening_fib', reason: 'weak' },
      { type: 'writing_essay', reason: 'new' },
    ]);
  });
});
