import { describe, expect, it } from 'vitest';
import { readYaml } from '../../scripts/lib/content-fs.ts';
import { SCORING_RULES } from './rules.ts';

describe('scoring rules', () => {
  it('covers every scoring_rule named in the registry', () => {
    const registry = readYaml('content/item-types.yaml') as { id: string; scoring_rule: string }[];
    const missing = registry
      .filter((d) => !(d.scoring_rule in SCORING_RULES))
      .map((d) => `${d.id}: ${d.scoring_rule}`);
    expect(missing).toEqual([]);
  });
});
