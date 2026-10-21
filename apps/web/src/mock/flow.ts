import type { ItemResult } from './report.ts';
import { paperItems, type Sitting } from './store.ts';

/**
 * Where a sitting goes after the current item: `results` holds the current item's result and, when
 * the section's time ran out, the skipped rest of that section. Entering a new section shows its
 * intro screen and resets the shared clock.
 */
export function advance(
  s: Sitting,
  results: ItemResult[],
  sharedSpentS: number,
  now: number,
): Pick<Sitting, 'position' | 'sectionUsedS' | 'itemStartedAt' | 'results'> {
  const items = paperItems(s.paper);
  const position = s.position + results.length;
  const newSection =
    position < items.length && items[position]!.section !== items[s.position]!.section;
  return {
    position,
    results: [...s.results, ...results],
    sectionUsedS: newSection ? 0 : s.sectionUsedS + sharedSpentS,
    itemStartedAt: newSection || position >= items.length ? null : now,
  };
}

/** Positions of the items after `position` that belong to the same section. */
export function restOfSection(s: Sitting): number[] {
  const items = paperItems(s.paper);
  const section = items[s.position]?.section;
  const rest: number[] = [];
  for (let i = s.position + 1; i < items.length && items[i]!.section === section; i++) rest.push(i);
  return rest;
}
