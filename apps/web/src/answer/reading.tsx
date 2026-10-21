import { useState } from 'react';
import { scoreBlanks, scoreMcqMultiple, scoreMcqSingle, scoreReorder } from '@openpte/scoring';
import type { QuestionOf } from '@openpte/schema';
import {
  BlankText,
  Choices,
  MarkLabel,
  markClass,
  Passage,
  Section,
  seededShuffle,
  type ReviewMark,
} from './parts.tsx';
import type { Answerable } from './types.ts';

export const mcqSingle: Answerable<'reading_mcq_single', number | null> = {
  initial: () => null,
  score: (q, r) => scoreMcqSingle(q.answer, r),
  View: ({ question: q, response, onChange, review }) => (
    <>
      <Passage text={q.passage} />
      <p className="font-semibold">{q.question}</p>
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

export const mcqMultiple: Answerable<'reading_mcq_multiple', number[]> = {
  initial: () => [],
  score: (q, r) => scoreMcqMultiple(q.answers, r),
  View: ({ question: q, response, onChange, review }) => (
    <>
      <Passage text={q.passage} />
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

type Blanks = (string | null)[];

const blankLabel = (i: number) => `Blank ${i + 1}`;

export const fibDropdown: Answerable<'reading_fib_dropdown', Blanks> = {
  initial: (q) => q.blanks.map(() => null),
  score: (q, r) =>
    scoreBlanks(
      q.blanks.map((b) => b.options[b.answer]!),
      r,
    ),
  View: ({ question: q, response, onChange, review }) => {
    const marks = review
      ? scoreBlanks(
          q.blanks.map((b) => b.options[b.answer]!),
          response,
        ).marks
      : null;
    return (
      <BlankText
        text={q.passage}
        renderBlank={(i) => {
          const b = q.blanks[i]!;
          const mark = marks?.[i] ?? null;
          return (
            <span className="inline-flex flex-wrap items-baseline gap-1">
              <select
                aria-label={blankLabel(i)}
                value={response[i] ?? ''}
                disabled={review}
                onChange={(e) => {
                  const next = [...response];
                  next[i] = e.target.value || null;
                  onChange(next);
                }}
                className={`mx-1 min-h-10 rounded-token border bg-surface px-2 ${
                  mark ? markClass[mark === 'missed' ? 'wrong' : mark] : 'border-muted'
                }`}
              >
                <option value="">Choose…</option>
                {b.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {mark && mark !== 'right' && (
                <span className="text-sm font-semibold text-good">✓ {b.options[b.answer]}</span>
              )}
            </span>
          );
        }}
      />
    );
  },
};

/**
 * Fill in the blanks from a word bank. Tap a word to put it in the selected (or first empty)
 * blank; tap a filled blank to send its word back. Works the same with touch, mouse and keyboard.
 */
function DragDropView({
  question: q,
  response,
  onChange,
  review,
}: {
  question: QuestionOf<'reading_fib_drag_drop'>;
  response: Blanks;
  onChange: (r: Blanks) => void;
  review: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const bank = seededShuffle([...q.blanks.map((b) => b.answer), ...q.distractors], q.id);
  const used = new Set(response.filter(Boolean));
  const marks = review
    ? scoreBlanks(
        q.blanks.map((b) => b.answer),
        response,
      ).marks
    : null;

  const place = (word: string) => {
    const target = active ?? response.findIndex((r) => r === null);
    if (target < 0) return;
    const next = [...response];
    next[target] = word;
    onChange(next);
    const nextEmpty = next.findIndex((r) => r === null);
    setActive(nextEmpty < 0 ? null : nextEmpty);
  };

  return (
    <>
      <BlankText
        text={q.passage}
        renderBlank={(i) => {
          const word = response[i];
          const mark: ReviewMark = marks?.[i] ?? null;
          return (
            <span className="inline-flex flex-wrap items-baseline gap-1">
              <button
                type="button"
                aria-label={`${blankLabel(i)}: ${word ?? 'empty'}`}
                aria-pressed={active === i}
                disabled={review}
                onClick={() => {
                  if (word) {
                    const next = [...response];
                    next[i] = null;
                    onChange(next);
                  }
                  setActive(i);
                }}
                className={`mx-1 inline-flex min-h-10 min-w-24 items-center justify-center rounded-token border-2 px-2 align-middle font-semibold ${
                  mark
                    ? markClass[mark === 'missed' ? 'wrong' : mark]
                    : active === i
                      ? 'border-brand bg-brand-soft'
                      : word
                        ? 'border-line bg-sunken'
                        : 'border-dashed border-muted'
                }`}
              >
                {word ?? ''}
              </button>
              {mark && mark !== 'right' && (
                <span className="text-sm font-semibold text-good">✓ {q.blanks[i]!.answer}</span>
              )}
            </span>
          );
        }}
      />
      {!review && (
        <Section title="Word bank">
          <div className="flex flex-wrap gap-2">
            {bank.map((w) => (
              <button
                key={w}
                type="button"
                disabled={used.has(w)}
                onClick={() => place(w)}
                className="min-h-11 rounded-token border border-line bg-surface px-4 font-semibold hover:border-brand disabled:opacity-40"
              >
                {w}
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

export const fibDragDrop: Answerable<'reading_fib_drag_drop', Blanks> = {
  initial: (q) => q.blanks.map(() => null),
  score: (q, r) =>
    scoreBlanks(
      q.blanks.map((b) => b.answer),
      r,
    ),
  View: DragDropView,
};

/** Response is the order of paragraph indexes; paragraphs are stored in the correct order. */
export const reorder: Answerable<'reading_reorder_paragraphs', number[]> = {
  initial: (q) => {
    const idx = q.paragraphs.map((_, i) => i);
    let order = seededShuffle(idx, q.id);
    // A shuffle that happens to be correct would be a free question.
    if (order.every((p, i) => p === i)) order = [...idx.slice(1), idx[0]!];
    return order;
  },
  score: (q, r) => scoreReorder(q.paragraphs.length, r),
  View: ({ question: q, response, onChange, review }) => {
    const pairs = review ? scoreReorder(q.paragraphs.length, response).pairs : null;
    const move = (from: number, to: number) => {
      const next = [...response];
      const [p] = next.splice(from, 1);
      next.splice(to, 0, p!);
      onChange(next);
    };
    return (
      <Section title="Put the paragraphs in order">
        <ol className="flex flex-col gap-2">
          {response.map((p, i) => {
            const mark: ReviewMark = pairs && i > 0 ? (pairs[i - 1] ? 'right' : 'wrong') : null;
            return (
              <li key={p} className="flex flex-col gap-2">
                {pairs && i > 0 && (
                  <span className="pl-4 text-xs font-semibold">
                    <MarkLabel mark={mark} />{' '}
                    <span className="text-muted">
                      {pairs[i - 1] ? 'pair in order' : 'pair not in order'}
                    </span>
                  </span>
                )}
                <div className="flex items-start gap-3 rounded-token border border-line bg-surface p-3">
                  <span className="font-mono font-semibold text-muted">{i + 1}</span>
                  <span className="flex-1">{q.paragraphs[p]}</span>
                  {!review && (
                    <span className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        aria-label={`Move paragraph ${i + 1} up`}
                        disabled={i === 0}
                        onClick={() => move(i, i - 1)}
                        className="grid size-11 place-items-center rounded-token border border-line disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move paragraph ${i + 1} down`}
                        disabled={i === response.length - 1}
                        onClick={() => move(i, i + 1)}
                        className="grid size-11 place-items-center rounded-token border border-line disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {review && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">Show the correct order</summary>
            <ol className="mt-2 list-decimal pl-6">
              {q.paragraphs.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </details>
        )}
      </Section>
    );
  },
};
