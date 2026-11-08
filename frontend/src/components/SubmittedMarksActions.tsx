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

  const editedScores = record.rubric.components.some(component => component.marksAwarded !== null && values[component.id] !== (component.marksAwarded || '0'));
  const dirty = !!mode && (!!reason.trim() || (mode === 'correct' && (editedScores || comments !== record.entry.comments)));
  useRecordDraft(dirty, busy);
  const actions = record.officeActions;
  const eligible = record.entry.status === 'SUBMITTED' && !!actions?.version && !!(actions.canCorrect || actions.canReopen);
  const components = record.rubric.components.filter(component => component.marksAwarded !== null);
  const original = {comments: record.entry.comments, components};
  const correctedTotal = components.reduce((total, component) => total + Number(values[component.id] || 0), 0);
  const changedScores = components.filter(component => Number(values[component.id]) !== Number(component.marksAwarded));
  const clearAction = () => {setMode(null); setValues({}); setComments(''); setReason(''); setError(''); setConfirmOpen(false);};
  const requestClose = () => {if (dirty) setDiscardOpen(true); else clearAction();};
  const choose = (next: 'correct' | 'reopen') => {
    setMode(next); setError(''); setReason(''); setComments(record.entry.comments);
    setValues(Object.fromEntries(components.map(component => [component.id, component.marksAwarded || '0'])));
  };
  const review = () => {
    const validation = mode === 'correct'
      ? validateSubmittedMarksCorrection(original, values, comments, reason)
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
            expectedVersion: actions!.version!, reason: reason.trim(), comments,
            scores: changedScores
              .map(component => ({componentId: Number(component.id), marksAwarded: values[component.id]})),
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
      </div> : <PortalModal isOpen={!!mode && !confirmOpen} busy={busy} labelledBy={modalTitle} className="max-w-3xl p-6 sm:p-8" onClose={requestClose}><div className="space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <h3 id={modalTitle} className="text-base font-semibold text-slate-900">{mode === 'correct' ? 'Correct submitted marks' : 'Reopen for Lecturer'}</h3>
          <button type="button" aria-label="Close dialog" disabled={busy} onClick={requestClose} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50"><X className="size-4" aria-hidden="true"/></button>
        </div>
        {error && !awaitingLatest ? <AlertMessage type="error" message={error}/> : null}
        {mode === 'correct' ? <>
          <div className="grid gap-5 sm:grid-cols-2">{components.map(component => <label key={component.id} className="form-label block">
            {component.name} (maximum {component.maxMarks})
            <input type="number" min="0" max={component.maxMarks} step="0.01" disabled={busy}
              className="form-control mt-2 min-h-11 px-3 py-2.5 text-sm font-normal" value={values[component.id] || ''}
              onChange={event => setValues(current => ({...current, [component.id]: event.target.value}))}/>
          </label>)}</div>
          <label className="form-label block">Corrected overall comments<textarea className="form-control mt-2 min-h-24 px-3 py-2.5 text-sm font-normal" disabled={busy} value={comments} onChange={event => setComments(event.target.value)}/></label>
          <p className="card-description">Total: {record.entry.totalMark} → {Number.isFinite(correctedTotal) ? correctedTotal.toFixed(2) : '-'}</p>
        </> : <p className="card-description text-slate-600">Scores and comments are preserved. The entry returns to Draft so its assigned Lecturer can review and resubmit while the period remains open.</p>}
        <label className="form-label block">{mode === 'correct' ? 'Correction reason' : 'Reopening reason'}<textarea className="form-control mt-2 min-h-24 px-3 py-2.5 text-sm font-normal" required disabled={busy} value={reason} onChange={event => setReason(event.target.value)}/></label>
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
          <PortalButton disabled={busy} onClick={requestClose}>Cancel</PortalButton>
          <PortalButton variant="primary" disabled={busy || !reason.trim()} onClick={review}>{mode === 'correct' ? 'Review correction' : 'Review reopening'}</PortalButton>
        </div>
      </div></PortalModal>}
    </>}
  </div> : null}
    <DecisionDialog isOpen={confirmOpen} busy={busy} kind="confirmation" decisionKey={record.recordId}
      context={<p>{record.student.name} · {record.student.studentId} · {record.evaluator.name}</p>}
      title={mode === 'correct' ? 'Save this correction?' : 'Reopen this submission?'}
      message={<div className="card-description space-y-2"><p>{mode === 'correct'
        ? `Total ${record.entry.totalMark} → ${correctedTotal.toFixed(2)}. The submission remains locked; the changes are audited.`
        : 'The submission returns to Draft with its scores and comments preserved.'}</p>
        {mode === 'correct' ? <><ul>{changedScores.map(component => <li key={component.id}>{component.name}: {component.marksAwarded} → {values[component.id]}</li>)}</ul>
          {comments !== record.entry.comments ? <p className="whitespace-pre-wrap">Overall comments: {record.entry.comments || 'None'} → {comments || 'None'}</p> : null}</> : null}
        <p className="card-description whitespace-pre-wrap">Reason: {reason}</p></div>}
      confirmLabel={mode === 'correct' ? 'Save correction' : 'Reopen marks'} cancelLabel="Review again" tone="warning"
      successMessage={mode === 'correct' ? 'Correction saved and audited. The submission remains locked.' : 'Marks reopened and audited for Lecturer review.'}
      recoveryDirty={dirty} onReload={async () => {await onReload(); clearAction(); setAwaitingLatest(false);}} onConfirm={submit} onClose={() => setConfirmOpen(false)}/>
    <PortalConfirmModal isOpen={discardOpen} title="Discard unsaved changes?" message="The Office action has not been saved."
      confirmLabel="Discard changes" cancelLabel="Keep editing" isLoading={busy}
      onCancel={() => setDiscardOpen(false)} onConfirm={() => {if (!busy) {setDiscardOpen(false); clearAction();}}}/>
  </>;
}

export function MarkCorrectionHistoryView({events, components}: {
  events: MarkRecordDetail['correctionHistory']; components: MarkRecordDetail['rubric']['components'];
}) {
  if (!events.length) return <p className="card-description">No corrections or reopening events.</p>;
  return <div className="space-y-8">{events.map(event => {
    const scoreValues = (values: Record<string, unknown>) => values.scores && typeof values.scores === 'object' ? values.scores as Record<string, unknown> : {};
    const beforeScores = scoreValues(event.beforeValues); const afterScores = scoreValues(event.afterValues);
    const rows: Array<[string, unknown, unknown]> = [
      ['Status', event.beforeValues.status, event.afterValues.status],
      ['Total mark', event.beforeValues.totalMark, event.afterValues.totalMark],
      ...components.filter(component => component.id in beforeScores || component.id in afterScores)
        .map(component => [component.name, beforeScores[component.id], afterScores[component.id]] as [string, unknown, unknown]),
    ];
    const displayValue = (value: unknown) => value == null || value === '' ? 'None' : String(value);
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
          <section className="mt-3 rounded-md border border-slate-200 p-3" aria-label="Overall comments before and after">
            <h4 className="text-xs font-semibold text-slate-700">Overall comments</h4>
            <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-md bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-500">Before</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700 [overflow-wrap:anywhere]">{displayValue(event.beforeValues.comments)}</p>
              </div>
              <div className="min-w-0 rounded-md bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-500">After</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700 [overflow-wrap:anywhere]">{displayValue(event.afterValues.comments)}</p>
              </div>
            </div>
          </section>
        </div>
      </details>
    </article>;
  })}</div>;
}
