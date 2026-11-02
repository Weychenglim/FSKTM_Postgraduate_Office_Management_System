import {SupervisionDetailSection} from './SupervisionDetailLayout';
import React, {useId} from 'react';
import {BookOpen, ListChecks, Paperclip} from 'lucide-react';
import {IconHeading} from './IconHeading';
import {AppointmentIcon} from './AppointmentPrimitives';
import {PortalCard} from './PortalPrimitives';
import {ResearchAbstract} from './ResearchAbstract';
import type { StudentSupervisorApplication, SupervisorApplicationDocument, SupervisorApplicationRecord, SupervisorAcceptanceCapacity } from '../types';
import type { ApprovalEvent } from '../utils/approvalProcess';
import { buildSupervisorApprovalProcess } from '../utils/approvalProcess';
import { requestStatusLabel } from '../utils/lecturerRequests';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import { ApprovalProcess } from './ApprovalProcess';
import { RequestMetadata, RequestDetailActions } from './RequestDetailPrimitives';
import { SupervisorDocumentsList } from './SupervisorDocumentsList';
import { appointmentRequestStatusTone } from '../utils/appointmentRequestStatus';
import { SupervisorSubmittedCourses, SupervisorSubmittedDeclaration, SupervisorSectionAParticulars, useSupervisorSectionA, withSubmittedSupervisorParticulars } from './SubmittedSupervisorSectionA';
import { SubmittedSupervisorResearchIntent } from './SupervisorResearchIntent';

/** Role-scoped API adapters provide data; consumers provide permitted actions. */
export interface SupervisorRequestPresentation {
  initiatedByOffice?: boolean;
  applicationId?: number | string;
  reference?: string;
  status: string;
  acceptanceCapacity?: SupervisorAcceptanceCapacity | null;
  submittedAt?: string;
  submittedBy?: string;
  studentName?: string;
  studentId?: string;
  programme?: string;
  semester?: string;
  proposedSupervisor?: string;
  researchTitle?: string;
  researchArea?: string;
  researchAbstract?: string;
  projectCourseCodes?: string;
  replacementReason?: string | null;
  rejectionReason?: string;
  cancellationReason?: string;
  unavailableUntil?: string | null;
  waitingDays?: number | null;
  waitingOn?: string | null;
  events?: ApprovalEvent[];
  documents?: SupervisorApplicationDocument[];
}

export function toSupervisorRequestPresentation(record: SupervisorApplicationRecord): SupervisorRequestPresentation {
  return {
    initiatedByOffice:record.initiatedByOffice,
    acceptanceCapacity: record.acceptanceCapacity,
    applicationId: record.id, reference: `SV-REQ-${String(record.id).padStart(5, '0')}`,
    status: record.status, submittedAt: record.submittedAt, submittedBy: record.workflow?.find(event=>['SUBMIT','SUBMITTED'].includes(event.action.toUpperCase()))?.actorName,
    studentName: record.studentName, studentId: record.studentId, programme: record.programme, semester: record.semester,
    proposedSupervisor: record.proposedSupervisor, researchTitle: record.researchTitle, researchArea: record.researchArea,
    researchAbstract: record.researchAbstract, projectCourseCodes: record.projectCourseCodes,
    replacementReason: record.replacementReason, rejectionReason: record.rejectionReason, cancellationReason: record.cancellationReason,
    unavailableUntil: record.unavailableUntil, waitingDays: record.waitingDays, waitingOn: record.waitingOn,
    events: record.workflow, documents: record.documents,
  };
}

export function toStudentSupervisorRequestPresentation(record: StudentSupervisorApplication): SupervisorRequestPresentation {
  return {
    initiatedByOffice:record.initiatedByOffice,
    acceptanceCapacity: record.acceptanceCapacity,
    applicationId: record.applicationId, reference: record.applicationId!=null?`SV-REQ-${String(record.applicationId).padStart(5,'0')}`:record.id, status: record.workflowStatus ?? 'UNKNOWN',
    submittedAt: record.submittedAt, submittedBy: record.workflow?.find(event=>['SUBMIT','SUBMITTED'].includes(event.action.toUpperCase()))?.actorName,
    studentName: record.studentName, studentId: record.studentId, programme: record.programme, semester: record.semester,
    proposedSupervisor: record.supervisor, researchTitle: record.title, researchArea: record.researchArea,
    researchAbstract: record.researchAbstract, projectCourseCodes: record.projectCourseCodes,
    replacementReason: record.replacementReason, rejectionReason: record.rejectionReason, cancellationReason: record.cancellationReason,
    unavailableUntil: record.unavailableUntil, waitingDays: record.waitingDays, waitingOn: record.waitingOn,
    events: record.workflow, documents: record.documents,
  };
}

export function supervisorRequestMetadata(request: SupervisorRequestPresentation): React.ComponentProps<typeof RequestMetadata> {
  return {
    reference: request.reference, submittedAt: request.submittedAt ?? null,
    submittedBy: request.submittedBy ?? '', statusLabel: requestStatusLabel(request.status),
    statusTone: appointmentRequestStatusTone(request.status),
  };
}

export function SupervisorRequestDetail({ request, actions, administration, contextAction, showApproval = true }: {
  request: SupervisorRequestPresentation; actions?: React.ReactNode; administration?: React.ReactNode; contextAction?: React.ReactNode; showApproval?: boolean;
}) {
  const sectionA = useSupervisorSectionA(request.initiatedByOffice ? undefined : request.applicationId);
  const submitted = withSubmittedSupervisorParticulars(request, sectionA.record);
  const progress = buildSupervisorApprovalProcess({kind: 'primary', status: request.status, submittedAt: request.submittedAt, events: request.events, waitingDays: request.waitingDays, waitingOn: request.waitingOn})
    .map(step => step.reason && (step.reason === request.rejectionReason || step.reason === request.cancellationReason) ? { ...step, reason: undefined } : step);
  const studentTitleId=useId();
  const researchTitleId=useId();
  const documentsTitleId=useId();
  const hasReview = showApproval || !!(request.replacementReason || request.rejectionReason || request.cancellationReason || actions || request.events?.length);
  const hasSidebar = hasReview || !!administration;
  const hasNotes = !!(request.replacementReason || request.rejectionReason || request.cancellationReason);
  return <div className="supervisor-request-detail space-y-7">
    <PortalCard padding="lg" role="region" aria-label="Request overview" data-request-summary>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-slate-600">Student</p>
          <p className="text-lg font-semibold leading-relaxed text-brand-navy [overflow-wrap:anywhere]">{submitted.studentName?.trim() || 'Not recorded'}</p>
          <p className="text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{submitted.studentId || 'Not recorded'}</p>
        </div>
        {contextAction}
      </div>
      <dl className="mt-6 grid gap-x-8 gap-y-5 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
        {[['Programme',submitted.programme],['Semester',submitted.semester],['Proposed supervisor',request.proposedSupervisor]].map(([label,value])=><div key={label} className="min-w-0 space-y-2"><dt className="text-xs font-medium text-slate-600">{label}</dt><dd className="text-sm font-normal leading-6 text-slate-900 [overflow-wrap:anywhere]">{value?.trim() || 'Not recorded'}</dd></div>)}
      </dl>
      {sectionA.record ? <p className="mt-4 text-xs text-slate-500">Student details recorded at submission.</p> : null}
      {!request.initiatedByOffice ? <section aria-labelledby={studentTitleId} className="mt-5">
        <h2 id={studentTitleId} className="sr-only">Student information</h2>
        {request.applicationId != null ? <SupervisorSectionAParticulars {...sectionA}/> : <p className="text-xs leading-relaxed text-slate-600">Submitted student particulars are unavailable for this record.</p>}
        {sectionA.record ? <SupervisorSubmittedCourses record={sectionA.record}/> : null}
      </section> : null}
      {request.unavailableUntil ? <p className="mt-4 text-xs leading-relaxed text-amber-800">The Supervisor is unavailable for new appointments until {formatMalaysiaDate(request.unavailableUntil)}. This workflow remains recorded.</p> : null}
      {request.initiatedByOffice ? <p className="mt-4 text-xs text-slate-600">Office-initiated replacement</p> : null}
    </PortalCard>

    <div data-request-columns className={hasSidebar ? 'grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]' : 'min-w-0'}>
      <div className="min-w-0 space-y-7">
        <PortalCard padding="lg" role="region" aria-labelledby={researchTitleId}>
          <IconHeading titleId={researchTitleId} title="Research details" titleClassName="text-base font-semibold text-brand-navy" icon={<AppointmentIcon icon={BookOpen} tone="info"/>}/>
          <section aria-label="Research proposal" data-research-details className="mt-7 space-y-7">
            <dl className="space-y-6">
              <div className="space-y-2"><dt className="text-xs font-medium text-slate-600">Research title</dt><dd className="text-lg font-normal leading-8 text-slate-900 [overflow-wrap:anywhere]">{request.researchTitle?.trim() || 'Not recorded'}</dd></div>
              <div className="grid gap-5 sm:grid-cols-2">
                {[['Research area',request.researchArea],['Project course codes',request.projectCourseCodes],...(!request.initiatedByOffice ? [['Title proposed by',sectionA.record ? sectionA.record.titleOrigin === 'STUDENT' ? 'Student-proposed' : 'Supervisor-proposed' : sectionA.error ? 'Unavailable' : sectionA.loading ? 'Loading…' : undefined]] : [])].map(([label,value])=><div key={label} className="min-w-0 space-y-2"><dt className="text-xs font-medium text-slate-600">{label}</dt><dd className="text-sm font-normal leading-6 text-slate-900 [overflow-wrap:anywhere]">{value?.trim() || 'Not recorded'}</dd></div>)}
              </div>
            </dl>
            <dl className="border-t border-slate-100 pt-6"><div className="space-y-3"><dt className="text-xs font-medium text-slate-600">Abstract</dt><dd><ResearchAbstract value={request.researchAbstract} inset={false}/></dd></div></dl>
          </section>
        </PortalCard>

        {request.applicationId != null && !request.initiatedByOffice ? <PortalCard padding="lg" role="region" aria-label="Submitted Research Intent"><SubmittedSupervisorResearchIntent applicationId={request.applicationId} embedded headingAs="h2"/></PortalCard> : null}

        <PortalCard padding="lg" role="region" aria-labelledby={documentsTitleId}>
          <IconHeading titleId={documentsTitleId} title={request.initiatedByOffice ? 'Supporting documents' : 'Supporting documents and declaration'} titleClassName="text-base font-semibold text-brand-navy" icon={<AppointmentIcon icon={Paperclip} tone="info"/>}/>
          <div className="mt-6 space-y-6">
            <SupervisorDocumentsList applicationId={request.applicationId} documents={request.documents} compact/>
            {sectionA.record ? <div className="border-t border-slate-100 pt-5"><SupervisorSubmittedDeclaration record={sectionA.record}/></div> : null}
          </div>
        </PortalCard>
      </div>
    {hasSidebar ? <aside data-request-sidebar aria-label="Request review and appointment" className="min-w-0 space-y-7">
    {hasReview ? <SupervisionDetailSection title="Review and outcome" icon={ListChecks}>
        {showApproval ? <ApprovalProcess steps={progress} headingAs="h3"/> : null}
        {hasNotes ? <div className="space-y-4">{[
          ['Requested replacement',request.replacementReason],['Decision reason',request.rejectionReason],['Cancellation reason',request.cancellationReason],
        ].filter(([,reason])=>reason).map(([title,reason])=><section key={title} aria-label={title!} className="space-y-2"><h3 className="text-sm font-semibold text-brand-navy">{title}</h3><p className="whitespace-pre-wrap text-sm font-normal leading-7 text-slate-900 [overflow-wrap:anywhere]">{reason}</p></section>)}</div> : null}
        {actions ? <div className="border-t border-slate-100 pt-6"><RequestDetailActions>{actions}</RequestDetailActions></div> : null}
    </SupervisionDetailSection> : null}
    {administration}
    </aside> : null}
    </div>
  </div>;
}
