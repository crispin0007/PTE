import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { QuestionType } from '@openpte/schema';
import { ScoreDisclaimer } from '../components/ScoreDisclaimer.tsx';
import { loadQuestions } from '../content/catalog.ts';
import { snapshot } from '../practice/history.ts';
import { buildPaper, MOCKS, paperTypes, type MockDef } from './definitions.ts';
import { deleteSitting, paperItems, startSitting, useSittings } from './store.ts';

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const itemCount = (def: MockDef) =>
  def.sections.reduce((n, s) => n + s.items.reduce((m, i) => m + i.count, 0), 0);

/** Loads every type the mock uses and picks this sitting's questions. */
async function preparePaper(def: MockDef) {
  const types = paperTypes(def);
  const lists = await Promise.all(types.map((t) => loadQuestions(t)));
  const pool: Partial<Record<QuestionType, string[]>> = {};
  types.forEach((t, i) => (pool[t] = lists[i]!.map((q) => q.id)));
  const answered = new Set(snapshot().attempts.map((a) => a.questionId));
  return buildPaper(def, pool, answered, newId(), Date.now());
}

export function MockHome() {
  const navigate = useNavigate();
  const sittings = useSittings();
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const open = sittings.filter((s) => !s.report);
  const finished = sittings.filter((s) => s.report);

  const start = async (def: MockDef) => {
    setStarting(def.id);
    setError('');
    try {
      const paper = await preparePaper(def);
      startSitting(paper);
      navigate(`/mock/run/${paper.id}`);
    } catch {
      setError('The questions could not be loaded. Try again later.');
      setStarting(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Mock tests</h1>
        <p className="mt-1 max-w-prose text-muted">
          Sit a timed test in the same order as PTE Academic, one question at a time with no going
          back, then get a score report for each skill.
        </p>
      </div>

      {open.length > 0 && (
        <section aria-labelledby="open-heading" className="flex flex-col gap-3">
          <h2 id="open-heading" className="text-lg font-semibold">
            Carry on
          </h2>
          <ul className="flex flex-col gap-2">
            {open.map((s) => (
              <li
                key={s.paper.id}
                className="flex flex-wrap items-center gap-3 rounded-token border border-line bg-surface p-4"
              >
                <span className="font-semibold">{s.paper.label}</span>
                <span className="text-sm text-muted">
                  Question {s.position + 1} of {paperItems(s.paper).length}
                </span>
                <span className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => deleteSitting(s.paper.id)}
                    className="min-h-11 rounded-token border border-line px-4 text-sm font-semibold"
                  >
                    Discard
                  </button>
                  <Link
                    to={`/mock/run/${s.paper.id}`}
                    className="grid min-h-11 place-items-center rounded-token bg-brand px-4 text-sm font-semibold text-brand-ink"
                  >
                    Continue
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="start-heading" className="flex flex-col gap-3">
        <h2 id="start-heading" className="text-lg font-semibold">
          Start a mock test
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {MOCKS.map((m) => (
            <li
              key={m.id}
              data-testid="mock-card"
              className="flex flex-col gap-2 rounded-token border border-line bg-surface p-4"
            >
              <h3 className="font-display text-lg font-bold">{m.label}</h3>
              <p className="text-sm text-muted">
                {m.description} Up to {itemCount(m)} questions.
              </p>
              <button
                type="button"
                onClick={() => void start(m)}
                disabled={starting !== null}
                aria-label={`Start ${m.label}`}
                className="mt-auto min-h-11 self-start rounded-token bg-brand px-5 font-semibold text-brand-ink disabled:opacity-60"
              >
                {starting === m.id ? 'Preparing…' : 'Start'}
              </button>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="text-bad">
            {error}
          </p>
        )}
        <p className="text-sm text-muted">
          Questions you have not answered yet are used first. The mix of question types follows the
          published test format; the real test varies a little.
        </p>
      </section>

      {finished.length > 0 && (
        <section aria-labelledby="past-heading" className="flex flex-col gap-3">
          <h2 id="past-heading" className="text-lg font-semibold">
            Past reports
          </h2>
          <ul className="divide-y divide-line rounded-token border border-line bg-surface">
            {finished.map((s) => (
              <li key={s.paper.id}>
                <Link
                  to={`/mock/report/${s.paper.id}`}
                  className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-sunken"
                >
                  <span className="font-semibold">{s.paper.label}</span>
                  <span className="text-sm text-muted">
                    {new Date(s.report!.finishedAt).toLocaleDateString()}
                  </span>
                  <span className="ml-auto font-mono font-semibold">
                    {s.report!.overall ?? '–'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <ScoreDisclaimer />
        </section>
      )}
    </div>
  );
}
