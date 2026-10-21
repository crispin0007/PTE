import { describe, expect, it } from 'vitest';
import { MOCKS, buildPaper, customMock } from './definitions.ts';
import { SKILL_CONTRIBUTIONS, buildReport } from './report.ts';
import { QUESTION_TYPES } from '@openpte/schema';
import { advance, restOfSection } from './flow.ts';
import { paperItems, type Sitting } from './store.ts';

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

describe('mock sitting flow', () => {
  const paper = buildPaper(
    MOCKS.find((m) => m.id === 'mini')!,
    pool,
    new Set(),
    'p',
    0,
  );
  const items = paperItems(paper);
  const sitting: Sitting = { paper, position: 0, sectionUsedS: 0, itemStartedAt: 1, results: [] };
  const result = (i: number) => ({ ...items[i]!, score: 1, max: 1 });
  const firstReading = items.findIndex((i) => i.section === 1);

  it('moves to the next item and keeps the shared clock within a section', () => {
    const next = advance({ ...sitting, sectionUsedS: 5 }, [result(0)], 7, 100);
    expect(next).toMatchObject({ position: 1, sectionUsedS: 12, itemStartedAt: 100 });
  });

  it('shows the intro and resets the clock when a new section starts', () => {
    const last = { ...sitting, position: firstReading - 1, sectionUsedS: 9 };
    const next = advance(last, [result(firstReading - 1)], 0, 100);
    expect(next).toMatchObject({ position: firstReading, sectionUsedS: 0, itemStartedAt: null });
  });

  it('lists the rest of the section for skipping when time runs out', () => {
    const rest = restOfSection({ ...sitting, position: firstReading });
    expect(rest[0]).toBe(firstReading + 1);
    expect(rest.every((i) => items[i]!.section === 1)).toBe(true);
    expect(items[rest.at(-1)! + 1]?.section).toBe(2);
  });
});

describe('custom mocks', () => {
  it('keeps test order, drops empty sections and scales shared time', () => {
    const def = customMock({
      listening_write_from_dictation: 2,
      listening_summarize_spoken_text: 1,
      reading_mcq_single: 3,
      speaking_read_aloud: 0,
    });
    expect(def.sections.map((s) => s.id)).toEqual(['reading', 'listening']);
    expect(def.sections[0]).toMatchObject({ sharedTimeS: 360 });
    // Summarize Spoken Text has its own clock, so only the two dictations add time.
    expect(def.sections[1]).toMatchObject({ sharedTimeS: 200 });
    expect(def.sections[1]!.items.map((i) => i.type)).toEqual([
      'listening_summarize_spoken_text',
      'listening_write_from_dictation',
    ]);
  });
});
