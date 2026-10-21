import { describe, expect, it } from 'vitest';
import {
  scoreBlanks,
  scoreDictation,
  scoreHighlightIncorrect,
  scoreMcqMultiple,
  scoreMcqSingle,
  scoreReorder,
  words,
} from './objective.ts';

// Every expected value below was worked out by hand from the rule in rules.ts.
describe('objective scoring', () => {
  it('mcq single', () => {
    expect(scoreMcqSingle(2, 2).score).toBe(1);
    expect(scoreMcqSingle(2, 0).score).toBe(0);
    expect(scoreMcqSingle(2, null)).toMatchObject({ score: 0, max: 1 });
  });

  it('mcq multiple adds right picks, subtracts wrong ones, never below 0', () => {
    // Key {0,2,3}. Picks {0,2,4}: 2 right, 1 wrong -> 1.
    expect(scoreMcqMultiple([0, 2, 3], [0, 2, 4])).toMatchObject({ score: 1, max: 3 });
    expect(scoreMcqMultiple([0, 2, 3], [0, 2, 3])).toMatchObject({ score: 3, max: 3 });
    // Picks {1,4}: 0 right, 2 wrong -> -2 -> 0.
    expect(scoreMcqMultiple([0, 2, 3], [1, 4]).score).toBe(0);
    expect(scoreMcqMultiple([0], []).score).toBe(0);
  });

  it('reorder scores neighbouring pairs', () => {
    // Correct A B C D E = 0 1 2 3 4.
    expect(scoreReorder(5, [0, 1, 2, 3, 4])).toMatchObject({ score: 4, max: 4 });
    // B C A D E: pairs BC yes, CA no, AD no, DE yes -> 2.
    expect(scoreReorder(5, [1, 2, 0, 3, 4])).toMatchObject({
      score: 2,
      pairs: [true, false, false, true],
    });
    // Fully reversed: no pair in order -> 0.
    expect(scoreReorder(5, [4, 3, 2, 1, 0]).score).toBe(0);
  });

  it('blanks score 1 each, ignoring case and spaces, missed blanks score 0', () => {
    const r = scoreBlanks(['drifted', 'rejected', 'spreading'], ['Drifted ', 'melted', null]);
    expect(r).toMatchObject({ score: 1, max: 3, marks: ['right', 'wrong', 'missed'] });
    expect(scoreBlanks(['colour'], ['color'], 'fib_per_blank_spelling').score).toBe(0);
  });

  it('highlight incorrect words', () => {
    // Swaps at 3, 9, 14. Clicked 3, 9, 5: 2 right, 1 wrong -> 1.
    expect(scoreHighlightIncorrect([3, 9, 14], [3, 9, 5])).toMatchObject({ score: 1, max: 3 });
    expect(scoreHighlightIncorrect([3], [1, 2]).score).toBe(0);
  });

  it('dictation counts reference words found, once each', () => {
    expect(words('The library’s doors open at nine, daily.')).toEqual([
      'the',
      "library's",
      'doors',
      'open',
      'at',
      'nine',
      'daily',
    ]);
    // 7 words; "the" typed twice only matches once; "libary" misspelled.
    const r = scoreDictation(
      'The library doors open at nine daily',
      'the the libary doors open at 9',
    );
    expect(r).toMatchObject({ score: 4, max: 7 });
    expect(r.marks.map((m) => m.found)).toEqual([true, false, true, true, true, false, false]);
  });
});
