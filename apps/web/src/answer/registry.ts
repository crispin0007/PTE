import type { QuestionType } from '@openpte/schema';
import { fibDragDrop, fibDropdown, mcqMultiple, mcqSingle, reorder } from './reading.tsx';
import type { AnyAnswerable } from './types.ts';

/** Question types that can be answered and scored. Others show a read-only preview for now. */
export const ANSWERABLE: Partial<Record<QuestionType, AnyAnswerable>> = {
  reading_mcq_single: mcqSingle,
  reading_mcq_multiple: mcqMultiple,
  reading_fib_dropdown: fibDropdown,
  reading_fib_drag_drop: fibDragDrop,
  reading_reorder_paragraphs: reorder,
};
