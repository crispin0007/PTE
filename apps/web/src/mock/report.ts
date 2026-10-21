import type { QuestionType, Skill } from '@openpte/schema';
import type { Paper } from './definitions.ts';

/**
 * Which communicative skills each question type counts towards. PTE scores many types for two
 * skills at once (for example Write from Dictation counts for Listening and Writing); this map
 * follows Pearson's published score guide.
 */
export const SKILL_CONTRIBUTIONS: Record<QuestionType, Skill[]> = {
  speaking_read_aloud: ['speaking', 'reading'],
  speaking_repeat_sentence: ['speaking', 'listening'],
  speaking_describe_image: ['speaking'],
  speaking_retell_lecture: ['speaking', 'listening'],
  speaking_answer_short_question: ['speaking', 'listening'],
  speaking_summarize_group_discussion: ['speaking', 'listening'],
  speaking_respond_to_situation: ['speaking', 'listening'],
  writing_summarize_written_text: ['writing', 'reading'],
  writing_essay: ['writing'],
  reading_fib_dropdown: ['reading', 'writing'],
  reading_mcq_multiple: ['reading'],
  reading_reorder_paragraphs: ['reading'],
  reading_fib_drag_drop: ['reading'],
  reading_mcq_single: ['reading'],
  listening_summarize_spoken_text: ['listening', 'writing'],
  listening_mcq_multiple: ['listening'],
  listening_fib: ['listening', 'writing'],
  listening_highlight_correct_summary: ['listening', 'reading'],
  listening_mcq_single: ['listening'],
  listening_select_missing_word: ['listening'],
  listening_highlight_incorrect_words: ['listening', 'reading'],
  listening_write_from_dictation: ['listening', 'writing'],
};

/** One answered (or skipped) item. `max` 0 means it could not be scored (Speaking without the server). */
export type ItemResult = {
  type: QuestionType;
  questionId: string;
  score: number;
  max: number;
  /** True when time ran out before it was answered. */
  skipped?: boolean;
};

export type Report = {
  paperId: string;
  label: string;
  finishedAt: number;
  overall: number | null;
  skills: { skill: Skill; score: number | null; items: number }[];
  types: { type: QuestionType; score: number; max: number; items: number }[];
  weakest: QuestionType[];
  unscored: number;
  results: ItemResult[];
};

const toScale = (share: number) => Math.round(10 + 80 * share);

/**
 * The practice report: each skill's share of marks on the items that count towards it, placed on
 * the 10-90 scale, and the overall as the average of the skills that could be scored.
 */
export function buildReport(paper: Paper, results: ItemResult[], now: number): Report {
  const scored = results.filter((r) => r.max > 0);
  const skills = (['listening', 'reading', 'speaking', 'writing'] as Skill[]).map((skill) => {
    const rs = scored.filter((r) => SKILL_CONTRIBUTIONS[r.type].includes(skill));
    const max = rs.reduce((n, r) => n + r.max, 0);
    const score = rs.reduce((n, r) => n + r.score, 0);
    return { skill, score: max ? toScale(score / max) : null, items: rs.length };
  });
  const byType = new Map<QuestionType, { score: number; max: number; items: number }>();
  for (const r of scored) {
    const t = byType.get(r.type) ?? { score: 0, max: 0, items: 0 };
    byType.set(r.type, { score: t.score + r.score, max: t.max + r.max, items: t.items + 1 });
  }
  const types = [...byType.entries()].map(([type, t]) => ({ type, ...t }));
  const weakest = [...types]
    .filter((t) => t.score / t.max < 0.65)
    .sort((a, b) => a.score / a.max - b.score / b.max)
    .slice(0, 3)
    .map((t) => t.type);
  const present = skills.filter((s) => s.score !== null).map((s) => s.score!);
  return {
    paperId: paper.id,
    label: paper.label,
    finishedAt: now,
    overall: present.length
      ? Math.round(present.reduce((a, b) => a + b, 0) / present.length)
      : null,
    skills,
    types,
    weakest,
    unscored: results.length - scored.length,
    results,
  };
}
