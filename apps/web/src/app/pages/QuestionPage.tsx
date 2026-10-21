import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Question } from '@openpte/schema';
import { ANSWERABLE } from '../../answer/registry.ts';
import { Session } from '../../answer/Session.tsx';
import { BookmarkButton } from '../../components/BookmarkButton.tsx';
import { ScoreDisclaimer } from '../../components/ScoreDisclaimer.tsx';
import { getType, loadQuestions } from '../../content/catalog.ts';
import { QuestionPreview } from '../../items/QuestionPreview.tsx';
import { NotFound } from './NotFound.tsx';

export function QuestionPage() {
  const params = useParams();
  const def = getType(params.type);
  const [questions, setQuestions] = useState<Question[] | null | undefined>(undefined);

  useEffect(() => {
    if (!def) return;
    let live = true;
    loadQuestions(def.id).then(
      (qs) => live && setQuestions(qs),
      () => live && setQuestions(null),
    );
    return () => {
      live = false;
    };
  }, [def]);

  const question = questions?.find((q) => q.id === params.id);
  if (!def || questions === null || (questions && !question)) return <NotFound />;
  if (!questions || !question) return <p>Loading…</p>;
  const answerable = ANSWERABLE[def.id];
  return (
    <article className="flex flex-col gap-4" data-testid="question">
      <p>
        <Link to={`/practice/${def.id}`} className="text-sm text-muted underline">
          All {def.label} questions
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{def.label}</h1>
        <BookmarkButton questionId={question.id} />
      </div>
      {question.status !== 'published' && (
        <p role="note" className="rounded-token bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          Draft question: not yet checked by two human reviewers. It may contain mistakes.
        </p>
      )}
      {answerable ? (
        <Session
          key={question.id}
          def={def}
          question={question}
          questions={questions}
          answerable={answerable}
        />
      ) : (
        <>
          <QuestionPreview question={question} />
          <section
            aria-labelledby="score-heading"
            className="flex flex-col gap-2 border-t border-line pt-4"
          >
            <h2 id="score-heading" className="text-lg font-semibold">
              Your score
            </h2>
            <p className="text-muted">
              Answering and scoring for this question type arrive in a coming release.
            </p>
            <ScoreDisclaimer />
          </section>
        </>
      )}
      <p className="text-xs text-muted">
        {question.source === 'original' ? 'Written for openpte.' : question.attribution} Licence:{' '}
        {question.license}.
      </p>
    </article>
  );
}
