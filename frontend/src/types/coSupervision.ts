import type {CapacityState} from './lecturerCapacity';
import type {SupervisorApplicationRecord} from './appointment';

export type CoSupervisorAction = 'accept' | 'reject' | 'approve' | 'coordinator-reject' | 'cancel';
export type CoSupervisorOutcome = 'COMPLETED' | 'WITHDRAWN' | 'OTHER';
export interface TeamPerson { id: number; name: string; email?: string; department?: string }
export interface SupervisionPanel {
  current: { member: TeamPerson; email: string; department: string; appointmentDate: string; requestId: number; recordKey?: string; canView: boolean } | null;
  pending: { id: number; member?: TeamPerson | null; status: string; replacement: boolean; recordKey?: string; canView: boolean } | null;
  canRecommend: boolean;
  canReplace: boolean;
}
export interface TeamAudit { id: number; action: string; actor: string; createdAt: string; reason?: string; previousStatus?: string; newStatus?: string }
export interface CoSupervisorNomination {
  id: number;
  studentId: number;
  matricNo: string;
  studentName: string;
  programme?: string;
  semester?: string;
  candidate: TeamPerson;
  nominator: TeamPerson;
  status: 'SUBMITTED_TO_CO_SUPERVISOR' | 'PENDING_COORDINATOR' | 'APPROVED' | 'REJECTED_BY_CO_SUPERVISOR' | 'REJECTED_BY_COORDINATOR' | 'CANCELLED';
  justification: string;
  reason: string;
  submittedAt: string;
  decidedAt?: string | null;
  waitingSince?: string | null;
  waitingDays?: number | null;
  responsibleStage?: string | null;
  replacesAppointmentId: number | null;
  allowedActions: CoSupervisorAction[];
  history: TeamAudit[];
}
export interface CoSupervisorAppointment {
  id: number;
  studentId: number;
  matricNo: string;
  studentName: string;
  supervisor: TeamPerson;
  status: 'ACTIVE' | 'ENDED';
  appointmentDate: string;
  endOutcome: string;
  endReason: string;
  endedAt: string | null;
  supersedesId: number | null;
  canEnd: boolean;
  history: TeamAudit[];
}
export interface SupervisoryTeam {
  studentEmail?: string;
  panel?: SupervisionPanel;
  studentId: number;
  matricNo: string;
  studentName: string;
  programme: string;
  studentStatus: string;
  primarySupervisor: TeamPerson | null;
  primaryAppointmentId: number | null;
  primaryAppointmentDetails?: {email: string; department: string; appointmentDate: string; semester: string} | null;
  approvedApplicationId?: number | null;
  canChangePrimarySupervisor?: boolean;
  pendingPrimaryReplacement?: {applicationId:number;status:string;supervisorName:string} | null;
  research: { title: string; area: string; abstract: string };
  appointments: CoSupervisorAppointment[];
  nominations: CoSupervisorNomination[];
  canNominate: boolean;
  timeline?: { id: number | string; title: string; date?: string | null; status?: string }[];
}
export interface CoSupervisorCandidate extends TeamPerson {
  staffId?: string;
  reservedLoad?: number;
  availableSlots?: number | null;
  selectable: boolean;
  reason: string;
  capacityState: CapacityState;
  activeLoad: number;
  limit: number | null;
  unavailableUntil?: string | null;
}
export interface SupervisoryWorkspace {
  teams: SupervisoryTeam[];
  nominations: CoSupervisorNomination[];
  appointments: CoSupervisorAppointment[];
  primaryApplication?: SupervisorApplicationRecord | null;
}
