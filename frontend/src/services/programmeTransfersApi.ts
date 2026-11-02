import { request } from './apiClient';

export interface StudentTransferSummary {
  studentId: number;
  matric: string;
  name: string;
  programme: string;
  hasResearchProfile: boolean;
  canRequest: boolean;
  pending: { id: number; status: string; destination: string; stage: 'current' | 'new'; waitingFor: string[] } | null;
  blockers?: string[];
  currentCoordinators?: string[];
  destinations?: Array<{ programme: string; coordinators: string[] }>;
  team?: { primary: string; coSupervisors: string[]; panel: string[] };
  unfinishedTasks?: number;
}

export type ProgrammeCoordinators = Array<{ programme: string; coordinators: string[] }>;

export const getStudentTransfer = (matric: string) =>
  request<StudentTransferSummary>(`/registry/students/${encodeURIComponent(matric)}/transfer/`);

export const getProgrammeCoordinators = () =>
  request<{ programmes: ProgrammeCoordinators }>('/registry/programme-coordinators/').then(data => data.programmes);
