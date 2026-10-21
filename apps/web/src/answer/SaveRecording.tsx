import { useState } from 'react';
import {
  saveRecording,
  scoreRecording,
  useAccount,
  type SpeakingScore,
} from '../practice/account.ts';
import type { Recording } from './Recorder.tsx';
import { SpeakingResult } from './SpeakingResult.tsx';

/** Opt-in upload of one recording, and server scoring where available. */
export function SaveRecording({
  recording,
  questionId,
  type,
}: {
  recording: Recording;
  questionId: string;
  type: string;
}) {
  const account = useAccount();
  const [state, setState] = useState<'idle' | 'saving' | 'scoring' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<SpeakingScore | null>(null);
  if (account.status !== 'signed-in' || !account.recordings) {
    return (
      <p className="text-sm text-muted">
        Your recording stays on this device and is gone when you leave the page.
        {account.status === 'guest' &&
          ' Sign in under More to save recordings and get speaking scores.'}
      </p>
    );
  }
  const scoring = account.speechScoring;
  if (result) return <SpeakingResult result={result} />;
  if (state === 'saved')
    return (
      <p role="status" className="text-sm text-good">
        ✓ Saved to your account. It is deleted automatically after 30 days.
      </p>
    );
  const go = async () => {
    setError('');
    setState('saving');
    try {
      const { id } = await saveRecording(recording.blob, questionId, type);
      if (!scoring) return setState('saved');
      setState('scoring');
      setResult(await scoreRecording(id));
    } catch (e) {
      setError((e as Error).message);
      setState('error');
    }
  };
  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
        />
        <span>
          {scoring
            ? 'Send this recording to the openpte server to be scored. It is kept for 30 days in my account, and only I can play it.'
            : 'Save this recording to my account so it can be scored when speaking scores arrive. It is kept for 30 days and only I can play it.'}
        </span>
      </label>
      <button
        type="button"
        disabled={!consent || state === 'saving' || state === 'scoring'}
        onClick={() => void go()}
        className="min-h-11 self-start rounded-token bg-brand px-5 font-semibold text-brand-ink disabled:opacity-50"
      >
        {state === 'saving'
          ? 'Saving…'
          : state === 'scoring'
            ? 'Scoring… (up to 15 seconds)'
            : scoring
              ? 'Score my answer'
              : 'Save recording'}
      </button>
      {state === 'error' && (
        <p role="alert" className="text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
