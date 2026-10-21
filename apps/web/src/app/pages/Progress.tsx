import { Link } from 'react-router';
import { SKILLS } from '@openpte/schema/constants';
import { isScored } from '../../answer/registry.ts';
import { DailyChart } from '../../components/DailyChart.tsx';
import { Meter } from '../../components/Meter.tsx';
import { ScoreDisclaimer } from '../../components/ScoreDisclaimer.tsx';
import { itemTypes, questionCount } from '../../content/catalog.ts';
import { SKILL_META } from '../../content/guide.ts';
import {
  ESTIMATE_MIN,
  accuracyBy,
  dailyCounts,
  overallEstimate,
} from '../../practice/analytics.ts';
import { latestAttempts, useHistory, useNow } from '../../practice/history.ts';

const card = 'flex flex-col gap-4 rounded-token border border-line bg-surface p-5';
const pct = (a: number | null) => (a === null ? '–' : `${Math.round(a * 100)}%`);

export function Progress() {
  const { attempts, settings } = useHistory();
  const now = useNow();
  const bySkill = accuracyBy(attempts, 'skill');
  const byType = accuracyBy(attempts, 'type');
  const estimate = overallEstimate(bySkill);
  const answered = latestAttempts(attempts).size;
  const days = dailyCounts(attempts, now);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Progress</h1>

      <section aria-labelledby="estimate-heading" className={card} data-testid="estimate">
        <h2 id="estimate-heading" className="text-xl font-semibold">
          Overall practice estimate
        </h2>
        {estimate === null ? (
          <p className="text-muted">
            Answer {ESTIMATE_MIN - answered} more{' '}
            {ESTIMATE_MIN - answered === 1 ? 'question' : 'questions'} to see an estimate. Your
            target is {settings.target}.
          </p>
        ) : (
          <>
            <p>
              <span className="font-display text-5xl font-bold">{estimate}</span>
              <span className="text-muted"> on the 10–90 scale · target {settings.target}</span>
            </p>
            <div className="relative h-3 rounded-full bg-sunken" aria-hidden="true">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${((estimate - 10) / 80) * 100}%` }}
              />
              <div
                className="absolute -top-1 h-5 w-0.5 bg-ink"
                style={{ left: `${((settings.target - 10) / 80) * 100}%` }}
              />
            </div>
            <p className="text-sm text-muted">
              {estimate >= settings.target
                ? 'At or above your target in practice. Keep it steady across all skills.'
                : `${settings.target - estimate} below your target. Work on the weakest skill first.`}{' '}
              The estimate is the average share of marks you earn in each skill you have practised,
              placed on the 10–90 scale. It is a progress signal, not a prediction.
            </p>
          </>
        )}
        <ScoreDisclaimer />
      </section>

      <section aria-labelledby="trend-heading" className={card}>
        <h2 id="trend-heading" className="text-xl font-semibold">
          Last 30 days
        </h2>
        <DailyChart days={days} />
      </section>

      <section aria-labelledby="skills-heading" className={card}>
        <h2 id="skills-heading" className="text-xl font-semibold">
          Skills
        </h2>
        {SKILLS.map((s) => {
          const a = bySkill.get(s);
          const ready = itemTypes.some((t) => t.skill === s && isScored(t.id));
          return (
            <Meter
              key={s}
              label={SKILL_META[s].label}
              value={a?.accuracy ?? null}
              color={SKILL_META[s].color}
              detail={
                a
                  ? `${pct(a.accuracy)} of marks · ${a.questions} answered`
                  : ready
                    ? 'Not practised yet'
                    : 'Speaking scoring is coming'
              }
            />
          );
        })}
      </section>

      <section aria-labelledby="types-heading" className={card}>
        <h2 id="types-heading" className="text-xl font-semibold">
          By question type
        </h2>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-2 font-semibold">
                  Type
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Done
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Marks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {itemTypes
                .filter((t) => isScored(t.id))
                .map((t) => {
                  const a = byType.get(t.id);
                  return (
                    <tr key={t.id}>
                      <th scope="row" className="py-2 pr-3 font-normal">
                        <Link
                          to={`/practice/${t.id}`}
                          className="flex items-center gap-2 underline"
                        >
                          <span
                            aria-hidden="true"
                            className={`size-2.5 shrink-0 rounded-full ${SKILL_META[t.skill].color}`}
                          />
                          {t.label}
                        </Link>
                      </th>
                      <td className="py-2 pr-3 font-mono whitespace-nowrap">
                        {a?.questions ?? 0}/{questionCount(t.id)}
                      </td>
                      <td className="py-2 font-mono">{pct(a?.accuracy ?? null)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
