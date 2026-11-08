import {formatMalaysiaDateTime} from '../utils/malaysiaDateTime';
import {SubmissionAvailabilityNotice} from './OperationalIntakeFeedback';
import { MarksHeading } from './MarksPrimitives';
import { DecisionDialog } from './DecisionDialog';
import type { DecisionOutcome } from '../utils/decisionSubmission';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { CheckCircle2, Save, UserRound } from 'lucide-react';

import { RecordPage } from './RecordPage';
import {readFormFeedback, type FormFeedbackState} from '../utils/formFeedback';
import type { EvaluationTask } from '../types';
import { ApiError } from '../services/apiClient';
import {
  PortalButton,
  PortalToast,
  PortalCard,
  StatusBadge,
} from './PortalPrimitives';

interface MarkEntryDetailProps {
  task: EvaluationTask;
  backLabel?: string;
  routed?: boolean;
  onBack: () => void;
  onReload?: () => Promise<EvaluationTask>;
  onSave: (updatedTask: EvaluationTask) => void | Promise<void>;
  onSubmit: (updatedTask: EvaluationTask, submissionId: string) => void | DecisionOutcome | Promise<void | DecisionOutcome>;
}

const evaluatorRoleLabel = (task: EvaluationTask): string =>
  task.evaluatorRoleLabel || (
    task.evaluatorRole === 'SUPERVISOR'
      ? 'Supervisor'
      : task.evaluatorRole === 'BACKUP'
        ? 'Backup Evaluator'
        : 'Panel Member'
  );

const draftValues = (task: EvaluationTask) => Object.fromEntries(
  (task.components || []).map(component => [component.id, {
    mark: component.marksAwarded === null ? '' : component.marksAwarded,
    feedback: component.feedback,
  }]),
);

export const MarkEntryDetail: React.FC<MarkEntryDetailProps> = ({
  task,
  onBack,
  onReload,
  onSave,
  onSubmit,
  backLabel = 'Back to Marks Entry',
  routed = false,
}) => {
  const components = task.components || [];
  const [values, setValues] = useState(() => draftValues(task));
  const [comments, setComments] = useState(task.comments || '');
  const [showValidation, setShowValidation] = useState(false);
  const [submitted, setSubmitted] = useState(task.status === 'SUBMITTED');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewedTask, setReviewedTask] = useState<EvaluationTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<FormFeedbackState | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftConflict, setDraftConflict] = useState(false);
  const submissionAttempt = useRef<{ snapshot: string; id: string } | null>(null);
  const savingRef = useRef(false);
  const initial = useRef(JSON.stringify({ values, comments }));
  const dirty = JSON.stringify({ values, comments }) !== initial.current;
  const reload = onReload ? async () => {
    const latest = await onReload();
    const refreshedValues = draftValues(latest);
    const refreshedComments = latest.comments || '';
    // Replace local input only after an explicit successful reload. Keeping the
    // record page mounted also preserves its transient browser-history entry.
    initial.current = JSON.stringify({ values: refreshedValues, comments: refreshedComments });
    setValues(refreshedValues);
    setComments(refreshedComments);
    setSubmitted(latest.status === 'SUBMITTED');
    setDraftSaved(false);
    setShowValidation(false);
    setSaveFeedback(null);
    setDraftConflict(false);
    submissionAttempt.current = null;
  } : undefined;
  const save = async (submit: boolean, reviewed?: EvaluationTask) => {
    if (savingRef.current || draftConflict || submitted || task.canEdit !== true || (submit && task.canSubmit !== true)) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveFeedback(null);
    try {
      const payload = submit && reviewed ? reviewed : buildTask(submit ? 'SUBMITTED' : 'DRAFT SAVED');
      if (submit) {
        const snapshot = JSON.stringify({ taskId: payload.id, version: payload.writeVersion, components: payload.components, comments: payload.comments });
        if (submissionAttempt.current?.snapshot !== snapshot) submissionAttempt.current = { snapshot, id: crypto.randomUUID() };
      }
      const outcome = await (submit ? onSubmit(payload, submissionAttempt.current!.id) : onSave(payload));
      if (submit) setSubmitted(true);
      else {
        initial.current = JSON.stringify({ values, comments });
        setDraftSaved(true);
      }
      return outcome;
    }
    catch (error) {
      // Submission failures stay in the confirmation; draft failures use a dismissible toast.
      if (submit) throw error;
      const feedback = readFormFeedback(error, error instanceof Error ? error.message : 'The mark draft could not be saved. Try again.');
      if (error instanceof ApiError && [403, 404, 409].includes(error.status ?? 0)) setDraftConflict(true);
      setSaveFeedback(feedback);
      return false;
    }
    finally { savingRef.current = false; setSaving(false); }
  };
  const isReadOnly = submitted || task.canEdit !== true;

  const errors = components.flatMap((component) => {
    const raw = values[component.id]?.mark;
    if (component.required && raw === '') {
      return [`${component.name} is required.`];
    }
    if (raw === '') return [];
    const mark = Number(raw);
    if (!Number.isFinite(mark) || mark < 0 || mark > Number(component.maxMarks)) {
      return [`${component.name} must be between 0 and ${component.maxMarks}.`];
    }
    return [];
  });
  const total = components.reduce(
    (sum, component) => sum + Number(values[component.id]?.mark || 0),
    0,
  );
  const maximum = components.reduce(
    (sum, component) => sum + Number(component.maxMarks),
    0,
  );

  const buildTask = (status: EvaluationTask['status']): EvaluationTask => ({
    ...task,
    status,
    comments,
    components: components.map((component) => ({
      ...component,
      marksAwarded: values[component.id]?.mark === ''
        ? null
        : String(values[component.id]?.mark ?? 0),
      feedback: values[component.id]?.feedback || '',
    })),
  });

  const requestSubmission = () => {
    setSaveFeedback(null);
    setShowValidation(true);
    if (!isReadOnly && !draftConflict && task.canSubmit === true && errors.length === 0) {
      setReviewedTask(buildTask('SUBMITTED'));
      setConfirmOpen(true);
    }
  };

  return (
      <RecordPage
        title="Mark Entry Detail"
        subtitle="Score the assigned rubric and save or submit your evaluation."
        backLabel={backLabel}
        onBack={onBack}
        pageKey={routed ? undefined : `marks-entry:${task.id}`} dirty={!isReadOnly && dirty} busy={saving}
        actions={(
          <StatusBadge tone={submitted ? 'success' : isReadOnly ? 'neutral' : 'info'}>
            {submitted ? 'Submitted' : isReadOnly ? 'Read only' : evaluatorRoleLabel(task)}
          </StatusBadge>
        )}
      >


    <PortalToast
      message={showValidation && errors.length > 0 ? `Complete required marks: ${errors.join(' ')}` : saveFeedback?.message ?? null}
      tone={showValidation && errors.length > 0 ? 'warning' : 'danger'}
      onClose={() => {setShowValidation(false); setSaveFeedback(null);}}
    />
    <fieldset id="mark-entry-detail-page" disabled={saving} className="marks-workspace space-y-6 text-left">
      <DecisionDialog isOpen={confirmOpen} decisionKey={task.id} kind="confirmation"
        title="Submit and lock marks?" context={<p>{task.studentName} · {task.studentId} · Task #{task.id} · {evaluatorRoleLabel(task)}</p>}
        message={<div className="space-y-3"><p>Submitted marks lock immediately. Authorized Office staff can reopen them only while the period is open.</p>
          <ul>{reviewedTask?.components.map(component => <li key={component.id} className="border-t border-slate-100 py-2">
            <strong>{component.name}: {component.marksAwarded ?? '—'} / {component.maxMarks}</strong>
            <p className="whitespace-pre-wrap">Feedback: {component.feedback || 'None'}</p>
          </li>)}</ul>
          <p className="whitespace-pre-wrap">Overall comments: {reviewedTask?.comments || 'None'}</p>
          <p className="font-semibold">Total: {(reviewedTask?.components || []).reduce((sum, component) => sum + Number(component.marksAwarded || 0), 0).toFixed(2)} / {maximum.toFixed(2)}</p>
        </div>}
        confirmLabel="Submit and lock marks" cancelLabel="Review again" tone="warning"
        canConfirm={!!reviewedTask && !isReadOnly && task.canSubmit === true && errors.length === 0} busy={saving}
        recoveryDirty={dirty} successMessage="Marks submitted and locked." onReload={reload} onConfirm={() => save(true, reviewedTask!)} onClose={() => {setConfirmOpen(false); setReviewedTask(null);}} />

      {!submitted && (isReadOnly || task.completionWindow?.status === 'ACTIVE') ? <SubmissionAvailabilityNotice ariaLabel="Marking availability"
        title={isReadOnly ? (['SCHEDULED', 'UPCOMING'].includes(task.periodEffectiveStatus || '') ? 'Marking not open yet' : ['CLOSED', 'ENDED', 'ARCHIVED'].includes(task.periodEffectiveStatus || '') ? 'Marking closed' : 'Marking unavailable') : 'Extra time available'}
        description={isReadOnly ? 'This task is read only. Marks cannot be saved or submitted.' : <>Your deadline: {formatMalaysiaDateTime(task.effectiveDueAt || task.completionWindow!.deadline)}</>} /> : null}
      {components.length === 0 ? (
        <PortalCard padding="lg" className="rounded-lg">
          <div className="card-description flex items-start gap-3 text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>No rubric components are available for this task. Contact the postgraduate office.</p>
          </div>
        </PortalCard>
      ) : (
        <div className="space-y-6">
          <PortalCard padding="none" className="overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
              <MarksHeading icon={UserRound}>{task.studentName}</MarksHeading>
              <p className="card-description mt-1">
                {task.studentId} · {task.semester}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-800">
                {task.researchTitle}
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {components.map((component, index) => (
                <div
                  key={component.id}
                  className="space-y-5 px-6 py-7 sm:px-8"
                >
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="flex min-w-0 basis-full items-start gap-3 sm:flex-1 sm:basis-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="section-label">{component.name}</h3>
                        {component.description ? <p className="card-description mt-1">{component.description}</p> : null}
                      </div>
                    </div>
                  <label className="block w-36 shrink-0 space-y-2">
                    <span className="block text-sm font-semibold leading-5 text-slate-700">
                      Marks / {component.maxMarks}
                    </span>
                    <input
                      aria-label={`Marks / ${component.maxMarks} for ${component.name}`}
                      disabled={isReadOnly}
                      type="number"
                      min="0"
                      max={component.maxMarks}
                      step="0.01"
                      value={values[component.id]?.mark ?? ''}
                      onChange={(event) => setValues((current) => ({
                        ...current,
                        [component.id]: {
                          ...current[component.id],
                          mark: event.target.value,
                        },
                      }))}
                      className="form-control block text-right tabular-nums text-slate-900"
                    />
                  </label>
                  </div>
                  <div>
                    <label htmlFor={`marks-feedback-${task.id}-${component.id}`} className="form-label block">Component feedback</label>
                    <textarea
                      id={`marks-feedback-${task.id}-${component.id}`}
                      aria-label={`Component feedback for ${component.name}`}
                      rows={2}
                      disabled={isReadOnly}
                      value={values[component.id]?.feedback || ''}
                      onChange={(event) => setValues((current) => ({
                        ...current,
                        [component.id]: {
                          ...current[component.id],
                          feedback: event.target.value,
                        },
                      }))}
                      className="form-control mt-2 block min-h-[64px] w-full px-3 py-2"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 px-6 py-7 sm:px-8">
              <label htmlFor={`marks-comments-${task.id}`} className="form-label">
                Overall comments
              </label>
              <textarea
                id={`marks-comments-${task.id}`}
                disabled={isReadOnly}
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                className="form-control mt-2 block min-h-[112px] w-full px-3 py-3"
              />
            </div>
          <div className="space-y-5 border-t border-slate-200 bg-slate-50/60 px-6 py-6 sm:px-8">
            <div>
              <p className="text-sm font-semibold text-slate-600">Calculated total</p>
              <p className="mt-2 text-[28px] font-extrabold tracking-tight tabular-nums text-brand-navy">
                {total.toFixed(2)}
                <span className="ml-1 text-base font-medium text-slate-500"> / {maximum.toFixed(2)}</span>
              </p>
            </div>

            {!isReadOnly ? (
              <div className="space-y-4">
                {draftConflict && reload ? <>
                  <p className="card-description">Your entries are still shown. Loading the latest record will replace them.</p>
                  <PortalButton fullWidth onClick={async () => {
                    if (savingRef.current) return;
                    savingRef.current = true; setSaving(true);
                    try { await reload(); }
                    catch (failure) { setSaveFeedback(readFormFeedback(failure, 'The latest draft could not be loaded. Your entries are still here.')); }
                    finally { savingRef.current = false; setSaving(false); }
                  }}>Load latest draft</PortalButton>
                </> : null}
                {dirty || draftSaved ? <p role="status" className="card-description">{dirty ? 'Unsaved changes' : 'Draft saved'}</p> : null}
                <div className="flex flex-wrap items-center justify-end gap-3">
                <PortalButton
                  icon={Save}
                  variant="secondary"
                  disabled={draftConflict}
                  onClick={() => void save(false)}
                >
                  Save draft
                </PortalButton>
                <PortalButton
                  icon={CheckCircle2}
                  variant="primary"
                  disabled={task.canSubmit !== true || draftConflict}
                  aria-describedby={task.canSubmit !== true ? `marks-submit-help-${task.id}` : undefined}
                  onClick={requestSubmission}
                >
                  Submit marks
                </PortalButton>
                </div>
                {task.canSubmit !== true ? <p id={`marks-submit-help-${task.id}`} className="card-description">Submission is unavailable for this task. You can still save a draft.</p> : null}
              </div>
            ) : null}
          </div>
          </PortalCard>
        </div>
      )}
    </fieldset>
    </RecordPage>
  );
};
