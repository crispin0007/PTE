import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from './auth.ts';
import { schema, type Db } from './db/index.ts';
import { instituteAccess } from './institutes.ts';
import type { Storage } from './storage.ts';

const RequestIn = z
  .strictObject({
    instituteId: z.string().min(1),
    questionId: z.string().min(1).max(100),
    type: z.string().regex(/^(writing|speaking)_[a-z_]+$|^listening_summarize_spoken_text$/),
    answerText: z.string().max(6000).optional(),
    recordingId: z.string().optional(),
    score: z.number().int().min(0),
    max: z.number().int().min(1).max(100),
  })
  .refine((r) => r.answerText || r.recordingId, 'send the answer text or a saved recording')
  .refine((r) => r.score <= r.max, 'score cannot be over max');

const MarkIn = z.strictObject({
  score: z.number().int().min(0),
  comment: z.string().trim().max(2000).default(''),
});

/** The skill the practice screens file each type under (Summarize Spoken Text is Listening). */
const skillOf = (type: string) => type.split('_')[0]!;

/**
 * Teacher marking. A student sends a Writing or Speaking answer to their institute; any teacher
 * there marks it with a score and a comment. The mark becomes a new attempt, so Progress, Today
 * and the class table use the teacher's score from then on.
 */
export function markingRoutes(db: Db, auth: Auth, storage?: Storage) {
  const { markingRequests: mr, recordings, attempts, user } = schema;
  const { userOf, roleIn, guard } = instituteAccess(db, auth);

  const view = (r: typeof mr.$inferSelect) => ({
    id: r.id,
    questionId: r.questionId,
    type: r.type,
    answerText: r.answerText,
    hasRecording: !!r.recordingId,
    autoScore: r.autoScore,
    max: r.max,
    teacherScore: r.teacherScore,
    comment: r.comment,
    markedAt: r.markedAt?.getTime() ?? null,
    createdAt: r.createdAt.getTime(),
  });

  return async (app: FastifyInstance) => {
    app.post('/v1/me/marking', async (req, reply) => {
      const u = await userOf(req, reply);
      if (!u) return;
      const parsed = RequestIn.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'invalid' });
      const r = parsed.data;
      if (!(await roleIn(r.instituteId, u.id)))
        return reply.code(404).send({ error: 'institute not found' });
      if (r.recordingId) {
        const [rec] = await db
          .select({ id: recordings.id })
          .from(recordings)
          .where(and(eq(recordings.id, r.recordingId), eq(recordings.userId, u.id)));
        if (!rec) return reply.code(404).send({ error: 'recording not found' });
      }
      const id = randomUUID();
      await db.insert(mr).values({
        id,
        instituteId: r.instituteId,
        userId: u.id,
        questionId: r.questionId,
        type: r.type,
        skill: skillOf(r.type),
        answerText: r.answerText ?? null,
        recordingId: r.recordingId ?? null,
        autoScore: r.score,
        max: r.max,
      });
      return reply.code(201).send({ id });
    });

    app.get('/v1/me/marking', async (req, reply) => {
      const u = await userOf(req, reply);
      if (!u) return;
      const rows = await db
        .select()
        .from(mr)
        .where(eq(mr.userId, u.id))
        .orderBy(desc(mr.createdAt))
        .limit(50);
      return { requests: rows.map(view) };
    });

    app.get<{ Params: { id: string }; Querystring: { status?: string } }>(
      '/v1/institutes/:id/marking',
      async (req, reply) => {
        if (!(await guard(req, reply, 'teacher'))) return;
        const marked = req.query.status === 'marked';
        const rows = await db
          .select({ r: mr, name: user.name, email: user.email })
          .from(mr)
          .innerJoin(user, eq(user.id, mr.userId))
          .where(
            and(
              eq(mr.instituteId, req.params.id),
              marked ? isNotNull(mr.markedAt) : isNull(mr.markedAt),
            ),
          )
          .orderBy(marked ? desc(mr.markedAt) : asc(mr.createdAt))
          .limit(100);
        return {
          requests: rows.map(({ r, name, email }) => ({ ...view(r), student: { name, email } })),
        };
      },
    );

    app.get<{ Params: { id: string; mid: string } }>(
      '/v1/institutes/:id/marking/:mid/audio',
      async (req, reply) => {
        if (!(await guard(req, reply, 'teacher'))) return;
        const [row] = await db
          .select({ key: recordings.storageKey, mime: recordings.mime })
          .from(mr)
          .innerJoin(recordings, eq(recordings.id, mr.recordingId))
          .where(and(eq(mr.id, req.params.mid), eq(mr.instituteId, req.params.id)));
        const data = row && storage && (await storage.get(row.key));
        if (!row || !data) return reply.code(404).send({ error: 'recording not found or expired' });
        return reply.type(row.mime).header('cache-control', 'private, max-age=3600').send(data);
      },
    );

    app.put<{ Params: { id: string; mid: string } }>(
      '/v1/institutes/:id/marking/:mid',
      async (req, reply) => {
        const m = await guard(req, reply, 'teacher');
        if (!m) return;
        const parsed = MarkIn.safeParse(req.body);
        if (!parsed.success)
          return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'invalid' });
        const [row] = await db
          .select()
          .from(mr)
          .where(and(eq(mr.id, req.params.mid), eq(mr.instituteId, req.params.id)));
        if (!row) return reply.code(404).send({ error: 'request not found' });
        if (parsed.data.score > row.max)
          return reply.code(400).send({ error: `score is out of ${row.max}` });
        const now = new Date();
        await db
          .update(mr)
          .set({
            teacherScore: parsed.data.score,
            comment: parsed.data.comment,
            markedBy: m.user.id,
            markedAt: now,
          })
          .where(eq(mr.id, row.id));
        // The teacher's mark is the student's latest attempt at this question.
        await db
          .insert(attempts)
          .values({
            userId: row.userId,
            clientId: `mark:${row.id}`,
            questionId: row.questionId,
            type: row.type,
            skill: row.skill,
            score: parsed.data.score,
            max: row.max,
            answeredAt: now,
          })
          .onConflictDoUpdate({
            target: [attempts.userId, attempts.clientId],
            set: { score: parsed.data.score, answeredAt: now },
          });
        return { ok: true };
      },
    );
  };
}
