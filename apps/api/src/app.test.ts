import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@openpte/schema/node';
import { buildApp } from './app.ts';
import type { Db } from './db/index.ts';
import { seed } from './seed.ts';
import { testDb } from './test/db.ts';

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await testDb());
  const result = await seed(db, loadContent(process.cwd()));
  expect(result.itemTypes).toBe(22);
});
afterAll(() => close());

describe('api', () => {
  it('reports health', async () => {
    const app = await buildApp({ db });
    const res = await app.inject('/health');
    expect(res.json()).toEqual({ ok: true });
  });

  it('lists item types in registry order with counts of visible questions', async () => {
    const published = await buildApp({ db });
    const body = (await published.inject('/v1/item-types')).json();
    expect(body.itemTypes).toHaveLength(22);
    expect(body.itemTypes[0].id).toBe('speaking_read_aloud');
    // The seed bank is still in review, so nothing is visible without the flag.
    expect(body.itemTypes[0].question_count).toBe(0);
    const demo = await buildApp({ db, includeUnreviewed: true });
    expect((await demo.inject('/v1/item-types')).json().itemTypes[0].question_count).toBe(10);
  });

  it('serves the questions of a type and a single question', async () => {
    const app = await buildApp({ db, includeUnreviewed: true });
    const list = (await app.inject('/v1/questions?type=reading_mcq_single')).json();
    expect(list.questions).toHaveLength(10);
    expect(list.questions[0]).toMatchObject({ id: 'reading-mcq-single-0001', answer: 0 });
    const one = await app.inject('/v1/questions/reading-mcq-single-0002');
    expect(one.json().type).toBe('reading_mcq_single');
    expect((await app.inject('/v1/questions/nope')).statusCode).toBe(404);
    expect((await app.inject('/v1/questions')).statusCode).toBe(400);
  });

  it('hides unreviewed questions by default', async () => {
    const app = await buildApp({ db });
    expect((await app.inject('/v1/questions/reading-mcq-single-0001')).statusCode).toBe(404);
  });

  it('seeding twice is safe', async () => {
    await seed(db, loadContent(process.cwd()));
    const app = await buildApp({ db, includeUnreviewed: true });
    const list = (await app.inject('/v1/questions?type=reading_mcq_single')).json();
    expect(list.questions).toHaveLength(10);
  });
});
