/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A student's request for one letter, in two steps like the other portal
// applications: the letter details, laid out like UM Maya's "Letter Details
// Application Form", then "Check and send", where each answer can be changed
// before the request goes to the office. The letter's questions come from the
// office (see LetterFormFields); the student never sees the letter's wording.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Send } from 'lucide-react';
import { PortalButton } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { LoadingState, ErrorState } from './StateViews';
import { AlertMessage } from './AlertMessage';
import { FORM_ROW, FormRow, LetterFormFields, answersFor, missingAnswers, type LetterAnswers } from './LetterFormFields';
import { shortDate } from './IssuedLetters';
import type { GeneratedLetter, LetterForm, LetterRequestDetails, LetterTemplate } from '../types';
import { ApiError, getLetterForm, inactiveStudentReason, isAlreadyRequested, requestLetter } from '../services';
import { EMPTY_REQUEST_DETAILS, chosenDetailLabels, recipientAddressLines } from '../utils/letterRecipients';

const MAX_NOTE_LENGTH = 500;
const STEPS = ['Letter details', 'Check and send'] as const;

/** What a previous request answered, to start "Request again" from. */
export interface LetterRequestStart {
  details?: Partial<LetterRequestDetails>;
  answers?: LetterAnswers;
  note?: string;
}

interface StudentLetterRequestFormProps {
  template: LetterTemplate;
  student: { name: string; matricNumber: string; programme: string };
  /** The student's issued copies of this letter, which an approved request replaces. */
  currentCopies: GeneratedLetter[];
  /** A request for this letter that is still waiting, if any. */
  pending: GeneratedLetter | null;
  /** Last time's answers, when asking again. */
  start?: LetterRequestStart | null;
  onSent: (created: GeneratedLetter) => void;
  onCancel: () => void;
  onSeeRequests: () => void;
  /** The server refused because the student's status is not Active. */
  onBlocked: (reason: string) => void;
  /** The letter was already asked for, or can no longer be requested. */
  onRefused: (message: string) => void;
  onMessage: (message: string) => void;
}

/** The server's field errors as the form shows them. */
function serverErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.status !== 400 || !err.body || typeof err.body !== 'object') return {};
  const problems: Record<string, string> = {};
  for (const [key, value] of Object.entries(err.body as Record<string, unknown>)) {
    if (key === 'answers' && value && typeof value === 'object') {
      for (const [name, message] of Object.entries(value as Record<string, unknown>)) {
        if (typeof message === 'string') problems[`answer:${name}`] = message;
      }
    } else if (typeof value === 'string' && key !== 'detail') problems[key] = value;
  }
  return problems;
}

const FIELD_FOCUS: Record<string, string> = {
  purpose: 'letter-form-purpose',
  organisation: 'letter-form-organisation',
  note: 'letter-form-note',
};

export const StudentLetterRequestForm: React.FC<StudentLetterRequestFormProps> = ({
  template,
  student,
  currentCopies,
  pending,
  start,
  onSent,
  onCancel,
  onSeeRequests,
  onBlocked,
  onRefused,
  onMessage,
}) => {
  const [form, setForm] = useState<LetterForm | null>(null);
  const [formLoading, setFormLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [details, setDetails] = useState<LetterRequestDetails>({ ...EMPTY_REQUEST_DETAILS, ...(start?.details ?? {}), include: start?.details?.include ?? [] });
  const [answers, setAnswers] = useState<LetterAnswers>(start?.answers ?? {});
  const [note, setNote] = useState(start?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const finished = useRef(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const today = useRef(new Date().toISOString()).current;

  const loadForm = useCallback(() => {
    setFormLoading(true);
    setFormError(null);
    getLetterForm(template.id)
      .then(setForm)
      .catch((err) => setFormError(err instanceof Error ? err.message : 'Could not load the form.'))
      .finally(() => setFormLoading(false));
  }, [template.id]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  useEffect(() => {
    stepHeading.current?.focus({ preventScroll: true });
  }, [step]);

  const questions = form?.questions ?? [];
  const recipientQuestion = questions.find((question) => question.kind === 'recipient');
  const readyIn = form?.readyInDays ?? template.readyInDays ?? null;
  // The copy an approval replaces: for a letter addressed to someone, only the one for the same organisation.
  const replaces =
    currentCopies.find(
      (copy) =>
        !recipientQuestion ||
        (details.organisation.trim() !== '' &&
          copy.requestDetails?.organisation?.toLowerCase() === details.organisation.trim().toLowerCase()),
    ) ?? null;
  const dirty = note.trim() !== '' || Object.keys(answersFor(questions, answers)).length > 0 || details.purpose !== '';

  const changeDetails = (next: LetterRequestDetails) => {
    setErrors((current) => {
      const cleared = { ...current };
      for (const key of Object.keys(next) as (keyof LetterRequestDetails)[]) if (next[key] !== details[key]) delete cleared[key];
      return cleared;
    });
    setDetails(next);
  };

  const changeAnswer = (name: string, value: string | boolean) => {
    setAnswers((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const { [`answer:${name}`]: _removed, ...rest } = current;
      return rest;
    });
  };

  const goToField = (field?: string) => {
    setStep(1);
    if (!field) return;
    const id = FIELD_FOCUS[field] ?? (field.startsWith('answer:') ? `letter-form-answer-${field.slice(7)}` : `letter-form-${field}`);
    setTimeout(() => document.getElementById(id)?.focus(), 0);
  };

  const toCheck = () => {
    const problems = missingAnswers(questions, details, answers);
    if (note.trim().length > MAX_NOTE_LENGTH) problems.note = `Keep the note under ${MAX_NOTE_LENGTH} characters.`;
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      goToField(Object.keys(problems)[0]);
      return;
    }
    setStep(2);
  };

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      const created = await requestLetter(
        template.id,
        note.trim(),
        recipientQuestion ? details : undefined,
        Object.keys(answersFor(questions, answers)).length ? answersFor(questions, answers) : undefined,
      );
      finished.current = true;
      onSent(created);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send the request. Please try again.';
      const reason = inactiveStudentReason(err);
      if (reason) {
        finished.current = true;
        onBlocked(reason);
      } else if (isAlreadyRequested(err) || /no longer available/i.test(message)) {
        finished.current = true;
        onRefused(message);
      } else {
        const problems = serverErrors(err);
        setErrors(problems);
        if (Object.keys(problems).length) goToField(Object.keys(problems)[0]);
        onMessage(message);
      }
    } finally {
      setSending(false);
    }
  };

  const summaryRows: Array<{ label: string; value: React.ReactNode; field?: string }> = [];
  for (const question of questions) {
    if (question.kind === 'recipient') {
      summaryRows.push({ label: 'Purpose', value: question.options.find((o) => o.code === details.purpose)?.label ?? details.purpose, field: 'purpose' });
      summaryRows.push({ label: 'Recipient', value: details.organisation, field: 'organisation' });
      if (question.askAddress !== false) {
        const lines = recipientAddressLines(details);
        summaryRows.push({ label: 'Address', value: lines.length ? lines.map((line) => <span key={line} className="block">{line}</span>) : null, field: 'addressLine1' });
      }
    } else if (question.kind === 'extras') {
      summaryRows.push({ label: 'Also show', value: chosenDetailLabels(details).join(', ') || null, field: 'include' });
    } else if (question.name) {
      const value = answers[question.name];
      const shown =
        question.kind === 'yesno'
          ? value === true ? 'Yes' : 'No'
          : question.kind === 'choice'
            ? question.list.items.find((item) => item.id === value)?.name
            : question.kind === 'date' && typeof value === 'string' && value
              ? shortDate(value)
              : (value as string);
      summaryRows.push({ label: question.label ?? question.name, value: shown || null, field: `answer:${question.name}` });
    }
  }
  summaryRows.push({ label: 'Note to the office', value: note.trim() || null, field: 'note' });

  return (
    <RecordPage
      title={`Request a ${template.name}`}
      subtitle={template.description || undefined}
      backLabel="Back to letters"
      onBack={onCancel}
      pageKey={`letter-application:${template.id}`}
      dirty={dirty && !finished.current}
      busy={sending}
      navigationComplete={finished}
    >
      {pending ? (
        <AlertMessage
          type="info"
          title="This letter is already waiting for the office"
          message={`You asked for it on ${shortDate(pending.requestedAt)}. You can ask again once it is decided, or withdraw it from My requests.`}
          actions={<PortalButton size="sm" onClick={onSeeRequests}>See my requests</PortalButton>}
        />
      ) : formLoading ? (
        <LoadingState message="Loading the form…" />
      ) : formError || !form ? (
        <ErrorState message={formError ?? 'Could not load the form.'} onRetry={loadForm} />
      ) : (
        <>
          <nav aria-label="Request steps" className="py-1">
            <ol className="grid grid-cols-2 max-w-xl">
              {STEPS.map((label, index) => {
                const number = index + 1;
                const current = step === number;
                const done = step > number;
                return (
                  <li key={label} aria-current={current ? 'step' : undefined} className="relative min-w-0 pr-3">
                    {index === 0 ? <span aria-hidden="true" className={`absolute left-10 right-2 top-4 h-px ${done ? 'bg-emerald-200' : 'bg-slate-200'}`} /> : null}
                    <div className={`relative flex min-w-0 flex-col items-start gap-3 text-xs ${current ? 'font-semibold text-brand-navy' : 'text-slate-500'}`}>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${current ? 'border-brand-navy bg-brand-navy text-white ring-4 ring-slate-200/70' : done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-400'}`}>
                        {done ? <Check aria-hidden="true" className="h-4 w-4" /> : number}
                      </span>
                      <span>{label}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </nav>
          <h2 ref={stepHeading} tabIndex={-1} className="text-lg font-semibold text-brand-navy focus:outline-none">
            {step}. {STEPS[step - 1]}
          </h2>

          <div hidden={step !== 1} className="space-y-6">
            <section aria-label="Student" className="app-card px-5 py-4 sm:px-7">
              <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-y-2 text-[13px]">
                <dt className="font-semibold text-slate-500">Student ID</dt>
                <dd className="text-slate-700">{student.matricNumber || '-'}</dd>
                <dt className="font-semibold text-slate-500">Student Name</dt>
                <dd className="text-slate-700">{student.name || '-'}</dd>
              </dl>
            </section>

            <section aria-labelledby="letter-form-heading" className="app-card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-100 px-5 py-4 sm:px-7">
                <h3 id="letter-form-heading" className="text-base font-semibold text-brand-navy">Letter Details Application Form</h3>
              </div>
              <form
                noValidate
                className="feedback-fields space-y-4 px-5 py-6 sm:px-7"
                onSubmit={(event) => {
                  event.preventDefault();
                  toCheck();
                }}
              >
                {questions.some((question) => question.kind === 'recipient' || ('required' in question && question.required)) && (
                  <div className={FORM_ROW}>
                    <span aria-hidden="true" className="hidden sm:block" />
                    <p className="text-[12.5px] font-semibold text-slate-700 sm:text-right">
                      <span className="text-rose-600">*</span> Required information
                    </p>
                  </div>
                )}
                <LetterFormFields
                  questions={questions}
                  programme={student.programme}
                  applicationDate={shortDate(today)}
                  details={details}
                  onDetails={changeDetails}
                  answers={answers}
                  onAnswer={changeAnswer}
                  errors={errors}
                  disabled={sending}
                />
                <FormRow label="Note to the Office" htmlFor="letter-form-note" hint="Optional" error={errors.note}>
                  <textarea
                    id="letter-form-note"
                    rows={3}
                    value={note}
                    maxLength={MAX_NOTE_LENGTH}
                    disabled={sending}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setErrors((current) => ({ ...current, note: '' }));
                    }}
                    aria-invalid={errors.note ? true : undefined}
                    aria-describedby="letter-form-note-hint"
                    placeholder="For example: needed for my student pass renewal appointment on 3 November."
                    className={`form-control form-control-md resize-none ${errors.note ? 'form-control-error' : ''}`}
                  />
                </FormRow>
                {replaces && (
                  <div className={FORM_ROW}>
                    <span aria-hidden="true" className="hidden sm:block" />
                    <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] font-medium text-amber-900">
                      <AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        You already have this letter{recipientQuestion ? ` for ${replaces.requestDetails?.organisation}` : ''} ({replaces.referenceNumber}, approved{' '}
                        {shortDate(replaces.decidedAt)}). Once the office approves the new one, it replaces that copy, which will no longer be valid.
                      </span>
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5">
                  <PortalButton type="button" disabled={sending} onClick={onCancel}>Cancel</PortalButton>
                  <PortalButton type="submit" variant="primary">Continue</PortalButton>
                </div>
              </form>
            </section>
          </div>

          <div hidden={step !== 2} className="space-y-6">
            <section aria-labelledby="letter-check-heading" className="app-card p-5 sm:p-7 space-y-5">
              <div>
                <h3 id="letter-check-heading" className="text-base font-semibold text-brand-navy">{template.name}</h3>
              </div>
              <dl className="divide-y divide-slate-100 border-y border-slate-100">
                {summaryRows.map((row) => (
                  <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:gap-4">
                    <dt className="text-[13px] font-semibold text-slate-500">{row.label}</dt>
                    <dd className="text-[13px] text-slate-800 [overflow-wrap:anywhere]">{row.value ?? <span className="text-slate-400">Not provided</span>}</dd>
                    <dd>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => goToField(row.field)}
                        className="text-[13px] font-semibold text-blue-700 hover:underline cursor-pointer"
                      >
                        Change<span className="sr-only"> {row.label.toLowerCase()}</span>
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
              {replaces && (
                <AlertMessage
                  type="warning"
                  message={`Approving this request replaces your ${template.name}${recipientQuestion ? ` for ${replaces.requestDetails?.organisation}` : ''} (${replaces.referenceNumber}).`}
                />
              )}
              <p className="card-description">
                The office checks your details and completes the letter.{readyIn ? ` It is usually ready in ${readyIn} working day${readyIn === 1 ? '' : 's'}.` : ''} You are notified when it is
                approved.
              </p>
            </section>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5">
              <PortalButton type="button" disabled={sending} onClick={() => setStep(1)}>Back</PortalButton>
              <PortalButton type="button" variant="primary" icon={Send} isLoading={sending} onClick={() => void send()}>Send request</PortalButton>
            </div>
          </div>
        </>
      )}
    </RecordPage>
  );
};
