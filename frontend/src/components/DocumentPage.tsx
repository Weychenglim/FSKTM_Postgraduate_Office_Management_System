/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Archive, Check, CheckCircle2, Download, Upload } from 'lucide-react';
import type { DocumentAutoTag, DocumentDetail } from '../types';
import { checkDocument, deleteDocument, downloadDocument, getDocument, restoreDocument } from '../services/filesApi';
import { APP_ROUTES } from '../constants/routes';
import { checkSteps, historyTime, shortDocumentDate, studentsLine } from '../utils/documentDisplay';
import { filtersToParams } from '../utils/documentFilters';
import { PortalButton, PortalConfirmModal, PortalToast } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { ErrorState, LoadingState } from './StateViews';
import { AutoTagChips, OverflowMenu, type MenuAction } from './DocumentParts';
import { DocumentPreview } from './DocumentPreview';
import { ApprovalProcess } from './ApprovalProcess';
import { ArchiveDialog, EditDetailsDialog, NewVersionDialog, ReturnDialog, SharingDialog } from './DocumentDialogs';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

interface DocumentPageProps {
  documentId: string;
  isStudent: boolean;
  onBack: () => void;
}

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[12px] text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-[14px] font-semibold text-slate-800">{children}</dd>
  </div>
);

export const DocumentPage: React.FC<DocumentPageProps> = ({ documentId, isStudent, onBack }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);
  const [dialog, setDialog] = useState<'version' | 'edit' | 'return' | 'sharing' | 'archive' | null>(null);
  const [askedForVersion, setAskedForVersion] = useState(false);
  const uploadedReference = typeof location.state?.uploadedReference === 'string' ? location.state.uploadedReference : '';
  const from = typeof location.state?.from === 'string' ? location.state.from : '';
  const listLabel = isStudent ? 'File Submission' : 'Files';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDocument(documentId)
      .then(found => !cancelled && setDocument(found))
      .catch(err => !cancelled && setError(errorText(err, 'Could not open this file.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [documentId, reload]);

  useEffect(() => {
    if (!askedForVersion && document?.permissions.canUploadVersion && location.state?.openNewVersion) {
      setAskedForVersion(true);
      setDialog('version');
    }
  }, [document, askedForVersion, location.state]);

  const back = () => (from ? navigate(from) : onBack());

  const finished = (updated: DocumentDetail, message: string) => {
    setDocument(updated);
    setDialog(null);
    setToast({ message, tone: 'success' });
  };

  const accept = async () => {
    if (!document) return;
    setBusy('accept');
    try {
      const updated = await checkDocument(document.id, 'ACCEPT', '', document.file?.number);
      finished(updated, `Accepted. ${document.uploadedBy.name} has been told.`);
    } catch (err) {
      setToast({ message: errorText(err, 'Could not accept this file.'), tone: 'danger' });
      setReload(value => value + 1);
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!document) return;
    setBusy('restore');
    try {
      finished(await restoreDocument(document.id), 'Restored. Everyone it is shared with can see it again.');
    } catch (err) {
      setToast({ message: errorText(err, 'Could not restore this file.'), tone: 'danger' });
      setReload(value => value + 1);
    } finally {
      setBusy(null);
    }
  };

  const download = async (version?: number) => {
    if (!document) return;
    setBusy(`download:${version ?? 'current'}`);
    try {
      await downloadDocument(document, version);
    } catch (err) {
      setToast({ message: errorText(err, 'Could not download this file.'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!document) return;
    setBusy('delete');
    try {
      await deleteDocument(document.id);
      navigate(from || APP_ROUTES.files, { replace: true, state: { message: `Deleted "${document.title}".` } });
    } catch (err) {
      setConfirmDelete(false);
      setToast({ message: errorText(err, 'Could not delete this file.'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const menu: MenuAction[] = [
    ...(document?.permissions.canUploadVersion ? [{ label: 'Upload a new version', onSelect: () => setDialog('version') }] : []),
    ...(document?.permissions.canEdit ? [{ label: 'Edit details', onSelect: () => setDialog('edit') }] : []),
    ...(document?.permissions.canChangeSharing ? [{ label: 'Change who can see it', onSelect: () => setDialog('sharing') }] : []),
    ...(document?.permissions.canArchive ? [{ label: 'Archive', onSelect: () => setDialog('archive') }] : []),
    ...(document?.permissions.canDelete ? [{ label: 'Delete', danger: true, onSelect: () => setConfirmDelete(true) }] : []),
  ];
  // Staff open the file list filtered by a tag; students see their tags only.
  const openTag = isStudent ? undefined : (tag: DocumentAutoTag) => navigate(`${APP_ROUTES.files}?${filtersToParams(tag.filter).toString()}`);
  const steps = document ? checkSteps(document) : [];
  const who = document ? studentsLine(document.students) : null;
  const subtitle = document
    ? [document.type.label, document.isStaffFile ? 'Staff file' : who?.main, `uploaded ${shortDocumentDate(document.uploadedAt)}`].filter(Boolean).join(' · ')
    : undefined;

  return (
    <RecordPage
      title={document?.title ?? 'File'}
      subtitle={subtitle}
      backLabel={`Back to ${listLabel}`}
      onBack={back}
      metadata={document && document.autoTags.length ? <AutoTagChips tags={document.autoTags} onPick={openTag} /> : undefined}
      actions={document ? (
        <div className="flex items-center gap-2">
          <PortalButton icon={Download} isLoading={busy === 'download:current'} onClick={() => void download()}>Download</PortalButton>
          <OverflowMenu label="More actions" actions={menu} />
        </div>
      ) : undefined}
    >
      {loading ? (
        <LoadingState message="Opening the file..." />
      ) : error || !document ? (
        <ErrorState message={error ?? 'This file isn’t available to you.'} onRetry={() => setReload(value => value + 1)} />
      ) : (
        <div className="space-y-5">
          {uploadedReference && (
            <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-[14px] font-semibold text-emerald-900">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              Uploaded. The reference is {uploadedReference}.
            </div>
          )}
          {document.archived && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-300 bg-slate-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <Archive className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                <div>
                  <p className="text-[15px] font-extrabold text-slate-800">Archived{document.archivedBy ? ` by ${document.archivedBy}` : ''}{document.archivedAt ? `, ${shortDocumentDate(document.archivedAt)}` : ''}</p>
                  {document.archiveReason && <p className="mt-1 text-[14px] text-slate-700">"{document.archiveReason}"</p>}
                  <p className="mt-1 text-[13px] text-slate-600">Only the PG office can see it.</p>
                </div>
              </div>
              {document.permissions.canRestore && (
                <PortalButton variant="primary" isLoading={busy === 'restore'} onClick={() => void restore()}>Restore</PortalButton>
              )}
            </div>
          )}
          {!document.archived && document.checkStatus === 'RETURNED' && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
              <div>
                <p className="text-[15px] font-extrabold text-rose-800">Returned by the PG office</p>
                <p className="mt-1 text-[14px] text-rose-800">"{document.checkReason}"{document.checkedBy ? ` ${document.checkedBy}, ${shortDocumentDate(document.checkedAt)}` : ''}</p>
              </div>
              {document.permissions.canUploadVersion && document.uploadedBy.isMe && (
                <PortalButton icon={Upload} onClick={() => setDialog('version')}>Upload corrected file</PortalButton>
              )}
            </div>
          )}
          {!document.archived && document.checkStatus === 'WAITING' && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <div>
                <p className="text-[15px] font-extrabold text-amber-900">{document.permissions.canCheck ? 'Waiting for you to check' : 'Waiting for the PG office to check it'}</p>
                {document.permissions.canCheck && (document.file?.number ?? 1) > 1 && (
                  <p className="mt-1 text-[14px] text-amber-900">This is version {document.file?.number}. Earlier versions are listed under Versions.</p>
                )}
              </div>
              {document.permissions.canCheck && (
                <div className="flex flex-wrap gap-2">
                  <PortalButton variant="danger" disabled={busy === 'accept'} onClick={() => setDialog('return')}>Return to student</PortalButton>
                  <PortalButton variant="success" icon={Check} isLoading={busy === 'accept'} onClick={() => void accept()}>Accept</PortalButton>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <DocumentPreview document={document} />

            <div className="space-y-5">
              {steps.length > 0 && !document.archived && (
                <div className="app-card p-5">
                  <ApprovalProcess steps={steps} title="Office check" />
                </div>
              )}
              <section aria-label="Details" className="app-card space-y-4 p-5">
                <h2 className="section-label">Details</h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-[12px] text-slate-500">{document.isStaffFile ? 'Staff file' : document.students.length > 1 ? 'Students' : 'Student'}</dt>
                    <dd className="mt-0.5 space-y-1 text-[14px] font-semibold text-slate-800">
                      {document.isStaffFile ? (
                        <span>{document.staffAudienceLabel}{document.staffProgrammes.length ? `, ${document.staffProgrammes.join(', ')}` : ''}</span>
                      ) : document.students.map(student => (
                        <span key={student.matric} className="block">
                          {isStudent ? student.name : (
                            <Link to={`${APP_ROUTES.files}?student=${encodeURIComponent(student.matric)}`} className="underline decoration-slate-300 underline-offset-4 hover:decoration-brand-navy">{student.name}</Link>
                          )}
                          <span className="font-normal text-slate-500">, {student.matric}</span>
                        </span>
                      ))}
                    </dd>
                  </div>
                  <Fact label="Type">{document.type.label}</Fact>
                  <Fact label="Semester">{document.semester?.label ?? 'Not linked'}</Fact>
                  <Fact label="Reference">{document.reference}</Fact>
                  <Fact label="Uploaded by">{document.uploadedBy.isMe ? 'You' : `${document.uploadedBy.name} (${document.uploadedBy.roleLabel.toLowerCase()})`}</Fact>
                  {document.description && <div className="sm:col-span-2"><Fact label="Note">{document.description}</Fact></div>}
                </dl>
              </section>

              <section aria-label="Shared with" className="app-card space-y-3 p-5">
                <h2 className="section-label">Shared with</h2>
                <ul className="space-y-2 text-[14px] text-slate-800">
                  {document.sharedWith.map(person => (
                    <li key={`${person.name}-${person.role}`}>
                      {person.name}{person.role && person.role !== 'always' ? <span className="text-slate-500"> ({person.role})</span> : null}
                    </li>
                  ))}
                </ul>
                {!document.isStaffFile && <p className="text-[12px] text-slate-500">{isStudent ? 'You always see your own uploads.' : 'Students see only the files they upload themselves.'}</p>}
              </section>

              {document.versions.length > 1 && (
                <section aria-label="Versions" className="app-card space-y-3 p-5">
                  <h2 className="section-label">Versions</h2>
                  <ul className="space-y-2">
                    {document.versions.map((version, index) => (
                      <li key={version.number} className="flex items-center justify-between gap-3 text-[14px]">
                        <span className="font-semibold text-slate-800">Version {version.number}{index === 0 ? ' (current)' : ''}</span>
                        <span className="flex items-center gap-3 text-slate-500">
                          {shortDocumentDate(version.uploadedAt)}
                          <button type="button" className="font-bold text-blue-700 hover:text-blue-900" onClick={() => void download(version.number)}>Download</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {document.history && document.history.length > 0 && (
                <section aria-label="History" className="app-card space-y-3 p-5">
                  <h2 className="section-label">History</h2>
                  <ol className="space-y-3">
                    {document.history.map(entry => (
                      <li key={entry.id} className="text-[13px]">
                        <p className="font-semibold text-slate-800">{entry.actionLabel}{entry.detail ? <span className="font-normal text-slate-600">: {entry.detail}</span> : null}</p>
                        {entry.reason && <p className="text-slate-700">"{entry.reason}"</p>}
                        <p className="text-[12px] text-slate-500">{entry.actor}, {historyTime(entry.at)}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
      <PortalConfirmModal
        isOpen={confirmDelete}
        title={`Delete "${document?.title ?? 'this file'}"?`}
        message="It will be gone for everyone who can see it, including older versions. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        tone="danger"
        isLoading={busy === 'delete'}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
      {document && (
        <>
          <NewVersionDialog document={document} isOpen={dialog === 'version'} onClose={() => setDialog(null)} onDone={finished} />
          <EditDetailsDialog document={document} isOpen={dialog === 'edit'} onClose={() => setDialog(null)} onDone={finished} />
          <ReturnDialog document={document} isOpen={dialog === 'return'} onClose={() => setDialog(null)} onDone={finished} />
          <SharingDialog document={document} isOpen={dialog === 'sharing'} onClose={() => setDialog(null)} onDone={finished} />
          <ArchiveDialog document={document} isOpen={dialog === 'archive'} onClose={() => setDialog(null)} onDone={finished} />
        </>
      )}
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </RecordPage>
  );
};
