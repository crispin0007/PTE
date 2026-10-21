import { useState } from 'react';
import {
  saveRecording,
  scoreRecording,
  useAccount,
  type SpeakingScore,
} from '../practice/account.ts';
import { recordAttempt } from '../practice/history.ts';
import type { Recording } from './Recorder.tsx';
import { AskTeacher } from './AskTeacher.tsx';
import { SpeakingResult } from './SpeakingResult.tsx';

/** A teacher marks an unscored speaking answer out of 5. */
const TEACHER_MAX = 5;

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
  const [savedId, setSavedId] = useState<string | null>(null);
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
  const ask = savedId && (
    <AskTeacher
      questionId={questionId}
      type={type}
      recordingId={savedId}
      score={result?.max ? result.score : 0}
      max={result?.max || TEACHER_MAX}
    />
  );
  if (result)
    return (
      <>
        <SpeakingResult result={result} />
        {ask}
      </>
    );
  if (state === 'saved')
    return (
      <>
        <p role="status" className="text-sm text-good">
          ✓ Saved to your account. It is deleted automatically after 30 days.
        </p>
        {error && (
          <p className="text-sm text-muted">
            Not scored: {error} Use the self-check above for now.
          </p>
        )}
        {ask}
      </>
    );
  const go = async () => {
    setError('');
    setState('saving');
    try {
      const { id } = await saveRecording(recording.blob, questionId, type);
      setSavedId(id);
      if (!scoring) return setState('saved');
      setState('scoring');
      const scored = await scoreRecording(id).catch((e: Error) => {
        // Saved but not scored (daily limit, service down): the self-check above still works.
        setError(e.message);
        setState('saved');
        return null;
      });
      if (!scored) return;
      setResult(scored);
      // A server score counts in history like any other answer, so Speaking shows on Progress.
      recordAttempt({
        questionId,
        type,
        skill: 'speaking',
        score: scored.score,
        max: scored.max,
        at: Date.now(),
      });
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
            ? 'Send this recording to the openpte server to be scored. It is kept for 30 days in my account, and only I can play it unless I send it to my teacher.'
            : 'Save this recording to my account so it can be scored when speaking scores arrive. It is kept for 30 days and only I can play it unless I send it to my teacher.'}
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
