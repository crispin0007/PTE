import { useSyncExternalStore } from 'react';
import { API_URL } from '../content/catalog.ts';

export type Branding = { id: string; name: string; logoUrl: string | null; color: string | null };
type Inst = { id: string; name: string; brandColor: string | null; logoVersion: number | null };

const KEY = 'openpte-institute';
let current: Branding | null = null;
const listeners = new Set<() => void>();

export const useBranding = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => current,
  );

/**
 * Redefines the brand tokens for an institute's colour. Light mode uses the colour itself (checked
 * for 4.5:1 when saved); dark mode lifts it towards white so it stays readable on dark surfaces.
 */
function paint(color: string | null) {
  document.getElementById('institute-brand')?.remove();
  if (!color) return;
  const light = `--brand: ${color}; --brand-ink: #ffffff; --brand-soft: color-mix(in oklab, ${color} 14%, white);`;
  const dark = `--brand: color-mix(in oklab, ${color} 50%, white); --brand-ink: #0e131e; --brand-soft: color-mix(in oklab, ${color} 30%, #0e131e);`;
  const style = document.createElement('style');
  style.id = 'institute-brand';
  style.textContent = `:root { ${light} }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${dark} } }
:root[data-theme='dark'] { ${dark} }`;
  document.head.append(style);
}

/** Shows the chosen institute's look, or the first one the learner belongs to. */
export function applyBranding(institutes: Inst[]) {
  let chosen: string | null = null;
  try {
    chosen = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: fall back to the first institute.
  }
  const inst = institutes.find((i) => i.id === chosen) ?? institutes[0];
  current = inst
    ? {
        id: inst.id,
        name: inst.name,
        color: inst.brandColor,
        logoUrl: inst.logoVersion
          ? `${API_URL}/v1/institutes/${inst.id}/logo?v=${inst.logoVersion}`
          : null,
      }
    : null;
  paint(current?.color ?? null);
  listeners.forEach((l) => l());
}

export function chooseInstitute(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not remembered across visits.
  }
}

/** Reloads the learner's institutes and repaints; used at start-up and after branding changes. */
export async function refreshBranding() {
  if (!API_URL) return;
  try {
    const res = await fetch(`${API_URL}/v1/me/institutes`, { credentials: 'include' });
    applyBranding(res.ok ? ((await res.json()) as { institutes: Inst[] }).institutes : []);
  } catch {
    applyBranding([]);
  }
}
