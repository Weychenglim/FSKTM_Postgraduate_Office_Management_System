/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Letter generation domain models (UC21, UC23).

export type LetterTemplateStatus = 'Active' | 'Draft' | 'Archived';

/**
 * What a template is used for. Students request REQUEST letters; the two
 * appointment letters are made by themselves when a coordinator approves an
 * appointment (UC22).
 */
export type LetterPurpose = 'REQUEST' | 'SUPERVISOR_APPOINTMENT' | 'PANEL_APPOINTMENT' | 'CO_SUPERVISOR_APPOINTMENT';

/** One placeholder a template may use, from `GET /api/letter-templates/placeholders/`. */
export interface LetterPlaceholder {
  tag: string;
  name: string;
  label: string;
  source: string;
  /** The kinds of letter it works in. */
  purposes?: LetterPurpose[];
}

/** A value the office types in when it approves a request, e.g. attendance. */
export interface LetterCustomField {
  /** The tag's name: `{{ATTENDANCE}}` has the name `ATTENDANCE`. */
  name: string;
  label: string;
  hint: string;
}

/**
 * A single official letter template. Staff author and manage these (name,
 * status, `content` with `{{PLACEHOLDER}}` tags, and their own office-filled
 * fields); students only see an Active template's name and description, and
 * request a letter from it. Shape matches the Django
 * `LetterTemplate.to_public_dict`.
 */
export interface LetterTemplate {
  id: string;
  name: string;
  type: string;
  status: LetterTemplateStatus;
  lastModified: string;
  modifiedBy: string;
  description: string;
  /** The wording; only staff get it. */
  content?: string;
  /** Office-filled fields; only staff get them. */
  customFields?: LetterCustomField[];
  /** Prefix used to build the reference number, e.g. "UMF/PG". */
  referencePrefix?: string;
  purpose?: LetterPurpose;
  /** Printed under the signature line; blank keeps the faculty default. */
  signatoryName?: string;
  signatoryTitle?: string;
  /** The same lines on the Malay page; blank uses the English ones. */
  signatoryNameMs?: string;
  signatoryTitleMs?: string;
  /** The same letter in Malay, printed as a second page; only staff get it. */
  contentMs?: string;
  /** Students say who the letter is for (a bank, an agency...) when they ask. */
  asksRecipient?: boolean;
  /** The optional details a student may tick, because the letter shows them, e.g. MIN_PERIOD. */
  optionalDetails?: string[];
  /** The questions on the student's form, in order. */
  formQuestions?: LetterQuestion[];
  /** "Usually ready in N working days"; null to say nothing. */
  readyInDays?: number | null;
  /** How many months an issued letter stays valid; null for no limit. */
  validMonths?: number | null;
}

/** What a student's form asks, as the office set it on a letter type. */
export type LetterQuestionKind = 'recipient' | 'extras' | 'text' | 'date' | 'choice' | 'yesno';

export interface LetterQuestion {
  kind: LetterQuestionKind;
  /** "Who is the letter for?": the purpose codes offered; empty offers all. */
  purposes?: string[];
  askAddress?: boolean;
  /** The office's own questions: the tag on the letter, the words the student sees. */
  name?: string;
  label?: string;
  hint?: string;
  required?: boolean;
  /** A "Choose from a list" question's list. */
  listId?: number;
}

/** An organisation students can choose, with the address filled in for them. */
export interface LetterOrganisation {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  city: string;
  state: string;
  country: string;
}

/** One purpose a letter can be for, with the organisations listed under it. */
export interface LetterRecipientPurpose {
  code: string;
  label: string;
  /** What one organisation is called, e.g. "Bank". */
  organisationLabel: string;
  /** Students may type an organisation that is not listed. */
  allowOther: boolean;
  organisations: LetterOrganisation[];
}

/** A question as the student's form shows it, with what to choose from. */
export type LetterFormQuestion =
  | (LetterQuestion & { kind: 'recipient'; options: LetterRecipientPurpose[] })
  | { kind: 'extras'; options: { code: string; label: string }[] }
  | (LetterQuestion & { kind: 'choice'; list: { id: string | null; name: string; itemNoun: string; items: { id: string; name: string }[] } })
  | (LetterQuestion & { kind: 'text' | 'date' | 'yesno' });

/** A letter's form, from `GET /api/letters/requests/form/<id>/`. */
export interface LetterForm {
  templateId: string;
  questions: LetterFormQuestion[];
  readyInDays: number | null;
}

/** What the student answered one of the office's questions, as saved with the request. */
export interface LetterAnswer {
  kind: LetterQuestionKind;
  label: string;
  answer: string | boolean;
  value: string;
  valueMs: string;
}

/** The office's lists for letter questions. */
export type ChoiceListKind = 'RECIPIENTS' | 'SIMPLE';

export interface ChoiceListSummary {
  id: string;
  name: string;
  kind: ChoiceListKind;
  description: string;
  itemNoun: string;
  groupCount: number;
  itemCount: number;
  hiddenCount: number;
  /** Letter types with a question that uses the list. */
  usedBy: string[];
  modifiedBy: string;
}

/** A purpose in the recipients list. */
export interface ChoiceGroup {
  id: string;
  code: string;
  name: string;
  nameMs: string;
  itemNoun: string;
  allowOther: boolean;
  hidden: boolean;
  /** Letters asked for with this purpose. */
  usedCount: number;
  modifiedBy: string;
}

export interface ChoiceItem {
  id: string;
  groupId: string | null;
  name: string;
  nameMs: string;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  city: string;
  state: string;
  country: string;
  hidden: boolean;
  /** Letters that used this entry; only unused entries can be deleted. */
  usedCount: number;
  modifiedBy: string;
}

export interface ChoiceListDetail extends ChoiceListSummary {
  groups: ChoiceGroup[];
  items: ChoiceItem[];
}

/** What the student chooses from on a confirmation letter request. */
export interface LetterRecipientOptions {
  purposes: LetterRecipientPurpose[];
  optionalDetails: { code: string; label: string }[];
}

/** Who a letter is for, as the student entered it. */
export interface LetterRequestDetails {
  purpose: string;
  /** The purpose as it was called when the student asked. */
  purposeLabel?: string;
  organisation: string;
  /** The chosen organisation's entry in the recipients list, when chosen from it. */
  organisationId?: string | number | null;
  organisationMs?: string;
  /** Typed in by the student rather than chosen from the list. */
  typedIn?: boolean;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  city: string;
  /** One of Malaysia's states; blank for an address abroad. */
  state: string;
  country: string;
  /** The optional details to show, e.g. MIN_PERIOD. */
  include: string[];
  /** Answers to the office's own questions, by tag name. */
  answers?: Record<string, LetterAnswer>;
}

/** Someone an appointment letter was sent to, besides the office. */
export interface LetterRecipient {
  name: string;
  relation: 'Student' | 'Supervisor' | 'Panel member' | 'Supporting supervisor';
}

/** An active appointment with no letter yet, and why it cannot be made now (or null). */
export type AppointmentLetterKind = 'supervisor' | 'panel' | 'supporting';

export interface MissingAppointmentLetter {
  kind: AppointmentLetterKind;
  appointmentId: string;
  studentName: string;
  matricNumber: string;
  lecturerName: string;
  appointedOn: string;
  problem: string | null;
}

export interface MadeAppointmentLetters {
  made: number;
  results: Array<{
    kind: AppointmentLetterKind;
    appointmentId: string;
    letterId: string | null;
    status: GeneratedLetterStatus | null;
    problem: string | null;
  }>;
}

/**
 * Pending: waiting for the office. Issued: approved, with its reference number.
 * Rejected: turned down with a reason. Withdrawn: taken back by the student.
 * Revoked: issued, then withdrawn by the office.
 */
export type GeneratedLetterStatus = 'Pending' | 'Issued' | 'Rejected' | 'Withdrawn' | 'Revoked';

export const LETTER_REQUEST_STATUSES: readonly GeneratedLetterStatus[] = [
  'Pending',
  'Issued',
  'Rejected',
  'Withdrawn',
  'Revoked',
];

/** One value a pending letter needs, as the office sees it when reviewing. */
export interface LetterRequestField {
  name: string;
  label: string;
  hint: string;
  /** From the student's record, or typed in by the office. */
  source: 'record' | 'office' | 'student';
  /** The record's value (blank when the record has none). */
  value: string;
  /** The office must type it in before approving. */
  needed: boolean;
}

/**
 * A letter request and, once approved, the letter as issued, from
 * `/api/letters/requests/`. Shape matches the Django
 * `GeneratedLetter.to_public_dict`. `content` (the filled wording) only comes
 * with a single issued letter; the review fields only reach office staff.
 */
export interface GeneratedLetter {
  id: string;
  /** Blank until the office approves. */
  referenceNumber: string;
  templateId: string | null;
  templateName: string;
  letterType: string;
  /** REQUEST for a student's request; an appointment letter otherwise. */
  purpose?: LetterPurpose;
  /** The letter that replaced this one, when the office reissued it. */
  replacedById?: string | null;
  signatoryName?: string;
  signatoryTitle?: string;
  signatoryNameMs?: string;
  signatoryTitleMs?: string;
  /** Appointment letters: who it was sent to. */
  recipients?: LetterRecipient[];
  status: GeneratedLetterStatus;
  /** Issue date as printed on the letter, e.g. "11 October 2026"; blank until approved. */
  date: string;
  requestedAt: string;
  issuedAt: string | null;
  studentName: string;
  matricNumber: string;
  programName: string;
  /** The student's note to the office. */
  note: string;
  /** Who the letter is for, when the template asks; empty otherwise. */
  requestDetails?: Partial<LetterRequestDetails>;
  /** The last day the letter is valid (YYYY-MM-DD), when the template sets it. */
  validUntil?: string | null;
  decidedAt: string | null;
  decidedBy: string;
  rejectReason: string;
  withdrawnAt: string | null;
  revokedAt: string | null;
  revokeReason: string;
  content?: string;
  /** The Malay page, when the letter has one. */
  contentMs?: string;
  /** Office only: what the office typed in when approving. */
  officeValues?: Record<string, string>;
  /** Office only, while pending: the template's current wording and needs. */
  templateContent?: string;
  templateContentMs?: string;
  /** Office only, while pending: values that read differently on the Malay page, by tag name. */
  malayValues?: Record<string, string>;
  /** Office only, while pending: the valid-until date as it would be printed today. */
  previewValidUntil?: string;
  templateStatus?: LetterTemplateStatus | null;
  referencePrefix?: string;
  fields?: LetterRequestField[];
  /** Office only, while pending: why it cannot be approved, if anything. */
  problem?: string | null;
  /** Office only, while pending: the student's issued copies this approval replaces. */
  replaces?: { id: string; referenceNumber: string; issuedAt: string | null }[];
}

/** Office list filters; dates are YYYY-MM-DD and bound the issue date. */
export interface LetterRequestFilters {
  search?: string;
  from?: string;
  to?: string;
  /** One status, or several separated by commas. */
  status?: string;
  /** Letters students asked for, or appointment letters made automatically. */
  madeBy?: '' | 'request' | 'automatic';
}

export type LetterRequestCounts = Record<GeneratedLetterStatus, number>;
