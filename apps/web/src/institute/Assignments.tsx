import { useId, useState, type FormEvent } from 'react';
import { itemTypes } from '../content/catalog.ts';
import { SKILL_META } from '../content/guide.ts';
import { useNow } from '../practice/history.ts';
import { displayName, instituteApi, useLoad, type AssignmentSpec, type Student } from './api.ts';
import { describeSpec, dueText } from './Due.tsx';

const DAY = 86_400_000;
const MOCKS = [
  ['mini', 'Mini mock test (about 40 minutes)'],
  ['full', 'Full mock test (about 2 hours)'],
  ['speaking_writing', 'Speaking and Writing mock'],
  ['reading', 'Reading mock'],
  ['listening', 'Listening mock'],
] as const;

/** Practice choices: every type of one skill, or a single type. */
const PRACTICE: { value: string; label: string; types: string[] }[] = [
  ...(['speaking', 'writing', 'reading', 'listening'] as const).map((skill) => ({
    value: `skill:${skill}`,
    label: `All ${SKILL_META[skill].label} types`,
    types: itemTypes.filter((t) => t.skill === skill).map((t) => t.id),
  })),
  ...itemTypes.map((t) => ({ value: t.id, label: t.label, types: [t.id] })),
];

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const field = 'min-h-11 rounded-token border border-line bg-bg px-3';

/** Assignments for one class: set a practice set or a mock, and see who has finished. */
export function Assignments({
  id,
  classId,
  students,
}: {
  id: string;
  classId: string;
  students: Student[];
}) {
  const now = useNow();
  const list = useLoad(() => instituteApi.assignments(id, classId), `${id}/${classId}`);
  const ids = { title: useId(), kind: useId(), what: useId(), count: useId(), due: useId() };
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'practice' | 'mock'>('practice');
  const [what, setWhat] = useState(PRACTICE[0]!.value);
  const [mockId, setMockId] = useState<string>('mini');
  const [count, setCount] = useState(10);
  const [due, setDue] = useState(() => isoDay(now + 7 * DAY));
  const [error, setError] = useState<string | null>(null);
  const names = new Map(students.map((s) => [s.id, displayName(s)]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const spec: AssignmentSpec =
      kind === 'mock'
        ? { kind, mockId }
        : { kind, types: PRACTICE.find((p) => p.value === what)!.types, count };
    // Due at the end of the chosen day, in the teacher's time zone.
    const dueAt = new Date(`${due}T23:59:00`).getTime();
    try {
      await instituteApi.assign(id, classId, {
        title: title.trim() || describeSpec({ spec }),
        dueAt,
        spec,
      });
      setTitle('');
      list.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section
      aria-labelledby="assign-heading"
      className="flex flex-col gap-3 rounded-token border border-line bg-surface p-5"
    >
      <h2 id="assign-heading" className="text-xl font-semibold">
        Assignments
      </h2>
      {list.error && <p role="alert">{list.error}</p>}
      {list.data?.assignments.length === 0 && (
        <p className="text-sm text-muted">Nothing set yet.</p>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {list.data?.assignments.map((a) => (
          <li key={a.id} className="py-2">
            <details>
              <summary className="cursor-pointer">
                <span className="font-semibold">{a.title}</span>{' '}
                <span className="text-sm text-muted">
                  · {dueText(a.dueAt, now)} · {a.complete} of {a.students.length} done
                </span>
              </summary>
              <div className="mt-2 flex flex-col gap-2 pl-4 text-sm">
                <p className="text-muted">{describeSpec(a)}</p>
                <ul>
                  {a.students.map((s) => (
                    <li key={s.userId}>
                      {names.get(s.userId) ?? 'Student'}:{' '}
                      {a.spec.kind === 'mock'
                        ? s.result
                          ? `overall ${s.result.overall ?? '–'}`
                          : 'not yet'
                        : `${s.done} of ${s.target}`}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="min-h-11 self-start text-bad underline"
                  onClick={() => {
                    if (!confirm(`Remove “${a.title}”?`)) return;
                    instituteApi
                      .unassign(id, classId, a.id)
                      .then(list.reload, (err: Error) => setError(err.message));
                  }}
                >
                  Remove assignment
                </button>
              </div>
            </details>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => void submit(e)}
        className="flex flex-col gap-3 border-t border-line pt-3"
      >
        <h3 className="font-semibold">Set new work</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label htmlFor={ids.kind} className="flex flex-col gap-1 text-sm">
            Kind
            <select
              id={ids.kind}
              value={kind}
              onChange={(e) => setKind(e.target.value as 'practice' | 'mock')}
              className={field}
            >
              <option value="practice">Practice questions</option>
              <option value="mock">Mock test</option>
            </select>
          </label>
          {kind === 'practice' ? (
            <>
              <label htmlFor={ids.what} className="flex flex-col gap-1 text-sm">
                Question types
                <select
                  id={ids.what}
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  className={field}
                >
                  {PRACTICE.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor={ids.count} className="flex flex-col gap-1 text-sm">
                How many questions
                <input
                  id={ids.count}
                  type="number"
                  min={1}
                  max={200}
                  value={count}
                  onChange={(e) =>
                    setCount(Math.min(200, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className={field}
                />
              </label>
            </>
          ) : (
            <label htmlFor={ids.what} className="flex flex-col gap-1 text-sm">
              Mock test
              <select
                id={ids.what}
                value={mockId}
                onChange={(e) => setMockId(e.target.value)}
                className={field}
              >
                {MOCKS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label htmlFor={ids.due} className="flex flex-col gap-1 text-sm">
            Due
            <input
              id={ids.due}
              type="date"
              value={due}
              min={isoDay(now)}
              onChange={(e) => setDue(e.target.value)}
              className={field}
            />
          </label>
          <label htmlFor={ids.title} className="flex flex-col gap-1 text-sm">
            Title (optional)
            <input
              id={ids.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={field}
            />
          </label>
        </div>
        <button
          type="submit"
          className="min-h-11 self-start rounded-token bg-brand px-5 font-semibold text-brand-ink"
        >
          Set for the class
        </button>
        {error && (
          <p role="alert" className="text-bad">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
