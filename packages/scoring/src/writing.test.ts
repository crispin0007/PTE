import { describe, expect, it } from 'vitest';
import { grammarTrait, layoutProblem, scoreWriting, sentenceCount } from './writing.ts';

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ') + '.';

describe('writing form and spelling', () => {
  it('counts sentences', () => {
    expect(sentenceCount('')).toBe(0);
    expect(sentenceCount('One sentence, with a clause.')).toBe(1);
    expect(sentenceCount('First one. Second one! Third?')).toBe(3);
    expect(sentenceCount('It costs 3.5 million and rose to 4.2 by 2020.')).toBe(1);
  });

  it('summarize written text: one sentence of 5 to 75 words', () => {
    expect(scoreWriting('writing_swt', words(30), []).score).toBe(1);
    expect(scoreWriting('writing_swt', 'Too short here.', []).score).toBe(0);
    expect(
      scoreWriting('writing_swt', 'This is one sentence. This is another one.', []).score,
    ).toBe(0);
    expect(scoreWriting('writing_swt', words(76), []).score).toBe(0);
  });

  it('summarize spoken text: form bands and spelling', () => {
    // 60 words, no errors: form 2 + spelling 2.
    expect(scoreWriting('writing_sst', words(60), [])).toMatchObject({ score: 4, max: 4 });
    // 45 words: form 1; one error: spelling 1.
    expect(scoreWriting('writing_sst', words(45), ['recieve']).score).toBe(2);
    // 30 words: form 0, so spelling is 0 too.
    expect(scoreWriting('writing_sst', words(30), []).score).toBe(0);
  });

  it('essay form bands', () => {
    expect(scoreWriting('writing_essay', words(250), []).traits[0]!.score).toBe(2);
    expect(scoreWriting('writing_essay', words(150), []).traits[0]!.score).toBe(1);
    expect(scoreWriting('writing_essay', words(381), []).traits[0]!.score).toBe(0);
    // Two errors: spelling 0.
    expect(scoreWriting('writing_essay', words(250), ['a', 'b']).score).toBe(2);
  });

  it('layout problems score 0 for form', () => {
    expect(layoutProblem('THIS IS ALL WRITTEN IN CAPITAL LETTERS FOR SOME REASON.')).toMatch(
      /capitals/,
    );
    expect(layoutProblem('- first point\n- second point')).toMatch(/bullet/);
    expect(layoutProblem(Array.from({ length: 20 }, () => 'word').join(' '))).toMatch(
      /punctuation/,
    );
    expect(layoutProblem('A normal sentence, written well.')).toBeNull();
  });
});

describe('grammar trait', () => {
  const issue = (message: string) => ({
    offset: 0,
    length: 2,
    message,
    replacements: [],
    category: 'GRAMMAR',
  });
  const essay = Array.from({ length: 230 }, (_, i) => (i % 12 === 11 ? 'end.' : 'word')).join(' ');

  it('is scored only when the checker ran, replacing the not-yet-scored line', () => {
    const without = scoreWriting('writing_essay', essay, []);
    expect(without.traits.find((t) => t.name === 'Grammar')).toMatchObject({ scored: false });
    const clean = scoreWriting('writing_essay', essay, [], []);
    expect(clean.traits.filter((t) => t.name === 'Grammar')).toEqual([
      expect.objectContaining({ scored: true, score: 2, max: 2 }),
    ]);
    expect(clean.max).toBe(without.max + 2);
  });

  it('bands by number of errors, scaled to the task', () => {
    expect(grammarTrait('writing_swt', [issue('a')]).score).toBe(1);
    expect(grammarTrait('writing_swt', [issue('a'), issue('b')]).score).toBe(0);
    expect(
      grammarTrait('writing_essay', [issue('a'), issue('b'), issue('c'), issue('d')]).score,
    ).toBe(1);
    const many = grammarTrait('writing_essay', ['a', 'b', 'c', 'd', 'e'].map(issue));
    expect(many.score).toBe(0);
    expect(many.note).toBe('5 possible errors: a; b; c; …');
  });
});
