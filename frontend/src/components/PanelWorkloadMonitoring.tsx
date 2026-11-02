/** @license SPDX-License-Identifier: Apache-2.0 */
import { PortalSelect } from './PortalSelect';
import { OfficeMonitoringNotice, useOfficeMonitoring } from './OfficeMonitoringContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Gauge, ClipboardList } from 'lucide-react';
import { RecordPage } from './RecordPage';
import {DecisionFeedbackProvider, useDecisionFeedback} from './DecisionFeedback';
import { PortalButton, StatusBadge, getStatusBadgeTone } from './PortalPrimitives';
import { ErrorState, LoadingState, EmptyState } from './StateViews';
import { getPanelWorkloads } from '../services';
import type { PanelWorkloadRecord } from '../types';
import { useExcelExport } from '../utils/useExcelExport';
import { getPanelWorkloadUtilization } from '../utils/panelWorkloadRecords';
import { capacityStateLabel } from '../utils/lecturerCapacity';
import { useReturnToFocusReload } from '../utils/returnToFocus';
import { useListState } from './ListState';
import { CoordinatorDataTable } from './CoordinatorBrowsePrimitives';
import { WorkspacePagination, WorkspaceSectionHeader, workspacePageSize } from './RequestWorkspacePrimitives';
import {WorkloadFact, WorkloadDetailSection, WorkloadLecturerOverview, WorkloadCapacityUsage, workloadBody} from './WorkloadDetailLayout';
import { WorkloadMonitoringSummary } from './WorkloadMonitoringSummary';

interface PanelWorkloadMonitoringProps {
  onBack: () => void;
  onOpenCapacity?: () => void;
  initialLecturerId?: string;
  backLabel?: string;
}

type WorkloadFilters = { search: string; department: string; status: string };
const stateOf = (record: PanelWorkloadRecord) => record.capacityState || record.availability;
const labelOf = (record: PanelWorkloadRecord) => record.capacityState ? capacityStateLabel(record.capacityState) : record.availability;
const configured = (record: PanelWorkloadRecord) => record.capacityState !== 'NOT_CONFIGURED' && Boolean(record.semesterCode) && record.capacityPlanVersion != null;

export function getPanelWorkloadPage(records: PanelWorkloadRecord[], filters: WorkloadFilters, requestedPage: number, requestedSize: number) {
  const search = filters.search.trim().toLowerCase();
  const filtered = records.filter(record => (!search || [record.name, record.id, record.department].some(value => value.toLowerCase().includes(search)))
    && (!filters.department || record.department === filters.department) && (!filters.status || stateOf(record) === filters.status));
  const size = workspacePageSize(requestedSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1), pageCount);
  return { filtered, rows: filtered.slice((page - 1) * size, page * size), total: filtered.length, page, pageCount, size };
}

export function PanelWorkloadDetails({ record }: { record: PanelWorkloadRecord }) {
  const hasConfiguration = configured(record);
  return <div className="space-y-7" data-workload-detail="panel">
    <WorkloadLecturerOverview name={record.name} status={labelOf(record)} tone={getStatusBadgeTone(stateOf(record))}>
        <WorkloadFact label="Department">{record.department || 'Not recorded'}</WorkloadFact>
        <WorkloadFact label="Effective semester">{record.semesterCode || 'Not configured'}</WorkloadFact>
        <WorkloadFact label="Published policy">{record.capacityPlanVersion != null ? `Version ${record.capacityPlanVersion}` : 'Not configured'}</WorkloadFact>
        {record.unavailableUntil ? <WorkloadFact label="Unavailable until">{record.unavailableUntil}</WorkloadFact> : null}
    </WorkloadLecturerOverview>
    <WorkloadCapacityUsage configured={hasConfiguration} used={record.currentStudents} limit={record.workloadLimit} available={record.availableSlots}
      utilization={getPanelWorkloadUtilization(record)} tone={getStatusBadgeTone(stateOf(record))} usedLabel="Active + reserved" capacityLabel="Panel capacity"
      breakdown={<><WorkloadFact label="Active appointments">{record.confirmedAppointments}</WorkloadFact><WorkloadFact label="Pending reservations">{record.pendingNominations}</WorkloadFact></>} hint="Active appointments and accepted nominations awaiting Coordinator approval count across semesters. Approval converts a reservation into an appointment without using another slot."/>
    <WorkloadDetailSection title="Workload items" icon={ClipboardList} count={record.workloadItems.length}>
      {record.workloadItems.length ? <div className="[&_td:nth-child(2)]:col-span-2"><CoordinatorDataTable label="Lecturer Panel workload items" columns={['Student', 'Research title', 'Workload type', 'Recorded date']} rows={record.workloadItems.map((item, index) => ({ key: `${item.type}:${item.studentId}:${index}`, cells: [<><p className={workloadBody}>{item.studentName}</p><p className="text-xs leading-5 text-slate-500">{item.studentId}</p></>, <p className={`${workloadBody} whitespace-pre-wrap [overflow-wrap:anywhere]`}>{item.researchTitle || 'Not recorded'}</p>, <StatusBadge tone={item.type === 'Confirmed Appointment' ? 'success' : 'warning'}>{item.type === 'Confirmed Appointment' ? 'Active appointment' : 'Pending reservation'}</StatusBadge>, <p className="text-xs leading-5 text-slate-500">{item.date || 'Not recorded'}</p>] }))} /></div>
        : <p className="rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">No active appointments or pending nominations for this lecturer.</p>}
    </WorkloadDetailSection>
  </div>;
}

export const PanelWorkloadMonitoring: React.FC<PanelWorkloadMonitoringProps> = props => <DecisionFeedbackProvider scopeKey="panel-workload"><PanelWorkloadMonitoringContent {...props}/></DecisionFeedbackProvider>;

const PanelWorkloadMonitoringContent: React.FC<PanelWorkloadMonitoringProps> = ({ onBack, onOpenCapacity, initialLecturerId, backLabel = 'Back to Panel Appointments' }) => {
  const [allRecords, setRecords] = useState<PanelWorkloadRecord[]>([]);
  const monitoring = useOfficeMonitoring();
  const records = useMemo(() => monitoring?.view === 'panel-capacity' ? allRecords.filter(row => row.capacityState === 'FULL' || row.capacityState === 'OVER_CAPACITY') : allRecords, [allRecords, monitoring?.view]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryLecturer = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('lecturer') || '';
  const [selectedId, setSelectedId] = useState(initialLecturerId || queryLecturer);
  const [search, setSearch] = useListState('PanelWorkloadMonitoring', 'search', '');
  const [department, setDepartment] = useListState('PanelWorkloadMonitoring', 'department', '');
  const [status, setStatus] = useListState('PanelWorkloadMonitoring', 'status', '');
  const [page, setPage] = useListState('PanelWorkloadMonitoring', 'page', 1);
  const [pageSize, setPageSize] = useListState('PanelWorkloadMonitoring', 'size', 10);
  const generation = useRef(0);
  const publishFeedback = useDecisionFeedback()!;
  const loadWorkloads = useCallback(async () => {
    const token = ++generation.current;
    setLoading(true); setError(null);
    try { const data = await getPanelWorkloads(); if (token === generation.current) setRecords(data); }
    catch (reason) { if (token === generation.current) setError(reason instanceof Error ? reason.message : 'Failed to load panel workload records.'); }
    finally { if (token === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { void loadWorkloads(); return () => { generation.current += 1; }; }, [loadWorkloads]);
  useEffect(() => { if (initialLecturerId || queryLecturer) setSelectedId(initialLecturerId || queryLecturer); }, [initialLecturerId, queryLecturer]);
  useReturnToFocusReload(() => { void loadWorkloads(); }, !loading);
  const browse = useMemo(() => getPanelWorkloadPage(records, { search, department, status }, page, pageSize), [records, search, department, status, page, pageSize]);
  const departments = Array.from(new Set(records.map(record => record.department).filter(Boolean))).sort();
  const states = Array.from(new Map(records.map(record => [stateOf(record), labelOf(record)]))).sort((a, b) => a[1].localeCompare(b[1]));
  const selected = records.find(record => record.id === selectedId);
  const actions = onOpenCapacity ? <PortalButton icon={Gauge} onClick={onOpenCapacity}>Manage Capacity</PortalButton> : undefined;
  const change = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  const excel = useExcelExport();
  const handleExportExcel = async () => {
    if (browse.filtered.length === 0) {
      publishFeedback('No panel workload records match the current filters.', 'info');
      return;
    }

    const exported = await excel.download('panel_workload_monitoring_report.xlsx', browse.filtered, [
      { header: 'Staff ID', value: (record) => record.id },
      { header: 'Lecturer Name', value: (record) => record.name },
      { header: 'Department', value: (record) => record.department },
      { header: 'Semester Code', value: (record) => record.semesterCode ?? '' },
      { header: 'Plan Version', value: (record) => record.capacityPlanVersion ?? '' },
      { header: 'Capacity State', value: (record) => record.capacityState ?? '' },
      { header: 'Active Load', value: (record) => record.confirmedAppointments },
      { header: 'Reserved Load', value: (record) => record.pendingNominations },
      { header: 'Available Slots', value: (record) => configured(record) ? record.availableSlots ?? '' : '' },
      { header: 'Unavailable Until', value: (record) => record.unavailableUntil ?? '' },
      { header: 'Reserved Panel Seats', value: (record) => record.currentStudents },
      { header: 'Workload Limit', value: (record) => configured(record) ? record.workloadLimit : '' },
      { header: 'Utilization Percent', value: (record) => configured(record) ? getPanelWorkloadUtilization(record) : '' },
      { header: 'Availability', value: (record) => labelOf(record) },
      { header: 'Confirmed Appointments', value: (record) => record.confirmedAppointments },
      { header: 'Pending Nominations', value: (record) => record.pendingNominations },
      {
        header: 'Workload Items',
        value: (record) => record.workloadItems
          .map((item) => `${item.type}: ${item.studentName} (${item.studentId}) - ${item.researchTitle}`)
          .join(' | '),
      },
    ]);
    if (!exported) return;
    publishFeedback(`panel_workload_monitoring_report.xlsx prepared with ${browse.filtered.length} lecturers. Check your browser downloads.`, 'info');
  };

  if (selectedId) return <RecordPage title="Panel workload details" backLabel={initialLecturerId || queryLecturer ? backLabel : 'Back to Panel Workload Monitoring'} onBack={() => { setSelectedId(''); if (initialLecturerId || queryLecturer) onBack(); }} pageKey={initialLecturerId || queryLecturer ? undefined : `panel-workload:${selectedId}`} actions={actions}>
    {loading ? <LoadingState message="Loading panel workload records..." /> : error ? <ErrorState message={error} onRetry={() => void loadWorkloads()} /> : selected ? <PanelWorkloadDetails record={selected} /> : <EmptyState title="Lecturer workload not found" description="This lecturer is not present in the current authorised workload records." />}
  </RecordPage>;

  return <RecordPage title="Panel Workload Monitoring" subtitle="Current effective semester capacity, active appointments and pending reservations." backLabel={backLabel} onBack={onBack} actions={actions}>
    <OfficeMonitoringNotice />
    {!loading && !error ? <WorkloadMonitoringSummary kind="panel" records={browse.filtered} /> : null}
    <section aria-label="Panel workload workspace" className="office-workload-records min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      {excel.error?<p role="alert" className="card-description text-rose-700">{excel.error}</p>:null}
      <WorkspaceSectionHeader title="Panel workload records" description="Filters update immediately. Counts and exports cover all matching lecturers across pages." actions={<PortalButton onClick={()=>void handleExportExcel()} disabled={loading || !!error || excel.busy} isLoading={excel.busy} variant="primary" size="sm" icon={Download}>Export Excel</PortalButton>} />
      <div className="office-tool-filters rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="form-label min-w-0">Find a lecturer<input type="search" className="form-control form-control-sm mt-1" placeholder="Name, staff ID or department" value={search} onChange={event => change(setSearch)(event.target.value)} /></label>
          <label className="form-label min-w-0">Department<PortalSelect className="form-control form-control-sm mt-1" value={department} onChange={event => change(setDepartment)(event.target.value)}><option value="">All departments</option>{departments.map(value => <option key={value}>{value}</option>)}</PortalSelect></label>
          <label className="form-label min-w-0">Capacity state<PortalSelect className="form-control form-control-sm mt-1" value={status} onChange={event => change(setStatus)(event.target.value)}><option value="">All states</option>{states.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</PortalSelect></label>
        </div>
        <div className="mt-3 flex justify-end"><PortalButton size="sm" onClick={() => { setSearch(''); setDepartment(''); setStatus(''); setPage(1); }}>Clear filters</PortalButton></div>
      </div>
      {loading ? <LoadingState message="Loading panel workload records..." /> : error ? <ErrorState message={error} onRetry={() => void loadWorkloads()} /> : <>
        <div aria-label="Workload distribution" className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl bg-slate-50 p-3"><p className="card-description">{browse.total} matching of {records.length} lecturers</p>{Array.from(new Map(browse.filtered.map(record => [stateOf(record), labelOf(record)]))).map(([state, label]) => <p className="card-description" key={state}>{label}: {browse.filtered.filter(record => stateOf(record) === state).length}</p>)}</div>
        {browse.rows.length ? <CoordinatorDataTable label="Panel workload records" columns={['Lecturer', 'Department', 'Semester', 'Active + reserved', 'Capacity', 'Availability', 'Action']} rows={browse.rows.map(record => ({ key: record.id, cells: [<p className="[overflow-wrap:anywhere]">{record.name}</p>, record.department || 'Not recorded', record.semesterCode || 'Not configured', <><p>{record.currentStudents} total</p><p className="card-caption">{record.confirmedAppointments} active · {record.pendingNominations} reserved</p></>, configured(record) ? record.workloadLimit : 'Not configured', <StatusBadge tone={getStatusBadgeTone(stateOf(record))}>{labelOf(record)}</StatusBadge>, <PortalButton variant="secondary" size="sm" icon={Eye} aria-label={`View workload for ${record.name}`} onClick={() => setSelectedId(record.id)}>View</PortalButton>] }))} /> : <EmptyState title="No matching lecturers" description="No lecturer Panel workload records match the visible filters." />}
        <WorkspacePagination page={browse.page} pageCount={browse.pageCount} total={browse.total} pageSize={browse.size} noun="lecturers" onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }} />
      </>}
    </section>
  </RecordPage>;
};
