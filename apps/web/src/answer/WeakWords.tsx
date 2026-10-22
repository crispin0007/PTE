import type { WeakWord } from '@openpte/scoring';

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

/** Unclear words with the sounds that were furthest off, weakest first. */
export function WeakWords({ words }: { words: WeakWord[] }) {
  return (
    <div className="flex flex-col gap-2" data-testid="weak-words">
      <p className="font-semibold">Sounds to practise</p>
      <ul className="flex flex-col gap-1 text-sm">
        {words.slice(0, 8).map((w, i) => (
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
        Sounds are compared with a standard American English pronunciation. Other clear accents can
        score lower here and still be understood.
      </p>
    </div>
  );
}
