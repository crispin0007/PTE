import { useEffect, useState } from 'react';
import { assetUrl } from '../content/catalog.ts';
import { Section } from './parts.tsx';

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** A short beep, like the one that replaces the last word in Select Missing Word. */
export function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {
    // No Web Audio: the missing-word gap is silent.
  }
}

/**
 * Plays a question's recording. Until recordings are generated (see tools/generate_audio.py), the
 * device's own text-to-speech voice reads the script, so listening practice works offline today.
 * The script is always available as a last resort and is shown after submitting.
 */
export function Listen({
  path,
  script,
  review,
  beepAtEnd = false,
}: {
  path: string;
  script: string;
  review: boolean;
  beepAtEnd?: boolean;
}) {
  const url = assetUrl(path);
  const [speaking, setSpeaking] = useState(false);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => () => void (canSpeak() && speechSynthesis.cancel()), []);

  const speak = () => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(script);
    u.lang = 'en-GB';
    u.rate = 0.95;
    u.onend = () => {
      setSpeaking(false);
      if (beepAtEnd) beep();
    };
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    speechSynthesis.speak(u);
  };

  return (
    <Section title="Listen">
      <div className="flex flex-col gap-3 rounded-token border border-line bg-surface p-4">
        {url ? (
          <audio controls preload="metadata" src={url} className="w-full" />
        ) : canSpeak() ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  speaking ? (speechSynthesis.cancel(), setSpeaking(false)) : speak()
                }
                className="min-h-11 rounded-token bg-brand px-5 font-semibold text-brand-ink"
              >
                {speaking ? 'Stop' : 'Play audio'}
              </button>
              {speaking && <span className="text-sm text-muted">Playing…</span>}
            </div>
            <p className="text-sm text-muted">
              Recorded audio is coming soon. Until then your device’s voice reads this question.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            Recorded audio is coming soon, and this browser cannot read text aloud. Use the
            transcript instead.
          </p>
        )}
        {review ? (
          <div className="text-sm">
            <p className="font-semibold">Transcript</p>
            <p className="whitespace-pre-line text-muted">{script}</p>
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={showScript}
            onClick={() => setShowScript((s) => !s)}
            className="self-start text-sm text-muted underline"
          >
            {showScript ? 'Hide transcript' : 'Can’t listen? Show the transcript'}
          </button>
        )}
        {!review && showScript && <p className="whitespace-pre-line text-sm">{script}</p>}
      </div>
    </Section>
  );
}
