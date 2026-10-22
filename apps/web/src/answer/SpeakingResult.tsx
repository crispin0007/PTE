import { ScoreDisclaimer } from '../components/ScoreDisclaimer.tsx';
import type { SpeakingScore } from '../practice/account.ts';

const WORD_CLASS = {
  said: 'bg-good-soft border-good',
  missed: 'bg-bad-soft border-bad line-through',
  changed: 'bg-warn-bg border-listen',
} as const;

/** A familiar word for the IPA sounds learners most often find hard. */
const SOUND_HINT: Record<string, string> = {
  ɹ: 'r in red',
  θ: 'th in think',
  ð: 'th in this',
  ʃ: 'sh in ship',
  ʒ: 's in measure',
  tʃ: 'ch in chip',
  dʒ: 'j in jam',
  ŋ: 'ng in sing',
  v: 'v in van',
  w: 'w in wet',
  z: 'z in zoo',
  l: 'l in leg',
  ɾ: 't in water',
  æ: 'a in cat',
  ɛ: 'e in bed',
  ɪ: 'i in sit',
  iː: 'ee in see',
  i: 'y in happy',
  ʊ: 'oo in book',
  uː: 'oo in food',
  ʌ: 'u in cup',
  ə: 'a in about',
  ɚ: 'er in butter',
  ɜː: 'ir in bird',
  ɑː: 'a in father',
  ɔː: 'aw in saw',
  eɪ: 'ay in day',
  aɪ: 'i in time',
  oʊ: 'o in go',
  aʊ: 'ow in now',
  ɔɪ: 'oy in boy',
};

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
      {!!result.weakWords?.length && (
        <div className="flex flex-col gap-2" data-testid="weak-words">
          <p className="font-semibold">Sounds to practise</p>
          <ul className="flex flex-col gap-1 text-sm">
            {result.weakWords.slice(0, 8).map((w, i) => (
              <li key={i}>
                <span className="font-semibold">{w.word}</span>{' '}
                <span className="text-muted">
                  {w.score}% clear
                  {w.sounds.length ? ` · unclear sound${w.sounds.length === 1 ? '' : 's'} ` : ''}
                </span>
                {w.sounds.map((s, j) => (
                  <span key={j} className="mr-2">
                    <span lang="und-fonipa" className="font-mono">
                      /{s}/
                    </span>
                    {SOUND_HINT[s] && <span className="text-muted"> ({SOUND_HINT[s]})</span>}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Sounds are compared with a standard American English pronunciation. Other clear accents
            can score lower here and still be understood.
          </p>
        </div>
      )}
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
