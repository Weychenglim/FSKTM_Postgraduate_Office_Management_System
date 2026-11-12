import type { StudentRecord } from '../types';
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
  researchCourseCode: string;
  researchCourseName: string;
  source: string;
  changedBy: string;
  changedAt: string | null;
  activeStudents: number;
  laterRules: LaterProgrammeRule[];
}

export interface LaterProgrammeRule {
  id: number;
  fromLabel: string;
  minSemesters: number;
  maxSemesters: number;
  specialCounts: boolean;
  researchCourseCode: string;
  researchCourseName: string;
  changedBy: string;
  changedAt: string | null;
  activeStudents: number;
}

export interface ProgrammeRuleInput {
  programme: string;
  minSemesters: number;
  maxSemesters: number;
  specialCounts: boolean;
  fromSession: string;
  fromTerm: string;
  researchCourseCode: string;
  researchCourseName: string;
}

export const getProgrammeRules = () =>
  request<{ rules: ProgrammeRule[] }>(`${BASE}/programme-rules/`).then(data => data.rules);

export const saveProgrammeRule = (input: ProgrammeRuleInput) =>
  request<{ rules: ProgrammeRule[] }>(`${BASE}/programme-rules/`, json('PUT', input)).then(data => data.rules);

export const removeProgrammeRule = (id: number) =>
  request<{ rules: ProgrammeRule[] }>(`${BASE}/programme-rules/${id}/`, { method: 'DELETE' }).then(data => data.rules);

export type SemesterTerm = 'SEMESTER_I' | 'SEMESTER_II' | 'SPECIAL';
export type LeaveOutcome = 'LEAVE' | 'LEAVE_MEDICAL' | 'LEAVE_MOBILITY';
export type SemesterOutcome = 'STUDIED' | LeaveOutcome | 'NOT_REGISTERED';

export interface StudentSemesterRow {
  id: number;
  session: string;
  term: SemesterTerm;
  label: string;
  outcome: SemesterOutcome;
  outcomeLabel: string;
  note: string;
}

export interface SemesterWarning {
  level: 'check' | 'stop';
  code: string;
  text: string;
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
  intake: string;
  beforeIntake: string[];
  startsAfterIntake: boolean;
  extensionSemesters: number;
  extensionReason: string;
  warnings: SemesterWarning[];
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
  intake: string;
  avatarText: string;
  avatarBg: string;
  current: string;
}

export interface SemesterStudent {
  rowId: number;
  matric: string;
  name: string;
  programme: string;
  intake: string;
  avatarText: string;
  avatarBg: string;
  outcome: SemesterOutcome;
}

export interface MoveSummary {
  semester: { id: number; label: string; session: string; term: SemesterTerm; isSpecial: boolean } | null;
  waiting: number;
  notStarted: number;
  lastMove: { by: string; at: string; moved: number; leftOut: number; backFromLeave: number; automatic: boolean } | null;
}

export interface MoveState extends MoveSummary {
  students?: MoveStudent[];
  movingFrom: string;
  onSemester?: SemesterStudent[];
  onLeave?: number;
  attention?: AttentionStudent[];
}

export interface AttentionStudent {
  matric: string;
  name: string;
  programme: string;
  intake: string;
  avatarText: string;
  avatarBg: string;
  warnings: SemesterWarning[];
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
  intake: string;
  avatarText: string;
  avatarBg: string;
  studied: number;
  minimum: number | null;
  group: 'ready' | 'check' | 'stop';
  tooEarly: boolean;
  early: boolean;
  onP2?: boolean;
  items: GraduationItem[];
}

export interface WaitingStudent {
  matric: string;
  name: string;
  programme: string;
  intake: string;
  avatarText: string;
  avatarBg: string;
  lastSemester: string;
  early: boolean;
  items: GraduationItem[];
}

export interface LastSemesterChoice {
  session: string;
  term: SemesterTerm;
  label: string;
}

export type GraduationCheck = GraduationStudent & { lastSemesters: LastSemesterChoice[] };

export interface GraduationGroups {
  ready: GraduationStudent[];
  check: GraduationStudent[];
  stop: GraduationStudent[];
}

export interface GraduationOverview extends GraduationGroups {
  tooEarly: number;
  waiting: WaitingStudent[];
  lastSemesters: LastSemesterChoice[];
}

export interface StepResult {
  finished?: Array<{ matric: string; name: string }>;
  graduated?: Array<{ matric: string; name: string }>;
  returned?: Array<{ matric: string; name: string }>;
  skipped: Array<{ matric: string; name: string; why: string }>;
}

export interface SenateListMatch {
  matched: string[];
  notWaiting: Array<{ matric: string; name: string; status: string }>;
  notFound: string[];
}

export const getGraduationOverview = () => request<GraduationOverview>(`${BASE}/graduation/`);

export const finishStudents = (input: { matrics: string[]; earlyApproved: string[]; lastSession: string; lastTerm: string }) =>
  request<StepResult>(`${BASE}/graduation/finish/`, json('POST', input));

export const recordSenateDecision = (input: { matrics: string[]; decidedOn: string; reference: string }) =>
  request<StepResult>(`${BASE}/graduation/senate/`, json('POST', input));

export const returnToActive = (input: { matrics: string[]; reason: string }) =>
  request<StepResult>(`${BASE}/graduation/return/`, json('POST', input));

export const correctGraduation = (matric: string, reason: string) =>
  request<StudentRecord>(`${BASE}/graduation/correct/`, json('POST', { matric, reason }));

export const matchSenateList = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return request<SenateListMatch>(`${BASE}/graduation/match-list/`, { method: 'POST', body: form });
};

export const getStudentGraduationCheck = (matric: string) =>
  request<GraduationCheck>(`${student(matric)}/graduation-check/`);

export type StatusAction = 'LEAVE' | 'END_LEAVE' | 'WITHDRAW' | 'TERMINATE' | 'DECEASED' | 'REINSTATE';

export const studentStatusAction = (matric: string, input: { action: StatusAction; reason: string; outcome?: LeaveOutcome; exitReason?: string }) =>
  request<StudentRecord>(`${student(matric)}/status-action/`, json('POST', input));

export type StageShown = 'P1' | 'P2' | 'NOT_STARTED' | 'COMPLETED' | 'NOT_CONFIRMED';
export type StageChoice = 'P1' | 'P2' | 'NONE' | 'AUTO';

export interface StageRow {
  matric: string;
  name: string;
  programme: string;
  intake: string;
  avatarText: string;
  avatarBg: string;
  shown: StageShown;
  reason: string;
  noSupervisor: boolean;
  requestWaiting: boolean;
  notAnswered: boolean;
  setByCoordinator: boolean;
  correctionRequested: boolean;
  correctionNote: string;
}

export interface ProjectStagesPage {
  semester: { id: number; label: string; current: boolean } | null;
  semesters: Array<{ id: number; label: string }>;
  rows: StageRow[];
  notStudying: number;
  canChange: boolean;
  reasons: Array<{ value: string; label: string }>;
}

export interface MarksImpact {
  notStarted: number;
  draft: number;
  submitted: number;
  token: string;
}

export interface StageChangeResult {
  changed: string[];
  leftOut: Array<{ matric: string; name: string; why: string }>;
}

/** Fired after a coordinator changes stages or keeps answers, so the sidebar number refreshes. */
export const STAGES_CHANGED_EVENT = 'fsktm:stages-changed';

function stagesChanged<T>(result: T): T {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STAGES_CHANGED_EVENT));
  return result;
}

export const getProjectStages = (semesterId: number | null, student = '') => {
  const params = new URLSearchParams();
  if (semesterId) params.set('semester', String(semesterId));
  if (student) params.set('student', student);
  const query = params.toString();
  return request<ProjectStagesPage>(`${BASE}/project-stages/${query ? `?${query}` : ''}`);
};

export const getProjectStageWaiting = () =>
  request<{ corrections: number }>(`${BASE}/project-stages/waiting/`).then(data => data.corrections);

export const getProjectStageImpact = (semesterId: number, matric: string, stage: StageChoice) =>
  request<MarksImpact>(`${BASE}/project-stages/impact/?semester=${semesterId}&matric=${encodeURIComponent(matric)}&stage=${stage}`);

export const changeProjectStages = (input: {
  semesterId: number;
  stage: StageChoice;
  reason: string;
  students: Array<{ matric: string; shown: StageShown }>;
  checked: boolean;
  token: string;
}) => request<StageChangeResult>(`${BASE}/project-stages/change/`, json('POST', input)).then(stagesChanged);

export const keepProjectStageAnswers = (semesterId: number, students: string[]) =>
  request<StageChangeResult>(`${BASE}/project-stages/keep/`, json('POST', { semesterId, students })).then(stagesChanged);

export interface ProjectStageQuestion {
  semester: string;
  code: string;
  name: string;
  answer: 'YES' | 'NO' | null;
  canChange: boolean;
  correction: 'REQUESTED' | 'KEPT' | 'DONE' | null;
}

export const requestProjectStageCorrection = (note: string) =>
  request<{ question: ProjectStageQuestion | null }>(`${BASE}/project-stages/mine/correction/`, json('POST', { note })).then(data => data.question);

export const getMyProjectStage = () =>
  request<{ question: ProjectStageQuestion | null }>(`${BASE}/project-stages/mine/`).then(data => data.question);

export const answerMyProjectStage = (answer: 'YES' | 'NO') =>
  request<{ question: ProjectStageQuestion | null }>(`${BASE}/project-stages/mine/`, json('POST', { answer })).then(data => data.question);

export interface RetentionPage {
  years: number;
  soon: number;
  due: Array<{ matric: string; name: string; programme: string; intake: string; avatarText: string; avatarBg: string; status: string; endedOn: string; dueOn: string }>;
}

export const getRetention = () => request<RetentionPage>(`${BASE}/retention/`);
