/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// File Management's "Appointment letters" tab for lecturers: every confirmation
// letter sent to them as a supervisor, panel member or supporting supervisor.

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { GeneratedLetter } from '../types';
import { downloadLetterPdf, getReceivedLetters } from '../services/lettersApi';
import { routeForFileLetter } from '../constants/routes';
import { PortalButton, PortalToast } from './PortalPrimitives';
import { PortalSelect } from './PortalSelect';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { DownloadIconButton } from './DocumentParts';
import { LETTER_STATUS_LABEL, LetterStatusBadge, shortDate } from './IssuedLetters';
import { WORKSPACE_PAGE_SIZE, WorkspaceFilterCard, WorkspacePagination, WorkspaceSectionHeader, workspacePageSize } from './RequestWorkspacePrimitives';

type Shown = '' | 'Issued' | 'Revoked';

const COLUMNS = ['Letter', 'Student', 'Issued', 'Status', 'Action'];
const WIDTHS = [32, 24, 14, 16, 14];

export const ReceivedAppointmentLetters: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [letters, setLetters] = useState<GeneratedLetter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState<Shown>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(WORKSPACE_PAGE_SIZE);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLetters(null);
    getReceivedLetters()
      .then(setLetters)
      .catch(err => setError(err instanceof Error && err.message ? err.message : 'Could not load your appointment letters.'));
  }, []);

  useEffect(load, [load]);

  const download = async (letter: GeneratedLetter) => {
    setDownloading(letter.id);
    try {
      await downloadLetterPdf(letter);
    } catch (err) {
      setToast(err instanceof Error && err.message ? err.message : 'Could not download the PDF.');
    } finally {
      setDownloading(null);
    }
  };

  const words = search.trim().toLowerCase();
  const matching = (letters ?? []).filter(
    letter =>
      (!shown || letter.status === shown) &&
      (!words || `${letter.studentName} ${letter.matricNumber} ${letter.referenceNumber} ${letter.templateName}`.toLowerCase().includes(words)),
  );
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const current = Math.min(page, pageCount);
  const rows = matching.slice((current - 1) * pageSize, current * pageSize);
  const from = `${location.pathname}${location.search}`;
  const filtered = Boolean(words || shown);

  return (
    <section aria-label="Appointment letters" className="app-card appointment-workspace-card">
      <WorkspaceSectionHeader
        title="Appointment letters"
        description="Sent to you when the coordinator approves you as a student's supervisor, panel member or supporting supervisor."
      />
      <WorkspaceFilterCard
        fieldsClassName="grid grid-cols-1 items-end gap-3 sm:grid-cols-3"
        onReset={() => {
          setSearch('');
          setShown('');
          setPage(1);
        }}
      >
        <label className="form-label sm:col-span-2">
          Find a letter
          <input
            type="search"
            className="form-control form-control-sm mt-1"
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Student, matric number or reference"
          />
        </label>
        <label className="form-label">
          Status
          <PortalSelect
            className="form-control form-control-sm mt-1"
            value={shown}
            onChange={event => {
              setShown(event.target.value as Shown);
              setPage(1);
            }}
          >
            <option value="">Any status</option>
            <option value="Issued">{LETTER_STATUS_LABEL.Issued}</option>
            <option value="Revoked">{LETTER_STATUS_LABEL.Revoked}</option>
          </PortalSelect>
        </label>
      </WorkspaceFilterCard>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : letters === null ? (
        <LoadingState message="Loading your appointment letters..." />
      ) : !rows.length ? (
        <EmptyState
          title={filtered ? 'No letters match.' : 'No appointment letters yet.'}
          description={filtered ? 'Change the search or the status above.' : 'Each time you are approved for a student, the confirmation letter appears here.'}
        />
      ) : (
        <>
          <table aria-label="Appointment letters" className="data-table block table-fixed lg:table">
            <colgroup className="hidden lg:table-column-group">
              {WIDTHS.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
            </colgroup>
            <thead className="hidden lg:table-header-group">
              <tr className="data-thead bg-slate-50">{COLUMNS.map(column => <th key={column} scope="col" className="data-th">{column}</th>)}</tr>
            </thead>
            <tbody className="block space-y-3 lg:table-row-group lg:space-y-0">
              {rows.map(letter => (
                <tr key={letter.id} className="data-row grid grid-cols-2 rounded-xl border border-slate-200 py-2 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:py-0">
                  <td className="data-td-strong col-span-2 block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <Link to={routeForFileLetter(letter.id)} state={{ from }} className="block line-clamp-2 text-[14px] font-bold text-brand-navy hover:underline">
                      {letter.templateName}
                    </Link>
                    <p className="truncate font-mono text-[12px] font-normal text-slate-500">{letter.referenceNumber}</p>
                  </td>
                  <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle [overflow-wrap:anywhere] lg:col-span-1 lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Student</span>
                    <p className="text-[13px] font-bold text-slate-800">{letter.studentName}</p>
                    <p className="card-caption mt-0.5">{letter.matricNumber}</p>
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Issued</span>
                    <p className="text-[13px]">{shortDate(letter.issuedAt) || letter.date}</p>
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Status</span>
                    <LetterStatusBadge status={letter.status} replaced={Boolean(letter.replacedById)} />
                  </td>
                  <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <div className="flex items-center gap-2">
                      <PortalButton size="sm" className="whitespace-nowrap" aria-label={`Open ${letter.templateName} for ${letter.studentName}`} onClick={() => navigate(routeForFileLetter(letter.id), { state: { from } })}>
                        Open
                      </PortalButton>
                      {letter.status === 'Issued' && (
                        <DownloadIconButton label={`Download ${letter.templateName} for ${letter.studentName}`} busy={downloading === letter.id} onClick={() => void download(letter)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <WorkspacePagination
            page={current}
            pageCount={pageCount}
            total={matching.length}
            noun="letters"
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={size => {
              setPageSize(workspacePageSize(size));
              setPage(1);
            }}
          />
        </>
      )}
      <PortalToast message={toast} tone="danger" onClose={() => setToast(null)} />
    </section>
  );
};
