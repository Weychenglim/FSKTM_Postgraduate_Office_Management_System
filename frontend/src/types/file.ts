/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// File Management (UC24 to UC27): official documents linked to student records.

export type DocumentKind = 'PDF' | 'DOCX' | 'IMAGE' | 'XLSX' | 'PPTX';
export type DocumentCheckStatus = 'NONE' | 'WAITING' | 'ACCEPTED' | 'RETURNED';
export type StaffAudience = 'ACADEMIC' | 'COORDINATORS' | 'OFFICE';
export type DocumentTypeKind = 'STUDENT' | 'STAFF' | 'BOTH';
export type DocumentUploaderRole = 'STUDENT' | 'SUPERVISOR' | 'PANEL' | 'COORDINATOR' | 'LECTURER';

export interface DocumentTypeOption {
  code: string;
  label: string;
  description: string;
  group: string;
  groupLabel: string;
  kind: DocumentTypeKind;
  uploaders: DocumentUploaderRole[];
  allowedKinds: DocumentKind[];
  shareSupervisors: boolean;
  sharePanel: boolean;
  shareCoordinator: boolean;
  needsCheck: boolean;
  onePerStudent: boolean;
  required: boolean;
  requiredDueNote: string;
  requiredProgrammes: string[];
  isActive: boolean;
}

export interface DocumentOptions {
  types: DocumentTypeOption[];
  groups: Array<{ value: string; label: string }>;
  currentSemester: { id: number; label: string } | null;
  maxBytes: number;
  isOffice: boolean;
  canUploadStaffFiles: boolean;
  canSeeRequired: boolean;
  semesters?: Array<{ id: number; label: string }>;
  programmes?: string[];
  intakes?: string[];
  audiences?: Array<{ value: StaffAudience; label: string }>;
  /** A student's own record, for the summary beside their upload. */
  me?: { programme: string; intake: string; supervisors: string[]; panel: string[]; coordinators: string[] };
}

export interface DocumentStudentRef {
  matric: string;
  name: string;
  programme: string;
}

export interface DocumentFileInfo {
  number: number;
  name: string;
  kind: DocumentKind;
  size: number;
  pageCount: number | null;
  uploadedAt: string;
}

export interface DocumentSharing {
  supervisors: boolean;
  panel: boolean;
  coordinator: boolean;
}

export interface DocumentPermissions {
  canDownload: boolean;
  canDelete: boolean;
  canUploadVersion: boolean;
  canEdit: boolean;
  canChangeSharing: boolean;
  canCheck: boolean;
  canArchive: boolean;
  canRestore: boolean;
}

export type DocumentAutoTagKind = 'category' | 'required' | 'semester' | 'from' | 'programme' | 'intake';
export type DocumentSender = 'student' | 'lecturer' | 'coordinator' | 'office';

/** A tag the system gives a file; `filter` is what clicking it filters the list by. */
export interface DocumentAutoTag {
  kind: DocumentAutoTagKind;
  label: string;
  filter: Partial<Pick<DocumentFilters, 'group' | 'required' | 'semester' | 'sender' | 'programme' | 'intake'>>;
}

export interface PortalDocument {
  id: number;
  reference: string;
  title: string;
  description: string;
  type: { code: string; label: string };
  group: string;
  groupLabel: string;
  students: DocumentStudentRef[];
  isStaffFile: boolean;
  staffAudience: StaffAudience | '';
  staffAudienceLabel: string;
  staffProgrammes: string[];
  share: DocumentSharing;
  autoTags: DocumentAutoTag[];
  semester: { id: number; label: string } | null;
  uploadedBy: { name: string; role: string; roleLabel: string; isMe: boolean };
  uploadedAt: string;
  checkStatus: DocumentCheckStatus;
  checkStatusLabel: string;
  checkReason: string;
  checkedBy: string;
  checkedAt: string | null;
  file: DocumentFileInfo | null;
  archived: boolean;
  archivedAt: string | null;
  archivedBy: string;
  archiveReason: string;
  permissions: DocumentPermissions;
}

export interface DocumentDetail extends PortalDocument {
  sharedWith: Array<{ name: string; role: string }>;
  versions: DocumentFileInfo[];
  history?: HistoryEntry[];
}

export interface DocumentPage {
  count: number;
  limit: number;
  offset: number;
  results: PortalDocument[];
}

export interface DocumentSummary {
  all: number;
  staffFiles: number;
  mine: number;
  toCheck?: number;
  returned?: number;
  archived?: number;
  studentsStillToHandIn?: number;
}

export interface TaggableStudent {
  matric: string;
  name: string;
  programme: string;
  intake?: string;
  status: string;
  relation: string;
  roles: Array<'SUPERVISOR' | 'PANEL' | 'COORDINATOR'>;
  supervisors: string[];
  panel: string[];
  coordinators: string[];
}

export interface StudentFileHeader {
  matric: string;
  name: string;
  programme: string;
  status: string;
  supervisors: string[];
  panel: string[];
  letters: number | null;
  required?: Array<{ label: string; state: RequiredState }> | null;
}

export type DocumentView = 'all' | 'check' | 'staff' | 'mine' | 'required' | 'letters';

export interface DocumentFilters {
  view: DocumentView;
  q: string;
  type: string;
  group: string;
  semester: string;
  programme: string;
  intake: string;
  student: string;
  uploader: '' | 'me' | 'students' | 'staff';
  sender: '' | DocumentSender;
  required: '' | '1';
  status: '' | DocumentCheckStatus;
  kind: '' | DocumentKind;
  from: string;
  to: string;
  archived: '' | '1';
}

export interface DocumentUploadInput {
  file: File;
  type: string;
  title: string;
  description: string;
  semester: string;
  students: string[];
  share?: DocumentSharing;
  audience?: StaffAudience;
  programmes?: string[];
  acknowledgeWarnings?: boolean;
}

export interface DocumentTypeSetting extends DocumentTypeOption {
  id: number;
  files: number;
  studentUploads: number;
  waiting: number;
  updatedFiles?: number;
}

export interface DocumentTypeSettings {
  types: DocumentTypeSetting[];
  groups: Array<{ value: string; label: string }>;
  kindUploaders: Record<DocumentTypeKind, DocumentUploaderRole[]>;
  programmes: string[];
}

export interface DocumentTypeInput {
  label: string;
  description: string;
  group: string;
  kind: DocumentTypeKind;
  uploaders: DocumentUploaderRole[];
  shareSupervisors: boolean;
  sharePanel: boolean;
  shareCoordinator: boolean;
  needsCheck: boolean;
  onePerStudent: boolean;
  required: boolean;
  requiredDueNote: string;
  requiredProgrammes: string[];
  isActive: boolean;
}

export interface SharingPerson {
  name: string;
  role: string;
}

export interface StudentFileSharingOptions {
  isStaffFile: false;
  share: DocumentSharing;
  followsType: boolean;
  people: Record<keyof DocumentSharing, SharingPerson[]>;
}

export interface StaffFileSharingOptions {
  isStaffFile: true;
  audience: StaffAudience;
  programmes: string[];
  audiences: Array<{ value: StaffAudience; label: string }>;
  allProgrammes: string[];
}

export type DocumentSharingOptions = StudentFileSharingOptions | StaffFileSharingOptions;

export const isStaffFileSharing = (options: DocumentSharingOptions): options is StaffFileSharingOptions => options.isStaffFile === true;

export type DocumentSharingChange = DocumentSharing | { audience: StaffAudience; programmes: string[] };

export type HistoryShow = 'all' | 'uploads' | 'changes' | 'checks' | 'archive' | 'deleted' | 'opened' | 'settings';

export interface HistoryEntry {
  id: string;
  action: string;
  actionLabel: string;
  reference: string;
  title: string;
  documentId: number | null;
  actor: string;
  reason: string;
  detail: string;
  at: string;
}

export interface HistoryPage {
  count: number;
  limit: number;
  offset: number;
  results: HistoryEntry[];
}

export type RequiredState = 'DONE' | 'WAITING' | 'RETURNED' | 'MISSING';
export type RequiredShow = 'todo' | 'waiting' | 'done';

export interface RequiredTypeProgress {
  id: number;
  code: string;
  label: string;
  dueNote: string;
  programmes: string[];
  students: number;
  done: number;
  waiting: number;
  returned: number;
  missing: number;
  lastReminder: { at: string; by: string; students: number } | null;
  remindedToday: boolean;
}

export interface RequiredOverview {
  types: RequiredTypeProgress[];
  canRemind: boolean;
}

export interface RequiredStudent {
  matric: string;
  name: string;
  programme: string;
  state: RequiredState;
  documentId: number | null;
}

export interface MyRequiredDocument {
  code: string;
  label: string;
  dueNote: string;
  state: RequiredState;
  documentId: number | null;
}
