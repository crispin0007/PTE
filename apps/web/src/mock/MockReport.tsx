import { Link, useParams } from 'react-router';
import { NotFound } from '../app/pages/NotFound.tsx';
import { Meter } from '../components/Meter.tsx';
import { ScoreDisclaimer } from '../components/ScoreDisclaimer.tsx';
import { getType } from '../content/catalog.ts';
import { SKILL_META, TYPE_GUIDE } from '../content/guide.ts';
import { useSittings } from './store.ts';

const pct = (score: number, max: number) => (max ? Math.round((score / max) * 100) : 0);

export function MockReport() {
  const { id = '' } = useParams();
  const sitting = useSittings().find((s) => s.paper.id === id);
  const report = sitting?.report;
  if (!report) return <NotFound />;
  const skipped = report.results.filter((r) => r.skipped).length;

  return (
    <article className="flex flex-col gap-6" data-testid="mock-report">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Score report</p>
          <h1 className="text-2xl font-bold">{report.label}</h1>
          <p className="text-sm text-muted">
            {new Date(report.finishedAt).toLocaleString()} · {report.results.length} questions
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 rounded-token border border-line bg-surface px-4 font-semibold print:hidden"
        >
          Print or save as PDF
        </button>
      </div>

      <section
        aria-labelledby="overall-heading"
        className="flex flex-col gap-4 rounded-token border border-line bg-surface p-5"
      >
        <h2
          id="overall-heading"
          className="text-sm font-semibold uppercase tracking-wide text-muted"
        >
          Overall estimate
        </h2>
        <p className="font-display text-6xl font-bold" data-testid="mock-overall">
          {report.overall ?? '–'}
          <span className="text-2xl text-muted"> / 90</span>
        </p>
        <div className="flex flex-col gap-3">
          {report.skills.map((s) => (
            <Meter
              key={s.skill}
              label={SKILL_META[s.skill].label}
              color={SKILL_META[s.skill].color}
              value={s.score === null ? null : (s.score - 10) / 80}
              detail={
                s.score === null
                  ? 'Not scored in this mock'
                  : `${s.score} / 90 from ${s.items} question${s.items === 1 ? '' : 's'}`
              }
            />
          ))}
        </div>
        <ScoreDisclaimer />
        <p className="text-sm text-muted">
          Each skill is your share of marks on the questions that count towards it, placed on the 10
          to 90 scale. Many question types count for two skills, as in the real test.
          {report.unscored > 0 &&
            ` ${report.unscored} Speaking answer${report.unscored === 1 ? ' was' : 's were'} recorded but not scored, so Speaking is left out of the overall.`}
          {skipped > 0 &&
            ` ${skipped} question${skipped === 1 ? ' was' : 's were'} not reached in time and scored zero.`}
        </p>
      </section>

      {report.weakest.length > 0 && (
        <section aria-labelledby="weak-heading" className="flex flex-col gap-2">
          <h2 id="weak-heading" className="text-lg font-semibold">
            Practise next
          </h2>
          <ul className="flex flex-col gap-2">
            {report.weakest.map((t) => (
              <li key={t} className="rounded-token border border-line bg-surface p-4">
                <Link to={`/practice/${t}`} className="font-semibold underline">
                  {getType(t)?.label ?? t}
                </Link>
                <p className="text-sm text-muted">{TYPE_GUIDE[t].tip}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="types-heading" className="flex flex-col gap-2">
        <h2 id="types-heading" className="text-lg font-semibold">
          By question type
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3">
                  Type
                </th>
                <th scope="col" className="py-2 pr-3">
                  Questions
                </th>
                <th scope="col" className="py-2 pr-3">
                  Marks
                </th>
                <th scope="col" className="py-2">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {report.types.map((t) => (
                <tr key={t.type}>
                  <th scope="row" className="py-2 pr-3 font-semibold">
                    {getType(t.type)?.label ?? t.type}
                  </th>
                  <td className="py-2 pr-3">{t.items}</td>
                  <td className="py-2 pr-3 font-mono whitespace-nowrap">
                    {t.score} / {t.max}
                  </td>
                  <td className="py-2 font-mono">{pct(t.score, t.max)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="flex flex-wrap gap-3 print:hidden">
        <Link
          to="/mock"
          className="grid min-h-11 place-items-center rounded-token bg-brand px-5 font-semibold text-brand-ink"
        >
          Back to mock tests
        </Link>
        <Link
          to="/progress"
          className="grid min-h-11 place-items-center rounded-token border border-line bg-surface px-5 font-semibold"
        >
          See progress
        </Link>
      </p>
    </article>
  );
}
