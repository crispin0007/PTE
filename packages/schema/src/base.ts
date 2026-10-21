import { z } from 'zod';

export const LICENSES = ['CC-BY-SA-4.0', 'CC-BY-4.0', 'CC0-1.0', 'public-domain'] as const;
export const SOURCES = ['original', 'contributor', 'public-domain', 'open-licensed'] as const;
export const STATUSES = ['draft', 'in_review', 'published'] as const;

const handle = z.string().regex(/^[A-Za-z0-9-]+$/, 'must be a GitHub handle');
export const nonEmpty = z.string().trim().min(1);

/** Fields every question carries, whatever its type. Type-specific fields are added in questions.ts. */
export const baseShape = {
  id: z.string().regex(/^[a-z]+(-[a-z]+)+-\d{4}$/, 'id must look like <type-slug>-NNNN'),
  tags: z.array(z.string().min(1)).default([]),
  difficulty: z.number().int().min(1).max(5),
  status: z.enum(STATUSES),
  source: z.enum(SOURCES),
  source_url: z.url().optional(),
  attribution: nonEmpty.optional(),
  license: z.enum(LICENSES),
  author: handle,
  reviewed_by: z.array(handle).default([]),
  drafted_with: z.literal('ai').optional(),
  originality_confirmed: z.literal(true, {
    error:
      'originality_confirmed must be true: content may not be copied from any exam, prediction file or paid platform',
  }),
  explanation: nonEmpty.optional(),
};

export type BaseFields = {
  source: (typeof SOURCES)[number];
  source_url?: string;
  attribution?: string;
  status: (typeof STATUSES)[number];
  author: string;
  reviewed_by: string[];
};

/** Rules that tie base fields together. Shared by every question schema. */
export function checkBase(q: BaseFields, ctx: z.RefinementCtx) {
  if (q.source !== 'original' && (!q.source_url || !q.attribution)) {
    ctx.addIssue({
      code: 'custom',
      path: ['source_url'],
      message: 'source_url and attribution are required unless source is original',
    });
  }
  if (q.status === 'published') {
    const reviewers = new Set(q.reviewed_by);
    if (reviewers.size < 2 || reviewers.has(q.author)) {
      ctx.addIssue({
        code: 'custom',
        path: ['reviewed_by'],
        message: 'published questions need 2 reviewers, neither of them the author',
      });
    }
  }
}
