import {request} from './apiClient';
import type {LecturerCapacityEntry} from '../types';

type WorkloadStages = {rp1: number; rp2: number; withoutStage: number};

export type CapacityWorkspaceLecturer = Omit<LecturerCapacityEntry,'updatedBy'|'createdAt'|'updatedAt'> & {
  workloadStages?: {supervisor: WorkloadStages; panel: WorkloadStages};
  availabilitySummary?: {current: number; scheduled: number};
  activeStudentCount:number|null;
  primaryStudentCount:number|null;
  supportingStudentCount:number|null;
  panelStudentCount:number|null;
  userEnabled?:boolean;
  canConfigure?:boolean;
  workloadIdentityIncomplete?:boolean;
};
export interface CapacityPlanningBaseline {
  activeStudents:number;
  eligibleLecturers:number;
  studentsPerLecturer:number|null;
}
export interface CapacityWorkspace {
  lecturers:CapacityWorkspaceLecturer[];
  baseline:CapacityPlanningBaseline;
}
export function getCapacityWorkspace(semesterId:number):Promise<CapacityWorkspace> {
  return request(`/academics/semesters/${semesterId}/capacity-workspace/`);
}
