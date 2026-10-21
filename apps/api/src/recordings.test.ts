import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from './db/index.ts';
import { purgeExpired } from './recordings.ts';
import { memoryStorage } from './storage.ts';
import { appWithAuth } from './test/auth.ts';
import { testDb } from './test/db.ts';

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await testDb());
});
afterAll(() => close());

describe('recordings', () => {
  it('saves, replays, lists, deletes and expires a learner’s recording', async () => {
    const storage = memoryStorage();
    const { app, signIn } = await appWithAuth(db, { storage });
    const cookie = await signIn('speaker@example.com');
    const other = await signIn('someone@example.com');
    const audio = Buffer.from('OggS fake opus bytes');
    const up = (c: string, type = 'audio/webm;codecs=opus', body: Buffer = audio) =>
      app.inject({
        method: 'POST',
        url: '/v1/me/recordings?questionId=speaking-read-aloud-0001&type=speaking_read_aloud',
        headers: { cookie: c, 'content-type': type },
        payload: body,
      });

    expect((await app.inject('/v1/auth/config')).json().recordings).toBe(true);
    const saved = await up(cookie);
    expect(saved.statusCode).toBe(201);
    const { id } = saved.json();

    const replay = await app.inject({ url: `/v1/me/recordings/${id}`, headers: { cookie } });
    expect(replay.headers['content-type']).toBe('audio/webm');
    expect(replay.rawPayload.equals(audio)).toBe(true);
    // Nobody else can hear it.
    expect(
      (await app.inject({ url: `/v1/me/recordings/${id}`, headers: { cookie: other } })).statusCode,
    ).toBe(404);
    expect((await up(cookie, 'text/plain')).statusCode).toBe(415);
    expect((await up(cookie, 'audio/webm', Buffer.alloc(6 * 1024 * 1024))).statusCode).toBe(413);

    const list = (await app.inject({ url: '/v1/me/recordings', headers: { cookie } })).json();
    expect(list.recordings).toHaveLength(1);

    // Expiry: nothing is due now; in 31 days it is gone.
    expect(await purgeExpired(db, storage)).toBe(0);
    const second = (await up(cookie)).json().id as string;
    expect(await purgeExpired(db, storage, new Date(Date.now() + 31 * 86_400_000))).toBe(2);
    expect(
      (await app.inject({ url: `/v1/me/recordings/${second}`, headers: { cookie } })).statusCode,
    ).toBe(404);

    const third = (await up(cookie)).json().id as string;
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/me/recordings/${third}`,
      headers: { cookie },
    });
    expect(del.json()).toEqual({ deleted: true });
    expect(
      (await app.inject({ url: '/v1/me/recordings', headers: { cookie } })).json().recordings,
    ).toEqual([]);
  });
});
