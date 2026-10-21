import { useEffect, useRef, useState } from 'react';
import { beep } from './Listen.tsx';

type Phase = 'idle' | 'prep' | 'recording' | 'done' | 'error';

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Ready',
  prep: 'Beginning in',
  recording: 'Recording',
  done: 'Completed',
  error: 'Microphone not available',
};

/** Opus in WebM where supported (Chrome, Firefox, Edge); Safari records AAC in MP4. */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
}

export type Recording = { blob: Blob; url: string; seconds: number };

/**
 * The exam-style recording box: a preparation countdown, a beep, then recording with a time bar
 * and a live input level, stopping by itself when time is up. Audio stays on the device unless
 * the learner chooses to save it.
 */
export function Recorder({
  prepS,
  answerS,
  onRecorded,
}: {
  prepS: number;
  answerS: number;
  onRecorded: (r: Recording) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const started = useRef(0);
  const prepEnd = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef(0);

  const cleanup = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  };
  useEffect(() => cleanup, []);

  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  const record = () => {
    const s = stream.current!;
    const mimeType = pickMime();
    const rec = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' });
      const seconds = Math.round((performance.now() - started.current) / 100) / 10;
      cleanup();
      setPhase('done');
      onRecorded({ blob, url: URL.createObjectURL(blob), seconds });
    };
    recorder.current = rec;
    beep();
    started.current = performance.now();
    rec.start(250);
    setCount(0);
    setPhase('recording');

    // Input level, so learners can see the microphone hears them.
    try {
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // No level meter; recording still works.
    }
  };

  const start = async () => {
    setError('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setPhase('error');
      setError(
        'Allow microphone access in your browser to answer speaking questions. Nothing is uploaded unless you choose to save a recording.',
      );
      return;
    }
    if (prepS > 0) {
      prepEnd.current = performance.now() + prepS * 1000;
      setCount(prepS);
      setPhase('prep');
    } else record();
  };

  // One clock for both phases: counts down in prep, up while recording.
  useEffect(() => {
    if (phase !== 'prep' && phase !== 'recording') return;
    const t = setInterval(() => {
      if (phase === 'prep') {
        const left = Math.ceil((prepEnd.current - performance.now()) / 1000);
        setCount(Math.max(0, left));
        if (left <= 0) {
          clearInterval(t);
          record();
        }
      } else {
        const elapsed = (performance.now() - started.current) / 1000;
        setCount(Math.floor(elapsed));
        if (elapsed >= answerS) stop();
      }
    }, 250);
    return () => clearInterval(t);
    // record and stop only touch refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answerS]);

  const button = 'min-h-11 rounded-token px-5 font-semibold';
  return (
    <section
      aria-label="Recorder"
      data-testid="recorder"
      data-phase={phase}
      className="flex flex-col gap-3 rounded-token border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold" aria-live="polite">
          <span
            aria-hidden="true"
            className={`size-3 rounded-full ${
              phase === 'recording'
                ? 'animate-pulse bg-bad'
                : phase === 'done'
                  ? 'bg-good'
                  : 'bg-sunken ring-1 ring-muted'
            }`}
          />
          {PHASE_LABEL[phase]}
          {phase === 'prep' && <span className="font-mono">{count} s</span>}
        </p>
        <p className="font-mono text-sm text-muted">
          {phase === 'recording' ? `${count} / ${answerS} s` : `${answerS} s to answer`}
        </p>
      </div>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-sunken">
        <div
          className={`h-full rounded-full ${phase === 'recording' ? 'bg-speak' : 'bg-muted'}`}
          style={{
            width:
              phase === 'recording'
                ? `${Math.min(100, (count / answerS) * 100)}%`
                : phase === 'prep'
                  ? `${((prepS - count) / Math.max(1, prepS)) * 100}%`
                  : phase === 'done'
                    ? '100%'
                    : '0%',
          }}
        />
      </div>
      {phase === 'recording' && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>Input</span>
          <span aria-hidden="true" className="h-1.5 w-32 overflow-hidden rounded-full bg-sunken">
            <span
              className="block h-full bg-good transition-[width] duration-75"
              style={{ width: `${level * 100}%` }}
            />
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(phase === 'idle' || phase === 'error') && (
          <button
            type="button"
            onClick={() => void start()}
            className={`${button} bg-brand text-brand-ink`}
          >
            {prepS > 0 ? 'Start' : 'Start recording'}
          </button>
        )}
        {phase === 'prep' && (
          <button
            type="button"
            onClick={() => {
              setCount(0);
              record();
            }}
            className={`${button} border border-line`}
          >
            Skip preparation
          </button>
        )}
        {phase === 'recording' && (
          <button type="button" onClick={stop} className={`${button} bg-brand text-brand-ink`}>
            Finish
          </button>
        )}
      </div>
    </section>
  );
}
