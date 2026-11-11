import { request, requestMultipart } from './apiClient';
import { FILES_CHANGED_EVENT } from './filesApi';

const BASE = '/documents/submissions';
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export type SubmissionStage = 'ALL' | 'P1' | 'P2';
export type AfterDue = 'CLOSE' | 'ACCEPT_LATE';
export type SubmissionState = 'ON_TIME' | 'LATE' | 'NOT_SENT';

export interface SubmissionType {
  code: string;
  label: string;
  allowedKinds: string[];
}

export interface SubmissionCounts {
  ON_TIME: number;
  LATE: number;
  NOT_SENT: number;
  extensions: number;
}

export interface SubmissionSummary {
  id: number;
  title: string;
  type: SubmissionType;
  programmes: string[];
  stage: SubmissionStage;
  semester: string;
  isCurrent: boolean;
  dueAt: string;
  afterDue: AfterDue;
  lateUntil: string | null;
  isOpen: boolean;
  acceptingNow: boolean;
  canManage: boolean;
  counts: SubmissionCounts;
}

export interface SubmissionStudent {
  matric: string;
  name: string;
  programme: string;
  state: SubmissionState;
  expected: boolean;
  dueAt: string;
  sentAt: string | null;
  firstSentAt: string | null;
  lateBySeconds: number | null;
  documentId: number | null;
  extension: { dueAt: string; reason: string; by: string } | null;
}

export interface SubmissionOptions {
  types: SubmissionType[];
  programmes: string[];
  stages: Array<{ value: SubmissionStage; label: string }>;
  reasons: Array<{ value: string; label: string }>;
}

export interface SubmissionDetail extends SubmissionSummary {
  students: SubmissionStudent[];
  history: Array<{ action: string; by: string; at: string; details: Record<string, unknown> }>;
  remindedToday: boolean;
  options: SubmissionOptions;
}

export interface SubmissionInput {
  title: string;
  type: string;
  programmes: string[];
  stage: SubmissionStage;
  dueAt: string;
  afterDue: AfterDue;
  lateUntil: string | null;
  confirm?: boolean;
}

export interface MySubmission {
  id: number;
  title: string;
  type: SubmissionType;
  semester: string;
  dueAt: string;
  originalDueAt: string;
  extended: boolean;
  closesAt: string | null;
  afterDue: AfterDue;
  isOpen: boolean;
  canSend: boolean;
  lateIfSentNow: boolean;
  why: string;
  state: SubmissionState;
  sentAt: string | null;
  lateBySeconds: number | null;
  documentId: number | null;
}

const filesChanged = <T>(result: T): T => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FILES_CHANGED_EVENT));
  return result;
};

export const getSubmissions = () =>
  request<{ submissions: SubmissionSummary[]; canCreate: boolean; options: SubmissionOptions }>(`${BASE}/`);

export const createSubmission = (input: SubmissionInput) =>
  request<{ id: number }>(`${BASE}/`, json('POST', input));

export const getSubmission = (id: number) => request<SubmissionDetail>(`${BASE}/${id}/`);

export const changeSubmission = (id: number, input: SubmissionInput) =>
  request<SubmissionDetail>(`${BASE}/${id}/`, json('PATCH', input));

export const setSubmissionOpen = (id: number, open: boolean) =>
  request<SubmissionDetail>(`${BASE}/${id}/open/`, json('POST', { open }));

export const giveExtension = (id: number, input: { matric: string; dueAt: string; reason: string }) =>
  request<SubmissionDetail>(`${BASE}/${id}/extensions/`, json('POST', input));

export const removeExtension = (id: number, matric: string) =>
  request<SubmissionDetail>(`${BASE}/${id}/extensions/${encodeURIComponent(matric)}/`, { method: 'DELETE' });

export const remindSubmission = (id: number) => request<{ sent: number }>(`${BASE}/${id}/remind/`, json('POST', {}));

export const getMySubmissions = () => request<{ submissions: MySubmission[]; now: string }>(`${BASE}/mine/`);

export function sendSubmission(id: number, file: File): Promise<MySubmission> {
  const form = new FormData();
  form.append('file', file);
  return requestMultipart<MySubmission>(`${BASE}/${id}/send/`, form).then(filesChanged);
}
