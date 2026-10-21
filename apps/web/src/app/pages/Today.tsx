import { Link } from 'react-router';
import { isScored } from '../../answer/registry.ts';
import { includesUnreviewed, itemTypes, questionCount } from '../../content/catalog.ts';
import { SKILL_META, TYPE_GUIDE } from '../../content/guide.ts';
import { questionLabel, typeLabel } from '../../content/labels.ts';
import { answeredOn, mistakeQueue, suggestTypes } from '../../practice/analytics.ts';
import { useHistory, useNow } from '../../practice/history.ts';

const card = 'flex flex-col gap-3 rounded-token border border-line bg-surface p-5';

export function Today() {
  const { attempts, settings } = useHistory();
  const now = useNow();
  const total = itemTypes.reduce((n, t) => n + questionCount(t.id), 0);
  const today = answeredOn(attempts, now);
  const goal = settings.dailyGoal;
  const done = today >= goal;
  const answerable = itemTypes.filter((t) => isScored(t.id) && questionCount(t.id) > 0);
  const suggested = suggestTypes(
    attempts,
    answerable.map((t) => t.id),
  );
  const mistakes = mistakeQueue(attempts).slice(0, 5);
  const firstVisit = attempts.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">
          {firstVisit ? 'Free PTE Academic practice' : 'Today'}
        </h1>
        <p className="text-muted">
          {firstVisit
            ? `${total} questions across ${itemTypes.length} question types${
                includesUnreviewed ? ', including questions still waiting for human review' : ''
              }. No account needed; your progress stays on this device.`
            : 'Pick up where you left off.'}
        </p>
      </div>

      <section aria-labelledby="goal-heading" className={card} data-testid="daily-goal">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="goal-heading" className="text-xl font-semibold">
            Daily goal
          </h2>
          <Link to="/more" className="text-sm text-muted underline">
            Change
          </Link>
        </div>
        <p>
          <span className="font-display text-4xl font-bold">{today}</span>
          <span className="text-muted"> of {goal} questions today</span>
        </p>
        <div
          role="progressbar"
          aria-label="Daily goal"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(today, goal)}
          className="h-2.5 overflow-hidden rounded-full bg-sunken"
        >
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${Math.min(100, (today / goal) * 100)}%` }}
          />
        </div>
        <p className="text-sm text-muted">
          {done
            ? 'Goal reached. Anything more is a bonus.'
            : `${goal - today} to go. Short, regular sessions beat one long one.`}
        </p>
      </section>

      <section aria-labelledby="suggested-heading" className="flex flex-col gap-3">
        <h2 id="suggested-heading" className="text-xl font-semibold">
          {firstVisit ? 'Start here' : 'Suggested for you'}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {suggested.map(({ type, reason }) => {
            const def = itemTypes.find((t) => t.id === type)!;
            return (
              <li key={type}>
                <Link
                  to={`/practice/${type}${reason === 'weak' ? '?filter=wrong' : '?filter=new'}`}
                  className="flex h-full flex-col gap-1 rounded-token border border-line bg-surface p-4 hover:border-brand"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    <span
                      aria-hidden="true"
                      className={`size-2.5 rounded-full ${SKILL_META[def.skill].color}`}
                    />
                    {SKILL_META[def.skill].label} · {TYPE_GUIDE[def.id].code}
                  </span>
                  <span className="font-semibold">{def.label}</span>
                  <span className="text-sm text-muted">
                    {reason === 'weak' ? 'Your weakest type so far' : 'Not tried yet'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {mistakes.length > 0 && (
        <section aria-labelledby="mistakes-heading" className={card}>
          <h2 id="mistakes-heading" className="text-xl font-semibold">
            Mistakes to retry
          </h2>
          <ul className="flex flex-col divide-y divide-line">
            {mistakes.map((m) => (
              <li key={m.questionId}>
                <Link
                  to={`/practice/${m.type}/${m.questionId}`}
                  className="flex min-h-12 items-center justify-between gap-3 py-2"
                >
                  <span>
                    <span className="font-semibold">{typeLabel(m.type)}</span>
                    <span className="text-muted"> · {questionLabel(m.questionId)}</span>
                  </span>
                  <span className="font-mono text-sm text-muted">
                    {m.score}/{m.max}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
