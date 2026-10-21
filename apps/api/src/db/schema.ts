import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { ItemTypeDef, Question } from '@openpte/schema';

/** One row per entry of content/item-types.yaml. */
export const itemTypes = pgTable('item_types', {
  id: text('id').primaryKey(),
  position: integer('position').notNull(),
  label: text('label').notNull(),
  skill: text('skill').notNull(),
  section: text('section').notNull(),
  enabled: boolean('enabled').notNull(),
  scoringRule: text('scoring_rule').notNull(),
  timing: jsonb('timing').$type<ItemTypeDef['timing']>().notNull(),
  wordLimits: jsonb('word_limits').$type<ItemTypeDef['word_limits']>(),
  enablingSkills: text('enabling_skills').array().notNull(),
});

/**
 * Questions. The validated question is stored whole in `data`, so the schema package stays the
 * single definition of every type; the other columns are copies used for filtering.
 */
export const questions = pgTable(
  'questions',
  {
    id: text('id').primaryKey(),
    type: text('type')
      .notNull()
      .references(() => itemTypes.id),
    status: text('status').notNull(),
    difficulty: integer('difficulty').notNull(),
    tags: text('tags').array().notNull(),
    data: jsonb('data').$type<Question>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('questions_type_status_idx').on(t.type, t.status)],
);
