/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import type { FaqDocumentSummary } from '../types';
import { fieldErrors } from '../services/apiClient';
import {
  downloadFaqDocument,
  getFaqDocuments,
  renameFaqDocument,
  replaceFaqDocument,
  stepFaqDocument,
  uploadFaqDocument,
} from '../services/faqApi';
import { documentState } from '../utils/faqOffice';
import { shortDocumentDate } from '../utils/documentDisplay';
import { PortalButton, PortalToast } from './PortalPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { AppointmentSection } from './AppointmentPrimitives';
import { WorkspaceSectionHeader } from './RequestWorkspacePrimitives';
import { OverflowMenu } from './DocumentParts';
import { DialogShell } from './DocumentDialogs';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const problemOf = (err: unknown, fallback: string) => fieldErrors(err).file || fieldErrors(err).title || errorText(err, fallback);

const RenameDialog: React.FC<{ document: FaqDocumentSummary | null; onClose: () => void; onDone: (updated: FaqDocumentSummary) => void }> = ({ document, onClose, onDone }) => {
  const titleId = useId();
  const inputId = useId();
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setProblem(null);
    }
  }, [document]);

  const save = async () => {
    if (!document) return;
    setBusy(true);
    try {
      onDone(await renameFaqDocument(document.id, title));
    } catch (err) {
      setProblem(problemOf(err, 'Could not rename the document.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title="Rename document"
      titleId={titleId}
      isOpen={Boolean(document)}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>Cancel</PortalButton>
        <PortalButton variant="primary" isLoading={busy} disabled={!title.trim()} onClick={() => void save()}>Save</PortalButton>
      </>}
    >
      <label htmlFor={inputId} className="block text-[13px] font-bold text-slate-700">Title</label>
      <input id={inputId} className="form-control form-control-md text-[14px]" maxLength={200} value={title} onChange={event => setTitle(event.target.value)} />
      <p className="text-[12px] text-slate-500">Students see it as "From {title || 'this title'}".</p>
      {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
    </DialogShell>
  );
};

/** Reference documents the chatbot quotes from when no FAQ entry fits. */
export const FaqDocumentsTab: React.FC = () => {
  const ids = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<FaqDocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<FaqDocumentSummary | null>(null);
  const [renaming, setRenaming] = useState<FaqDocumentSummary | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);

  const load = useCallback(() => {
    setError(null);
    getFaqDocuments().then(setDocuments).catch(err => setError(errorText(err, 'Could not load the documents.')));
  }, []);

  useEffect(load, [load]);

  const changed = (updated: FaqDocumentSummary, message: string) => {
    setDocuments(current => (current ?? []).map(item => (item.id === updated.id ? updated : item)));
    setToast({ message, tone: updated.status === 'NO_TEXT' && !updated.archived ? 'danger' : 'success' });
  };

  const upload = async () => {
    if (!file) return;
    setBusy('upload');
    setProblem(null);
    try {
      const added = await uploadFaqDocument(file, title.trim());
      setDocuments(current => [added, ...(current ?? [])]);
      setTitle('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setToast(
        added.status === 'READY'
          ? { message: `Uploaded. ${added.passages} passages are ready for the chatbot.`, tone: 'success' }
          : { message: 'Uploaded, but no text was found in it. A scanned PDF needs a text version.', tone: 'danger' },
      );
    } catch (err) {
      setProblem(problemOf(err, 'Could not upload the document.'));
    } finally {
      setBusy(null);
    }
  };

  const replace = async (chosen: File | undefined) => {
    const target = replacing;
    if (replaceInput.current) replaceInput.current.value = '';
    setReplacing(null);
    if (!target || !chosen) return;
    setBusy(target.id);
    try {
      const updated = await replaceFaqDocument(target.id, chosen);
      changed(updated, updated.status === 'READY' ? `Replaced. ${updated.passages} passages are ready.` : 'Replaced, but no text was found in the new file.');
    } catch (err) {
      setToast({ message: problemOf(err, 'Could not replace the file.'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const step = async (target: FaqDocumentSummary, name: 'archive' | 'restore') => {
    setBusy(target.id);
    try {
      changed(await stepFaqDocument(target.id, name), name === 'archive' ? 'Archived. The chatbot no longer quotes it.' : 'Restored. The chatbot can quote it again.');
    } catch (err) {
      setToast({ message: errorText(err, 'Could not change the document.'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const download = async (target: FaqDocumentSummary) => {
    try {
      await downloadFaqDocument(target.id, target.fileName);
    } catch (err) {
      setToast({ message: errorText(err, 'Could not download the document.'), tone: 'danger' });
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!documents) return <LoadingState message="Loading documents..." />;
  return (
    <div className="space-y-5">
      <AppointmentSection
        title="Add a reference document"
        description="A handbook or guide. When no answer fits a question, the chatbot can show a short passage from it, marked as an extract. PDF or Word, up to 10 MB. Scanned PDFs have no text to search."
        icon={Upload}
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-1.5">
            <label htmlFor={`${ids}-title`} className="form-label block">Title (optional)</label>
            <input id={`${ids}-title`} className="form-control form-control-md text-[14px]" maxLength={200} value={title} placeholder="Postgraduate Handbook 2026" onChange={event => setTitle(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${ids}-file`} className="form-label block">File</label>
            <input
              ref={fileInput}
              id={`${ids}-file`}
              type="file"
              accept=".pdf,.docx"
              className="block w-full text-[13px] text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-[12px] file:font-bold file:text-slate-700"
              onChange={event => {
                setFile(event.target.files?.[0] ?? null);
                setProblem(null);
              }}
            />
          </div>
          <PortalButton variant="primary" icon={Upload} isLoading={busy === 'upload'} disabled={!file} onClick={() => void upload()}>Upload</PortalButton>
        </div>
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </AppointmentSection>

      <section aria-label="Reference documents" className="app-card appointment-workspace-card">
        <WorkspaceSectionHeader title="Reference documents" description="The chatbot quotes from ready documents when no answer fits. Archived documents are not quoted." />
        {documents.length === 0 ? (
          <EmptyState title="No reference documents yet." description="Add a handbook or guide above." />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {documents.map(item => {
              const state = documentState(item);
              return (
                <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-slate-900 [overflow-wrap:anywhere]">{item.title}</p>
                      <p className="text-[12px] text-slate-500 [overflow-wrap:anywhere]">
                        {item.fileName} · {item.size}{item.pages ? ` · ${item.pages} ${item.pages === 1 ? 'page' : 'pages'}` : ''} · {item.uploadedBy ? `${item.uploadedBy}, ` : ''}{shortDocumentDate(item.uploadedAt)}
                      </p>
                      <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${state.className}`}>{state.label}</p>
                    </div>
                  </div>
                  <OverflowMenu
                    label={`More actions for ${item.title}`}
                    actions={[
                      { label: 'Download', onSelect: () => void download(item) },
                      { label: 'Rename', onSelect: () => setRenaming(item) },
                      { label: 'Replace the file', onSelect: () => { setReplacing(item); replaceInput.current?.click(); }, disabled: busy === item.id },
                      item.archived
                        ? { label: 'Restore', onSelect: () => void step(item, 'restore') }
                        : { label: 'Archive', onSelect: () => void step(item, 'archive') },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <input ref={replaceInput} type="file" accept=".pdf,.docx" className="hidden" aria-hidden="true" tabIndex={-1} onChange={event => void replace(event.target.files?.[0])} />
      <RenameDialog document={renaming} onClose={() => setRenaming(null)} onDone={updated => { setRenaming(null); changed(updated, 'Renamed.'); }} />
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </div>
  );
};
