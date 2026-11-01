/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A student's File Submission: what the office still needs from them (required
// documents as a checklist), the files they have sent, and the letters the
// office has issued to them.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { ChevronRight, FolderOpen, ListChecks, Mail, Plus, Upload } from 'lucide-react';
import type { GeneratedLetter, MyRequiredDocument, PortalDocument } from '../types';
import { deleteDocument, downloadDocument, getDocuments, getMyRequiredDocuments } from '../services/filesApi';
import { getMyLetterRequests } from '../services/lettersApi';
import { APP_ROUTES, routeForDocument } from '../constants/routes';
import { checkBadge, requiredBadge, shortDocumentDate } from '../utils/documentDisplay';
import { isAppointmentLetter } from '../utils/letterDocument';
import { PageHeader, PortalButton, PortalConfirmModal, PortalToast, StatusBadge } from './PortalPrimitives';
import { OfficeToolViews } from './OfficeToolPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { AutoTagChips, KindBadge, OverflowMenu } from './DocumentParts';
import { LetterView, useLetterOutput } from './IssuedLetters';

type StudentFilesView = 'todo' | 'files' | 'letters';
const VIEWS: StudentFilesView[] = ['todo', 'files', 'letters'];

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const StudentFileSubmission: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [files, setFiles] = useState<PortalDocument[]>([]);
  const [letters, setLetters] = useState<GeneratedLetter[]>([]);
  const [required, setRequired] = useState<MyRequiredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lettersError, setLettersError] = useState(false);
  const [reload, setReload] = useState(0);
  const [category, setCategory] = useState('');
  const [deleting, setDeleting] = useState<PortalDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(
    typeof location.state?.message === 'string' ? { message: location.state.message, tone: 'success' } : null,
  );
  const showError = useCallback((message: string) => setToast({ message, tone: 'danger' }), []);
  const { viewLetter, printLetter, downloadPdf, isBusy, viewing, closeView } = useLetterOutput(showError);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getDocuments({ view: 'all' }, 0, 100),
      getMyRequiredDocuments().catch(() => [] as MyRequiredDocument[]),
    ])
      .then(([page, owed]) => {
        if (cancelled) return;
        setFiles(page.results);
        setRequired(owed);
      })
      .catch(err => !cancelled && setError(errorText(err, 'Could not load your files.')))
      .finally(() => !cancelled && setLoading(false));
    getMyLetterRequests()
      .then(found => {
        if (cancelled) return;
        setLetters(found.filter(letter => letter.status === 'Issued'));
        setLettersError(false);
      })
      .catch(() => !cancelled && setLettersError(true));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const requiredIds = new Set(required.map(item => item.documentId).filter(Boolean));
  const returnedElsewhere = files.filter(file => file.checkStatus === 'RETURNED' && !requiredIds.has(file.id));
  const owed = required.filter(item => item.state === 'MISSING' || item.state === 'RETURNED').length + returnedElsewhere.length;
  const handedIn = required.filter(item => item.state === 'DONE').length;
  const asked = params.get('tab') as StudentFilesView | null;
  const view: StudentFilesView = asked && VIEWS.includes(asked) ? asked : !loading && owed > 0 ? 'todo' : 'files';
  const changeView = (next: StudentFilesView) => {
    const updated = new URLSearchParams(params);
    updated.set('tab', next);
    setParams(updated, { replace: true });
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteDocument(deleting.id);
      setFiles(current => current.filter(file => file.id !== deleting.id));
      setToast({ message: `Deleted "${deleting.title}".`, tone: 'success' });
      setDeleting(null);
      setReload(value => value + 1);
    } catch (err) {
      setDeleting(null);
      showError(errorText(err, 'Could not delete this file.'));
    } finally {
      setBusy(false);
    }
  };

  const download = async (file: PortalDocument) => {
    try {
      await downloadDocument(file);
    } catch (err) {
      showError(errorText(err, 'Could not download this file.'));
    }
  };

  const from = `${location.pathname}${location.search}`;
  const upload = (dropped?: File, type?: string) =>
    navigate(type ? `${APP_ROUTES.filesUpload}?type=${encodeURIComponent(type)}` : APP_ROUTES.filesUpload, dropped ? { state: { droppedFile: dropped } } : undefined);
  const openFile = (id: number, newVersion = false) => navigate(routeForDocument(id), { state: { from, ...(newVersion ? { openNewVersion: true } : {}) } });
  const dropTarget = {
    onDragOver: (event: React.DragEvent<HTMLElement>) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event: React.DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) upload(dropped);
    },
  };
  const dropLook = dragging ? 'border-brand-navy bg-indigo-50' : 'border-slate-200';

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) {
      const label = file.autoTags.find(tag => tag.kind === 'category')?.label ?? file.groupLabel;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [files]);
  const shownFiles = category ? files.filter(file => (file.autoTags.find(tag => tag.kind === 'category')?.label ?? file.groupLabel) === category) : files;

  const requiredRow = (item: MyRequiredDocument) => {
    const file = files.find(candidate => candidate.id === item.documentId);
    const badge = requiredBadge(item.state, file?.checkStatus);
    const hint =
      item.state === 'MISSING'
        ? item.dueNote || 'The office needs this from every student.'
        : item.state === 'RETURNED'
          ? file?.checkReason ? `Returned: "${file.checkReason}"` : 'Returned by the office. Upload a corrected file.'
          : item.state === 'WAITING'
            ? `Sent ${shortDocumentDate(file?.uploadedAt)}. The office will check it.`
            : file?.checkedAt ? `Accepted ${shortDocumentDate(file.checkedAt)}` : `Sent ${shortDocumentDate(file?.uploadedAt)}`;
    const act = () => (item.state === 'MISSING' || !item.documentId ? upload(undefined, item.code) : openFile(item.documentId, item.state === 'RETURNED'));
    return (
      <li key={item.code}>
        <button
          type="button"
          onClick={act}
          aria-label={`${item.label}: ${badge.label}`}
          className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-navy sm:px-5"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-brand-navy">{item.label}</span>
            <span className={`block text-[12.5px] ${item.state === 'RETURNED' ? 'text-rose-700' : 'text-slate-500'}`}>{hint}</span>
          </span>
          <StatusBadge tone={badge.tone} dot>{badge.label}</StatusBadge>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-6 text-left font-sans pb-12">
      <PageHeader
        title="File Submission"
        subtitle="Hand in your documents and keep the letters the office gives you."
        actions={<PortalButton variant="primary" icon={Plus} onClick={() => upload()}>Upload a file</PortalButton>}
      />

      <OfficeToolViews<StudentFilesView>
        label="File Submission views"
        appearance="workspace"
        value={view}
        onChange={changeView}
        options={[
          { value: 'todo', label: owed ? `To do (${owed})` : 'To do', icon: ListChecks },
          { value: 'files', label: `My files (${files.length})`, icon: FolderOpen },
          { value: 'letters', label: `Letters from the office (${letters.length})`, icon: Mail },
        ]}
      />

      {loading ? (
        <LoadingState message="Loading your files..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />
      ) : view === 'todo' ? (
        <>
          {required.length > 0 && (
            <section aria-labelledby="required-heading" className="app-card overflow-hidden">
              <div className="space-y-3 px-5 pb-4 pt-5 sm:px-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 id="required-heading" className="section-label">Documents the office needs from you</h2>
                    <p className="card-description mt-1">Open one to hand it in, or to see where it is.</p>
                  </div>
                  <p className="text-[13px] font-semibold text-slate-700">{handedIn} of {required.length} handed in</p>
                </div>
                <div role="progressbar" aria-label="Required documents handed in" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={handedIn} className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${required.length ? (handedIn / required.length) * 100 : 0}%` }} />
                </div>
              </div>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">{required.map(requiredRow)}</ul>
            </section>
          )}
          {returnedElsewhere.length > 0 && (
            <section aria-labelledby="returned-heading" className="app-card overflow-hidden">
              <div className="px-5 pb-3 pt-5 sm:px-6">
                <h2 id="returned-heading" className="section-label">Returned to you</h2>
                <p className="card-description mt-1">The office sent these back. Upload a corrected file to each.</p>
              </div>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {returnedElsewhere.map(file => (
                  <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-brand-navy">{file.title}</p>
                      <p className="text-[12.5px] text-rose-700">"{file.checkReason}"{file.checkedBy ? ` ${file.checkedBy}, PG office` : ''}</p>
                    </div>
                    <PortalButton size="sm" icon={Upload} onClick={() => openFile(file.id, true)}>Upload again</PortalButton>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!required.length && !returnedElsewhere.length && (
            <section className="app-card">
              <EmptyState icon={ListChecks} title="Nothing to hand in right now" description="When the office asks you for a document, it shows here with what to do next." actionLabel="Upload a file" onAction={() => upload()} />
            </section>
          )}
        </>
      ) : view === 'files' ? (
        <section aria-labelledby="files-title" className="app-card overflow-hidden" {...dropTarget}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
            <div>
              <h2 id="files-title" className="section-label">My files</h2>
              <p className="card-description mt-1">Filed for you by type, semester and programme. Only you, the PG office and the staff shown on each file can see it.</p>
            </div>
          </div>
          {!files.length ? (
            <div className={`mx-5 mb-5 rounded-2xl border-2 border-dashed transition sm:mx-6 ${dropLook}`}>
              <EmptyState icon={Upload} title="You have not uploaded any files yet." description="Drag a file here, or upload forms, your thesis and other documents for the PG office." actionLabel="Upload a file" onAction={() => upload()} className="py-12" />
            </div>
          ) : (
            <>
              <div className={`mx-5 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed px-4 py-3 transition sm:mx-6 ${dropLook}`}>
                <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-600">
                  <Upload className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  Drag a file here to upload it
                </p>
              </div>
              {categories.length > 1 && (
                <div role="group" aria-label="Show files of one category" className="flex flex-wrap gap-2 px-5 pb-4 sm:px-6">
                  {[['', files.length] as [string, number], ...categories].map(([label, count]) => (
                    <button
                      key={label || 'all'}
                      type="button"
                      aria-pressed={category === label}
                      onClick={() => setCategory(label)}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${category === label ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      {label || 'All'} ({count})
                    </button>
                  ))}
                </div>
              )}
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {shownFiles.map(file => {
                  const badge = checkBadge(file.checkStatus);
                  return (
                    <li key={file.id} className="flex items-start gap-3 px-5 py-4 sm:items-center sm:px-6">
                      <KindBadge kind={file.file?.kind} />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div>
                          <Link to={routeForDocument(file.id)} state={{ from }} className="block truncate text-[14px] font-bold text-brand-navy hover:underline">{file.title}</Link>
                          <p className="truncate text-[12px] text-slate-500">{file.type.label} · uploaded {shortDocumentDate(file.uploadedAt)}</p>
                        </div>
                        <AutoTagChips tags={file.autoTags.filter(tag => tag.kind === 'category' || tag.kind === 'required' || tag.kind === 'semester')} />
                      </div>
                      {badge && <StatusBadge tone={badge.tone} dot className="hidden sm:inline-flex">{badge.label}</StatusBadge>}
                      <OverflowMenu
                        label={`Actions for ${file.title}`}
                        actions={[
                          { label: 'Open', onSelect: () => openFile(file.id) },
                          { label: 'Download', onSelect: () => void download(file) },
                          ...(file.permissions.canUploadVersion ? [{ label: 'Upload a new version', onSelect: () => openFile(file.id, true) }] : []),
                          ...(file.permissions.canDelete ? [{ label: 'Delete', danger: true, onSelect: () => setDeleting(file) }] : []),
                        ]}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ) : (
        <section aria-labelledby="letters-title" className="app-card overflow-hidden">
          <div className="px-5 pb-3 pt-5 sm:px-6">
            <h2 id="letters-title" className="section-label">Letters from the office</h2>
            <p className="card-description mt-1">Letters the office issued to you, including your appointment letters. Requests still waiting are in Letter Generation.</p>
          </div>
          {lettersError ? (
            <p className="border-t border-slate-100 px-5 py-4 text-[13px] text-slate-600 sm:px-6">Could not load your letters. <button type="button" className="font-bold text-blue-700" onClick={() => setReload(value => value + 1)}>Try again</button></p>
          ) : !letters.length ? (
            <p className="border-t border-slate-100 px-5 py-4 text-[13px] text-slate-600 sm:px-6">No approved letters yet. <Link to={APP_ROUTES.letters} className="font-bold text-blue-700">Request a letter</Link></p>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {letters.map(letter => (
                <li key={letter.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-slate-800">{letter.templateName}</p>
                    <p className="text-[12px] text-slate-500">
                      {letter.referenceNumber} · {isAppointmentLetter(letter.purpose) ? 'issued' : 'approved'} {shortDocumentDate(letter.decidedAt ?? letter.issuedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PortalButton size="sm" isLoading={isBusy(letter, 'view')} onClick={() => void viewLetter(letter)}>View</PortalButton>
                    <PortalButton size="sm" isLoading={isBusy(letter, 'print')} onClick={() => void printLetter(letter)}>Print</PortalButton>
                    <PortalButton size="sm" isLoading={isBusy(letter, 'pdf')} onClick={() => void downloadPdf(letter)}>Download</PortalButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {viewing && <LetterView letter={viewing} onClose={closeView} />}
      <PortalConfirmModal
        isOpen={deleting !== null}
        title={`Delete "${deleting?.title ?? ''}"?`}
        message="It will be gone for everyone, including older versions. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        tone="danger"
        isLoading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </div>
  );
};
