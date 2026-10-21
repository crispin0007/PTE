import type { QuestionType } from '@openpte/schema';
import { seededShuffle } from '../answer/parts.tsx';

export type SectionDef = {
  id: 'speaking_writing' | 'reading' | 'listening';
  label: string;
  items: { type: QuestionType; count: number }[];
  /**
   * Shared time for the section's untimed items, in seconds. Items with their own time (Speaking,
   * Writing, Summarize Spoken Text) run on their own clock and do not use it.
   */
  sharedTimeS: number;
};

export type MockDef = { id: string; label: string; description: string; sections: SectionDef[] };

const SW: SectionDef = {
  id: 'speaking_writing',
  label: 'Speaking and Writing',
  sharedTimeS: 0,
  items: [
    { type: 'speaking_read_aloud', count: 6 },
    { type: 'speaking_repeat_sentence', count: 10 },
    { type: 'speaking_describe_image', count: 5 },
    { type: 'speaking_retell_lecture', count: 2 },
    { type: 'speaking_answer_short_question', count: 5 },
    { type: 'speaking_summarize_group_discussion', count: 2 },
    { type: 'speaking_respond_to_situation', count: 2 },
    { type: 'writing_summarize_written_text', count: 2 },
    { type: 'writing_essay', count: 1 },
  ],
};

const READING: SectionDef = {
  id: 'reading',
  label: 'Reading',
  sharedTimeS: 30 * 60,
  items: [
    { type: 'reading_fib_dropdown', count: 5 },
    { type: 'reading_mcq_multiple', count: 2 },
    { type: 'reading_reorder_paragraphs', count: 2 },
    { type: 'reading_fib_drag_drop', count: 4 },
    { type: 'reading_mcq_single', count: 2 },
  ],
};

const LISTENING: SectionDef = {
  id: 'listening',
  label: 'Listening',
  sharedTimeS: 25 * 60,
  items: [
    { type: 'listening_summarize_spoken_text', count: 1 },
    { type: 'listening_mcq_multiple', count: 2 },
    { type: 'listening_fib', count: 2 },
    { type: 'listening_highlight_correct_summary', count: 2 },
    { type: 'listening_mcq_single', count: 2 },
    { type: 'listening_select_missing_word', count: 2 },
    { type: 'listening_highlight_incorrect_words', count: 2 },
    { type: 'listening_write_from_dictation', count: 3 },
  ],
};

/** Roughly a third of each section, for a 40-minute run-through. */
const mini = (s: SectionDef): SectionDef => ({
  ...s,
  sharedTimeS: Math.round(s.sharedTimeS / 3),
  items: s.items.map((i) => ({ ...i, count: Math.max(1, Math.round(i.count / 3)) })),
});

/**
 * Mock tests follow the published structure of PTE Academic: the order of sections and question
 * types, and about the number of each. Question counts vary a little in the real test.
 */
export const MOCKS: MockDef[] = [
  {
    id: 'full',
    label: 'Full mock test',
    description: 'All three parts in test order, about 2 hours.',
    sections: [SW, READING, LISTENING],
  },
  {
    id: 'mini',
    label: 'Mini mock test',
    description: 'Every question type once or twice, about 40 minutes.',
    sections: [mini(SW), mini(READING), mini(LISTENING)],
  },
  {
    id: 'speaking_writing',
    label: 'Speaking and Writing',
    description: 'Part 1 on its own, about 75 minutes.',
    sections: [SW],
  },
  {
    id: 'reading',
    label: 'Reading',
    description: 'Part 2 on its own, 30 minutes.',
    sections: [READING],
  },
  {
    id: 'listening',
    label: 'Listening',
    description: 'Part 3 on its own, about 35 minutes.',
    sections: [LISTENING],
  },
];

export type PaperItem = { type: QuestionType; questionId: string };
export type Paper = {
  id: string;
  mockId: string;
  label: string;
  createdAt: number;
  sections: { id: SectionDef['id']; label: string; sharedTimeS: number; items: PaperItem[] }[];
};

/**
 * Picks the questions for one sitting. Questions the learner has not answered come first, then the
 * rest; the order is shuffled by the paper id so a sitting can be rebuilt exactly.
 */
export function buildPaper(
  def: MockDef,
  pool: Partial<Record<QuestionType, string[]>>,
  answered: Set<string>,
  id: string,
  now: number,
): Paper {
  return {
    id,
    mockId: def.id,
    label: def.label,
    createdAt: now,
    sections: def.sections.map((s) => ({
      id: s.id,
      label: s.label,
      sharedTimeS: s.sharedTimeS,
      items: s.items.flatMap(({ type, count }) => {
        const ids = seededShuffle(pool[type] ?? [], `${id}:${type}`);
        const ordered = [
          ...ids.filter((q) => !answered.has(q)),
          ...ids.filter((q) => answered.has(q)),
        ];
        return ordered.slice(0, count).map((questionId) => ({ type, questionId }));
      }),
    })),
  };
}

export const paperTypes = (def: MockDef) => [
  ...new Set(def.sections.flatMap((s) => s.items.map((i) => i.type))),
];
