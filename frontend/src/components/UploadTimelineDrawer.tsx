import {useDecisionFeedback} from './DecisionFeedback';
import React, { useEffect, useRef, useState } from 'react';
import { Download, UploadCloud } from 'lucide-react';
import { RecordPage } from './RecordPage';
import { PortalButton } from './PortalPrimitives';
import { AlertMessage } from './AlertMessage';
import { TimelineEntry, TimelineUploadPreview } from '../types';
import { downloadTimelineTemplate, previewTimelineFile, saveBlob, timelineEntryToLegacy, uploadTimelineFile } from '../services';
import { validateTimelineUploadFile } from '../utils/timelineUploadValidation';

interface UploadTimelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (events: TimelineEntry[], importedCount?: number) => void | Promise<void>;
  semesterId: number;
  semesterLabel: string;
  embedded?: boolean;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}

export const UploadTimelineDrawer: React.FC<UploadTimelineDrawerProps> = ({ isOpen, onClose, onImportSuccess, semesterId, semesterLabel, embedded = false, onCancel, onDirtyChange, onBusyChange }) => {
  const feedback = useDecisionFeedback();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TimelineUploadPreview | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [templateFeedback, setTemplateFeedback] = useState<{ type: 'info' | 'error'; message: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const templateGeneration = useRef(0);

  useEffect(() => {
    generation.current += 1;
    templateGeneration.current += 1;
    setFile(null);
    setPreview(null);
    setPreviewPage(1);
    setAcknowledged(false);
    setMessage(null);
    setTemplateFeedback(null);
    setBusy(false);
    return () => { templateGeneration.current += 1; };
  }, [semesterId, isOpen]);

  const chooseFile = (candidate: File | null) => {
    if (busy) return;
    generation.current += 1;
    setPreview(null);
    setPreviewPage(1);
    setAcknowledged(false);
    const error = candidate && validateTimelineUploadFile(candidate);
    setFile(error ? null : candidate);
    setMessage(error || null);
  };

  const handlePreview = async () => {
    if (!file || busy) return;
    const current = generation.current;
    setBusy(true);
    setPreview(null);
    setPreviewPage(1);
    setAcknowledged(false);
    setMessage(null);
    try {
      const result = await previewTimelineFile(file, semesterId);
      if (generation.current === current) setPreview(result);
    } catch (error) {
      if (generation.current === current) setMessage(error instanceof Error ? error.message : 'Preview failed.');
    } finally {
      if (generation.current === current) setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!file || !preview || busy || (preview.requiresAcknowledgement && !acknowledged)) return;
    const current = generation.current;
    setBusy(true);
    setMessage(null);
    try {
      const result = await uploadTimelineFile(file, semesterId, preview.previewToken, acknowledged);
      if (generation.current !== current) return;
      setFile(null);
      setPreview(null);
      setPreviewPage(1);
      setAcknowledged(false);
      // The mutation is committed. Refresh cannot turn it back into a retryable import.
      onClose();
      void Promise.resolve().then(() => onImportSuccess?.(result.timeline.levels.flatMap(group => group.entries.map(timelineEntryToLegacy)), result.importedCount)).catch(() => {
        feedback?.('Import committed. The latest calendar could not be loaded. Reload before another action.', 'warning');
      });
    } catch (error) {
      if (generation.current === current) {
        setMessage(error instanceof Error ? error.message : 'Import failed. Preview the workbook again.');
        setPreview(null);
      setPreviewPage(1);
        setAcknowledged(false);
      }
    } finally {
      if (generation.current === current) setBusy(false);
    }
  };

  const download = async () => {
    const current = ++templateGeneration.current;
    setTemplateFeedback(null);
    try {
      const blob = await downloadTimelineTemplate(semesterId);
      if (templateGeneration.current !== current) return;
      saveBlob(blob, 'FSKTM_Semester_Timeline_Template.xlsx');
      const prepared = 'Timeline template prepared. Your browser will handle the download.';
      setTemplateFeedback({ type: 'info', message: prepared });
      feedback?.(prepared, 'info');
    } catch (error) {
      if (templateGeneration.current === current) setTemplateFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Template download failed.' });
    }
  };

  useEffect(() => { onDirtyChange?.(!!file); }, [file, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  if (!isOpen) return null;
  const renderImport = (requestBack: () => void) =>
    <section className={embedded ? "space-y-5" : "space-y-5 rounded-2xl border border-slate-200 bg-white p-5"}>

      <AlertMessage type="warning" title="Import replaces this semester’s timeline" message="Preview the file and review its events before confirming. Previewing makes no changes." />
      <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center space-y-3"
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); chooseFile(event.dataTransfer.files[0] || null); }}>
        <UploadCloud className="mx-auto h-6 w-6 text-slate-500" />
        <input ref={input} type="file" aria-label="Timeline workbook" accept=".xlsx" disabled={busy} className="hidden"
          onChange={event => chooseFile(event.target.files?.[0] || null)} />
        <p className="card-description">{file ? file.name : 'Drop an Excel .xlsx workbook here (maximum 10 MB).'}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <PortalButton variant="secondary" onClick={() => input.current?.click()} disabled={busy}>Browse File</PortalButton>
        {file && <PortalButton variant="ghost" disabled={busy} onClick={() => { chooseFile(null); if (input.current) input.current.value = ''; }}>Clear Selected File</PortalButton>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="card-description">Need the required format?</span><PortalButton variant="ghost" size="sm" icon={Download} onClick={download} disabled={busy}>Download template</PortalButton></div>
      {templateFeedback && <AlertMessage type={templateFeedback.type} title={templateFeedback.type === 'error' ? 'Template download needs attention' : 'Template ready'} message={templateFeedback.message} />}
      {preview && <div className="space-y-4" aria-label="Import preview">
        <div><h3 className="section-heading">Review {preview.importedCount} {preview.importedCount === 1 ? 'event' : 'events'}</h3><p className="card-description mt-2">No changes have been saved. Review all events before importing.</p></div>
        {preview.warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <ul className="list-disc pl-5 text-sm">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          {preview.requiresAcknowledgement && <label className="flex gap-2 text-sm"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} />I have reviewed and acknowledge these warnings.</label>}
        </div>}
        <div className="overflow-x-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label="Events to import">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr>{['Category', 'Event', 'Starts on', 'Ends on'].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{preview.rows.slice((previewPage - 1) * 10, previewPage * 10).map(row => <tr key={`${row.level}-${row.step}`} className="border-t border-slate-100 align-top">
              <td className="px-4 py-4 text-slate-600">Research Project {row.level === 'P1' ? '1 (P1)' : '2 (P2)'}</td>
              <td className="min-w-[180px] max-w-xs break-words px-4 py-4 font-medium text-slate-900">{row.title}</td>
              <td className="whitespace-nowrap px-4 py-4 text-slate-600">{row.deadlineStart}</td>
              <td className="whitespace-nowrap px-4 py-4 text-slate-600">{row.deadlineEnd}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {preview.rows.length > 10 && <nav aria-label="Import preview pages" className="flex flex-wrap items-center justify-between gap-3">
          <p className="card-description" role="status">Showing {(previewPage - 1) * 10 + 1}–{Math.min(previewPage * 10, preview.rows.length)} of {preview.rows.length} events</p>
          <div className="flex items-center gap-3">
            <PortalButton size="sm" disabled={busy || previewPage === 1} onClick={() => setPreviewPage(page => page - 1)}>Previous</PortalButton>
            <span className="text-sm text-slate-600">Page {previewPage} of {Math.ceil(preview.rows.length / 10)}</span>
            <PortalButton size="sm" disabled={busy || previewPage * 10 >= preview.rows.length} onClick={() => setPreviewPage(page => page + 1)}>Next</PortalButton>
          </div>
        </nav>}
      </div>}
      {message && <AlertMessage type="error" title="Timeline import needs attention" message={message} />}
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
        <PortalButton variant="secondary" disabled={busy} onClick={requestBack}>Cancel</PortalButton>
        {!preview && <PortalButton variant="primary" disabled={!file || busy} isLoading={busy} onClick={handlePreview}>Preview import</PortalButton>}
        {preview && <PortalButton variant="primary" icon={UploadCloud} disabled={busy || (preview.requiresAcknowledgement && !acknowledged)} isLoading={busy} onClick={handleConfirm}>{`Import ${preview.importedCount} ${preview.importedCount === 1 ? 'event' : 'events'}`}</PortalButton>}
      </div>
    </section>
  ;
  return embedded ? renderImport(onCancel ?? onClose) : <RecordPage title="Import Timeline" subtitle={semesterLabel} backLabel="Back to Timeline Management" onBack={onClose} pageKey="timeline-import" dirty={!!file} busy={busy}>{renderImport}</RecordPage>;
};
