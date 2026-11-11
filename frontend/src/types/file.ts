/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// File Management (UC24 to UC27): official documents linked to student records.

export type DocumentKind = 'PDF' | 'DOCX' | 'IMAGE' | 'XLSX' | 'PPTX';
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
  onePerStudent: boolean;
  isActive: boolean;
}

export interface DocumentOptions {
  types: DocumentTypeOption[];
  groups: Array<{ value: string; label: string }>;
  currentSemester: { id: number; label: string } | null;
  maxBytes: number;
  isOffice: boolean;
  canUploadStaffFiles: boolean;
  canSeeSubmissions?: boolean;
  canSeeArchived?: boolean;
  semesters?: Array<{ id: number; label: string }>;
  programmes?: string[];
  intakes?: string[];
  audiences?: Array<{ value: StaffAudience; label: string }>;
  /** A student's own record, for the summary beside their upload. */
  me?: { programme: string; intake: string; stage: '' | 'P1' | 'P2' };
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
  canArchive: boolean;
  canRestore: boolean;
}

export type DocumentAutoTagKind = 'category' | 'semester' | 'from' | 'programme' | 'intake';
export type DocumentSender = 'student' | 'lecturer' | 'coordinator' | 'office';

/** A tag the system gives a file; `filter` is what clicking it filters the list by. */
export interface DocumentAutoTag {
  kind: DocumentAutoTagKind;
  label: string;
  filter: Partial<Pick<DocumentFilters, 'group' | 'semester' | 'sender' | 'programme' | 'intake'>>;
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
  archived?: number;
  toDo?: number;
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
}

export type DocumentView = 'all' | 'staff' | 'mine' | 'submissions' | 'letters';

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
  audience?: StaffAudience;
  programmes?: string[];
  acknowledgeWarnings?: boolean;
}

/** Who sees a staff file. A student file is seen by whoever its type names. */
export interface DocumentSharingOptions {
  audience: StaffAudience;
  programmes: string[];
  audiences: Array<{ value: StaffAudience; label: string }>;
  allProgrammes: string[];
}

export type DocumentSharingChange = { audience: StaffAudience; programmes: string[] };

export type HistoryShow = 'all' | 'uploads' | 'changes' | 'archive' | 'deleted' | 'opened';

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

