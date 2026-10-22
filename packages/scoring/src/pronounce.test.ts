import { describe, expect, it } from 'vitest';
import fixture from './fixtures/gop-parity.json' with { type: 'json' };
import { assessSounds, ctcAlign, gopScores, softmaxFrames, toVocab } from './pronounce.ts';

const posteriors = { data: fixture.probs, frames: fixture.frames, size: fixture.size };

describe('in-browser pronunciation', () => {
  it('aligns and scores exactly like the speech service', () => {
    const logp = { ...posteriors, data: fixture.probs.map(Math.log) };
    const spans = ctcAlign(logp, fixture.targets, 0);
    expect(spans).toEqual(fixture.spans);
    const scores = gopScores(posteriors, spans!, fixture.targets, 0);
    // Python rounds halves to even; allow one point.
    scores.forEach((s, i) => expect(Math.abs(s - fixture.scores[i]!)).toBeLessThanOrEqual(1));
  });

  it('splits unknown phones into known ones', () => {
    expect(toVocab(['aɪə', 'q', 't'], { aɪ: 1, ə: 2, t: 3 })).toEqual(['aɪ', 'ə', 't']);
  });

  it('scores a clear and an unclear word', () => {
    // Frames: blank, ð, blank, ə, blank, k, blank, æ heard as ʌ, blank, t, blank
    const vocab = { '<pad>': 0, ð: 1, ə: 2, k: 3, æ: 4, ʌ: 5, t: 6 };
    const heard = [0, 1, 0, 2, 0, 3, 0, 5, 0, 6, 0];
    const logits = new Float32Array(heard.length * 7);
    heard.forEach((v, t) => (logits[t * 7 + v] = 8));
    const probs = softmaxFrames(logits, heard.length, 7);
    const r = assessSounds(
      probs,
      { vocab, blank: 0, engine: 'test' },
      ['the', 'cat'],
      ['ð ə', 'k æ t'],
    );
    expect(r!.words[0]!.score).toBe(100);
    expect(r!.words[1]!.phones.map((p) => p.score)).toEqual([100, 0, 100]);
    expect(r!.score).toBe(Math.round((100 + 67) / 2));
  });

  it('gives up when the audio is too short', () => {
    const probs = softmaxFrames(new Float32Array(2 * 3), 2, 3);
    expect(
      assessSounds(probs, { vocab: { a: 1, b: 2 }, blank: 0, engine: 't' }, ['ab'], ['a b a']),
    ).toBeNull();
  });
});
