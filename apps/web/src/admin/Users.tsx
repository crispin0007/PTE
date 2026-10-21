import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { adminApi } from './api.ts';
import { Gate } from './Gate.tsx';

function UserList() {
  const [users, setUsers] = useState<{ id: string; email: string; role: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminApi.users().then(
      (r) => setUsers(r.users),
      (e: Error) => setError(e.message),
    );
  }, []);
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link to="/admin" className="text-sm text-muted underline">
          Question bank
        </Link>
      </p>
      <h1 className="text-3xl font-bold">People and roles</h1>
      <p className="text-sm text-muted">
        Teachers can write and review questions. Admins can also edit anyone’s questions and set
        roles.
      </p>
      {error && <p role="alert">{error}</p>}
      {users && (
        <ul className="flex flex-col divide-y divide-line rounded-token border border-line bg-surface">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span>{u.email}</span>
              <select
                aria-label={`Role for ${u.email}`}
                value={u.role}
                onChange={(e) => {
                  const role = e.target.value;
                  adminApi.setRole(u.id, role).then(
                    () =>
                      setUsers((list) => list!.map((x) => (x.id === u.id ? { ...x, role } : x))),
                    (err: Error) => setError(err.message),
                  );
                }}
                className="min-h-11 rounded-token border border-line bg-surface px-3"
              >
                <option value="learner">Learner</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Users() {
  return (
    <Gate adminOnly>
      <UserList />
    </Gate>
  );
}
