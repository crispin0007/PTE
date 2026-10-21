import { describe, expect, it } from 'vitest';
import { latestAttempts, statusOf, type Attempt } from './history.ts';

const a = (questionId: string, score: number, max: number, at: number): Attempt => ({
  questionId,
  type: 'reading_mcq_single',
  skill: 'reading',
  score,
  max,
  at,
});

describe('practice history', () => {
  it('keeps the latest attempt per question', () => {
    const latest = latestAttempts([a('q1', 0, 1, 1), a('q1', 1, 1, 2), a('q2', 1, 3, 1)]);
    expect(latest.get('q1')?.score).toBe(1);
    expect(latest.size).toBe(2);
  });

  it('classifies scores', () => {
    expect(statusOf(undefined)).toBe('new');
    expect(statusOf(a('q', 3, 3, 0))).toBe('right');
    expect(statusOf(a('q', 1, 3, 0))).toBe('partial');
    expect(statusOf(a('q', 0, 3, 0))).toBe('wrong');
  });
});
