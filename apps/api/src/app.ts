import cors from '@fastify/cors';
import { fromNodeHeaders } from 'better-auth/node';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { adminRoutes } from './admin.ts';
import { assignmentRoutes } from './assignments.ts';
import type { Auth } from './auth.ts';
import { schema, type Db } from './db/index.ts';
import { grammarRoutes, type GrammarClient } from './grammar.ts';
import { instituteRoutes, type InstituteOptions } from './institutes.ts';
import { markingRoutes } from './marking.ts';
import { recordingRoutes, type ScoringOptions } from './recordings.ts';
import type { Storage } from './storage.ts';

export type AppOptions = {
  db: Db;
  includeUnreviewed?: boolean;
  /** Comma-separated origins, or * for read-only public access without cookies. */
  corsOrigin?: string;
  logger?: boolean;
  /** Accounts are on when an auth instance is given. */
  auth?: Auth;
  googleEnabled?: boolean;
  /** Where saved recordings go; recordings are off without it. */
  storage?: Storage;
  /** Speech scoring of saved recordings; off without it. */
  scoring?: ScoringOptions;
  /** Institutes, classes and students. Defaults to anyone may create an institute. */
  institutes?: InstituteOptions;
  /** Grammar checking of Writing answers; off without it. */
  grammar?: GrammarClient;
};

const AttemptIn = z.strictObject({
  clientId: z.string().min(1).max(100),
  questionId: z.string().min(1).max(200),
  type: z.string().regex(/^[a-z_]+$/),
  skill: z.enum(['speaking', 'writing', 'reading', 'listening']),
  score: z.number().int().min(0).max(1000),
  max: z.number().int().min(0).max(1000),
  at: z.number().int().positive(),
});
const AttemptsIn = z.strictObject({ attempts: z.array(AttemptIn).max(5000) });
const StateIn = z.strictObject({
  bookmarks: z.array(z.string().min(1).max(200)).max(5000),
  settings: z.record(z.string(), z.unknown()),
});

/** Forwards /api/auth/* to Better Auth, which speaks the web Fetch API. */
function authRoutes(auth: Auth) {
  return async (app: FastifyInstance) => {
    // Better Auth parses bodies itself, so keep them as raw strings in this scope.
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) =>
      done(null, body),
    );
    app.route({
      method: ['GET', 'POST'],
      url: '/api/auth/*',
      handler: async (req, reply) => {
        const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
        const response = await auth.handler(
          new Request(url, {
            method: req.method,
            headers: fromNodeHeaders(req.headers),
            body: req.method === 'POST' && typeof req.body === 'string' ? req.body : undefined,
          }),
        );
        reply.status(response.status);
        response.headers.forEach((value, key) => {
          if (key !== 'set-cookie') reply.header(key, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) reply.header('set-cookie', cookies);
        return reply.send(response.body ? await response.text() : null);
      },
    });
  };
}

/**
 * The HTTP API. Version 1 serves the question bank read-only; accounts and attempts are added in
 * step 1.9. Every route is under /v1 so later changes can live beside it.
 */
export async function buildApp({
  db,
  includeUnreviewed = false,
  corsOrigin = '*',
  logger = false,
  auth,
  googleEnabled = false,
  storage,
  scoring,
  institutes = { creation: 'anyone' },
  grammar,
}: AppOptions) {
  // Behind Caddy (or another proxy on a private network) the learner's address is in
  // X-Forwarded-For; per-address limits would otherwise see one address for everyone.
  const app = Fastify({ logger, trustProxy: 'loopback,linklocal,uniquelocal' });
  const anyOrigin = corsOrigin === '*';
  await app.register(cors, {
    origin: anyOrigin ? true : corsOrigin.split(',').map((o) => o.trim()),
    // Cookies only travel to origins that are listed by name.
    credentials: !anyOrigin,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
  });

  const visible = includeUnreviewed ? ['published', 'in_review'] : ['published'];
  const { itemTypes, questions } = schema;

  app.get('/health', async () => ({ ok: true }));

  app.get('/v1/item-types', async () => {
    const counts = await db
      .select({ type: questions.type, n: count() })
      .from(questions)
      .where(inArray(questions.status, visible))
      .groupBy(questions.type);
    const byType = new Map(counts.map((c) => [c.type, c.n]));
    const rows = await db.select().from(itemTypes).orderBy(asc(itemTypes.position));
    return {
      itemTypes: rows.map((t) => ({
        id: t.id,
        label: t.label,
        skill: t.skill,
        section: t.section,
        enabled: t.enabled,
        scoring_rule: t.scoringRule,
        timing: t.timing,
        word_limits: t.wordLimits,
        enabling_skills: t.enablingSkills,
        question_count: byType.get(t.id) ?? 0,
      })),
    };
  });

  app.get<{ Querystring: { type?: string } }>(
    '/v1/questions',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: { type: { type: 'string', pattern: '^[a-z_]+$' } },
          required: ['type'],
        },
      },
    },
    async (req) => {
      const rows = await db
        .select({ data: questions.data })
        .from(questions)
        .where(and(eq(questions.type, req.query.type!), inArray(questions.status, visible)))
        .orderBy(asc(questions.id));
      return { questions: rows.map((r) => r.data) };
    },
  );

  app.get<{ Params: { id: string } }>('/v1/questions/:id', async (req, reply) => {
    const [row] = await db
      .select({ data: questions.data })
      .from(questions)
      .where(and(eq(questions.id, req.params.id), inArray(questions.status, visible)));
    if (!row) return reply.code(404).send({ error: 'question not found' });
    return row.data;
  });

  if (grammar) await app.register(grammarRoutes(grammar));

  app.get('/v1/auth/config', async () => ({
    accounts: !!auth,
    google: !!auth && googleEnabled,
    recordings: !!auth && !!storage,
    speechScoring: !!auth && !!storage && !!scoring,
    grammar: !!grammar,
  }));

  if (auth) {
    await app.register(authRoutes(auth));
    await app.register(adminRoutes(db, auth));
    await app.register(instituteRoutes(db, auth, institutes));
    await app.register(assignmentRoutes(db, auth));
    await app.register(markingRoutes(db, auth, storage));
    if (storage) await app.register(recordingRoutes(db, auth, storage, scoring));
    const { attempts, userState } = schema;

    const userOf = async (req: FastifyRequest) => {
      const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      return s?.user ?? null;
    };

    app.get('/v1/me', async (req, reply) => {
      const u = await userOf(req);
      if (!u) return reply.code(401).send({ error: 'not signed in' });
      return { id: u.id, name: u.name, email: u.email, role: (u as { role?: string }).role };
    });

    app.get('/v1/me/attempts', async (req, reply) => {
      const u = await userOf(req);
      if (!u) return reply.code(401).send({ error: 'not signed in' });
      const rows = await db
        .select()
        .from(attempts)
        .where(eq(attempts.userId, u.id))
        .orderBy(asc(attempts.answeredAt));
      return {
        attempts: rows.map((r) => ({
          clientId: r.clientId,
          questionId: r.questionId,
          type: r.type,
          skill: r.skill,
          score: r.score,
          max: r.max,
          at: r.answeredAt.getTime(),
        })),
      };
    });

    app.post('/v1/me/attempts', async (req, reply) => {
      const u = await userOf(req);
      if (!u) return reply.code(401).send({ error: 'not signed in' });
      const parsed = AttemptsIn.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
      const rows = parsed.data.attempts.map((a) => ({
        userId: u.id,
        clientId: a.clientId,
        questionId: a.questionId,
        type: a.type,
        skill: a.skill,
        score: Math.min(a.score, a.max),
        max: a.max,
        answeredAt: new Date(a.at),
      }));
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const done = await db
          .insert(attempts)
          .values(rows.slice(i, i + 500))
          .onConflictDoNothing()
          .returning({ id: attempts.id });
        inserted += done.length;
      }
      return { inserted };
    });

    app.delete('/v1/me/attempts', async (req, reply) => {
      const u = await userOf(req);
      if (!u) return reply.code(401).send({ error: 'not signed in' });
      await db.delete(attempts).where(eq(attempts.userId, u.id));
      await db.delete(userState).where(eq(userState.userId, u.id));
      return { deleted: true };
    });

    app.get('/v1/me/state', async (req, reply) => {
      const u = await userOf(req);
      if (!u) return reply.code(401).send({ error: 'not signed in' });
      const [row] = await db.select().from(userState).where(eq(userState.userId, u.id));
      return { bookmarks: row?.bookmarks ?? [], settings: row?.settings ?? {} };
    });

    app.put('/v1/me/state', async (req, reply) => {
      const u = await userOf(req);
      if (!u) return reply.code(401).send({ error: 'not signed in' });
      const parsed = StateIn.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
      const row = { userId: u.id, ...parsed.data, updatedAt: new Date() };
      await db
        .insert(userState)
        .values(row)
        .onConflictDoUpdate({ target: userState.userId, set: row });
      return parsed.data;
    });
  }

  return app;
}
