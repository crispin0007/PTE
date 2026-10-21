import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { Question } from '@openpte/schema';
import { StatusDot } from '../../components/StatusDot.tsx';
import { getType, loadQuestions } from '../../content/catalog.ts';
import { SKILL_META, TYPE_GUIDE } from '../../content/guide.ts';
import { latestAttempts, statusOf, useHistory } from '../../practice/history.ts';
import { NotFound } from './NotFound.tsx';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'wrong', label: 'Mistakes' },
  { key: 'bookmarked', label: 'Bookmarked' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

export function TypePage() {
  const def = getType(useParams().type);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState(false);
  const [params, setParams] = useSearchParams();
  const { attempts, bookmarks } = useHistory();

  useEffect(() => {
    if (!def) return;
    let live = true;
    loadQuestions(def.id).then(
      (qs) => live && setQuestions(qs),
      () => live && setError(true),
    );
    return () => {
      live = false;
    };
  }, [def]);

  if (!def) return <NotFound />;
  const filter = (FILTERS.find((f) => f.key === params.get('filter'))?.key ?? 'all') as Filter;
  const difficulty = Number(params.get('difficulty')) || 0;
  const latest = latestAttempts(attempts);
  const marked = new Set(bookmarks);
  const numbered = (questions ?? []).map((q, i) => ({
    q,
    n: i + 1,
    status: statusOf(latest.get(q.id)),
  }));
  const shown = numbered.filter(
    ({ q, status }) =>
      (difficulty === 0 || q.difficulty === difficulty) &&
      (filter === 'all' ||
        (filter === 'new' && status === 'new') ||
        (filter === 'wrong' && (status === 'wrong' || status === 'partial')) ||
        (filter === 'bookmarked' && marked.has(q.id))),
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const guide = TYPE_GUIDE[def.id];
  return (
    <div className="flex flex-col gap-5">
      <p>
        <Link to={`/practice?skill=${def.skill}`} className="text-sm text-muted underline">
          {SKILL_META[def.skill].label} question types
        </Link>
      </p>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{def.label}</h1>
        <p className="text-muted">
          {def.timing.mode === 'per_item'
            ? `${def.timing.prep_s ? `${def.timing.prep_s} s to prepare, ` : ''}${def.timing.answer_s} s to answer.`
            : 'Timed together with the rest of the section.'}
          {def.word_limits &&
            ` Answer length: ${def.word_limits.min} to ${def.word_limits.max} words.`}
        </p>
        <p
          className={`rounded-token border-l-4 bg-surface px-4 py-3 text-sm ${SKILL_META[def.skill].soft}`}
        >
          <span className="font-semibold">Tip: </span>
          {guide.tip}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter questions">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setParam('filter', f.key === 'all' ? null : f.key)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              filter === f.key
                ? 'border-ink bg-ink text-bg'
                : 'border-line bg-surface hover:border-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => setParam('difficulty', e.target.value === '0' ? null : e.target.value)}
            className="min-h-11 rounded-token border border-line bg-surface px-3"
          >
            <option value={0}>Any</option>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d} of 5
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p role="alert">Could not load the questions. Check your connection and reload.</p>}
      {!questions && !error && <p>Loading…</p>}
      {questions?.length === 0 && <p>No reviewed questions of this type yet.</p>}
      {questions && questions.length > 0 && shown.length === 0 && (
        <p className="text-muted">No questions match these filters.</p>
      )}
      {shown.length > 0 && (
        <ol className="flex flex-col divide-y divide-line rounded-token border border-line bg-surface">
          {shown.map(({ q, n, status }) => (
            <li key={q.id}>
              <Link
                to={`/practice/${def.id}/${q.id}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 hover:bg-sunken"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">
                    Question {n}
                    {marked.has(q.id) && <span className="sr-only"> (bookmarked)</span>}
                    {marked.has(q.id) && (
                      <span aria-hidden="true" className="ml-1 text-brand">
                        ★
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted">Difficulty {q.difficulty} of 5</span>
                </span>
                <StatusDot status={status} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
