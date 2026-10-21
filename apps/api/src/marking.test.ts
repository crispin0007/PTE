import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from './db/index.ts';
import { memoryStorage } from './storage.ts';
import { appWithAuth, WEB } from './test/auth.ts';
import { testDb } from './test/db.ts';

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await testDb());
});
afterAll(() => close());

describe('teacher marking', () => {
  it('a student sends an essay and a recording; a teacher marks them and progress updates', async () => {
    const { app, signIn } = await appWithAuth(db, { storage: memoryStorage() });
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
    const teacher = await signIn('mark-t@example.com');
    const student = await signIn('mark-s@example.com');
    const outsider = await signIn('mark-o@example.com');
    const inst = (await call(teacher, 'POST', '/v1/institutes', { name: 'Mark Test' })).json();
    const cls = (
      await call(teacher, 'POST', `/v1/institutes/${inst.id}/classes`, { name: 'M' })
    ).json();
    await call(student, 'POST', '/v1/join', { code: cls.inviteCode });

    const essay = {
      instituteId: inst.id,
      questionId: 'writing-essay-0001',
      type: 'writing_essay',
      answerText: 'My essay text.',
      score: 4,
      max: 4,
    };
    expect((await call(outsider, 'POST', '/v1/me/marking', essay)).statusCode).toBe(404);
    expect(
      (await call(student, 'POST', '/v1/me/marking', { ...essay, answerText: undefined }))
        .statusCode,
    ).toBe(400);
    const sent = await call(student, 'POST', '/v1/me/marking', essay);
    expect(sent.statusCode).toBe(201);

    const audio = Buffer.from('OggS fake');
    const rec = (
      await app.inject({
        method: 'POST',
        url: '/v1/me/recordings?questionId=speaking-describe-image-0001&type=speaking_describe_image',
        headers: { cookie: student, 'content-type': 'audio/webm' },
        payload: audio,
      })
    ).json();
    // Someone else's recording cannot be sent.
    expect(
      (
        await call(outsider, 'POST', '/v1/me/marking', {
          ...essay,
          answerText: undefined,
          recordingId: rec.id,
        })
      ).statusCode,
    ).toBe(404);
    await call(student, 'POST', '/v1/me/marking', {
      instituteId: inst.id,
      questionId: 'speaking-describe-image-0001',
      type: 'speaking_describe_image',
      recordingId: rec.id,
      score: 0,
      max: 5,
    });

    const queue = (await call(teacher, 'GET', `/v1/institutes/${inst.id}/marking`)).json().requests;
    expect(queue.map((r: { type: string }) => r.type)).toEqual([
      'writing_essay',
      'speaking_describe_image',
    ]);
    expect(queue[0].student.email).toBe('mark-s@example.com');
    const speech = queue[1];
    const played = await call(
      teacher,
      'GET',
      `/v1/institutes/${inst.id}/marking/${speech.id}/audio`,
    );
    expect(played.rawPayload.equals(audio)).toBe(true);
    expect((await call(student, 'GET', `/v1/institutes/${inst.id}/marking`)).statusCode).toBe(403);
    expect((await call(outsider, 'GET', `/v1/institutes/${inst.id}/marking`)).statusCode).toBe(404);

    const url = `/v1/institutes/${inst.id}/marking/${speech.id}`;
    expect((await call(teacher, 'PUT', url, { score: 6 })).statusCode).toBe(400);
    expect(
      (await call(teacher, 'PUT', url, { score: 3, comment: 'Clear, but name the trend.' }))
        .statusCode,
    ).toBe(200);

    const mine = (await call(student, 'GET', '/v1/me/marking')).json().requests;
    expect(mine.find((r: { id: string }) => r.id === speech.id)).toMatchObject({
      teacherScore: 3,
      max: 5,
      comment: 'Clear, but name the trend.',
    });
    const history = (await call(student, 'GET', '/v1/me/attempts')).json().attempts;
    expect(history.at(-1)).toMatchObject({
      clientId: `mark:${speech.id}`,
      questionId: 'speaking-describe-image-0001',
      skill: 'speaking',
      score: 3,
      max: 5,
    });
    const left = (await call(teacher, 'GET', `/v1/institutes/${inst.id}/marking`)).json().requests;
    expect(left).toHaveLength(1);
  });
});
