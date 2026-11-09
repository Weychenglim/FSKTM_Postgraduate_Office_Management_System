import { useSearchParams } from 'react-router';
import { WorkspaceFilterCard } from './RequestWorkspacePrimitives';
import { MarksHeading } from './MarksPrimitives';
import { PortalSelect } from './PortalSelect';
import { OfficeMonitoringNotice, useOfficeMonitoring } from './OfficeMonitoringContext';
import { filterMonitoringMarks } from '../utils/officeMonitoring';
import { useListState } from './ListState';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  Files,
  Download,
} from 'lucide-react';
import { PageHeader, PortalButton } from './PortalPrimitives';
import { LoadingState, ErrorState } from './StateViews';
import { MarkRecord } from '../types';
import { getMarkRecords, getMarksExport } from '../services';
import {
  filterMarkRecordsByStatusTab,
  MarkRecordStatusTab,
} from '../utils/markRecords';
import { formatDeadlineText } from '../utils/workflowAgeing';

interface MarkEntryRecordsProps {
  onBack: () => void;
  backLabel?: string;
  onViewRecordDetail: (recordId: string) => void;
  onNavigateToDossier?: (studentId: string) => void;
  initialStatusTab?: MarkRecordStatusTab;
}

export const MarkEntryRecords: React.FC<MarkEntryRecordsProps> = ({
  onBack,
  backLabel = 'Back to Marks overview',
  onViewRecordDetail,
  onNavigateToDossier,
  initialStatusTab: requestedStatusTab = 'All Records',
}) => {
  const [scopeParams, setScopeParams] = useSearchParams();
  const periodScope = scopeParams.get('period');
  const semesterScope = scopeParams.get('semester');
  const statusScope = scopeParams.get('status');
  const [allRecords, setRecords] = useState<MarkRecord[]>([]);
  const monitoring = useOfficeMonitoring();
  const initialStatusTab = monitoring ? 'All Records' : (['All Records', 'Submitted', 'Draft Saved', 'Not Started', 'Overdue'].includes(statusScope ?? '') ? statusScope as MarkRecordStatusTab : requestedStatusTab);
  const records = useMemo(() => filterMonitoringMarks(allRecords, monitoring?.view ?? null).filter(record => (!periodScope || String(record.periodId) === periodScope) && (!semesterScope || record.semester === semesterScope) && (!(periodScope || semesterScope) || ((!record.taskLifecycleStatus || record.taskLifecycleStatus === 'ACTIVE') && !['DRAFT', 'ARCHIVED'].includes(record.periodLifecycleStatus ?? '')))), [allRecords, monitoring?.view, periodScope, semesterScope]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportPending = React.useRef(false);

  const loadRecords = useCallback(() => {
    setLoading(true);
    setError(null);
    getMarkRecords()
      .then(setRecords)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load mark records.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Live filters retained in the authenticated shell.
  const [searchQuery, setSearchQuery] = useListState('MarkEntryRecords', 'searchQuery', '');
  const [programmeFilter, setProgrammeFilter] = useListState('MarkEntryRecords', 'programmeFilter', 'All Programmes');
  const [semesterFilter, setSemesterFilter] = useListState('MarkEntryRecords', 'semesterFilter', 'All Semesters');
  const [panelFilter, setPanelFilter] = useListState('MarkEntryRecords', 'panelFilter', 'All Members');

  // One status filter, retained in authenticated-shell list memory.
  const [activeTab, setActiveTab] = useListState<MarkRecordStatusTab>('MarkEntryRecords', 'activeTab', initialStatusTab);

  // Retain only the legacy status fallback from the former explicit-Apply UI.
  const [legacyFilters, setLegacyFilters] = useListState('MarkEntryRecords', 'appliedFilters', { status: 'All Statuses' });

  // Current page
  const [currentPage, setCurrentPage] = useListState('MarkEntryRecords', 'currentPage', 1);
  const itemsPerPage = 5;

  const [routeStatus, setRouteStatus] = useListState('MarkEntryRecords', 'routeStatus', initialStatusTab);
  useEffect(() => {
    if (routeStatus !== initialStatusTab) { setActiveTab(initialStatusTab); setCurrentPage(1); }
    setRouteStatus(initialStatusTab);
  }, [initialStatusTab, routeStatus, setActiveTab, setCurrentPage, setRouteStatus]);

  const scopeKey = `${periodScope ?? ''}|${semesterScope ?? ''}|${statusScope ?? ''}`;
  const [lastScope, setLastScope] = useListState('MarkEntryRecords', 'overviewScope', '');
  useEffect(() => {
    if (lastScope === scopeKey) return;
    if (periodScope || semesterScope || statusScope) {
      setSearchQuery(''); setProgrammeFilter('All Programmes'); setSemesterFilter('All Semesters');
      setPanelFilter('All Members'); setActiveTab(initialStatusTab); setCurrentPage(1);
      setLegacyFilters({ status: 'All Statuses' });
    }
    setLastScope(scopeKey);
  }, [scopeKey, lastScope, periodScope, semesterScope, statusScope, initialStatusTab, setLastScope,
    setSearchQuery, setProgrammeFilter, setSemesterFilter, setPanelFilter, setActiveTab, setCurrentPage, setLegacyFilters]);

  // Preserve a previously applied dropdown status when returning from older list state.
  const selectedStatus: MarkRecordStatusTab = activeTab !== 'All Records' ? activeTab
    : legacyFilters.status === 'Draft' ? 'Draft Saved'
    : ['Submitted', 'Not Started', 'Overdue'].includes(legacyFilters.status)
      ? legacyFilters.status as MarkRecordStatusTab : 'All Records';
  const statusFilters = (['All Records', 'Submitted', 'Draft Saved', 'Not Started', 'Overdue'] as const)
    .map(key => ({ key, count: filterMarkRecordsByStatusTab(records, key).length }));
  const hasFilters = !!periodScope || !!semesterScope || selectedStatus !== 'All Records' || !!searchQuery
    || programmeFilter !== 'All Programmes' || semesterFilter !== 'All Semesters'
    || panelFilter !== 'All Members';
  const clearFilters = () => {
    setSearchQuery(''); setProgrammeFilter('All Programmes'); setSemesterFilter('All Semesters');
    setPanelFilter('All Members'); setActiveTab('All Records'); setCurrentPage(1);
    setLegacyFilters({ status: 'All Statuses' });
    setScopeParams({ status: 'All Records' });
  };
  const programmeOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.programme))).filter(Boolean).sort(),
    [records],
  );
  const semesterOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.semester))).filter(Boolean).sort(),
    [records],
  );
  const evaluatorOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.panelMember))).filter(Boolean).sort(),
    [records],
  );

  // Derived filtered dataset matching active constraints
  const filteredRecords = useMemo(() => {
    return filterMarkRecordsByStatusTab(records, selectedStatus).filter(rec => {
      // 1. Text Search matching student name, student ID, panel member, or research title
      const searchText = searchQuery.toLowerCase();
      if (searchText) {
        const matchesStudentName = rec.studentName.toLowerCase().includes(searchText);
        const matchesStudentID = rec.studentId.toLowerCase().includes(searchText);
        const matchesPanel = rec.panelMember.toLowerCase().includes(searchText);
        const matchesTitle = rec.researchTitle.toLowerCase().includes(searchText);
        if (!matchesStudentName && !matchesStudentID && !matchesPanel && !matchesTitle) {
          return false;
        }
      }

      // 2. Programme filter
      if (programmeFilter !== 'All Programmes' && rec.programme !== programmeFilter) {
        return false;
      }

      // 3. Semester filter
      if (semesterFilter !== 'All Semesters' && rec.semester !== semesterFilter) {
        return false;
      }

      // 4. Panel Member filter
      if (panelFilter !== 'All Members' && rec.panelMember !== panelFilter) {
        return false;
      }

      return true;
    });
  }, [records, searchQuery, programmeFilter, semesterFilter, panelFilter, selectedStatus]);

  // Pagination indexing calculations
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  useEffect(() => {
    if (!loading && !error && currentPage > totalPages) setCurrentPage(totalPages);
  }, [loading, error, currentPage, totalPages, setCurrentPage]);
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const downloadExcel = async () => {
    if (exportPending.current || !filteredRecords.length) return;
    exportPending.current = true;
    setExporting(true);
    setExportError(null);
    try {
      const scope = [
        `Status: ${selectedStatus}`, `Programme: ${programmeFilter}`,
        `Semester: ${semesterScope ?? semesterFilter}`, `Evaluator: ${panelFilter}`,
        periodScope ? `Period: ${records.find(record => String(record.periodId) === periodScope)?.periodName ?? periodScope}` : '',
        searchQuery ? `Search: ${searchQuery}` : '',
        monitoring ? `Monitoring: ${monitoring.view}` : '',
      ].filter(Boolean).join('; ');
      const blob = await getMarksExport(filteredRecords.map(record => record.id), scope);
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'marks_records.xlsx';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally { URL.revokeObjectURL(url); }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Could not download marks. Please try again.');
    } finally {
      exportPending.current = false;
      setExporting(false);
    }
  };

  return (
    <div id="mark-entry-records-dashboard" className="marks-workspace space-y-5 text-left relative">

      {/* Breadcrumb back link & Title header */}
      <PageHeader
        title="Mark Entry Records"
        subtitle="Find evaluation records and review submission progress."
        backLabel={backLabel}
        onBack={onBack}
        subtitleClassName="leading-relaxed"
        actions={<PortalButton variant="primary" size="sm" icon={Download} isLoading={exporting}
          title="Download all matching records across every page as Excel" onClick={downloadExcel}
          disabled={loading || !!error || exporting || !filteredRecords.length}>
          Export Excel
        </PortalButton>}
      />

      <p className="text-sm text-slate-500" aria-live="polite">
        Excel includes all {filteredRecords.length} matching records across every page. Submitted marks only; incomplete evaluations are listed separately.
      </p>
      {exportError && <p role="alert" className="text-sm text-red-600">{exportError}</p>}

      <OfficeMonitoringNotice />

      <div id="mark-records-table-container" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-3xs">
        <div id="records-filters-card" className="space-y-4 p-5 md:p-6">
          <MarksHeading icon={Files}>Mark records</MarksHeading>
          {periodScope && <p className="card-description">Period: {records.find(record => record.periodName)?.periodName ?? 'Selected period'}</p>}
          <WorkspaceFilterCard onReset={clearFilters}
            fieldsClassName="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label htmlFor="records-search" className="form-label min-w-0 sm:col-span-2">Search records
                <span className="relative mt-1 block">
                  <Search aria-hidden="true" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input id="records-search" type="search" value={searchQuery} onChange={event => { setSearchQuery(event.target.value); setCurrentPage(1); }}
                    placeholder="Student, ID, evaluator or research title" className="form-control form-control-sm pl-10 pr-4" />
                </span>
              </label>
              <label className="form-label min-w-0">Status
                <PortalSelect aria-label="Record status" className="form-control form-control-sm mt-1" value={selectedStatus} disabled={loading || !!error}
                  onChange={event => { setActiveTab(event.target.value as MarkRecordStatusTab); setLegacyFilters(previous => ({ ...previous, status: 'All Statuses' })); setCurrentPage(1); }}>
                  {statusFilters.map(({ key, count }) => <option key={key} value={key}>{key} ({loading || error ? '—' : count})</option>)}
                </PortalSelect>
              </label>
              <label className="form-label min-w-0">Programme
                <PortalSelect aria-label="Programme" value={programmeFilter} onChange={event => { setProgrammeFilter(event.target.value); setCurrentPage(1); }} className="form-control form-control-sm mt-1">
                  <option value="All Programmes">All Programmes</option>
                  {programmeOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </PortalSelect>
              </label>
              <label className="form-label min-w-0">Semester
                <PortalSelect aria-label="Semester" value={semesterFilter} onChange={event => { setSemesterFilter(event.target.value); setCurrentPage(1); }} className="form-control form-control-sm mt-1">
                  <option value="All Semesters">All Semesters</option>
                  {semesterOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </PortalSelect>
              </label>
              <label className="form-label min-w-0">Evaluator
                <PortalSelect aria-label="Evaluator" value={panelFilter} onChange={event => { setPanelFilter(event.target.value); setCurrentPage(1); }} className="form-control form-control-sm mt-1">
                  <option value="All Members">All Members</option>
                  {evaluatorOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </PortalSelect>
              </label>
          </WorkspaceFilterCard>
        </div>

        {loading ? (
          <LoadingState message="Loading mark records…" />
        ) : error ? (
          <ErrorState message={error} onRetry={loadRecords} />
        ) : (
        <>
        {filteredRecords.length === 0 ? (
          <div className="mx-5 mb-5 rounded-xl bg-slate-50 px-4 py-6 md:mx-6 md:mb-6">
            <h3 className="text-sm font-semibold text-brand-navy">{records.length === 0 ? monitoring ? 'No records in this monitoring view' : 'No mark records yet' : 'No records match your filters'}</h3>
            <p className="card-description mt-1">{records.length === 0 ? monitoring ? 'No assignments currently match this dashboard view. Clear the monitoring view to see other records.' : 'Records appear once evaluation tasks are generated.' : 'Try a different search or clear the filters to see all records in this view.'}</p>
          </div>
        ) : <>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 md:px-6" role="status">
          <p className="text-sm font-semibold text-brand-navy">{filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'} found</p>
          {hasFilters && <span className="card-caption">Filters applied</span>}
        </div>
        <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600" role="region" aria-label="Mark record results" tabIndex={0}>
          <table data-mark-record-table className="data-table mark-record-results">
            <caption className="sr-only">Mark records matching the selected status and search filters</caption>
            <thead>
              <tr className="data-thead bg-slate-50/30">
                <th scope="col" className="data-th">Student</th>
                <th scope="col" className="data-th">Research title</th>

                <th scope="col" className="data-th">Evaluator</th>
                <th scope="col" className="data-th">Deadline</th>

                <th scope="col" className="data-th text-center">Mark &amp; status</th>
                <th scope="col" className="data-th">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {paginatedRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-55/40 transition-colors">

                    <td className="data-td">
                      <span className="mark-record-student">{rec.studentName}</span>
                      <span className="mark-record-secondary">{rec.studentId}</span>
                    </td>
                    <td className="data-td">
                      <p className="mark-record-research" title={rec.researchTitle}>{rec.researchTitle}</p>
                    </td>

                    {/* Panel member examiner */}
                    <td className="data-td">
                      <span className="mark-record-main-line">{rec.panelMember}</span>
                      {rec.evaluatorRoleLabel && <span className="mark-record-sub-line">{rec.evaluatorRoleLabel}</span>}
                    </td>

                    <td className={`data-td ${rec.deadlineState === 'OVERDUE' ? 'text-rose-600' : ''}`}>
                      <span className="mark-record-main-line">{formatDeadlineText(rec)}</span>
                      {rec.dueAt && (
                        <span className="mark-record-sub-line">
                          {new Date(rec.dueAt).toLocaleDateString()}
                        </span>
                      )}
                    </td>

                    {/* Styled Status badge */}
                    <td className="data-td py-5 px-6 text-center whitespace-nowrap">
                      {typeof rec.totalMark === 'number' && <span className="mark-record-score">{rec.totalMark}</span>}
                      {rec.taskLifecycleStatus === 'RETIRED' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-xs font-extrabold tracking-wider text-slate-600 uppercase border border-slate-200" title={rec.retirementReason || undefined}>
                          Retired
                        </span>
                      ) : rec.taskLifecycleStatus === 'PAUSED' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-amber-50 text-xs font-extrabold tracking-wider text-amber-700 uppercase border border-amber-200" title={rec.pauseReason || undefined}>
                          Paused
                        </span>
                      ) : rec.status === 'Submitted' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-50 text-xs font-extrabold tracking-wider text-emerald-600 uppercase border border-emerald-100">
                          Submitted
                        </span>
                      ) : rec.status === 'Draft' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-blue-50 text-xs font-extrabold tracking-wider text-blue-500 uppercase border border-blue-100">
                          Draft Saved
                        </span>
                      ) : rec.status === 'Not Started' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-50 text-xs font-extrabold tracking-wider text-slate-500 uppercase border border-slate-200">
                          Not Started
                        </span>
                      ) : rec.status === 'Overdue' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-rose-50 text-xs font-extrabold tracking-wider text-rose-600 uppercase border border-rose-100">
                          Overdue
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-gray-100 text-xs font-extrabold tracking-wider text-gray-600 uppercase border border-gray-200">
                          Closed
                        </span>
                      )}
                      {rec.submittedDate && rec.submittedDate !== '-' && <span className="card-caption mt-1 block">Submitted {rec.submittedDate}</span>}
                    </td>

                    {/* Row inspection trigger button */}
                    <td className="data-td whitespace-nowrap">
                      <div className="mark-record-actions">
                        <PortalButton variant="primary" size="sm" aria-label={`Open mark record ${rec.id}`} onClick={() => onViewRecordDetail(rec.id)}>View marks</PortalButton>
                      </div>
                    </td>

                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div id="records-pagination-footer" className="mark-record-pagination">
          <p className="mark-record-pagination-count">
            {filteredRecords.length === 1 ? '1 record' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredRecords.length)} of ${filteredRecords.length} records`}
          </p>
          <nav aria-label="Mark records pagination" className="mark-record-pagination-controls">
            <PortalButton size="sm" variant="secondary" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>Previous</PortalButton>
            <span aria-live="polite" className="mark-record-page-count">Page {currentPage} of {totalPages}</span>
            <PortalButton size="sm" variant="secondary" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>Next</PortalButton>
          </nav>
        </div>
        </>}
        </>
        )}

      </div>

    </div>
  );
};
