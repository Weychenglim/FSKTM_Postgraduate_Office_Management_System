import {AppointmentHistoryCard} from './AppointmentSidebar';
import React from 'react';
import {ClipboardList,UsersRound,FileText} from 'lucide-react';
import {formatRequestDisplayDate} from './ApprovalProcess';
import {RequestAuditHistory,RequestDetailActions,ViewStudentRecordAction} from './RequestDetailPrimitives';
import {PanelAppointmentRecordCard} from './PanelRecordDetails';
import {PanelDetailFact,PanelStudentOverview,PanelResearchDetails,PanelMemberDetails} from './PanelDetailLayout';
import {SupervisionDetailSection,SupervisionPerson,supervisionDetailBody as body} from './SupervisionDetailLayout';
import {PortalButton,StatusBadge} from './PortalPrimitives';
import {panelRequestPending,panelStatusLabel,type PanelPresentation} from '../utils/panelPresentation';

import type {PanelAcademicTeam} from '../types/appointment';

/** Authorised appointment data only; caller owns lifecycle and navigation capabilities. */
export function PanelAssignmentDetails({record,contextAction,actions,academicTeam,onViewRequest,busy=false,markingAction}:{record:PanelPresentation;academicTeam?:PanelAcademicTeam|null;busy?:boolean;markingAction?:React.ReactNode;onViewRequest?:(id:string)=>void;contextAction?:React.ReactNode;actions?:React.ReactNode}) {
  const lifecycle=record.appointmentLifecycle;
  const sourceAction=record.status==='APPROVED'&&record.id != null&&onViewRequest?<PortalButton variant="primary" icon={FileText} size="sm" disabled={busy} onClick={()=>onViewRequest(String(record.id))}>View approved application</PortalButton>:null;
  const changes=(lifecycle?.lifecycle??[]).filter(event=>event.action!=='ACTIVATED');
  return <div data-panel-assignment-detail className="space-y-7">
    <PanelStudentOverview record={record} actions={contextAction} assignment={academicTeam !== undefined}/>
    <div data-panel-assignment-columns className="grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-7">{academicTeam !== undefined ? <SupervisionDetailSection title="Academic team" icon={UsersRound} contentClassName="mt-4 min-w-0">
        <div className="space-y-6">
          {lifecycle && lifecycle.status !== 'ACTIVE' ? <p className="text-xs leading-6 text-slate-600">Supervisors shown are current. The Panel appointment below is historical.</p> : null}
          {academicTeam ? <>
            {academicTeam.primary ? <SupervisionPerson name={academicTeam.primary.name} role="Primary supervisor" email={academicTeam.primary.email} department={academicTeam.primary.department} appointedOn={academicTeam.primary.appointmentDate ? formatRequestDisplayDate(academicTeam.primary.appointmentDate) : null}/> : <p className="text-sm leading-6 text-slate-600">No current primary supervisor appointed.</p>}
            <section aria-label="Supporting supervisors" className="min-w-0 space-y-5 border-t border-slate-200 pt-6"><h3 className="text-sm font-semibold leading-6 text-brand-navy">Supporting supervisors</h3>{academicTeam.supporting.length ? <div className="space-y-6">{academicTeam.supporting.map((person,index)=><SupervisionPerson key={`${person.email}-${index}`} name={person.name} role="Supporting supervisor" email={person.email} department={person.department} appointedOn={person.appointmentDate ? formatRequestDisplayDate(person.appointmentDate) : null}/>)}</div> : <p className="text-sm leading-6 text-slate-600">No supporting supervisors assigned.</p>}</section>
          </> : <p className="text-sm leading-6 text-slate-600">Current supervisor details are unavailable.</p>}
        </div>
        <div className="mt-6 border-t border-slate-200 pt-6"><SupervisionPerson name={record.recommendedMember?.trim() || 'Panel member not recorded'} role="Panel member for this assignment" email={record.panelMemberEmail} department={record.panelMemberDepartment} appointedOn={record.appointmentDate ? formatRequestDisplayDate(record.appointmentDate) : null} status={record.appointmentLifecycle?.status === 'ACTIVE' ? 'Active' : record.appointmentLifecycle ? panelStatusLabel(record.appointmentLifecycle.status) : 'Status not recorded'}/></div>
      </SupervisionDetailSection> : <PanelMemberDetails record={record}/>}
        {record.unavailableUntil?<p className="text-sm leading-6 text-amber-800">Unavailable for new appointments until {formatRequestDisplayDate(record.unavailableUntil)}. This recorded appointment remains available.</p>:null}
        <PanelResearchDetails record={record}/>
      </div>
      <aside aria-label="Appointment information" className="min-w-0 space-y-7">
        {lifecycle?<PanelAppointmentRecordCard markingAction={markingAction} compact showHistory={false} record={record} sourceAction={sourceAction} actions={actions}/>:<SupervisionDetailSection title="Appointment record" icon={ClipboardList}><p className={body}>No appointment lifecycle record is available.</p>{sourceAction?<RequestDetailActions>{sourceAction}</RequestDetailActions>:null}</SupervisionDetailSection>}

      </aside>
    </div>
    {changes.length?<AppointmentHistoryCard><RequestAuditHistory sidebar title="View changes" events={changes.map(event=>({...event,reason:event.reason??undefined}))}/></AppointmentHistoryCard>:null}
  </div>;
}

/** Office attention overview: only the current state actually supplied by the API. */
export function PanelAppointmentOverview({record,onOpenStudent,onViewRequest,onViewAppointment}:{record:PanelPresentation;onOpenStudent?:(id:string)=>void;onViewRequest?:(id:string)=>void;onViewAppointment?:(id:number)=>void}) {
  const active=record.appointmentLifecycle?.status==='ACTIVE';
  const pending=panelRequestPending(record.status);
  return <div data-panel-appointment-overview className="space-y-7"><PanelStudentOverview record={record} actions={<ViewStudentRecordAction studentId={record.studentId} onOpen={onOpenStudent}/>}/>
    <div data-panel-assignment-columns className="grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-7">
        {active?<PanelMemberDetails record={record}/>:null}
        <PanelResearchDetails record={record}/>
      </div>
      <aside className="min-w-0" aria-label="Panel appointment status"><SupervisionDetailSection title="Appointment status" icon={ClipboardList}>
        <StatusBadge tone={active?'success':'neutral'}>{active?'Active Panel appointment':'No active Panel appointment'}</StatusBadge>
        {active&&onViewAppointment?<PortalButton size="sm" onClick={()=>onViewAppointment(record.appointmentLifecycle!.appointmentId)}>View appointment</PortalButton>:null}
        {pending?<div className="space-y-5 border-t border-slate-100 pt-6"><h3 className="text-sm font-semibold text-brand-navy">Pending request</h3><StatusBadge tone="info">{panelStatusLabel(record.status)}</StatusBadge><dl><PanelDetailFact title="Proposed Panel member" value={record.recommendedMember}/></dl>{record.id!=null&&onViewRequest?<RequestDetailActions><PortalButton size="sm" onClick={()=>onViewRequest(String(record.id))}>View request</PortalButton></RequestDetailActions>:null}</div>:!active?<p className={body}>No pending request.</p>:null}
      </SupervisionDetailSection></aside>
    </div>
  </div>;
}
