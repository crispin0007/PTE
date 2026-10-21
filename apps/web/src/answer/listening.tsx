import { useId } from 'react';
import {
  scoreBlanks,
  scoreDictation,
  scoreHighlightIncorrect,
  scoreMcqMultiple,
  scoreMcqSingle,
} from '@openpte/scoring';
import { transcriptTokens } from '@openpte/schema/text';
import { Listen } from './Listen.tsx';
import { BlankText, Choices, markClass, Section, type ReviewMark } from './parts.tsx';
import type { Answerable } from './types.ts';

type SingleType =
  'listening_mcq_single' | 'listening_highlight_correct_summary' | 'listening_select_missing_word';

function single<K extends SingleType>(prompt: (q: { question?: string }) => string, beep = false) {
  const a: Answerable<K, number | null> = {
    initial: () => null,
    score: (q, r) => scoreMcqSingle(q.answer, r),
    View: ({ question: q, response, onChange, review }) => (
      <>
        <Listen path={q.audio} script={q.transcript} review={review} beepAtEnd={beep} />
        <p className="font-semibold">{prompt(q as { question?: string })}</p>
        <Choices
          name={q.id}
          options={q.options}
          multiple={false}
          chosen={response === null ? [] : [response]}
          onChange={(c) => onChange(c[0] ?? null)}
          review={review}
          answers={[q.answer]}
        />
      </>
    ),
  };
  return a;
}

export const mcqSingle = single<'listening_mcq_single'>((q) => q.question ?? '');
export const correctSummary = single<'listening_highlight_correct_summary'>(
  () => 'Which summary best matches the recording?',
);
export const missingWord = single<'listening_select_missing_word'>(
  () => 'Which option best completes the recording?',
  true,
);

export const mcqMultiple: Answerable<'listening_mcq_multiple', number[]> = {
  initial: () => [],
  score: (q, r) => scoreMcqMultiple(q.answers, r),
  View: ({ question: q, response, onChange, review }) => (
    <>
      <Listen path={q.audio} script={q.transcript} review={review} />
      <p className="font-semibold">{q.question}</p>
      <Choices
        name={q.id}
        options={q.options}
        multiple
        chosen={response}
        onChange={onChange}
        review={review}
        answers={q.answers}
      />
    </>
  ),
};

/** The transcript as spoken: blanks filled with their answers. */
const spokenFib = (transcript: string, answers: string[]) => {
  let i = 0;
  return transcript.replace(/\{\{b\d+\}\}/g, () => answers[i++] ?? '');
};

export const fib: Answerable<'listening_fib', (string | null)[]> = {
  initial: (q) => q.blanks.map(() => null),
  score: (q, r) =>
    scoreBlanks(
      q.blanks.map((b) => b.answer),
      r,
      'fib_per_blank_spelling',
    ),
  View: ({ question: q, response, onChange, review }) => {
    const answers = q.blanks.map((b) => b.answer);
    const marks = review ? scoreBlanks(answers, response, 'fib_per_blank_spelling').marks : null;
    return (
      <>
        <Listen path={q.audio} script={spokenFib(q.transcript, answers)} review={review} />
        <Section title="Type the missing words">
          <BlankText
            text={q.transcript}
            renderBlank={(i) => {
              const mark = marks?.[i] ?? null;
              return (
                <span className="inline-flex flex-wrap items-baseline gap-1">
                  <input
                    type="text"
                    aria-label={`Blank ${i + 1}`}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={response[i] ?? ''}
                    readOnly={review}
                    onChange={(e) => {
                      const next = [...response];
                      next[i] = e.target.value;
                      onChange(next);
                    }}
                    className={`mx-1 min-h-10 w-32 rounded-token border bg-surface px-2 ${
                      mark ? markClass[mark === 'missed' ? 'wrong' : mark] : 'border-muted'
                    }`}
                  />
                  {mark && mark !== 'right' && (
                    <span className="text-sm font-semibold text-good">✓ {answers[i]}</span>
                  )}
                </span>
              );
            }}
          />
        </Section>
      </>
    );
  },
};

export const highlightIncorrect: Answerable<'listening_highlight_incorrect_words', number[]> = {
  initial: () => [],
  score: (q, r) =>
    scoreHighlightIncorrect(
      q.swaps.map((s) => s.index),
      r,
    ),
  View: ({ question: q, response, onChange, review }) => {
    const spoken = transcriptTokens(q.transcript);
    const swapAt = new Map(q.swaps.map((s) => [s.index, s.shown]));
    const shown = spoken.map((w, i) => swapAt.get(i) ?? w);
    const picked = new Set(response);
    return (
      <>
        <Listen path={q.audio} script={q.transcript} review={review} />
        <Section title="Click the words that differ from the recording">
          <p className="rounded-token border border-line bg-surface p-4 leading-[2.2]">
            {shown.map((w, i) => {
              const on = picked.has(i);
              const isSwap = swapAt.has(i);
              const mark: ReviewMark = !review
                ? null
                : on
                  ? isSwap
                    ? 'right'
                    : 'wrong'
                  : isSwap
                    ? 'missed'
                    : null;
              return (
                <span key={i}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={review}
                    onClick={() =>
                      onChange(on ? response.filter((r) => r !== i) : [...response, i])
                    }
                    className={`rounded px-0.5 ${
                      mark
                        ? `border ${markClass[mark]}`
                        : on
                          ? 'bg-brand text-brand-ink'
                          : 'hover:bg-sunken'
                    }`}
                  >
                    {w}
                  </button>
                  {mark && (
                    <span className="text-sm font-semibold text-good"> ({spoken[i]})</span>
                  )}{' '}
                </span>
              );
            })}
          </p>
        </Section>
      </>
    );
  },
};

function DictationView({
  question: q,
  response,
  onChange,
  review,
}: {
  question: { id: string; audio: string; sentence: string };
  response: string;
  onChange: (r: string) => void;
  review: boolean;
}) {
  const id = useId();
  const marks = review ? scoreDictation(q.sentence, response).marks : null;
  return (
    <>
      <Listen path={q.audio} script={q.sentence} review={review} />
      <label htmlFor={id} className="text-sm font-semibold uppercase tracking-wide text-muted">
        Type the sentence exactly as you hear it
      </label>
      <textarea
        id={id}
        rows={2}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={response}
        readOnly={review}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-token border border-muted bg-surface p-3"
      />
      {marks && (
        <Section title="Words of the sentence">
          <p className="flex flex-wrap gap-2">
            {marks.map((m, i) => (
              <span
                key={i}
                className={`rounded border px-2 py-0.5 ${markClass[m.found ? 'right' : 'wrong']}`}
              >
                <span className="sr-only">{m.found ? 'written: ' : 'missing: '}</span>
                {m.word}
              </span>
            ))}
          </p>
        </Section>
      )}
    </>
  );
}

export const dictation: Answerable<'listening_write_from_dictation', string> = {
  initial: () => '',
  score: (q, r) => scoreDictation(q.sentence, r),
  View: DictationView,
};
