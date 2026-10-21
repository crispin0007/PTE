import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@openpte/schema/node';
import type { Db } from './db/index.ts';
import { seed } from './seed.ts';
import { appWithAuth } from './test/auth.ts';
import { testDb } from './test/db.ts';

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await testDb());
  await seed(db, loadContent(process.cwd()));
});
afterAll(() => close());

describe('question bank admin', () => {
  it('an author publishes a question after two reviews by other people', async () => {
    const { app, signIn } = await appWithAuth(db, { adminEmails: ['admin@example.com'] });
    const admin = await signIn('admin@example.com');
    const author = await signIn('author@example.com');
    const r1 = await signIn('reviewer1@example.com');
    const r2 = await signIn('reviewer2@example.com');
    const learner = await signIn('learner@example.com');

    const call = (cookie: string, method: string, url: string, payload?: unknown) =>
      app.inject({
        method: method as 'GET',
        url,
        headers: { cookie, ...(payload ? { 'content-type': 'application/json' } : {}) },
        payload: payload as object,
      });

    // Learners cannot use the admin; the admin makes the others teachers.
    expect((await call(learner, 'GET', '/v1/admin/questions')).statusCode).toBe(403);
    const users = (await call(admin, 'GET', '/v1/admin/users')).json().users as {
      id: string;
      email: string;
    }[];
    for (const email of ['author@example.com', 'reviewer1@example.com', 'reviewer2@example.com']) {
      const u = users.find((x) => x.email === email)!;
      expect(
        (await call(admin, 'PUT', `/v1/admin/users/${u.id}/role`, { role: 'teacher' })).statusCode,
      ).toBe(200);
    }

    // Start from a template, edit it, and save a draft.
    const template = (await call(author, 'GET', '/v1/admin/templates/reading_mcq_single')).json();
    expect(template).toMatchObject({ id: 'reading-mcq-single-0011', status: 'draft' });
    const draft = { ...template, question: 'What does the passage mainly discuss?', difficulty: 2 };
    const bad = await call(author, 'POST', '/v1/admin/questions', {
      question: { ...draft, answer: 9 },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errors.join()).toMatch(/out of range/);
    expect(
      (await call(author, 'POST', '/v1/admin/questions', { question: draft })).statusCode,
    ).toBe(201);
    const id = template.id as string;

    // Submit for review. The author may not review their own question.
    expect((await call(author, 'POST', `/v1/admin/questions/${id}/submit`)).json().status).toBe(
      'in_review',
    );
    expect(
      (await call(author, 'POST', `/v1/admin/questions/${id}/reviews`, { verdict: 'approve' }))
        .statusCode,
    ).toBe(403);

    // One approval is not enough; a request for changes blocks publishing until resolved.
    await call(r1, 'POST', `/v1/admin/questions/${id}/reviews`, { verdict: 'approve' });
    expect((await call(author, 'POST', `/v1/admin/questions/${id}/publish`)).statusCode).toBe(409);
    await call(r2, 'POST', `/v1/admin/questions/${id}/reviews`, {
      verdict: 'changes',
      comment: 'Option B is ambiguous.',
    });
    expect((await call(author, 'POST', `/v1/admin/questions/${id}/publish`)).json().error).toMatch(
      /changes/,
    );
    // r2 changes their mind after a closer look.
    await call(r2, 'POST', `/v1/admin/questions/${id}/reviews`, { verdict: 'approve' });

    const pub = await call(author, 'POST', `/v1/admin/questions/${id}/publish`);
    expect(pub.statusCode).toBe(200);
    expect(pub.json().reviewed_by).toHaveLength(2);

    // Published questions are served to learners, and export as YAML.
    expect((await app.inject(`/v1/questions/${id}`)).json()).toMatchObject({
      id,
      status: 'published',
    });
    const yaml = await call(author, 'GET', `/v1/admin/questions/${id}/yaml`);
    expect(yaml.body).toContain(`id: ${id}`);
    expect(yaml.body).toContain('status: published');

    // Editing sends it back to review and clears the reviews.
    const edit = await call(author, 'PUT', `/v1/admin/questions/${id}`, {
      question: { ...draft, difficulty: 3 },
    });
    expect(edit.json().status).toBe('in_review');
    const detail = (await call(r1, 'GET', `/v1/admin/questions/${id}`)).json();
    expect(detail.reviews).toEqual([]);
    expect(detail.canReview).toBe(true);
    expect((await app.inject(`/v1/questions/${id}`)).statusCode).toBe(404);

    // Reviewers cannot edit someone else's question; seeding does not overwrite admin edits.
    expect(
      (await call(r1, 'PUT', `/v1/admin/questions/${id}`, { question: draft })).statusCode,
    ).toBe(403);
  });

  it('seeding keeps questions edited in the admin', async () => {
    const { app, signIn } = await appWithAuth(db, { adminEmails: ['admin2@example.com'] });
    const admin = await signIn('admin2@example.com');
    const id = 'reading-mcq-single-0001';
    const current = (
      await app.inject({ url: `/v1/admin/questions/${id}`, headers: { cookie: admin } })
    ).json();
    const changed = { ...current.question, question: 'Edited in the admin?' };
    const put = await app.inject({
      method: 'PUT',
      url: `/v1/admin/questions/${id}`,
      headers: { cookie: admin, 'content-type': 'application/json' },
      payload: { question: changed },
    });
    expect(put.statusCode).toBe(200);
    await seed(db, loadContent(process.cwd()));
    const after = (
      await app.inject({ url: `/v1/admin/questions/${id}`, headers: { cookie: admin } })
    ).json();
    expect(after.question.question).toBe('Edited in the admin?');
    expect(after.origin).toBe('admin');
  });
});
