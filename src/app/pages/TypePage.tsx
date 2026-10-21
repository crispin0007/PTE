import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getType, loadQuestions } from '../../content/catalog.ts';
import type { Question } from '../../schema/questions.ts';
import { NotFound } from './NotFound.tsx';

export function TypePage() {
  const def = getType(useParams().type);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState(false);

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
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link to="/practice" className="text-sm underline">
          All question types
        </Link>
      </p>
      <h1 className="text-2xl font-bold">{def.label}</h1>
      <p className="text-muted">
        {def.timing.mode === 'per_item'
          ? `${def.timing.prep_s ? `${def.timing.prep_s} s to prepare, ` : ''}${def.timing.answer_s} s to answer.`
          : 'Timed together with the rest of the section.'}
        {def.word_limits &&
          ` Answer length: ${def.word_limits.min} to ${def.word_limits.max} words.`}
      </p>
      {error && <p role="alert">Could not load the questions. Check your connection and reload.</p>}
      {!questions && !error && <p>Loading…</p>}
      {questions?.length === 0 && <p>No reviewed questions of this type yet.</p>}
      {questions && questions.length > 0 && (
        <ol className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <li key={q.id}>
              <Link
                to={`/practice/${def.id}/${q.id}`}
                className="block rounded-token border border-border bg-surface px-3 py-2 hover:border-accent"
              >
                Question {i + 1}
                <span className="ml-2 text-sm text-muted">difficulty {q.difficulty} of 5</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
