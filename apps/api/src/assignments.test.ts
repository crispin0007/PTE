import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from './db/index.ts';
import { appWithAuth, WEB } from './test/auth.ts';
import { testDb } from './test/db.ts';

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await testDb());
});
afterAll(() => close());

describe('assignments', () => {
  it('a student sees a practice set and a mock, and the teacher sees who finished', async () => {
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
    const teacher = await signIn('t@example.com');
    const student = await signIn('s@example.com');
    const outsider = await signIn('o@example.com');
    const inst = (await call(teacher, 'POST', '/v1/institutes', { name: 'Assign Test' })).json();
    const cls = (
      await call(teacher, 'POST', `/v1/institutes/${inst.id}/classes`, { name: 'A' })
    ).json();
    await call(student, 'POST', '/v1/join', { code: cls.inviteCode });
    const base = `/v1/institutes/${inst.id}/classes/${cls.id}/assignments`;
    const due = Date.now() + 3 * 86_400_000;

    expect(
      (
        await call(teacher, 'POST', base, {
          title: 'x',
          dueAt: due,
          spec: { kind: 'practice', types: ['not_a_type'], count: 2 },
        })
      ).statusCode,
    ).toBe(400);
    const practice = (
      await call(teacher, 'POST', base, {
        title: 'Two dictations',
        dueAt: due,
        spec: { kind: 'practice', types: ['listening_write_from_dictation'], count: 2 },
      })
    ).json();
    const mock = (
      await call(teacher, 'POST', base, {
        title: 'Reading mock',
        dueAt: due + 1000,
        spec: { kind: 'mock', mockId: 'reading' },
      })
    ).json();
    expect((await call(student, 'POST', base, { title: 'x' })).statusCode).toBe(403);

    const answer = (questionId: string, clientId: string) =>
      call(student, 'POST', '/v1/me/attempts', {
        attempts: [
          {
            clientId,
            questionId,
            type: 'listening_write_from_dictation',
            skill: 'listening',
            score: 3,
            max: 5,
            at: Date.now(),
          },
        ],
      });
    await answer('listening-write-from-dictation-0001', 'a1');
    await answer('listening-write-from-dictation-0001', 'a2'); // the same question twice counts once
    let mine = (await call(student, 'GET', '/v1/me/assignments')).json().assignments;
    expect(mine.map((a: { title: string }) => a.title)).toEqual(['Two dictations', 'Reading mock']);
    expect(mine[0]).toMatchObject({ done: 1, target: 2, className: 'A' });
    await answer('listening-write-from-dictation-0002', 'a3');

    expect(
      (
        await call(student, 'POST', `/v1/me/assignments/${mock.id}/submit`, {
          result: { overall: 61, skills: { reading: 61, writing: 58 }, questions: 15 },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await call(student, 'POST', `/v1/me/assignments/${practice.id}/submit`, { result: {} }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await call(outsider, 'POST', `/v1/me/assignments/${mock.id}/submit`, {
          result: { overall: 90, skills: {}, questions: 1 },
        })
      ).statusCode,
    ).toBe(404);
    expect((await call(outsider, 'GET', '/v1/me/assignments')).json().assignments).toEqual([]);

    mine = (await call(student, 'GET', '/v1/me/assignments')).json().assignments;
    expect(mine.map((a: { done: number }) => a.done)).toEqual([2, 1]);
    const list = (await call(teacher, 'GET', base)).json().assignments;
    expect(list.map((a: { complete: number }) => a.complete)).toEqual([1, 1]);
    expect(list[1].students[0].result).toMatchObject({ overall: 61 });
    expect((await call(outsider, 'GET', base)).statusCode).toBe(404);

    expect((await call(teacher, 'DELETE', `${base}/${practice.id}`)).statusCode).toBe(200);
    expect((await call(student, 'GET', '/v1/me/assignments')).json().assignments).toHaveLength(1);
  });
});
