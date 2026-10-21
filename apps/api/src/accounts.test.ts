import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { createAuth } from './auth.ts';
import type { Db } from './db/index.ts';
import type { Mail } from './mail.ts';
import { testDb } from './test/db.ts';

const WEB = 'http://localhost:5173';
let db: Db;
let close: () => Promise<void>;
const outbox: Mail[] = [];

beforeAll(async () => {
  ({ db, close } = await testDb());
});
afterAll(() => close());

async function app() {
  const auth = createAuth({
    db,
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-test-secret-test-secret-00',
    mailer: { send: async (m) => void outbox.push(m) },
    trustedOrigins: [WEB],
  });
  return buildApp({ db, auth, corsOrigin: WEB });
}

/** Signs in by email link and returns the session cookie. */
async function signIn(a: Awaited<ReturnType<typeof app>>, email: string) {
  const res = await a.inject({
    method: 'POST',
    url: '/api/auth/sign-in/magic-link',
    headers: { origin: WEB, 'content-type': 'application/json' },
    payload: JSON.stringify({ email, callbackURL: `${WEB}/#/more` }),
  });
  expect(res.statusCode).toBe(200);
  const mail = outbox.at(-1)!;
  expect(mail.to).toBe(email);
  const link = new URL(mail.text.match(/https?:\/\/\S+/)![0]);
  const verify = await a.inject({ method: 'GET', url: link.pathname + link.search });
  expect(verify.statusCode).toBe(302);
  expect(verify.headers.location).toContain(`${WEB}/#/more`);
  const cookie = ([] as string[])
    .concat(verify.headers['set-cookie'] ?? [])
    .map((c) => c.split(';')[0])
    .join('; ');
  expect(cookie).toContain('session_token');
  return cookie;
}

const attempt = (clientId: string, score = 1) => ({
  clientId,
  questionId: 'reading-mcq-single-0001',
  type: 'reading_mcq_single',
  skill: 'reading',
  score,
  max: 1,
  at: 1_790_000_000_000,
});

describe('accounts', () => {
  it('reports that accounts are on', async () => {
    const a = await app();
    expect((await a.inject('/v1/auth/config')).json()).toEqual({ accounts: true, google: false });
  });

  it('signs in by email link and returns the user as a learner', async () => {
    const a = await app();
    expect((await a.inject('/v1/me')).statusCode).toBe(401);
    const cookie = await signIn(a, 'learner@example.com');
    const me = await a.inject({ url: '/v1/me', headers: { cookie } });
    expect(me.json()).toMatchObject({ email: 'learner@example.com', role: 'learner' });
  });

  it('syncs attempts without duplicates and keeps users apart', async () => {
    const a = await app();
    const cookie = await signIn(a, 'sync@example.com');
    const post = (attempts: unknown[], c = cookie) =>
      a.inject({
        method: 'POST',
        url: '/v1/me/attempts',
        headers: { cookie: c, 'content-type': 'application/json' },
        payload: { attempts },
      });
    expect((await post([attempt('a1'), attempt('a2', 0)])).json()).toEqual({ inserted: 2 });
    // Uploading the same history again, e.g. from a second device, adds nothing.
    expect((await post([attempt('a1'), attempt('a3')])).json()).toEqual({ inserted: 1 });
    const mine = (await a.inject({ url: '/v1/me/attempts', headers: { cookie } })).json();
    expect(mine.attempts.map((x: { clientId: string }) => x.clientId).sort()).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
    const other = await signIn(a, 'other@example.com');
    const theirs = (await a.inject({ url: '/v1/me/attempts', headers: { cookie: other } })).json();
    expect(theirs.attempts).toEqual([]);
    expect((await post([{ ...attempt('x'), skill: 'cooking' }])).statusCode).toBe(400);
  });

  it('stores bookmarks and settings', async () => {
    const a = await app();
    const cookie = await signIn(a, 'state@example.com');
    const put = await a.inject({
      method: 'PUT',
      url: '/v1/me/state',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { bookmarks: ['q1'], settings: { dailyGoal: 10 } },
    });
    expect(put.statusCode).toBe(200);
    const got = (await a.inject({ url: '/v1/me/state', headers: { cookie } })).json();
    expect(got).toEqual({ bookmarks: ['q1'], settings: { dailyGoal: 10 } });
  });

  it('keeps accounts off when any origin may call the API', async () => {
    const a = await buildApp({ db, corsOrigin: '*' });
    expect((await a.inject('/v1/auth/config')).json().accounts).toBe(false);
    expect((await a.inject('/v1/me')).statusCode).toBe(404);
  });
});
