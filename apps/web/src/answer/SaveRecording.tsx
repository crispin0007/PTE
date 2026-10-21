import { useState } from 'react';
import { saveRecording, useAccount } from '../practice/account.ts';
import type { Recording } from './Recorder.tsx';

/** Opt-in upload of one recording. Nothing is uploaded unless the learner asks. */
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
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [consent, setConsent] = useState(false);
  if (account.status !== 'signed-in' || !account.recordings) {
    return (
      <p className="text-sm text-muted">
        Your recording stays on this device and is gone when you leave the page.
      </p>
    );
  }
  if (state === 'saved')
    return (
      <p role="status" className="text-sm text-good">
        ✓ Saved to your account. It is deleted automatically after 30 days.
      </p>
    );
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
          Save this recording to my account so it can be scored when speaking scores arrive. It is
          kept for 30 days and only I can play it.
        </span>
      </label>
      <button
        type="button"
        disabled={!consent || state === 'saving'}
        onClick={() => {
          setState('saving');
          saveRecording(recording.blob, questionId, type).then(
            () => setState('saved'),
            () => setState('error'),
          );
        }}
        className="min-h-11 self-start rounded-token border border-line bg-surface px-4 font-semibold disabled:opacity-50"
      >
        {state === 'saving' ? 'Saving…' : 'Save recording'}
      </button>
      {state === 'error' && (
        <p role="alert" className="text-bad">
          Could not save the recording. Try again.
        </p>
      )}
    </div>
  );
}
