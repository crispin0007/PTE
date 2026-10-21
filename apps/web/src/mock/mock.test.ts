import { describe, expect, it } from 'vitest';
import { MOCKS, buildPaper } from './definitions.ts';
import { SKILL_CONTRIBUTIONS, buildReport } from './report.ts';
import { QUESTION_TYPES } from '@openpte/schema';

const pool = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t, Array.from({ length: 10 }, (_, i) => `${t}-${i}`)]),
);

describe('mock tests', () => {
  it('every type counts for at least one skill', () => {
    for (const t of QUESTION_TYPES) expect(SKILL_CONTRIBUTIONS[t].length).toBeGreaterThan(0);
  });

  it('builds a full paper in test order, unanswered questions first, reproducibly', () => {
    const full = MOCKS.find((m) => m.id === 'full')!;
    const answered = new Set([
      'reading_mcq_single-0',
      'reading_mcq_single-1',
      'reading_mcq_single-2',
    ]);
    const a = buildPaper(full, pool, answered, 'paper-1', 0);
    expect(a.sections.map((s) => s.id)).toEqual(['speaking_writing', 'reading', 'listening']);
    expect(a.sections[0]!.items[0]!.type).toBe('speaking_read_aloud');
    const mcqs = a.sections[1]!.items.filter((i) => i.type === 'reading_mcq_single');
    expect(mcqs).toHaveLength(2);
    expect(mcqs.some((i) => answered.has(i.questionId))).toBe(false);
    expect(buildPaper(full, pool, answered, 'paper-1', 0)).toEqual(a);
    const total = a.sections.reduce((n, s) => n + s.items.length, 0);
    expect(total).toBeGreaterThan(60);
  });

  it('reports skills on the 10-90 scale with shared items counting twice', () => {
    const paper = buildPaper(
      MOCKS.find((m) => m.id === 'reading')!,
      pool,
      new Set(),
      'p',
      0,
    );
    const report = buildReport(
      paper,
      [
        { type: 'reading_fib_dropdown', questionId: 'a', score: 4, max: 4 },
        { type: 'reading_mcq_single', questionId: 'b', score: 0, max: 1 },
        { type: 'speaking_read_aloud', questionId: 'c', score: 0, max: 0 },
      ],
      1,
    );
    // Reading: 4 of 5 marks -> 10 + 80 * 0.8 = 74. Writing: 4 of 4 from the dropdown blanks -> 90.
    expect(report.skills.find((s) => s.skill === 'reading')!.score).toBe(74);
    expect(report.skills.find((s) => s.skill === 'writing')!.score).toBe(90);
    expect(report.skills.find((s) => s.skill === 'speaking')!.score).toBeNull();
    expect(report.overall).toBe(82);
    expect(report.unscored).toBe(1);
    expect(report.weakest).toEqual(['reading_mcq_single']);
  });
});
