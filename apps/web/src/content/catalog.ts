import {
  availableAssets,
  counts,
  includesUnreviewed,
  loaders,
  registry,
} from 'virtual:openpte/catalog';
import type { Question, QuestionType } from '@openpte/schema';
import { SECTIONS } from '@openpte/schema/constants';
import type { ItemTypeDef, Section } from '@openpte/schema';

export { includesUnreviewed };

export const SECTION_LABELS: Record<Section, string> = {
  speaking_writing: 'Speaking and Writing',
  reading: 'Reading',
  listening: 'Listening',
};

export type TypeDef = ItemTypeDef & { id: QuestionType };

export const itemTypes: TypeDef[] = registry;

export function typesBySection(): { section: Section; types: TypeDef[] }[] {
  return SECTIONS.map((section) => ({
    section,
    types: itemTypes.filter((t) => t.section === section),
  }));
}

export function getType(id: string | undefined): TypeDef | undefined {
  return itemTypes.find((t) => t.id === id);
}

export function questionCount(id: QuestionType): number {
  return counts[id] ?? 0;
}

/** Set at build time to read questions from the openpte API instead of the bundled bank. */
export const API_URL: string | undefined = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

/**
 * Loads one type's questions. Without an API each type is a separate bundled chunk, so phones only
 * download what they open; with VITE_API_URL set they come from GET /v1/questions.
 */
export async function loadQuestions(id: QuestionType): Promise<Question[]> {
  if (API_URL) {
    const res = await fetch(`${API_URL}/v1/questions?type=${id}`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    return ((await res.json()) as { questions: Question[] }).questions;
  }
  const load = loaders[id];
  return load ? load() : [];
}

const available = new Set(availableAssets);

/** URL of a content asset, or undefined when the file does not exist yet (audio before TTS). */
export function assetUrl(path: string): string | undefined {
  if (!available.has(path)) return undefined;
  return `${import.meta.env.BASE_URL}content-assets/${path}`;
}
