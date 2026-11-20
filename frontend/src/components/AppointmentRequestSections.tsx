import React from 'react';
import { ClipboardList, BookOpen } from 'lucide-react';
import { PortalCard } from './PortalPrimitives';
import { RequestSection } from './RequestDetailPrimitives';
import { appointmentDetailTypography as text } from './AppointmentPrimitives';
import { ResearchAbstract } from './ResearchAbstract';

export interface RequestSummaryFact { label: string; value?: string | null; name?: boolean; }

export function RequestSummaryField({ label, value, name = false }: RequestSummaryFact) {
  return <div className="min-w-0"><dt className={text.label}>{label}</dt><dd className={`${name ? text.name : text.body} mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]`}>{value?.trim() || 'Not recorded'}</dd></div>;
}

export function RequestSummaryCard({ studentName, studentId, programme, semester, participants, contextAction, academicField, children, title = 'Request summary', showSemester = true }: {
  title?: string; showSemester?: boolean;
  studentName?: string; studentId?: string; programme?: string; semester?: string;
  participants: RequestSummaryFact[]; contextAction?: React.ReactNode; academicField?: React.ReactNode; children?: React.ReactNode;
}) {
  return <div data-request-summary><PortalCard padding="lg">
    <RequestSection title={title} icon={ClipboardList} headingClassName={text.heading} actions={contextAction}>
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <RequestSummaryField label="Student" value={studentName} name />
        <RequestSummaryField label="Matric number" value={studentId} />
        <RequestSummaryField label="Programme" value={programme} />
        {academicField}
        {showSemester ? <RequestSummaryField label="Semester" value={semester} /> : null}
      </dl>
      {participants.length ? <dl className="grid gap-x-8 gap-y-5 border-t border-slate-200 pt-5 sm:grid-cols-2">{participants.map(fact => <RequestSummaryField key={fact.label} {...fact} name />)}</dl> : null}
      {children}
    </RequestSection>
  </PortalCard></div>;
}

export function ResearchDetailsCard({ title, area, abstract, source, courseCodes, showCourseCodes = false, documents }: {
  title?: string; area?: string; abstract?: string; source: 'submitted' | 'profile' | 'record'; courseCodes?: string; showCourseCodes?: boolean; documents?: React.ReactNode;
}) {
  const description = source === 'submitted' ? 'Research submitted with this request' : source === 'profile' ? 'Current saved student research profile' : undefined;
  return <div data-research-details><PortalCard padding="lg">
    <RequestSection title="Research details" icon={BookOpen} description={description} headingClassName={text.heading}>
      <dl className="space-y-5">
        <RequestSummaryField label="Research title" value={title} name />
        <RequestSummaryField label="Research area" value={area} />
        {courseCodes || showCourseCodes ? <RequestSummaryField label="Course code(s)" value={courseCodes} /> : null}
        <div><dt className={text.label}>Abstract</dt><dd className="mt-3"><ResearchAbstract value={abstract} /></dd></div>
      </dl>
      {documents ? <div className="space-y-3 border-t border-slate-200 pt-5"><h3 className={text.label}>Documents</h3>{documents}</div> : null}
    </RequestSection>
  </PortalCard></div>;
}
