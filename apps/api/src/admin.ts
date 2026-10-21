import { fromNodeHeaders } from 'better-auth/node';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { stringify } from 'yaml';
import { QUESTION_SCHEMAS, isQuestionType, type Question } from '@openpte/schema';
import { z } from 'zod';
import type { Auth } from './auth.ts';
import { schema, type Db } from './db/index.ts';
import { ROLES, type Role } from './db/schema.ts';

type Staff = { id: string; email: string; role: Role; handle: string };

/** A handle for the question's author and reviewed_by fields, which take GitHub-style handles. */
export function handleOf(u: { id: string; email: string }): string {
  const local = u.email
    .split('@')[0]!
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${local || 'user'}-${u.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 4)}`;
}

const REQUIRED_APPROVALS = 2;

/** Puts keys back in schema order (PostgreSQL jsonb does not keep it), for readable YAML. */
function canonical(data: unknown) {
  const v = validate(data);
  return v.ok ? v.question : data;
}

const ReviewIn = z.strictObject({
  verdict: z.enum(['approve', 'changes']),
  comment: z.string().max(2000).default(''),
});

function validate(
  data: unknown,
): { ok: true; question: Question } | { ok: false; errors: string[] } {
  const type = (data as { type?: unknown } | null)?.type;
  if (!isQuestionType(type)) return { ok: false, errors: ['type: unknown question type'] };
  const r = QUESTION_SCHEMAS[type].safeParse(data);
  if (r.success) return { ok: true, question: r.data as Question };
  return {
    ok: false,
    errors: r.error.issues.map(
      (i) => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`,
    ),
  };
}

/**
 * Question bank admin for teachers and admins: write and edit questions, review other people's
 * questions, and publish once two reviewers who are not the author have approved.
 */
export function adminRoutes(db: Db, auth: Auth) {
  const { questions, reviews } = schema;

  const staffOf = async (req: FastifyRequest, reply: FastifyReply): Promise<Staff | null> => {
    const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    const role = (s?.user as { role?: Role } | undefined)?.role;
    if (!s) {
      void reply.code(401).send({ error: 'not signed in' });
      return null;
    }
    if (role !== 'teacher' && role !== 'admin') {
      void reply.code(403).send({ error: 'teachers and admins only' });
      return null;
    }
    return { id: s.user.id, email: s.user.email, role, handle: handleOf(s.user) };
  };

  const load = async (id: string) => {
    const [row] = await db.select().from(questions).where(eq(questions.id, id));
    return row;
  };
  const reviewsOf = (id: string) =>
    db.select().from(reviews).where(eq(reviews.questionId, id)).orderBy(asc(reviews.createdAt));

  const canEdit = (staff: Staff, row: { authorId: string | null }) =>
    staff.role === 'admin' || row.authorId === staff.id;

  /** Next free id for a type, e.g. reading-mcq-single-0011. */
  const nextId = async (type: string) => {
    const prefix = type.replaceAll('_', '-');
    const [row] = await db
      .select({ n: sql<number>`max(cast(right(${questions.id}, 4) as int))` })
      .from(questions)
      .where(eq(questions.type, type));
    return `${prefix}-${String((row?.n ?? 0) + 1).padStart(4, '0')}`;
  };

  return async (app: FastifyInstance) => {
    app.get<{ Querystring: { status?: string; type?: string } }>(
      '/v1/admin/questions',
      async (req, reply) => {
        if (!(await staffOf(req, reply))) return;
        const filters = [
          req.query.status ? eq(questions.status, req.query.status) : undefined,
          req.query.type ? eq(questions.type, req.query.type) : undefined,
        ].filter(Boolean);
        const approvals = sql<number>`(select count(*) from ${reviews} r where r.question_id = ${questions.id} and r.verdict = 'approve')`;
        const changes = sql<number>`(select count(*) from ${reviews} r where r.question_id = ${questions.id} and r.verdict = 'changes')`;
        const rows = await db
          .select({
            id: questions.id,
            type: questions.type,
            status: questions.status,
            difficulty: questions.difficulty,
            origin: questions.origin,
            authorId: questions.authorId,
            author: sql<string>`${questions.data}->>'author'`,
            approvals,
            changes,
            updatedAt: questions.updatedAt,
          })
          .from(questions)
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(desc(questions.updatedAt), asc(questions.id))
          .limit(500);
        return {
          questions: rows.map((r) => ({
            ...r,
            approvals: Number(r.approvals),
            changes: Number(r.changes),
          })),
        };
      },
    );

    app.get<{ Params: { id: string } }>('/v1/admin/questions/:id', async (req, reply) => {
      const staff = await staffOf(req, reply);
      if (!staff) return;
      const row = await load(req.params.id);
      if (!row) return reply.code(404).send({ error: 'question not found' });
      return {
        question: canonical(row.data),
        origin: row.origin,
        canEdit: canEdit(staff, row),
        canReview: row.authorId !== staff.id && row.status === 'in_review',
        reviews: (await reviewsOf(row.id)).map((r) => ({
          reviewer: r.reviewerHandle,
          mine: r.reviewerId === staff.id,
          verdict: r.verdict,
          comment: r.comment,
          at: r.createdAt.getTime(),
        })),
      };
    });

    /** A starting point for a new question: an existing one of the type with identity removed. */
    app.get<{ Params: { type: string } }>('/v1/admin/templates/:type', async (req, reply) => {
      const staff = await staffOf(req, reply);
      if (!staff) return;
      if (!isQuestionType(req.params.type)) return reply.code(404).send({ error: 'unknown type' });
      const [row] = await db
        .select({ data: questions.data })
        .from(questions)
        .where(eq(questions.type, req.params.type))
        .orderBy(asc(questions.id))
        .limit(1);
      if (!row) return reply.code(404).send({ error: 'no example of this type yet' });
      const template = { ...(row.data as Record<string, unknown>) };
      for (const k of ['source_url', 'attribution', 'drafted_with', 'explanation'])
        delete template[k];
      return canonical({
        ...template,
        id: await nextId(req.params.type),
        status: 'draft',
        source: 'original',
        author: staff.handle,
        reviewed_by: [],
        tags: [],
      });
    });

    app.post<{ Body: { question: unknown } }>('/v1/admin/questions', async (req, reply) => {
      const staff = await staffOf(req, reply);
      if (!staff) return;
      const data = { ...(req.body?.question as object), author: staff.handle, status: 'draft' };
      const v = validate(data);
      if (!v.ok) return reply.code(400).send({ errors: v.errors });
      if (await load(v.question.id)) return reply.code(409).send({ errors: ['id: already used'] });
      await db.insert(questions).values({
        id: v.question.id,
        type: v.question.type,
        status: 'draft',
        difficulty: v.question.difficulty,
        tags: v.question.tags,
        data: v.question,
        origin: 'admin',
        authorId: staff.id,
      });
      return reply.code(201).send({ id: v.question.id });
    });

    app.put<{ Params: { id: string }; Body: { question: unknown } }>(
      '/v1/admin/questions/:id',
      async (req, reply) => {
        const staff = await staffOf(req, reply);
        if (!staff) return;
        const row = await load(req.params.id);
        if (!row) return reply.code(404).send({ error: 'question not found' });
        if (!canEdit(staff, row))
          return reply.code(403).send({ error: 'only the author or an admin' });
        // An edit needs fresh reviews, so a published question goes back to review.
        const status = row.status === 'draft' ? 'draft' : 'in_review';
        const data = {
          ...(req.body?.question as object),
          id: row.id,
          author: (row.data as Question).author,
          status,
          reviewed_by: [],
        };
        const v = validate(data);
        if (!v.ok) return reply.code(400).send({ errors: v.errors });
        if (v.question.type !== row.type)
          return reply.code(400).send({ errors: ['type: cannot change'] });
        await db.transaction(async (tx) => {
          await tx
            .update(questions)
            .set({
              status,
              difficulty: v.question.difficulty,
              tags: v.question.tags,
              data: v.question,
              origin: 'admin',
              updatedAt: new Date(),
            })
            .where(eq(questions.id, row.id));
          await tx.delete(reviews).where(eq(reviews.questionId, row.id));
        });
        return { id: row.id, status };
      },
    );

    app.post<{ Params: { id: string } }>('/v1/admin/questions/:id/submit', async (req, reply) => {
      const staff = await staffOf(req, reply);
      if (!staff) return;
      const row = await load(req.params.id);
      if (!row) return reply.code(404).send({ error: 'question not found' });
      if (!canEdit(staff, row))
        return reply.code(403).send({ error: 'only the author or an admin' });
      if (row.status !== 'draft')
        return reply.code(409).send({ error: 'only drafts can be submitted' });
      await db
        .update(questions)
        .set({
          status: 'in_review',
          data: { ...row.data, status: 'in_review' },
          updatedAt: new Date(),
        })
        .where(eq(questions.id, row.id));
      return { status: 'in_review' };
    });

    app.post<{ Params: { id: string } }>('/v1/admin/questions/:id/reviews', async (req, reply) => {
      const staff = await staffOf(req, reply);
      if (!staff) return;
      const row = await load(req.params.id);
      if (!row) return reply.code(404).send({ error: 'question not found' });
      if (row.status !== 'in_review') return reply.code(409).send({ error: 'not in review' });
      // Seeded questions have no account as author; compare handles as well.
      if (row.authorId === staff.id || (row.data as Question).author === staff.handle)
        return reply.code(403).send({ error: 'authors cannot review their own questions' });
      const body = ReviewIn.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message });
      const review = {
        questionId: row.id,
        reviewerId: staff.id,
        reviewerHandle: staff.handle,
        verdict: body.data.verdict,
        comment: body.data.comment,
        createdAt: new Date(),
      };
      await db
        .insert(reviews)
        .values(review)
        .onConflictDoUpdate({ target: [reviews.questionId, reviews.reviewerId], set: review });
      return { verdict: review.verdict };
    });

    app.post<{ Params: { id: string } }>('/v1/admin/questions/:id/publish', async (req, reply) => {
      const staff = await staffOf(req, reply);
      if (!staff) return;
      const row = await load(req.params.id);
      if (!row) return reply.code(404).send({ error: 'question not found' });
      if (!canEdit(staff, row) && staff.role !== 'admin')
        return reply.code(403).send({ error: 'only the author or an admin' });
      if (row.status !== 'in_review') return reply.code(409).send({ error: 'not in review' });
      const rs = await reviewsOf(row.id);
      const approvers = rs.filter((r) => r.verdict === 'approve').map((r) => r.reviewerHandle);
      if (rs.some((r) => r.verdict === 'changes'))
        return reply.code(409).send({ error: 'a reviewer asked for changes' });
      if (approvers.length < REQUIRED_APPROVALS)
        return reply
          .code(409)
          .send({ error: `needs ${REQUIRED_APPROVALS} approvals, has ${approvers.length}` });
      const v = validate({ ...row.data, status: 'published', reviewed_by: approvers });
      if (!v.ok) return reply.code(400).send({ errors: v.errors });
      await db
        .update(questions)
        .set({ status: 'published', data: v.question, updatedAt: new Date() })
        .where(eq(questions.id, row.id));
      return { status: 'published', reviewed_by: approvers };
    });

    /** The question as a YAML file for content/questions/<skill>/<type>/<id>.yaml */
    app.get<{ Params: { id: string } }>('/v1/admin/questions/:id/yaml', async (req, reply) => {
      if (!(await staffOf(req, reply))) return;
      const row = await load(req.params.id);
      if (!row) return reply.code(404).send({ error: 'question not found' });
      return reply
        .type('text/yaml; charset=utf-8')
        .header('content-disposition', `attachment; filename="${row.id}.yaml"`)
        .send(stringify(canonical(row.data), { lineWidth: 100 }));
    });

    app.get('/v1/admin/users', async (req, reply) => {
      const staff = await staffOf(req, reply);
      if (!staff) return;
      if (staff.role !== 'admin') return reply.code(403).send({ error: 'admins only' });
      const rows = await db
        .select({ id: schema.user.id, email: schema.user.email, role: schema.user.role })
        .from(schema.user)
        .orderBy(asc(schema.user.email));
      return { users: rows };
    });

    app.put<{ Params: { id: string }; Body: { role: string } }>(
      '/v1/admin/users/:id/role',
      async (req, reply) => {
        const staff = await staffOf(req, reply);
        if (!staff) return;
        if (staff.role !== 'admin') return reply.code(403).send({ error: 'admins only' });
        const role = z.enum(ROLES).safeParse(req.body?.role);
        if (!role.success)
          return reply.code(400).send({ error: 'role must be learner, teacher or admin' });
        await db
          .update(schema.user)
          .set({ role: role.data })
          .where(eq(schema.user.id, req.params.id));
        return { role: role.data };
      },
    );
  };
}
