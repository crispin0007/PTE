import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
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

// ---- Accounts (tables used by Better Auth; field names follow its core schema) ----

export const ROLES = ['learner', 'teacher', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role').$type<Role>().notNull().default('learner'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

// ---- Practice data ----

/**
 * One row per answered question. `clientId` is made on the device that answered, so a guest's
 * history can be uploaded more than once (or from two devices) without duplicates.
 */
export const attempts = pgTable(
  'attempts',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    questionId: text('question_id').notNull(),
    type: text('type').notNull(),
    skill: text('skill').notNull(),
    score: integer('score').notNull(),
    max: integer('max').notNull(),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex('attempts_user_client_idx').on(t.userId, t.clientId)],
);

/** Bookmarks and settings, synced as one small document per user. */
export const userState = pgTable('user_state', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  bookmarks: text('bookmarks')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
