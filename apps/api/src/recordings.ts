import { randomUUID } from 'node:crypto';
import { fromNodeHeaders } from 'better-auth/node';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Auth } from './auth.ts';
import { schema, type Db } from './db/index.ts';
import type { Storage } from './storage.ts';

export const MAX_RECORDING_BYTES = 5 * 1024 * 1024;
export const RETENTION_DAYS = 30;
const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
};

/**
 * Saved speaking recordings. A learner opts in per recording; recordings expire after 30 days
 * and can be deleted at any time. Scoring jobs (step 2.2) read them from here.
 */
export function recordingRoutes(db: Db, auth: Auth, storage: Storage) {
  const { recordings } = schema;
  return async (app: FastifyInstance) => {
    app.addContentTypeParser(
      /^audio\//,
      { parseAs: 'buffer', bodyLimit: MAX_RECORDING_BYTES },
      (_req, body, done) => done(null, body),
    );

    const userOf = async (headers: Parameters<typeof fromNodeHeaders>[0]) =>
      (await auth.api.getSession({ headers: fromNodeHeaders(headers) }))?.user ?? null;

    app.post<{ Querystring: { questionId?: string; type?: string } }>(
      '/v1/me/recordings',
      async (req, reply) => {
        const u = await userOf(req.headers);
        if (!u) return reply.code(401).send({ error: 'not signed in' });
        const mime = (req.headers['content-type'] ?? '').split(';')[0]!.trim();
        const ext = EXT[mime];
        const { questionId, type } = req.query;
        if (!ext) return reply.code(415).send({ error: 'send audio/webm, audio/ogg or audio/mp4' });
        if (
          !questionId ||
          !/^[a-z0-9-]+$/.test(questionId) ||
          !type ||
          !/^speaking_[a-z_]+$/.test(type)
        )
          return reply.code(400).send({ error: 'questionId and a speaking type are required' });
        const body = req.body as Buffer;
        if (!body?.length) return reply.code(400).send({ error: 'empty recording' });
        const id = randomUUID();
        const storageKey = `recordings/${u.id}/${id}.${ext}`;
        await storage.put(storageKey, body);
        const expiresAt = new Date(Date.now() + RETENTION_DAYS * 86_400_000);
        await db.insert(recordings).values({
          id,
          userId: u.id,
          questionId,
          type,
          mime,
          bytes: body.length,
          storageKey,
          expiresAt,
        });
        return reply.code(201).send({ id, expiresAt: expiresAt.getTime() });
      },
    );

    app.get('/v1/me/recordings', async (req, reply) => {
      const u = await userOf(req.headers);
      if (!u) return reply.code(401).send({ error: 'not signed in' });
      const rows = await db
        .select()
        .from(recordings)
        .where(eq(recordings.userId, u.id))
        .orderBy(desc(recordings.createdAt));
      return {
        recordings: rows.map((r) => ({
          id: r.id,
          questionId: r.questionId,
          type: r.type,
          bytes: r.bytes,
          createdAt: r.createdAt.getTime(),
          expiresAt: r.expiresAt.getTime(),
        })),
      };
    });

    const own = async (userId: string, id: string) => {
      const [row] = await db
        .select()
        .from(recordings)
        .where(and(eq(recordings.id, id), eq(recordings.userId, userId)));
      return row;
    };

    app.get<{ Params: { id: string } }>('/v1/me/recordings/:id', async (req, reply) => {
      const u = await userOf(req.headers);
      if (!u) return reply.code(401).send({ error: 'not signed in' });
      const row = await own(u.id, req.params.id);
      const data = row && (await storage.get(row.storageKey));
      if (!row || !data) return reply.code(404).send({ error: 'recording not found' });
      return reply.type(row.mime).header('cache-control', 'private, max-age=3600').send(data);
    });

    app.delete<{ Params: { id: string } }>('/v1/me/recordings/:id', async (req, reply) => {
      const u = await userOf(req.headers);
      if (!u) return reply.code(401).send({ error: 'not signed in' });
      const row = await own(u.id, req.params.id);
      if (!row) return reply.code(404).send({ error: 'recording not found' });
      await storage.delete(row.storageKey);
      await db.delete(recordings).where(eq(recordings.id, row.id));
      return { deleted: true };
    });
  };
}

/** Deletes expired recordings. Run on start and every hour. */
export async function purgeExpired(db: Db, storage: Storage, now = new Date()) {
  const { recordings } = schema;
  const rows = await db.select().from(recordings).where(lt(recordings.expiresAt, now));
  for (const r of rows) {
    await storage.delete(r.storageKey);
    await db.delete(recordings).where(eq(recordings.id, r.id));
  }
  return rows.length;
}
