import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Question } from '@openpte/schema';
import { SCORING_RULES, type ScoreResult, type WritingResult } from '@openpte/scoring';
import { ScoreDisclaimer } from '../components/ScoreDisclaimer.tsx';
import type { TypeDef } from '../content/catalog.ts';
import { SKILL_META } from '../content/guide.ts';
import { recordAttempt } from '../practice/history.ts';
import type { AnyAnswerable } from './types.ts';

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** Counts seconds since mount while `running`. */
function useSeconds(running: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return s;
}

function Result({ result, skill }: { result: ScoreResult; skill: TypeDef['skill'] }) {
  const pct = result.max ? (result.score / result.max) * 100 : 0;
  return (
    <section
      aria-labelledby="result-heading"
      data-testid="result"
      className="flex flex-col gap-3 rounded-token border border-line bg-surface p-5"
    >
      <h2 id="result-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
        Your score
      </h2>
      <p className="font-display text-5xl font-bold" data-testid="score">
        {result.score}
        <span className="text-2xl text-muted"> / {result.max}</span>
      </p>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-sunken">
        <div className={`h-full ${SKILL_META[skill].color}`} style={{ width: `${pct}%` }} />
      </div>
      {'traits' in result && (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Score by trait</caption>
          <tbody className="divide-y divide-line">
            {(result as WritingResult).traits.map((t) => (
              <tr key={t.name}>
                <th scope="row" className="py-1.5 pr-3 font-semibold">
                  {t.name}
                </th>
                <td className="py-1.5 pr-3 font-mono whitespace-nowrap">
                  {t.scored ? `${t.score} / ${t.max}` : '–'}
                </td>
                <td className="py-1.5 text-muted">{t.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="text-sm">
        <p className="font-semibold">How this was scored</p>
        <p className="text-muted">{SCORING_RULES[result.rule]}.</p>
        <ul className="mt-1 list-disc pl-5">
          {result.working.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>
      <ScoreDisclaimer />
    </section>
  );
}

/**
 * The exam frame from the UI plan: type, counter and timer on top, the question, then Submit.
 * After submitting, the same view shows the answer marked, the score and how it was worked out.
 */
type SessionProps = {
  def: TypeDef;
  question: Question;
  questions: Question[];
  answerable: AnyAnswerable;
};

export function Session(props: SessionProps) {
  // Retry remounts the attempt, which resets the response, the result and the timer.
  const [attempt, setAttempt] = useState(0);
  return <Attempt key={attempt} {...props} onRetry={() => setAttempt((a) => a + 1)} />;
}

function Attempt({
  def,
  question,
  questions,
  answerable,
  onRetry,
}: SessionProps & { onRetry: () => void }) {
  const navigate = useNavigate();
  const [response, setResponse] = useState<unknown>(() => answerable.initial(question));
  const [result, setResult] = useState<ScoreResult | null>(null);
  const elapsed = useSeconds(result === null);
  const index = questions.findIndex((q) => q.id === question.id);
  const next = questions[index + 1];
  const limit = def.timing.mode === 'per_item' ? def.timing.answer_s : null;
  const remaining = limit === null ? null : limit - elapsed;
  const submitRef = useRef<() => Promise<void>>(async () => {});

  const [checking, setChecking] = useState(false);
  const submit = async () => {
    if (checking) return;
    setChecking(true);
    const r = await answerable.score(question, response);
    setChecking(false);
    setResult(r);
    recordAttempt({
      questionId: question.id,
      type: def.id,
      skill: def.skill,
      score: r.score,
      max: r.max,
      at: Date.now(),
    });
  };
  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && result === null) void submitRef.current();
  }, [remaining, result]);

  const View = answerable.View;
  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <select
            aria-label="Go to question"
            value={question.id}
            onChange={(e) => navigate(`/practice/${def.id}/${e.target.value}`)}
            className="min-h-11 rounded-token border border-line bg-surface px-2"
          >
            {questions.map((q, i) => (
              <option key={q.id} value={q.id}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <p
          role="timer"
          aria-label={remaining === null ? 'Time spent' : 'Time left'}
          className={`font-mono text-lg font-semibold tabular-nums ${
            remaining !== null && remaining <= 10 && !result ? 'text-bad' : ''
          }`}
        >
          {clock(remaining ?? elapsed)}
        </p>
      </div>

      <View question={question} response={response} onChange={setResponse} review={!!result} />

      {result && <Result result={result} skill={def.skill} />}

      <div className="flex flex-wrap gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={checking}
            className="min-h-11 rounded-token bg-brand px-6 font-semibold text-brand-ink disabled:opacity-60"
          >
            {checking ? 'Checking…' : 'Submit'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 rounded-token border border-line bg-surface px-6 font-semibold"
            >
              Retry
            </button>
            {next && (
              <button
                type="button"
                onClick={() => navigate(`/practice/${def.id}/${next.id}`)}
                className="min-h-11 rounded-token bg-brand px-6 font-semibold text-brand-ink"
              >
                Next question
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
