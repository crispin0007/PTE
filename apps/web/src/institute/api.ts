import { useEffect, useRef, useState } from 'react';
import { call } from '../admin/api.ts';
import { API_URL } from '../content/catalog.ts';

export type MemberRole = 'student' | 'teacher' | 'owner';
export type Institute = {
  id: string;
  slug: string;
  name: string;
  role: MemberRole;
  brandColor: string | null;
  logoVersion: number | null;
};
export type ClassSummary = { id: string; name: string; inviteCode?: string; students?: number };
export type Member = { id: string; name: string; email: string; role: MemberRole };
export type SkillStat = { answered: number; score: number; max: number };
export type Student = {
  id: string;
  name: string;
  email: string;
  answered: number;
  lastActive: number | null;
  skills: Partial<Record<'speaking' | 'writing' | 'reading' | 'listening', SkillStat>>;
};

export type AssignmentSpec =
  { kind: 'practice'; types: string[]; count: number } | { kind: 'mock'; mockId: string };
type Progress = { done: number; target: number; result?: MockSummary };
export type MockSummary = {
  overall: number | null;
  skills: Record<string, number | null>;
  questions: number;
};
export type Assignment = {
  id: string;
  classId: string;
  title: string;
  spec: AssignmentSpec;
  dueAt: number;
  createdAt: number;
};
export type ClassAssignment = Assignment & {
  students: ({ userId: string } & Progress)[];
  complete: number;
};
export type MyAssignment = Assignment & Progress & { className: string; instituteName: string };

export type MarkingRequest = {
  id: string;
  questionId: string;
  type: string;
  answerText: string | null;
  hasRecording: boolean;
  autoScore: number;
  max: number;
  teacherScore: number | null;
  comment: string | null;
  markedAt: number | null;
  createdAt: number;
  student?: { name: string; email: string };
};

const base = (id: string) => `/v1/institutes/${id}`;

export const instituteApi = {
  config: () =>
    call<{ single: boolean; creation: 'anyone' | 'admin' | 'none' }>('/v1/institutes/config'),
  mine: () => call<{ institutes: Institute[] }>('/v1/me/institutes'),
  create: (name: string) => call<Institute>('/v1/institutes', { method: 'POST', body: { name } }),
  join: (code: string) =>
    call<{ institute: Institute; class: { id: string; name: string } }>('/v1/join', {
      method: 'POST',
      body: { code },
    }),
  get: (id: string) => call<Institute>(base(id)),
  rename: (id: string, name: string) => call(base(id), { method: 'PUT', body: { name } }),
  setColor: (id: string, brandColor: string | null) =>
    call(base(id), { method: 'PUT', body: { brandColor } }),
  uploadLogo: async (id: string, file: File) => {
    const res = await fetch(`${API_URL}${base(id)}/logo`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': file.type },
      body: file,
    });
    if (!res.ok)
      throw new Error(
        ((await res.json().catch(() => ({}))) as { error?: string }).error ??
          (res.status === 413 ? 'The image is over 200 KB.' : `Upload failed (${res.status})`),
      );
  },
  removeLogo: (id: string) => call(`${base(id)}/logo`, { method: 'DELETE' }),
  members: (id: string) => call<{ members: Member[] }>(`${base(id)}/members`),
  setRole: (id: string, userId: string, role: MemberRole) =>
    call(`${base(id)}/members/${userId}`, { method: 'PUT', body: { role } }),
  removeMember: (id: string, userId: string) =>
    call(`${base(id)}/members/${userId}`, { method: 'DELETE' }),
  classes: (id: string) => call<{ classes: ClassSummary[] }>(`${base(id)}/classes`),
  createClass: (id: string, name: string) =>
    call<ClassSummary>(`${base(id)}/classes`, { method: 'POST', body: { name } }),
  deleteClass: (id: string, classId: string) =>
    call(`${base(id)}/classes/${classId}`, { method: 'DELETE' }),
  newCode: (id: string, classId: string) =>
    call<{ inviteCode: string }>(`${base(id)}/classes/${classId}/new-code`, {
      method: 'POST',
      body: {},
    }),
  students: (id: string, classId: string) =>
    call<{ class: Required<ClassSummary>; students: Student[] }>(
      `${base(id)}/classes/${classId}/students`,
    ),
  removeStudent: (id: string, classId: string, userId: string) =>
    call(`${base(id)}/classes/${classId}/students/${userId}`, { method: 'DELETE' }),
  importRoster: (id: string, classId: string, csv: string) =>
    call<{ added: number; newAccounts: number; invalid: string[] }>(
      `${base(id)}/classes/${classId}/import`,
      { method: 'POST', body: { csv } },
    ),
  assignments: (id: string, classId: string) =>
    call<{ assignments: ClassAssignment[] }>(`${base(id)}/classes/${classId}/assignments`),
  assign: (
    id: string,
    classId: string,
    body: { title: string; dueAt: number; spec: AssignmentSpec },
  ) => call<Assignment>(`${base(id)}/classes/${classId}/assignments`, { method: 'POST', body }),
  unassign: (id: string, classId: string, aid: string) =>
    call(`${base(id)}/classes/${classId}/assignments/${aid}`, { method: 'DELETE' }),
  myAssignments: () => call<{ assignments: MyAssignment[] }>('/v1/me/assignments'),
  askTeacher: (body: {
    instituteId: string;
    questionId: string;
    type: string;
    answerText?: string;
    recordingId?: string;
    score: number;
    max: number;
  }) => call<{ id: string }>('/v1/me/marking', { method: 'POST', body }),
  myMarking: () => call<{ requests: MarkingRequest[] }>('/v1/me/marking'),
  queue: (id: string, status: 'waiting' | 'marked') =>
    call<{ requests: MarkingRequest[] }>(`${base(id)}/marking?status=${status}`),
  mark: (id: string, mid: string, score: number, comment: string) =>
    call(`${base(id)}/marking/${mid}`, { method: 'PUT', body: { score, comment } }),
  audioUrl: (id: string, mid: string) => `${API_URL}${base(id)}/marking/${mid}/audio`,
  submitMock: (aid: string, result: MockSummary) =>
    call(`/v1/me/assignments/${aid}/submit`, { method: 'POST', body: { result } }),
};

/** Loads on mount and whenever `key` changes (or on `reload`), keeping any error for display. */
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    let live = true;
    loadRef.current().then(
      (d) => live && (setData(d), setError(null)),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [key, n]);
  return { data, error, reload: () => setN((x) => x + 1), setData };
}

/** Share of marks as a whole percentage, or null with nothing answered. */
export const percent = (s?: { score: number; max: number }) =>
  s && s.max ? Math.round((s.score / s.max) * 100) : null;

/** The invite link a teacher shares; opening it signed in joins the class. */
export const inviteLink = (code: string) => `${location.origin}${location.pathname}#/join/${code}`;

/** People who signed in by email link have no name yet; show the start of their email. */
export const displayName = (p: { name: string; email: string }) =>
  p.name.trim() || p.email.split('@')[0]!;
