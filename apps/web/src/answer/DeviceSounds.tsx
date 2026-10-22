import { useEffect, useState } from 'react';
import { assessSounds, softmaxFrames, soundsTrait, words, type Trait } from '@openpte/scoring';
import type { WeakWord } from '@openpte/scoring';
import { ScoreDisclaimer } from '../components/ScoreDisclaimer.tsx';
import { useAccount } from '../practice/account.ts';
import type { Recording } from './Recorder.tsx';
import type { SoundsReply, SoundsRequest } from './sounds.worker.ts';
import { WeakWords } from './WeakWords.tsx';

/** Where the app serves the in-browser phoneme model (exported by the speech service). */
const MODEL_URL = (() => {
  const u = import.meta.env.VITE_PHONEME_MODEL_URL || `${import.meta.env.BASE_URL}phonemes/`;
  // Absolute, because the worker resolves relative URLs against its own script.
  return new URL(u.endsWith('/') ? u : `${u}/`, document.baseURI).href;
})();

type ModelInfo = { vocab: Record<string, number>; blank: number; normalize: boolean; mb: number };
type Checked = { trait: Trait; weakWords: WeakWord[] };

let info: Promise<ModelInfo | null> | null = null;
/** The model's vocabulary, or null when this server does not offer the model. */
function modelInfo() {
  info ??= (async () => {
    try {
      const res = await fetch(`${MODEL_URL}phonemes.json`);
      if (!res.ok) return null;
      const j = (await res.json()) as Omit<ModelInfo, 'mb'> & { bytes?: number };
      if (!j.vocab) return null;
      return { ...j, mb: Math.round((j.bytes ?? 330e6) / 1e6) };
    } catch {
      return null; // an HTML fallback page, offline, or no such folder
    }
  })();
  return info;
}

async function phonesFor(questionId: string, text: string): Promise<string[] | null> {
  const all = (await import('virtual:openpte/phones')).default;
  const phones = all[questionId];
  return phones && phones.length === words(text).length ? phones : null;
}

async function decode(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16_000 });
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    return buf.getChannelData(0).slice();
  } finally {
    void ctx.close();
  }
}

function runModel(audio: Float32Array, normalize: boolean, onProgress: (pct: number) => void) {
  return new Promise<Extract<SoundsReply, { type: 'logits' }>>((resolve, reject) => {
    const worker = new Worker(new URL('./sounds.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<SoundsReply>) => {
      const m = e.data;
      if (m.type === 'progress') return onProgress(m.total ? m.loaded / m.total : 0);
      worker.terminate();
      if (m.type === 'logits') resolve(m);
      else reject(new Error(m.message));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'the check stopped'));
    };
    const req: SoundsRequest = { modelUrl: MODEL_URL, audio, normalize };
    worker.postMessage(req, [audio.buffer]);
  });
}

/**
 * Pronunciation checked on the learner's device, when the server cannot score: the recording
 * never leaves the browser. Offered for Read Aloud and Repeat Sentence, whose words are known.
 */
export function DeviceSounds({
  recording,
  questionId,
  text,
}: {
  recording: Recording;
  questionId: string;
  text: string;
}) {
  const [ready, setReady] = useState<{ model: ModelInfo; phones: string[] } | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'running' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Checked | null>(null);
  const account = useAccount();
  const server = account.status === 'signed-in' && account.speechScoring;

  useEffect(() => {
    let live = true;
    void Promise.all([modelInfo(), phonesFor(questionId, text)]).then(([model, phones]) => {
      if (live && model && phones) setReady({ model, phones });
    });
    return () => {
      live = false;
    };
  }, [questionId, text]);

  // With server scoring, the server checks the same sounds (and content and fluency too).
  if (!ready || server) return null;
  const check = async () => {
    setError('');
    setState('loading');
    try {
      const audio = await decode(recording.blob);
      const out = await runModel(audio, ready.model.normalize, (p) => {
        setProgress(p);
        if (p >= 1) setState('running');
      });
      setState('running');
      const probs = softmaxFrames(out.logits, out.frames, out.size);
      const report = assessSounds(
        probs,
        { vocab: ready.model.vocab, blank: ready.model.blank, engine: 'device' },
        words(text),
        ready.phones,
      );
      const scored = soundsTrait(report);
      if (!scored)
        throw new Error(
          'the recording is too short for all the words. Read the whole text, then try again.',
        );
      setResult(scored);
      setState('idle');
    } catch (e) {
      setError((e as Error).message);
      setState('error');
    }
  };

  if (result)
    return (
      <section
        aria-labelledby="device-sounds"
        data-testid="device-sounds"
        className="flex flex-col gap-3 rounded-token border border-line p-4"
      >
        <h3 id="device-sounds" className="font-semibold">
          Pronunciation, checked on this device: {result.trait.score} / {result.trait.max}
        </h3>
        <p className="text-sm text-muted">
          {result.trait.note}. Words you left out also show as unclear.
        </p>
        {result.weakWords.length > 0 && <WeakWords words={result.weakWords} />}
        <ScoreDisclaimer />
      </section>
    );
  const busy = state === 'loading' || state === 'running';
  return (
    <div className="flex flex-col gap-2 text-sm">
      <button
        type="button"
        disabled={busy}
        onClick={() => void check()}
        className="min-h-11 self-start rounded-token border border-brand px-4 font-semibold text-brand disabled:opacity-50"
      >
        {state === 'loading'
          ? progress > 0 && progress < 1
            ? `Downloading the model… ${Math.round(progress * 100)}%`
            : 'Starting…'
          : state === 'running'
            ? 'Checking your sounds…'
            : 'Check my pronunciation on this device'}
      </button>
      <p className="text-muted">
        Your recording stays on this device. The first check downloads a {ready.model.mb} MB model,
        which your browser keeps; it works best on a laptop or desktop.
      </p>
      {state === 'error' && (
        <p role="alert" className="text-bad">
          Could not check: {error}
        </p>
      )}
    </div>
  );
}
