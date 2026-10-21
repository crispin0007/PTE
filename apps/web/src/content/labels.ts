import { getType } from './catalog.ts';

/** "Question 7" from an id like reading-mcq-single-0007. */
export function questionLabel(id: string): string {
  const n = Number(id.match(/(\d+)$/)?.[1]);
  return Number.isFinite(n) ? `Question ${n}` : id;
}

export const typeLabel = (type: string) => getType(type)?.label ?? type;
