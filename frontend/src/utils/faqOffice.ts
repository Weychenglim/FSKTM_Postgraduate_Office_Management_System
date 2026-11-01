/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FaqChangeRow, FaqPortalLink, FaqQuestionGroup, FaqStatus } from '../types';
import { FAQ_PORTAL_LINKS } from './faqText';

export const FAQ_STATUS_LABEL: Record<FaqStatus, string> = {
  PUBLISHED: 'Live',
  DRAFT: 'Draft',
  NEEDS_CHECKING: 'Needs checking',
  ARCHIVED: 'Archived',
};

export const FAQ_STATUS_CHIP: Record<FaqStatus, string> = {
  PUBLISHED: 'bg-emerald-50 text-emerald-800',
  DRAFT: 'bg-slate-100 text-slate-700',
  NEEDS_CHECKING: 'bg-amber-50 text-amber-800',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The quiet line under a question in the entries list. */
export function entryHint(entry: { status: FaqStatus; note: string; altCount: number; portalLink: FaqPortalLink }): string {
  if (entry.status === 'NEEDS_CHECKING' && entry.note) return entry.note;
  const parts = [];
  if (entry.altCount) parts.push(plural(entry.altCount, 'other way to ask', 'other ways to ask'));
  if (entry.portalLink) parts.push(`Button: ${FAQ_PORTAL_LINKS[entry.portalLink].label}`);
  return parts.join(' · ');
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const STATUS_WORDS: Record<string, string> = { PUBLISHED: 'published', DRAFT: 'a draft', NEEDS_CHECKING: 'needs checking', ARCHIVED: 'archived' };

export function faqHistoryLine(change: FaqChangeRow): string {
  const details = change.details ?? {};
  switch (change.action) {
    case 'IMPORTED':
      return `Imported from the FAQ PDF as ${STATUS_WORDS[text(details.status)] ?? 'an entry'}`;
    case 'CREATED':
      return 'Created';
    case 'EDITED': {
      const fields = Array.isArray(details.fields) ? (details.fields as string[]) : [];
      const from = details.source ? ` from ${text(details.source)}` : '';
      return fields.length ? `Changed the ${fields.join(', ')}${from}` : `Edited${from}`;
    }
    case 'PUBLISHED':
      return 'Published';
    case 'CHECKED':
      return 'Marked as checked';
    case 'ARCHIVED':
      return 'Archived';
    case 'RESTORED':
      return 'Restored as a draft';
    case 'DELETED':
      return 'Deleted';
    case 'DOCUMENT_ADDED':
      return 'Document uploaded';
    case 'DOCUMENT_REPLACED':
      return 'Document file replaced';
    case 'DOCUMENT_RENAMED':
      return 'Document renamed';
    case 'DOCUMENT_ARCHIVED':
      return 'Document archived';
    case 'DOCUMENT_RESTORED':
      return 'Document restored';
    default:
      return change.action;
  }
}

/** What the chatbot did with a group of questions, in words. */
export function groupLine(group: FaqQuestionGroup, when: string): string {
  const asked = `Asked ${plural(group.count, 'time', 'times')} · last on ${when}`;
  if (group.lastOutcome === 'NO_MATCH') return `${asked} · no answer found`;
  if (group.lastOutcome === 'CHOICES') return `${asked} · the chatbot offered choices`;
  if (group.lastOutcome === 'DOCUMENT') return `${asked} · the chatbot showed a passage from a document`;
  if (group.lastEntry) return `${asked} · the chatbot showed "${group.lastEntry.question}"`;
  return asked;
}

export const percent = (value: number | null) => (value === null ? 'None yet' : `${value}%`);

/** A reference document's state, as the Documents tab shows it. */
export function documentState(document: { status: 'READY' | 'NO_TEXT'; passages: number; archived: boolean }): { label: string; className: string } {
  if (document.archived) return { label: 'Archived', className: 'bg-slate-100 text-slate-600' };
  if (document.status === 'NO_TEXT') return { label: 'No text found (scanned PDF?)', className: 'bg-amber-50 text-amber-800' };
  return { label: `Ready, ${plural(document.passages, 'passage', 'passages')}`, className: 'bg-emerald-50 text-emerald-800' };
}

/** "From Postgraduate Handbook 2026, page 12" above a passage in the chat. */
export const passageSource = (passage: { title: string; page: number | null }): string =>
  `From ${passage.title}${passage.page ? `, page ${passage.page}` : ''}`;
