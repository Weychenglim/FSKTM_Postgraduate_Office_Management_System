/** @license SPDX-License-Identifier: Apache-2.0 */
import { PortalSelect } from './PortalSelect';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Gauge, UsersRound } from 'lucide-react';
import { RecordPage } from './RecordPage';
import {DecisionFeedbackProvider, useDecisionFeedback} from './DecisionFeedback';
import { PortalButton, StatusBadge, getStatusBadgeTone } from './PortalPrimitives';
import { ErrorState, LoadingState, EmptyState } from './StateViews';
import { getSupervisorWorkloads } from '../services';
import type { SupervisorWorkloadRecord } from '../types';
import { useExcelExport } from '../utils/useExcelExport';
import { capacityUtilization, capacityStateLabel } from '../utils/lecturerCapacity';
import { useReturnToFocusReload } from '../utils/returnToFocus';
import { useListState } from './ListState';
import { CoordinatorDataTable } from './CoordinatorBrowsePrimitives';
import { WorkspacePagination, WorkspaceSectionHeader, workspacePageSize } from './RequestWorkspacePrimitives';
import {WorkloadFact, WorkloadDetailSection, WorkloadLecturerOverview, WorkloadCapacityUsage, workloadBody} from './WorkloadDetailLayout';
import { WorkloadMonitoringSummary } from './WorkloadMonitoringSummary';

interface SupervisorWorkloadMonitoringProps {
  onBack: () => void;
  onOpenCapacity?: () => void;
  initialLecturerId?: string;
  backLabel?: string;
}

type WorkloadFilters = { search: string; department: string; status: string };
const stateOf = (record: SupervisorWorkloadRecord) => record.capacityState || record.availability;
const labelOf = (record: SupervisorWorkloadRecord) => record.capacityState ? capacityStateLabel(record.capacityState) : record.availability;
const configured = (record: SupervisorWorkloadRecord) => record.capacityState !== 'NOT_CONFIGURED' && Boolean(record.semesterCode) && record.capacityPlanVersion != null;

export function getSupervisorWorkloadPage(records: SupervisorWorkloadRecord[], filters: WorkloadFilters, requestedPage: number, requestedSize: number) {
  const search = filters.search.trim().toLowerCase();
  const filtered = records.filter(record => (!search || [record.lecturerName, record.lecturerId, record.department].some(value => value.toLowerCase().includes(search)))
    && (!filters.department || record.department === filters.department) && (!filters.status || stateOf(record) === filters.status));
  const size = workspacePageSize(requestedSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1), pageCount);
  const counts: Record<string, number> = {};
  for (const record of filtered) counts[stateOf(record)] = (counts[stateOf(record)] ?? 0) + 1;
  return { filtered, rows: filtered.slice((page - 1) * size, page * size), total: filtered.length, page, pageCount, size, counts };
}

export function SupervisorWorkloadDetails({ record }: { record: SupervisorWorkloadRecord }) {
  const hasConfiguration = configured(record);
  const occupied = record.workloadCount ?? (record.activeLoad ?? record.currentStudents) + (record.reservedLoad ?? 0);
  const supporting = record.supervisees.filter(student => student.supervisionRole === 'CO_SUPERVISOR').length;
  return <div className="space-y-7" data-workload-detail="supervisor">
    <WorkloadLecturerOverview name={record.lecturerName} status={labelOf(record)} tone={getStatusBadgeTone(stateOf(record))}>
        <WorkloadFact label="Department">{record.department || 'Not recorded'}</WorkloadFact>
        <WorkloadFact label="Email">{record.email ? <a href={`mailto:${record.email}`} className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">{record.email}</a> : 'Not recorded'}</WorkloadFact>
        <WorkloadFact label="Effective semester">{record.semesterCode || 'Not configured'}</WorkloadFact>
        <WorkloadFact label="Published policy">{record.capacityPlanVersion != null ? `Version ${record.capacityPlanVersion}` : 'Not configured'}</WorkloadFact>
        {record.unavailableUntil ? <WorkloadFact label="Unavailable until">{record.unavailableUntil}</WorkloadFact> : null}
    </WorkloadLecturerOverview>
    <WorkloadCapacityUsage configured={hasConfiguration} used={occupied} limit={record.workloadLimit} available={record.availableSlots}
      utilization={capacityUtilization(occupied, record.workloadLimit)} tone={getStatusBadgeTone(stateOf(record))} usedLabel="Active + reserved" capacityLabel="Supervisor capacity"
      breakdown={<><WorkloadFact label="Active appointments">{record.activeLoad ?? record.currentStudents}</WorkloadFact><WorkloadFact label="Reserved places">{record.reservedLoad ?? 0}</WorkloadFact><WorkloadFact label="Primary appointments">{record.supervisees.length - supporting}</WorkloadFact><WorkloadFact label="Supporting appointments">{supporting}</WorkloadFact></>} hint="Active primary and supporting appointments and accepted primary requests awaiting Coordinator approval count across semesters. Submission alone does not reserve a place."/>
    <WorkloadDetailSection title="Active supervisees" icon={UsersRound} count={record.supervisees.length}>
      {record.supervisees.length ? <div className="[&_td:nth-child(2)]:col-span-2"><CoordinatorDataTable label="Lecturer Supervisor workload items" columns={['Student', 'Research title', 'Programme', 'Supervision role', 'Appointed', 'Status']} rows={record.supervisees.map((student, index) => ({ key: `${student.id}:${student.supervisionRole}:${index}`, cells: [<><p className={workloadBody}>{student.name}</p><p className="text-xs leading-5 text-slate-500">{student.id}</p></>, <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{student.topic || 'Not recorded'}</p>, student.programme || 'Not recorded', student.supervisionRole === 'CO_SUPERVISOR' ? 'Supporting supervisor' : 'Primary supervisor', student.appointmentDate || 'Not recorded', <StatusBadge tone="success">{student.status}</StatusBadge>] }))} /></div>
        : <p className="rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">No active supervisees for this lecturer.</p>}
    </WorkloadDetailSection>
  </div>;
}

export const SupervisorWorkloadMonitoring: React.FC<SupervisorWorkloadMonitoringProps> = props => <DecisionFeedbackProvider scopeKey="supervisor-workload"><SupervisorWorkloadMonitoringContent {...props}/></DecisionFeedbackProvider>;

const SupervisorWorkloadMonitoringContent: React.FC<SupervisorWorkloadMonitoringProps> = ({ onBack, onOpenCapacity, initialLecturerId, backLabel = 'Back to Supervisor Appointments' }) => {
  const [records, setRecords] = useState<SupervisorWorkloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryLecturer = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('lecturer') || '';
  const [selectedId, setSelectedId] = useState(initialLecturerId || queryLecturer);
  const [search, setSearch] = useListState('SupervisorWorkloadMonitoring', 'search', '');
  const [department, setDepartment] = useListState('SupervisorWorkloadMonitoring', 'department', '');
  const [status, setStatus] = useListState('SupervisorWorkloadMonitoring', 'status', '');
  const [page, setPage] = useListState('SupervisorWorkloadMonitoring', 'page', 1);
  const [pageSize, setPageSize] = useListState('SupervisorWorkloadMonitoring', 'size', 10);
  const generation = useRef(0);
  const publishFeedback = useDecisionFeedback()!;
  const loadWorkloads = useCallback(async () => {
    const token = ++generation.current;
    setLoading(true); setError(null);
    try { const data = await getSupervisorWorkloads(); if (token === generation.current) setRecords(data); }
    catch (reason) { if (token === generation.current) setError(reason instanceof Error ? reason.message : 'Failed to load supervisor workload records.'); }
    finally { if (token === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { void loadWorkloads(); return () => { generation.current += 1; }; }, [loadWorkloads]);
  useEffect(() => { if (initialLecturerId || queryLecturer) setSelectedId(initialLecturerId || queryLecturer); }, [initialLecturerId, queryLecturer]);
  useReturnToFocusReload(() => { void loadWorkloads(); }, !loading);
  const browse = useMemo(() => getSupervisorWorkloadPage(records, { search, department, status }, page, pageSize), [records, search, department, status, page, pageSize]);
  const departments = Array.from(new Set(records.map(record => record.department).filter(Boolean))).sort();
  const states = Array.from(new Map(records.map(record => [stateOf(record), labelOf(record)]))).sort((a, b) => a[1].localeCompare(b[1]));
  const selected = records.find(record => record.lecturerId === selectedId);
  const actions = onOpenCapacity ? <PortalButton icon={Gauge} onClick={onOpenCapacity}>Manage Capacity</PortalButton> : undefined;
  const change = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  const excel = useExcelExport();
  const handleExportExcel = async () => {
    if (browse.filtered.length === 0) {
      publishFeedback('No supervisor workload records match the current filters.', 'info');
      return;
    }

    const exported = await excel.download('supervisor-workload-monitoring.xlsx', browse.filtered, [
      { header: 'Staff ID', value: (record) => record.lecturerId },
      { header: 'Lecturer Name', value: (record) => record.lecturerName },
      { header: 'Department', value: (record) => record.department },
      { header: 'Semester Code', value: (record) => record.semesterCode ?? '' },
      { header: 'Plan Version', value: (record) => record.capacityPlanVersion ?? '' },
      { header: 'Capacity State', value: (record) => record.capacityState ?? '' },
      { header: 'Active Load', value: (record) => record.currentStudents },
      { header: 'Active + Reserved', value: (record) => record.workloadCount ?? (record.activeLoad ?? record.currentStudents) + (record.reservedLoad ?? 0) },
      { header: 'Reserved Load', value: (record) => record.reservedLoad ?? 0 },
      { header: 'Available Slots', value: (record) => configured(record) ? record.availableSlots ?? '' : '' },
      { header: 'Unavailable Until', value: (record) => record.unavailableUntil ?? '' },
      { header: 'Current Students', value: (record) => record.currentStudents },
      { header: 'Workload Limit', value: (record) => configured(record) ? record.workloadLimit : '' },
      { header: 'Utilization Percent', value: (record) => configured(record) ? capacityUtilization(record.workloadCount ?? (record.activeLoad ?? record.currentStudents) + (record.reservedLoad ?? 0), record.workloadLimit) : '' },
      { header: 'Availability', value: (record) => labelOf(record) },
      { header: 'Primary Supervisees', value: (record) => record.supervisees.filter(student => student.supervisionRole !== 'CO_SUPERVISOR').length },
      { header: 'Co-Supervisees', value: (record) => record.supervisees.filter(student => student.supervisionRole === 'CO_SUPERVISOR').length },
      { header: 'Email', value: (record) => record.email },
      {
        header: 'Workload Items',
        value: (record) => record.supervisees
          .map((item) => `${item.supervisionRole === 'CO_SUPERVISOR' ? 'Supporting' : 'Primary'}: ${item.name} (${item.id}) - ${item.topic}`)
          .join(' | '),
      },
    ]);
    if (!exported) return;
    publishFeedback(`supervisor-workload-monitoring.xlsx prepared with ${browse.filtered.length} lecturers. Check your browser downloads.`, 'info');
  };

  if (selectedId) return <RecordPage title="Supervisor workload details" backLabel={initialLecturerId || queryLecturer ? backLabel : 'Back to Supervisor Workload Monitoring'} onBack={() => { setSelectedId(''); if (initialLecturerId || queryLecturer) onBack(); }} pageKey={initialLecturerId || queryLecturer ? undefined : `supervisor-workload:${selectedId}`} actions={actions}>
    {loading ? <LoadingState message="Loading supervisor workload records..." /> : error ? <ErrorState message={error} onRetry={() => void loadWorkloads()} /> : selected ? <SupervisorWorkloadDetails record={selected} /> : <EmptyState title="Lecturer workload not found" description="This lecturer is not present in the current authorised workload records." />}
  </RecordPage>;

  return <RecordPage title="Supervisor Workload Monitoring" subtitle="Current effective semester capacity and active primary and supporting appointments." backLabel={backLabel} onBack={onBack} actions={actions}>
    {!loading && !error ? <WorkloadMonitoringSummary kind="supervisor" records={browse.filtered} /> : null}
    <section aria-label="Supervisor workload workspace" className="office-workload-records min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      {excel.error?<p role="alert" className="card-description text-rose-700">{excel.error}</p>:null}
      <WorkspaceSectionHeader title="Supervisor workload records" description="Filters update immediately. Counts and exports cover all matching lecturers across pages." actions={<PortalButton onClick={()=>void handleExportExcel()} disabled={loading || !!error || excel.busy} isLoading={excel.busy} variant="primary" size="sm" icon={Download}>Export Excel</PortalButton>} />
      <div className="office-tool-filters rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="form-label min-w-0">Find a lecturer<input type="search" className="form-control form-control-sm mt-1" placeholder="Name, staff ID or department" value={search} onChange={event => change(setSearch)(event.target.value)} /></label>
          <label className="form-label min-w-0">Department<PortalSelect className="form-control form-control-sm mt-1" value={department} onChange={event => change(setDepartment)(event.target.value)}><option value="">All departments</option>{departments.map(value => <option key={value}>{value}</option>)}</PortalSelect></label>
          <label className="form-label min-w-0">Capacity state<PortalSelect className="form-control form-control-sm mt-1" value={status} onChange={event => change(setStatus)(event.target.value)}><option value="">All states</option>{states.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</PortalSelect></label>
        </div>
        <div className="mt-3 flex justify-end"><PortalButton size="sm" onClick={() => { setSearch(''); setDepartment(''); setStatus(''); setPage(1); }}>Clear filters</PortalButton></div>
      </div>
      {loading ? <LoadingState message="Loading supervisor workload records..." /> : error ? <ErrorState message={error} onRetry={() => void loadWorkloads()} /> : <>
        <div aria-label="Workload distribution" className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl bg-slate-50 p-3"><p className="card-description">{browse.total} matching of {records.length} lecturers</p>{Array.from(new Map(browse.filtered.map(record => [stateOf(record), labelOf(record)]))).map(([state, label]) => <p className="card-description" key={state}>{label}: {browse.filtered.filter(record => stateOf(record) === state).length}</p>)}</div>
        {browse.rows.length ? <CoordinatorDataTable label="Supervisor workload records" columns={['Lecturer', 'Department', 'Semester', 'Active appointments', 'Capacity', 'Availability', 'Action']} rows={browse.rows.map(record => ({ key: record.lecturerId, cells: [<p className="[overflow-wrap:anywhere]">{record.lecturerName}</p>, record.department || 'Not recorded', record.semesterCode || 'Not configured', <><p>{record.activeLoad ?? record.currentStudents} active · {record.reservedLoad ?? 0} reserved</p><p className="card-caption">{record.supervisees.filter(student => student.supervisionRole !== 'CO_SUPERVISOR').length} primary / {record.supervisees.filter(student => student.supervisionRole === 'CO_SUPERVISOR').length} supporting</p></>, configured(record) ? record.workloadLimit : 'Not configured', <StatusBadge tone={getStatusBadgeTone(stateOf(record))}>{labelOf(record)}</StatusBadge>, <PortalButton variant="secondary" size="sm" icon={Eye} aria-label={`View workload for ${record.lecturerName}`} onClick={() => setSelectedId(record.lecturerId)}>View</PortalButton>] }))} /> : <EmptyState title="No matching lecturers" description="No lecturer Supervisor workload records match the visible filters." />}
        <WorkspacePagination page={browse.page} pageCount={browse.pageCount} total={browse.total} pageSize={browse.size} noun="lecturers" onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }} />
      </>}
    </section>
  </RecordPage>;
};
