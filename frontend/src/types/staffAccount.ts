/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Staff and lecturer accounts (UC03): office staff, lecturers and programme
// coordinators, managed by the office in Registry > Staff & Lecturers.

export type StaffRole = 'Office Staff/Admin' | 'Lecturer' | 'Programme Coordinator';
export type StaffRoleFilter = '' | 'OFFICE' | 'LECTURER' | 'COORDINATOR';
export type StaffDuty = 'Supervisor' | 'Panel';
export type StaffAccountStatus = 'ACTIVE' | 'NOT_ACTIVATED' | 'SIGN_IN_OFF';
export type StaffStatusFilter = '' | StaffAccountStatus;

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  staffId: string;
  department: string;
  title: string;
  researchArea: string;
  position: string;
  duties: StaffDuty[];
  programme: string;
  status: StaffAccountStatus;
  lifecycle: 'ACTIVE' | 'RETIRING' | 'RETIRED' | 'RESIGNED' | null;
  lastSignedIn: string | null;
  createdAt: string;
  isYou: boolean;
}

export interface StaffWorkItem {
  key: string;
  count: number;
}

export interface StaffCapacityRow {
  duty: StaffDuty;
  state: string;
  limit?: number | null;
  load?: number;
  unavailableUntil?: string | null;
}

export interface StaffAccountPage extends StaffAccount {
  capacity: { semester: string | null; duties: StaffCapacityRow[] } | null;
  activeWork: StaffWorkItem[];
  deletion: { allowed: boolean; reasons: string[] };
}

export interface StaffAccountFilters {
  search: string;
  role: StaffRoleFilter;
  status: StaffStatusFilter;
  page: number;
}

export interface StaffAccountList {
  count: number;
  page: number;
  pageSize: number;
  results: StaffAccount[];
}

export interface StaffAccountInput {
  role: StaffRole;
  name: string;
  email: string;
  staffId: string;
  phone?: string;
  department?: string;
  title?: string;
  researchArea?: string;
  position?: string;
  duties?: StaffDuty[];
  programme?: string;
  sendActivation: boolean;
}

export type StaffDetailsChange = Partial<
  Pick<StaffAccount, 'name' | 'email' | 'phone' | 'staffId' | 'department' | 'title' | 'researchArea' | 'position'>
>;

export interface StaffAccountChange {
  id: number;
  action: string;
  actor: string;
  at: string;
  details: Record<string, unknown>;
}

export interface ExistingAccount {
  kind: 'staff' | 'student' | 'other';
  id?: string;
  name?: string;
  role?: string;
}

export interface StaffOptions {
  departments: string[];
  programmes: { programme: string; coordinator: { id: string; name: string } | null }[];
}

export interface WaitingApprovals {
  supervisorRequests: number;
  coSupervisorNominations: number;
  panelNominations: number;
  amendments: number;
  total: number;
}

export interface ProgrammeMoveCheck {
  from: { programme: string; waiting: WaitingApprovals };
  to: { programme: string; waiting: WaitingApprovals };
}

export type ActivationOutcome = 'sent' | 'failed' | 'held';
