import React from 'react';
import {useSearchParams} from 'react-router';
import {Download} from 'lucide-react';
import {CoordinatorDataTable, CoordinatorFiltersBar, useCoordinatorFilters} from './CoordinatorBrowsePrimitives';
import {PortalButton, StatusBadge} from './PortalPrimitives';
import {PortalSelect} from './PortalSelect';
import {RecordPage} from './RecordPage';
import {EmptyState} from './StateViews';
import {useListState} from './ListState';
import {ProjectStageFilter, projectStageLabel} from './AttentionProjectStage';
import {AppointmentViewSwitch, WorkspacePagination, WorkspaceSectionHeader, workspacePageSize} from './RequestWorkspacePrimitives';
import {useExcelExport} from '../utils/useExcelExport';
import {formatRequestDisplayDate} from './ApprovalProcess';
import {panelRecordedDate, panelStatusLabel, panelStatusTone, type PanelPresentation} from '../utils/panelPresentation';
import {filterPanelAssignments, groupPanelAssignments, type PanelAssignmentFilters, type PanelAssignmentView} from '../utils/panelAssignments';

const displayDate = (value?: string | null) => formatRequestDisplayDate(panelRecordedDate(value));
const identity = (name: string, id: string) => <><p className="[overflow-wrap:anywhere]">{name || 'Not recorded'}</p>{id ? <p className="card-caption mt-1 [overflow-wrap:anywhere]">{id}</p> : null}</>;

function AssignmentList({scope, role, records, lecturer, initial = {}, onLecturer, onOpen}: {
  scope: string; role: 'office' | 'coordinator'; records: PanelPresentation[]; lecturer?: string;
  initial?: PanelAssignmentFilters; onLecturer: (key: string, filters: PanelAssignmentFilters) => void; onOpen: (record: PanelPresentation) => void;
}) {
  const [view, setView] = useListState<PanelAssignmentView>(scope, 'view', initial.view ?? 'current');
  const filters = useCoordinatorFilters(scope, initial.sort === 'newest' ? 'newest' : 'name', initial, true);
  const [projectStage, setProjectStage] = useListState(scope, 'projectStage', initial.projectStage ?? '');
  const excel = useExcelExport();
  const grouped = !lecturer;
  const base = filterPanelAssignments(records, {view, lecturer});
  const effectiveStatus = view === 'current' ? '' : filters.status;
  const projectSemester = base.find(row => row.projectSemester)?.projectSemester;
  const activeStage = view === 'current' && projectSemester ? projectStage : '';
  const assignmentParams = {...filters.params, status: effectiveStatus, projectStage: activeStage};
  const matching = filterPanelAssignments(records, {...assignmentParams, view, lecturer});
  const groups = groupPanelAssignments(matching);
  if (filters.sort === 'students') groups.sort((a, b) => b.studentCount - a.studentCount || a.name.localeCompare(b.name));
  if (filters.sort === 'newest') groups.sort((a, b) => String(panelRecordedDate(b.records[0]?.appointmentDate || b.records[0]?.coordinatorDecisionAt) || '')
    .localeCompare(String(panelRecordedDate(a.records[0]?.appointmentDate || a.records[0]?.coordinatorDecisionAt) || '')));
  const size = workspacePageSize(filters.size);
  const total = grouped ? groups.length : matching.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.max(1, Math.min(filters.page, pageCount));
  const facets = {programmes: [...new Set(base.map(row => row.programme).filter(Boolean))].sort(),
    semesters: [...new Set(base.map(row => row.semester || '').filter(Boolean))].sort(),
    statuses: [...new Set(base.map(row => row.appointmentLifecycle!.status))]};
  const exportMatching = () => excel.download('panel_assignments.xlsx', matching, [
    {header: 'Student', value: row => row.studentName}, {header: 'Matric number', value: row => row.studentId},
    {header: 'Programme', value: row => row.programme},
    ...(view === 'current' ? [
      {header: 'Project stage', value: (row: PanelPresentation) => projectStageLabel(row.projectStage)},
      {header: 'Project semester', value: (row: PanelPresentation) => row.projectSemester || ''},
    ] : []),
    {header: 'Semester', value: row => row.semester || ''},
    {header: 'Panel lecturer', value: row => row.recommendedMember}, {header: 'Staff number', value: row => row.recommendedMemberId},
    {header: 'Appointment status', value: row => panelStatusLabel(row.appointmentLifecycle!.status)},
    {header: 'Started on', value: row => displayDate(row.appointmentDate || row.coordinatorDecisionAt)},
    {header: 'Ended on', value: row => displayDate(row.appointmentLifecycle!.endedAt)},
    {header: 'Outcome', value: row => row.appointmentLifecycle!.endOutcome ? panelStatusLabel(row.appointmentLifecycle!.endOutcome!) : ''},
  ]);
  const changeView = (value: PanelAssignmentView) => {setView(value); filters.setStatus(''); filters.setFrom(''); filters.setTo(''); filters.setPage(1);};
  return <div className="space-y-5">
    <section aria-label="Panel assignments" className="appointment-workspace-card rounded-2xl border border-slate-200 bg-white shadow-sm">
      <WorkspaceSectionHeader title={lecturer ? 'Panel students' : grouped ? 'Panel lecturers' : 'Panel assignments'}
        description={`${view === 'current' ? 'Browse confirmed active Panel assignments' : 'Browse ended and completed Panel assignments'} ${role === 'coordinator' ? 'in your managed programmes' : 'across programmes'}. Counts reflect the selected filters.`} actions={<AppointmentViewSwitch view={view} onChange={changeView} currentLabel="Current" pastLabel="Past"/>}/>
      <CoordinatorFiltersBar filters={{...filters, status: effectiveStatus, reset: () => {filters.reset(); setProjectStage('');}}} extraFilters={view === 'current' && base.length > 0 ?
        <ProjectStageFilter includeOtherStates value={activeStage} onChange={filters.change(setProjectStage)} semester={projectSemester}/> : undefined} facets={facets} includeEndDate={false} showStatus={view === 'past'} statusFieldLabel="Appointment status" includeStatusAndDates statusLabel={panelStatusLabel} dateLabel="Started"
        searchLabel="Find a student or Panel lecturer" searchPlaceholder="Student, matric number, lecturer or staff number"
        sortOptions={grouped ? [['name', 'Lecturer name'], ['students', 'Most students'], ['newest', 'Newest assignment']] : [['name', 'Student name'], ['newest', 'Newest assignment']]}
        actions={<PortalButton variant="primary" size="sm" icon={Download} disabled={!matching.length || excel.busy} isLoading={excel.busy}
          title="Download all matching assignments across every page" onClick={() => void exportMatching()}>Export Excel</PortalButton>}/>
      {excel.error ? <p role="alert" className="card-description text-rose-700">{excel.error}</p> : null}
      {!total ? <p role="status" className="card-description py-6 text-center">{filters.q || filters.programme || filters.semester || effectiveStatus || activeStage || filters.from || filters.to
        ? 'No matching assignments. Adjust the filters to see more records.' : view === 'current' ? 'No current Panel assignments.' : 'No past Panel assignments.'}</p>
        : grouped ? <CoordinatorDataTable label="Panel lecturers and their students" columns={['Panel lecturer', view === 'current' ? 'Active students' : 'Students', ...(view === 'past' ? ['Past assignments'] : []), 'Action']}
          rows={groups.slice((page - 1) * size, page * size).map(group => ({key: group.key, cells: [identity(group.name, group.staffNo), group.studentCount,
            ...(view === 'past' ? [group.assignmentCount] : []), <PortalButton size="sm" className="min-h-11" aria-label={`View students for ${group.name}`}
              onClick={() => onLecturer(group.key, {...assignmentParams, view})}>View students</PortalButton>]}))}/>
        : <CoordinatorDataTable label="Panel student assignments" columns={['Student', 'Programme', ...(view === 'current' ? ['Project stage'] : []), 'Panel lecturer', 'Appointment status', 'Started on', ...(view === 'past' ? ['Ended on', 'Outcome'] : []), 'Action']}
          rows={matching.slice((page - 1) * size, page * size).map(row => ({key: row.appointmentLifecycle!.appointmentId, cells: [identity(row.studentName, row.studentId), row.programme || 'Not recorded',
            ...(view === 'current' ? [projectStageLabel(row.projectStage)] : []), identity(row.recommendedMember, row.recommendedMemberId), <StatusBadge tone={panelStatusTone(row.appointmentLifecycle!.status)}>{panelStatusLabel(row.appointmentLifecycle!.status)}</StatusBadge>,
            displayDate(row.appointmentDate || row.coordinatorDecisionAt), ...(view === 'past' ? [displayDate(row.appointmentLifecycle!.endedAt), row.appointmentLifecycle!.endOutcome ? panelStatusLabel(row.appointmentLifecycle!.endOutcome!) : 'Not recorded'] : []),
            <PortalButton size="sm" className="min-h-11" aria-label={`View appointment for ${row.studentName}`} onClick={() => onOpen(row)}>View appointment</PortalButton>]}))}/>}
      <WorkspacePagination page={page} pageCount={pageCount} total={total} pageSize={size} noun={grouped ? 'lecturers' : 'assignments'}
        onPage={filters.setPage} onPageSize={value => {filters.setSize(value); filters.setPage(1);}}/>
    </section>
  </div>;
}

/** The hosts supply authorised records; this view never queries the Office-only workload API. */
export function PanelAssignmentsWorkspace({role, records, onOpen, suspended = false}: {
  role: 'office' | 'coordinator'; records: PanelPresentation[]; onOpen: (record: PanelPresentation) => void; suspended?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const lecturer = params.get('panelLecturer') || undefined;
  const scope = `PanelAssignments:${role}`;
  const [source, setSource] = useListState<PanelAssignmentFilters>(scope, 'source', {});
  const onLecturer = (key: string, filters: PanelAssignmentFilters) => {
    setSource(filters);
    setParams(current => {const next = new URLSearchParams(current); next.set('panelLecturer', key); return next;});
  };
  const back = () => setParams(current => {const next = new URLSearchParams(current); next.delete('panelLecturer'); return next;}, {replace: true});
  if (suspended) return null;
  if (lecturer) {
    const group = groupPanelAssignments([...filterPanelAssignments(records), ...filterPanelAssignments(records, {view: 'past'})]).find(row => row.key === lecturer);
    return <RecordPage title={group?.name || 'Panel lecturer'} subtitle={group?.staffNo ? `Staff number: ${group.staffNo}` : undefined} backLabel="Back to Panel assignments" onBack={back}>
      {group ? <AssignmentList key={`${lecturer}:${JSON.stringify(source)}`} scope={`${scope}:${lecturer}:${JSON.stringify(source)}`} role={role} records={records}
        lecturer={lecturer} initial={source} onLecturer={onLecturer} onOpen={onOpen}/>
        : <EmptyState title="Panel lecturer unavailable" description="No authorised assignments were found for this lecturer."/>}
    </RecordPage>;
  }
  return <AssignmentList key="all" scope={scope} role={role} records={records} onLecturer={onLecturer} onOpen={onOpen}/>;
}
