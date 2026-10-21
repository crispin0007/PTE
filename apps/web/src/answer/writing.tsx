import { useId } from 'react';
import {
  scoreWriting,
  sentenceCount,
  type WritingResult,
  type WritingRule,
} from '@openpte/scoring';
import { wordCount } from '@openpte/schema/text';
import { Listen } from './Listen.tsx';
import { Passage, Section } from './parts.tsx';
import { misspellings } from './spelling.ts';
import type { Answerable } from './types.ts';

const LIMITS: Record<WritingRule, { min: number; max: number; rows: number; hint: string }> = {
  writing_swt: { min: 5, max: 75, rows: 4, hint: 'One sentence, 5 to 75 words' },
  writing_sst: { min: 50, max: 70, rows: 6, hint: '50 to 70 words' },
  writing_essay: { min: 200, max: 300, rows: 14, hint: '200 to 300 words' },
};

async function check(rule: WritingRule, text: string): Promise<WritingResult> {
  let wrong: string[] = [];
  let offline = false;
  try {
    wrong = await misspellings(text);
  } catch {
    offline = true;
  }
  const r = scoreWriting(rule, text, wrong);
  if (offline && rule !== 'writing_swt')
    r.working.push('Spelling could not be checked: the dictionary did not load');
  return r;
}

function Editor({
  rule,
  value,
  onChange,
  review,
  sample,
}: {
  rule: WritingRule;
  value: string;
  onChange: (v: string) => void;
  review: boolean;
  sample: string;
}) {
  const id = useId();
  const limits = LIMITS[rule];
  const words = wordCount(value);
  const inRange = words >= limits.min && words <= limits.max;
  const sentences = sentenceCount(value);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold uppercase tracking-wide text-muted">
        Your answer
      </label>
      <textarea
        id={id}
        rows={limits.rows}
        value={value}
        readOnly={review}
        spellCheck={false}
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
        className="rounded-token border border-muted bg-surface p-3 leading-relaxed"
      />
      <p className="flex flex-wrap gap-x-4 text-sm" aria-live="polite">
        <span className={words === 0 ? 'text-muted' : inRange ? 'text-good' : 'text-bad'}>
          {words} {words === 1 ? 'word' : 'words'}
        </span>
        {rule === 'writing_swt' && words > 0 && (
          <span className={sentences === 1 ? 'text-good' : 'text-bad'}>
            {sentences} {sentences === 1 ? 'sentence' : 'sentences'}
          </span>
        )}
        <span className="text-muted">Target: {limits.hint}</span>
      </p>
      {review && (
        <details className="rounded-token border border-line bg-surface p-4" open>
          <summary className="cursor-pointer font-semibold">Sample answer</summary>
          <p className="mt-2 whitespace-pre-line leading-relaxed">{sample}</p>
          <p className="mt-2 text-sm text-muted">
            {wordCount(sample)} words. Compare its content, structure and vocabulary with yours.
          </p>
        </details>
      )}
    </div>
  );
}

export const summarizeWritten: Answerable<'writing_summarize_written_text', string> = {
  initial: () => '',
  score: (_q, r) => check('writing_swt', r),
  View: ({ question: q, response, onChange, review }) => (
    <>
      <Section title="Summarise this passage in one sentence">
        <Passage text={q.passage} />
      </Section>
      <Editor
        rule="writing_swt"
        value={response}
        onChange={onChange}
        review={review}
        sample={q.sample_answer}
      />
    </>
  ),
};

export const essay: Answerable<'writing_essay', string> = {
  initial: () => '',
  score: (_q, r) => check('writing_essay', r),
  View: ({ question: q, response, onChange, review }) => (
    <>
      <Section title="Essay prompt">
        <Passage text={q.prompt} />
      </Section>
      <Editor
        rule="writing_essay"
        value={response}
        onChange={onChange}
        review={review}
        sample={q.sample_answer}
      />
    </>
  ),
};

export const summarizeSpoken: Answerable<'listening_summarize_spoken_text', string> = {
  initial: () => '',
  score: (_q, r) => check('writing_sst', r),
  View: ({ question: q, response, onChange, review }) => (
    <>
      <Listen path={q.audio} script={q.transcript} review={review} />
      <Editor
        rule="writing_sst"
        value={response}
        onChange={onChange}
        review={review}
        sample={q.sample_answer}
      />
    </>
  ),
};
