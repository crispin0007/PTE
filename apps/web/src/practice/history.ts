import { useState, useSyncExternalStore } from 'react';

/**
 * A guest's practice history, kept on the device. One record per answered question (the latest
 * attempt wins) plus bookmarks. When accounts arrive (step 1.9) this syncs to the API; the shape
 * stays the same so the screens do not change.
 */
export type Attempt = {
  questionId: string;
  type: string;
  skill: string;
  score: number;
  max: number;
  /** Epoch milliseconds. */
  at: number;
};

export type Settings = {
  /** Questions per day. */
  dailyGoal: number;
  /** The overall score the learner is aiming for, on the 10-90 scale. */
  target: number;
};

export const DEFAULT_SETTINGS: Settings = { dailyGoal: 20, target: 65 };

type State = {
  version: 1;
  attempts: Attempt[];
  bookmarks: string[];
  settings: Settings;
};

const KEY = 'openpte-history';
const EMPTY: State = { version: 1, attempts: [], bookmarks: [], settings: DEFAULT_SETTINGS };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<State>;
    if (parsed.version !== 1) return EMPTY;
    return {
      version: 1,
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    };
  } catch {
    return EMPTY;
  }
}

let state: State = typeof localStorage === 'undefined' ? EMPTY : load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: history lives for this visit only.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = load();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useHistory(): State {
  return useSyncExternalStore(subscribe, () => state);
}

export function recordAttempt(a: Attempt) {
  commit({ ...state, attempts: [...state.attempts, a] });
}

export function toggleBookmark(questionId: string) {
  const has = state.bookmarks.includes(questionId);
  commit({
    ...state,
    bookmarks: has
      ? state.bookmarks.filter((b) => b !== questionId)
      : [...state.bookmarks, questionId],
  });
}

export function updateSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

/** Removes attempts and bookmarks but keeps settings. */
export function clearHistory() {
  commit({ ...EMPTY, settings: state.settings });
}

export type QuestionStatus = 'new' | 'right' | 'partial' | 'wrong';

/** Status of a question from its latest attempt. */
export function latestAttempts(attempts: Attempt[]): Map<string, Attempt> {
  const latest = new Map<string, Attempt>();
  for (const a of attempts) {
    const prev = latest.get(a.questionId);
    if (!prev || prev.at <= a.at) latest.set(a.questionId, a);
  }
  return latest;
}

export function statusOf(a: Attempt | undefined): QuestionStatus {
  if (!a) return 'new';
  if (a.max > 0 && a.score >= a.max) return 'right';
  if (a.score > 0) return 'partial';
  return 'wrong';
}

/** The time the screen was opened, fixed for the render so the page stays pure. */
export function useNow(): number {
  const [now] = useState(Date.now);
  return now;
}
