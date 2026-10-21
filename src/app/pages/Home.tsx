import { Link } from 'react-router';
import { includesUnreviewed, itemTypes, questionCount } from '../../content/catalog.ts';

export function Home() {
  const total = itemTypes.reduce((n, t) => n + questionCount(t.id), 0);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Free PTE Academic practice</h1>
      <p>
        Practise every question type of the PTE Academic test, for free, with no account. Your
        answers stay on your device.
      </p>
      <p className="text-muted">
        {total} questions across {itemTypes.length} question types
        {includesUnreviewed ? ', including questions still waiting for human review' : ''}.
      </p>
      <p>
        <Link
          to="/practice"
          className="inline-block rounded-token bg-accent px-4 py-2 font-semibold text-accent-text"
        >
          Start practising
        </Link>
      </p>
      <p className="text-sm text-muted">
        openpte is in early development. Answering and scoring arrive in the next release; for now
        you can browse the questions.
      </p>
    </div>
  );
}
