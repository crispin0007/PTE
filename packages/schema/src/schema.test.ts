import { describe, expect, it } from 'vitest';
import { readYaml } from './node.ts';
import { QUESTION_SCHEMAS } from './questions.ts';
import { validateBank, type SourceFile } from './validate.ts';

const registry = readYaml('content/item-types.yaml');
const noAssets = { exists: () => false, hasSidecar: () => false };
const file = (name: string): SourceFile => ({
  path: `content/questions/reading/reading_mcq_single/${name}.yaml`,
  data: readYaml(
    `tests/fixtures/${name.replace(/^reading-mcq-single-999[89]$/, (id) => (id.endsWith('9') ? 'bad-question' : 'good-question'))}.yaml`,
  ),
});

describe('validateBank', () => {
  it('accepts a valid question', () => {
    const r = validateBank(registry, [file('reading-mcq-single-9998')], noAssets);
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(1);
  });

  it('rejects the bad fixture with readable messages', () => {
    const r = validateBank(registry, [file('reading-mcq-single-9999')], noAssets);
    const text = r.errors.join('\n');
    expect(r.questions).toHaveLength(0);
    expect(text).toContain('reading-mcq-single-9999.yaml: license');
    expect(text).toContain('originality_confirmed');
  });

  it('reports cross-field errors once the shape is right', () => {
    const data = {
      ...(readYaml('tests/fixtures/good-question.yaml') as object),
      answer: 5,
      source: 'open-licensed',
    };
    const r = validateBank(registry, [{ ...file('reading-mcq-single-9998'), data }], noAssets);
    expect(r.errors.join('\n')).toMatch(/answer: index 5 is out of range/);
    expect(r.errors.join('\n')).toMatch(/source_url and attribution are required/);
  });

  it('checks file location, id and duplicates', () => {
    const good = file('reading-mcq-single-9998');
    const moved = {
      path: 'content/questions/listening/reading_mcq_single/other-name.yaml',
      data: good.data,
    };
    const r = validateBank(registry, [good, moved], noAssets);
    const text = r.errors.join('\n');
    expect(text).toContain('does not match the file name other-name');
    expect(text).toContain('must be in content/questions/reading/reading_mcq_single/');
    expect(text).toContain('duplicate id');
  });

  it('requires two reviewers other than the author to publish', () => {
    const base = readYaml('tests/fixtures/good-question.yaml') as object;
    const run = (reviewed_by: string[]) =>
      validateBank(
        registry,
        [
          {
            ...file('reading-mcq-single-9998'),
            data: { ...base, status: 'published', reviewed_by },
          },
        ],
        noAssets,
      ).errors;
    expect(run(['alice']).join()).toMatch(/2 reviewers/);
    expect(run(['alice', 'openpte-seed']).join()).toMatch(/2 reviewers/);
    expect(run(['alice', 'bob'])).toEqual([]);
  });

  it('only warns about missing audio until a question is published', () => {
    const q = {
      id: 'listening-write-from-dictation-9999',
      type: 'listening_write_from_dictation',
      difficulty: 1,
      status: 'in_review',
      source: 'original',
      license: 'CC-BY-SA-4.0',
      author: 'openpte-seed',
      originality_confirmed: true,
      audio: 'audio/listening-write-from-dictation-9999.mp3',
      sentence: 'Hand in the essay on Friday.',
    };
    const path =
      'content/questions/listening/listening_write_from_dictation/listening-write-from-dictation-9999.yaml';
    const draft = validateBank(registry, [{ path, data: q }], noAssets);
    expect(draft.errors).toEqual([]);
    expect(draft.warnings.join()).toMatch(/audio not generated yet/);
    const live = validateBank(
      registry,
      [{ path, data: { ...q, status: 'published', reviewed_by: ['a', 'b'] } }],
      noAssets,
    );
    expect(live.errors.join()).toMatch(/missing asset/);
  });

  it('rejects an unknown type', () => {
    const r = validateBank(
      registry,
      [{ path: 'content/questions/x/y/z.yaml', data: { type: 'nope' } }],
      noAssets,
    );
    expect(r.errors).toEqual(['content/questions/x/y/z.yaml: unknown type "nope"']);
  });
});

describe('type-specific rules', () => {
  const base = {
    difficulty: 2,
    status: 'draft',
    source: 'original',
    license: 'CC-BY-SA-4.0',
    author: 'someone',
    originality_confirmed: true,
  };
  const errors = (schema: keyof typeof QUESTION_SCHEMAS, data: object) => {
    const r = QUESTION_SCHEMAS[schema].safeParse({ ...base, type: schema, ...data });
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  it('matches blank markers to blanks', () => {
    const e = errors('listening_fib', {
      id: 'listening-fib-0001',
      audio: 'audio/listening-fib-0001.mp3',
      transcript: 'One {{b1}} and {{b3}}.',
      blanks: [
        { id: 'b1', answer: 'x' },
        { id: 'b2', answer: 'y' },
      ],
    });
    expect(e.join()).toMatch(/do not match blanks/);
  });

  it('checks highlight-incorrect-words swaps against transcript tokens', () => {
    const q = {
      id: 'listening-highlight-incorrect-words-0001',
      audio: 'audio/a.mp3',
      transcript: 'The cat sat down.',
    };
    expect(
      errors('listening_highlight_incorrect_words', {
        ...q,
        swaps: [{ index: 4, shown: 'up' }],
      }).join(),
    ).toMatch(/past the last word/);
    expect(
      errors('listening_highlight_incorrect_words', {
        ...q,
        swaps: [{ index: 1, shown: 'cat' }],
      }).join(),
    ).toMatch(/same as the spoken word/);
    expect(
      errors('listening_highlight_incorrect_words', { ...q, swaps: [{ index: 1, shown: 'dog' }] }),
    ).toEqual([]);
  });

  it('needs at least one wrong option in multiple-answer items', () => {
    const e = errors('reading_mcq_multiple', {
      id: 'reading-mcq-multiple-0001',
      passage: 'p',
      question: 'q',
      options: ['a', 'b'],
      answers: [0, 1],
    });
    expect(e.join()).toMatch(/at least one option must be wrong/);
  });

  it('requires 3 named speakers in group discussions', () => {
    const q = {
      id: 'speaking-summarize-group-discussion-0001',
      audio: 'audio/a.mp3',
      speakers: ['Ann', 'Ben', 'Cy'],
      key_points: ['k'],
      sample_answer: 's',
    };
    expect(
      errors('speaking_summarize_group_discussion', {
        ...q,
        transcript: 'Ann: hi\nBen: hello\nCy: hey',
      }),
    ).toEqual([]);
    expect(
      errors('speaking_summarize_group_discussion', {
        ...q,
        transcript: 'Ann: hi\nDee: hello',
      }).join(),
    ).toMatch(/line 2/);
  });

  it('rejects unknown fields, which catches typos', () => {
    const e = errors('speaking_read_aloud', {
      id: 'speaking-read-aloud-0001',
      text: 't',
      txet: 't',
    });
    expect(e.join()).toMatch(/txet/);
  });
});
