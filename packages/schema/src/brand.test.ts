import { describe, expect, it } from 'vitest';
import { brandColorProblem, contrast } from './brand.ts';

describe('brand colours', () => {
  it('measures contrast like WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#3149d6', '#ffffff')).toBeGreaterThan(4.5);
  });
  it('accepts dark colours and refuses light or malformed ones', () => {
    expect(brandColorProblem('#3149d6')).toBeNull();
    expect(brandColorProblem('#1f6f5c')).toBeNull();
    expect(brandColorProblem('#ffcc00')).toMatch(/too light/);
    expect(brandColorProblem('red')).toMatch(/#1f6f5c/);
  });
});
