import type { QuestionType } from '@openpte/schema';
import { fibDragDrop, fibDropdown, mcqMultiple, mcqSingle, reorder } from './reading.tsx';
import {
  correctSummary,
  dictation,
  fib,
  highlightIncorrect,
  mcqMultiple as listeningMcqMultiple,
  mcqSingle as listeningMcqSingle,
  missingWord,
} from './listening.tsx';
import { essay, summarizeSpoken, summarizeWritten } from './writing.tsx';
import {
  describeImage,
  groupDiscussion,
  readAloud,
  repeatSentence,
  respondToSituation,
  retellLecture,
  shortQuestion,
} from './speaking.tsx';
import type { AnyAnswerable } from './types.ts';

/** How each question type is answered and scored. Types missing here show a read-only preview. */
export const ANSWERABLE: Partial<Record<QuestionType, AnyAnswerable>> = {
  speaking_read_aloud: readAloud,
  speaking_repeat_sentence: repeatSentence,
  speaking_describe_image: describeImage,
  speaking_retell_lecture: retellLecture,
  speaking_answer_short_question: shortQuestion,
  speaking_summarize_group_discussion: groupDiscussion,
  speaking_respond_to_situation: respondToSituation,
  writing_summarize_written_text: summarizeWritten,
  writing_essay: essay,
  listening_summarize_spoken_text: summarizeSpoken,
  reading_mcq_single: mcqSingle,
  reading_mcq_multiple: mcqMultiple,
  reading_fib_dropdown: fibDropdown,
  reading_fib_drag_drop: fibDragDrop,
  reading_reorder_paragraphs: reorder,
  listening_mcq_single: listeningMcqSingle,
  listening_mcq_multiple: listeningMcqMultiple,
  listening_highlight_correct_summary: correctSummary,
  listening_select_missing_word: missingWord,
  listening_fib: fib,
  listening_highlight_incorrect_words: highlightIncorrect,
  listening_write_from_dictation: dictation,
};

/** Types that give a score, so they count towards progress and suggestions. */
export const isScored = (type: QuestionType) => !!ANSWERABLE[type] && !ANSWERABLE[type].unscored;
