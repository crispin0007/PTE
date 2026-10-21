import { Link } from 'react-router';
import { includesUnreviewed, itemTypes, questionCount } from '../../content/catalog.ts';

export function Today() {
  const total = itemTypes.reduce((n, t) => n + questionCount(t.id), 0);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Free PTE Academic practice</h1>
        <p className="text-muted">
          {total} questions across {itemTypes.length} question types
          {includesUnreviewed ? ', including questions still waiting for human review' : ''}. No
          account needed.
        </p>
      </div>
      <section
        aria-labelledby="today-heading"
        className="flex flex-col gap-3 rounded-token border border-line bg-surface p-5"
      >
        <h2 id="today-heading" className="text-xl font-semibold">
          Today
        </h2>
        <p>
          Your daily goal and a suggested set of questions will appear here once you have answered a
          few.
        </p>
        <p>
          <Link
            to="/practice"
            className="inline-flex min-h-11 items-center rounded-token bg-brand px-5 font-semibold text-brand-ink"
          >
            Start practising
          </Link>
        </p>
      </section>
    </div>
  );
}
