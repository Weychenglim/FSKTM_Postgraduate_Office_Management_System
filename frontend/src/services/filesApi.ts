/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// File Management API (UC24 to UC27). Live data only: errors are shown with Retry.

import type {
  DocumentDetail,
  DocumentFilters,
  DocumentOptions,
  DocumentPage,
  DocumentSharingChange,
  DocumentSharingOptions,
  DocumentSummary,
  DocumentTypeInput,
  DocumentTypeSetting,
  DocumentTypeSettings,
  DocumentUploadInput,
  HistoryPage,
  HistoryShow,
  MyRequiredDocument,
  RequiredOverview,
  RequiredShow,
  RequiredStudent,
  PortalDocument,
  StudentFileHeader,
  TaggableStudent,
} from '../types';
import { documentQuery } from '../utils/documentFilters';
import { blobToDataUrl, zipFileName } from '../utils/documentPreview';
import { ApiError, request, requestBlob, requestMultipart } from './apiClient';

const BASE = '/documents';

export function getDocumentOptions(): Promise<DocumentOptions> {
  return request<DocumentOptions>(`${BASE}/options/`);
}

export function getDocumentSummary(): Promise<DocumentSummary> {
  return request<DocumentSummary>(`${BASE}/summary/`);
}

export function getDocuments(filters: Partial<DocumentFilters>, offset = 0, limit = 25): Promise<DocumentPage> {
  const query = documentQuery(filters);
  query.set('offset', String(offset));
  query.set('limit', String(limit));
  return request<DocumentPage>(`${BASE}/?${query.toString()}`);
}

export function getDocument(id: number | string): Promise<DocumentDetail> {
  return request<DocumentDetail>(`${BASE}/${encodeURIComponent(String(id))}/`);
}

export function deleteDocument(id: number): Promise<void> {
  return request<void>(`${BASE}/${id}/`, { method: 'DELETE' });
}

export function searchTaggableStudents(search: string): Promise<TaggableStudent[]> {
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  return request<TaggableStudent[]>(`${BASE}/students/?${query.toString()}`);
}

export function getStudentFileHeader(matric: string): Promise<StudentFileHeader> {
  return request<StudentFileHeader>(`${BASE}/students/${encodeURIComponent(matric)}/`);
}

export function uploadDocument(input: DocumentUploadInput): Promise<DocumentDetail> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('type', input.type);
  if (input.title.trim()) form.append('title', input.title.trim());
  if (input.description.trim()) form.append('description', input.description.trim());
  if (input.semester) form.append('semester', input.semester);
  input.students.forEach(matric => form.append('students', matric));
  if (input.share) {
    form.append('shareSupervisors', String(input.share.supervisors));
    form.append('sharePanel', String(input.share.panel));
    form.append('shareCoordinator', String(input.share.coordinator));
  }
  if (input.audience) form.append('audience', input.audience);
  (input.programmes ?? []).forEach(programme => form.append('programmes', programme));
  if (input.acknowledgeWarnings) form.append('acknowledgeWarnings', 'true');
  return requestMultipart<DocumentDetail>(`${BASE}/`, form);
}

export async function downloadDocument(document: Pick<PortalDocument, 'id' | 'file' | 'title'>, version?: number): Promise<void> {
  const query = version ? `?version=${version}` : '';
  const blob = await requestBlob(`${BASE}/${document.id}/download/${query}`);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = document.file?.name ?? document.title;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** A 409 the uploader can answer: a duplicate to confirm, or a file that should be a new version. */
export function uploadConflict(err: unknown): { detail: string; code?: string; warnings: string[]; existingDocumentId?: number } | null {
  if (!(err instanceof ApiError) || err.status !== 409 || !err.body || typeof err.body !== 'object') return null;
  const body = err.body as { detail?: string; code?: string; warnings?: string[]; existingDocumentId?: number };
  return { detail: body.detail ?? err.message, code: body.code, warnings: body.warnings ?? [], existingDocumentId: body.existingDocumentId };
}

export interface DocumentPreviewInfo {
  kind: string;
  version: number;
  available: boolean;
  pageCount: number;
  text: string;
  truncated: boolean;
  reason: string;
}

export function getDocumentPreview(id: number, version?: number): Promise<DocumentPreviewInfo> {
  return request<DocumentPreviewInfo>(`${BASE}/${id}/preview/${version ? `?version=${version}` : ''}`);
}

/** One preview page as a data: URL, the only image source the security policy allows besides the portal itself. */
export async function getPreviewPage(id: number, page: number, version?: number): Promise<string> {
  const blob = await requestBlob(`${BASE}/${id}/preview/pages/${page}/${version ? `?version=${version}` : ''}`);
  return blobToDataUrl(blob);
}

export async function downloadDocumentsZip(ids: number[]): Promise<void> {
  const blob = await requestBlob(`${BASE}/download-zip/`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
    headers: { 'Content-Type': 'application/json' },
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = zipFileName(new Date());
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function addDocumentVersion(id: number, file: File, note = ''): Promise<DocumentDetail> {
  const form = new FormData();
  form.append('file', file);
  if (note.trim()) form.append('note', note.trim());
  return requestMultipart<DocumentDetail>(`${BASE}/${id}/versions/`, form);
}

export function checkDocument(id: number, decision: 'ACCEPT' | 'RETURN', reason: string, expectedVersion?: number): Promise<DocumentDetail> {
  return request<DocumentDetail>(`${BASE}/${id}/check/`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason, ...(expectedVersion ? { expectedVersion } : {}) }),
  });
}

export function updateDocument(id: number, changes: { title?: string; description?: string }): Promise<DocumentDetail> {
  return request<DocumentDetail>(`${BASE}/${id}/`, { method: 'PATCH', body: JSON.stringify(changes) });
}

export function getDocumentSharing(id: number): Promise<DocumentSharingOptions> {
  return request<DocumentSharingOptions>(`${BASE}/${id}/sharing/`);
}

export function updateDocumentSharing(id: number, sharing: DocumentSharingChange): Promise<DocumentDetail> {
  return request<DocumentDetail>(`${BASE}/${id}/sharing/`, { method: 'PUT', body: JSON.stringify(sharing) });
}

export function getDocumentTypeSettings(): Promise<DocumentTypeSettings> {
  return request<DocumentTypeSettings>(`${BASE}/types/`);
}

export function addDocumentType(input: DocumentTypeInput): Promise<DocumentTypeSetting> {
  return request<DocumentTypeSetting>(`${BASE}/types/`, { method: 'POST', body: JSON.stringify(input) });
}

export function updateDocumentType(id: number, input: Partial<DocumentTypeInput>): Promise<DocumentTypeSetting> {
  return request<DocumentTypeSetting>(`${BASE}/types/${id}/`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function archiveDocument(id: number, reason: string): Promise<DocumentDetail> {
  return request<DocumentDetail>(`${BASE}/${id}/archive/`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export function restoreDocument(id: number): Promise<DocumentDetail> {
  return request<DocumentDetail>(`${BASE}/${id}/restore/`, { method: 'POST', body: JSON.stringify({}) });
}

export function getDocumentHistory(show: HistoryShow, q: string, offset = 0, limit = 30): Promise<HistoryPage> {
  const query = new URLSearchParams({ show, offset: String(offset), limit: String(limit) });
  if (q.trim()) query.set('q', q.trim());
  return request<HistoryPage>(`${BASE}/history/?${query}`);
}

export function getRequiredOverview(): Promise<RequiredOverview> {
  return request<RequiredOverview>(`${BASE}/required/`);
}

export function getRequiredStudents(typeId: number, show: RequiredShow): Promise<RequiredStudent[]> {
  return request<RequiredStudent[]>(`${BASE}/required/${typeId}/students/?show=${show}`);
}

export function remindRequired(typeId: number): Promise<{ sent: number }> {
  return request<{ sent: number }>(`${BASE}/required/${typeId}/remind/`, { method: 'POST', body: JSON.stringify({}) });
}

export function getMyRequiredDocuments(): Promise<MyRequiredDocument[]> {
  return request<MyRequiredDocument[]>(`${BASE}/required/mine/`);
}
