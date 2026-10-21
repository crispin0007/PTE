import { randomInt, randomUUID } from 'node:crypto';
import { fromNodeHeaders } from 'better-auth/node';
import { and, asc, eq, inArray, max, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Auth } from './auth.ts';
import { schema, type Db } from './db/index.ts';
import { MEMBER_ROLES, type MemberRole, type Role } from './db/schema.ts';

export type InstituteOptions = {
  /** Who may create an institute on a hosted, multi-tenant install. */
  creation: 'anyone' | 'admin';
  /**
   * Self-host for one institute: it is created on start, everyone who signs in joins it as a
   * student, and platform admins (ADMIN_EMAILS) are its owners.
   */
  single?: { name: string };
};

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
// No 0/O or 1/I/L, so codes read out in class are not misheard.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const MAX_IMPORT_ROWS = 500;

export const inviteCode = () =>
  Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'institute';

/** Rows of `email,name` (name optional). A header row and blank lines are skipped. */
export function parseRoster(csv: string): {
  rows: { email: string; name: string }[];
  invalid: string[];
} {
  const rows: { email: string; name: string }[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of csv.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [first = '', ...rest] = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const email = first.toLowerCase();
    if (email === 'email') continue;
    if (!EMAIL.test(email)) {
      invalid.push(line);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    rows.push({ email, name: rest.join(',').trim() || email.split('@')[0]! });
  }
  return { rows, invalid };
}

const RANK: Record<MemberRole, number> = { student: 0, teacher: 1, owner: 2 };

/** Creates the one institute of a single-institute install if it does not exist yet. */
export async function ensureSingleInstitute(db: Db, name: string) {
  const { institutes } = schema;
  const [found] = await db.select().from(institutes).orderBy(asc(institutes.createdAt)).limit(1);
  if (found) return found;
  const [row] = await db
    .insert(institutes)
    .values({ id: randomUUID(), slug: slugify(name), name })
    .returning();
  return row!;
}

/**
 * Institutes, their members and classes. Isolation rule: every query on institute data filters by
 * the institute in the URL, and the caller must be a member of it. Non-members get 404, so they
 * cannot even tell whether an institute or class exists.
 */
export function instituteRoutes(db: Db, auth: Auth, opts: InstituteOptions) {
  const { institutes, memberships, classes, classMembers, user, attempts } = schema;

  const userOf = async (req: FastifyRequest, reply: FastifyReply) => {
    const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!s) void reply.code(401).send({ error: 'not signed in' });
    return s ? { ...s.user, role: (s.user as { role?: Role }).role ?? 'learner' } : null;
  };

  const roleIn = async (instituteId: string, userId: string) => {
    const [m] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.instituteId, instituteId), eq(memberships.userId, userId)));
    return m?.role ?? null;
  };

  /** The signed-in member with at least role `need`, or null after replying 401/403/404. */
  const guard = async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
    need: MemberRole,
  ) => {
    const u = await userOf(req, reply);
    if (!u) return null;
    const role = await roleIn(req.params.id, u.id);
    if (!role) {
      void reply.code(404).send({ error: 'institute not found' });
      return null;
    }
    if (RANK[role] < RANK[need]) {
      void reply.code(403).send({ error: `${need}s only` });
      return null;
    }
    return { user: u, role };
  };

  const classIn = async (instituteId: string, classId: string) => {
    const [c] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.instituteId, instituteId)));
    return c;
  };

  /** Adds a membership, never lowering an existing role. */
  const join = async (instituteId: string, userId: string, role: MemberRole) => {
    const current = await roleIn(instituteId, userId);
    if (current && RANK[current] >= RANK[role]) return current;
    await db
      .insert(memberships)
      .values({ instituteId, userId, role })
      .onConflictDoUpdate({
        target: [memberships.instituteId, memberships.userId],
        set: { role },
      });
    return role;
  };

  const single = opts.single ? ensureSingleInstitute(db, opts.single.name) : null;

  return async (app: FastifyInstance) => {
    if (single) await single;

    app.get('/v1/institutes/config', async () => ({
      single: !!single,
      creation: single ? 'none' : opts.creation,
    }));

    app.get('/v1/me/institutes', async (req, reply) => {
      const u = await userOf(req, reply);
      if (!u) return;
      if (single) {
        const inst = await single;
        await join(inst.id, u.id, u.role === 'admin' ? 'owner' : 'student');
      }
      const rows = await db
        .select({
          id: institutes.id,
          slug: institutes.slug,
          name: institutes.name,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(institutes, eq(institutes.id, memberships.instituteId))
        .where(eq(memberships.userId, u.id))
        .orderBy(asc(institutes.name));
      return { institutes: rows };
    });

    app.post<{ Body: { name?: string; slug?: string } }>('/v1/institutes', async (req, reply) => {
      const u = await userOf(req, reply);
      if (!u) return;
      if (single) return reply.code(403).send({ error: 'this install serves one institute' });
      if (opts.creation === 'admin' && u.role !== 'admin')
        return reply.code(403).send({ error: 'only platform admins can create institutes' });
      const name = req.body?.name?.trim();
      if (!name || name.length > 120) return reply.code(400).send({ error: 'name is required' });
      const slug = req.body?.slug?.trim() || slugify(name);
      if (!SLUG.test(slug))
        return reply.code(400).send({ error: 'slug: 3-40 lowercase letters, digits or dashes' });
      const id = randomUUID();
      const created = await db
        .insert(institutes)
        .values({ id, slug, name })
        .onConflictDoNothing()
        .returning();
      if (!created.length) return reply.code(409).send({ error: 'that slug is taken' });
      await db.insert(memberships).values({ instituteId: id, userId: u.id, role: 'owner' });
      return reply.code(201).send({ id, slug, name, role: 'owner' });
    });

    app.get<{ Params: { id: string } }>('/v1/institutes/:id', async (req, reply) => {
      const m = await guard(req, reply, 'student');
      if (!m) return;
      const [inst] = await db.select().from(institutes).where(eq(institutes.id, req.params.id));
      return { id: inst!.id, slug: inst!.slug, name: inst!.name, role: m.role };
    });

    app.put<{ Params: { id: string }; Body: { name?: string } }>(
      '/v1/institutes/:id',
      async (req, reply) => {
        if (!(await guard(req, reply, 'owner'))) return;
        const name = req.body?.name?.trim();
        if (!name || name.length > 120) return reply.code(400).send({ error: 'name is required' });
        await db.update(institutes).set({ name }).where(eq(institutes.id, req.params.id));
        return { ok: true };
      },
    );

    app.get<{ Params: { id: string } }>('/v1/institutes/:id/members', async (req, reply) => {
      if (!(await guard(req, reply, 'teacher'))) return;
      const rows = await db
        .select({ id: user.id, name: user.name, email: user.email, role: memberships.role })
        .from(memberships)
        .innerJoin(user, eq(user.id, memberships.userId))
        .where(eq(memberships.instituteId, req.params.id))
        .orderBy(asc(user.name));
      return { members: rows };
    });

    app.put<{ Params: { id: string; userId: string }; Body: { role?: string } }>(
      '/v1/institutes/:id/members/:userId',
      async (req, reply) => {
        const m = await guard(req, reply, 'owner');
        if (!m) return;
        const role = req.body?.role as MemberRole;
        if (!MEMBER_ROLES.includes(role)) return reply.code(400).send({ error: 'unknown role' });
        if (req.params.userId === m.user.id && role !== 'owner')
          return reply.code(400).send({ error: 'ask another owner to change your role' });
        const done = await db
          .update(memberships)
          .set({ role })
          .where(
            and(
              eq(memberships.instituteId, req.params.id),
              eq(memberships.userId, req.params.userId),
            ),
          )
          .returning();
        if (!done.length) return reply.code(404).send({ error: 'member not found' });
        return { ok: true };
      },
    );

    /** Owners remove members; anyone may leave. Leaving also leaves the institute's classes. */
    app.delete<{ Params: { id: string; userId: string } }>(
      '/v1/institutes/:id/members/:userId',
      async (req, reply) => {
        const self = (await userOf(req, reply))?.id;
        if (!self) return;
        const m = await guard(req, reply, self === req.params.userId ? 'student' : 'owner');
        if (!m) return;
        const ids = db
          .select({ id: classes.id })
          .from(classes)
          .where(eq(classes.instituteId, req.params.id));
        await db
          .delete(classMembers)
          .where(
            and(eq(classMembers.userId, req.params.userId), inArray(classMembers.classId, ids)),
          );
        await db
          .delete(memberships)
          .where(
            and(
              eq(memberships.instituteId, req.params.id),
              eq(memberships.userId, req.params.userId),
            ),
          );
        return { ok: true };
      },
    );

    app.get<{ Params: { id: string } }>('/v1/institutes/:id/classes', async (req, reply) => {
      const m = await guard(req, reply, 'student');
      if (!m) return;
      const staff = m.role !== 'student';
      const size = sql<number>`(select count(*)::int from ${classMembers} cm where cm.class_id = ${classes.id})`;
      const rows = await db
        .select({
          id: classes.id,
          name: classes.name,
          inviteCode: classes.inviteCode,
          students: size,
        })
        .from(classes)
        .where(
          and(
            eq(classes.instituteId, req.params.id),
            staff
              ? undefined
              : inArray(
                  classes.id,
                  db
                    .select({ id: classMembers.classId })
                    .from(classMembers)
                    .where(eq(classMembers.userId, m.user.id)),
                ),
          ),
        )
        .orderBy(asc(classes.name));
      return {
        classes: rows.map((c) => (staff ? c : { id: c.id, name: c.name })),
      };
    });

    app.post<{ Params: { id: string }; Body: { name?: string } }>(
      '/v1/institutes/:id/classes',
      async (req, reply) => {
        if (!(await guard(req, reply, 'teacher'))) return;
        const name = req.body?.name?.trim();
        if (!name || name.length > 120) return reply.code(400).send({ error: 'name is required' });
        const row = {
          id: randomUUID(),
          instituteId: req.params.id,
          name,
          inviteCode: inviteCode(),
        };
        await db.insert(classes).values(row);
        return reply.code(201).send({ id: row.id, name, inviteCode: row.inviteCode, students: 0 });
      },
    );

    app.post<{ Params: { id: string; classId: string } }>(
      '/v1/institutes/:id/classes/:classId/new-code',
      async (req, reply) => {
        if (!(await guard(req, reply, 'teacher'))) return;
        if (!(await classIn(req.params.id, req.params.classId)))
          return reply.code(404).send({ error: 'class not found' });
        const code = inviteCode();
        await db
          .update(classes)
          .set({ inviteCode: code })
          .where(eq(classes.id, req.params.classId));
        return { inviteCode: code };
      },
    );

    app.delete<{ Params: { id: string; classId: string } }>(
      '/v1/institutes/:id/classes/:classId',
      async (req, reply) => {
        if (!(await guard(req, reply, 'teacher'))) return;
        const done = await db
          .delete(classes)
          .where(and(eq(classes.id, req.params.classId), eq(classes.instituteId, req.params.id)))
          .returning();
        if (!done.length) return reply.code(404).send({ error: 'class not found' });
        return { ok: true };
      },
    );

    /** A class's students with a short progress summary, for the teacher dashboard. */
    app.get<{ Params: { id: string; classId: string } }>(
      '/v1/institutes/:id/classes/:classId/students',
      async (req, reply) => {
        if (!(await guard(req, reply, 'teacher'))) return;
        const cls = await classIn(req.params.id, req.params.classId);
        if (!cls) return reply.code(404).send({ error: 'class not found' });
        const people = await db
          .select({ id: user.id, name: user.name, email: user.email })
          .from(classMembers)
          .innerJoin(user, eq(user.id, classMembers.userId))
          .where(eq(classMembers.classId, cls.id))
          .orderBy(asc(user.name));
        const ids = people.map((p) => p.id);
        const stats = ids.length
          ? await db
              .select({
                userId: attempts.userId,
                skill: attempts.skill,
                answered: sql<number>`count(*)::int`,
                score: sql<number>`sum(${attempts.score})::int`,
                max: sql<number>`sum(${attempts.max})::int`,
                lastAt: max(attempts.answeredAt),
              })
              .from(attempts)
              .where(inArray(attempts.userId, ids))
              .groupBy(attempts.userId, attempts.skill)
          : [];
        return {
          class: { id: cls.id, name: cls.name, inviteCode: cls.inviteCode },
          students: people.map((p) => {
            const mine = stats.filter((s) => s.userId === p.id);
            const last = mine.reduce<Date | null>(
              (a, s) => (s.lastAt && (!a || s.lastAt > a) ? s.lastAt : a),
              null,
            );
            return {
              ...p,
              answered: mine.reduce((n, s) => n + s.answered, 0),
              lastActive: last ? new Date(last).getTime() : null,
              skills: Object.fromEntries(
                mine.map((s) => [s.skill, { answered: s.answered, score: s.score, max: s.max }]),
              ),
            };
          }),
        };
      },
    );

    app.delete<{ Params: { id: string; classId: string; userId: string } }>(
      '/v1/institutes/:id/classes/:classId/students/:userId',
      async (req, reply) => {
        if (!(await guard(req, reply, 'teacher'))) return;
        if (!(await classIn(req.params.id, req.params.classId)))
          return reply.code(404).send({ error: 'class not found' });
        await db
          .delete(classMembers)
          .where(
            and(
              eq(classMembers.classId, req.params.classId),
              eq(classMembers.userId, req.params.userId),
            ),
          );
        return { ok: true };
      },
    );

    /**
     * Adds a class roster from CSV (`email,name`). People without an account get one, and sign in
     * later with an email link to the same address.
     */
    app.post<{ Params: { id: string; classId: string }; Body: { csv?: string } }>(
      '/v1/institutes/:id/classes/:classId/import',
      async (req, reply) => {
        if (!(await guard(req, reply, 'teacher'))) return;
        const cls = await classIn(req.params.id, req.params.classId);
        if (!cls) return reply.code(404).send({ error: 'class not found' });
        const { rows, invalid } = parseRoster(req.body?.csv ?? '');
        if (rows.length > MAX_IMPORT_ROWS)
          return reply.code(413).send({ error: `at most ${MAX_IMPORT_ROWS} rows at a time` });
        let created = 0;
        for (const r of rows) {
          let [found] = await db.select({ id: user.id }).from(user).where(eq(user.email, r.email));
          if (!found) {
            const now = new Date();
            [found] = await db
              .insert(user)
              .values({
                id: randomUUID(),
                email: r.email,
                name: r.name,
                emailVerified: false,
                createdAt: now,
                updatedAt: now,
              })
              .returning({ id: user.id });
            created++;
          }
          await join(req.params.id, found!.id, 'student');
          await db
            .insert(classMembers)
            .values({ classId: cls.id, userId: found!.id })
            .onConflictDoNothing();
        }
        return { added: rows.length, newAccounts: created, invalid };
      },
    );

    /** A student joins a class (and its institute) with the class's invite code. */
    app.post<{ Body: { code?: string } }>('/v1/join', async (req, reply) => {
      const u = await userOf(req, reply);
      if (!u) return;
      const code = req.body?.code?.trim().toUpperCase().replace(/[\s-]/g, '') ?? '';
      const [cls] = await db.select().from(classes).where(eq(classes.inviteCode, code));
      if (!cls) return reply.code(404).send({ error: 'no class has that code' });
      const role = await join(cls.instituteId, u.id, 'student');
      await db.insert(classMembers).values({ classId: cls.id, userId: u.id }).onConflictDoNothing();
      const [inst] = await db.select().from(institutes).where(eq(institutes.id, cls.instituteId));
      return {
        institute: { id: inst!.id, slug: inst!.slug, name: inst!.name, role },
        class: { id: cls.id, name: cls.name },
      };
    });
  };
}
