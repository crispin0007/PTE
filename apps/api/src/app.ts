import cors from '@fastify/cors';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import Fastify from 'fastify';
import { schema, type Db } from './db/index.ts';

export type AppOptions = {
  db: Db;
  includeUnreviewed?: boolean;
  corsOrigin?: string;
  logger?: boolean;
};

/**
 * The HTTP API. Version 1 serves the question bank read-only; accounts and attempts are added in
 * step 1.9. Every route is under /v1 so later changes can live beside it.
 */
export async function buildApp({
  db,
  includeUnreviewed = false,
  corsOrigin = '*',
  logger = false,
}: AppOptions) {
  const app = Fastify({ logger });
  await app.register(cors, {
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
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

  return app;
}
