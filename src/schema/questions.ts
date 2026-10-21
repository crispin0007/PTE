import { z } from 'zod';
import { blankMarkers, transcriptTokens, wordCount } from './text.ts';
import { baseShape, checkBase, nonEmpty, type BaseFields } from './base.ts';

export { blankMarkers, transcriptTokens, wordCount };

const assetPath = (folder: 'audio' | 'images') =>
  z.string().regex(new RegExp(`^${folder}/[a-z0-9-]+\\.[a-z0-9]+$`), `must be a path like ${folder}/<id>.<ext>`);
const audio = assetPath('audio');
const image = assetPath('images');
const options = z.array(nonEmpty).min(2);
const keyPoints = z.array(nonEmpty).min(1);
const blankId = z.string().regex(/^b\d+$/);

type Ctx = z.RefinementCtx;

function issue(ctx: Ctx, path: (string | number)[], message: string) {
  ctx.addIssue({ code: 'custom', path, message });
}

function checkIndex(ctx: Ctx, path: (string | number)[], index: number, opts: unknown[]) {
  if (index < 0 || index >= opts.length) issue(ctx, path, `index ${index} is out of range (0-${opts.length - 1})`);
}

function checkUnique(ctx: Ctx, path: (string | number)[], values: unknown[], what: string) {
  if (new Set(values).size !== values.length) issue(ctx, path, `${what} must not contain duplicates`);
}

function checkMarkers(ctx: Ctx, field: string, text: string, blanks: { id: string }[]) {
  const markers = blankMarkers(text);
  const ids = blanks.map((b) => b.id);
  if (markers.join() !== ids.join()) {
    issue(ctx, [field], `blank markers [${markers}] do not match blanks [${ids}] (same ids, same order)`);
  }
}

function checkMultiple(q: { options: string[]; answers: number[] }, ctx: Ctx) {
  checkUnique(ctx, ['options'], q.options, 'options');
  checkUnique(ctx, ['answers'], q.answers, 'answers');
  q.answers.forEach((a, i) => checkIndex(ctx, ['answers', i], a, q.options));
  if (q.answers.length >= q.options.length) issue(ctx, ['answers'], 'at least one option must be wrong');
}

function checkSingle(q: { options: string[]; answer: number }, ctx: Ctx) {
  checkUnique(ctx, ['options'], q.options, 'options');
  checkIndex(ctx, ['answer'], q.answer, q.options);
}

/**
 * Builds one question schema: base fields + the type's own fields, strict (unknown keys are errors,
 * which catches typos), plus base and type-specific cross-field checks.
 */
function question<T extends string, S extends z.ZodRawShape>(
  type: T,
  shape: S,
  check?: (q: z.infer<z.ZodObject<S>>, ctx: Ctx) => void,
) {
  return z.strictObject({ ...baseShape, type: z.literal(type), ...shape }).superRefine(
    (q, ctx) => {
      checkBase(q as unknown as BaseFields, ctx);
      check?.(q as z.infer<z.ZodObject<S>>, ctx);
    },
    // Cross-field checks only make sense once every field has the right shape.
    { when: (payload) => payload.issues.length === 0 },
  );
}

const index = z.number().int().min(0);

// ---- Speaking & Writing section ----

export const ReadAloud = question('speaking_read_aloud', { text: nonEmpty });

export const RepeatSentence = question('speaking_repeat_sentence', { audio, transcript: nonEmpty });

export const DescribeImage = question('speaking_describe_image', {
  image,
  alt_text: nonEmpty,
  key_points: keyPoints,
  sample_answer: nonEmpty,
});

export const RetellLecture = question('speaking_retell_lecture', {
  audio,
  transcript: nonEmpty,
  key_points: keyPoints,
  image: image.optional(),
  sample_answer: nonEmpty,
});

export const AnswerShortQuestion = question('speaking_answer_short_question', {
  audio,
  transcript: nonEmpty,
  accepted_answers: z.array(nonEmpty).min(1),
});

export const SummarizeGroupDiscussion = question(
  'speaking_summarize_group_discussion',
  {
    audio,
    transcript: nonEmpty,
    speakers: z.array(nonEmpty).length(3, 'a group discussion has exactly 3 speakers'),
    key_points: keyPoints,
    sample_answer: nonEmpty,
  },
  (q, ctx) => {
    checkUnique(ctx, ['speakers'], q.speakers, 'speakers');
    // Transcript lines are "Name: text"; every line must name one of the speakers.
    q.transcript
      .split('\n')
      .filter((line) => line.trim())
      .forEach((line, i) => {
        const name = line.split(':')[0]?.trim();
        if (!name || !q.speakers.includes(name)) {
          issue(ctx, ['transcript'], `line ${i + 1} does not start with a listed speaker ("Name: text")`);
        }
      });
  },
);

export const RespondToSituation = question(
  'speaking_respond_to_situation',
  { situation_text: nonEmpty, audio, key_points: keyPoints, sample_answer: nonEmpty },
  (q, ctx) => {
    if (wordCount(q.situation_text) > 60) issue(ctx, ['situation_text'], 'situation_text must be at most 60 words');
  },
);

export const SummarizeWrittenText = question('writing_summarize_written_text', {
  passage: nonEmpty,
  sample_answer: nonEmpty,
});

export const WriteEssay = question('writing_essay', { prompt: nonEmpty, sample_answer: nonEmpty });

// ---- Reading section ----

export const ReadingFibDropdown = question(
  'reading_fib_dropdown',
  {
    passage: nonEmpty,
    blanks: z.array(z.strictObject({ id: blankId, options, answer: index })).min(1),
  },
  (q, ctx) => {
    checkMarkers(ctx, 'passage', q.passage, q.blanks);
    q.blanks.forEach((b, i) => {
      checkUnique(ctx, ['blanks', i, 'options'], b.options, `options of ${b.id}`);
      checkIndex(ctx, ['blanks', i, 'answer'], b.answer, b.options);
    });
  },
);

export const ReadingMcqMultiple = question(
  'reading_mcq_multiple',
  { passage: nonEmpty, question: nonEmpty, options, answers: z.array(index).min(1) },
  checkMultiple,
);

export const ReorderParagraphs = question(
  'reading_reorder_paragraphs',
  { paragraphs: z.array(nonEmpty).min(3, 're-order needs at least 3 paragraphs') },
  (q, ctx) => checkUnique(ctx, ['paragraphs'], q.paragraphs, 'paragraphs'),
);

export const ReadingFibDragDrop = question(
  'reading_fib_drag_drop',
  {
    passage: nonEmpty,
    blanks: z.array(z.strictObject({ id: blankId, answer: nonEmpty })).min(1),
    distractors: z.array(nonEmpty).min(1),
  },
  (q, ctx) => {
    checkMarkers(ctx, 'passage', q.passage, q.blanks);
    checkUnique(ctx, ['distractors'], [...q.blanks.map((b) => b.answer), ...q.distractors], 'the word bank');
  },
);

export const ReadingMcqSingle = question(
  'reading_mcq_single',
  { passage: nonEmpty, question: nonEmpty, options, answer: index },
  checkSingle,
);

// ---- Listening section ----

export const SummarizeSpokenText = question('listening_summarize_spoken_text', {
  audio,
  transcript: nonEmpty,
  sample_answer: nonEmpty,
});

export const ListeningMcqMultiple = question(
  'listening_mcq_multiple',
  { audio, transcript: nonEmpty, question: nonEmpty, options, answers: z.array(index).min(1) },
  checkMultiple,
);

export const ListeningFib = question(
  'listening_fib',
  {
    audio,
    transcript: nonEmpty,
    blanks: z.array(z.strictObject({ id: blankId, answer: nonEmpty })).min(1),
  },
  (q, ctx) => checkMarkers(ctx, 'transcript', q.transcript, q.blanks),
);

export const HighlightCorrectSummary = question(
  'listening_highlight_correct_summary',
  { audio, transcript: nonEmpty, options, answer: index },
  checkSingle,
);

export const ListeningMcqSingle = question(
  'listening_mcq_single',
  { audio, transcript: nonEmpty, question: nonEmpty, options, answer: index },
  checkSingle,
);

export const SelectMissingWord = question(
  'listening_select_missing_word',
  { audio, transcript: nonEmpty, options, answer: index },
  checkSingle,
);

export const HighlightIncorrectWords = question(
  'listening_highlight_incorrect_words',
  {
    audio,
    transcript: nonEmpty,
    swaps: z.array(z.strictObject({ index, shown: nonEmpty })).min(1),
  },
  (q, ctx) => {
    const tokens = transcriptTokens(q.transcript);
    checkUnique(
      ctx,
      ['swaps'],
      q.swaps.map((s) => s.index),
      'swap indexes',
    );
    q.swaps.forEach((s, i) => {
      if (s.index >= tokens.length) issue(ctx, ['swaps', i, 'index'], `index ${s.index} is past the last word`);
      else if (tokens[s.index] === s.shown) issue(ctx, ['swaps', i, 'shown'], 'shown word is the same as the spoken word');
    });
  },
);

export const WriteFromDictation = question('listening_write_from_dictation', { audio, sentence: nonEmpty });

export const QUESTION_SCHEMAS = {
  speaking_read_aloud: ReadAloud,
  speaking_repeat_sentence: RepeatSentence,
  speaking_describe_image: DescribeImage,
  speaking_retell_lecture: RetellLecture,
  speaking_answer_short_question: AnswerShortQuestion,
  speaking_summarize_group_discussion: SummarizeGroupDiscussion,
  speaking_respond_to_situation: RespondToSituation,
  writing_summarize_written_text: SummarizeWrittenText,
  writing_essay: WriteEssay,
  reading_fib_dropdown: ReadingFibDropdown,
  reading_mcq_multiple: ReadingMcqMultiple,
  reading_reorder_paragraphs: ReorderParagraphs,
  reading_fib_drag_drop: ReadingFibDragDrop,
  reading_mcq_single: ReadingMcqSingle,
  listening_summarize_spoken_text: SummarizeSpokenText,
  listening_mcq_multiple: ListeningMcqMultiple,
  listening_fib: ListeningFib,
  listening_highlight_correct_summary: HighlightCorrectSummary,
  listening_mcq_single: ListeningMcqSingle,
  listening_select_missing_word: SelectMissingWord,
  listening_highlight_incorrect_words: HighlightIncorrectWords,
  listening_write_from_dictation: WriteFromDictation,
} as const;

export type QuestionType = keyof typeof QUESTION_SCHEMAS;
export const QUESTION_TYPES = Object.keys(QUESTION_SCHEMAS) as QuestionType[];

export type Question = {
  [K in QuestionType]: z.infer<(typeof QUESTION_SCHEMAS)[K]>;
}[QuestionType];
export type QuestionOf<K extends QuestionType> = z.infer<(typeof QUESTION_SCHEMAS)[K]>;

export function isQuestionType(t: unknown): t is QuestionType {
  return typeof t === 'string' && t in QUESTION_SCHEMAS;
}
