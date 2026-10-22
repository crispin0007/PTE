import { ScoreDisclaimer } from '../components/ScoreDisclaimer.tsx';
import type { SpeakingScore } from '../practice/account.ts';
import { WeakWords } from './WeakWords.tsx';

const WORD_CLASS = {
  said: 'bg-good-soft border-good',
  missed: 'bg-bad-soft border-bad line-through',
  changed: 'bg-warn-bg border-listen',
} as const;

/** Server speaking score: traits, the reference marked word by word, key points and pace. */
export function SpeakingResult({ result }: { result: SpeakingScore }) {
  const f = result.fluency;
  return (
    <section
      aria-labelledby="speaking-score"
      data-testid="speaking-result"
      className="flex flex-col gap-4 rounded-token border border-line bg-surface p-5"
    >
      <h2 id="speaking-score" className="text-sm font-semibold uppercase tracking-wide text-muted">
        Your score
      </h2>
      <p className="font-display text-5xl font-bold">
        {result.score}
        <span className="text-2xl text-muted"> / {result.max}</span>
      </p>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Score by trait</caption>
        <tbody className="divide-y divide-line">
          {result.traits.map((t) => (
            <tr key={t.name}>
              <th scope="row" className="py-1.5 pr-3 font-semibold">
                {t.name}
              </th>
              <td className="py-1.5 pr-3 font-mono whitespace-nowrap">
                {t.scored ? `${t.score} / ${t.max}` : '–'}
              </td>
              <td className="py-1.5 text-muted">{t.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.marks && (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Word by word</p>
          <p className="flex flex-wrap gap-1.5 leading-relaxed">
            {result.marks.map((m, i) => (
              <span key={i} className={`rounded border px-1.5 ${WORD_CLASS[m.status]}`}>
                <span className="sr-only">
                  {m.status === 'said'
                    ? 'said: '
                    : m.status === 'missed'
                      ? 'missed: '
                      : 'changed: '}
                </span>
                {m.word}
                {m.status === 'changed' && m.heard && (
                  <span className="text-xs text-muted"> (heard “{m.heard}”)</span>
                )}
              </span>
            ))}
          </p>
          <p className="text-xs text-muted">
            Green: said. Struck through: missed. Yellow: said differently.
          </p>
        </div>
      )}
      {!!result.weakWords?.length && <WeakWords words={result.weakWords} />}
      {result.points && (
        <ul className="flex flex-col gap-1 text-sm">
          {result.points.map((p) => (
            <li key={p.point} className={p.covered ? 'text-good' : 'text-bad'}>
              {p.covered ? '✓' : '✕'} <span className="text-ink">{p.point}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">
        Pace {f.wordsPerMinute} words a minute · {f.longPauses} long pause
        {f.longPauses === 1 ? '' : 's'} · {f.fillers} filler{f.fillers === 1 ? '' : 's'} · started
        after {f.lead} s
        {f.lead > 3 ? ' (in the real test the microphone closes after 3 s of silence)' : ''}
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">What we heard</summary>
        <p className="mt-2">
          {result.transcript.map((w) => w.word).join(' ') || '(no speech found)'}
        </p>
      </details>
      <ScoreDisclaimer />
    </section>
  );
}
