import React from 'react';
import { RequestSummaryCard } from './AppointmentRequestSections';
import { PortalButton, PortalCard, StatusBadge } from './PortalPrimitives';
import { RequestSection, ViewStudentRecordAction } from './RequestDetailPrimitives';
import { RequestStatusBadge } from './RequestStatusBadge';
import { appointmentDetailTypography as text } from './AppointmentPrimitives';
import { AppointmentProjectStageField, SupervisionResearchCard } from './SupervisionDetailLayout';

export function AppointmentAttentionOverview({ module, studentName, studentId, programme, projectStage, projectSemester, active, supervisor, research, pendingRequest, onOpenStudent, onOpenAppointment }: {
  module: 'Supervisor' | 'Panel'; studentName: string; studentId: string; programme: string; active: boolean; supervisor?: string;
  projectStage?: string | null; projectSemester?: string | null;
  research?: { title?: string; area?: string; abstract?: string };
  pendingRequest?: { status: string; candidate?: string; onOpen?: () => void };
  onOpenStudent?: (id: string) => void; onOpenAppointment?: () => void;
}) {
  const status = active ? `Active ${module === 'Panel' ? 'Panel' : 'primary supervisor'} appointment` : module === 'Panel' ? 'No active Panel appointment' : 'No active primary supervisor';
  return <div data-appointment-attention-overview className="space-y-6">
    <RequestSummaryCard title="Student overview" studentName={studentName} studentId={studentId} programme={programme} showSemester={false}
      participants={supervisor ? [{ label: 'Primary supervisor', value: supervisor }] : []}
      academicField={<AppointmentProjectStageField stage={projectStage} semester={projectSemester}/>}
      contextAction={<ViewStudentRecordAction studentId={studentId} onOpen={onOpenStudent} />} />
    <PortalCard padding="lg"><RequestSection title="Appointment status" headingClassName={text.heading}>
      <StatusBadge tone={active ? 'success' : 'neutral'}>{status}</StatusBadge>
      {active && onOpenAppointment ? <div><PortalButton size="sm" onClick={onOpenAppointment}>View appointment</PortalButton></div> : null}
      <div className="space-y-3 border-t border-slate-200 pt-5">
        <h3 className={text.label}>Ongoing request</h3>
        {pendingRequest ? <>
          <RequestStatusBadge status={pendingRequest.status} />
          {pendingRequest.candidate ? <p className={text.body}>Proposed {module === 'Panel' ? 'Panel member' : 'supervisor'}: <span className="font-semibold">{pendingRequest.candidate}</span></p> : null}
          {pendingRequest.onOpen ? <div><PortalButton size="sm" onClick={pendingRequest.onOpen}>View request</PortalButton></div> : null}
        </> : <p className={text.body}>No ongoing request.</p>}
      </div>
    </RequestSection></PortalCard>
    {research && (research.title || research.area || research.abstract) ? <SupervisionResearchCard profile={research} matricNo={studentId} returnLabel="Supervisor appointment overview" showProgramme={false} /> : null}
  </div>;
}
