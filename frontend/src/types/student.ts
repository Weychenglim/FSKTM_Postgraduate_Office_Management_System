/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Student Registry domain models (UC05-UC09).

// Mirrors accounts.Student.Status in the Django backend. Keep the two in step:
// the API rejects anything outside this set, and the values reach the UI
// unchecked (apiClient casts the JSON response), so a drifted union here is
// invisible to the compiler but breaks status colours and filters at runtime.
export type StudentAcademicStatus = 'Active' | 'Graduated' | 'Deferred' | 'Withdrawn';

// Derived from User.is_active by the registry serializer.
export type StudentAccountStatus = 'Verified' | 'Suspended';

export interface StudentRecord {
  id: string; // e.g. "WGA210045"
  userId?: number;
  name: string;
  avatarText: string;
  avatarBg: string;
  programme: string;
  academicStatus: StudentAcademicStatus;
  accountStatus: StudentAccountStatus;
  semester: string;
  email: string;
  phone: string;
  supervisor: string;
  supervisorStaffNo?: string;
  intakeDate: string;
  activated?: boolean;
  lastLogin?: string | null;
}

export type ImportRowStatus =
  | 'Ready'
  | 'Missing Field'
  | 'Missing Email'
  | 'Bad Programme'
  | 'Invalid Field'
  | 'Duplicate In File'
  | 'Already Registered'
  | 'Programme Skipped';

/** The registry account an already-registered import row matched. */
export interface ImportExistingRecord {
  id: string;
  name: string;
  email: string;
  programme: string;
  academicStatus: string;
  role: string;
}

/** Identity details in the file that disagree with the matched record. */
export type ImportDifference = 'id' | 'name' | 'email';

export interface ImportPreviewRow {
  line: number;
  id: string;
  name: string;
  programme: string;
  /** The programme name in the file, when the office's choice mapped it to an approved programme. */
  programmeInFile?: string;
  /** The email was blank or missing and was filled from the Student ID. */
  emailFilled?: boolean;
  /** The Student ID in the file, when the Student ID rule changed it. */
  idInFile?: string;
  email: string;
  phone: string;
  intake?: string;
  semester?: string;
  status: ImportRowStatus;
  issue: string;
  result?: 'created' | 'skipped' | 'failed';
  invitationSent?: boolean;
  /** Created with its activation email held back, to send later. */
  invitationHeld?: boolean;
  existing?: ImportExistingRecord;
  matchedBy?: 'studentId' | 'email';
  differences?: ImportDifference[];
  duplicateOf?: number;
}

/** A row kept on an import batch's record (older batches lack the optional keys). */
export interface RegistryImportProblem {
  line: number;
  id: string;
  result: string;
  issue: string;
  name?: string;
  status?: string;
  existingName?: string;
  differences?: ImportDifference[];
  duplicateOf?: number;
}

export interface RegistryImportBatch {
  id: number;
  fileName: string;
  uploadedBy: string;
  totalRows: number;
  created: number;
  skipped: number;
  failed: number;
  alreadyRegistered?: number;
  duplicateInFile?: number;
  programmeSkipped?: number;
  emailsFilled?: number;
  invitationsFailed: number;
  invitationsHeld?: boolean;
  invitationsSentAt?: string | null;
  settingsUsed?: {
    defaults?: ImportDefaults;
    programmeMap?: Record<string, string>;
    fillEmail?: boolean;
    idRule?: string | null;
    sendInvites?: boolean;
  };
  problems: RegistryImportProblem[];
  createdAt: string;
}

export type BatchInvitationOutcome = 'sent' | 'failed' | 'alreadyActivated' | 'suspended';

/** What sending a held import's activation emails did. */
export interface BatchInvitationResult {
  sent: number;
  failed: number;
  alreadyActivated: number;
  suspended: number;
  notFound: number;
  /** Each student of the import, by the line of the file they came from. */
  students: { id: string; line: number; outcome: BatchInvitationOutcome }[];
  batch: RegistryImportBatch;
}

export interface ImportPreviewResponse {
  fileName: string;
  rows: ImportPreviewRow[];
  /** Programme names that are not approved programmes, for the office to map once each or skip. */
  programmeValues?: ImportProgrammeValue[];
  /** How many distinct names there are; only the first 100 are listed. */
  programmeValueCount?: number;
}

/** A programme name in the file that is not an approved programme. */
export interface ImportProgrammeValue {
  key: string;
  value: string;
  rows: number;
  /** An approved programme, the skip value, or null when there is nothing to suggest. */
  suggestion: string | null;
  /** saved: the office chose it on an earlier import. similar: the same name spelt differently. */
  source: 'saved' | 'similar' | null;
}

/** The import fields a file's columns can be matched to (accounts/registry_columns.py). */
export type ImportFieldKey =
  | 'student_id'
  | 'full_name'
  | 'programme'
  | 'email'
  | 'phone'
  | 'intake'
  | 'current_semester';

export interface ImportField {
  key: ImportFieldKey;
  label: string;
  required: boolean;
}

export interface ImportColumn {
  index: number;
  letter: string;
  header: string;
  samples: string[];
  suggestedField: ImportFieldKey | null;
}

/** Which column (by index) holds each field; null when it is not in the file. */
export type ImportMapping = Record<ImportFieldKey, number | null>;

/** A file's layout, from the inspect step, for the office to confirm. */
export interface ImportInspectResponse {
  fileName: string;
  sheets: string[];
  sheet: string | null;
  /** False when every row is a student, with no row of column names. */
  hasHeader?: boolean;
  headerRow: number | null;
  headerRowOptions: { row: number; preview: string }[];
  columns: ImportColumn[];
  fields: ImportField[];
  mapping: ImportMapping;
  ignoredColumns: string[];
  rowCount: number;
  /** When the office's saved matches for this layout were made; null when none were used. */
  profileAppliedAt?: string | null;
  /** Names this layout, so an import can save its matches; null for our own template. */
  layoutToken?: string | null;
  /** The SiswaMail domain a missing email is filled with. */
  emailDomain?: string;
  /** How many Student IDs carry a programme number, such as 23004955/1. */
  studentIdsWithSuffix?: number;
  layoutRecognised: boolean;
}

/** Values for every row; they fill blank cells and never overwrite the file. */
export interface ImportDefaults {
  programme?: string;
  intake?: string;
  semester?: string;
}

/** Sent with inspect, preview and import; leaving a key out lets the server decide. */
export interface ImportOptions {
  sheet?: string | null;
  headerRow?: number | null;
  /** False: the rows have no column names, so matches come from the values. */
  hasHeader?: boolean;
  mapping?: ImportMapping | null;
  defaults?: ImportDefaults;
  /** The office's choice for each programme name: an approved programme or the skip value. */
  programmeMap?: Record<string, string>;
  /** Fill a missing email as Student ID@SiswaMail domain; the server's default is on. */
  fillEmail?: boolean;
  /** 'studentId' keeps the part of a Student ID before "/". */
  idRule?: 'studentId' | null;
  /** False holds the activation emails, to send later from Recent Imports. */
  sendInvites?: boolean;
  /** False sets aside the saved column matches for this file. */
  useProfile?: boolean;
  /** The confirmed matches to save for the file's own layout, sent with the import. */
  rememberLayout?: ImportLayoutToRemember;
}

export interface ImportLayoutToRemember {
  token: string;
  mapping: ImportMapping;
  sheet: string | null;
  headerRow: number | null;
}

export interface ImportCommitResponse {
  batch: RegistryImportBatch;
  rows: ImportPreviewRow[];
}
