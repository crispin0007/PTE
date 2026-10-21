import { z } from 'zod';

import { ENABLING_SKILLS, SECTIONS, SKILLS } from './constants.ts';

export { ENABLING_SKILLS, SECTIONS, SKILLS };

export const Skill = z.enum(SKILLS);
export const Section = z.enum(SECTIONS);

const Timing = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('per_item'),
    prep_s: z.number().int().min(0),
    answer_s: z.number().int().positive(),
  }),
  z.object({ mode: z.literal('section_shared') }),
]);

const WordLimits = z
  .object({ min: z.number().int().min(0), max: z.number().int().positive() })
  .refine((w) => w.min <= w.max, 'word_limits.min must not exceed max');

/** One entry of content/item-types.yaml. Everything about a type that is not a question. */
export const ItemTypeDef = z.strictObject({
  id: z.string().regex(/^[a-z]+(_[a-z]+)+$/, 'id must be snake_case with a skill prefix'),
  label: z.string().min(1),
  skill: Skill,
  section: Section,
  enabled: z.boolean(),
  scoring_rule: z.string().min(1),
  timing: Timing,
  word_limits: WordLimits.nullable(),
  enabling_skills: z.array(z.enum(ENABLING_SKILLS)),
});

export const Registry = z.array(ItemTypeDef).superRefine((defs, ctx) => {
  const seen = new Set<string>();
  defs.forEach((d, i) => {
    if (seen.has(d.id))
      ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `duplicate type id ${d.id}` });
    seen.add(d.id);
  });
});

export type ItemTypeDef = z.infer<typeof ItemTypeDef>;
export type Skill = z.infer<typeof Skill>;
export type Section = z.infer<typeof Section>;
