import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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
    /** 'yaml' rows are refreshed from content/ on every seed; 'admin' rows are edited in the app. */
    origin: text('origin').$type<'yaml' | 'admin'>().notNull().default('yaml'),
    authorId: text('author_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('questions_type_status_idx').on(t.type, t.status)],
);

/** One review per reviewer per question. Editing a question clears its reviews. */
export const reviews = pgTable(
  'reviews',
  {
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    reviewerId: text('reviewer_id').notNull(),
    reviewerHandle: text('reviewer_handle').notNull(),
    verdict: text('verdict').$type<'approve' | 'changes'>().notNull(),
    comment: text('comment').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('reviews_question_reviewer_idx').on(t.questionId, t.reviewerId)],
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

/** Speaking answers a learner chose to save. Deleted after 30 days. */
export const recordings = pgTable(
  'recordings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    questionId: text('question_id').notNull(),
    type: text('type').notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    storageKey: text('storage_key').notNull(),
    /** Scores from the speech service, once requested. */
    result: jsonb('result').$type<Record<string, unknown>>(),
    scoredAt: timestamp('scored_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('recordings_user_idx').on(t.userId),
    index('recordings_expiry_idx').on(t.expiresAt),
  ],
);

/**
 * Institutes are the tenants. A hosted openpte serves many; a self-hosted install usually has one.
 * Every institute-scoped row carries `instituteId`, and every query on it filters by that id.
 */
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const institutes = pgTable('institutes', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  /** Branding: a #rrggbb colour checked for contrast, and a small logo image. */
  brandColor: text('brand_color'),
  logo: bytea('logo'),
  logoMime: text('logo_mime'),
  logoUpdatedAt: timestamp('logo_updated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const MEMBER_ROLES = ['student', 'teacher', 'owner'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const memberships = pgTable(
  'memberships',
  {
    instituteId: text('institute_id')
      .notNull()
      .references(() => institutes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').$type<MemberRole>().notNull().default('student'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.instituteId, t.userId] }),
    index('memberships_user_idx').on(t.userId),
  ],
);

export const classes = pgTable(
  'classes',
  {
    id: text('id').primaryKey(),
    instituteId: text('institute_id')
      .notNull()
      .references(() => institutes.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Students join with this code; a teacher can replace it. */
    inviteCode: text('invite_code').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('classes_institute_idx').on(t.instituteId)],
);

export const classMembers = pgTable(
  'class_members',
  {
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.classId, t.userId] }),
    index('class_members_user_idx').on(t.userId),
  ],
);

export type AssignmentSpec =
  { kind: 'practice'; types: string[]; count: number } | { kind: 'mock'; mockId: string };

/** Work a teacher sets for a class: a practice set or a mock test, with a due date. */
export const assignments = pgTable(
  'assignments',
  {
    id: text('id').primaryKey(),
    instituteId: text('institute_id')
      .notNull()
      .references(() => institutes.id, { onDelete: 'cascade' }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    spec: jsonb('spec').$type<AssignmentSpec>().notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assignments_class_idx').on(t.classId)],
);

/** A finished mock assignment, with the report summary the student's device worked out. */
export const submissions = pgTable(
  'assignment_submissions',
  {
    assignmentId: text('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    result: jsonb('result').$type<Record<string, unknown>>().notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.assignmentId, t.userId] })],
);
