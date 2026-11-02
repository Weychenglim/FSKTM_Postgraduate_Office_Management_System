export type CapacityRole = 'SUPERVISOR' | 'PANEL';

export type CapacityState =
  | 'AVAILABLE'
  | 'FULL'
  | 'OVER_CAPACITY'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'INELIGIBLE';

export interface CapacityUserReference {
  id: number;
  name: string;
}

export interface CapacityResolution {
  semesterId: number | null;
  planId: number | null;
  planVersion: number | null;
  role: CapacityRole;
  limit: number | null;
  activeLoad: number;
  reservedLoad: number;
  availableSlots: number;
  state: CapacityState;
  unavailableUntil: string | null;
}

export interface LecturerCapacityEntry {
  id: number;
  lecturerId: number;
  staffNo: string;
  lecturerName: string;
  participantLifecycle: string;
  supervisorLimit: number | null;
  panelLimit: number | null;
  supervisor: CapacityResolution | null;
  panel: CapacityResolution | null;
  updatedBy: CapacityUserReference;
  createdAt: string;
  updatedAt: string;
}

export interface SemesterCapacityPlan {
  id: number;
  semesterId: number;
  semesterCode: string;
  semesterLabel: string;
  version: number;
  lifecycleStatus: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'DISCARDED';
  origin: 'CREATED' | 'COPIED_FORWARD' | 'MIGRATED_BASELINE';
  supersedesId: number | null;
  successorIds: number[];
  isComplete: boolean;
  readinessErrors: string[];
  isCurrentPublished: boolean;
  contentFingerprint: string;
  entries: LecturerCapacityEntry[];
  createdBy: CapacityUserReference;
  createdAt: string;
  publishedBy: CapacityUserReference | null;
  publishedAt: string | null;
  publicationReason: string | null;
}

export interface LecturerAvailabilityWindow {
  id: number;
  semesterId: number;
  semesterCode: string;
  lecturerId: number;
  staffNo: string;
  lecturerName: string;
  role: CapacityRole;
  startsOn: string;
  endsOn: string;
  reason: string;
  isEffective: boolean;
  isCancelled: boolean;
  createdBy: CapacityUserReference;
  createdAt: string;
  cancelledBy: CapacityUserReference | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface LecturerCapacityAudit {
  id: number;
  semesterId: number;
  planId: number | null;
  planVersion?: number | null;
  lecturerId: number | null;
  availabilityWindowId: number | null;
  action: string;
  reason: string;
  actor: CapacityUserReference;
  beforeValues: Record<string, unknown>;
  afterValues: Record<string, unknown>;
  createdAt: string;
}

export interface CapacityEntryCommand {
  supervisorLimit: number | null;
  panelLimit: number | null;
  expectedVersion: number;
  expectedFingerprint: string;
}

export interface CapacityPublishCommand {
  reason: string;
  expectedVersion: number;
  expectedFingerprint: string;
}

export interface AvailabilityWindowCommand {
  lecturerId: number;
  role: CapacityRole;
  startsOn: string;
  endsOn: string;
  reason: string;
}

export interface CapacityHistoryQuery {
  limit?: number;
  offset?: number;
}

export type CapacityBulkMode = 'MISSING_ONLY' | 'REPLACE';
export interface CapacityBulkPatch { lecturerId: number; supervisorLimit?: number; panelLimit?: number }
export interface CapacityBulkCommand {
  entries: CapacityBulkPatch[];
  mode: CapacityBulkMode;
  expectedVersion: number;
  expectedFingerprint: string;
}
