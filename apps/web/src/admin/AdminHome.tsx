import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { itemTypes } from '../content/catalog.ts';
import { typeLabel } from '../content/labels.ts';
import { useAccount } from '../practice/account.ts';
import { adminApi, type Summary } from './api.ts';
import { Gate } from './Gate.tsx';

const TABS = [
  { key: 'in_review', label: 'In review' },
  { key: 'draft', label: 'Drafts' },
  { key: 'published', label: 'Published' },
] as const;

export const STATUS_LABEL: Record<Summary['status'], string> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
};

function List() {
  const [params, setParams] = useSearchParams();
  const status = TABS.find((t) => t.key === params.get('status'))?.key ?? 'in_review';
  const [rows, setRows] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<string>(itemTypes[0]!.id);
  const navigate = useNavigate();
  const account = useAccount();
  const isAdmin = account.status === 'signed-in' && account.user.role === 'admin';

  useEffect(() => {
    let live = true;
    adminApi.list(status).then(
      (r) => live && (setRows(r.questions), setError(null)),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [status]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Question bank</h1>
        {isAdmin && (
          <Link to="/admin/users" className="text-sm underline">
            People and roles
          </Link>
        )}
      </div>
      <form
        className="flex flex-wrap items-end gap-2 rounded-token border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate(`/admin/new/${type}`);
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          New question of type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="min-h-11 rounded-token border border-line bg-surface px-3"
          >
            {itemTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-token bg-brand px-5 font-semibold text-brand-ink"
        >
          Write a question
        </button>
      </form>
      <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={status === t.key}
            onClick={() => setParams({ status: t.key }, { replace: true })}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              status === t.key ? 'border-ink bg-ink text-bg' : 'border-line bg-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {!rows && !error && <p>Loading…</p>}
      {rows?.length === 0 && <p className="text-muted">Nothing here.</p>}
      {rows && rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-token border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/admin/q/${r.id}`}
                className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-sunken"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{typeLabel(r.type)}</span>
                  <span className="font-mono text-xs text-muted">
                    {r.id} · by {r.author}
                  </span>
                </span>
                <span className="text-sm text-muted">
                  {r.status === 'in_review'
                    ? `${r.approvals} of 2 approvals${r.changes ? ` · ${r.changes} asked for changes` : ''}`
                    : STATUS_LABEL[r.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminHome() {
  return (
    <Gate>
      <List />
    </Gate>
  );
}
