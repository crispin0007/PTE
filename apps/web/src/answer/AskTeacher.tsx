import { useState } from 'react';
import { useAccount } from '../practice/account.ts';
import { useBranding } from '../practice/branding.ts';

type Props = {
  questionId: string;
  type: string;
  answerText?: string;
  recordingId?: string;
  score: number;
  max: number;
};

/** Sends a Writing or Speaking answer to the learner's institute for a teacher to mark. */
export function AskTeacher(props: Props) {
  const account = useAccount();
  const brand = useBranding();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  if (account.status !== 'signed-in' || !brand) return null;
  const send = async () => {
    setState('sending');
    try {
      const { instituteApi } = await import('../institute/api.ts');
      await instituteApi.askTeacher({ instituteId: brand.id, ...props });
      setState('sent');
    } catch (e) {
      setError((e as Error).message);
      setState('error');
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {state === 'sent' ? (
        <p role="status" className="text-good">
          Sent to your teachers at {brand.name}. Their mark appears on Today.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void send()}
          disabled={state === 'sending'}
          className="min-h-11 rounded-token border border-line bg-surface px-4 font-semibold disabled:opacity-60"
        >
          {state === 'sending'
            ? 'Sending…'
            : props.recordingId
              ? 'Ask my teacher to mark this (they can play the recording)'
              : 'Ask my teacher to mark this'}
        </button>
      )}
      {state === 'error' && (
        <p role="alert" className="text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
