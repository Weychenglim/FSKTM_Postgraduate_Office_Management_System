/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// What the office edits on a letter type, and the words used for it, shared by
// the letter type list, the editor's steps and the student form builder.

import type { LetterCustomField, LetterPurpose, LetterQuestion, LetterQuestionKind, LetterTemplate, LetterTemplateStatus } from '../types';
import { fieldNameFromLabel, placeholderPurposeHint } from './letterDocument';

export const LETTER_TYPES = ['Academic Certification', 'Visa & Immigration', 'General Notifications', 'Financial Clearance'];
export const DEFAULT_REFERENCE_PREFIX = 'UMF/PG';
export const MAX_VALID_MONTHS = 60;
export const MAX_READY_DAYS = 60;
export const MAX_QUESTIONS = 15;

export const PURPOSE_OPTIONS: ReadonlyArray<{ value: LetterPurpose; label: string; description: string }> = [
  { value: 'REQUEST', label: 'When a student asks for it', description: 'Students request it in Letter Generation, and the office approves each request.' },
  {
    value: 'SUPERVISOR_APPOINTMENT',
    label: 'After a supervisor is approved',
    description: 'Sent automatically once the coordinator approves a supervisor appointment.',
  },
  {
    value: 'PANEL_APPOINTMENT',
    label: 'After a panel member is approved',
    description: 'Sent automatically once the coordinator approves a panel appointment.',
  },
  {
    value: 'CO_SUPERVISOR_APPOINTMENT',
    label: 'After a supporting supervisor is approved',
    description: 'Sent automatically once the coordinator approves a supporting supervisor.',
  },
];

export const PURPOSE_NOTE: Partial<Record<LetterPurpose, string>> = {
  SUPERVISOR_APPOINTMENT:
    'Goes to the student and the supervisor, with a notice to each. Students cannot request it, and only one template can be active for it.',
  PANEL_APPOINTMENT:
    'Goes to the student and the panel member, with the supervisor in copy and a notice to each. Students cannot request it, and only one template can be active for it.',
  CO_SUPERVISOR_APPOINTMENT:
    'Goes to the student and the supporting supervisor, with the main supervisor in copy and a notice to each. Students cannot request it, and only one template can be active for it.',
};

export const PURPOSE_CHIP: Record<LetterPurpose, string> = {
  REQUEST: 'Requested by students',
  SUPERVISOR_APPOINTMENT: 'Sent after supervisor approval',
  PANEL_APPOINTMENT: 'Sent after panel approval',
  CO_SUPERVISOR_APPOINTMENT: 'Sent after supporting supervisor approval',
};

export const STATUS_HINT: Record<LetterTemplateStatus, string> = {
  Active: 'In use. Students can request it, or it is sent automatically.',
  Draft: 'Not in use yet. Nobody can request or receive it.',
  Archived: 'Kept for the record, no longer used.',
};

export const STATUS_TONE: Record<LetterTemplateStatus, 'success' | 'warning' | 'neutral'> = {
  Active: 'success',
  Draft: 'neutral',
  Archived: 'warning',
};

export const listInWords = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export const describePlaceholderProblems = ({ unknown, malformed }: { unknown: string[]; malformed: string[] }) =>
  [
    unknown.length ? `${listInWords(unknown)} ${unknown.length === 1 ? 'is not a detail' : 'are not details'} this letter can fill in. Pick details from Insert detail instead.` : '',
    ...unknown.map(placeholderPurposeHint),
    malformed.length ? `${listInWords(malformed)} ${malformed.length === 1 ? 'has' : 'have'} broken brackets. Delete it and pick the detail from Insert detail.` : '',
  ].filter(Boolean).join(' ');

export interface TagLabel {
  tag: string;
  label: string;
  kind: 'record' | 'student' | 'office';
}

const KIND_SUFFIX: Record<TagLabel['kind'], string> = { record: '', student: ' (student answer)', office: ' (office fills in)' };

/** The names the office sees for a letter's tags while writing, as in [Student Name]. Each name stands for one tag. */
export function tagLabels(entries: readonly TagLabel[]) {
  const toLabel = new Map<string, string>();
  const toTag = new Map<string, string>();
  for (const { tag, label, kind } of entries) {
    if (toLabel.has(tag)) continue;
    const clean = (label.trim() || tag.slice(2, -2)).replace(/\[/g, '(').replace(/\]/g, ')');
    let shown = clean;
    if (toTag.has(shown)) shown = `${clean}${KIND_SUFFIX[kind]}`;
    if (toTag.has(shown)) shown = `${clean} (${tag.slice(2, -2)})`;
    toLabel.set(tag, shown);
    toTag.set(shown, tag);
  }
  return { toLabel, toTag };
}

export type TagLabels = ReturnType<typeof tagLabels>;

export const toFriendly = (text: string, labels: TagLabels) =>
  text.replace(/\{\{[A-Z_]+\}\}/g, (tag) => {
    const label = labels.toLabel.get(tag);
    return label ? `[${label}]` : tag;
  });

export const fromFriendly = (text: string, labels: TagLabels) =>
  text.replace(/\[([^[\]\n]+)\]/g, (whole, label: string) => labels.toTag.get(label) ?? whole);

/** Everything the editor changes, as the office types it. */
export interface EditorValues {
  name: string;
  type: string;
  description: string;
  referencePrefix: string;
  content: string;
  contentMs: string;
  customFields: LetterCustomField[];
  status: LetterTemplateStatus;
  purpose: LetterPurpose;
  questions: LetterQuestion[];
  /** Typed as text so the box can be empty; blank means no end date. */
  validMonths: string;
  /** Typed as text; blank says nothing about how long it takes. */
  readyInDays: string;
  signatoryName: string;
  signatoryTitle: string;
  signatoryNameMs: string;
  signatoryTitleMs: string;
}

// A new letter type is only saved when the office presses Save.
export const BLANK_TEMPLATE: EditorValues = {
  name: '',
  type: 'Academic Certification',
  description: '',
  referencePrefix: '',
  content: 'Dear Sir/Madam,\n\nThis is to confirm that {{STUDENT_NAME}} ({{STUDENT_ID}}) is a student of {{PROGRAMME_NAME}}.',
  contentMs: '',
  customFields: [],
  status: 'Draft',
  purpose: 'REQUEST',
  questions: [],
  validMonths: '',
  readyInDays: '',
  signatoryName: '',
  signatoryTitle: '',
  signatoryNameMs: '',
  signatoryTitleMs: '',
};

export const valuesOf = (template: LetterTemplate): EditorValues => ({
  name: template.name,
  type: template.type,
  description: template.description,
  referencePrefix: template.referencePrefix ?? '',
  content: template.content ?? '',
  contentMs: template.contentMs ?? '',
  customFields: template.customFields ?? [],
  status: template.status,
  purpose: template.purpose ?? 'REQUEST',
  questions: template.formQuestions ?? [],
  validMonths: template.validMonths ? String(template.validMonths) : '',
  readyInDays: template.readyInDays ? String(template.readyInDays) : '',
  signatoryName: template.signatoryName ?? '',
  signatoryTitle: template.signatoryTitle ?? '',
  signatoryNameMs: template.signatoryNameMs ?? '',
  signatoryTitleMs: template.signatoryTitleMs ?? '',
});

export const sameValues = (a: EditorValues, b: EditorValues) => JSON.stringify(a) === JSON.stringify(b);

export const QUESTION_KINDS: ReadonlyArray<{ kind: LetterQuestionKind; label: string; description: string }> = [
  { kind: 'recipient', label: 'Who is the letter for?', description: 'Purpose, then the bank, agency or company, then its address' },
  { kind: 'extras', label: 'Additional information', description: 'Tick boxes for semesters left and the current semester' },
  { kind: 'text', label: 'Short text', description: 'A name, a number or a few words' },
  { kind: 'date', label: 'Date', description: 'A travel or appointment date' },
  { kind: 'choice', label: 'Choose from a list', description: 'One entry from a list in Lists' },
  { kind: 'yesno', label: 'Yes or no', description: 'A tick box' },
];

export const questionKindLabel = (kind: LetterQuestionKind) => QUESTION_KINDS.find((item) => item.kind === kind)?.label ?? kind;

/** The office's own questions: they have a label and a tag on the letter. */
export const isCustomQuestion = (question: LetterQuestion) => !['recipient', 'extras'].includes(question.kind);

/** A new question of `kind`, with a tag name that no other question or blank uses. */
export function newQuestion(kind: LetterQuestionKind, label: string, taken: readonly string[]): LetterQuestion {
  if (kind === 'recipient') return { kind, purposes: [], askAddress: true };
  if (kind === 'extras') return { kind };
  return { kind, name: fieldNameFromLabel(label, taken), label, hint: '', required: kind !== 'yesno' };
}

/** The tag names the letter's own questions use. */
export const questionNames = (questions: readonly LetterQuestion[]) =>
  questions.filter(isCustomQuestion).map((question) => question.name ?? '').filter(Boolean);
