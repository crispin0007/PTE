import { describe, expect, it } from 'vitest';
import { loadContent } from './node.ts';

describe('question bank in content/', () => {
  it('passes validation', () => {
    const { errors, questions, registry } = loadContent(process.cwd());
    expect(errors).toEqual([]);
    expect(registry).toHaveLength(22);
    expect(questions.length).toBeGreaterThanOrEqual(220);
  });
});
