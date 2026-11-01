/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// FAQ chatbot (UC28) and its knowledge base (UC29).

export type FaqPortalLink = '' | 'SUPERVISOR_APPOINTMENTS' | 'PANEL_APPOINTMENTS' | 'LETTERS' | 'FILES' | 'ANNOUNCEMENTS';
export type FaqOutcome = 'ANSWERED' | 'CHOICES' | 'DOCUMENT' | 'NO_MATCH';

export interface FaqLink {
  id: string;
  question: string;
}

export interface FaqAnswerCard {
  id: string;
  question: string;
  answer: string;
  category: string;
  portalLink: FaqPortalLink;
}

/** A passage from a document the office uploaded: an extract, not a reviewed answer. */
export interface FaqPassageCard {
  documentId: string;
  title: string;
  fileName: string;
  page: number | null;
  text: string;
}

export interface FaqReply {
  outcome: FaqOutcome;
  answer: FaqAnswerCard | null;
  choices: FaqLink[];
  related: FaqLink[];
  passage: FaqPassageCard | null;
  contactText: string;
  mode: 'hybrid' | 'keywords';
  questionId: string;
  token: string;
}

export interface FaqStart {
  categories: { id: string; name: string; questions: FaqLink[] }[];
  commonQuestions: string[];
  contactText: string;
}

export interface FaqFeedbackReply {
  helpful: boolean;
  contactText: string;
}

// The office's knowledge base (UC29).

export type FaqStatus = 'PUBLISHED' | 'DRAFT' | 'NEEDS_CHECKING' | 'ARCHIVED';
export type FaqStatusFilter = '' | FaqStatus;

export interface FaqEntrySummary {
  id: string;
  question: string;
  answer: string;
  category: { id: string; name: string };
  status: FaqStatus;
  portalLink: FaqPortalLink;
  imported: boolean;
  note: string;
  altCount: number;
  /** Students who got this answer this month, and how many said it didn't help. */
  askedThisMonth: number;
  notHelpfulThisMonth: number;
  updatedAt: string;
  updatedBy: string;
}

export interface FaqChangeRow {
  id: number;
  action: string;
  actor: string;
  at: string;
  details: Record<string, unknown>;
}

export interface FaqEntryDetail extends FaqEntrySummary {
  altQuestions: string[];
  source: { text: string; note: string; page: number | null } | null;
  checkedBy: string;
  checkedAt: string | null;
  history: FaqChangeRow[];
}

export interface FaqEntryList {
  count: number;
  page: number;
  pageSize: number;
  statusCounts: Record<FaqStatus, number>;
  results: FaqEntrySummary[];
}

export interface FaqEntryFilters {
  search: string;
  category: string;
  status: FaqStatusFilter;
  page: number;
  pageSize?: number;
}

export interface FaqCategorySummary {
  id: string;
  name: string;
  position: number;
  entries?: Partial<Record<FaqStatus, number>>;
}

export interface FaqEntryInput {
  question?: string;
  answer?: string;
  category?: string;
  portalLink?: FaqPortalLink;
  altQuestions?: string[];
  publish?: boolean;
}

export interface FaqTryCandidate {
  id: string;
  question: string;
  confidence: number;
  meaning: number | null;
  keywords: number;
}

export interface FaqTryReply extends Omit<FaqReply, 'questionId' | 'token'> {
  match: 'Strong' | 'Possible' | 'None';
  passageConfidence: number | null;
  candidates: FaqTryCandidate[];
}

export interface FaqQuestionGroup {
  key: string;
  text: string;
  count: number;
  lastAsked: string;
  noMatch: number;
  notHelpful: number;
  lastOutcome: 'ANSWERED' | 'CHOICES' | 'DOCUMENT' | 'NO_MATCH';
  lastEntry: FaqLink | null;
  ids: string[];
}

export interface FaqQuestionStats {
  thisMonth: number;
  answeredPercent: number | null;
  helpfulPercent: number | null;
  waiting: number;
}

export interface FaqChatbotSettings {
  contactText: string;
  commonQuestions: string[];
  updatedBy: string;
  updatedAt: string;
}

export interface FaqSearchStatus {
  mode: 'hybrid' | 'keywords';
  model: string;
  published: number;
  documents: number;
  vectors: number;
}

export interface FaqDocumentSummary {
  id: string;
  title: string;
  fileName: string;
  kind: 'PDF' | 'DOCX';
  size: string;
  pages: number | null;
  status: 'READY' | 'NO_TEXT';
  passages: number;
  archived: boolean;
  uploadedBy: string;
  uploadedAt: string;
}
