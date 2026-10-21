import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { SKILL_META } from '../content/guide.ts';
import { Assignments } from './Assignments.tsx';
import { useAccount } from '../practice/account.ts';
import { useNow } from '../practice/history.ts';
import {
  instituteApi,
  displayName,
  inviteLink,
  percent,
  useLoad,
  type MemberRole,
  type Student,
} from './api.ts';

const card = 'flex flex-col gap-3 rounded-token border border-line bg-surface p-5';
const input = 'min-h-11 rounded-token border border-line bg-bg px-3';
const primary =
  'min-h-11 rounded-token bg-brand px-5 font-semibold text-brand-ink disabled:opacity-60';
const secondary = 'min-h-11 rounded-token border border-line bg-surface px-4 text-sm font-semibold';
const SKILLS = ['speaking', 'writing', 'reading', 'listening'] as const;
const DAY = 86_400_000;

function SignedIn({ title, children }: { title: string; children: ReactNode }) {
  const account = useAccount();
  if (account.status === 'loading') return <p>Loading…</p>;
  if (account.status !== 'signed-in')
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted">
          {account.status === 'off'
            ? 'Institutes and classes need the openpte API.'
            : 'Sign in to join a class or run an institute.'}{' '}
          <Link to="/more" className="underline">
            Account settings
          </Link>
        </p>
      </div>
    );
  return <>{children}</>;
}

function Alert({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-bad">
      {text}
    </p>
  ) : null;
}

/** One-field form with a submit button, used for names and codes. */
function OneField({
  label,
  button,
  onSubmit,
  placeholder,
}: {
  label: string;
  button: string;
  onSubmit: (value: string) => Promise<void>;
  placeholder?: string;
}) {
  const id = useId();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value.trim());
      setValue('');
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={`${input} min-w-0 flex-1`}
        />
        <button type="submit" disabled={busy} className={primary}>
          {button}
        </button>
      </div>
      <Alert text={error} />
    </form>
  );
}

const ROLE_LABEL: Record<MemberRole, string> = {
  student: 'Student',
  teacher: 'Teacher',
  owner: 'Owner',
};

export function InstitutesHome() {
  return (
    <SignedIn title="Institutes and classes">
      <Home />
    </SignedIn>
  );
}

function Home() {
  const navigate = useNavigate();
  const account = useAccount();
  const mine = useLoad(() => instituteApi.mine(), '');
  const config = useLoad(() => instituteApi.config(), '');
  const isAdmin = account.status === 'signed-in' && account.user.role === 'admin';
  const canCreate =
    config.data?.creation === 'anyone' || (config.data?.creation === 'admin' && isAdmin);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold">Institutes and classes</h1>
      <Alert text={mine.error} />
      {mine.data && mine.data.institutes.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-token border border-line bg-surface">
          {mine.data.institutes.map((i) => (
            <li key={i.id}>
              <Link
                to={`/institutes/${i.id}`}
                className="flex min-h-12 items-center justify-between gap-3 px-5 py-2"
              >
                <span className="font-semibold">{i.name}</span>
                <span className="text-sm text-muted">{ROLE_LABEL[i.role]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {mine.data?.institutes.length === 0 && (
        <p className="text-muted">You are not in an institute yet.</p>
      )}
      <section aria-labelledby="join-heading" className={card}>
        <h2 id="join-heading" className="text-xl font-semibold">
          Join a class
        </h2>
        <p className="text-sm text-muted">
          Your teacher gives you a code. Teachers in the class can see your practice progress.
        </p>
        <OneField
          label="Class code"
          button="Join"
          placeholder="ABCD-2345"
          onSubmit={async (code) => {
            const r = await instituteApi.join(code);
            navigate(`/institutes/${r.institute.id}`);
          }}
        />
      </section>
      {canCreate && (
        <section aria-labelledby="create-heading" className={card}>
          <h2 id="create-heading" className="text-xl font-semibold">
            Start an institute
          </h2>
          <p className="text-sm text-muted">
            For coaching centres and teachers: make classes, share a code, and follow each student’s
            progress. Free, like the rest of openpte.
          </p>
          <OneField
            label="Institute name"
            button="Create"
            onSubmit={async (name) => {
              const i = await instituteApi.create(name);
              navigate(`/institutes/${i.id}`);
            }}
          />
        </section>
      )}
    </div>
  );
}

export function InstitutePage() {
  return (
    <SignedIn title="Institute">
      <InstituteScreen />
    </SignedIn>
  );
}

function InstituteScreen() {
  const { id = '' } = useParams();
  const inst = useLoad(() => instituteApi.get(id), id);
  const classes = useLoad(() => instituteApi.classes(id), id);
  if (inst.error) return <Alert text={inst.error} />;
  if (!inst.data) return <p>Loading…</p>;
  const staff = inst.data.role !== 'student';
  return (
    <div className="flex flex-col gap-5">
      <p>
        <Link to="/institutes" className="text-sm text-muted underline">
          All institutes
        </Link>
      </p>
      <div>
        <h1 className="text-3xl font-bold">{inst.data.name}</h1>
        <p className="text-sm text-muted">You are {ROLE_LABEL[inst.data.role].toLowerCase()}.</p>
      </div>

      <section aria-labelledby="classes-heading" className={card}>
        <h2 id="classes-heading" className="text-xl font-semibold">
          {staff ? 'Classes' : 'Your classes'}
        </h2>
        <Alert text={classes.error} />
        {classes.data?.classes.length === 0 && (
          <p className="text-sm text-muted">No classes yet.</p>
        )}
        <ul className="flex flex-col divide-y divide-line">
          {classes.data?.classes.map((c) => (
            <li key={c.id} className="flex min-h-12 flex-wrap items-center gap-3 py-2">
              {staff ? (
                <Link to={`/institutes/${id}/classes/${c.id}`} className="font-semibold underline">
                  {c.name}
                </Link>
              ) : (
                <span className="font-semibold">{c.name}</span>
              )}
              {staff && (
                <span className="text-sm text-muted">
                  {c.students} student{c.students === 1 ? '' : 's'} · code{' '}
                  <span className="font-mono">{c.inviteCode}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
        {staff && (
          <OneField
            label="New class name"
            button="Add class"
            onSubmit={async (name) => {
              const c = await instituteApi.createClass(id, name);
              classes.setData((d) => ({ classes: [...(d?.classes ?? []), c] }));
            }}
          />
        )}
      </section>

      {inst.data.role === 'owner' && <Members id={id} />}

      {!staff && (
        <p className="text-sm text-muted">
          Your teachers see how many questions you answer and your marks by skill. They do not see
          your recordings.
        </p>
      )}
    </div>
  );
}

function Members({ id }: { id: string }) {
  const account = useAccount();
  const me = account.status === 'signed-in' ? account.user.id : '';
  const members = useLoad(() => instituteApi.members(id), id);
  const [error, setError] = useState<string | null>(null);
  return (
    <section aria-labelledby="members-heading" className={card}>
      <h2 id="members-heading" className="text-xl font-semibold">
        People
      </h2>
      <p className="text-sm text-muted">
        Teachers manage classes and see their students’ progress. Owners also manage people.
      </p>
      <Alert text={members.error ?? error} />
      <ul className="flex flex-col divide-y divide-line">
        {members.data?.members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="font-semibold">{displayName(m)}</span>{' '}
              <span className="text-sm text-muted">{m.email}</span>
            </span>
            <select
              aria-label={`Role for ${m.email}`}
              value={m.role}
              disabled={m.id === me}
              onChange={(e) => {
                const role = e.target.value as MemberRole;
                instituteApi.setRole(id, m.id, role).then(
                  () =>
                    members.setData((d) => ({
                      members: d!.members.map((x) => (x.id === m.id ? { ...x, role } : x)),
                    })),
                  (err: Error) => setError(err.message),
                );
              }}
              className="min-h-11 rounded-token border border-line bg-surface px-3"
            >
              {(['student', 'teacher', 'owner'] as const).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ClassPage() {
  return (
    <SignedIn title="Class">
      <ClassScreen />
    </SignedIn>
  );
}

/** Below this share of marks, or this long without practice, a student is flagged. */
const HELP_BELOW = 50;
const QUIET_DAYS = 7;

function needsHelp(s: Student, now: number): string | null {
  if (!s.answered) return 'Not started';
  if (s.lastActive !== null && now - s.lastActive > QUIET_DAYS * DAY)
    return `No practice for ${Math.floor((now - s.lastActive) / DAY)} days`;
  const low = SKILLS.filter((k) => {
    const p = percent(s.skills[k]);
    return p !== null && p < HELP_BELOW;
  });
  return low.length ? `Low ${low.map((k) => SKILL_META[k].label).join(', ')}` : null;
}

function ClassScreen() {
  const { id = '', classId = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const data = useLoad(() => instituteApi.students(id, classId), `${id}/${classId}`);
  const [error, setError] = useState<string | null>(null);
  if (data.error) return <Alert text={data.error} />;
  if (!data.data) return <p>Loading…</p>;
  const { class: cls, students } = data.data;
  const flagged = students
    .map((s) => ({ s, why: needsHelp(s, now) }))
    .filter((x) => x.why !== null);
  return (
    <div className="flex flex-col gap-5">
      <p>
        <Link to={`/institutes/${id}`} className="text-sm text-muted underline">
          Back to the institute
        </Link>
      </p>
      <h1 className="text-3xl font-bold">{cls.name}</h1>

      <section aria-labelledby="invite-heading" className={card}>
        <h2 id="invite-heading" className="text-xl font-semibold">
          Invite students
        </h2>
        <p>
          Class code{' '}
          <span className="font-mono text-2xl font-bold" data-testid="invite-code">
            {cls.inviteCode}
          </span>
        </p>
        <p className="break-all text-sm text-muted">
          Or share this link: {inviteLink(cls.inviteCode)}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondary}
            onClick={() => void navigator.clipboard?.writeText(inviteLink(cls.inviteCode))}
          >
            Copy link
          </button>
          <button
            type="button"
            className={secondary}
            onClick={() => {
              if (!confirm('Make a new code? The old code and link stop working.')) return;
              instituteApi.newCode(id, classId).then(
                (r) =>
                  data.setData((d) => ({
                    ...d!,
                    class: { ...d!.class, inviteCode: r.inviteCode },
                  })),
                (e: Error) => setError(e.message),
              );
            }}
          >
            New code
          </button>
        </div>
        <Roster id={id} classId={classId} onDone={data.reload} />
      </section>

      <Assignments id={id} classId={classId} students={students} />

      {flagged.length > 0 && (
        <section aria-labelledby="help-heading" className={card} data-testid="needs-help">
          <h2 id="help-heading" className="text-xl font-semibold">
            Who needs help
          </h2>
          <ul className="flex flex-col gap-1">
            {flagged.map(({ s, why }) => (
              <li key={s.id}>
                <span className="font-semibold">{displayName(s)}</span>{' '}
                <span className="text-sm text-muted">· {why}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="students-heading" className="flex flex-col gap-2">
        <h2 id="students-heading" className="text-xl font-semibold">
          Students ({students.length})
        </h2>
        <Alert text={error} />
        <div className="relative overflow-x-auto rounded-token border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Student
                </th>
                <th scope="col" className="px-3 py-2">
                  Answered
                </th>
                {SKILLS.map((k) => (
                  <th key={k} scope="col" className="px-3 py-2">
                    {SKILL_META[k].label}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2">
                  Last practice
                </th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className="px-3 py-2 font-semibold">
                    {displayName(s)}
                    <span className="block font-normal text-muted">{s.email}</span>
                  </th>
                  <td className="px-3 py-2 font-mono">{s.answered}</td>
                  {SKILLS.map((k) => {
                    const p = percent(s.skills[k]);
                    return (
                      <td key={k} className="px-3 py-2 font-mono">
                        {p === null ? '–' : `${p}%`}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {s.lastActive ? new Date(s.lastActive).toLocaleDateString() : '–'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      aria-label={`Remove ${displayName(s)} from the class`}
                      className="min-h-11 text-sm text-bad underline"
                      onClick={() => {
                        if (!confirm(`Remove ${displayName(s)} from ${cls.name}?`)) return;
                        instituteApi
                          .removeStudent(id, classId, s.id)
                          .then(data.reload, (e: Error) => setError(e.message));
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          Marks are each student’s share of marks by skill across all their practice. Speaking
          includes only answers scored by the server.
        </p>
      </section>

      <button
        type="button"
        className="min-h-11 self-start rounded-token border border-bad px-4 text-sm font-semibold text-bad"
        onClick={() => {
          if (!confirm(`Delete ${cls.name}? Students stay in the institute.`)) return;
          instituteApi.deleteClass(id, classId).then(
            () => navigate(`/institutes/${id}`),
            (e: Error) => setError(e.message),
          );
        }}
      >
        Delete class
      </button>
    </div>
  );
}

function Roster({ id, classId, onDone }: { id: string; classId: string; onDone: () => void }) {
  const textId = useId();
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <details className="flex flex-col gap-2">
      <summary className="cursor-pointer font-semibold">Add students from a list (CSV)</summary>
      <div className="mt-2 flex flex-col gap-2">
        <label htmlFor={textId} className="text-sm text-muted">
          One student per line: email, then name. Each can sign in later with an email link.
        </label>
        <textarea
          id={textId}
          rows={5}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={'asha@example.com, Asha Rai\nbinod@example.com, Binod Thapa'}
          className={`${input} py-2 font-mono text-sm`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${secondary} grid cursor-pointer place-items-center`}>
            Choose a CSV file
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => void e.target.files?.[0]?.text().then(setCsv)}
            />
          </label>
          <button
            type="button"
            disabled={!csv.trim()}
            className={primary}
            onClick={() => {
              setError(null);
              instituteApi.importRoster(id, classId, csv).then(
                (r) => {
                  setResult(
                    `Added ${r.added} (${r.newAccounts} new account${r.newAccounts === 1 ? '' : 's'}).` +
                      (r.invalid.length
                        ? ` Skipped ${r.invalid.length}: ${r.invalid.join('; ')}`
                        : ''),
                  );
                  setCsv('');
                  onDone();
                },
                (e: Error) => setError(e.message),
              );
            }}
          >
            Add students
          </button>
        </div>
        {result && <p aria-live="polite">{result}</p>}
        <Alert text={error} />
      </div>
    </details>
  );
}

/** Opening a shared invite link joins the class straight away when signed in. */
export function JoinPage() {
  return (
    <SignedIn title="Join a class">
      <Join />
    </SignedIn>
  );
}

function Join() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    instituteApi.join(code).then(
      (r) => navigate(`/institutes/${r.institute.id}`, { replace: true }),
      (e: Error) => setError(e.message),
    );
  }, [code, navigate]);
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold">Join a class</h1>
      {error ? (
        <p role="alert">
          {error}.{' '}
          <Link to="/institutes" className="underline">
            Enter a code instead
          </Link>
        </p>
      ) : (
        <p>Joining…</p>
      )}
    </div>
  );
}
