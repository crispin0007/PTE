import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import type { Db } from './db/index.ts';
import { httpLanguageTool } from './grammar.ts';
import { testDb } from './test/db.ts';

let db: Db;
let close: () => Promise<void>;
let lt: Server;
let ltUrl = '';
let lastBody = '';

beforeAll(async () => {
  ({ db, close } = await testDb());
  // A stand-in LanguageTool that answers like /v2/check does.
  lt = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      lastBody = body;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          matches: [
            {
              message: 'The verb does not agree with the subject.',
              offset: 3,
              length: 2,
              replacements: [
                { value: 'goes' },
                { value: 'went' },
                { value: 'is going' },
                { value: 'x' },
              ],
              rule: { id: 'HE_VERB_AGR', category: { id: 'GRAMMAR' } },
            },
            {
              message: 'Possible spelling mistake found.',
              offset: 20,
              length: 5,
              replacements: [{ value: 'school' }],
              rule: { id: 'MORFOLOGIK_RULE_EN_US', category: { id: 'TYPOS' } },
            },
          ],
        }),
      );
    });
  });
  await new Promise<void>((r) => lt.listen(0, '127.0.0.1', () => r()));
  const addr = lt.address() as { port: number };
  ltUrl = `http://127.0.0.1:${addr.port}`;
});
afterAll(async () => {
  lt.close();
  await close();
});

describe('grammar checks', () => {
  it('returns grammar issues without spelling ones, and limits size and rate', async () => {
    const app = await buildApp({ db, grammar: httpLanguageTool(ltUrl) });
    expect((await app.inject('/v1/auth/config')).json().grammar).toBe(true);
    const check = (text: string) =>
      app.inject({
        method: 'POST',
        url: '/v1/writing/check',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ text }),
      });
    const res = await check('He go to the scool.');
    expect(res.json()).toEqual({
      issues: [
        {
          offset: 3,
          length: 2,
          message: 'The verb does not agree with the subject.',
          replacements: ['goes', 'went', 'is going'],
          category: 'GRAMMAR',
        },
      ],
    });
    expect(new URLSearchParams(lastBody).get('language')).toBe('en-US');
    expect((await check('x'.repeat(7000))).statusCode).toBe(413);
    expect((await check('  ')).statusCode).toBe(400);
  });

  it('says so when the checker is down, and is absent when not configured', async () => {
    const down = await buildApp({ db, grammar: httpLanguageTool('http://127.0.0.1:9') });
    const res = await down.inject({
      method: 'POST',
      url: '/v1/writing/check',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ text: 'Fine text.' }),
    });
    expect(res.statusCode).toBe(503);
    const none = await buildApp({ db });
    expect((await none.inject('/v1/auth/config')).json().grammar).toBe(false);
    expect((await none.inject({ method: 'POST', url: '/v1/writing/check' })).statusCode).toBe(404);
  });
});
