import { sql } from 'drizzle-orm';
import type { ValidationResult } from '@openpte/schema';
import { schema, type Db } from './db/index.ts';

/**
 * Loads the validated YAML bank into the database. Idempotent: rows are inserted or updated by id,
 * so re-running after a content change is safe. Questions removed from YAML are left alone, since
 * from step 1.10 questions can also be written in the admin screens.
 */
export async function seed(db: Db, bank: ValidationResult) {
  if (bank.errors.length)
    throw new Error(`content has ${bank.errors.length} errors; run npm run validate`);
  await db.transaction(async (tx) => {
    for (const [position, t] of bank.registry.entries()) {
      const row = {
        id: t.id,
        position,
        label: t.label,
        skill: t.skill,
        section: t.section,
        enabled: t.enabled,
        scoringRule: t.scoring_rule,
        timing: t.timing,
        wordLimits: t.word_limits,
        enablingSkills: t.enabling_skills,
      };
      await tx
        .insert(schema.itemTypes)
        .values(row)
        .onConflictDoUpdate({ target: schema.itemTypes.id, set: row });
    }
    for (const { question: q } of bank.questions) {
      const row = {
        id: q.id,
        type: q.type,
        status: q.status,
        difficulty: q.difficulty,
        tags: q.tags,
        data: q,
      };
      await tx
        .insert(schema.questions)
        .values(row)
        .onConflictDoUpdate({
          target: schema.questions.id,
          set: { ...row, updatedAt: sql`now()` },
        });
    }
  });
  return { itemTypes: bank.registry.length, questions: bank.questions.length };
}
