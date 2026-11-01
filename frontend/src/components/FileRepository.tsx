/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// File Management for staff: every file they may see, with the system's tags as
// one-click filters. The office gets counts to act on first (files to check,
// files returned, students still owing a required document).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ClipboardCheck, FileSignature, FileStack, ListChecks, Plus, RotateCcw, Settings2, SlidersHorizontal, UsersRound, X } from 'lucide-react';
import type { DocumentAutoTag, DocumentFilters, DocumentOptions, DocumentSummary, GeneratedLetter, PortalDocument, StudentFileHeader } from '../types';
import { downloadDocument, downloadDocumentsZip, getDocumentOptions, getDocuments, getDocumentSummary, getStudentFileHeader } from '../services/filesApi';
import { getReceivedLetters } from '../services/lettersApi';
import { APP_ROUTES, routeForDocument, routeForFileLetter } from '../constants/routes';
import { EMPTY_DOCUMENT_FILTERS, filtersFromParams, filtersToParams, moreFilterCount } from '../utils/documentFilters';
import { checkBadge, shortDocumentDate, studentsLine, uploadedLine } from '../utils/documentDisplay';
import { MAX_ZIP_FILES, toggleSelection } from '../utils/documentPreview';
import { titleCase } from '../utils/programmeLabel';
import { PageHeader, PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { PortalSelect } from './PortalSelect';
import { OfficeToolViews } from './OfficeToolPrimitives';
import { SummaryCardButton } from './SummaryCardButton';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { AutoTagChips, DownloadIconButton, KindBadge } from './DocumentParts';
import { RequiredDocuments } from './RequiredDocuments';
import { ReceivedAppointmentLetters } from './ReceivedAppointmentLetters';
import { WORKSPACE_PAGE_SIZE, WorkspaceFilterCard, WorkspacePagination, WorkspaceSectionHeader, workspacePageSize } from './RequestWorkspacePrimitives';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const SENDER_LABELS: Record<Exclude<DocumentFilters['sender'], ''>, string> = {
  student: 'Students',
  lecturer: 'Lecturers',
  coordinator: 'Programme coordinators',
  office: 'PG office',
};
const STATUS_LABELS: Record<Exclude<DocumentFilters['status'], ''>, string> = {
  WAITING: 'Waiting for office',
  RETURNED: 'Returned',
  ACCEPTED: 'Accepted',
  NONE: 'No check needed',
};
const KIND_LABELS: Record<Exclude<DocumentFilters['kind'], ''>, string> = { PDF: 'PDF', DOCX: 'Word', IMAGE: 'Photo or scan', XLSX: 'Excel', PPTX: 'PowerPoint' };
const UPLOADER_LABELS: Record<Exclude<DocumentFilters['uploader'], ''>, string> = { me: 'Me', students: 'Students', staff: 'Staff' };
const ROW_TAGS: ReadonlyArray<DocumentAutoTag['kind']> = ['category', 'required', 'semester', 'from'];

const ArchivedBadge: React.FC = () => <StatusBadge tone="neutral" dot>Archived</StatusBadge>;

export const FileRepository: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const navigate = useNavigate();
  const location = useLocation();
  const [options, setOptions] = useState<DocumentOptions | null>(null);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [rows, setRows] = useState<PortalDocument[]>([]);
  const [count, setCount] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(filters.q);
  const [moreOpen, setMoreOpen] = useState(moreFilterCount(filters) > 0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(WORKSPACE_PAGE_SIZE);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(
    typeof location.state?.message === 'string' ? { message: location.state.message, tone: 'success' } : null,
  );
  const [student, setStudent] = useState<StudentFileHeader | null>(null);
  const [reload, setReload] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [zipping, setZipping] = useState(false);

  const update = useCallback((changes: Partial<DocumentFilters>) => {
    setParams(filtersToParams({ ...filters, ...changes }), { replace: true });
    setPage(1);
  }, [filters, setParams]);

  useEffect(() => {
    getDocumentOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  useEffect(() => {
    getDocumentSummary().then(setSummary).catch(() => setSummary(null));
  }, [reload]);

  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search.trim() !== filters.q.trim()) update({ q: search });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, filters.q, update]);

  // Rows only show for the filters and page they were loaded for, so a tab
  // switch never flashes the previous list.
  const listKey = `${params.toString()}#${reload}#${page}#${pageSize}`;
  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (filters.view === 'required' || filters.view === 'letters') {
      setRows([]);
      setLoadedKey(listKey);
      return;
    }
    getDocuments(filters, (page - 1) * pageSize, pageSize)
      .then(found => {
        if (cancelled) return;
        setRows(found.results);
        setCount(found.count);
        setLoadedKey(listKey);
      })
      .catch(err => {
        if (cancelled) return;
        setError(errorText(err, 'Could not load the files.'));
        setLoadedKey(listKey);
      });
    return () => {
      cancelled = true;
    };
  }, [listKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const loading = loadedKey !== listKey;

  useEffect(() => {
    if (!filters.student) {
      setStudent(null);
      return;
    }
    let cancelled = false;
    getStudentFileHeader(filters.student)
      .then(header => !cancelled && setStudent(header))
      .catch(() => !cancelled && setStudent(null));
    return () => {
      cancelled = true;
    };
  }, [filters.student]);

  // A lecturer's own appointment letters about this student, from Letter Generation.
  const [appointmentLetters, setAppointmentLetters] = useState<GeneratedLetter[]>([]);
  const lecturerView = options !== null && !options.isOffice;
  useEffect(() => {
    if (!filters.student || !lecturerView) {
      setAppointmentLetters([]);
      return;
    }
    let cancelled = false;
    getReceivedLetters(filters.student)
      .then(found => !cancelled && setAppointmentLetters(found))
      .catch(() => !cancelled && setAppointmentLetters([]));
    return () => {
      cancelled = true;
    };
  }, [filters.student, lecturerView]);

  const stopSelecting = () => {
    setSelecting(false);
    setSelected([]);
  };

  const toggle = (id: number) => {
    const next = toggleSelection(selected, id);
    setSelected(next.selected);
    if (next.full) setToast({ message: `You can download up to ${MAX_ZIP_FILES} files at a time.`, tone: 'danger' });
  };

  const downloadZip = async () => {
    setZipping(true);
    try {
      await downloadDocumentsZip(selected);
      stopSelecting();
    } catch (err) {
      setToast({ message: errorText(err, 'Could not download these files.'), tone: 'danger' });
    } finally {
      setZipping(false);
    }
  };

  const download = async (document: PortalDocument) => {
    setDownloading(document.id);
    try {
      await downloadDocument(document);
    } catch (err) {
      setToast({ message: errorText(err, 'Could not download this file.'), tone: 'danger' });
    } finally {
      setDownloading(null);
    }
  };

  const isOffice = Boolean(options?.isOffice);
  const from = `${location.pathname}${location.search}`;
  const groupLabel = (value: string) => options?.groups.find(group => group.value === value)?.label ?? value;
  const semesterLabel = (value: string) => (value === 'none' ? 'Not linked to a semester' : options?.semesters?.find(item => String(item.id) === value)?.label ?? value);
  const typeLabel = (value: string) => options?.types.find(item => item.code === value)?.label ?? value;
  const chip = (key: keyof DocumentFilters, label: string) => (filters[key] ? [{ key, label }] : []);
  const applied: Array<{ key: keyof DocumentFilters; label: string }> = [
    ...chip('group', groupLabel(filters.group)),
    ...chip('required', 'Required documents'),
    ...chip('programme', titleCase(filters.programme)),
    ...chip('intake', `Intake ${filters.intake}`),
    ...chip('semester', semesterLabel(filters.semester)),
    ...chip('sender', filters.sender ? `From ${SENDER_LABELS[filters.sender]}` : ''),
    ...chip('type', typeLabel(filters.type)),
    ...chip('status', filters.status ? STATUS_LABELS[filters.status] : ''),
    ...chip('kind', filters.kind ? KIND_LABELS[filters.kind] : ''),
    ...chip('uploader', filters.uploader ? `Uploaded by ${UPLOADER_LABELS[filters.uploader].toLowerCase()}` : ''),
    ...chip('from', `From ${shortDocumentDate(filters.from)}`),
    ...chip('to', `To ${shortDocumentDate(filters.to)}`),
    ...chip('archived', 'Archived files'),
  ];
  const clearFilters = () => {
    setSearch('');
    setParams(filtersToParams({ view: filters.view, student: filters.student }), { replace: true });
    setPage(1);
  };
  const uploadPath = filters.student
    ? `${APP_ROUTES.filesUpload}?student=${encodeURIComponent(filters.student)}`
    : APP_ROUTES.filesUpload;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  const summaryCards = [
    ...(isOffice
      ? [
          { key: 'check', title: 'To check', value: summary?.toCheck, caption: 'files', description: 'Waiting for the office to accept or return.', icon: ClipboardCheck, tone: 'warning' as const, open: () => update({ ...EMPTY_DOCUMENT_FILTERS, view: 'check' }) },
          { key: 'returned', title: 'Returned', value: summary?.returned, caption: 'files', description: 'Waiting for the student to send a corrected file.', icon: RotateCcw, tone: 'danger' as const, open: () => update({ ...EMPTY_DOCUMENT_FILTERS, view: 'all', status: 'RETURNED' }) },
        ]
      : [
          { key: 'all', title: 'Files you can see', value: summary?.all, caption: 'files', description: 'About your students, or shared with staff.', icon: FileStack, tone: 'info' as const, open: () => update({ ...EMPTY_DOCUMENT_FILTERS, view: 'all' }) },
        ]),
    ...(options?.canSeeRequired
      ? [{ key: 'required', title: 'Still to hand in', value: summary?.studentsStillToHandIn, caption: 'students', description: 'Owe at least one required document.', icon: UsersRound, tone: 'danger' as const, open: () => update({ ...EMPTY_DOCUMENT_FILTERS, view: 'required' }) }]
      : []),
  ];
  const cardSelected = (key: string) =>
    (key === 'check' && filters.view === 'check') || (key === 'required' && filters.view === 'required') || (key === 'returned' && filters.view === 'all' && filters.status === 'RETURNED');

  const columns = filters.student ? ['File', 'Uploaded', 'Status', 'Action'] : ['File', 'Student', 'Uploaded', 'Status', 'Action'];
  const widths = filters.student ? [50, 18, 18, 14] : [35, 20, 14, 17, 14];
  const heading =
    filters.view === 'check' ? 'Waiting for a check' : filters.view === 'staff' ? 'Staff files' : filters.student ? 'Their files' : 'All files';
  const headingNote =
    filters.view === 'check'
      ? 'Open one to accept it, or return it with a reason.'
      : filters.view === 'staff'
        ? 'Files not about any student, such as rubrics and meeting notes.'
        : 'Click a tag on any file to see every file with that tag.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="File Management"
        subtitle="Every student's official documents, in one place. The system files and tags each one."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isOffice && <PortalButton icon={Settings2} onClick={() => navigate(APP_ROUTES.filesSettings)}>Settings</PortalButton>}
            <PortalButton variant="primary" icon={Plus} onClick={() => navigate(uploadPath)}>Upload file</PortalButton>
          </div>
        }
      />

      {filters.student ? (
        <div className="space-y-3">
          <button type="button" className="back-link" onClick={() => update({ student: '' })}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All files
          </button>
          <section aria-label="Student" className="app-card flex flex-wrap items-center justify-between gap-5 p-5">
            <div className="flex min-w-0 items-center gap-4">
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-navy text-[15px] font-extrabold text-white">
                {(student?.name ?? filters.student).split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[19px] font-extrabold text-brand-navy">{student?.name ?? filters.student}</h2>
                <p className="truncate text-[13px] text-slate-500">{student ? `${student.matric} · ${student.programme ? titleCase(student.programme) : 'No programme'}` : 'Loading the student...'}</p>
              </div>
            </div>
            {student && (
              <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
                <div><dt className="text-slate-500">Supervisor</dt><dd className="font-bold text-slate-800">{student.supervisors.join(', ') || 'None yet'}</dd></div>
                <div><dt className="text-slate-500">Panel member</dt><dd className="font-bold text-slate-800">{student.panel.join(', ') || 'None yet'}</dd></div>
                {student.letters !== null && <div><dt className="text-slate-500">Letters approved</dt><dd className="font-bold text-slate-800">{student.letters}</dd></div>}
                {appointmentLetters.length > 0 && (
                  <div>
                    <dt className="text-slate-500">Your appointment letters</dt>
                    <dd className="font-bold">
                      {appointmentLetters.map(letter => (
                        <Link key={letter.id} to={routeForFileLetter(letter.id)} state={{ from }} className="block text-blue-700 hover:underline">
                          {letter.templateName}{letter.status === 'Revoked' ? ' (revoked)' : ''}
                        </Link>
                      ))}
                    </dd>
                  </div>
                )}
                {student.required && student.required.length > 0 && (
                  <div>
                    <dt className="text-slate-500">Required documents</dt>
                    <dd className="font-bold text-slate-800">
                      {student.required.filter(item => item.state === 'DONE').length} of {student.required.length} handed in
                      {student.required.some(item => item.state === 'MISSING' || item.state === 'RETURNED') && (
                        <span className="block text-[12px] font-semibold text-rose-700">
                          Still to hand in: {student.required.filter(item => item.state === 'MISSING' || item.state === 'RETURNED').map(item => item.label).join(', ')}
                        </span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </section>
        </div>
      ) : (
        <>
          {summaryCards.length > 0 && (
            <div className={`grid gap-4 ${summaryCards.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              {summaryCards.map(card => {
                const on = cardSelected(card.key);
                return (
                  <SummaryCardButton
                    key={card.key}
                    title={card.title}
                    value={card.value ?? '-'}
                    caption={card.caption}
                    description={card.description}
                    icon={card.icon}
                    tone={card.tone}
                    selected={on}
                    onClick={on ? () => update({ ...EMPTY_DOCUMENT_FILTERS, view: 'all' }) : card.open}
                  />
                );
              })}
            </div>
          )}
          <OfficeToolViews<DocumentFilters['view']>
            label="File views"
            appearance="workspace"
            value={filters.view === 'mine' ? 'all' : filters.view}
            onChange={view => update({ view })}
            options={[
              { value: 'all', label: 'All files', icon: FileStack },
              ...(isOffice ? [{ value: 'check' as const, label: `To check (${summary?.toCheck ?? 0})`, icon: ClipboardCheck }] : []),
              ...(options?.canSeeRequired ? [{ value: 'required' as const, label: 'Required documents', icon: ListChecks }] : []),
              { value: 'staff', label: 'Staff files', icon: UsersRound },
              ...(lecturerView ? [{ value: 'letters' as const, label: 'Appointment letters', icon: FileSignature }] : []),
            ]}
          />
        </>
      )}

      {filters.view === 'required' && !filters.student ? (
        <RequiredDocuments isOffice={isOffice} />
      ) : filters.view === 'letters' && !filters.student ? (
        lecturerView ? <ReceivedAppointmentLetters /> : null
      ) : (
        <section aria-label="Files" className="app-card appointment-workspace-card">
          <WorkspaceSectionHeader
            title={heading}
            description={headingNote}
            actions={selecting ? (
              <>
                <span className="text-[13px] font-bold text-slate-700">{selected.length} selected</span>
                <PortalButton size="sm" variant="primary" disabled={!selected.length} isLoading={zipping} onClick={() => void downloadZip()}>Download as ZIP</PortalButton>
                <PortalButton size="sm" onClick={stopSelecting}>Cancel</PortalButton>
              </>
            ) : rows.length > 0 ? (
              <PortalButton size="sm" onClick={() => setSelecting(true)}>Select files</PortalButton>
            ) : undefined}
          />
          <WorkspaceFilterCard
            fieldsClassName="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-5"
            onReset={clearFilters}
            actions={
              <PortalButton size="sm" icon={SlidersHorizontal} aria-expanded={moreOpen} onClick={() => setMoreOpen(open => !open)}>
                {moreOpen ? 'Fewer filters' : `More filters${moreFilterCount(filters) ? ` (${moreFilterCount(filters)})` : ''}`}
              </PortalButton>
            }
          >
            <label className="form-label sm:col-span-2">
              Find a file
              <input
                type="search"
                className="form-control form-control-sm mt-1"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={filters.student ? 'Search this student’s files' : 'Student, matric number, file name or programme'}
              />
            </label>
            <label className="form-label">
              Category
              <PortalSelect className="form-control form-control-sm mt-1" value={filters.group} onChange={event => update({ group: event.target.value })}>
                <option value="">All categories</option>
                {(options?.groups ?? []).map(group => <option key={group.value} value={group.value}>{group.label}</option>)}
              </PortalSelect>
            </label>
            {!filters.student && (
              <label className="form-label">
                Programme
                <PortalSelect className="form-control form-control-sm mt-1" value={filters.programme} onChange={event => update({ programme: event.target.value })}>
                  <option value="">All programmes</option>
                  {(options?.programmes ?? []).map(programme => <option key={programme} value={programme}>{titleCase(programme)}</option>)}
                </PortalSelect>
              </label>
            )}
            <label className="form-label">
              Semester
              <PortalSelect className="form-control form-control-sm mt-1" value={filters.semester} onChange={event => update({ semester: event.target.value })}>
                <option value="">All semesters</option>
                {(options?.semesters ?? []).map(semester => <option key={semester.id} value={String(semester.id)}>{semester.label}</option>)}
                <option value="none">Not linked to a semester</option>
              </PortalSelect>
            </label>
            {moreOpen && (
              <>
                {!filters.student && (
                  <label className="form-label">
                    Intake
                    <PortalSelect className="form-control form-control-sm mt-1" value={filters.intake} onChange={event => update({ intake: event.target.value })}>
                      <option value="">All intakes</option>
                      {(options?.intakes ?? []).map(intake => <option key={intake} value={intake}>{intake}</option>)}
                    </PortalSelect>
                  </label>
                )}
                <label className="form-label">
                  From
                  <PortalSelect className="form-control form-control-sm mt-1" value={filters.sender} onChange={event => update({ sender: event.target.value as DocumentFilters['sender'] })}>
                    <option value="">Anyone</option>
                    {(Object.keys(SENDER_LABELS) as Array<keyof typeof SENDER_LABELS>).map(value => <option key={value} value={value}>{SENDER_LABELS[value]}</option>)}
                  </PortalSelect>
                </label>
                <label className="form-label">
                  Type
                  <PortalSelect className="form-control form-control-sm mt-1" value={filters.type} onChange={event => update({ type: event.target.value })}>
                    <option value="">All types</option>
                    {(options?.types ?? []).map(type => <option key={type.code} value={type.code}>{type.label}</option>)}
                  </PortalSelect>
                </label>
                <label className="form-label">
                  Status
                  <PortalSelect className="form-control form-control-sm mt-1" value={filters.status} onChange={event => update({ status: event.target.value as DocumentFilters['status'] })}>
                    <option value="">Any status</option>
                    {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
                  </PortalSelect>
                </label>
                <label className="form-label">
                  File
                  <PortalSelect className="form-control form-control-sm mt-1" value={filters.kind} onChange={event => update({ kind: event.target.value as DocumentFilters['kind'] })}>
                    <option value="">Any kind</option>
                    {(Object.keys(KIND_LABELS) as Array<keyof typeof KIND_LABELS>).map(value => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
                  </PortalSelect>
                </label>
                <label className="form-label">
                  Uploaded by
                  <PortalSelect className="form-control form-control-sm mt-1" value={filters.uploader} onChange={event => update({ uploader: event.target.value as DocumentFilters['uploader'] })}>
                    <option value="">Anyone</option>
                    {(Object.keys(UPLOADER_LABELS) as Array<keyof typeof UPLOADER_LABELS>).map(value => <option key={value} value={value}>{UPLOADER_LABELS[value]}</option>)}
                  </PortalSelect>
                </label>
                <label className="form-label">
                  Uploaded from
                  <input type="date" value={filters.from} onChange={event => update({ from: event.target.value })} className="form-control form-control-sm mt-1" />
                </label>
                <label className="form-label">
                  Uploaded to
                  <input type="date" value={filters.to} onChange={event => update({ to: event.target.value })} className="form-control form-control-sm mt-1" />
                </label>
                {isOffice && (
                  <label className="form-label">
                    Show
                    <PortalSelect className="form-control form-control-sm mt-1" value={filters.archived} onChange={event => update({ archived: event.target.value as DocumentFilters['archived'] })}>
                      <option value="">Current files</option>
                      <option value="1">Archived files{summary?.archived ? ` (${summary.archived})` : ''}</option>
                    </PortalSelect>
                  </label>
                )}
              </>
            )}
          </WorkspaceFilterCard>

          {applied.length > 0 && (
            <ul aria-label="Filters in use" className="flex flex-wrap items-center gap-2">
              {applied.map(item => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => update({ [item.key]: '' } as Partial<DocumentFilters>)}
                    aria-label={`Remove the filter ${item.label}`}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-indigo-50 py-1 pl-3 pr-2 text-[12px] font-bold text-indigo-800 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                  >
                    {item.label}
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {loading ? (
            <LoadingState message="Loading files..." />
          ) : error ? (
            <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />
          ) : !rows.length ? (
            <EmptyState
              title={applied.length || filters.q ? 'No files match these filters.' : filters.view === 'check' ? 'Nothing is waiting for a check.' : 'No files yet.'}
              description={applied.length || filters.q ? 'Remove a filter above, or clear them all.' : 'Files you upload, or that are shared with you, appear here.'}
            />
          ) : (
            <>
              <table aria-label="Files" className="data-table block table-fixed lg:table">
                <colgroup className="hidden lg:table-column-group">
                  {widths.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
                </colgroup>
                <thead className="hidden lg:table-header-group">
                  <tr className="data-thead bg-slate-50">{columns.map(column => <th key={column} scope="col" className="data-th">{column}</th>)}</tr>
                </thead>
                <tbody className="block space-y-3 lg:table-row-group lg:space-y-0">
                  {rows.map(document => {
                    const who = studentsLine(document.students);
                    const first = document.students[0];
                    const badge = checkBadge(document.checkStatus);
                    return (
                      <tr key={document.id} className="data-row grid grid-cols-2 rounded-xl border border-slate-200 py-2 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:py-0">
                        <td className="data-td-strong col-span-2 block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                          <div className="flex items-start gap-3">
                            {selecting && (
                              <input
                                type="checkbox"
                                className="mt-2.5 h-5 w-5 shrink-0 accent-brand-navy"
                                aria-label={`Select ${document.title}`}
                                checked={selected.includes(document.id)}
                                onChange={() => toggle(document.id)}
                              />
                            )}
                            <KindBadge kind={document.file?.kind} />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div>
                                <Link to={routeForDocument(document.id)} state={{ from }} className="block truncate text-[14px] font-bold text-brand-navy hover:underline">{document.title}</Link>
                                <p className="truncate text-[12px] font-normal text-slate-500">{document.type.label}</p>
                              </div>
                              <AutoTagChips tags={document.autoTags.filter(tag => ROW_TAGS.includes(tag.kind))} onPick={tag => update(tag.filter)} />
                            </div>
                          </div>
                        </td>
                        {!filters.student && (
                          <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle [overflow-wrap:anywhere] lg:col-span-1 lg:table-cell lg:px-5 lg:py-4">
                            <span className="card-label mb-1 block lg:hidden">Student</span>
                            {first ? (
                              <button type="button" className="block max-w-full truncate text-left text-[13px] font-bold text-slate-800 underline decoration-slate-300 underline-offset-4 hover:decoration-brand-navy" onClick={() => update({ ...EMPTY_DOCUMENT_FILTERS, student: first.matric, view: 'all' })} aria-label={`Show every file about ${first.name}`}>
                                {who.main}
                              </button>
                            ) : (
                              <p className="text-[13px] font-bold text-slate-800">{who.main}</p>
                            )}
                            <p className="card-caption mt-0.5 line-clamp-2">
                              {document.isStaffFile ? document.staffAudienceLabel : first ? `${first.matric}${first.programme ? ` · ${titleCase(first.programme)}` : ''}` : ''}
                            </p>
                          </td>
                        )}
                        <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                          <span className="card-label mb-1 block lg:hidden">Uploaded</span>
                          <p className="text-[13px]">{shortDocumentDate(document.uploadedAt)}</p>
                          <p className="card-caption mt-0.5 truncate">{uploadedLine(document.uploadedBy.name, document.uploadedBy.isMe)}</p>
                        </td>
                        <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                          <span className="card-label mb-1 block lg:hidden">Status</span>
                          {document.archived ? <ArchivedBadge /> : badge ? <StatusBadge tone={badge.tone} dot className="whitespace-nowrap">{badge.label}</StatusBadge> : <span className="text-[12.5px] text-slate-400">No check needed</span>}
                        </td>
                        <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                          <div className="flex items-center gap-2">
                            {document.checkStatus === 'WAITING' && document.permissions.canCheck ? (
                              <PortalButton size="sm" variant="primary" className="whitespace-nowrap" aria-label={`Review ${document.title}`} onClick={() => navigate(routeForDocument(document.id), { state: { from } })}>Review</PortalButton>
                            ) : (
                              <PortalButton size="sm" className="whitespace-nowrap" aria-label={`Open ${document.title}`} onClick={() => navigate(routeForDocument(document.id), { state: { from } })}>Open</PortalButton>
                            )}
                            <DownloadIconButton label={`Download ${document.title}`} busy={downloading === document.id} onClick={() => void download(document)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <WorkspacePagination
                page={Math.min(page, pageCount)}
                pageCount={pageCount}
                total={count}
                noun="files"
                onPage={setPage}
                pageSize={pageSize}
                onPageSize={size => {
                  setPageSize(workspacePageSize(size));
                  setPage(1);
                }}
              />
            </>
          )}
        </section>
      )}
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </div>
  );
};
