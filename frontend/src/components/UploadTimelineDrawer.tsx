import {useDecisionFeedback} from './DecisionFeedback';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { RecordPage } from './RecordPage';
import { PortalButton } from './PortalPrimitives';
import { PortalSelect } from './PortalSelect';
import { AlertMessage } from './AlertMessage';
import { TimelineEntry, TimelineUploadPreview } from '../types';
import { downloadTimelineTemplate, previewTimelineFile, saveBlob, timelineEntryToLegacy, uploadTimelineFile } from '../services';
import { validateTimelineUploadFile } from '../utils/timelineUploadValidation';
import { ApiError } from '../services/apiClient';
import { hasDifferentDates, TimelineLinkReview, type TimelineLinkChoice } from './TimelineLinkReview';

export type TimelineImportStage = 'upload' | 'links' | 'review';

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
  onStageChange?: (stage: TimelineImportStage) => void;
}

export const UploadTimelineDrawer: React.FC<UploadTimelineDrawerProps> = ({ isOpen, onClose, onImportSuccess, semesterId, semesterLabel, embedded = false, onCancel, onDirtyChange, onBusyChange, onStageChange }) => {
  const feedback = useDecisionFeedback();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'ADD' | 'REPLACE'>('ADD');
  const [preview, setPreview] = useState<TimelineUploadPreview | null>(null);
  const [stage, setStage] = useState<TimelineImportStage>('upload');
  const [linkPreview, setLinkPreview] = useState<TimelineUploadPreview | null>(null);
  const [linkChoices, setLinkChoices] = useState<Record<number, TimelineLinkChoice>>({});
  const [previewPage, setPreviewPage] = useState(1);
  const [importReviewed, setImportReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [templateFeedback, setTemplateFeedback] = useState<{ type: 'info' | 'error'; message: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const content = useRef<HTMLElement>(null);
  const generation = useRef(0);
  const templateGeneration = useRef(0);

  useEffect(() => {
    generation.current += 1;
    templateGeneration.current += 1;
    setFile(null);
    setMode('ADD');
    setPreview(null);
    setLinkPreview(null);
    setStage('upload');
    setLinkChoices({});
    setPreviewPage(1);
    setImportReviewed(false);
    setMessage(null);
    setTemplateFeedback(null);
    setBusy(false);
    return () => { templateGeneration.current += 1; };
  }, [semesterId, isOpen]);

  const chooseFile = (candidate: File | null) => {
    if (busy) return;
    generation.current += 1;
    setPreview(null);
    setLinkPreview(null);
    setStage('upload');
    setLinkChoices({});
    setPreviewPage(1);
    setImportReviewed(false);
    const error = candidate && validateTimelineUploadFile(candidate);
    setFile(error ? null : candidate);
    setMessage(error || null);
  };

  const pendingLinks = preview?.linkConflicts ?? [];
  const workbookRows = new Map(preview?.rows.map(row => [String(row.position), row]));
  const resolvedChoices = pendingLinks.map(event => {
    const choice = linkChoices[event.entryId];
    if (choice?.row === 'keep') return [event.entryId, 'keep'] as const;
    const row = choice && workbookRows.get(choice.row);
    if (!row) return null;
    if (!hasDifferentDates(event, row)) return [event.entryId, `match:${choice.row}`] as const;
    return choice.keepWindowDates ? [event.entryId, `keep-dates:${choice.row}`] as const : null;
  });
  const reviewedLinks = resolvedChoices.length > 0 && resolvedChoices.every(choice => choice !== null);
  const requiresImportReview = mode === 'REPLACE' || !!preview?.requiresAcknowledgement;
  const reviewCount = preview?.rows.length ?? 0;

  const handlePreview = async (resolveLinks = false) => {
    if (!file || busy) return;
    const token = preview?.linkReviewToken;
    if (resolveLinks && (!token || !reviewedLinks)) return;
    const current = generation.current;
    setBusy(true);
    if (!resolveLinks) {
      setPreview(null);
    }
    setPreviewPage(1);
    setImportReviewed(false);
    setMessage(null);
    try {
      const result = await previewTimelineFile(file, semesterId, mode, resolveLinks && token
        ? { token, choices: Object.fromEntries(resolvedChoices.filter(choice => choice !== null)) }
        : undefined);
      if (generation.current === current) {
        setPreview(result);
        if (!resolveLinks) setLinkPreview(result.linkConflicts?.length ? result : null);
        setStage(result.previewToken ? 'review' : 'links');
      }
    } catch (error) {
      if (generation.current === current) {
        setMessage(error instanceof Error ? error.message : 'Preview failed.');
        if (error instanceof ApiError && error.status === 409) {
          setPreview(null);
          setLinkPreview(null);
          setStage('upload');
          setLinkChoices({});
        }
      }
    } finally {
      if (generation.current === current) setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!file || !preview?.previewToken || busy || (requiresImportReview && !importReviewed)) return;
    const current = generation.current;
    setBusy(true);
    setMessage(null);
    try {
      const result = await uploadTimelineFile(file, semesterId, preview.previewToken, preview.requiresAcknowledgement && importReviewed, mode);
      if (generation.current !== current) return;
      setFile(null);
      setPreview(null);
      setLinkChoices({});
      setPreviewPage(1);
      setImportReviewed(false);
      // The mutation is committed. Refresh cannot turn it back into a retryable import.
      onClose();
      void Promise.resolve().then(() => onImportSuccess?.(result.timeline.levels.flatMap(group => group.entries.map(timelineEntryToLegacy)), result.importedCount)).catch(() => {
        feedback?.('Import committed. The latest calendar could not be loaded. Reload before another action.', 'warning');
      });
    } catch (error) {
      if (generation.current === current) {
        setMessage(error instanceof Error ? error.message : 'Import failed. Preview the workbook again.');
        setPreview(null);
        setLinkPreview(null);
        setStage('upload');
        setLinkChoices({});
        setPreviewPage(1);
        setImportReviewed(false);
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
  useEffect(() => { onStageChange?.(stage); }, [stage, onStageChange]);
  useEffect(() => {
    if (!isOpen || content.current?.closest('[hidden]')) return;
    const dialog = content.current?.closest('dialog');
    const heading = embedded ? dialog?.querySelector<HTMLElement>('h2') : content.current?.querySelector<HTMLElement>('h3');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    if (dialog) dialog.scrollTop = 0;
  }, [stage, embedded, isOpen]);

  const back = () => {
    setImportReviewed(false);
    setMessage(null);
    if (stage === 'review' && linkPreview) {
      setPreview(linkPreview);
      setStage('links');
    } else {
      setStage('upload');
    }
  };

  if (!isOpen) return null;
  const renderImport = (requestBack: () => void) =>
    <section ref={content} className={embedded ? "space-y-6" : "space-y-6 rounded-2xl border border-slate-200 bg-white p-5"}>

      {stage === 'upload' ? <>
        <label className="form-label block">Import action<PortalSelect aria-label="Import action" className="form-control form-control-md mt-2 w-full" value={mode} disabled={busy} onChange={event => {
          setMode(event.target.value as 'ADD' | 'REPLACE'); generation.current += 1; setPreview(null); setLinkPreview(null); setLinkChoices({}); setImportReviewed(false); setPreviewPage(1);
        }}><option value="ADD">Add events</option><option value="REPLACE">Replace calendar</option></PortalSelect></label>
        <AlertMessage type={mode === 'REPLACE' ? 'warning' : 'info'} title={mode === 'REPLACE' ? 'Replace the calendar draft' : 'Add to the calendar draft'} message="Import saves a draft. Publish calendar after review to make changes visible to selected audiences. Previewing makes no changes." />
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
      </> : <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
          <FileSpreadsheet aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold leading-5 text-slate-900 [overflow-wrap:anywhere]">{file?.name}</p>
          <p className="text-xs leading-5 text-slate-500">{mode === 'REPLACE' ? 'Replace calendar draft' : 'Add to calendar draft'}</p>
        </div>
        <button type="button" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy} onClick={() => { setImportReviewed(false); setMessage(null); setStage('upload'); }}>
          <ArrowLeftRight aria-hidden="true" className="size-4" />
          Change file
        </button>
      </div>}
      {stage === 'links' && preview && <TimelineLinkReview preview={preview} semesterId={semesterId} choices={linkChoices} busy={busy}
        onChoice={(entryId, choice) => setLinkChoices(current => ({ ...current, [entryId]: choice }))} />}
      {stage === 'review' && preview?.previewToken && <div className="space-y-5" aria-label="Import preview">
        <div>
          <h3 className="section-heading">Review {reviewCount} {reviewCount === 1 ? 'event' : 'events'}</h3>
          <p className="card-description mt-1" role="status">{preview.existingCount} in current draft · {preview.resultingCount} after import{preview.carriedCount > 0 && ` · ${preview.carriedCount} linked ${preview.carriedCount === 1 ? 'event kept' : 'events kept'}`}</p>
        </div>
        {preview.warnings.length > 0 && <section aria-label="Date warnings" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <h4 className="font-semibold">Date warnings</h4>
          <ul className="list-disc space-y-1 pl-5">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        </section>}
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
        {requiresImportReview && <label className="flex items-start gap-3 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-800">
          <input type="checkbox" className="mt-1 size-4 shrink-0" checked={importReviewed} disabled={busy} onChange={event => setImportReviewed(event.target.checked)} />
          <span>{mode === 'REPLACE'
            ? preview.requiresAcknowledgement
              ? 'I’ve reviewed the warnings and want to replace the calendar draft.'
              : 'Replace the calendar draft with the events shown above.'
            : 'I’ve reviewed the date warnings.'}</span>
        </label>}
      </div>}
      {message && <AlertMessage type="error" title="Timeline import needs attention" message={message} />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <PortalButton variant="secondary" disabled={busy} onClick={stage === 'upload' ? requestBack : back}>{stage === 'upload' ? 'Cancel' : 'Back'}</PortalButton>
        {stage === 'upload' && <PortalButton variant="primary" disabled={!file || busy} isLoading={busy} onClick={() => void handlePreview()}>Preview import</PortalButton>}
        {stage === 'links' && <PortalButton variant="primary" disabled={busy || !reviewedLinks} isLoading={busy} onClick={() => void handlePreview(true)}>Review replacement</PortalButton>}
        {stage === 'review' && preview?.previewToken && <PortalButton variant="primary" icon={UploadCloud} disabled={busy || (requiresImportReview && !importReviewed)} isLoading={busy} onClick={handleConfirm}>{`Import ${preview.importedCount} ${preview.importedCount === 1 ? 'event' : 'events'}`}</PortalButton>}
      </div>
    </section>
  ;
  return embedded ? renderImport(onCancel ?? onClose) : <RecordPage title="Import Timeline" subtitle={semesterLabel} backLabel="Back to Timeline Management" onBack={onClose} pageKey="timeline-import" dirty={!!file} busy={busy}>{renderImport}</RecordPage>;
};
