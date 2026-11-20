import { useLocation, useSearchParams } from 'react-router';
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
import { getMarkRecordPeriods, getMarkRecords, getMarksExport, getMarksProgrammeOptions } from '../services';
import type { MarkRecordPeriod } from '../types';
import { MarkRecordsByLecturer } from './MarkRecordsByLecturer';
import {
  filterMarkRecordsByStatusTab,
  MarkRecordStatusTab,
} from '../utils/markRecords';
import { formatDeadlineText } from '../utils/workflowAgeing';
import { shortAssessmentLabel } from '../utils/assessment';

const STATUS_OPTIONS: MarkRecordStatusTab[] = [
  'All Records', 'Submitted', 'Draft Saved', 'Not Started', 'Overdue', 'Review Required',
];

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
  const { state: locationState } = useLocation();
  const periodScope = scopeParams.get('period') ?? '';
  const semesterScope = scopeParams.get('semester') ?? '';
  const statusScope = scopeParams.get('status');
  const [allRecords, setRecords] = useState<MarkRecord[]>([]);
  const monitoring = useOfficeMonitoring();
  const byLecturer = !monitoring && scopeParams.get('view') === 'lecturers';
  const lecturerDetail = byLecturer && scopeParams.has('lecturer');
  const lecturerProgramme = scopeParams.get('lecturerProgramme') ?? '';
  const needsFollowUp = scopeParams.get('followUp') === '1';
  const [lecturerSearch, setLecturerSearch] = useListState('MarkEntryRecords', 'lecturerSearch', '');
  const [availableProgrammes, setAvailableProgrammes] = useState<string[]>([]);
  const [programmeOptionsError, setProgrammeOptionsError] = useState(false);
  const [programmeOptionsAttempt, setProgrammeOptionsAttempt] = useState(0);
  useEffect(() => {
    if (!byLecturer) return;
    let cancelled = false;
    setProgrammeOptionsError(false);
    getMarksProgrammeOptions().then(options => {
      if (!cancelled) setAvailableProgrammes(options);
    }).catch(() => { if (!cancelled) setProgrammeOptionsError(true); });
    return () => { cancelled = true; };
  }, [byLecturer, programmeOptionsAttempt]);
  const [periodOptions, setPeriodOptions] = useState<MarkRecordPeriod[]>([]);
  const [periodOptionsError, setPeriodOptionsError] = useState(false);
  const [periodOptionsAttempt, setPeriodOptionsAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setPeriodOptionsError(false);
    getMarkRecordPeriods().then(items => {
      if (!cancelled) setPeriodOptions(items);
    }).catch(() => { if (!cancelled) setPeriodOptionsError(true); });
    return () => { cancelled = true; };
  }, [periodOptionsAttempt]);
  const periods = useMemo(() => {
    const options = new Map(periodOptions.map(period => [period.id, period]));
    for (const record of allRecords) {
      if (!record.periodId || options.has(record.periodId)) continue;
      options.set(record.periodId, {
        id: record.periodId, name: record.periodName || `Period ${record.periodId}`, semester: record.semester,
        assessment: record.assessment, lifecycleStatus: record.periodLifecycleStatus ?? 'PUBLISHED',
        effectiveStatus: record.periodEffectiveStatus ?? 'CLOSED',
      });
    }
    return [...options.values()].filter(period => period.lifecycleStatus !== 'DRAFT');
  }, [periodOptions, allRecords]);
  const selectedPeriod = periods.find(period => String(period.id) === periodScope);
  const effectiveSemester = semesterScope || selectedPeriod?.semester || '';
  const visiblePeriods = useMemo(() => periods.filter(period =>
    (!effectiveSemester || period.semester === effectiveSemester)), [periods, effectiveSemester]);
  const lecturerPeriods = useMemo(() => visiblePeriods.filter(period =>
    !periodScope || String(period.id) === periodScope), [visiblePeriods, periodScope]);
  const initialStatusTab = monitoring ? 'All Records' : (STATUS_OPTIONS.includes(statusScope as MarkRecordStatusTab) ? statusScope as MarkRecordStatusTab : requestedStatusTab);
  const scopedByPeriod = useMemo(() => allRecords.filter(record =>
    (!periodScope || String(record.periodId) === periodScope) && (!effectiveSemester || record.semester === effectiveSemester)),
  [allRecords, periodScope, effectiveSemester]);
  const records = useMemo(() => filterMonitoringMarks(scopedByPeriod, monitoring?.view ?? null).filter(record =>
    (!(statusScope && (periodScope || semesterScope)) || ((!record.taskLifecycleStatus || record.taskLifecycleStatus === 'ACTIVE')
      && !['DRAFT', 'ARCHIVED'].includes(record.periodLifecycleStatus ?? '')))),
  [scopedByPeriod, monitoring?.view, periodScope, semesterScope, statusScope]);
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
  const [panelFilter, setPanelFilter] = useListState('MarkEntryRecords', 'panelFilter', 'All Members');
  const [savedAssessmentFilter, setAssessmentFilter] = useListState('MarkEntryRecords', 'assessmentFilter', '');
  const hasUnclassifiedRecords = useMemo(() => records.some(record => !record.assessment), [records]);
  const assessmentFilter = savedAssessmentFilter === 'unclassified' && !hasUnclassifiedRecords ? '' : savedAssessmentFilter;

  // One status filter, retained in authenticated-shell list memory.
  const [activeTab, setActiveTab] = useListState<MarkRecordStatusTab>('MarkEntryRecords', 'activeTab', initialStatusTab);

  // Retain only the legacy status fallback from the former explicit-Apply UI.
  const [legacyFilters, setLegacyFilters] = useListState('MarkEntryRecords', 'appliedFilters', { status: 'All Statuses' });

  // Current page
  const [currentPage, setCurrentPage] = useListState('MarkEntryRecords', 'currentPage', 1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (!loading && !error && savedAssessmentFilter !== assessmentFilter) {
      setAssessmentFilter(assessmentFilter);
      setCurrentPage(1);
    }
  }, [loading, error, savedAssessmentFilter, assessmentFilter, setAssessmentFilter, setCurrentPage]);

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
      setSearchQuery(''); setProgrammeFilter('All Programmes');
      setPanelFilter('All Members'); setAssessmentFilter(''); setActiveTab(initialStatusTab); setCurrentPage(1);
      setLegacyFilters({ status: 'All Statuses' });
    }
    setLastScope(scopeKey);
  }, [scopeKey, lastScope, periodScope, semesterScope, statusScope, initialStatusTab, setLastScope,
    setSearchQuery, setProgrammeFilter, setPanelFilter, setAssessmentFilter, setActiveTab, setCurrentPage, setLegacyFilters]);

  // Preserve a previously applied dropdown status when returning from older list state.
  const selectedStatus: MarkRecordStatusTab = activeTab !== 'All Records' ? activeTab
    : legacyFilters.status === 'Draft' ? 'Draft Saved'
    : ['Submitted', 'Not Started', 'Overdue'].includes(legacyFilters.status)
      ? legacyFilters.status as MarkRecordStatusTab : 'All Records';
  const hasFilters = !!periodScope || !!semesterScope || selectedStatus !== 'All Records' || !!searchQuery
    || programmeFilter !== 'All Programmes' || panelFilter !== 'All Members' || !!assessmentFilter;
  const setRecordScope = (semester: string, period: string, resetStatus = false) => {
    const params = new URLSearchParams(scopeParams);
    if (semester) params.set('semester', semester); else params.delete('semester');
    if (period) params.set('period', period); else params.delete('period');
    params.delete('lecturerPage');
    if (resetStatus) {
      params.delete('lecturerProgramme');
      params.delete('followUp');
    }
    if (resetStatus) params.set('status', 'All Records'); else params.delete('status');
    setRouteStatus(resetStatus || monitoring ? 'All Records' : requestedStatusTab);
    setLastScope(`${period}|${semester}|${params.get('status') ?? ''}`);
    setCurrentPage(1);
    setScopeParams(params, { state: locationState });
  };
  const clearFilters = () => {
    setLecturerSearch(''); setSearchQuery(''); setProgrammeFilter('All Programmes');
    setPanelFilter('All Members'); setAssessmentFilter(''); setActiveTab('All Records'); setCurrentPage(1);
    setLegacyFilters({ status: 'All Statuses' });
    setRecordScope('', '', true);
  };
  const setLecturerFilter = (key: 'lecturerProgramme' | 'followUp', value: string) => {
    const params = new URLSearchParams(scopeParams);
    if (value) params.set(key, value); else params.delete(key);
    params.delete('lecturerPage');
    setScopeParams(params, { state: locationState });
  };
  const lecturerProgrammes = useMemo(() => {
    const names = new Map<string, string>();
    for (const programme of [lecturerProgramme, ...availableProgrammes, ...scopedByPeriod.map(record => record.programme)]) {
      const label = programme.trim();
      if (label && !names.has(label.toLowerCase())) names.set(label.toLowerCase(), label);
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }, [lecturerProgramme, availableProgrammes, scopedByPeriod]);
  const programmeOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.programme))).filter(Boolean).sort(),
    [records],
  );
  const semesterOptions = useMemo(
    () => Array.from(new Set([
      ...periods.map(period => period.semester), ...allRecords.map(record => record.semester), effectiveSemester,
    ])).filter(Boolean).sort(),
    [allRecords, periods, effectiveSemester],
  );
  const evaluatorOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.panelMember))).filter(Boolean).sort(),
    [records],
  );

  // Derived filtered dataset matching active constraints
  const scopedRecords = useMemo(() => {
    return records.filter(rec => {
      if (assessmentFilter && (rec.assessment || 'unclassified') !== assessmentFilter) {
        return false;
      }
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

      // 3. Evaluator filter
      if (panelFilter !== 'All Members' && rec.panelMember !== panelFilter) {
        return false;
      }

      return true;
    });
  }, [records, searchQuery, programmeFilter, panelFilter, assessmentFilter]);
  const statusFilters = STATUS_OPTIONS.map(key => ({
    key, count: filterMarkRecordsByStatusTab(scopedRecords, key).length,
  }));
  const filteredRecords = filterMarkRecordsByStatusTab(scopedRecords, selectedStatus);

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
        `Semester: ${effectiveSemester || 'All semesters'}`, `Evaluator: ${panelFilter}`,
        `Assessment: ${assessmentFilter ? shortAssessmentLabel(assessmentFilter) : 'All assessments'}`,
        periodScope ? `Period: ${selectedPeriod?.name ?? periodScope}` : '',
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

  const lecturerView = byLecturer && <MarkRecordsByLecturer records={scopedByPeriod} periods={lecturerPeriods}
    query={lecturerSearch} semester={effectiveSemester} onViewRecord={onViewRecordDetail}
    programme={lecturerProgramme} needsFollowUp={needsFollowUp}
    periodOptionsUnavailable={periodOptionsError} onRetryPeriods={() => setPeriodOptionsAttempt(attempt => attempt + 1)} />;

  return (
    <div id="mark-entry-records-dashboard" className="marks-workspace space-y-5 text-left relative">
      {lecturerDetail ? loading ? <LoadingState message="Loading lecturer tasks…" /> : error
        ? <><PageHeader title="Lecturer tasks" backLabel="Back to lecturers" onBack={() => setScopeParams(previous => {
          const next = new URLSearchParams(previous); next.delete('lecturer'); return next;
        }, { replace: true, state: locationState })} /><ErrorState message={error} onRetry={loadRecords} /></>
        : lecturerView : <>
      {/* Breadcrumb back link & Title header */}
      <PageHeader
        title="Mark Entry Records"
        subtitle="Find evaluation records and review submission progress."
        backLabel={backLabel}
        onBack={onBack}
        subtitleClassName="leading-relaxed"
        actions={!byLecturer && <PortalButton variant="primary" size="sm" icon={Download} isLoading={exporting}
          title="Download all matching records across every page as Excel" onClick={downloadExcel}
          disabled={loading || !!error || exporting || !filteredRecords.length}>
          Export Excel
        </PortalButton>}
      />

      {exportError && <p role="alert" className="text-sm text-red-600">{exportError}</p>}

      <OfficeMonitoringNotice />

      <div id="mark-records-table-container" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-3xs">
        <div id="records-filters-card" className="space-y-4 p-5 md:p-6">
          <MarksHeading icon={Files}>Mark records</MarksHeading>
          {!monitoring && <div className="flex gap-5 border-b border-slate-200" role="group" aria-label="Mark records view">
            {([['Records', false], ['By lecturer', true]] as const).map(([label, isLecturer]) => <button key={label} type="button"
              aria-pressed={isLecturer === byLecturer}
              className={`border-b-2 px-1 pb-2 text-sm font-semibold ${isLecturer === byLecturer ? 'border-brand-navy text-brand-navy' : 'border-transparent text-slate-600'}`}
              onClick={() => setScopeParams(previous => {
                const next = new URLSearchParams(previous);
                if (isLecturer) next.set('view', 'lecturers'); else next.delete('view');
                return next;
              }, { state: locationState })}>{label}</button>)}
          </div>}
          <WorkspaceFilterCard onReset={clearFilters}
            fieldsClassName={`grid grid-cols-1 items-end gap-3 min-[480px]:grid-cols-2 ${byLecturer ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}
            leading={byLecturer && <label className="flex cursor-pointer items-center gap-2 py-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={needsFollowUp} onChange={event => setLecturerFilter('followUp', event.target.checked ? '1' : '')} className="size-4 accent-brand-navy" />
              Needs follow-up
            </label>}>
              <label htmlFor="records-search" className={`form-label min-w-0 ${byLecturer ? '' : 'min-[480px]:col-span-2 xl:col-span-1'}`}>{byLecturer ? 'Search lecturers' : 'Search records'}
                <span className="relative mt-1 block">
                  <Search aria-hidden="true" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input id="records-search" type="search" value={byLecturer ? lecturerSearch : searchQuery} onChange={event => {
                    if (byLecturer) {
                      setLecturerSearch(event.target.value);
                      if (scopeParams.has('lecturerPage')) {
                        const next = new URLSearchParams(scopeParams);
                        next.delete('lecturerPage');
                        setScopeParams(next, { replace: true, state: locationState });
                      }
                    }
                    else { setSearchQuery(event.target.value); setCurrentPage(1); }
                  }} placeholder={byLecturer ? 'Lecturer name' : 'Student, ID, evaluator or research title'} className="form-control form-control-sm pl-10 pr-4" />
                </span>
              </label>
              <label className="form-label min-w-0">Semester
                <PortalSelect aria-label="Semester" value={effectiveSemester} onChange={event => setRecordScope(event.target.value, '')} className="form-control form-control-sm mt-1">
                  <option value="">All semesters</option>
                  {semesterOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </PortalSelect>
              </label>
              <label className="form-label min-w-0">Evaluation period
                <PortalSelect aria-label="Evaluation period" value={periodScope} onChange={event => {
                  const value = event.target.value;
                  setRecordScope(semesterScope || periods.find(period => String(period.id) === value)?.semester || effectiveSemester, value);
                }} className="form-control form-control-sm mt-1">
                  <option value="">All periods</option>
                  {periodScope && !visiblePeriods.some(period => String(period.id) === periodScope) && <option value={periodScope}>Selected period</option>}
                  {visiblePeriods.map(period => <option key={period.id} value={period.id}>
                    {period.assessment ? `${shortAssessmentLabel(period.assessment)} · ` : ''}{period.name}{!effectiveSemester && period.semester ? ` (${period.semester})` : ''}
                  </option>)}
                </PortalSelect>
              </label>
              {byLecturer &&
                <label className="form-label min-w-0">Programme
                  <PortalSelect aria-label="Programme" value={lecturerProgramme} onChange={event => setLecturerFilter('lecturerProgramme', event.target.value)} className="form-control form-control-sm mt-1">
                    <option value="">All programmes</option>
                    {lecturerProgrammes.map(programme => <option key={programme} value={programme}>{programme}</option>)}
                  </PortalSelect>
                </label>}
              {!byLecturer && <details id="records-more-filters" className="min-w-0 min-[480px]:col-span-2 xl:col-span-3">
                <summary className="w-fit cursor-pointer text-sm font-semibold text-brand-navy">More filters{(selectedStatus !== 'All Records' || programmeFilter !== 'All Programmes' || panelFilter !== 'All Members' || assessmentFilter) ? ' (active)' : ''}</summary>
                <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="form-label min-w-0">Assessment
                <PortalSelect aria-label="Assessment" value={assessmentFilter} onChange={event => { setAssessmentFilter(event.target.value); setCurrentPage(1); }} className="form-control form-control-sm mt-1">
                  <option value="">All assessments</option>
                  <option value="P1">RP1</option>
                  <option value="P2">RP2</option>
                  {hasUnclassifiedRecords && <option value="unclassified">Unclassified</option>}
                </PortalSelect>
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
              <label className="form-label min-w-0">Evaluator
                <PortalSelect aria-label="Evaluator" value={panelFilter} onChange={event => { setPanelFilter(event.target.value); setCurrentPage(1); }} className="form-control form-control-sm mt-1">
                  <option value="All Members">All Members</option>
                  {evaluatorOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </PortalSelect>
              </label>
                </div>
              </details>}
          </WorkspaceFilterCard>
          {byLecturer && programmeOptionsError && <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-amber-800">
            Some programme options could not be loaded. <PortalButton size="sm" onClick={() => setProgrammeOptionsAttempt(attempt => attempt + 1)}>Retry programmes</PortalButton>
          </div>}
          {periodOptionsError && <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-amber-800">
            Some evaluation periods could not be loaded. <PortalButton size="sm" onClick={() => setPeriodOptionsAttempt(attempt => attempt + 1)}>Retry periods</PortalButton>
          </div>}
        </div>

        {loading ? (
          <LoadingState message="Loading mark records…" />
        ) : error ? (
          <ErrorState message={error} onRetry={loadRecords} />
        ) : byLecturer ? lecturerView : (
        <>
        {filteredRecords.length === 0 ? (
          <div className="mx-5 mb-5 rounded-xl bg-slate-50 px-4 py-6 md:mx-6 md:mb-6">
            <h3 className="text-sm font-semibold text-brand-navy">{records.length === 0 ? monitoring ? 'No records in this monitoring view' : 'No mark records yet' : 'No records match your filters'}</h3>
            <p className="card-description mt-1">{records.length === 0 ? monitoring ? 'No assignments currently match this dashboard view. Clear the monitoring view to see other records.' : 'Records appear once evaluation tasks are generated. Check By lecturer for missing tasks.' : 'Try a different search or clear the filters to see all records in this view.'}</p>
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
                <th scope="col" className="data-th">Assessment</th>
                <th scope="col" className="data-th">Evaluator</th>
                <th scope="col" className="data-th">Deadline</th>
                <th scope="col" className="data-th">Mark &amp; status</th>
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
                      <span className="mark-record-main-line">{shortAssessmentLabel(rec.assessment)}</span>
                      {rec.periodName && <span className="mark-record-secondary break-words">{rec.periodName}</span>}
                    </td>
                    {/* Panel member examiner */}
                    <td className="data-td">
                      <span className="mark-record-main-line break-words">{rec.panelMember}</span>
                      {rec.evaluatorRoleLabel && <span className="mark-record-sub-line">{rec.evaluatorRoleLabel}</span>}
                    </td>

                    <td className={`data-td ${rec.deadlineState === 'OVERDUE' ? 'text-rose-600' : ''}`}>
                      <span className="mark-record-main-line">{rec.stageReviewRequired && rec.status !== 'Submitted' ? 'On hold' : formatDeadlineText(rec)}</span>
                      {rec.dueAt && (
                        <span className="mark-record-sub-line">
                          {new Date(rec.dueAt).toLocaleDateString()}
                        </span>
                      )}
                    </td>

                    {/* Styled Status badge */}
                    <td className="data-td whitespace-nowrap">
                      {typeof rec.totalMark === 'number' && <span className="mark-record-score">{rec.totalMark}</span>}
                      {rec.taskLifecycleStatus === 'RETIRED' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-xs font-extrabold tracking-wider text-slate-600 uppercase border border-slate-200" title={rec.retirementReason || undefined}>
                          Retired
                        </span>
                      ) : rec.taskLifecycleStatus === 'PAUSED' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-amber-50 text-xs font-extrabold tracking-wider text-amber-700 uppercase border border-amber-200" title={rec.pauseReason || undefined}>
                          Paused
                        </span>
                      ) : rec.status === 'Review Required' ? (
                        <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          Review required
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
                      {rec.stageReviewRequired && rec.status !== 'Review Required' && <span className="mt-1 block text-xs font-medium text-amber-800">Review required</span>}
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
      </>}
    </div>
  );
};
