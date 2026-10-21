import { useSyncExternalStore } from 'react';
import type { Paper } from './definitions.ts';
import type { ItemResult, Report } from './report.ts';

/**
 * Mock sittings kept on the device: the paper, how far the learner got (so a reload resumes at the
 * same question, never an earlier one) and the finished report.
 */
export type Sitting = {
  paper: Paper;
  /** Index of the next item across all sections. */
  position: number;
  /** Shared section time used by earlier items of the current section, in seconds. */
  sectionUsedS: number;
  /** When the current item appeared; null while the section's intro screen shows. */
  itemStartedAt: number | null;
  results: ItemResult[];
  report?: Report;
};

type State = { version: 1; sittings: Sitting[] };

const KEY = 'openpte-mocks';
const EMPTY: State = { version: 1, sittings: [] };
/** Older sittings are dropped so storage stays small. */
const KEEP = 20;

function load(): State {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as State | null;
    return parsed?.version === 1 && Array.isArray(parsed.sittings) ? parsed : EMPTY;
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
    // Private mode or full storage: the sitting lives for this visit only.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const useSittings = () => useSyncExternalStore(subscribe, () => state.sittings);

export const getSitting = (id: string) => state.sittings.find((s) => s.paper.id === id);

export function startSitting(paper: Paper) {
  const sitting: Sitting = {
    paper,
    position: 0,
    sectionUsedS: 0,
    itemStartedAt: null,
    results: [],
  };
  commit({ ...state, sittings: [sitting, ...state.sittings].slice(0, KEEP) });
}

export function updateSitting(id: string, patch: Partial<Sitting>) {
  commit({
    ...state,
    sittings: state.sittings.map((s) => (s.paper.id === id ? { ...s, ...patch } : s)),
  });
}

export function deleteSitting(id: string) {
  commit({ ...state, sittings: state.sittings.filter((s) => s.paper.id !== id) });
}

export const paperItems = (paper: Paper) =>
  paper.sections.flatMap((s, section) => s.items.map((item) => ({ ...item, section })));
