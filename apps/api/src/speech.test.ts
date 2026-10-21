import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@openpte/schema/node';
import type { Db } from './db/index.ts';
import { seed } from './seed.ts';
import type { SpeechClient } from './speech.ts';
import { memoryStorage } from './storage.ts';
import { appWithAuth } from './test/auth.ts';
import { testDb } from './test/db.ts';

let db: Db;
let close: () => Promise<void>;
let readAloudText = '';
beforeAll(async () => {
  ({ db, close } = await testDb());
  const bank = loadContent(process.cwd());
  await seed(db, bank);
  const q = bank.questions.find((x) => x.question.id === 'speaking-read-aloud-0001')!.question;
  readAloudText = (q as { text: string }).text;
});
afterAll(() => close());

/** Pretends the learner read the text perfectly at 140 words a minute. */
const perfectReader = (text: () => string): SpeechClient => ({
  transcribe: async () => {
    const ws = text().split(/\s+/);
    return {
      engine: 'fake',
      duration: ws.length * 0.43 + 1,
      words: ws.map((word, i) => ({
        word,
        start: 0.5 + i * 0.43,
        end: 0.85 + i * 0.43,
        probability: 0.93,
      })),
    };
  },
});

describe('speech scoring', () => {
  it('scores a saved Read Aloud recording, caches it and enforces the daily limit', async () => {
    let calls = 0;
    const speech = perfectReader(() => readAloudText);
    const counting: SpeechClient = { transcribe: (a, m) => (calls++, speech.transcribe(a, m)) };
    const { app, signIn } = await appWithAuth(db, {
      storage: memoryStorage(),
      scoring: { speech: counting, dailyLimit: 1 },
    });
    const cookie = await signIn('reader@example.com');
    const save = async () =>
      (
        await app.inject({
          method: 'POST',
          url: '/v1/me/recordings?questionId=speaking-read-aloud-0001&type=speaking_read_aloud',
          headers: { cookie, 'content-type': 'audio/webm' },
          payload: Buffer.from('audio'),
        })
      ).json().id as string;

    const id = await save();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/me/recordings/${id}/score`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const { result } = res.json();
    const content = result.traits.find((t: { name: string }) => t.name === 'Content');
    expect(content.score).toBe(content.max);
    expect(result.traits.find((t: { name: string }) => t.name === 'Oral fluency').score).toBe(5);
    expect(result.marks.every((m: { status: string }) => m.status === 'said')).toBe(true);

    // Asking again returns the stored result without another transcription.
    const again = await app.inject({
      method: 'POST',
      url: `/v1/me/recordings/${id}/score`,
      headers: { cookie },
    });
    expect(again.json().cached).toBe(true);
    expect(calls).toBe(1);

    // The daily limit is 1 here.
    const second = await save();
    const limited = await app.inject({
      method: 'POST',
      url: `/v1/me/recordings/${second}/score`,
      headers: { cookie },
    });
    expect(limited.statusCode).toBe(429);
  });

  it('says so when scoring is not set up', async () => {
    const { app, signIn } = await appWithAuth(db, { storage: memoryStorage() });
    const cookie = await signIn('noscore@example.com');
    const id = (
      await app.inject({
        method: 'POST',
        url: '/v1/me/recordings?questionId=speaking-read-aloud-0001&type=speaking_read_aloud',
        headers: { cookie, 'content-type': 'audio/webm' },
        payload: Buffer.from('audio'),
      })
    ).json().id;
    const res = await app.inject({
      method: 'POST',
      url: `/v1/me/recordings/${id}/score`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(503);
  });
});
