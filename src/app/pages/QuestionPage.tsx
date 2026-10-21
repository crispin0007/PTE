import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ScoreDisclaimer } from '../../components/ScoreDisclaimer.tsx';
import { getType, loadQuestions } from '../../content/catalog.ts';
import { QuestionPreview } from '../../items/QuestionPreview.tsx';
import type { Question } from '../../schema/questions.ts';
import { NotFound } from './NotFound.tsx';

export function QuestionPage() {
  const params = useParams();
  const def = getType(params.type);
  const [question, setQuestion] = useState<Question | null | undefined>(undefined);

  useEffect(() => {
    if (!def) return;
    let live = true;
    loadQuestions(def.id).then(
      (qs) => live && setQuestion(qs.find((q) => q.id === params.id) ?? null),
      () => live && setQuestion(null),
    );
    return () => {
      live = false;
    };
  }, [def, params.id]);

  if (!def || question === null) return <NotFound />;
  if (!question) return <p>Loading…</p>;
  return (
    <article className="flex flex-col gap-5" data-testid="question">
      <p>
        <Link to={`/practice/${def.id}`} className="text-sm underline">
          {def.label}
        </Link>
      </p>
      <h1 className="text-2xl font-bold">{def.label}</h1>
      {question.status !== 'published' && (
        <p role="note" className="rounded-token bg-warn-bg px-3 py-2 text-sm text-warn-text">
          Draft question: not yet checked by two human reviewers. It may contain mistakes.
        </p>
      )}
      <QuestionPreview question={question} />
      <section
        aria-labelledby="score-heading"
        className="flex flex-col gap-2 border-t border-border pt-4"
      >
        <h2 id="score-heading" className="text-lg font-semibold">
          Your score
        </h2>
        <p className="text-muted">
          Answering and scoring for this question type arrive in the next release.
        </p>
        <ScoreDisclaimer />
      </section>
      <p className="text-xs text-muted">
        {question.source === 'original' ? 'Written for openpte.' : question.attribution} Licence:{' '}
        {question.license}.
      </p>
    </article>
  );
}
