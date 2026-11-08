/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Student Registry API (UC05-UC09). Backed by the Django `registry` endpoints
// under /api/registry/. Reads fall back to mock data when the backend is
// unreachable *and* mocks are enabled, so the screen still renders offline;
// writes always go to the backend (they require an Office Staff/Admin session).

import {
  ImportCommitResponse,
  ImportInspectResponse,
  ImportOptions,
  ImportPreviewResponse,
  StudentRecord,
} from '../types';
import { MOCK_STUDENTS } from '../mocks/students';
import {
  USE_MOCKS,
  isTransportFailure,
  mockResponse,
  request,
  requestBlob,
  requestMultipart,
} from './apiClient';

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const USE_REGISTRY_BACKEND = parseBooleanEnv(
  import.meta.env?.VITE_USE_REGISTRY_BACKEND,
  true,
);

/** Fields Office Staff may correct from the Registry Management screen. */
export interface StudentRecordUpdate {
  name?: string;
  email?: string;
  programme?: string;
  programmeReason?: string;
  academicStatus?: StudentRecord['academicStatus'];
  statusReason?: string;
  earlyCompletionApproved?: boolean;
  accountStatus?: StudentRecord['accountStatus'];
  phone?: string;
  semester?: string;
  intakeDate?: string;
}

export async function getStudents(search?: string): Promise<StudentRecord[]> {
  if (!USE_REGISTRY_BACKEND && USE_MOCKS) return mockResponse(MOCK_STUDENTS);
  const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  try {
    return await request<StudentRecord[]>(`/registry/students/${query}`);
  } catch (err) {
    // Never mask a 401/403/404 with fixtures; that would present invented
    // student records as though the office had really entered them.
    if (USE_MOCKS && isTransportFailure(err)) return mockResponse(MOCK_STUDENTS);
    throw err;
  }
}

export async function getStudentById(id: string): Promise<StudentRecord | undefined> {
  if (!USE_REGISTRY_BACKEND && USE_MOCKS) {
    return mockResponse(MOCK_STUDENTS.find((s) => s.id === id));
  }
  try {
    return await request<StudentRecord>(`/registry/students/${encodeURIComponent(id)}/`);
  } catch (err) {
    if (USE_MOCKS && isTransportFailure(err)) {
      return mockResponse(MOCK_STUDENTS.find((s) => s.id === id));
    }
    throw err;
  }
}

/** After an email change: whether the old address was told (null when the
 *  student never activated, so a new activation email is needed instead). */
export type StudentRecordUpdated = StudentRecord & { oldAddressTold?: boolean | null };

export async function updateStudent(
  id: string,
  changes: StudentRecordUpdate,
): Promise<StudentRecordUpdated> {
  return request<StudentRecordUpdated>(`/registry/students/${encodeURIComponent(id)}/`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

/** Fields the office supplies when registering a student. */
export interface StudentRecordCreate {
  id: string;
  name: string;
  email: string;
  programme?: string;
  phone?: string;
  semester?: string;
  intakeDate?: string;
  academicStatus?: StudentRecord['academicStatus'];
  /** Email the activation link now (the backend's default) or leave it for later. */
  sendInvite?: boolean;
}

export type CreatedStudentRecord = StudentRecord & { invitationSent?: boolean };

/**
 * Register a new student. The account is created without a password (the
 * student sets one through the password-reset flow), so no temporary
 * credential ever has to be handed over.
 */
export async function createStudent(input: StudentRecordCreate): Promise<CreatedStudentRecord> {
  return request<CreatedStudentRecord>('/registry/students/', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface AccessLinkResult {
  kind: 'activation' | 'reset';
  sent: boolean;
}

/** Email the student an activation link, or a reset link once activated. */
export async function sendAccessLink(id: string): Promise<AccessLinkResult> {
  return request<AccessLinkResult>(
    `/registry/students/${encodeURIComponent(id)}/send-access-link/`,
    { method: 'POST' },
  );
}

const importForm = (file: File, dryRun: boolean, options?: ImportOptions): FormData => {
  const form = new FormData();
  form.append('file', file);
  if (dryRun) form.append('dryRun', 'true');
  if (options) form.append('options', JSON.stringify(options));
  return form;
};

/**
 * Describe a file's layout: its sheets, the row with the column names, each
 * column with sample values, and the suggested matches to confirm.
 */
export async function inspectStudentImport(
  file: File,
  options?: ImportOptions,
): Promise<ImportInspectResponse> {
  return requestMultipart<ImportInspectResponse>(
    '/registry/students/import/inspect/',
    importForm(file, false, options),
  );
}

/** Check every row of a CSV or XLSX file without creating anything. */
export async function previewStudentImport(
  file: File,
  options?: ImportOptions,
): Promise<ImportPreviewResponse> {
  return requestMultipart<ImportPreviewResponse>(
    '/registry/students/import/',
    importForm(file, true, options),
  );
}

/** Create the ready rows, skip duplicates, and record the batch. */
export async function commitStudentImport(
  file: File,
  options?: ImportOptions,
): Promise<ImportCommitResponse> {
  return requestMultipart<ImportCommitResponse>(
    '/registry/students/import/',
    importForm(file, false, options),
  );
}

/** The Excel template for typing a list: Programme is a dropdown, and Student ID and Phone keep leading zeros. */
export async function downloadImportTemplate(): Promise<Blob> {
  return requestBlob('/registry/students/import/template/');
}
