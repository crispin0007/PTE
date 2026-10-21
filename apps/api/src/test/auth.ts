import { expect } from 'vitest';
import { buildApp } from '../app.ts';
import { createAuth } from '../auth.ts';
import type { Db } from '../db/index.ts';
import type { Mail } from '../mail.ts';
import type { InstituteOptions } from '../institutes.ts';
import type { ScoringOptions } from '../recordings.ts';
import type { Storage } from '../storage.ts';

export const WEB = 'http://localhost:5173';

export async function appWithAuth(
  db: Db,
  opts: {
    adminEmails?: string[];
    storage?: Storage;
    scoring?: ScoringOptions;
    institutes?: InstituteOptions;
  } = {},
) {
  const outbox: Mail[] = [];
  const auth = createAuth({
    db,
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-test-secret-test-secret-00',
    mailer: { send: async (m) => void outbox.push(m) },
    trustedOrigins: [WEB],
    adminEmails: opts.adminEmails,
  });
  const app = await buildApp({
    db,
    auth,
    corsOrigin: WEB,
    storage: opts.storage,
    scoring: opts.scoring,
    institutes: opts.institutes,
  });

  /** Signs in by email link and returns the session cookie. */
  async function signIn(email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/magic-link',
      headers: { origin: WEB, 'content-type': 'application/json' },
      payload: JSON.stringify({ email, callbackURL: `${WEB}/#/more` }),
    });
    expect(res.statusCode).toBe(200);
    const mail = outbox.at(-1)!;
    expect(mail.to).toBe(email);
    const link = new URL(mail.text.match(/https?:\/\/\S+/)![0]);
    const verify = await app.inject({ method: 'GET', url: link.pathname + link.search });
    expect(verify.statusCode).toBe(302);
    expect(verify.headers.location).toContain(`${WEB}/#/more`);
    const cookie = ([] as string[])
      .concat(verify.headers['set-cookie'] ?? [])
      .map((c) => c.split(';')[0])
      .join('; ');
    expect(cookie).toContain('session_token');
    return cookie;
  }

  return { app, signIn, outbox };
}
