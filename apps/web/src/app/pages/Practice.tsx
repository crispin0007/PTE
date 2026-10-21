import { Link, useSearchParams } from 'react-router';
import { SKILLS } from '@openpte/schema/constants';
import type { Skill } from '@openpte/schema';
import { itemTypes, questionCount } from '../../content/catalog.ts';
import { SKILL_META, TYPE_GUIDE } from '../../content/guide.ts';
import { latestAttempts, useHistory } from '../../practice/history.ts';

function isSkill(s: string | null): s is Skill {
  return (SKILLS as readonly string[]).includes(s ?? '');
}

export function Practice() {
  const [params] = useSearchParams();
  const raw = params.get('skill');
  const current = isSkill(raw) ? raw : null;
  const { attempts } = useHistory();
  const latest = latestAttempts(attempts);
  const doneByType = new Map<string, number>();
  for (const a of latest.values()) doneByType.set(a.type, (doneByType.get(a.type) ?? 0) + 1);

  const skills = current ? [current] : SKILLS;
  const tabs: { key: Skill | null; label: string }[] = [
    { key: null, label: 'All' },
    ...SKILLS.map((s) => ({ key: s, label: SKILL_META[s].label })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Practice by question type</h1>
        <Link
          to="/mock"
          className="grid min-h-11 place-items-center rounded-token border border-line bg-surface px-4 font-semibold"
        >
          Mock tests
        </Link>
      </div>
      <nav aria-label="Skills" className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <Link
              key={t.label}
              to={t.key ? `/practice?skill=${t.key}` : '/practice'}
              aria-current={t.key === current ? 'page' : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-semibold ${
                t.key === current
                  ? 'border-ink bg-ink text-bg'
                  : 'border-line bg-surface text-ink hover:border-muted'
              }`}
            >
              {t.key && (
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-full ${SKILL_META[t.key].color}`}
                />
              )}
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
      {skills.map((skill) => {
        const types = itemTypes.filter((t) => t.skill === skill);
        return (
          <section key={skill} aria-labelledby={`skill-${skill}`} className="flex flex-col gap-3">
            <h2 id={`skill-${skill}`} className="flex items-center gap-2 text-xl font-semibold">
              <span aria-hidden="true" className={`h-5 w-1.5 rounded ${SKILL_META[skill].color}`} />
              {SKILL_META[skill].label}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {types.map((t) => {
                const total = questionCount(t.id);
                const done = doneByType.get(t.id) ?? 0;
                const guide = TYPE_GUIDE[t.id];
                return (
                  <li key={t.id}>
                    <Link
                      to={`/practice/${t.id}`}
                      className="flex h-full flex-col gap-2 rounded-token border border-line bg-surface p-4 hover:border-brand"
                      data-testid="type-card"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-semibold">{t.label}</span>
                        <span className="rounded bg-sunken px-1.5 py-0.5 font-mono text-xs text-muted">
                          {guide.code}
                        </span>
                      </span>
                      <span className="text-sm text-muted">{guide.tip}</span>
                      <span className="mt-auto flex items-center gap-2 pt-1 text-sm text-muted">
                        <span
                          aria-hidden="true"
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken"
                        >
                          <span
                            className={`block h-full ${SKILL_META[skill].color}`}
                            style={{ width: total ? `${(done / total) * 100}%` : 0 }}
                          />
                        </span>
                        {done} of {total} done
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
