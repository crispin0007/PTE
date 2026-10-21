import type { Question } from '@openpte/schema';
import { API_URL } from '../content/catalog.ts';

export type Summary = {
  id: string;
  type: string;
  status: 'draft' | 'in_review' | 'published';
  difficulty: number;
  origin: 'yaml' | 'admin';
  author: string;
  approvals: number;
  changes: number;
  updatedAt: string;
};

export type Review = {
  reviewer: string;
  mine: boolean;
  verdict: 'approve' | 'changes';
  comment: string;
  at: number;
};

export type Detail = {
  question: Question;
  origin: 'yaml' | 'admin';
  canEdit: boolean;
  canReview: boolean;
  reviews: Review[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly errors: string[] = [],
  ) {
    super(message);
  }
}

export async function call<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? 'GET',
    credentials: 'include',
    headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
  throw new ApiError(
    body.error ?? body.errors?.[0] ?? `Request failed (${res.status})`,
    body.errors,
  );
}

export const adminApi = {
  list: (status?: string) =>
    call<{ questions: Summary[] }>(`/v1/admin/questions${status ? `?status=${status}` : ''}`),
  get: (id: string) => call<Detail>(`/v1/admin/questions/${id}`),
  template: (type: string) => call<Record<string, unknown>>(`/v1/admin/templates/${type}`),
  create: (question: unknown) =>
    call<{ id: string }>('/v1/admin/questions', { method: 'POST', body: { question } }),
  update: (id: string, question: unknown) =>
    call<{ status: string }>(`/v1/admin/questions/${id}`, { method: 'PUT', body: { question } }),
  submit: (id: string) => call(`/v1/admin/questions/${id}/submit`, { method: 'POST', body: {} }),
  review: (id: string, verdict: 'approve' | 'changes', comment: string) =>
    call(`/v1/admin/questions/${id}/reviews`, { method: 'POST', body: { verdict, comment } }),
  publish: (id: string) => call(`/v1/admin/questions/${id}/publish`, { method: 'POST', body: {} }),
  yamlUrl: (id: string) => `${API_URL}/v1/admin/questions/${id}/yaml`,
  users: () => call<{ users: { id: string; email: string; role: string }[] }>('/v1/admin/users'),
  setRole: (id: string, role: string) =>
    call(`/v1/admin/users/${id}/role`, { method: 'PUT', body: { role } }),
};
