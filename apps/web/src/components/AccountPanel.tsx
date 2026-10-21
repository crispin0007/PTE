import { useId, useState } from 'react';
import {
  sendSignInLink,
  signInWithGoogle,
  signOut,
  syncNow,
  useAccount,
} from '../practice/account.ts';

const button = 'min-h-11 rounded-token px-5 font-semibold';

export function AccountPanel() {
  const account = useAccount();
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (account.status === 'off') {
    return (
      <p className="text-sm text-muted">
        This copy of openpte runs without a server, so there are no accounts. Your progress is saved
        in this browser.
      </p>
    );
  }
  if (account.status === 'loading') return <p className="text-sm text-muted">Checking…</p>;

  if (account.status === 'signed-in') {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p>
          Signed in as <span className="font-semibold">{account.user.email}</span>. Your answers
          sync to your account, so you can carry on from any device.
        </p>
        <p className="text-muted" aria-live="polite">
          {account.error ??
            (account.syncedAt
              ? `Last synced at ${new Date(account.syncedAt).toLocaleTimeString()}.`
              : 'Syncing…')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void syncNow()}
            className={`${button} border border-line bg-surface`}
          >
            Sync now
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className={`${button} border border-line bg-surface`}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted">
        Optional. Sign in to keep your progress on any device. Your practice so far on this device
        moves into your account.
      </p>
      {sent ? (
        <p role="status" className="rounded-token bg-good-soft px-3 py-2">
          Check {sent} for a sign-in link. It works once and expires in 15 minutes.
        </p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            sendSignInLink(email)
              .then(() => setSent(email))
              .catch((err: Error) => setError(err.message))
              .finally(() => setBusy(false));
          }}
        >
          <label htmlFor={emailId} className="flex w-full max-w-xs flex-col gap-1">
            Email
            <input
              id={emailId}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 rounded-token border border-muted bg-surface px-3"
            />
          </label>
          <button type="submit" disabled={busy} className={`${button} bg-brand text-brand-ink`}>
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
      {account.google && (
        <button
          type="button"
          onClick={() => signInWithGoogle().catch((err: Error) => setError(err.message))}
          className={`${button} self-start border border-line bg-surface`}
        >
          Continue with Google
        </button>
      )}
      {error && (
        <p role="alert" className="text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
