import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from './db/index.ts';
import { parseRoster } from './institutes.ts';
import { appWithAuth, WEB } from './test/auth.ts';
import { testDb } from './test/db.ts';

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await testDb());
});
afterAll(() => close());

describe('roster CSV', () => {
  it('reads email and name, skips the header, blanks and repeats, and reports bad lines', () => {
    const { rows, invalid } = parseRoster(
      'Email,Name\nasha@example.com, Asha Rai\n\nASHA@example.com,again\nnot-an-email,Bob\nbin@example.com\n',
    );
    expect(rows).toEqual([
      { email: 'asha@example.com', name: 'Asha Rai' },
      { email: 'bin@example.com', name: 'bin' },
    ]);
    expect(invalid).toEqual(['not-an-email,Bob']);
  });
});

describe('institutes', () => {
  it('keeps each institute’s members, classes and students to itself', async () => {
    const { app, signIn } = await appWithAuth(db);
    const call = (cookie: string, method: string, url: string, payload?: unknown) =>
      app.inject({
        method: method as 'GET',
        url,
        headers: {
          cookie,
          origin: WEB,
          ...(payload ? { 'content-type': 'application/json' } : {}),
        },
        payload: payload ? JSON.stringify(payload) : undefined,
      });

    const ownerA = await signIn('owner-a@example.com');
    const ownerB = await signIn('owner-b@example.com');
    const student = await signIn('student@example.com');

    const a = (
      await call(ownerA, 'POST', '/v1/institutes', { name: 'Kathmandu English Centre' })
    ).json();
    expect(a).toMatchObject({ slug: 'kathmandu-english-centre', role: 'owner' });
    const b = (await call(ownerB, 'POST', '/v1/institutes', { name: 'Pokhara PTE' })).json();
    expect(
      (await call(ownerB, 'POST', '/v1/institutes', { name: 'x', slug: a.slug })).statusCode,
    ).toBe(409);
    // The same name again gets a numbered slug instead of an error.
    const again = (
      await call(ownerB, 'POST', '/v1/institutes', { name: 'Kathmandu English Centre' })
    ).json();
    expect(again.slug).toBe('kathmandu-english-centre-2');
    await call(
      ownerB,
      'DELETE',
      `/v1/institutes/${again.id}/members/${(await call(ownerB, 'GET', '/v1/me')).json().id}`,
    );

    const cls = await call(ownerA, 'POST', `/v1/institutes/${a.id}/classes`, {
      name: 'Morning batch',
    });
    expect(cls.statusCode).toBe(201);
    const { id: classId, inviteCode } = cls.json();
    expect(inviteCode).toMatch(/^[A-Z2-9]{8}$/);

    // The student joins with the code, typed loosely.
    const joined = await call(student, 'POST', '/v1/join', {
      code: `${inviteCode.slice(0, 4).toLowerCase()}-${inviteCode.slice(4)}`,
    });
    expect(joined.json()).toMatchObject({ institute: { id: a.id, role: 'student' } });
    await call(student, 'POST', '/v1/me/attempts', {
      attempts: [
        {
          clientId: 'c1',
          questionId: 'reading-mcq-single-0001',
          type: 'reading_mcq_single',
          skill: 'reading',
          score: 1,
          max: 1,
          at: Date.now(),
        },
      ],
    });

    const roster = (
      await call(ownerA, 'GET', `/v1/institutes/${a.id}/classes/${classId}/students`)
    ).json();
    expect(roster.students).toHaveLength(1);
    expect(roster.students[0]).toMatchObject({
      email: 'student@example.com',
      answered: 1,
      skills: { reading: { score: 1, max: 1 } },
    });

    // Institute B's owner sees nothing of A, however the URL is written.
    for (const url of [
      `/v1/institutes/${a.id}`,
      `/v1/institutes/${a.id}/members`,
      `/v1/institutes/${a.id}/classes`,
      `/v1/institutes/${a.id}/classes/${classId}/students`,
    ])
      expect((await call(ownerB, 'GET', url)).statusCode, url).toBe(404);
    // A's class cannot be reached through B either.
    expect(
      (await call(ownerB, 'GET', `/v1/institutes/${b.id}/classes/${classId}/students`)).statusCode,
    ).toBe(404);
    expect(
      (await call(ownerB, 'DELETE', `/v1/institutes/${b.id}/classes/${classId}`)).statusCode,
    ).toBe(404);
    expect(
      (
        await call(ownerB, 'POST', `/v1/institutes/${b.id}/classes/${classId}/import`, {
          csv: 'x@example.com',
        })
      ).statusCode,
    ).toBe(404);

    // Students see their own classes without codes, and no staff pages.
    const mine = (await call(student, 'GET', `/v1/institutes/${a.id}/classes`)).json();
    expect(mine.classes).toEqual([{ id: classId, name: 'Morning batch' }]);
    expect((await call(student, 'GET', `/v1/institutes/${a.id}/members`)).statusCode).toBe(403);
    expect(
      (await call(student, 'GET', `/v1/institutes/${a.id}/classes/${classId}/students`)).statusCode,
    ).toBe(403);

    // Lists only ever show the caller's own institutes.
    expect((await call(ownerB, 'GET', '/v1/me/institutes')).json().institutes).toEqual([
      { id: b.id, slug: 'pokhara-pte', name: 'Pokhara PTE', role: 'owner' },
    ]);
  });

  it('owners manage roles; teachers import rosters; members can leave', async () => {
    const { app, signIn } = await appWithAuth(db);
    const call = (cookie: string, method: string, url: string, payload?: unknown) =>
      app.inject({
        method: method as 'GET',
        url,
        headers: {
          cookie,
          origin: WEB,
          ...(payload ? { 'content-type': 'application/json' } : {}),
        },
        payload: payload ? JSON.stringify(payload) : undefined,
      });
    const owner = await signIn('owner-c@example.com');
    const teacher = await signIn('teacher-c@example.com');
    const inst = (await call(owner, 'POST', '/v1/institutes', { name: 'Chitwan Academy' })).json();
    const cls = (
      await call(owner, 'POST', `/v1/institutes/${inst.id}/classes`, { name: 'Evening' })
    ).json();
    await call(teacher, 'POST', '/v1/join', { code: cls.inviteCode });
    const members = (await call(owner, 'GET', `/v1/institutes/${inst.id}/members`)).json().members;
    const teacherId = members.find(
      (m: { email: string }) => m.email === 'teacher-c@example.com',
    ).id;

    expect(
      (await call(teacher, 'POST', `/v1/institutes/${inst.id}/classes`, { name: 'x' })).statusCode,
    ).toBe(403);
    await call(owner, 'PUT', `/v1/institutes/${inst.id}/members/${teacherId}`, { role: 'teacher' });
    expect(
      (
        await call(teacher, 'PUT', `/v1/institutes/${inst.id}/members/${teacherId}`, {
          role: 'owner',
        })
      ).statusCode,
    ).toBe(403);

    const imported = await call(
      teacher,
      'POST',
      `/v1/institutes/${inst.id}/classes/${cls.id}/import`,
      {
        csv: 'email,name\nnew1@example.com,New One\nteacher-c@example.com,Me\nbad line',
      },
    );
    expect(imported.json()).toEqual({ added: 2, newAccounts: 1, invalid: ['bad line'] });
    // Importing a teacher into a class does not demote them.
    const after = (await call(owner, 'GET', `/v1/institutes/${inst.id}/members`)).json().members;
    expect(after.find((m: { id: string }) => m.id === teacherId).role).toBe('teacher');
    // The imported student can sign in later and is already in the class.
    const newcomer = await signIn('new1@example.com');
    expect(
      (await call(newcomer, 'GET', `/v1/institutes/${inst.id}/classes`)).json().classes,
    ).toEqual([{ id: cls.id, name: 'Evening' }]);

    const me = (await call(newcomer, 'GET', '/v1/me')).json().id;
    expect(
      (await call(newcomer, 'DELETE', `/v1/institutes/${inst.id}/members/${me}`)).statusCode,
    ).toBe(200);
    expect((await call(newcomer, 'GET', `/v1/institutes/${inst.id}`)).statusCode).toBe(404);
    expect(
      (await call(teacher, 'DELETE', `/v1/institutes/${inst.id}/members/${me}`)).statusCode,
    ).toBe(403);
  });

  it('admins only, when the hosted install says so', async () => {
    const { app, signIn } = await appWithAuth(db, {
      adminEmails: ['boss@example.com'],
      institutes: { creation: 'admin' },
    });
    const post = (cookie: string) =>
      app.inject({
        method: 'POST',
        url: '/v1/institutes',
        headers: { cookie, origin: WEB, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Butwal Centre' }),
      });
    expect((await post(await signIn('anyone@example.com'))).statusCode).toBe(403);
    expect((await post(await signIn('boss@example.com'))).statusCode).toBe(201);
  });
});

describe('single-institute install', () => {
  it('puts everyone in the one institute and makes admins its owners', async () => {
    const own = await testDb();
    try {
      const { app, signIn } = await appWithAuth(own.db, {
        adminEmails: ['head@example.com'],
        institutes: { creation: 'anyone', single: { name: 'Lalitpur Learning' } },
      });
      const list = async (cookie: string) =>
        (await app.inject({ url: '/v1/me/institutes', headers: { cookie } })).json().institutes;
      expect((await app.inject('/v1/institutes/config')).json()).toEqual({
        single: true,
        creation: 'none',
      });
      expect(await list(await signIn('head@example.com'))).toMatchObject([
        { name: 'Lalitpur Learning', role: 'owner' },
      ]);
      const learner = await signIn('learner@example.com');
      expect(await list(learner)).toMatchObject([{ name: 'Lalitpur Learning', role: 'student' }]);
      const create = await app.inject({
        method: 'POST',
        url: '/v1/institutes',
        headers: { cookie: learner, origin: WEB, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Another' }),
      });
      expect(create.statusCode).toBe(403);
    } finally {
      await own.close();
    }
  });
});
