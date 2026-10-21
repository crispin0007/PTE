import { randomUUID } from 'node:crypto';
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { QUESTION_TYPES } from '@openpte/schema';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from './auth.ts';
import { schema, type Db } from './db/index.ts';
import type { AssignmentSpec } from './db/schema.ts';
import { instituteAccess } from './institutes.ts';

/** Mocks a teacher can set; the same ids as the web app's mock definitions. */
export const ASSIGNABLE_MOCKS = [
  'full',
  'mini',
  'speaking_writing',
  'reading',
  'listening',
] as const;

const AssignmentIn = z.strictObject({
  title: z.string().trim().min(1).max(120),
  dueAt: z.coerce.date(),
  spec: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('practice'),
      types: z
        .array(z.enum(QUESTION_TYPES as [string, ...string[]]))
        .min(1)
        .max(22),
      count: z.number().int().min(1).max(200),
    }),
    z.strictObject({ kind: z.literal('mock'), mockId: z.enum(ASSIGNABLE_MOCKS) }),
  ]),
});

const SubmissionIn = z.strictObject({
  result: z.strictObject({
    overall: z.number().int().min(10).max(90).nullable(),
    skills: z.record(z.string(), z.number().int().min(10).max(90).nullable()),
    questions: z.number().int().min(0).max(200),
  }),
});

type Row = typeof schema.assignments.$inferSelect;

/**
 * Assignments: practice sets and mocks a teacher sets for a class, with due dates. A practice set
 * counts different questions of the chosen types answered since it was set; a mock counts once
 * the student's device sends its report summary.
 */
export function assignmentRoutes(db: Db, auth: Auth) {
  const { assignments, submissions, classMembers, classes, institutes, attempts } = schema;
  const { userOf, guard, classIn } = instituteAccess(db, auth);

  /** Progress of each user on each assignment, as done out of target. */
  async function progress(rows: Row[], userIds: string[]) {
    const out = new Map<string, Map<string, { done: number; target: number; result?: unknown }>>();
    if (!rows.length || !userIds.length) return out;
    const subs = await db
      .select()
      .from(submissions)
      .where(
        and(
          inArray(
            submissions.assignmentId,
            rows.map((r) => r.id),
          ),
          inArray(submissions.userId, userIds),
        ),
      );
    for (const a of rows) {
      const per = new Map<string, { done: number; target: number; result?: unknown }>();
      if (a.spec.kind === 'mock') {
        for (const u of userIds) {
          const s = subs.find((x) => x.assignmentId === a.id && x.userId === u);
          per.set(u, { done: s ? 1 : 0, target: 1, result: s?.result });
        }
      } else {
        const counts = await db
          .select({
            userId: attempts.userId,
            n: sql<number>`count(distinct ${attempts.questionId})::int`,
          })
          .from(attempts)
          .where(
            and(
              inArray(attempts.userId, userIds),
              inArray(attempts.type, a.spec.types),
              gte(attempts.answeredAt, a.createdAt),
            ),
          )
          .groupBy(attempts.userId);
        for (const u of userIds) {
          const n = counts.find((c) => c.userId === u)?.n ?? 0;
          per.set(u, { done: Math.min(n, a.spec.count), target: a.spec.count });
        }
      }
      out.set(a.id, per);
    }
    return out;
  }

  const view = (a: Row) => ({
    id: a.id,
    classId: a.classId,
    title: a.title,
    spec: a.spec as AssignmentSpec,
    dueAt: a.dueAt.getTime(),
    createdAt: a.createdAt.getTime(),
  });

  return async (app: FastifyInstance) => {
    app.post<{ Params: { id: string; classId: string } }>(
      '/v1/institutes/:id/classes/:classId/assignments',
      async (req, reply) => {
        const m = await guard(req, reply, 'teacher');
        if (!m) return;
        const cls = await classIn(req.params.id, req.params.classId);
        if (!cls) return reply.code(404).send({ error: 'class not found' });
        const parsed = AssignmentIn.safeParse(req.body);
        if (!parsed.success)
          return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'invalid' });
        const [row] = await db
          .insert(assignments)
          .values({
            id: randomUUID(),
            instituteId: req.params.id,
            classId: cls.id,
            title: parsed.data.title,
            spec: parsed.data.spec as AssignmentSpec,
            dueAt: parsed.data.dueAt,
            createdBy: m.user.id,
          })
          .returning();
        return reply.code(201).send(view(row!));
      },
    );

    app.get<{ Params: { id: string; classId: string } }>(
      '/v1/institutes/:id/classes/:classId/assignments',
      async (req, reply) => {
        if (!(await guard(req, reply, 'teacher'))) return;
        const cls = await classIn(req.params.id, req.params.classId);
        if (!cls) return reply.code(404).send({ error: 'class not found' });
        const rows = await db
          .select()
          .from(assignments)
          .where(and(eq(assignments.classId, cls.id), eq(assignments.instituteId, req.params.id)))
          .orderBy(asc(assignments.dueAt));
        const members = await db
          .select({ id: classMembers.userId })
          .from(classMembers)
          .where(eq(classMembers.classId, cls.id));
        const ids = members.map((x) => x.id);
        const prog = await progress(rows, ids);
        return {
          assignments: rows.map((a) => {
            const per = prog.get(a.id);
            const students = ids.map((u) => ({ userId: u, ...per!.get(u)! }));
            return {
              ...view(a),
              students,
              complete: students.filter((s) => s.done >= s.target).length,
            };
          }),
        };
      },
    );

    app.delete<{ Params: { id: string; classId: string; aid: string } }>(
      '/v1/institutes/:id/classes/:classId/assignments/:aid',
      async (req, reply) => {
        if (!(await guard(req, reply, 'teacher'))) return;
        const done = await db
          .delete(assignments)
          .where(
            and(
              eq(assignments.id, req.params.aid),
              eq(assignments.classId, req.params.classId),
              eq(assignments.instituteId, req.params.id),
            ),
          )
          .returning();
        if (!done.length) return reply.code(404).send({ error: 'assignment not found' });
        return { ok: true };
      },
    );

    /** The signed-in student's assignments across all their classes, soonest due first. */
    app.get('/v1/me/assignments', async (req, reply) => {
      const u = await userOf(req, reply);
      if (!u) return;
      const rows = await db
        .select({ a: assignments, className: classes.name, instituteName: institutes.name })
        .from(assignments)
        .innerJoin(classMembers, eq(classMembers.classId, assignments.classId))
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .innerJoin(institutes, eq(institutes.id, assignments.instituteId))
        .where(eq(classMembers.userId, u.id))
        .orderBy(asc(assignments.dueAt));
      const prog = await progress(
        rows.map((r) => r.a),
        [u.id],
      );
      return {
        assignments: rows.map((r) => ({
          ...view(r.a),
          className: r.className,
          instituteName: r.instituteName,
          ...prog.get(r.a.id)!.get(u.id)!,
        })),
      };
    });

    app.post<{ Params: { aid: string } }>('/v1/me/assignments/:aid/submit', async (req, reply) => {
      const u = await userOf(req, reply);
      if (!u) return;
      const [row] = await db
        .select({ a: assignments })
        .from(assignments)
        .innerJoin(classMembers, eq(classMembers.classId, assignments.classId))
        .where(and(eq(assignments.id, req.params.aid), eq(classMembers.userId, u.id)));
      if (!row) return reply.code(404).send({ error: 'assignment not found' });
      if (row.a.spec.kind !== 'mock')
        return reply.code(400).send({ error: 'practice sets count answers by themselves' });
      const parsed = SubmissionIn.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'invalid' });
      await db
        .insert(submissions)
        .values({ assignmentId: row.a.id, userId: u.id, result: parsed.data.result })
        .onConflictDoUpdate({
          target: [submissions.assignmentId, submissions.userId],
          set: { result: parsed.data.result, submittedAt: new Date() },
        });
      return { ok: true };
    });
  };
}
