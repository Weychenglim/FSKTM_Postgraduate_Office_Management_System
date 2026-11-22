export type OperationalActivity = 'SUPERVISOR_APPLICATION' | 'PANEL_RECOMMENDATION';
export type OperationalLifecycle = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
export interface OperationalHistoryEvent {
  id:number; action:string; reason:string; actorName:string; createdAt:string;
  before:Record<string,unknown>; after:Record<string,unknown>;
}
export interface OperationalPeriod {
  id: number; semesterId: number; activity: OperationalActivity; name: string;
  programmeScope: 'ALL' | 'SELECTED'; programmes: string[];
  opensAt: string; closesAt: string; lifecycleStatus: OperationalLifecycle;
  effectiveStatus: string; revision: number; history?:OperationalHistoryEvent[];
}
export interface OperationalPeriodPayload {
  semesterId: number; activity: OperationalActivity; name: string;
  programmeScope: 'ALL' | 'SELECTED'; programmes: string[]; opensAt: string; closesAt: string;
  timelineEntryId?: number;
}
export interface OperationalAvailability {
  enforcementEnabled: boolean; canSubmit: boolean; status: string;
  opensAt: string | null; closesAt: string | null; effectiveDueAt: string | null; message: string;
}
export interface OperationalException {
  matricNo?:string; programme?:string;
  id: number; studentId: number; studentName?: string; participantId: number; participantName?: string;
  deadline: string; reason: string; status: string; createdAt: string;
  grantedBy?: {id:number;name:string}; revokedAt?: string | null; revocationReason?: string; canRevoke?: boolean;
  history?:OperationalHistoryEvent[]; revision?:number;
}
export interface OperationalExceptionCandidate {
  studentId: number; studentName: string; matricNo?: string; programme?: string;
  participantId: number; participantName?: string;
}
export interface OperationalPeriodsResponse {
  periods: OperationalPeriod[]; enforcement: Record<OperationalActivity, boolean>;
}
