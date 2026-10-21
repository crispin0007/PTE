import { Link } from 'react-router';
import { typeLabel } from '../content/labels.ts';
import { useNow } from '../practice/history.ts';
import { instituteApi, useLoad, type MyAssignment } from './api.ts';

const DAY = 86_400_000;
const MOCK_LABEL: Record<string, string> = {
  full: 'Full mock test',
  mini: 'Mini mock test',
  speaking_writing: 'Speaking and Writing mock',
  reading: 'Reading mock',
  listening: 'Listening mock',
};

export const describeSpec = (a: Pick<MyAssignment, 'spec'>) =>
  a.spec.kind === 'mock'
    ? (MOCK_LABEL[a.spec.mockId] ?? 'Mock test')
    : `${a.spec.count} question${a.spec.count === 1 ? '' : 's'}: ${a.spec.types.map(typeLabel).join(', ')}`;

export const dueText = (dueAt: number, now: number) => {
  const days = Math.ceil((dueAt - now) / DAY);
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${new Date(dueAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}`;
};

const startLink = (a: MyAssignment) =>
  a.spec.kind === 'mock'
    ? `/mock?assignment=${a.id}&mock=${a.spec.mockId}`
    : `/practice/${a.spec.types[0]}`;

/** Assignments from the learner's classes that are open or due within a week. Signed in only. */
export function DueThisWeek() {
  const now = useNow();
  const { data } = useLoad(() => instituteApi.myAssignments(), '');
  const shown = (data?.assignments ?? []).filter(
    (a) => a.done < a.target || (a.dueAt > now && a.dueAt - now < 7 * DAY),
  );
  if (!shown.length) return null;
  return (
    <section
      aria-labelledby="due-heading"
      data-testid="due-this-week"
      className="flex flex-col gap-3 rounded-token border border-line bg-surface p-5"
    >
      <h2 id="due-heading" className="text-xl font-semibold">
        Set by your teacher
      </h2>
      <ul className="flex flex-col divide-y divide-line">
        {shown.map((a) => {
          const finished = a.done >= a.target;
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-muted">
                  {describeSpec(a)} · {a.className}
                </p>
                <p className={`text-sm ${!finished && a.dueAt < now ? 'text-bad' : 'text-muted'}`}>
                  {finished
                    ? 'Done'
                    : `${dueText(a.dueAt, now)} · ${a.done} of ${a.target}${a.spec.kind === 'mock' ? '' : ' answered'}`}
                </p>
              </div>
              {!finished && (
                <Link
                  to={startLink(a)}
                  className="grid min-h-11 place-items-center rounded-token bg-brand px-4 text-sm font-semibold text-brand-ink"
                >
                  {a.done ? 'Continue' : 'Start'}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
