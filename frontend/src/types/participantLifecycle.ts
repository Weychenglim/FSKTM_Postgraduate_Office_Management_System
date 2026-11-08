export type ParticipantType = 'STUDENT' | 'LECTURER';
export type ParticipantLifecycleStatus =
  | 'ACTIVE'
  | 'DEFERRED'
  | 'GRADUATED'
  | 'WITHDRAWN'
  | 'RETIRING'
  | 'RETIRED'
  | 'RESIGNED';

export interface ParticipantBlockers {
  pendingCoSupervisorNominations?: number;
  activeCoSupervisorAppointments?: number;
  pendingSupervisorApplications: number;
  pendingPanelRecommendations: number;
  activeSupervisorAppointments: number;
  activePanelAppointments: number;
  unfinishedMarksTasks: number;
  managedProgrammes: number;
}

export interface ParticipantPendingWork {
  recordType: 'SUPERVISOR_APPLICATION' | 'PANEL_RECOMMENDATION' | 'CO_SUPERVISOR_NOMINATION';
  recordId: number;
  status: string;
  assignedTo?: string;
  studentId?: string;
}

export interface ParticipantLifecycleAudit {
  id: number;
  previousStatus: string;
  newStatus: string;
  reason: string;
  actor: string;
  actorRole: string;
  affectedRecords: Record<string, unknown>;
  createdAt: string;
}

export interface ParticipantLifecycleRecord {
  participantType: ParticipantType;
  identifier: string;
  name: string;
  programme: string | null;
  department: string | null;
  lifecycleStatus: ParticipantLifecycleStatus;
  accountAccess: 'ACTIVE' | 'READ_ONLY' | 'DISABLED';
  changedAt: string | null;
  changedBy: string | null;
  reason: string | null;
  blockers: ParticipantBlockers;
  pendingWork: ParticipantPendingWork[];
  audits: ParticipantLifecycleAudit[];
}

export interface ParticipantLifecycleSummary {
  activeStudents: number;
  deferredStudents: number;
  graduatedStudents: number;
  withdrawnStudents: number;
  activeLecturers: number;
  retiringLecturers: number;
  retiredLecturers: number;
  resignedLecturers: number;
}

export interface ParticipantLifecycleListResponse {
  summary: ParticipantLifecycleSummary;
  availableProgrammes: string[];
  records: ParticipantLifecycleRecord[];
}

export interface ParticipantTransitionRequest {
  targetStatus: ParticipantLifecycleStatus;
  reason: string;
}
