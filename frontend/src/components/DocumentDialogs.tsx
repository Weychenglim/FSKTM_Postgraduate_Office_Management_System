/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { isStaffFileSharing, type DocumentDetail, type DocumentSharing, type DocumentSharingOptions, type StaffAudience } from '../types';
import { addDocumentVersion, archiveDocument, checkDocument, getDocumentSharing, updateDocument, updateDocumentSharing } from '../services/filesApi';
import { ApiError, fieldErrors } from '../services/apiClient';
import { formatFileSize } from '../utils/documentDisplay';
import { acceptAttribute, kindForName } from '../utils/documentUpload';
import { peopleLine, STAFF_AUDIENCES } from '../utils/documentSharing';
import { PortalButton } from './PortalPrimitives';
import { PortalModal, useModalTitle } from './PortalModal';
import { KindBadge } from './DocumentParts';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

interface DialogProps {
  document: DocumentDetail;
  isOpen: boolean;
  onClose: () => void;
  onDone: (document: DocumentDetail, message: string) => void;
}

export const DialogShell: React.FC<{ title: string; titleId: string; isOpen: boolean; busy: boolean; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }> = ({
  title, titleId, isOpen, busy, onClose, children, footer,
}) => (
  <PortalModal isOpen={isOpen} onClose={onClose} busy={busy} labelledBy={titleId} className="max-w-lg p-0">
    <div className="space-y-4 px-6 pb-2 pt-6">
      <h2 id={titleId} className="text-[18px] font-extrabold text-brand-navy">{title}</h2>
      {children}
    </div>
    <div className="flex justify-end gap-3 px-6 pb-6 pt-4">{footer}</div>
  </PortalModal>
);

/** A corrected or newer file. The older versions stay on the file page. */
export const NewVersionDialog: React.FC<DialogProps> = ({ document, isOpen, onClose, onDone }) => {
  const titleId = useModalTitle();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setNote('');
      setProblem(null);
    }
  }, [isOpen]);

  const send = async () => {
    if (!file) {
      setProblem('Choose the new file.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const updated = await addDocumentVersion(document.id, file, note);
      onDone(updated, updated.file ? `Version ${updated.file.number} added.` : 'New version added.');
    } catch (err) {
      const fields = err instanceof ApiError && err.status === 400 ? fieldErrors(err) : {};
      setProblem(fields.file || fields.note || errorText(err, 'Could not upload the new version.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title="Upload a new version"
      titleId={titleId}
      isOpen={isOpen}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>Cancel</PortalButton>
        <PortalButton variant="primary" icon={Upload} isLoading={busy} onClick={() => void send()}>Upload</PortalButton>
      </>}
    >
      <p className="text-[13px] text-slate-600">
        The new file replaces what people see. Older versions stay listed on this page.
        {document.checkStatus === 'RETURNED' || document.checkStatus === 'ACCEPTED' ? ' The PG office will check it again.' : ''}
      </p>
      <input ref={input} type="file" className="sr-only" accept={acceptAttribute(['PDF', 'DOCX', 'IMAGE', 'XLSX', 'PPTX'])} onChange={event => setFile(event.target.files?.[0] ?? null)} />
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <KindBadge kind={kindForName(file.name)} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-brand-navy">{file.name}</p>
              <p className="text-[12px] text-slate-500">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <PortalButton size="sm" onClick={() => input.current?.click()}>Change</PortalButton>
        </div>
      ) : (
        <button type="button" className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-[14px] font-bold text-brand-navy hover:border-brand-navy" onClick={() => input.current?.click()}>
          <Upload className="h-6 w-6 text-slate-400" aria-hidden="true" />
          Choose the new file
        </button>
      )}
      <label className="block space-y-1.5">
        <span className="text-[13px] font-bold text-slate-700">What changed? (optional)</span>
        <input className="form-control form-control-md text-[14px]" maxLength={300} value={note} onChange={event => setNote(event.target.value)} placeholder="For example: signed by the Head of Department" />
      </label>
      {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
    </DialogShell>
  );
};

/** Title and note. Tags are the system's. */
export const EditDetailsDialog: React.FC<DialogProps> = ({ document, isOpen, onClose, onDone }) => {
  const titleId = useModalTitle();
  const [title, setTitle] = useState(document.title);
  const [note, setNote] = useState(document.description);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(document.title);
      setNote(document.description);
      setProblem(null);
    }
  }, [isOpen, document]);

  const save = async () => {
    if (!title.trim()) {
      setProblem('Give the file a title.');
      return;
    }
    setBusy(true);
    try {
      const updated = await updateDocument(document.id, { title: title.trim(), description: note });
      onDone(updated, 'Details saved.');
    } catch (err) {
      const fields = err instanceof ApiError && err.status === 400 ? fieldErrors(err) : {};
      setProblem(fields.title || fields.description || errorText(err, 'Could not save the details.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title="Edit details"
      titleId={titleId}
      isOpen={isOpen}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>Cancel</PortalButton>
        <PortalButton variant="primary" isLoading={busy} onClick={() => void save()}>Save</PortalButton>
      </>}
    >
      <label className="block space-y-1.5">
        <span className="text-[13px] font-bold text-slate-700">Title</span>
        <input className="form-control form-control-md text-[14px]" maxLength={200} value={title} onChange={event => setTitle(event.target.value)} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-[13px] font-bold text-slate-700">Note</span>
        <textarea className="form-control min-h-20 px-3.5 py-3 text-[14px]" maxLength={1000} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
    </DialogShell>
  );
};

const QUICK_REASONS = [
  'A signature is missing.',
  'This is the wrong form.',
  'The scan is hard to read. Please scan it again.',
];

/** Return a waiting file with what to fix. */
export const ReturnDialog: React.FC<DialogProps> = ({ document, isOpen, onClose, onDone }) => {
  const titleId = useModalTitle();
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const student = document.students[0]?.name ?? document.uploadedBy.name;

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setProblem(null);
    }
  }, [isOpen]);

  const send = async () => {
    if (!reason.trim()) {
      setProblem('Say what to fix.');
      return;
    }
    setBusy(true);
    try {
      const updated = await checkDocument(document.id, 'RETURN', reason.trim(), document.file?.number);
      onDone(updated, `Returned to ${document.uploadedBy.name}.`);
    } catch (err) {
      setProblem(errorText(err, 'Could not return the file.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={`What should ${student} fix?`}
      titleId={titleId}
      isOpen={isOpen}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>Cancel</PortalButton>
        <PortalButton variant="primary" isLoading={busy} disabled={!reason.trim()} onClick={() => void send()}>Return to student</PortalButton>
      </>}
    >
      <label className="block space-y-1.5">
        <span className="sr-only">Reason</span>
        <textarea autoFocus className="form-control min-h-24 px-3.5 py-3 text-[14px]" maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="The student sees this and can upload a corrected file" />
      </label>
      <div className="flex flex-wrap gap-2">
        {QUICK_REASONS.map(text => (
          <button key={text} type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setReason(text)}>
            {text.replace(' Please scan it again.', '').replace(/\.$/, '')}
          </button>
        ))}
      </div>
      {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
    </DialogShell>
  );
};

const NO_SHARING: DocumentSharing = { supervisors: false, panel: false, coordinator: false };

/** Who can see a file: the three ticks for a student file, the audience for a staff file. */
export const SharingDialog: React.FC<DialogProps> = ({ document, isOpen, onClose, onDone }) => {
  const titleId = useModalTitle();
  const [options, setOptions] = useState<DocumentSharingOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [share, setShare] = useState<DocumentSharing>(NO_SHARING);
  const [audience, setAudience] = useState<StaffAudience>('ACADEMIC');
  const [programme, setProgramme] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setOptions(null);
    setLoadError(null);
    setProblem(null);
    getDocumentSharing(document.id)
      .then(found => {
        if (cancelled) return;
        setOptions(found);
        if (isStaffFileSharing(found)) {
          setAudience(found.audience);
          setProgramme(found.programmes[0] ?? '');
        } else {
          setShare(found.share);
        }
      })
      .catch(err => !cancelled && setLoadError(errorText(err, 'Could not load who can see this file.')));
    return () => {
      cancelled = true;
    };
  }, [isOpen, document.id, attempt]);

  const save = async () => {
    if (!options) return;
    setBusy(true);
    setProblem(null);
    try {
      const updated = await updateDocumentSharing(
        document.id,
        isStaffFileSharing(options) ? { audience, programmes: audience === 'OFFICE' || !programme ? [] : [programme] } : share,
      );
      onDone(updated, 'Sharing saved.');
    } catch (err) {
      const fields = fieldErrors(err);
      setProblem(fields.audience || fields.programmes || errorText(err, 'Could not save who can see this file.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title="Who can see this file?"
      titleId={titleId}
      isOpen={isOpen}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>Cancel</PortalButton>
        <PortalButton variant="primary" isLoading={busy} disabled={!options} onClick={() => void save()}>Save</PortalButton>
      </>}
    >
      {loadError ? (
        <ErrorState message={loadError} onRetry={() => setAttempt(value => value + 1)} />
      ) : !options ? (
        <LoadingState message="Loading..." />
      ) : isStaffFileSharing(options) ? (
        <>
          <fieldset className="space-y-1">
            <legend className="sr-only">Who can see it</legend>
            {STAFF_AUDIENCES.map(item => (
              <label key={item.value} className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2">
                <input type="radio" name="sharing-audience" className="mt-0.5 h-5 w-5 accent-brand-navy" checked={audience === item.value} onChange={() => setAudience(item.value)} />
                <span>
                  <span className="block text-[14px] font-bold text-slate-800">{item.label}</span>
                  <span className="block text-[12px] text-slate-500">{item.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {audience !== 'OFFICE' && (
            <SelectMenu<string>
              aria-label="Programme"
              variant="filter"
              prefix="Programme"
              value={programme}
              options={[{ value: '', label: 'All programmes', triggerLabel: 'All' }, ...options.allProgrammes.map(item => ({ value: item, label: item }))]}
              onChange={setProgramme}
            />
          )}
          <p className="text-[12px] text-slate-500">Students never see staff files.</p>
        </>
      ) : (
        <>
          {([
            ['supervisors', 'Supervisors', peopleLine(options.people.supervisors, 'No supervisor yet')],
            ['panel', 'Panel member', peopleLine(options.people.panel, 'No panel member yet')],
            ['coordinator', 'Programme coordinator', peopleLine(options.people.coordinator, 'None')],
          ] as const).map(([key, label, people]) => (
            <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-1.5">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-navy" checked={share[key]} onChange={() => setShare(current => ({ ...current, [key]: !current[key] }))} />
              <span>
                <span className="block text-[14px] font-bold text-slate-800">{label}</span>
                <span className="block text-[13px] text-slate-500">{people}</span>
              </span>
            </label>
          ))}
          <p className="text-[12px] text-slate-500">The PG office and the uploader always see it.</p>
          {options.followsType && (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-700">Right now this file follows the settings for {document.type.label}. If you change it here, it keeps your choice.</p>
          )}
        </>
      )}
      {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
    </DialogShell>
  );
};

const ARCHIVE_REASONS = ['Uploaded by mistake.', 'Replaced by a newer file.', 'No longer needed.'];

/** The office takes a file out of use. It is kept, and can be restored. */
export const ArchiveDialog: React.FC<DialogProps> = ({ document, isOpen, onClose, onDone }) => {
  const titleId = useModalTitle();
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setProblem(null);
    }
  }, [isOpen]);

  const send = async () => {
    if (!reason.trim()) {
      setProblem('Say why it is archived.');
      return;
    }
    setBusy(true);
    try {
      const updated = await archiveDocument(document.id, reason.trim());
      onDone(updated, 'Archived. Only the PG office can see it now.');
    } catch (err) {
      setProblem(fieldErrors(err).reason || errorText(err, 'Could not archive this file.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={`Archive "${document.title}"?`}
      titleId={titleId}
      isOpen={isOpen}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>Cancel</PortalButton>
        <PortalButton variant="danger" isLoading={busy} disabled={!reason.trim()} onClick={() => void send()}>Archive</PortalButton>
      </>}
    >
      <p className="text-[13px] text-slate-600">The file is kept, but only the PG office can see it. You can restore it at any time.</p>
      <label className="block space-y-1.5">
        <span className="sr-only">Reason</span>
        <textarea className="form-control min-h-20 px-3.5 py-3 text-[14px]" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Why is it archived?" />
      </label>
      <div className="flex flex-wrap gap-2">
        {ARCHIVE_REASONS.map(text => (
          <button key={text} type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setReason(text)}>
            {text.replace(/\.$/, '')}
          </button>
        ))}
      </div>
      {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
    </DialogShell>
  );
};
