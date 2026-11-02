import { request } from './apiClient';

const BASE = '/registry';
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const student = (matric: string) => `${BASE}/students/${encodeURIComponent(matric)}`;

export interface ProgrammeRule {
  programme: string;
  hasRule: boolean;
  minSemesters: number | null;
  maxSemesters: number | null;
  specialCounts: boolean;
  source: string;
  changedBy: string;
  changedAt: string | null;
  activeStudents: number;
}

export interface ProgrammeRuleInput {
  programme: string;
  minSemesters: number;
  maxSemesters: number;
  specialCounts: boolean;
}

export const getProgrammeRules = () =>
  request<{ rules: ProgrammeRule[] }>(`${BASE}/programme-rules/`).then(data => data.rules);

export const saveProgrammeRule = (input: ProgrammeRuleInput) =>
  request<{ rules: ProgrammeRule[] }>(`${BASE}/programme-rules/`, json('PUT', input)).then(data => data.rules);

export type SemesterTerm = 'SEMESTER_I' | 'SEMESTER_II' | 'SPECIAL';
export type SemesterOutcome = 'STUDIED' | 'LEAVE' | 'LEAVE_EXEMPT';

export interface StudentSemesterRow {
  id: number;
  session: string;
  term: SemesterTerm;
  label: string;
  outcome: SemesterOutcome;
  outcomeLabel: string;
  note: string;
}

export interface StudentSemesters {
  matric: string;
  studied: number;
  minimum: number | null;
  maximum: number | null;
  specialCounts: boolean;
  hasRule: boolean;
  hasRecord: boolean;
  shortOfMinimum: number;
  maximumSemester: string;
  currentSemester: string;
  lastSemester: boolean;
  pastMaximum: boolean;
  extensionSemesters: number;
  extensionReason: string;
  rows: StudentSemesterRow[];
}

export const getStudentSemesters = (matric: string) => request<StudentSemesters>(`${student(matric)}/semesters/`);

export const addStudentSemester = (
  matric: string,
  input: { session: string; term: SemesterTerm; outcome: SemesterOutcome },
) => request<StudentSemesters>(`${student(matric)}/semesters/`, json('POST', input));

export const changeStudentSemester = (matric: string, id: number, input: { outcome: SemesterOutcome }) =>
  request<StudentSemesters>(`${student(matric)}/semesters/${id}/`, json('PATCH', input));

export const removeStudentSemester = (matric: string, id: number) =>
  request<StudentSemesters>(`${student(matric)}/semesters/${id}/`, { method: 'DELETE' });

export const saveStudentExtension = (matric: string, input: { semesters: number; reason: string }) =>
  request<StudentSemesters>(`${student(matric)}/semester-extension/`, json('PUT', input));

export interface MoveStudent {
  matric: string;
  name: string;
  programme: string;
  avatarText: string;
  avatarBg: string;
  current: string;
}

export interface MoveSummary {
  semester: { id: number; label: string; session: string; term: SemesterTerm; isSpecial: boolean } | null;
  waiting: number;
  lastMove: { by: string; at: string; moved: number; leftOut: number } | null;
}

export interface MoveState extends MoveSummary {
  students?: MoveStudent[];
  movingFrom: string;
  deferred: number;
}

export const getSemesterMoveSummary = () => request<MoveSummary>(`${BASE}/semester-move/?summary=1`);

export const getSemesterMove = () => request<MoveState>(`${BASE}/semester-move/`);

export const moveStudents = (semesterId: number, matrics: string[]) =>
  request<{ semester: string; moved: number; leftOut: number; notActive: string[] }>(`${BASE}/semester-move/`, json('POST', { semesterId, matrics }));

export interface GraduationItem {
  level: 'check' | 'stop';
  code: string;
  text: string;
  fix: string;
  recordId: number | null;
}

export interface GraduationStudent {
  matric: string;
  name: string;
  programme: string;
  avatarText: string;
  avatarBg: string;
  studied: number;
  minimum: number | null;
  group: 'ready' | 'check' | 'stop';
  tooEarly: boolean;
  early: boolean;
  items: GraduationItem[];
}

export interface GraduationGroups {
  ready: GraduationStudent[];
  check: GraduationStudent[];
  stop: GraduationStudent[];
}

export interface GraduationOverview extends GraduationGroups {
  tooEarly: number;
}

export interface GraduationListCheck extends GraduationGroups {
  notFound: string[];
  notActive: Array<{ matric: string; name: string; status: string }>;
}

export interface GraduationResult {
  graduated: Array<{ matric: string; name: string }>;
  skipped: Array<{ matric: string; name: string; why: string }>;
}

export const getGraduationOverview = () => request<GraduationOverview>(`${BASE}/graduation/`);

export const checkGraduationList = (matrics: string[]) =>
  request<GraduationListCheck>(`${BASE}/graduation/check/`, json('POST', { matrics }));

export const graduateStudents = (input: { matrics: string[]; earlyApproved: string[]; reason: string }) =>
  request<GraduationResult>(`${BASE}/graduation/`, json('POST', input));

export const getStudentGraduationCheck = (matric: string) =>
  request<GraduationStudent>(`${student(matric)}/graduation-check/`);
