import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAccount } from '../practice/account.ts';

/** Admin screens are for signed-in teachers and admins. */
export function Gate({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const account = useAccount();
  if (account.status === 'loading') return <p>Loading…</p>;
  const role = account.status === 'signed-in' ? account.user.role : null;
  const allowed = adminOnly ? role === 'admin' : role === 'teacher' || role === 'admin';
  if (!allowed)
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Question bank</h1>
        <p className="text-muted">
          {account.status === 'off'
            ? 'The question bank admin needs the openpte API.'
            : adminOnly
              ? 'Only admins can see this page.'
              : 'Only teachers and admins can write and review questions.'}{' '}
          <Link to="/more" className="underline">
            Account settings
          </Link>
        </p>
      </div>
    );
  return <>{children}</>;
}
