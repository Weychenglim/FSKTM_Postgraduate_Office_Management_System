import { useReturnToFocusReload } from '../utils/returnToFocus';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BookOpen, FileText, UsersRound } from 'lucide-react';
import { PageHeader, PortalButton } from './PortalPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { getStudentPanelAppointment } from '../services/appointmentsApi';
import type { StudentPanelAppointmentView } from '../types';
import { formatWaitingText } from '../utils/workflowAgeing';
import { getPanelReadinessCopy } from '../utils/panelReadiness';
import { APP_ROUTES } from '../constants/routes';
import { StudentResearchProfileSection } from './StudentResearchProfileSection';
import { SupervisionDetailSection, supervisionDetailBody as body } from './SupervisionDetailLayout';
import { PanelDetailFact } from './PanelDetailLayout';
import { RecordPage } from './RecordPage';
import { formatMalaysiaDateTime } from '../utils/malaysiaDateTime';
import { StudentAppointmentAcademicFields, StudentAppointmentCard, StudentAppointmentLayout, StudentAppointmentNextStep } from './StudentAppointmentLayout';

interface StudentPanelAppointmentProps {
  onShowFAQChatbot?: () => void;
  onNavigateToResearchProfile?: () => void;
}

function panelGuidance(appointment: StudentPanelAppointmentView) {
  switch (appointment.readinessState) {
    case 'SUPERVISOR_REQUIRED':
      return { title: 'Start with a supervisor application', content: <><p>Your primary supervisor submits the Panel nomination after their appointment is approved.</p><Link className="inline-block rounded text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600" to={APP_ROUTES.supervisorAppointments}>Open Supervisor appointments</Link></> };
    case 'SUPERVISOR_APPROVAL_PENDING':
      return { title: 'Check your supervisor application', content: <><p>Open the application to see its progress and any decision notes.</p><Link className="inline-block rounded text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600" to={APP_ROUTES.supervisorAppointments}>View Supervisor application</Link></> };
    case 'READY_FOR_PANEL_RECOMMENDATION':
      return { title: 'Arrange your Panel nomination', content: <p>Contact your primary supervisor{appointment.supervisorName ? `, ${appointment.supervisorName},` : ''} to discuss a suitable Panel member. They submit the nomination in this portal.</p> };
    case 'FACULTY_PROCESSING':
      return { title: 'During faculty processing', content: <p>Panel member details are released after confirmation. For questions about the nomination, contact your primary supervisor{appointment.supervisorName ? `, ${appointment.supervisorName}` : ''}.</p> };
    case 'CONFIRMED':
      return { title: 'Requesting a Panel change', content: <p>Discuss the reason with your primary supervisor{appointment.supervisorName ? `, ${appointment.supervisorName}` : ''}. They submit the replacement nomination; your current Panel remains assigned until it is approved.</p> };
  }
}

export function StudentPanelAppointmentOverview({ appointment, onShowFAQChatbot, onNavigateToResearchProfile }: StudentPanelAppointmentProps & {
  appointment: StudentPanelAppointmentView;
}) {
  const confirmed = appointment.status === 'CONFIRMED' && appointment.readinessState === 'CONFIRMED';
  const waiting = formatWaitingText(appointment);
  const guidance = panelGuidance(appointment);
  const supervisorPending = appointment.readinessState === 'SUPERVISOR_APPROVAL_PENDING';
  return <div data-student-panel-overview>
    <StudentAppointmentLayout guidance={<StudentAppointmentNextStep cards={[guidance]} onShowFAQChatbot={onShowFAQChatbot}/>}>
        {confirmed ? <StudentAppointmentCard title="My panel" memberLabel="Panel member" name={appointment.panelMemberName?.trim() || 'Panel member not recorded'} status="Confirmed" tone="success"
          projectStage={appointment.projectStage} projectSemester={appointment.projectSemester}
          programme={appointment.programme} semester={appointment.semester} department={appointment.panelMemberDepartment} email={appointment.panelMemberEmail} appointmentDate={appointment.appointmentDate}/>
        : <SupervisionDetailSection title="My panel" icon={UsersRound}>
          <div className="space-y-4"><p className={body}>{getPanelReadinessCopy(appointment.readinessState).title}</p>{waiting !== 'Not waiting' ? <p className="text-xs leading-6 text-slate-500">{waiting}</p> : null}</div>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <StudentAppointmentAcademicFields programme={appointment.programme} stage={appointment.projectStage} projectSemester={appointment.projectSemester} displayedSemester={appointment.semester}/>
          <PanelDetailFact title="Semester" value={appointment.semester}/>
          {appointment.readinessState !== 'SUPERVISOR_REQUIRED' ? <PanelDetailFact title={supervisorPending ? 'Proposed supervisor' : 'Primary supervisor'} value={appointment.supervisorName}/> : null}</dl>
        </SupervisionDetailSection>}
        {appointment.researchProfile ? <StudentResearchProfileSection standalone profile={appointment.researchProfile}
          actions={onNavigateToResearchProfile && <PortalButton size="sm" variant="primary" icon={BookOpen} onClick={onNavigateToResearchProfile}>View research profile</PortalButton>}/> : null}
    </StudentAppointmentLayout>
  </div>;
}

export const StudentPanelAppointment: React.FC<StudentPanelAppointmentProps> = ({ onShowFAQChatbot, onNavigateToResearchProfile }) => {
  const [params, setParams] = useSearchParams();
  const [appointment, setAppointment] = useState<StudentPanelAppointmentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadAppointment = useCallback(() => {
    setLoading(true); setError(null);
    getStudentPanelAppointment().then(setAppointment)
      .catch(failure => { setAppointment(null); setError(failure instanceof Error ? failure.message : 'Panel appointment could not be loaded.'); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadAppointment(); }, [loadAppointment]);
  useReturnToFocusReload(loadAppointment, !loading);
  const requestedRecord = params.get('panelRequest');
  const closeRecord = () => setParams(current => {const next=new URLSearchParams(current);next.delete('panelRequest');return next;});
  if (requestedRecord) {
    const record = appointment?.status === 'CONFIRMED' && appointment.readinessState === 'CONFIRMED' ? appointment.approvedRequest : null;
    return <RecordPage title="Approved Panel nomination" backLabel="Back to My panel" onBack={closeRecord}>
      {loading ? <LoadingState message="Loading approved nomination..."/> : error ? <ErrorState message={error} onRetry={loadAppointment}/> : record && appointment && String(record.id) === requestedRecord ? <SupervisionDetailSection title="Approved nomination" icon={FileText}>
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <PanelDetailFact title="Request reference" value={`PN-${record.id}`}/><PanelDetailFact title="Panel member" value={appointment.panelMemberName}/>
          <PanelDetailFact title="Nominated by" value={record.nominatedBy}/><PanelDetailFact title="Appointed on" value={appointment.appointmentDate}/>
          {([['Submitted',record.submittedAt],['Panel accepted',record.panelAcceptedAt],['Coordinator approved',record.approvedAt]] as const).map(([title,date]) => <PanelDetailFact key={title} title={title} value={date ? formatMalaysiaDateTime(date) : null}/>)}
        </dl>
      </SupervisionDetailSection> : <EmptyState title="Approved nomination not available" description="This record is not the nomination for your current Panel appointment."/>}
    </RecordPage>;
  }
  return <div id="student-panel-app-workspace" className="space-y-7 text-left font-sans pb-12">
    <PageHeader title="Panel Appointment" subtitle="See your Panel appointment and the next step for your current status." />
    {loading ? <LoadingState message="Loading your panel appointment..." /> : error || !appointment ? <ErrorState message={error || 'Panel appointment record was not available.'} onRetry={loadAppointment} /> : <StudentPanelAppointmentOverview appointment={appointment} onShowFAQChatbot={onShowFAQChatbot} onNavigateToResearchProfile={onNavigateToResearchProfile} />}
  </div>;
};
