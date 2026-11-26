import { PortalSelect } from './PortalSelect';
import { RecordPage } from './RecordPage';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  ExternalLink,
  ChevronDown,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StatusChip } from './LecturerSupervisorAppointments';
import { PageHeader, PortalButton, StatusBadge } from './PortalPrimitives';
import { LoadingState, ErrorState } from './StateViews';
import { SupervisorRequestHistoryRow } from '../types';
import { getSupervisorRequestHistory } from '../services';

// ==================== COMPONENT SPECIFICATION ====================

// SupervisorRequestHistoryRow now lives in src/types; the records are served by
// appointmentsApi (getSupervisorRequestHistory).

interface SupervisorRequestHistoryProps {
  onBack: () => void;
  hideHeader?: boolean;
}

export const SupervisorRequestHistory: React.FC<SupervisorRequestHistoryProps> = ({ onBack, hideHeader = false }) => {
  // Decided supervisor requests are loaded from the persisted appointment API.
  const [allHistoryRecords, setAllHistoryRecords] = useState<SupervisorRequestHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    setLoading(true);
    setError(null);
    getSupervisorRequestHistory()
      .then(setAllHistoryRecords)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load supervisor request history.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('All');
  const [semesterFilter, setSemesterFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  // Applied Filters State
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedDecision, setAppliedDecision] = useState('All');
  const [appliedSemester, setAppliedSemester] = useState('All');
  const [appliedDate, setAppliedDate] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Selected Row Details Popup Modal Custom State
  const [selectedRecord, setSelectedRecord] = useState<SupervisorRequestHistoryRow | null>(null);

  // Computed summary metrics
  const totalReviewedCount = allHistoryRecords.length;
  const approvedCount = allHistoryRecords.filter(r => r.decision === 'Approved').length;
  const rejectedCount = allHistoryRecords.filter(r => r.decision === 'Rejected').length;

  // Semesters for filter dropdown list
  const semesterOptions = useMemo(() => {
    const list = new Set(allHistoryRecords.map(r => r.semester));
    return ['All', ...Array.from(list)];
  }, [allHistoryRecords]);

  // Filter implementation
  const filteredRecords = useMemo(() => {
    return allHistoryRecords.filter(rec => {
      // Search matches Request ID, studentName, studentId, or researchTitle
      const query = appliedSearch.toLowerCase();
      const matchesSearch = query === '' || 
        rec.requestId.toLowerCase().includes(query) ||
        rec.studentName.toLowerCase().includes(query) ||
        rec.studentId.toLowerCase().includes(query) ||
        rec.researchTitle.toLowerCase().includes(query);

      // Decision matches
      const matchesDecision = appliedDecision === 'All' || rec.decision === appliedDecision;

      // Semester matches
      const matchesSemester = appliedSemester === 'All' || rec.semester === appliedSemester;

      // Date matches (simple representation checker since dates are string e.g. "10 Oct 2025")
      let matchesDate = true;
      if (appliedDate) {
        // Just checking if year or month is typed/matched, generic check for mockup flexibility
        const yearPart = appliedDate.split('-')[0];
        matchesDate = rec.submittedDate.includes(yearPart);
      }

      return matchesSearch && matchesDecision && matchesSemester && matchesDate;
    });
  }, [allHistoryRecords, appliedSearch, appliedDecision, appliedSemester, appliedDate]);

  // Paginated partition
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;

  const handleApplyFilters = () => {
    setAppliedSearch(searchQuery);
    setAppliedDecision(decisionFilter);
    setAppliedSemester(semesterFilter);
    setAppliedDate(dateFilter);
    setCurrentPage(1); // Reset page to first on filter
  };

  return (
    <div id="supervisor-request-history-page" className="space-y-8 animate-fade-in text-left">
      
      {!hideHeader && <PageHeader
        title="Supervisor Request History"
        subtitle="View supervisor appointment requests you have approved or rejected."
        backLabel="Back to Supervisor Appointments"
        onBack={onBack}
        subtitleClassName="max-w-4xl leading-relaxed"
        className="select-none"
      />}

      {/* THREE SUMMARY CARDS GRID */}
      <div id="history-summary-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none font-sans">
        {/* TOTAL REVIEWED CARD */}
        <div className="bg-[#f1f5f9]/60 border border-[#e2e8f0]/80 rounded-2xl p-5 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50/70 border border-indigo-100 text-brand-navy rounded-xl flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5 text-indigo-900" />
          </div>
          <div>
            <span className="card-label text-slate-400 uppercase tracking-widest block leading-none mb-1">
              TOTAL REVIEWED
            </span>
            <span className="card-metric text-brand-navy">
              {totalReviewedCount}
            </span>
          </div>
        </div>

        {/* APPROVED CARD */}
        <div className="bg-[#f1f5f9]/60 border border-[#e2e8f0]/80 rounded-2xl p-5 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 bg-[#e6fbf2] border border-[#bef5db] text-[#00a15c] rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-[#00a15c]" />
          </div>
          <div>
            <span className="card-label text-slate-400 uppercase tracking-widest block leading-none mb-1">
              APPROVED
            </span>
            <span className="card-metric text-brand-navy">
              {approvedCount}
            </span>
          </div>
        </div>

        {/* REJECTED CARD */}
        <div className="bg-[#f1f5f9]/60 border border-[#e2e8f0]/80 rounded-2xl p-5 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <span className="card-label text-slate-400 uppercase tracking-widest block leading-none mb-1">
              REJECTED
            </span>
            <span className="card-metric text-brand-navy">
              {rejectedCount}
            </span>
          </div>
        </div>
      </div>

      {/* FILTER SECTION CARD */}
      <div id="history-filter-card" className="filter-toolbar">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          
          {/* Search box input */}
          <div className="md:col-span-4 space-y-1.5 text-left font-sans">
            <label className="form-label block">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450 text-slate-400" />
              <input
                type="text"
                className="form-control form-control-sm pl-10 pr-4"
                placeholder="Search by student name, ID, or research title"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Decision search options */}
          <div className="md:col-span-2.5 space-y-1.5 text-left font-sans col-span-2">
            <label className="form-label block">
              Decision
            </label>
            <div className="relative">
              <PortalSelect
                className="form-control form-control-sm appearance-none cursor-pointer"
                value={decisionFilter}
                onChange={(e) => setDecisionFilter(e.target.value)}
              >
                <option value="All">All Decisions</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </PortalSelect>

            </div>
          </div>

          {/* Semester dropdown option list */}
          <div className="md:col-span-2.5 space-y-1.5 text-left font-sans col-span-2">
            <label className="form-label block">
              Semester
            </label>
            <div className="relative">
              <PortalSelect
                className="form-control form-control-sm appearance-none cursor-pointer"
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
              >
                <option value="All">All Semesters</option>
                {semesterOptions.filter(s => s !== 'All').map(sem => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </PortalSelect>

            </div>
          </div>

          {/* Date Picker Range Box */}
          <div className="md:col-span-1.5 space-y-1.5 text-left font-sans col-span-2">
            <label className="form-label block">
              Date range
            </label>
            <div className="relative">
              <input
                type="date"
                className="form-control form-control-sm cursor-pointer"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Apply Filters Button */}
          <div className="md:col-span-1.5 w-full col-span-2">
            <PortalButton
              variant="primary"
              size="md"
              fullWidth
              icon={ChevronRight}
              onClick={handleApplyFilters}
            >
              Apply Filters
            </PortalButton>
          </div>

        </div>
      </div>

      {/* FILTERED DATA TABLE BOX */}
      <div id="history-table-container" className="space-y-4">
        <div className="bg-white rounded-2xl border border-[#e2e8f0]/80 overflow-hidden shadow-3xs">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[850px] text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
                  <th className="py-4.5 px-6 text-[10px] font-extrabold uppercase tracking-wider">REQUEST ID</th>
                  <th className="py-4.5 px-6 text-[10px] font-extrabold uppercase tracking-wider">STUDENT</th>
                  <th className="py-4.5 px-6 text-[10px] font-extrabold uppercase tracking-wider">RESEARCH TITLE</th>
                  <th className="py-4.5 px-6 pt-5 text-[10px] font-extrabold uppercase tracking-wider">SUBMITTED DATE</th>
                  <th className="py-4.5 px-6 text-[10px] font-extrabold uppercase tracking-wider">DECISION</th>
                  <th className="py-4.5 px-6 text-[10px] font-extrabold uppercase tracking-wider">SEMESTER</th>
                  <th className="py-4.5 px-6 text-center text-[10px] font-extrabold uppercase tracking-wider">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-brand-navy">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <LoadingState message="Loading supervisor request history…" />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <ErrorState message={error} onRetry={loadHistory} />
                    </td>
                  </tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 font-bold text-slate-400 uppercase tracking-wider">
                      No request history matches the selected filters.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((row) => {
                    const initials = row.studentName
                      .split(' ')
                      .slice(0, 2)
                      .map(w => w[0])
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={row.requestId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-slate-500">
                          {row.requestId}
                        </td>
                        <td className="py-4 px-6 text-xs font-semibold">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 text-slate-500 font-extrabold text-[10px] rounded-lg flex items-center justify-center shrink-0 border border-slate-200/50 select-none">
                              {initials}
                            </div>
                            <div>
                              <span className="font-bold text-brand-navy tracking-tight block">
                                {row.studentName}
                              </span>
                              <span className="card-caption text-slate-400 block mt-0.5">
                                {row.studentId}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-500 max-w-[260px] truncate" title={row.researchTitle}>
                          {row.researchTitle}
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-400">
                          {row.submittedDate}
                        </td>
                        <td className="py-4 px-6 text-xs font-semibold">
                          <StatusBadge tone={row.decision === 'Approved' ? 'success' : row.decision === 'Cancelled' ? 'neutral' : 'danger'} dot>
                            {row.decision}
                          </StatusBadge>
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-500">
                          {row.semester}
                        </td>
                        <td className="py-4 px-6 text-center text-xs font-semibold">
                          <button
                            onClick={() => setSelectedRecord(row)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-brand-navy hover:text-slate-800 border border-slate-200 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION PANEL CONTROLS MATCHING EXACTLY */}
          <div className="bg-slate-50/55 border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs select-none">
            <span className="text-slate-400 font-bold">
              Showing {filteredRecords.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(filteredRecords.length, currentPage * itemsPerPage)} of {filteredRecords.length} entries
            </span>
            <div className="flex items-center gap-1.5">
              {/* Prev icon */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer border border-slate-200/70"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers mapped */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  onClick={() => setCurrentPage(pg)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-sans transition-all cursor-pointer ${
                    currentPage === pg 
                      ? 'bg-brand-navy text-white' 
                      : 'hover:bg-slate-100 text-slate-650'
                  }`}
                >
                  {pg}
                </button>
              ))}

              {/* Next icon */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer border border-slate-200/70"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE DETAIL VIEW POPUP MODAL (Satisfies "Lecturer can view request details from the Action column") */}
      {selectedRecord ? <RecordPage title="Appointment request" backLabel="Back to Request History" onBack={() => setSelectedRecord(null)} pageKey={`supervisor-history:${selectedRecord.requestId}`}><section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <span className="card-label text-slate-400 uppercase tracking-wider block">
                    HISTORIC DISPOSITION CARD
                  </span>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="card-value font-mono text-brand-navy">
                      {selectedRecord.requestId}
                    </span>
                    <StatusBadge tone={selectedRecord.decision === 'Approved' ? 'success' : selectedRecord.decision === 'Cancelled' ? 'neutral' : 'danger'} className="py-0.5 text-[9px]">
                      {selectedRecord.decision}
                    </StatusBadge>
                  </div>
                </div>

                {/* Candidate Overview */}
                <div className="border-t border-b border-slate-100 py-3.5 flex gap-3.5 items-center">
                  <div className="w-10 h-10 bg-slate-100 text-slate-500 font-extrabold text-xs rounded-xl flex items-center justify-center">
                    {selectedRecord.studentName.split(' ')[0][0]}{selectedRecord.studentName.split(' ').slice(-1)[0][0]}
                  </div>
                  <div>
                    <h4 className="section-label">
                      {selectedRecord.studentName}
                    </h4>
                    <p className="card-description">
                      {selectedRecord.studentId} <span className="mx-1 text-slate-205">•</span> {selectedRecord.programme}
                    </p>
                  </div>
                </div>

                {/* Semester details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="card-label text-slate-400 block uppercase tracking-wider">
                      DECISION SEMESTER
                    </span>
                    <span className="card-value text-slate-700 block mt-0.5">
                      {selectedRecord.semester}
                    </span>
                  </div>
                  <div>
                    <span className="card-label text-slate-400 block uppercase tracking-wider">
                      SUBMITTED ON
                    </span>
                    <span className="card-value text-slate-700 block mt-0.5">
                      {selectedRecord.submittedDate}
                    </span>
                  </div>
                </div>

                {/* Dissertation proposal */}
                <div className="space-y-1.5">
                  <span className="card-label text-slate-400 block uppercase tracking-wider">
                    PROPOSED RESERCH TOPIC
                  </span>
                  <h5 className="card-value text-brand-navy leading-snug">
                    {selectedRecord.researchTitle}
                  </h5>
                </div>

                {/* Synopsis abstract */}
                <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                  <span className="card-caption text-slate-400 block tracking-wider">
                    SYNOPSIS SUMMARY
                  </span>
                  <p className="card-description">
                    {selectedRecord.abstract}
                  </p>
                </div>

                {/* Decline reason block if rejected */}
                {(selectedRecord.decision === 'Rejected' || selectedRecord.decision === 'Cancelled') && selectedRecord.decisionReason && (
                  <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl space-y-1">
                    <span className="card-caption text-rose-500 block tracking-wider">
                      DECLINE REASON LOGGED
                    </span>
                    <p className="card-description text-slate-700 leading-relaxed">
                      {selectedRecord.decisionReason}
                    </p>
                  </div>
                )}

                <div className="pt-2 text-right">
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="px-5 py-2.5 bg-brand-navy hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition"
                  >
                    Close Review
                  </button>
                </div>

              </section></RecordPage> : null}

    </div>
  );
};
