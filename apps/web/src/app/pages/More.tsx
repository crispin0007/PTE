import { useId } from 'react';
import { Link } from 'react-router';
import { AccountPanel } from '../../components/AccountPanel.tsx';
import { ThemeToggle } from '../../components/ThemeToggle.tsx';
import { deleteAccountHistory, useAccount } from '../../practice/account.ts';
import { clearHistory, updateSettings, useHistory } from '../../practice/history.ts';

const GOALS = [5, 10, 20, 30, 50];
const TARGETS = [36, 42, 50, 58, 65, 73, 79, 85];

export function More() {
  const { settings, attempts } = useHistory();
  const signedIn = useAccount().status === 'signed-in';
  const goalId = useId();
  const targetId = useId();
  const select = 'min-h-11 rounded-token border border-line bg-surface px-3';
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">More</h1>
      <section
        aria-labelledby="account-heading"
        className="flex flex-col gap-3 rounded-token border border-line bg-surface p-5"
      >
        <h2 id="account-heading" className="text-xl font-semibold">
          Account
        </h2>
        <AccountPanel />
      </section>
      <section
        aria-labelledby="settings-heading"
        className="flex flex-col gap-4 rounded-token border border-line bg-surface p-5"
      >
        <h2 id="settings-heading" className="text-xl font-semibold">
          Settings
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={goalId}>Daily goal</label>
          <select
            id={goalId}
            value={settings.dailyGoal}
            onChange={(e) => updateSettings({ dailyGoal: Number(e.target.value) })}
            className={select}
          >
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {g} questions a day
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={targetId}>Target score</label>
          <select
            id={targetId}
            value={settings.target}
            onChange={(e) => updateSettings({ target: Number(e.target.value) })}
            className={select}
          >
            {TARGETS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <ThemeToggle />
      </section>
      <section
        aria-labelledby="data-heading"
        className="flex flex-col gap-3 rounded-token border border-line bg-surface p-5"
      >
        <h2 id="data-heading" className="text-xl font-semibold">
          Your data
        </h2>
        <p className="text-sm text-muted">
          Your answers are stored in this browser ({attempts.length} so far), and in your account
          only if you sign in. Nothing else is sent anywhere.
        </p>
        <button
          type="button"
          disabled={!attempts.length}
          onClick={() => {
            const where = signedIn ? 'on this device and in your account' : 'on this device';
            if (!confirm(`Delete your practice history ${where}? This cannot be undone.`)) return;
            if (signedIn)
              deleteAccountHistory()
                .then(clearHistory)
                .catch((e: Error) => alert(e.message));
            else clearHistory();
          }}
          className="min-h-11 self-start rounded-token border border-bad px-4 text-sm font-semibold text-bad disabled:opacity-40"
        >
          Delete practice history
        </button>
      </section>
      <ul className="flex flex-col divide-y divide-line rounded-token border border-line bg-surface">
        <li>
          <Link to="/about" className="flex min-h-12 items-center px-5 font-semibold">
            About, licences and trademark
          </Link>
        </li>
        <li>
          <a
            href="https://github.com/crispin0007/PTE"
            className="flex min-h-12 items-center px-5 font-semibold"
          >
            Source code on GitHub
          </a>
        </li>
      </ul>
    </div>
  );
}
