import { describe, expect, it } from 'vitest';
import {
  alignWords,
  coverKeyPoints,
  fluencyScore,
  fluencyStats,
  scoreSpeaking,
  type TimedTranscript,
} from './speaking.ts';

/** Words spoken evenly at `wpm` with optional extra gaps before given indexes. */
function speech(
  text: string,
  wpm = 140,
  gaps: Record<number, number> = {},
  probability = 0.95,
): TimedTranscript {
  const per = 60 / wpm;
  let t = 0.4;
  const ws = text.split(' ').map((word, i) => {
    t += gaps[i] ?? 0;
    const w = { word, start: t, end: t + per * 0.8, probability };
    t += per;
    return w;
  });
  return { words: ws, duration: t + 0.5 };
}

describe('speaking scores', () => {
  it('aligns reference words with what was said', () => {
    const marks = alignWords(['the', 'cat', 'sat', 'down'], ['the', 'cap', 'down', 'now']);
    expect(marks.map((m) => m.status)).toEqual(['said', 'changed', 'missed', 'said']);
    expect(marks[1]!.heard).toBe('cap');
  });

  it('measures fluency', () => {
    const smooth = fluencyStats(speech('one two three four five six seven eight'));
    expect(smooth).toMatchObject({ longPauses: 0, fillers: 0, repeats: 0 });
    expect(smooth.wordsPerMinute).toBeGreaterThan(130);
    expect(fluencyScore(smooth, 8).score).toBe(5);

    const halting = fluencyStats(
      speech('the the um city is uh growing growing fast', 200, { 4: 1.5 }),
    );
    expect(halting).toMatchObject({ longPauses: 1, fillers: 2, repeats: 2 });
    // 5 - 1 pause - 2 (four hesitations) = 2
    expect(fluencyScore(halting, 6).score).toBe(2);
    expect(fluencyScore(fluencyStats(speech('one two three four five', 60)), 5).score).toBe(3);
  });

  it('repeat sentence content bands', () => {
    const ref = {
      rule: 'speaking_repeat_sentence' as const,
      text: 'Please hand in your work by Friday.',
    };
    expect(scoreSpeaking(ref, speech('please hand in your work by friday')).traits[0]!.score).toBe(
      3,
    );
    expect(scoreSpeaking(ref, speech('please hand in your work')).traits[0]!.score).toBe(2);
    expect(scoreSpeaking(ref, speech('friday')).traits[0]!.score).toBe(1);
  });

  it('read aloud counts every word and reports pronunciation and fluency', () => {
    const r = scoreSpeaking(
      { rule: 'speaking_read_aloud', text: 'Coral reefs support a quarter of marine species.' },
      speech('coral reefs support a quarter of marine species', 140, {}, 0.85),
    );
    expect(r.traits.map((t) => [t.name, t.score, t.max])).toEqual([
      ['Content', 8, 8],
      ['Pronunciation', 4, 5],
      ['Oral fluency', 5, 5],
    ]);
    expect(r).toMatchObject({ score: 17, max: 18 });
  });

  it('open responses score key-point coverage', () => {
    const points = ['Sales rose sharply in 2020', 'Online shopping overtook stores', 'Costs fell'];
    expect(
      coverKeyPoints(
        points,
        'sales were rising sharply and online shopping overtook'.split(' '),
      ).map((p) => p.covered),
    ).toEqual([true, true, false]);
    const r = scoreSpeaking(
      { rule: 'speaking_open_response', keyPoints: points },
      speech('the chart shows sales rising sharply while online shopping overtook stores'),
    );
    expect(r.traits[0]).toMatchObject({ name: 'Content', score: 3, max: 5 });
  });

  it('short answers match an accepted answer', () => {
    const ref = { rule: 'speaking_short_answer' as const, accepted: ['a thermometer'] };
    expect(scoreSpeaking(ref, speech('a thermometer')).score).toBe(1);
    expect(scoreSpeaking(ref, speech('a barometer')).score).toBe(0);
  });

  it('silence scores zero', () => {
    const r = scoreSpeaking(
      { rule: 'speaking_read_aloud', text: 'Hello there.' },
      { words: [], duration: 5 },
    );
    expect(r.score).toBe(0);
    expect(r.fluency.lead).toBe(5);
  });
});
