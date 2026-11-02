import { IconHeading } from './IconHeading';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  History,
  PanelTop,
  UserRound,
  UsersRound,
} from 'lucide-react';

import type {
  PanelDossierRecord,
  StudentProgressDossier as StudentProgressDossierData,
  StudentProgressSection,
  StudentProgressTab,
  StudentProgressTarget,
  SupervisorDossierRecord,
  SupervisorWorkflowEvent,
  UserRole,
} from '../types';
import { getStudentProgressDossier } from '../services';
import { ApiError } from '../services/apiClient';
import { APP_ROUTES } from '../constants/routes';
import {
  formatProgressStatus,
  resolveStudentProgressRecordRoute,
  visibleProgressTabs,
} from '../utils/studentProgress';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { StudentLifecycleSummary } from './StudentLifecycleSummary';
import {
  PageHeader,
  PortalButton,
  PortalCard,
  StatusBadge,
  getStatusBadgeTone,
} from './PortalPrimitives';

interface StudentProgressDossierProps {
  studentId?: string;
  currentUserRole: UserRole;
  onBack: () => void;
  backLabel?: string;
  onNavigateToRoute: (route: string) => void;
}

const TAB_LABELS: Record<StudentProgressTab, string> = {
  OVERVIEW: 'Overview',
  SUPERVISOR: 'Supervisor',
  PANEL: 'Panel',
  MARKS: 'Marks',
  TIMELINE: 'Timeline',
};

const STUDENT_TAB_LABELS: Record<StudentProgressTab, string> = {
  ...TAB_LABELS,
  SUPERVISOR: 'Supervision',
  TIMELINE: 'Milestones',
};

const dateText = (value: string | null | undefined): string =>
  value
    ? new Date(value).toLocaleDateString('en-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Not recorded';

const statusTone = (status: string | null | undefined) => {
  const normalized = formatProgressStatus(status);
  if (normalized.includes('Rejected') || normalized.includes('Cancelled') || normalized === 'Overdue') {
    return 'danger' as const;
  }
  if (normalized.includes('Pending') || normalized.includes('Processing') || normalized === 'Draft') {
    return 'warning' as const;
  }
  if (normalized.includes('Approved') || normalized.includes('Submitted') || normalized === 'Active') {
    return 'success' as const;
  }
  return getStatusBadgeTone(normalized);
};

export function DossierCalendarStatus({ currentUserRole, status }: { currentUserRole: UserRole; status: string }) {
  const ended = currentUserRole === 'Office Staff/Admin' && status === 'COMPLETED';
  return <StatusBadge tone={ended ? 'neutral' : statusTone(status)}>{ended ? 'Ended' : formatProgressStatus(status)}</StatusBadge>;
}

export function DossierRecordDisclosure({ office, current, title, children }: { office: boolean; current: boolean; title: string; children: React.ReactNode }) {
  return office && !current ? <details className="rounded-lg border border-slate-200 bg-white p-4"><summary className="card-value cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-blue-600">{title}</summary><div className="mt-4">{children}</div></details> : <>{children}</>;
}

const AuditTrail: React.FC<{ events?: SupervisorWorkflowEvent[]; collapsible?: boolean; label?: string }> = ({ events = [], collapsible = false, label = 'Workflow audit' }) => {
  if (events.length === 0) return null;
  const content = (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="section-label mb-3 flex items-center gap-2 uppercase text-slate-500">
        <History className="h-3.5 w-3.5" />
        {label}
      </p>
      <div className="space-y-3 border-l-2 border-slate-200 pl-4">
        {events.map((event) => (
          <div key={event.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="card-value text-brand-navy">
                {formatProgressStatus(event.action)}
              </p>
              <time className="card-caption text-slate-400">
                {dateText(event.createdAt)}
              </time>
            </div>
            <p className="card-description mt-1">
              {event.actorName} · {event.actorRole}
            </p>
            {event.reason && (
              <p className="card-description mt-1">{event.reason}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  return collapsible ? <details className="mt-4 rounded-lg border border-slate-200 p-4"><summary className="card-value cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-blue-600">{label} · {events.length} events</summary>{content}</details> : content;
};

const RecordAction: React.FC<{
  target: StudentProgressTarget;
  onNavigate: (route: string) => void;
  label?: string;
  route?: string;
}> = ({ target, onNavigate, label = 'Open record', route }) => (
  <PortalButton
    size="sm"
    variant="ghost"
    icon={ArrowUpRight}
    onClick={() => onNavigate(route ?? resolveStudentProgressRecordRoute(target))}
  >
    {label}
  </PortalButton>
);

const SupervisorRecord: React.FC<{
  record: SupervisorDossierRecord;
  isCurrent: boolean;
  internal: boolean;
  office?: boolean;
  onNavigate: (route: string) => void;
}> = ({ record, isCurrent, internal, office = false, onNavigate }) => (
  <PortalCard padding="md" className={isCurrent ? 'border-l-4 border-l-blue-600' : ''}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone(record.status)}>{formatProgressStatus(record.status)}</StatusBadge>
          {isCurrent && <StatusBadge tone="info">Current</StatusBadge>}
        </div>
        <h3 className="section-label mt-3">{record.researchTitle}</h3>
        <p className="card-description mt-1">
          Proposed supervisor: {record.proposedSupervisor}
        </p>
        <p className="card-description mt-1">
          Research area: {record.researchArea || 'Not recorded'}
        </p>
      </div>
      {internal && <RecordAction target={record} onNavigate={onNavigate} label={office ? 'Open Supervisor record' : undefined} />}
    </div>
    <div className="card-description mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <p><span className="card-label">Submitted:</span> {dateText(record.submittedAt)}</p>
      <p><span className="card-label">Waiting:</span> {record.waitingDays === null ? 'Not waiting' : `${record.waitingDays} days`}</p>
      <p><span className="card-label">Appointment:</span> {record.appointment ? dateText(record.appointment.appointmentDate) : 'Not appointed'}</p>
    </div>
    {(record.rejectionReason || record.cancellationReason) && (
      <p className="card-description mt-4 border-l-2 border-rose-300 pl-3 text-rose-700">
        {record.rejectionReason || record.cancellationReason}
      </p>
    )}
    {internal && record.appointment?.endReason && (
      <p className="card-description mt-4 border-l-2 border-slate-300 pl-3">
        {formatProgressStatus(record.appointment.endOutcome || 'ENDED')}: {record.appointment.endReason}
      </p>
    )}
    {internal && <AuditTrail events={record.workflow} collapsible={office} />}
    {internal && <AuditTrail events={record.appointment?.lifecycle} collapsible={office} label={office ? 'Appointment history' : undefined} />}
  </PortalCard>
);

const PanelRecord: React.FC<{
  record: PanelDossierRecord;
  isCurrent: boolean;
  internal: boolean;
  office?: boolean;
  onNavigate: (route: string) => void;
}> = ({ record, isCurrent, internal, office = false, onNavigate }) => (
  <PortalCard padding="md" className={isCurrent ? 'border-l-4 border-l-cyan-600' : ''}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone(record.status)}>{formatProgressStatus(record.status)}</StatusBadge>
          {isCurrent && <StatusBadge tone="info">Current</StatusBadge>}
        </div>
        <p className="card-description mt-3">
          {record.appointment
            ? `Appointed panel member: ${record.appointment.panelMember}`
            : record.recommendedMember
            ? `Recommended member: ${record.recommendedMember}`
            : 'Panel appointment is being processed by the faculty.'}
        </p>
      </div>
      {internal && record.recordId && <RecordAction target={record} onNavigate={onNavigate} label={office ? 'Open Panel record' : undefined} />}
    </div>
    <div className="card-description mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <p><span className="card-label">Submitted:</span> {dateText(record.submittedAt)}</p>
      <p><span className="card-label">Waiting:</span> {record.waitingDays === null ? 'Not waiting' : `${record.waitingDays} days`}</p>
      <p><span className="card-label">Decision:</span> {dateText(record.coordinatorDecisionAt || record.panelDecisionAt || record.decisionAt)}</p>
    </div>
    {(record.rejectionReason || record.cancellationReason) && (
      <p className="card-description mt-4 border-l-2 border-rose-300 pl-3 text-rose-700">
        {record.rejectionReason || record.cancellationReason}
      </p>
    )}
    {internal && record.appointment?.endReason && (
      <p className="card-description mt-4 border-l-2 border-slate-300 pl-3">
        {formatProgressStatus(record.appointment.endOutcome || 'ENDED')}: {record.appointment.endReason}
      </p>
    )}
    {internal && <AuditTrail events={record.workflow} collapsible={office} />}
    {internal && <AuditTrail events={record.appointment?.lifecycle} collapsible={office} label={office ? 'Appointment history' : undefined} />}
  </PortalCard>
);

export function StudentPanelAppointmentSummary({records}:{records:PanelDossierRecord[]}) {
  const appointments=records.filter(record=>record.appointment
    && ['CONFIRMED','APPROVED','ACTIVE','ENDED','COMPLETED'].includes(record.status)
    && ['ACTIVE','ENDED','COMPLETED'].includes(record.appointment.status));
  const current=appointments.find(record=>record.appointment!.status==='ACTIVE');
  const history=appointments.filter(record=>record.appointment!.status!=='ACTIVE');
  const processing=!current&&records.some(record=>record.status==='FACULTY_PROCESSING');
  const appointmentCard=(record:PanelDossierRecord,index:number)=>{
    const appointment=record.appointment!;
    const active=appointment.status==='ACTIVE';
    return <PortalCard key={`${appointment.appointmentDate}-${appointment.panelMember}-${index}`} padding="md" className={active?'border-l-4 border-l-cyan-600':undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="card-value">{appointment.panelMember}</h3>
        <StatusBadge tone={active?'success':'neutral'}>{active?'Confirmed':formatProgressStatus(appointment.status)}</StatusBadge>
      </div>
      <dl className="card-description mt-4 flex flex-wrap gap-x-8 gap-y-3">
        <div><dt className="card-label">Appointed on</dt><dd className="mt-1">{dateText(appointment.appointmentDate)}</dd></div>
        {!active&&appointment.endedAt?<div><dt className="card-label">{appointment.status==='COMPLETED'?'Completed on':'Ended on'}</dt><dd className="mt-1">{dateText(appointment.endedAt)}</dd></div>:null}
      </dl>
    </PortalCard>;
  };
  return <div className="space-y-4">
    {current?appointmentCard(current,0):processing?<PortalCard padding="md">
      <StatusBadge tone="warning">Processing</StatusBadge>
      <p className="card-description mt-3">Your Panel appointment is being processed.</p>
    </PortalCard>:<EmptyState title="No Panel appointment yet" description="Your appointed Panel member will appear here once confirmed."/>}
    {history.length?<section className="space-y-4" aria-label="Previous Panel appointments">
      <h3 className="section-label">Previous Panel appointments</h3>
      {history.map(appointmentCard)}
    </section>:null}
  </div>;
}

export const StudentProgressDossier: React.FC<StudentProgressDossierProps> = ({
  studentId,
  currentUserRole,
  onBack,
  backLabel = 'Back to Dashboard',
  onNavigateToRoute,
}) => {
  const [dossier, setDossier] = useState<StudentProgressDossierData | null>(null);
  const [activeTab, setActiveTab] = useState<StudentProgressTab>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const requestGeneration = useRef(0);
  const [loadedStudentId, setLoadedStudentId] = useState<string | undefined>();
  const pageTitle = currentUserRole === 'Student' ? 'My Academic Record' : 'Student Progress Dossier';

  const loadDossier = useCallback(() => {
    const generation = ++requestGeneration.current;
    setDossier(null);
    if (!studentId) {
      setLoading(false);
      setNotFound(true);
      setLoadedStudentId(studentId);
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    getStudentProgressDossier(studentId)
      .then((result) => {
        if (generation !== requestGeneration.current) return;
        setDossier(result);
        setActiveTab(visibleProgressTabs(result.visibleSections, result.visibility)[0] ?? 'OVERVIEW');
      })
      .catch((reason) => {
        if (generation !== requestGeneration.current) return;
        if (reason instanceof ApiError && reason.status === 404) {
          setNotFound(true);
          return;
        }
        setError(reason instanceof Error ? reason.message : 'Unable to load student progress.');
      })
      .finally(() => {
        if (generation !== requestGeneration.current) return;
        setLoadedStudentId(studentId);
        setLoading(false);
      });
  }, [studentId]);

  useEffect(() => {
    loadDossier();
    return () => { requestGeneration.current++; };
  }, [loadDossier]);

  const tabs = useMemo(
    () => visibleProgressTabs(dossier?.visibleSections ?? [], dossier?.visibility),
    [dossier],
  );

  if (loading || loadedStudentId !== studentId) return <div className="space-y-5"><PageHeader title={pageTitle} backLabel={backLabel} onBack={onBack} /><LoadingState message={currentUserRole === 'Student' ? 'Loading your academic record…' : 'Loading student progress dossier…'} /></div>;
  if (notFound) {
    return (
      <div className="space-y-5">
        <PageHeader title={pageTitle} backLabel={backLabel} onBack={onBack} />
        <EmptyState
          title={currentUserRole === 'Student' ? 'Academic record not available' : 'Dossier not available'}
          description="The student record was not found or is outside your authorised scope."
          icon={AlertTriangle}
        />
      </div>
    );
  }
  if (error || !dossier) {
    return <div className="space-y-5"><PageHeader title={pageTitle} backLabel={backLabel} onBack={onBack} /><ErrorState message={error ?? 'Unable to load student progress.'} onRetry={loadDossier} /></div>;
  }

  const internal = dossier.visibility === 'INTERNAL';
  const office = internal && currentUserRole === 'Office Staff/Admin';
  const statusItems = [
    { section: 'SUPERVISOR', label: 'Supervisor', value: dossier.overview.supervisorStatus, icon: UserRound },
    { section: 'PANEL', label: 'Panel', value: dossier.overview.panelStatus, icon: PanelTop },
    { section: 'MARKS', label: 'Marks', value: dossier.overview.marksStatus, icon: FileText },
    { section: 'TIMELINE', label: 'Active milestones', value: String(dossier.overview.activeTimelineEntries), icon: CalendarDays },
  ].filter((item) => dossier.visibleSections.includes(item.section as StudentProgressSection));

  return (
    <div id="student-progress-dossier" className="space-y-6 pb-16 text-left font-sans text-xs">
      <PageHeader
        title={pageTitle}
        subtitle={internal
          ? 'Authorised current state and complete persisted workflow history.'
          : 'Review your supervision and panel history, semester milestones, and research changes. Upcoming deadlines and actions are on your dashboard.'}
        backLabel={backLabel}
        onBack={onBack}
        actions={internal && currentUserRole === 'Office Staff/Admin' ? (
          <PortalButton data-office-preserve icon={UsersRound} onClick={() => onNavigateToRoute(APP_ROUTES.dashboardParticipantLifecycle)}>
            Manage Participant
          </PortalButton>
        ) : undefined}
      />

      <PortalCard padding="md" className="border-t-4 border-t-brand-navy rounded-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <IconHeading className="gap-x-4" title={dossier.student.studentName} titleClassName="section-heading"
              description={`${dossier.student.studentId} · ${dossier.student.programme}`}
              icon={<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-white"><GraduationCap className="h-6 w-6" /></span>}
            />
            {internal && <div className="mt-3 flex flex-wrap gap-2 pl-16">
              <StatusBadge tone={statusTone(dossier.student.status)}>{dossier.student.status}</StatusBadge>
              <StatusBadge tone={dossier.overview.attentionCount > 0 ? 'warning' : 'success'}>
                {dossier.overview.attentionCount} attention items
              </StatusBadge>
            </div>}
          </div>
          <div className="max-w-xl lg:text-right">
            <p className="card-label">Research topic</p>
            <p className="card-value mt-1 text-slate-700">
              {dossier.student.research?.title ?? 'Research profile not yet available'}
            </p>
            {dossier.student.research && (
              <p className="card-description mt-1">
                {dossier.student.research.researchArea} · {dossier.student.research.semester}
              </p>
            )}
          </div>
        </div>
        {!internal && <StudentLifecycleSummary lifecycle={dossier.student.lifecycle} internal={false} />}
      </PortalCard>

      {internal && (office ? <div data-office-preserve><StudentLifecycleSummary lifecycle={dossier.student.lifecycle} internal /></div> : <StudentLifecycleSummary lifecycle={dossier.student.lifecycle} internal />)}

      {internal && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statusItems.map(({ label, value, icon: Icon }) => (
          <PortalCard key={label} padding="sm" className="rounded-lg min-h-[96px]">
            <div className="flex items-center justify-between gap-2">
              <p className="card-label uppercase text-slate-400">{label}</p>
              <Icon className="h-4 w-4 text-slate-400" />
            </div>
            <p className="card-value mt-4 text-brand-navy">
              {label === 'Active milestones' ? value : formatProgressStatus(value)}
            </p>
          </PortalCard>
        ))}
      </div>}

      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex min-w-max gap-6" role="tablist" aria-label={internal ? 'Dossier sections' : 'Academic record sections'}>
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-1 pb-3 text-xs font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                activeTab === tab
                  ? 'border-brand-navy text-brand-navy'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {(internal ? TAB_LABELS : STUDENT_TAB_LABELS)[tab]}
            </button>
          ))}
        </div>
      </div>

      {tabs.length === 0 && <EmptyState title="No academic records available" description="Your appointment records and semester milestones will appear here when they are recorded." />}

      {internal && activeTab === 'OVERVIEW' && (
        <section className="space-y-4">
          <div>
            <h2 className="section-label">Attention and next milestones</h2>
            <p className="card-description mt-1">
              Persisted deadlines and active workflow waits, ordered by priority.
            </p>
          </div>
          {dossier.attention.length === 0 ? (
            <EmptyState
              title="No active attention items"
              description="There are no overdue tasks, waiting approvals, or active milestones."
              icon={CheckCircle2}
            />
          ) : (
            <div className="divide-y divide-slate-100 border-y border-slate-200">
              {dossier.attention.map((item, index) => (
                <div
                  key={`${item.kind}-${item.recordType}-${item.recordId ?? index}`}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="card-value text-brand-navy">{item.label}</p>
                      <p className="card-description mt-1">
                        {item.waitingDays !== null
                          ? `${item.waitingDays} calendar days`
                          : item.dueAt
                          ? `Date: ${dateText(item.dueAt)}`
                          : formatProgressStatus(item.kind)}
                      </p>
                    </div>
                  </div>
                  {(internal || item.targetModule !== 'MARKS') && (
                    <RecordAction target={item} onNavigate={onNavigateToRoute} route={office && item.targetModule === 'MARKS' ? APP_ROUTES.marksTasks : undefined} label={office ? item.targetModule === 'SUPERVISOR_APPOINTMENTS' ? 'Open Supervisor record' : item.targetModule === 'PANEL_APPOINTMENTS' ? 'Open Panel record' : item.targetModule === 'MARKS' ? 'Open evaluation tasks' : 'Open calendar' : undefined} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'SUPERVISOR' && dossier.supervisor && (
        <section className="space-y-4">
          {dossier.supervisoryTeam ? <PortalCard padding="md">
            <h2 className="section-label">Supervisory team</h2>
            <p className="card-description mt-2"><span className="card-label">Primary:</span> <span className="card-value">{dossier.supervisoryTeam.primarySupervisor?.name ?? 'Awaiting primary appointment'}</span></p>
            <div className="mt-3 space-y-2">{dossier.supervisoryTeam.appointments.map(appointment => <DossierRecordDisclosure key={appointment.id} office={office} current={appointment.status === 'ACTIVE'} title={`Co-supervisor · ${appointment.supervisor.name} · ${formatProgressStatus(appointment.status)}`}><div className="card-description rounded-lg border border-slate-200 p-3">
              <span className="card-value">{appointment.supervisor.name}</span> · Co-supervisor · {formatProgressStatus(appointment.status)}
              <p className="card-description mt-1">Since {dateText(appointment.appointmentDate)}{appointment.endedAt ? ` · Ended ${dateText(appointment.endedAt)}${internal && appointment.endReason ? ` · ${appointment.endReason}` : ''}` : ''}</p>
            </div></DossierRecordDisclosure>)}</div>
            {dossier.supervisoryTeam.nominations.length ? <p className="card-description mt-3">{dossier.supervisoryTeam.nominations.filter(nomination => ['SUBMITTED_TO_CO_SUPERVISOR', 'PENDING_COORDINATOR'].includes(nomination.status)).length} pending supporting nominations</p> : null}
            <PortalButton size="sm" className="mt-3" onClick={() => onNavigateToRoute(APP_ROUTES.supervisorAppointments)}>View team and history</PortalButton>
          </PortalCard> : null}
          {dossier.researchAmendments?.length ? <PortalCard padding="md">
            <h2 className="section-label">Research amendments and programme transfers</h2>
            <div className="mt-3 space-y-3">{dossier.researchAmendments.map(row => <DossierRecordDisclosure key={row.id} office={office} current={false} title={`${row.kind === 'TRANSFER' ? 'Programme transfer' : 'Research amendment'} · ${row.stageLabel} · ${dateText(row.updatedAt)}`}><div className="card-description border-b border-slate-100 pb-3">
              <p className="card-value">{row.kind === 'TRANSFER' ? 'Programme transfer' : 'Research amendment'} · {row.stageLabel}</p>
              <p>{row.before.title} → {row.after.title}</p>
              {row.kind === 'TRANSFER' ? <p>{row.sourceProgramme} → {row.destinationProgramme}</p> : null}
              <p className="card-description mt-1">{dateText(row.updatedAt)} · {row.reason}</p>
              {office && <RecordAction target={{ targetModule: 'SUPERVISOR_APPOINTMENTS', recordType: 'RESEARCH_AMENDMENT', recordId: String(row.id) }} label="Open amendment record" onNavigate={onNavigateToRoute} />}
            </div></DossierRecordDisclosure>)}</div>
            <PortalButton size="sm" className="mt-3" onClick={() => onNavigateToRoute(APP_ROUTES.supervisorAppointments)}>View amendment history</PortalButton>
          </PortalCard> : null}
          <h2 className="section-label">{internal ? 'Supervisor lifecycle' : 'Supervision history'}</h2>
          {dossier.supervisor.records.length === 0 ? (
            <EmptyState
              title={internal ? 'No Supervisor records' : 'No supervision history yet'}
              description={internal ? 'No Supervisor applications are available.' : 'Your supervisor applications and appointment history will appear here. Use Supervisor Appointments to submit an application.'}
            />
          ) : dossier.supervisor.records.map((record, index) => (
            <DossierRecordDisclosure key={record.recordId} office={office} current={record.recordId === dossier.supervisor?.currentRecordId} title={`Supervisor record · ${formatProgressStatus(record.status)} · ${dateText(record.submittedAt)}`}>
            <SupervisorRecord
              key={record.recordId}
              record={record}
              isCurrent={record.recordId === dossier.supervisor?.currentRecordId || (!internal && index === 0)}
              internal={internal}
              office={office}
              onNavigate={onNavigateToRoute}
            />
            </DossierRecordDisclosure>
          ))}
        </section>
      )}

      {activeTab === 'PANEL' && dossier.panel && (
        <section className="space-y-4">
          <h2 className="section-label">{internal ? 'Panel lifecycle' : 'Panel appointment'}</h2>
          {!internal?<StudentPanelAppointmentSummary records={dossier.panel.records}/>:dossier.panel.records.length === 0 ? (
            <EmptyState title="No panel history yet" description="Panel appointment records will appear here when the faculty processes your appointment." />
          ) : dossier.panel.records.map((record, index) => (
            <DossierRecordDisclosure key={record.recordId ?? `${record.status}-${record.submittedAt}-${index}`} office={office} current={record.recordId ? record.recordId === dossier.panel?.currentRecordId : index === 0} title={`Panel record · ${formatProgressStatus(record.status)} · ${dateText(record.submittedAt)}`}>
            <PanelRecord
              key={record.recordId ?? `${record.status}-${record.submittedAt}-${index}`}
              record={record}
              isCurrent={record.recordId
                ? record.recordId === dossier.panel?.currentRecordId
                : index === 0}
              internal={internal}
              office={office}
              onNavigate={onNavigateToRoute}
            />
            </DossierRecordDisclosure>
          ))}
        </section>
      )}

      {internal && activeTab === 'MARKS' && dossier.marks && (
        <section className="space-y-4">
          <h2 className="section-label">Marks tracking</h2>
          {dossier.marks.tasks.length === 0 ? (
            <EmptyState title="No evaluations yet" description="Evaluation periods and submission status will appear here when evaluation tasks are created." />
          ) : (
            <div className="overflow-x-auto border-y border-slate-200">
              <table className="data-table">
                <thead>
                  <tr className="data-thead">
                    <th className="data-th text-left">Period</th>
                    <th className="data-th text-left">Status</th>
                    {internal && <th className="data-th text-left">Evaluator</th>}
                    <th className="data-th text-left">Deadline</th>
                    {internal && <th className="data-th text-right">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {dossier.marks.tasks.map((task, index) => (
                    <tr key={task.taskId ?? `${task.period}-${index}`} className="data-row">
                      <td className="data-td-strong">{task.period}<span className="card-caption block text-slate-400">{task.semester}</span></td>
                      <td className="data-td">
                        <StatusBadge tone={task.taskLifecycleStatus === 'RETIRED' ? 'neutral' : statusTone(task.status)}>
                          {task.taskLifecycleStatus === 'RETIRED' ? 'Retired' : formatProgressStatus(task.status)}
                        </StatusBadge>
                        {internal && task.retirementReason && (
                          <span className="card-caption block mt-1 text-slate-400">{task.retirementReason}</span>
                        )}
                      </td>
                      {internal && <td className="data-td">{task.evaluator}<span className="card-caption block text-slate-400">{formatProgressStatus(task.evaluatorRole)}</span></td>}
                      <td className="data-td">{dateText(task.dueAt)}<span className="card-caption block text-slate-400">{formatProgressStatus(task.deadlineState)}</span></td>
                      {internal && (
                        <td className="data-td text-right">
                          <RecordAction target={task} onNavigate={onNavigateToRoute} route={office ? APP_ROUTES.marksTasks : undefined} label={office ? 'Open evaluation tasks' : undefined} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'TIMELINE' && dossier.timeline && (
        <section className="space-y-4">
          <div>
            <h2 className="section-label">{office ? 'Calendar milestones' : internal ? 'Active Timeline milestones' : 'Semester milestones'}</h2>
            <p className="card-description mt-1">
              {dossier.timeline.semester && dossier.timeline.session
                ? `${dossier.timeline.semester} · ${dossier.timeline.session}`
                : 'No active Timeline'}
            </p>
          </div>
          {dossier.timeline.entries.length === 0 ? (
            <EmptyState title="No active milestones" description="The active Timeline has no Student-targeted entries." />
          ) : (
            <div className="space-y-0 border-y border-slate-200">
              {dossier.timeline.entries.map((entry) => (
                <div key={entry.recordId} className="grid gap-3 border-b border-slate-100 py-4 last:border-b-0 sm:grid-cols-[90px_1fr_auto] sm:items-center">
                  <DossierCalendarStatus currentUserRole={currentUserRole} status={entry.status} />
                  <div>
                    <p className="card-value text-brand-navy">{entry.title}</p>
                    <p className="card-description mt-1">{entry.detail}</p>
                  </div>
                  <p className="card-description">{dateText(entry.deadlineStart)} to {dateText(entry.deadlineEnd)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <p className="card-description">
        {internal ? `Viewing as ${currentUserRole}. Generated` : 'Record retrieved'} {new Date(dossier.generatedAt).toLocaleString('en-MY')}.
      </p>
    </div>
  );
};
