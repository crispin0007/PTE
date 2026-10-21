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
import type { AnyAnswerable } from './types.ts';

/** Question types that can be answered and scored. Others show a read-only preview for now. */
export const ANSWERABLE: Partial<Record<QuestionType, AnyAnswerable>> = {
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
