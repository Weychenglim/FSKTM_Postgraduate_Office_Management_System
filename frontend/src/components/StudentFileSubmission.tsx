/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A student's File Submission: one row for each document they hand in, grouped
// by research project stage with their own stage first, and the letters the
// office has issued to them. Each row sends its file in one step.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { FileText, FolderOpen, Loader2, Mail, Plus, Upload } from 'lucide-react';
import type { DocumentOptions, DocumentTypeOption, GeneratedLetter, PortalDocument } from '../types';
import { addDocumentVersion, deleteDocument, downloadDocument, getDocumentOptions, getDocuments, uploadDocument } from '../services/filesApi';
import { fieldErrors } from '../services/apiClient';
import { getMyLetterRequests } from '../services/lettersApi';
import type { MySubmission } from '../services/submissionsApi';
import { getMySubmissions, sendSubmission } from '../services/submissionsApi';
import { APP_ROUTES, routeForDocument } from '../constants/routes';
import { shortDocumentDate } from '../utils/documentDisplay';
import { addLabel, documentSlots, type DocumentSlot, type SlotTone } from '../utils/documentSlots';
import { acceptAttribute, acceptedKinds, fileProblem, titleFromFileName } from '../utils/documentUpload';
import { durationText } from '../utils/submissions';
import { isAppointmentLetter } from '../utils/letterDocument';
import { PageHeader, PortalButton, PortalConfirmModal, PortalToast } from './PortalPrimitives';
import { OfficeToolViews } from './OfficeToolPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { OverflowMenu, type MenuAction } from './DocumentParts';
import { LetterView, useLetterOutput } from './IssuedLetters';

type StudentFilesView = 'documents' | 'letters';
type Target = { slot: DocumentSlot | null; type: DocumentTypeOption };

const TONE: Record<SlotTone, string> = {
  due: 'font-semibold text-amber-700',
  late: 'font-semibold text-amber-700',
  sent: 'text-emerald-700',
  plain: 'text-slate-500',
  closed: 'font-semibold text-rose-700',
};

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const sendError = (err: unknown) => {
  const fields = fieldErrors(err);
  return fields.file || fields.type || errorText(err, 'Could not send the file.');
};
const keyOf = (target: Target) => target.slot?.key ?? `add-${target.type.code}`;

export const StudentFileSubmission: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [options, setOptions] = useState<DocumentOptions | null>(null);
  const [files, setFiles] = useState<PortalDocument[]>([]);
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [letters, setLetters] = useState<GeneratedLetter[]>([]);
  const [serverNow, setServerNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lettersError, setLettersError] = useState(false);
  const [reload, setReload] = useState(0);
  const [sending, setSending] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PortalDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const picking = useRef<Target | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(
    typeof location.state?.message === 'string' ? { message: location.state.message, tone: 'success' } : null,
  );
  const showError = useCallback((message: string) => setToast({ message, tone: 'danger' }), []);
  const { viewLetter, printLetter, downloadPdf, isBusy, viewing, closeView } = useLetterOutput(showError);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([
      getDocumentOptions(),
      getDocuments({ view: 'all' }, 0, 100),
      getMySubmissions().catch(() => ({ submissions: [] as MySubmission[], now: new Date().toISOString() })),
    ])
      .then(([found, page, dated]) => {
        if (cancelled) return;
        setOptions(found);
        setFiles(page.results);
        setSubmissions(dated.submissions);
        setServerNow(new Date(dated.now).getTime() || Date.now());
      })
      .catch(err => !cancelled && setError(errorText(err, 'Could not load your documents.')))
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

  const view: StudentFilesView = params.get('tab') === 'letters' ? 'letters' : 'documents';
  const changeView = (next: StudentFilesView) => {
    const updated = new URLSearchParams(params);
    updated.set('tab', next);
    setParams(updated, { replace: true });
  };
  const from = `${location.pathname}${location.search}`;
  const openFile = (id: number) => navigate(routeForDocument(id), { state: { from } });

  const send = async (file: File, target: Target) => {
    const problem = fileProblem(file, target.type, false, options?.maxBytes ?? 10 * 1024 * 1024);
    if (problem) {
      showError(problem);
      return;
    }
    const name = target.slot?.name ?? target.type.label;
    setSending(keyOf(target));
    try {
      if (target.slot?.submission) {
        const sent = await sendSubmission(target.slot.submission.id, file);
        setToast({ message: sent.lateBySeconds ? `${name} sent, ${durationText(sent.lateBySeconds)} late.` : `${name} sent, on time.`, tone: 'success' });
      } else if (target.slot?.document) {
        await addDocumentVersion(target.slot.document.id, file);
        setToast({ message: `New version of ${name} sent.`, tone: 'success' });
      } else {
        const title = target.type.onePerStudent ? target.type.label : titleFromFileName(file.name);
        await uploadDocument({ file, type: target.type.code, title, description: '', semester: '', students: [], acknowledgeWarnings: true });
        setToast({ message: `${name} sent.`, tone: 'success' });
      }
      setReload(value => value + 1);
    } catch (err) {
      showError(sendError(err));
    } finally {
      setSending(null);
    }
  };

  const choose = (target: Target) => {
    const input = picker.current;
    if (!input) return;
    picking.current = target;
    input.accept = acceptAttribute(acceptedKinds(target.type, false));
    input.click();
  };

  const dropZone = (key: string, target: Target | null) =>
    target && !sending
      ? {
          onDragOver: (event: React.DragEvent<HTMLElement>) => {
            if (!event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            setDropOn(key);
          },
          onDragLeave: (event: React.DragEvent<HTMLElement>) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropOn(null);
          },
          onDrop: (event: React.DragEvent<HTMLElement>) => {
            event.preventDefault();
            setDropOn(null);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) void send(dropped, target);
          },
        }
      : {};

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteDocument(deleting.id);
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

  const groups = options ? documentSlots(options.types, options.me?.stage ?? '', files, submissions, serverNow) : [];

  const row = (slot: DocumentSlot) => {
    const target = slot.type && slot.action ? { slot, type: slot.type } : null;
    const document = slot.document;
    const here = sending === slot.key;
    const menu: MenuAction[] = document
      ? [
          { label: 'Open', onSelect: () => openFile(document.id) },
          { label: 'Download', onSelect: () => void download(document) },
          ...(document.permissions.canDelete && !slot.submission ? [{ label: 'Delete', danger: true, onSelect: () => setDeleting(document) }] : []),
        ]
      : [];
    return (
      <li
        key={slot.key}
        className={`flex min-h-18 items-center gap-3.5 px-4 py-3.5 transition-colors sm:px-5 ${dropOn === slot.key ? 'bg-indigo-50 ring-2 ring-inset ring-brand-navy' : ''}`}
        {...dropZone(slot.key, target)}
      >
        <span aria-hidden="true" className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:flex">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {document ? (
            <Link to={routeForDocument(document.id)} state={{ from }} className="block truncate text-[14.5px] font-bold text-brand-navy hover:underline">{slot.name}</Link>
          ) : (
            <p className="truncate text-[14.5px] font-bold text-brand-navy">{slot.name}</p>
          )}
          <p className={`mt-0.5 text-[12.5px] ${TONE[slot.tone]}`}>{slot.line}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {target && (
            <PortalButton
              variant={slot.action === 'Upload' && (slot.tone === 'due' || slot.tone === 'late') ? 'primary' : 'secondary'}
              icon={slot.action === 'Upload' ? Upload : undefined}
              isLoading={here}
              disabled={Boolean(sending) && !here}
              aria-label={`${slot.action} ${slot.name}`}
              className="w-24 sm:w-28"
              onClick={() => choose(target)}
            >
              {slot.action}
            </PortalButton>
          )}
          {menu.length ? <OverflowMenu label={`More for ${slot.name}`} actions={menu} /> : <span aria-hidden="true" className="h-10 w-10" />}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6 pb-12 text-left font-sans">
      <PageHeader title="File Submission" />

      <OfficeToolViews<StudentFilesView>
        label="File Submission views"
        appearance="workspace"
        value={view}
        onChange={changeView}
        options={[
          { value: 'documents', label: 'Documents', icon: FolderOpen },
          { value: 'letters', label: `Letters from the office (${letters.length})`, icon: Mail },
        ]}
      />

      <input
        ref={picker}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={event => {
          const chosen = event.target.files?.[0];
          event.target.value = '';
          if (chosen && picking.current) void send(chosen, picking.current);
        }}
      />

      {loading ? (
        <LoadingState message="Loading your documents..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />
      ) : view === 'documents' ? (
        !groups.length ? (
          <section className="app-card">
            <EmptyState icon={FolderOpen} title="Nothing to hand in right now" />
          </section>
        ) : (
          <div className="space-y-7">
            {groups.map(group => {
              const add = group.addType ? { slot: null, type: group.addType } : null;
              const addKey = add ? keyOf(add) : '';
              return (
                <section key={group.key} aria-labelledby={`documents-${group.key}`} className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <h2 id={`documents-${group.key}`} className="text-[12.5px] font-bold uppercase tracking-wider text-slate-500">{group.label}</h2>
                    {group.now && <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11.5px] font-bold text-indigo-800">Now</span>}
                  </div>
                  <div className="app-card overflow-hidden">
                    {group.rows.length > 0 && <ul className="divide-y divide-slate-100">{group.rows.map(row)}</ul>}
                    {add && (
                      <button
                        type="button"
                        disabled={Boolean(sending)}
                        onClick={() => choose(add)}
                        className={`flex min-h-18 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-60 sm:px-5 ${group.rows.length ? 'border-t border-slate-100' : ''} ${dropOn === addKey ? 'bg-indigo-50 ring-2 ring-inset ring-brand-navy' : ''}`}
                        {...dropZone(addKey, add)}
                      >
                        <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center text-blue-700 sm:h-11 sm:w-11 sm:rounded-xl sm:border sm:border-dashed sm:border-blue-300 sm:bg-blue-50">
                          {sending === addKey ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                        </span>
                        <span className="text-[14.5px] font-bold text-blue-700">{addLabel(add.type)}</span>
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : (
        <section aria-labelledby="letters-title" className="app-card overflow-hidden">
          <div className="px-5 pb-3 pt-5 sm:px-6">
            <h2 id="letters-title" className="section-label">Letters from the office</h2>
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
