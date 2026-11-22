import { request } from './apiClient';
import type { SupervisorResearchIntent } from '../types/supervisorResearchIntent';

export type ResearchPlanChanges = Partial<
  Pick<SupervisorResearchIntent, 'aim' | 'researchQuestions' | 'researchObjectives' | 'methodology' | 'timeline'>
  & { researchArea: string }
>;
export type ResearchSnapshot = { title: string; abstract: string; programme: string } & ResearchPlanChanges;
export type AmendmentKind = 'RESEARCH' | 'TRANSFER';
export type AmendmentStatus = 'PENDING_SUPERVISOR' | 'PENDING_SOURCE_COORDINATOR' | 'PENDING_COORDINATOR' | 'PENDING_DESTINATION_COORDINATOR' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type TeamMember = { appointmentId: number; userId: number; name: string };
export interface ResearchAmendment {
  id: number; kind: AmendmentKind; status: AmendmentStatus; studentId: number; studentName: string; matricNo: string;
  sourceProgramme: string; destinationProgramme: string; before: ResearchSnapshot; after: ResearchSnapshot; reason: string;
  createdAt: string; updatedAt: string; stageLabel: string; canDecide: boolean; canCancel: boolean; requiresTeamAcknowledgement: boolean;
  teamSnapshot: { primary: TeamMember | null; coSupervisors: TeamMember[]; panel: TeamMember[] }; unfinishedTaskCount: number | null;
  events: { id: number; action: string; actorName: string; actorRole: string; previousStatus: string; newStatus: string; reason: string; retainTeam: boolean; createdAt: string }[];
}
export interface ResearchRevision {
  id: number; revision: number; studentId?: number; studentName?: string; before: ResearchSnapshot; after: ResearchSnapshot;
  reason: string; actorName: string; createdAt: string; requestId: number | null; kind: 'BASELINE' | 'CORRECTION' | AmendmentKind;
}
export interface ResearchAmendmentOptions {
  students: { id: number; name: string; matricNo: string; programme: string }[]; programmes: string[];
  profile: (ResearchSnapshot & {
    studentId: number; revision: number; researchArea?: string;
    submittedIntent?: { record: SupervisorResearchIntent; submittedAt: string; titleOrAbstractChanged: boolean } | null;
    currentIntent?: Partial<SupervisorResearchIntent> | null;
  }) | null;
  canSubmitResearch: boolean; canCorrect: boolean; canTransfer: boolean;
}
export interface ResearchPageQuery {
  page?: number; size?: number; view?: 'requests' | 'history'; focus?: 'decision' | 'all';
  q?: string; programme?: string; semester?: string; type?: string; status?: string;
  from?: string; to?: string; sort?: 'waiting' | 'oldest' | 'newest';
}
export interface ResearchPagination {
  total: number; page: number; pageSize: number; pageCount: number; reviewCount: number;
  facets: { programmes: string[]; semesters: string[]; statuses: string[] };
}
export interface ResearchAmendmentCollection {
  requests: ResearchAmendment[]; revisions: ResearchRevision[]; pagination?: ResearchPagination;
}
export interface ResearchProfileQuery {
  q?: string; programme?: string; sort?: 'name' | 'name_desc' | 'updated'; page?: number; size?: number;
}
export interface ResearchProfileDirectory {
  students: {id: number; name: string; matricNo: string; programme: string; title: string}[];
  programmes: string[];
  pagination: {total: number; page: number; pageSize: number; pageCount: number};
}
export type AmendmentInput = { studentId?: number; kind: AmendmentKind; title?: string; abstract?: string; planChanges?: ResearchPlanChanges; destinationProgramme?: string; reason: string; expectedRevision?: number };
export type CorrectionInput = { studentId: number; title?: string; abstract?: string; reason: string; meaningUnchanged: true; expectedRevision: number };
const base = '/appointments/research-amendments';
const query = (studentId?: number) => studentId === undefined ? '' : `?studentId=${studentId}`;
export function getResearchProfileLink(matricNo: string) {
  return request<{studentId: number | null}>(`${base}/profile-link/?${new URLSearchParams({matricNo})}`);
}
export function getResearchAmendmentOptions(studentId?: number, minimal = false, selectedOnly = false, includeResearchIntent = false) {
  const params = new URLSearchParams();
  if (minimal) params.set('minimal', 'true');
  else if (studentId !== undefined) {
    params.set('studentId', String(studentId));
    if (selectedOnly) params.set('selectedOnly', 'true');
  }
  if (includeResearchIntent) params.set('includeResearchIntent', 'true');
  return request<ResearchAmendmentOptions>(`${base}/options/${params.size ? `?${params}` : ''}`);
}
export function getResearchProfiles(filters: ResearchProfileQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.set(key, String(value));
  return request<ResearchProfileDirectory>(`${base}/profiles/?${params}`);
}
export const getResearchAmendments = (studentId?: number) => request<ResearchAmendmentCollection>(`${base}/${query(studentId)}`);
export const getResearchAmendment = (id: number) => request<ResearchAmendment>(`${base}/${id}/`);
export function coordinatorTransferQuery(filters: ResearchPageQuery): ResearchPageQuery {
  const status = ['PENDING_SUPERVISOR','PENDING_COORDINATOR'].includes(filters.status ?? '') ? '' : filters.status;
  return {...filters, type:'TRANSFER', focus:'decision', status};
}
export const getResearchAmendmentsPage = (filters: ResearchPageQuery, office = false) => {
  filters = office ? filters : coordinatorTransferQuery(filters);
  const params = new URLSearchParams({page: String(filters.page ?? 1)});
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.set(key, String(value));
  params.set('focus',office?'all':'decision');
  return request<ResearchAmendmentCollection>(`${base}/?${params}`);
};
export type ResearchNextTarget = {id: number; page: number};
export async function getNextResearchAmendment(filters: ResearchPageQuery, currentId: number): Promise<ResearchNextTarget | null> {
  const currentPage = await getResearchAmendmentsPage(filters);
  if (!currentPage.pagination) return null;
  const index = currentPage.requests.findIndex(row => row.id === currentId);
  if (index < 0) return null;
  const next = currentPage.requests[index + 1];
  if (next) return {id:next.id,page:currentPage.pagination.page};
  if (currentPage.pagination.page >= currentPage.pagination.pageCount) return null;
  const nextPage = await getResearchAmendmentsPage({...filters,page:currentPage.pagination.page + 1});
  const nextRow = nextPage.requests.find(row => row.id !== currentId);
  return nextRow && nextPage.pagination ? {id:nextRow.id,page:nextPage.pagination.page} : null;
}
export async function loadResearchAmendmentWorkspace({coordinator, office=false, student=false, routeView, requestId, studentId, pageQuery}: {
  coordinator: boolean; office?:boolean; student?: boolean; routeView?: 'list' | 'detail' | 'profile' | 'new'; requestId?: string; studentId?: number; pageQuery?: ResearchPageQuery;
}): Promise<ResearchAmendmentCollection & {options: ResearchAmendmentOptions}> {
  if ((coordinator||office) && routeView === 'detail') {
    const id = Number(requestId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Request not found.');
    const [options, row] = await Promise.all([getResearchAmendmentOptions(undefined, true), getResearchAmendment(id)]);
    return {options, requests:[row], revisions:[]};
  }
  const paged = (coordinator||office) && routeView === 'list';
  const [options, data] = await Promise.all([
    getResearchAmendmentOptions(paged ? undefined : studentId, paged, routeView === 'profile' && studentId !== undefined,
      routeView === 'profile' || (student && (routeView === 'new' || routeView === undefined))),
    paged ? getResearchAmendmentsPage(pageQuery ?? {},office) : getResearchAmendments(studentId),
  ]);
  return {options, ...data};
}
export const submitResearchAmendment = (input: AmendmentInput) => request<ResearchAmendment>(`${base}/`, { method: 'POST', body: JSON.stringify(input) });
export const correctResearchProfile = (input: CorrectionInput) => request<ResearchRevision>(`${base}/corrections/`, { method: 'POST', body: JSON.stringify(input) });
export const decideResearchAmendment = (id: number, input: { decision: 'APPROVE' | 'REJECT'; reason?: string; retainTeam?: true; expectedStatus: AmendmentStatus }) => request<ResearchAmendment>(`${base}/${id}/decision/`, { method: 'POST', body: JSON.stringify(input) });
export const cancelResearchAmendment = (id: number, reason: string) => request<ResearchAmendment>(`${base}/${id}/cancel/`, { method: 'POST', body: JSON.stringify({ reason }) });
