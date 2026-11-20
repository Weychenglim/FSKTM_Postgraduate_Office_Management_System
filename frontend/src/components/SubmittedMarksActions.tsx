import { PencilLine, RotateCcw, X } from 'lucide-react';
import { PortalModal, useModalTitle } from './PortalModal';
import { DecisionDialog } from './DecisionDialog';
import { completeDecision } from '../utils/decisionSubmission';
import { useRecordDraft } from './RecordDraft';
import React, {useEffect, useRef, useState} from 'react';
import type {MarkRecordDetail} from '../types';
import {correctSubmittedMarkRecord, reopenSubmittedMarkRecord} from '../services/marksApi';
import {validateSubmittedMarksCorrection} from '../utils/submittedMarksCorrection';
import {formatMalaysiaDateTimeCompact as formatMalaysiaDateTime} from '../utils/malaysiaDateTime';
import {PortalButton, PortalConfirmModal} from './PortalPrimitives';
import {AlertMessage} from './AlertMessage';

interface SubmittedMarksActionsProps {
  record: MarkRecordDetail;
  onChanged: (message: string) => Promise<void>;
  onReload: () => Promise<void>;
}

export function SubmittedMarksActions({record, onChanged, onReload}: SubmittedMarksActionsProps) {
  const modalTitle = useModalTitle();
  const [mode, setMode] = useState<'correct' | 'reopen' | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [editingFeedback, setEditingFeedback] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [awaitingLatest, setAwaitingLatest] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);

  const components = record.rubric.components.filter(component => component.marksAwarded !== null);
  const editedScores = components.some(component => values[component.id] !== (component.marksAwarded || '0'));
  const changedFeedback = components.filter(component => (feedback[component.id] ?? component.feedback ?? '') !== (component.feedback ?? ''));
  const dirty = !!mode && (!!reason.trim() || (mode === 'correct' && (editedScores || changedFeedback.length > 0 || comments !== record.entry.comments)));
  useRecordDraft(dirty, busy);
  const actions = record.officeActions;
  const eligible = record.entry.status === 'SUBMITTED' && !!actions?.version && !!(actions.canCorrect || actions.canReopen);
  const original = {comments: record.entry.comments, components};
  const correctedTotal = components.reduce((total, component) => total + Number(values[component.id] || 0), 0).toFixed(2);
  const changedScores = components.filter(component => Number(values[component.id]) !== Number(component.marksAwarded));
  const clearAction = () => {setMode(null); setValues({}); setFeedback({}); setEditingFeedback(null); setComments(''); setReason(''); setError(''); setConfirmOpen(false);};
  const requestClose = () => {if (dirty) setDiscardOpen(true); else clearAction();};
  const choose = (next: 'correct' | 'reopen') => {
    setMode(next); setError(''); setReason(''); setComments(record.entry.comments);
    setValues(Object.fromEntries(components.map(component => [component.id, component.marksAwarded || '0'])));
  };
  const review = () => {
    const validation = mode === 'correct'
      ? validateSubmittedMarksCorrection(original, values, comments, reason, feedback)
      : !reason.trim() ? 'Enter a reopening reason.' : null;
    setError(validation || '');
    if (!validation) setConfirmOpen(true);
  };
  const submit = async () => {
    if (submitting.current || awaitingLatest || !eligible || !mode || !actions?.version) return false;
    submitting.current = true; setBusy(true);
    try {
      const outcome = await completeDecision(async () => {
        if (mode === 'correct') {
          await correctSubmittedMarkRecord(record.recordId, {
            expectedVersion: actions!.version!, reason: reason.trim(),
            ...(comments !== record.entry.comments ? {comments} : {}),
            scores: changedScores
              .map(component => ({componentId: Number(component.id), marksAwarded: values[component.id]})),
            ...(changedFeedback.length ? {feedback: changedFeedback.map(component => ({componentId: Number(component.id), feedback: feedback[component.id]}))} : {}),
          });
        } else {
          await reopenSubmittedMarkRecord(record.recordId, {expectedVersion: actions!.version!, reason: reason.trim()});
        }
        clearAction();
      }, onReload);
      setAwaitingLatest(!!outcome.refreshFailed);
      return outcome;
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  };

  const reviewLatest = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await onReload();
      clearAction();
      setAwaitingLatest(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to reload the latest mark record.');
    } finally { setBusy(false); }
  };

  return <>{eligible ? <div className="mt-6 border-t border-slate-200 pt-5">
    {awaitingLatest && error ? <AlertMessage type="error" message={error} className="mt-3"/> : null}
    {awaitingLatest ? <div className="mt-4 space-y-3">
      <p className="card-description text-amber-800">Your change was saved. Review the latest mark record before making another Office change.</p>
      <PortalButton disabled={busy} onClick={() => void reviewLatest()}>Review latest record</PortalButton>
    </div> : <>
      {!mode ? <div className="submission-actions flex flex-wrap justify-end gap-3">
        {actions?.canCorrect ? <PortalButton variant="primary" icon={PencilLine} onClick={() => choose('correct')}>Correct submitted marks</PortalButton> : null}
        {actions?.canReopen ? <PortalButton icon={RotateCcw} onClick={() => choose('reopen')}>Reopen for Lecturer</PortalButton> : null}
      </div> : <PortalModal isOpen={!!mode && !confirmOpen} busy={busy} labelledBy={modalTitle} className="max-w-3xl p-6 sm:p-8" onClose={requestClose}><div className={mode === 'correct' ? 'space-y-4' : 'space-y-6'}>
        <div className={`flex justify-between gap-4 ${mode === 'correct' ? 'items-center' : 'items-start border-b border-slate-200 pb-5'}`}>
          <h3 id={modalTitle} className="text-base font-semibold text-slate-900">{mode === 'correct' ? 'Correct submitted marks' : 'Reopen for Lecturer'}</h3>
          <button type="button" aria-label="Close dialog" disabled={busy} onClick={requestClose} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50"><X className="size-4" aria-hidden="true"/></button>
        </div>
        {error && !awaitingLatest ? <AlertMessage type="error" message={error}/> : null}
        {mode === 'correct' ? <>
          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {components.map(component => {
              const initialFeedback = component.feedback ?? '';
              const currentFeedback = feedback[component.id] ?? initialFeedback;
              const feedbackPreview = currentFeedback.trim();
              const componentId = String(component.id);
              const expanded = editingFeedback === componentId;
              const feedbackId = `${modalTitle}-feedback-${component.id}`;
              const feedbackAction = expanded ? 'Done' : feedbackPreview ? 'Edit' : 'Add';
              return <div key={component.id} className="space-y-1 px-4 py-2.5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <p className="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{component.name}</p>
                  <label className="flex items-center gap-1.5 text-sm tabular-nums text-slate-600">
                    <span className="sr-only">{component.name} score (maximum {component.maxMarks})</span>
                    <span className="w-20 shrink-0 sm:w-24">
                      <input type="number" min="0" max={component.maxMarks} step="0.01" disabled={busy}
                        className="form-control min-h-10 px-3 py-2 text-sm text-right" value={values[component.id] || ''}
                        onChange={event => setValues(current => ({...current, [component.id]: event.target.value}))}/>
                    </span>
                    <span aria-hidden="true" className="w-[10ch] whitespace-nowrap">/ {component.maxMarks}</span>
                  </label>
                </div>
                <div className="min-w-0">
                  <button type="button" disabled={busy} aria-expanded={expanded} aria-controls={feedbackId}
                    aria-label={`${expanded ? 'Done editing' : feedbackAction} feedback for ${component.name}`}
                    className="grid min-h-9 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    onClick={() => setEditingFeedback(expanded ? null : componentId)}>
                    <span className="flex min-w-0 items-center gap-2">
                      {expanded || feedbackPreview ? <span className="shrink-0 font-medium text-slate-700">Feedback</span> : null}
                      {!expanded ? <span className="min-w-0 truncate text-slate-600" title={feedbackPreview || undefined}>{feedbackPreview || 'No feedback'}</span> : null}
                      {currentFeedback !== initialFeedback ? <span className="shrink-0 font-medium text-slate-500">Edited</span> : null}
                    </span>
                    <span className="w-8 text-right font-semibold text-blue-700">{feedbackAction}</span>
                  </button>
                  <div id={feedbackId} hidden={!expanded} className="px-2 pb-1">
                    {expanded ? <textarea rows={3} autoFocus aria-label={`Feedback for ${component.name}`} disabled={busy}
                      className="form-control block w-full px-3 py-2.5 text-sm" value={currentFeedback}
                      onChange={event => setFeedback(current => ({...current, [component.id]: event.target.value}))}/> : null}
                  </div>
                </div>
              </div>;
            })}
            <dl className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-b-lg bg-blue-50 px-4 py-3">
              <dt className="text-sm font-semibold text-slate-900">Total mark</dt>
              <dd className="whitespace-nowrap text-sm tabular-nums text-slate-600">
                <span className="text-lg font-semibold text-slate-900">{Number.isFinite(Number(correctedTotal)) ? correctedTotal : '–'}</span> / {record.rubric.targetMark}
              </dd>
            </dl>
          </div>
          <label className="form-label block">Overall comments<textarea className="form-control mt-2 min-h-24 px-3 py-2.5 text-sm font-normal" disabled={busy} value={comments} onChange={event => setComments(event.target.value)}/></label>
        </> : <p className="card-description text-slate-600">Scores and comments are preserved. The entry returns to Draft so its assigned Lecturer can review and resubmit while the period remains open.</p>}
        <label className="form-label block">{mode === 'correct' ? 'Correction reason' : 'Reopening reason'}<textarea className="form-control mt-2 min-h-24 px-3 py-2.5 text-sm font-normal" required disabled={busy} value={reason} onChange={event => setReason(event.target.value)}/></label>
        <div className={`flex flex-wrap justify-end gap-3 border-t border-slate-200 ${mode === 'correct' ? 'pt-4' : 'pt-5'}`}>
          <PortalButton disabled={busy} onClick={requestClose}>Cancel</PortalButton>
          <PortalButton variant="primary" disabled={busy || !reason.trim()} onClick={review}>{mode === 'correct' ? 'Review correction' : 'Review reopening'}</PortalButton>
        </div>
      </div></PortalModal>}
    </>}
  </div> : null}
    <DecisionDialog isOpen={confirmOpen} busy={busy} kind="confirmation" decisionKey={record.recordId}
      context={<p>{record.student.name} · {record.student.studentId} · {record.evaluator.name}</p>}
      title={mode === 'correct' ? 'Save this correction?' : 'Reopen this submission?'}
      message={<div className="card-description min-w-0 space-y-3"><p>{mode === 'correct'
        ? 'The submission stays locked. Changes are recorded in the correction history.'
        : 'The submission returns to Draft with its scores and comments preserved.'}</p>
        {mode === 'correct' ? <>
          {changedScores.length ? <ul className="space-y-1">{changedScores.map(component => <li key={component.id}>{component.name}: {component.marksAwarded} → {values[component.id]}</li>)}</ul> : null}
          {Number(correctedTotal) !== Number(record.entry.totalMark) ? <p>Total mark: {record.entry.totalMark} → {correctedTotal}</p> : null}
          {changedFeedback.map(component => <CorrectionTextChange key={component.id} label={`${component.name} feedback`} before={component.feedback} after={feedback[component.id]}/>)}
          {comments !== record.entry.comments ? <CorrectionTextChange label="Overall comments" before={record.entry.comments} after={comments}/> : null}
        </> : null}
        <div><p className="font-semibold text-slate-700">Reason</p><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{reason}</p></div></div>}
      confirmLabel={mode === 'correct' ? 'Save correction' : 'Reopen marks'} cancelLabel={mode === 'correct' ? 'Back to editing' : 'Review again'} tone="warning"
      successMessage={mode === 'correct' ? 'Correction saved and audited. The submission remains locked.' : 'Marks reopened and audited for Lecturer review.'}
      recoveryDirty={dirty} onReload={async () => {await onReload(); clearAction(); setAwaitingLatest(false);}} onConfirm={submit} onClose={() => setConfirmOpen(false)}/>
    <PortalConfirmModal isOpen={discardOpen} title="Discard unsaved changes?" message="The Office action has not been saved."
      confirmLabel="Discard changes" cancelLabel="Keep editing" isLoading={busy}
      onCancel={() => setDiscardOpen(false)} onConfirm={() => {if (!busy) {setDiscardOpen(false); clearAction();}}}/>
  </>;
}

function CorrectionTextChange({label, before, after}: {label: string; before: unknown; after: unknown}) {
  return <section className="min-w-0 rounded-lg border border-slate-200 px-3 py-2.5" aria-label={`${label} before and after`}>
    <h4 className="break-words font-semibold text-slate-800">{label}</h4>
    <dl className="mt-2 space-y-2">
      {[{caption: 'Before', value: before}, {caption: 'After', value: after}].map(({caption, value}) => <div key={caption}>
        <dt className="text-xs font-medium text-slate-500">{caption}</dt>
        <dd className="whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">{value == null || value === '' ? 'None' : String(value)}</dd>
      </div>)}
    </dl>
  </section>;
}

export function MarkCorrectionHistoryView({events, components}: {
  events: MarkRecordDetail['correctionHistory']; components: MarkRecordDetail['rubric']['components'];
}) {
  if (!events.length) return <p className="card-description">No corrections or reopening events.</p>;
  return <div className="space-y-8">{events.map(event => {
    const componentValues = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const beforeScores = componentValues(event.beforeValues.scores);
    const afterScores = componentValues(event.afterValues.scores);
    const beforeFeedback = componentValues(event.beforeValues.feedback);
    const afterFeedback = componentValues(event.afterValues.feedback);
    const rows: Array<[string, unknown, unknown]> = [
      ['Status', event.beforeValues.status, event.afterValues.status],
      ['Total mark', event.beforeValues.totalMark, event.afterValues.totalMark],
      ...components.filter(component => component.id in beforeScores || component.id in afterScores)
        .map(component => [component.name, beforeScores[component.id], afterScores[component.id]] as [string, unknown, unknown]),
    ];
    return <article key={event.id} className="min-w-0 border-l-2 border-blue-200 pl-3 text-xs">
      <header className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[13px] font-semibold leading-5 text-brand-navy">{event.action === 'CORRECT' ? 'Correction' : 'Reopened for Lecturer'}</p>
          <time className="card-description text-slate-500" dateTime={event.createdAt}>{formatMalaysiaDateTime(event.createdAt)}</time>
        </div>
        <p className="card-description mt-1 [overflow-wrap:anywhere]">By {event.actorName} · {event.actorRole}</p>
        <div className="mt-2 rounded-md bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-500">Reason</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700 [overflow-wrap:anywhere]">{event.reason}</p>
        </div>
      </header>
      <details className="mt-3 min-w-0">
        <summary className="card-value cursor-pointer">View before and after</summary>
        <div className="mt-2 min-w-0">
          <table className="data-table w-full table-fixed">
            <colgroup><col className="w-2/5"/><col className="w-[30%]"/><col className="w-[30%]"/></colgroup>
            <thead><tr><th className="data-th p-2">Field</th><th className="data-th p-2">Before</th><th className="data-th p-2">After</th></tr></thead>
            <tbody>{rows.map(([label, before, after]) => <tr key={label} className="border-t border-slate-100">
              <th className="data-td-strong p-2 [overflow-wrap:anywhere]">{label}</th>
              <td className="data-td p-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{before == null ? '-' : String(before)}</td>
              <td className="data-td p-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{after == null ? '-' : String(after)}</td>
            </tr>)}</tbody>
          </table>
          <div className="mt-3 space-y-3">
            {components.filter(component => beforeFeedback[component.id] !== afterFeedback[component.id]).map(component =>
              <CorrectionTextChange key={component.id} label={`${component.name} feedback`} before={beforeFeedback[component.id]} after={afterFeedback[component.id]}/>)}
            <CorrectionTextChange label="Overall comments" before={event.beforeValues.comments} after={event.afterValues.comments}/>
          </div>
        </div>
      </details>
    </article>;
  })}</div>;
}
