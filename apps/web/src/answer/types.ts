import type { ComponentType } from 'react';
import type { QuestionOf, QuestionType } from '@openpte/schema';
import type { ScoreResult } from '@openpte/scoring';

export type AnswerViewProps<Q, R> = {
  question: Q;
  response: R;
  onChange: (r: R) => void;
  /** After submitting: the view shows the response marked, read-only. */
  review: boolean;
};

/** Everything the exam frame needs to run one question type. */
export type Answerable<K extends QuestionType, R> = {
  initial: (q: QuestionOf<K>) => R;
  score: (q: QuestionOf<K>, r: R) => ScoreResult;
  View: ComponentType<AnswerViewProps<QuestionOf<K>, R>>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAnswerable = Answerable<any, any>;
