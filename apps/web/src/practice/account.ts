import { useSyncExternalStore } from 'react';
import { API_URL } from '../content/catalog.ts';
import { clientIdOf, mergeRemote, onHistoryChange, snapshot, type Attempt } from './history.ts';

export type User = { id: string; name: string; email: string; role: string };
export type AccountState =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'guest'; google: boolean }
  | {
      status: 'signed-in';
      user: User;
      google: boolean;
      /** Whether the server can store speaking recordings. */
      recordings: boolean;
      syncedAt: number | null;
      error?: string;
    };

let account: AccountState = API_URL ? { status: 'loading' } : { status: 'off' };
const listeners = new Set<() => void>();
const set = (next: AccountState) => {
  account = next;
  listeners.forEach((l) => l());
};

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => account,
  );
}

const api = (path: string, init?: RequestInit) =>
  fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });

/** Where sign-in returns to: this page's More screen. */
const callbackURL = () => `${location.origin}${location.pathname}#/more`;

export async function sendSignInLink(email: string): Promise<void> {
  const res = await api('/api/auth/sign-in/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email, callbackURL: callbackURL() }),
  });
  if (!res.ok) throw new Error('Could not send the link. Check the address and try again.');
}

export async function signInWithGoogle(): Promise<void> {
  const res = await api('/api/auth/sign-in/social', {
    method: 'POST',
    body: JSON.stringify({ provider: 'google', callbackURL: callbackURL() }),
  });
  const body = (await res.json()) as { url?: string };
  if (!res.ok || !body.url) throw new Error('Google sign-in is not available right now.');
  location.href = body.url;
}

/** Saves a speaking recording to the account, kept for 30 days. */
export async function saveRecording(blob: Blob, questionId: string, type: string) {
  const res = await fetch(
    `${API_URL}/v1/me/recordings?questionId=${encodeURIComponent(questionId)}&type=${type}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': blob.type.split(';')[0] || 'audio/webm' },
      body: blob,
    },
  );
  if (!res.ok) throw new Error('Could not save the recording.');
  return (await res.json()) as { id: string; expiresAt: number };
}

export async function signOut(): Promise<void> {
  await api('/api/auth/sign-out', { method: 'POST', body: '{}' });
  if (account.status === 'signed-in') set({ status: 'guest', google: account.google });
}

/** Attempts the server is known to have, so each sync only uploads what is new. */
const uploaded = new Set<string>();

/** Deletes the account's copy of the history; the caller clears this device. */
export async function deleteAccountHistory(): Promise<void> {
  if (account.status !== 'signed-in') return;
  const res = await api('/v1/me/attempts', { method: 'DELETE' });
  if (!res.ok) throw new Error('Could not delete the history in your account.');
  uploaded.clear();
}

let syncing: Promise<void> | null = null;

/**
 * Two-way sync: uploads attempts made on this device (the server ignores ones it has), then
 * downloads the account's attempts and bookmarks and merges in what is missing here.
 */
export function syncNow(): Promise<void> {
  syncing ??= (async () => {
    if (account.status !== 'signed-in') return;
    const current = account;
    try {
      const pending = snapshot().attempts.filter((a) => !uploaded.has(clientIdOf(a)));
      for (let i = 0; i < pending.length; i += 1000) {
        const batch = pending.slice(i, i + 1000);
        const up = await api('/v1/me/attempts', {
          method: 'POST',
          body: JSON.stringify({
            attempts: batch.map((a) => ({
              clientId: clientIdOf(a),
              questionId: a.questionId,
              type: a.type,
              skill: a.skill,
              score: a.score,
              max: a.max,
              at: a.at,
            })),
          }),
        });
        if (!up.ok) throw new Error(`upload failed (${up.status})`);
        batch.forEach((a) => uploaded.add(clientIdOf(a)));
      }
      const [down, state] = await Promise.all([api('/v1/me/attempts'), api('/v1/me/state')]);
      const remote = (await down.json()) as { attempts: Attempt[] };
      const remoteState = (await state.json()) as { bookmarks: string[] };
      remote.attempts.forEach((a) => uploaded.add(clientIdOf(a)));
      mergeRemote(remote.attempts, remoteState.bookmarks);
      const merged = snapshot();
      await api('/v1/me/state', {
        method: 'PUT',
        body: JSON.stringify({ bookmarks: merged.bookmarks, settings: merged.settings }),
      });
      set({ ...current, syncedAt: Date.now(), error: undefined });
    } catch {
      set({ ...current, error: 'Sync failed. Your answers are safe on this device.' });
    }
  })().finally(() => (syncing = null));
  return syncing;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Reads the session once at start-up and keeps the account in sync after each change. */
export async function startAccount() {
  if (!API_URL) return;
  try {
    const config = (await (await api('/v1/auth/config')).json()) as {
      accounts: boolean;
      google: boolean;
      recordings?: boolean;
    };
    if (!config.accounts) return set({ status: 'off' });
    const me = await api('/v1/me');
    if (!me.ok) return set({ status: 'guest', google: config.google });
    set({
      status: 'signed-in',
      user: (await me.json()) as User,
      google: config.google,
      recordings: !!config.recordings,
      syncedAt: null,
    });
    await syncNow();
  } catch {
    set({ status: 'off' });
  }
  onHistoryChange(() => {
    if (account.status !== 'signed-in' || syncing) return;
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 1500);
  });
}
