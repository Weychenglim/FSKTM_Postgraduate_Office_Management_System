/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// FAQ chatbot (UC28) and knowledge base (UC29) API. Live data only: errors are shown with Retry.

import type {
  FaqCategorySummary,
  FaqChatbotSettings,
  FaqDocumentSummary,
  FaqEntryDetail,
  FaqEntryFilters,
  FaqEntryInput,
  FaqEntryList,
  FaqFeedbackReply,
  FaqQuestionGroup,
  FaqQuestionStats,
  FaqReply,
  FaqSearchStatus,
  FaqStart,
  FaqTryReply,
} from '../types';
import { request, requestBlob, requestMultipart } from './apiClient';

const BASE = '/faq';

const post = <T>(path: string, body: unknown) => request<T>(`${BASE}${path}`, { method: 'POST', body: JSON.stringify(body) });

export function getFaqStart(): Promise<FaqStart> {
  return request<FaqStart>(`${BASE}/start/`);
}

export function askFaq(question: string): Promise<FaqReply> {
  return post<FaqReply>('/ask/', { question });
}

/** A choice or related question the student picked. */
export function openFaqAnswer(entryId: string, asked?: { questionId: string; token: string }): Promise<FaqReply> {
  return post<FaqReply>('/ask/', { entryId, ...(asked ?? {}) });
}

export function sendFaqFeedback(questionId: string, token: string, helpful: boolean): Promise<FaqFeedbackReply> {
  return post<FaqFeedbackReply>('/feedback/', { questionId, token, helpful });
}

// The office's knowledge base (UC29).

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export function faqEntryQuery(filters: FaqEntryFilters): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getFaqEntries(filters: FaqEntryFilters): Promise<FaqEntryList> {
  return request<FaqEntryList>(`${BASE}/entries/${faqEntryQuery(filters)}`);
}

export function getFaqEntry(id: string): Promise<FaqEntryDetail> {
  return request<FaqEntryDetail>(`${BASE}/entries/${encodeURIComponent(id)}/`);
}

export function createFaqEntry(input: FaqEntryInput): Promise<FaqEntryDetail> {
  return request<FaqEntryDetail>(`${BASE}/entries/`, json('POST', input));
}

export function updateFaqEntry(id: string, input: FaqEntryInput): Promise<FaqEntryDetail> {
  return request<FaqEntryDetail>(`${BASE}/entries/${encodeURIComponent(id)}/`, json('PATCH', input));
}

export function stepFaqEntry(id: string, step: 'publish' | 'checked' | 'archive' | 'restore'): Promise<FaqEntryDetail> {
  return request<FaqEntryDetail>(`${BASE}/entries/${encodeURIComponent(id)}/${step}/`, { method: 'POST' });
}

export function deleteFaqEntry(id: string): Promise<void> {
  return request<void>(`${BASE}/entries/${encodeURIComponent(id)}/`, { method: 'DELETE' });
}

export function getFaqCategories(): Promise<FaqCategorySummary[]> {
  return request<FaqCategorySummary[]>(`${BASE}/categories/`);
}

export function tryFaqQuestion(question: string): Promise<FaqTryReply> {
  return request<FaqTryReply>(`${BASE}/try/`, json('POST', { question }));
}

export function getFaqSearchStatus(): Promise<FaqSearchStatus> {
  return request<FaqSearchStatus>(`${BASE}/search-status/`);
}

export function getFaqQuestions(): Promise<{ stats: FaqQuestionStats; groups: FaqQuestionGroup[] }> {
  return request(`${BASE}/questions/`);
}

/** Only the numbers, without grouping the questions. */
export function getFaqQuestionStats(): Promise<{ stats: FaqQuestionStats }> {
  return request(`${BASE}/questions/?only=stats`);
}

export function reviewFaqQuestions(input: { ids: string[]; action: 'add' | 'create' | 'dismiss'; entryId?: string; text?: string }): Promise<{ settled: number; stats: FaqQuestionStats }> {
  return request(`${BASE}/questions/review/`, json('POST', input));
}

export function getFaqSettings(): Promise<FaqChatbotSettings> {
  return request<FaqChatbotSettings>(`${BASE}/settings/`);
}

export function saveFaqSettings(input: Partial<Pick<FaqChatbotSettings, 'contactText' | 'commonQuestions'>>): Promise<FaqChatbotSettings> {
  return request<FaqChatbotSettings>(`${BASE}/settings/`, json('PATCH', input));
}

export async function downloadFaqReviewList(): Promise<void> {
  const blob = await requestBlob(`${BASE}/review-list/`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `faq-review-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getFaqDocuments(): Promise<FaqDocumentSummary[]> {
  return request<FaqDocumentSummary[]>(`${BASE}/documents/`);
}

export function uploadFaqDocument(file: File, title: string): Promise<FaqDocumentSummary> {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  return requestMultipart<FaqDocumentSummary>(`${BASE}/documents/`, form);
}

export function replaceFaqDocument(id: string, file: File): Promise<FaqDocumentSummary> {
  const form = new FormData();
  form.append('file', file);
  return requestMultipart<FaqDocumentSummary>(`${BASE}/documents/${encodeURIComponent(id)}/replace/`, form);
}

export function renameFaqDocument(id: string, title: string): Promise<FaqDocumentSummary> {
  return request<FaqDocumentSummary>(`${BASE}/documents/${encodeURIComponent(id)}/`, json('PATCH', { title }));
}

export function stepFaqDocument(id: string, step: 'archive' | 'restore'): Promise<FaqDocumentSummary> {
  return request<FaqDocumentSummary>(`${BASE}/documents/${encodeURIComponent(id)}/${step}/`, { method: 'POST' });
}

/** Saves a reference document, for the office or a student opening a passage's source. */
export async function downloadFaqDocument(id: string, fileName: string): Promise<void> {
  const blob = await requestBlob(`${BASE}/documents/${encodeURIComponent(id)}/file/`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
