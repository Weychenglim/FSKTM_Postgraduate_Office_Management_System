/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// One letter type, opened from Letter Generation's Letter types tab, in numbered
// steps: About the letter, Student form (only for letters students ask for),
// Write the letter, and Signature and status. A new letter type is made by going
// through the steps in order; an existing one can be opened at any step.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileSignature, Settings2, ShieldCheck, Trash2, UserCheck, UserPlus, UserRound, UsersRound, type LucideIcon } from 'lucide-react';
import { PortalButton, PortalConfirmModal, StatusBadge } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { SelectMenu } from './SelectMenu';
import { AlertMessage } from './AlertMessage';
import { AppointmentSection } from './AppointmentPrimitives';
import { LetterQuestionsEditor } from './LetterQuestionsEditor';
import { LetterWordingEditor, wordingProblems } from './LetterWordingEditor';
import type { ChoiceListSummary, LetterPlaceholder, LetterPurpose, LetterQuestion, LetterRecipientPurpose, LetterTemplate, LetterTemplateStatus } from '../types';
import { LETTERHEAD, isAppointmentLetter } from '../utils/letterDocument';
import {
  BLANK_TEMPLATE,
  DEFAULT_REFERENCE_PREFIX,
  LETTER_TYPES,
  MAX_READY_DAYS,
  MAX_VALID_MONTHS,
  PURPOSE_CHIP,
  PURPOSE_NOTE,
  PURPOSE_OPTIONS,
  STATUS_TONE,
  questionNames,
  sameValues,
  valuesOf,
  type EditorValues,
} from '../utils/letterEditor';
import { createLetterTemplate, deleteLetterTemplate, fieldErrors, getChoiceList, getChoiceLists, getRecipientOptions, updateLetterTemplate } from '../services';

type EditorStep = 'about' | 'form' | 'letter' | 'finish';
const STEP_LABELS: Record<EditorStep, string> = { about: 'About the letter', form: 'Student form', letter: 'Write the letter', finish: 'Signature and status' };
const STEP_INTROS: Record<EditorStep, string> = {
  about: 'When the letter is used and what it is called.',
  form: 'What students fill in when they ask for this letter. Their answers can go on the letter.',
  letter: 'What the letter says. Details in [square brackets] are filled in for each student.',
  finish: 'Who signs it, how it is numbered, and whether it is in use.',
};

// Fields a 400 response can point at, and the step each one lives on.
const FIELD_STEPS = {
  name: 'about',
  description: 'about',
  purpose: 'about',
  readyInDays: 'about',
  formQuestions: 'form',
  asksRecipient: 'form',
  content: 'letter',
  contentMs: 'letter',
  customFields: 'letter',
  referencePrefix: 'finish',
  signatoryName: 'finish',
  signatoryTitle: 'finish',
  signatoryNameMs: 'finish',
  signatoryTitleMs: 'finish',
  validMonths: 'finish',
  status: 'finish',
} as const satisfies Record<string, EditorStep>;
type EditorField = keyof typeof FIELD_STEPS;

const RECIPIENT_LINE_RE = /^[ \t]*\{\{RECIPIENT\}\}[ \t]*\n(?:[ \t]*\n)*/gm;
const PURPOSE_ICONS: Record<LetterPurpose, LucideIcon> = { REQUEST: UserRound, SUPERVISOR_APPOINTMENT: UserCheck, PANEL_APPOINTMENT: UsersRound, CO_SUPERVISOR_APPOINTMENT: UserPlus };

const statusChoices = (request: boolean, isNew: boolean): ReadonlyArray<{ value: LetterTemplateStatus; description: string }> => [
  { value: 'Draft', description: 'Not in use yet. Nobody can ask for it or receive it.' },
  { value: 'Active', description: request ? 'In use. Students can ask for it.' : 'In use. Sent automatically after each approval.' },
  ...(isNew ? [] : [{ value: 'Archived' as const, description: 'No longer used. Kept for the record.' }]),
];

const Field: React.FC<{ label: string; htmlFor?: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, htmlFor, hint, error, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="form-label block">{label}</label>
    {children}
    {error ? <p role="alert" className="text-sm font-medium text-rose-800">{error}</p> : hint ? <p className="card-caption text-[11.5px] leading-snug">{hint}</p> : null}
  </div>
);

const Steps: React.FC<{
  steps: readonly EditorStep[];
  current: EditorStep;
  reached: number;
  guided: boolean;
  flagged: (step: EditorStep) => boolean;
  onGo: (step: EditorStep) => void;
}> = ({ steps, current, reached, guided, flagged, onGo }) => (
  <nav aria-label="Letter type steps" className="py-1">
    <ol className={`grid max-w-3xl ${steps.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
      {steps.map((value, index) => {
        const isCurrent = value === current;
        const open = !guided || index <= reached;
        const done = guided && !isCurrent && index < reached;
        return (
          <li key={value} aria-current={isCurrent ? 'step' : undefined} className="relative min-w-0 pr-3">
            {index < steps.length - 1 ? <span aria-hidden="true" className={`absolute left-10 right-2 top-4 h-px ${done ? 'bg-emerald-200' : 'bg-slate-200'}`} /> : null}
            <button
              type="button"
              disabled={!open}
              onClick={() => onGo(value)}
              className={`relative flex min-w-0 flex-col items-start gap-3 rounded-lg text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${
                isCurrent ? 'font-semibold text-brand-navy' : open ? 'text-slate-600 hover:text-brand-navy cursor-pointer' : 'text-slate-400 cursor-not-allowed'
              }`}
            >
              <span
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  isCurrent
                    ? 'border-brand-navy bg-brand-navy text-white ring-4 ring-slate-200/70'
                    : done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : open
                        ? 'border-slate-300 bg-white text-slate-600'
                        : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                {done ? <Check aria-hidden="true" className="h-4 w-4" /> : index + 1}
                {flagged(value) && <span aria-label="needs attention" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
              </span>
              <span>{STEP_LABELS[value]}</span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
);

interface LetterTypeEditorProps {
  /** The letter type to edit, or null for a new one. */
  template: LetterTemplate | null;
  placeholders: LetterPlaceholder[] | null;
  onClose: () => void;
  onSaved: (template: LetterTemplate, created: boolean) => void;
  onDeleted: (template: LetterTemplate) => void;
  onOpenLists: () => void;
  onMessage: (message: string) => void;
}

export const LetterTypeEditor: React.FC<LetterTypeEditorProps> = ({ template, placeholders, onClose, onSaved, onDeleted, onOpenLists, onMessage }) => {
  const [saved, setSaved] = useState<EditorValues>(template ? valuesOf(template) : BLANK_TEMPLATE);
  const [draft, setDraft] = useState<EditorValues>(saved);
  const [current, setCurrent] = useState<LetterTemplate | null>(template);
  const [step, setStep] = useState<EditorStep>('about');
  const [reached, setReached] = useState(template ? 3 : 0);
  const [problems, setProblems] = useState<Partial<Record<EditorField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [purposes, setPurposes] = useState<LetterRecipientPurpose[] | null>(null);
  const [lists, setLists] = useState<ChoiceListSummary[] | null>(null);
  const [listItems, setListItems] = useState<Record<string, { id: string; name: string }[]>>({});
  const finished = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const firstStep = useRef(true);
  const stepHeading = useRef<HTMLHeadingElement>(null);

  const guided = current === null;
  const dirty = !sameValues(draft, saved);
  const set = (changes: Partial<EditorValues>) => setDraft((value) => ({ ...value, ...changes }));
  const clearProblem = (...fields: EditorField[]) =>
    setProblems((value) => (fields.some((field) => value[field]) ? Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key as EditorField))) : value));

  const editorContent = draft.content;
  const editorPurpose = draft.purpose;
  const editorFields = draft.customFields;
  const request = editorPurpose === 'REQUEST';
  const steps: readonly EditorStep[] = request ? ['about', 'form', 'letter', 'finish'] : ['about', 'letter', 'finish'];
  const stepIndex = Math.max(0, steps.indexOf(step));
  const shownStep = steps[stepIndex];
  const stepOf = (field: EditorField): EditorStep => (steps.includes(FIELD_STEPS[field]) ? FIELD_STEPS[field] : 'about');

  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    stepHeading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [shownStep]);

  // The recipients list and the office's other lists, for the Student form step.
  useEffect(() => {
    if (shownStep !== 'form' || purposes) return;
    getRecipientOptions().then((options) => setPurposes(options.purposes)).catch(() => setPurposes([]));
    getChoiceLists().then(setLists).catch(() => setLists([]));
  }, [shownStep, purposes]);

  const needList = useCallback(
    (listId: string) => {
      if (listItems[listId]) return;
      setListItems((value) => ({ ...value, [listId]: [] }));
      getChoiceList(listId)
        .then((list) => setListItems((value) => ({ ...value, [listId]: list.items.filter((item) => !item.hidden).map((item) => ({ id: item.id, name: item.name })) })))
        .catch(() => undefined);
    },
    [listItems],
  );

  // Adding "Who is the letter for?" puts the recipient at the top of each page;
  // removing it takes that line out again. Removed questions leave the letter too.
  const changeQuestions = (next: LetterQuestion[]) => {
    const had = draft.questions.some((q) => q.kind === 'recipient');
    const has = next.some((q) => q.kind === 'recipient');
    const removedTags = questionNames(draft.questions).filter((name) => !questionNames(next).includes(name));
    setDraft((value) => {
      let { content: english, contentMs: malay } = value;
      if (has && !had) {
        const addTop = (text: string) => (text.includes('{{RECIPIENT}}') ? text : `{{RECIPIENT}}\n\n${text.replace(/^\s+/, '')}`);
        english = addTop(english);
        malay = malay.trim() ? addTop(malay) : malay;
      }
      if (had && !has) {
        english = english.replace(RECIPIENT_LINE_RE, '');
        malay = malay.replace(RECIPIENT_LINE_RE, '');
      }
      for (const name of removedTags) {
        const strip = (text: string) => text.split(`{{${name}}}`).join('').replace(/[ \t]{2,}/g, ' ');
        english = strip(english);
        malay = strip(malay);
      }
      return { ...value, questions: next, content: english, contentMs: malay };
    });
    if (has && !had && !editorContent.includes('{{RECIPIENT}}')) onMessage('Recipient was added at the top of the letter. Move it in Write the letter if needed.');
    if (had && !has) onMessage('Recipient was taken out of the letter.');
    clearProblem('formQuestions', 'asksRecipient', 'content', 'contentMs');
  };

  // What stops a step from being finished, checked before moving on and before saving.
  const checkStep = (value: EditorStep): Partial<Record<EditorField, string>> => {
    const found: Partial<Record<EditorField, string>> = {};
    if (value === 'about') {
      if (!draft.name.trim()) found.name = 'Give the letter type a name.';
      const days = draft.readyInDays.trim();
      if (request && days && (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > MAX_READY_DAYS)) {
        found.readyInDays = `Use a whole number of working days from 1 to ${MAX_READY_DAYS}, or leave it blank.`;
      }
    }
    if (value === 'letter') {
      if (!editorContent.trim()) found.content = 'Write the letter in English. The Malay page is optional.';
      else Object.assign(found, wordingProblems(draft));
    }
    if (value === 'finish') {
      const months = draft.validMonths.trim();
      if (request && months && (!/^\d+$/.test(months) || Number(months) < 1 || Number(months) > MAX_VALID_MONTHS)) {
        found.validMonths = `Use a whole number of months from 1 to ${MAX_VALID_MONTHS}, or leave it blank.`;
      }
    }
    return Object.fromEntries(Object.entries(found).filter(([, message]) => message)) as Partial<Record<EditorField, string>>;
  };

  const goTo = (value: EditorStep) => setStep(value);

  const next = () => {
    const found = guided ? checkStep(shownStep) : {};
    if (Object.keys(found).length) {
      setProblems((value) => ({ ...value, ...found }));
      return;
    }
    const index = stepIndex + 1;
    setReached((value) => Math.max(value, index));
    setStep(steps[index]);
  };

  const save = async () => {
    if (saving) return;
    const local = steps.reduce<Partial<Record<EditorField, string>>>((found, value) => ({ ...found, ...checkStep(value) }), {});
    if (Object.keys(local).length) {
      setProblems(local);
      setStep(stepOf(Object.keys(local)[0] as EditorField));
      return;
    }
    const submitted = draft;
    const months = submitted.validMonths.trim();
    const days = submitted.readyInDays.trim();
    const body = {
      name: submitted.name.trim(),
      type: submitted.type,
      description: submitted.description,
      referencePrefix: submitted.referencePrefix.trim(),
      content: submitted.content,
      contentMs: submitted.contentMs,
      customFields: editorFields,
      status: submitted.status,
      purpose: submitted.purpose,
      formQuestions: request ? submitted.questions : [],
      validMonths: request && months ? Number(months) : null,
      readyInDays: request && days ? Number(days) : null,
      signatoryName: submitted.signatoryName.trim(),
      signatoryTitle: submitted.signatoryTitle.trim(),
      signatoryNameMs: submitted.signatoryNameMs.trim(),
      signatoryTitleMs: submitted.signatoryTitleMs.trim(),
    };
    setSaving(true);
    try {
      const result = current ? await updateLetterTemplate(current.id, body) : await createLetterTemplate(body);
      const fresh = valuesOf(result);
      if (!current) finished.current = true;
      setCurrent(result);
      setSaved(fresh);
      // Keep anything typed while saving.
      if (sameValues(draftRef.current, submitted)) setDraft(fresh);
      setProblems({});
      onSaved(result, !current);
      onMessage(`Letter type "${result.name}" ${current ? 'saved' : 'created'}.`);
    } catch (err) {
      const errors = fieldErrors(err);
      const found = Object.fromEntries(Object.keys(FIELD_STEPS).filter((field) => errors[field]).map((field) => [field, errors[field]])) as Partial<Record<EditorField, string>>;
      setProblems(found);
      const first = Object.keys(found)[0] as EditorField | undefined;
      if (first) setStep(stepOf(first));
      onMessage(`Not saved: ${err instanceof Error ? err.message : 'please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!current || saving) return;
    setSaving(true);
    try {
      await deleteLetterTemplate(current.id);
      finished.current = true;
      onDeleted(current);
    } catch (err) {
      onMessage(err instanceof Error ? `Not deleted: ${err.message}` : 'Not deleted.');
      setSaving(false);
      setConfirmingDelete(false);
    }
  };

  const problemList = (Object.entries(problems) as [EditorField, string][]).filter(([, message]) => message);
  const elsewhere = problemList.filter(([field]) => stepOf(field) !== shownStep);
  const typeOptions = draft.type && !LETTER_TYPES.includes(draft.type) ? [...LETTER_TYPES, draft.type] : LETTER_TYPES;
  const referenceExample = `${(draft.referencePrefix.trim() || DEFAULT_REFERENCE_PREFIX).replace(/\/+$/, '')}/${new Date().getFullYear()}/0001`;
  const malayNameFallback = draft.signatoryName.trim() || LETTERHEAD.malaySignatoryName;
  const malayTitleFallback = draft.signatoryTitle.trim() || LETTERHEAD.malaySignatoryOffice;
  const last = stepIndex === steps.length - 1;

  return (
    <RecordPage
      title={draft.name.trim() || (current ? 'Untitled letter type' : 'New letter type')}
      subtitle={current ? `${PURPOSE_CHIP[draft.purpose]} · last changed ${current.lastModified}${current.modifiedBy ? ` by ${current.modifiedBy}` : ''}` : 'Not saved yet. Go through the steps, then create it at the end.'}
      backLabel="Back to letter types"
      onBack={onClose}
      pageKey={`letter-type:${current?.id ?? 'new'}`}
      dirty={dirty && !finished.current}
      busy={saving}
      navigationComplete={finished}
    >
      {!guided && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone={STATUS_TONE[saved.status]} dot>{saved.status}</StatusBadge>
            {dirty && <span className="text-[12.5px] font-semibold text-amber-800">Unsaved changes</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <PortalButton variant="ghost" icon={Trash2} disabled={saving} onClick={() => setConfirmingDelete(true)}>Delete</PortalButton>
            {dirty && <PortalButton disabled={saving} onClick={() => { setDraft(saved); setProblems({}); onMessage('Changes discarded.'); }}>Discard changes</PortalButton>}
            <PortalButton variant="primary" icon={Check} isLoading={saving} disabled={!dirty} onClick={() => void save()}>Save</PortalButton>
          </div>
        </div>
      )}

      <Steps steps={steps} current={shownStep} reached={reached} guided={guided} flagged={(value) => problemList.some(([field]) => stepOf(field) === value)} onGo={goTo} />

      <div>
        <h2 ref={stepHeading} tabIndex={-1} className="text-lg font-semibold text-brand-navy focus:outline-none">
          {stepIndex + 1}. {STEP_LABELS[shownStep]}
        </h2>
        <p className="card-description mt-1">{STEP_INTROS[shownStep]}</p>
      </div>

      {elsewhere.length > 0 && (
        <AlertMessage type="error" title="Some steps need attention" message="Correct these, then save again.">
          <ul className="list-disc space-y-1 pl-5">
            {elsewhere.map(([field, message]) => (
              <li key={field}>
                <button type="button" className="text-left font-medium underline underline-offset-2 cursor-pointer" onClick={() => goTo(stepOf(field))}>
                  {STEP_LABELS[stepOf(field)]}: {message}
                </button>
              </li>
            ))}
          </ul>
        </AlertMessage>
      )}

      {shownStep === 'about' && (
        <div className="space-y-6">
          <AppointmentSection title="When is this letter used?" description="This decides who gets the letter, and whether students fill in a form for it." icon={Settings2}>
            <fieldset>
              <legend className="sr-only">When is this letter used?</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {PURPOSE_OPTIONS.map((option) => {
                  const chosen = editorPurpose === option.value;
                  const Icon = PURPOSE_ICONS[option.value];
                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-navy ${chosen ? 'border-brand-navy bg-slate-50 ring-1 ring-brand-navy' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <input
                        type="radio"
                        name="letter-template-purpose"
                        value={option.value}
                        checked={chosen}
                        onChange={() => { set({ purpose: option.value }); clearProblem('purpose', 'formQuestions'); }}
                        className="sr-only"
                      />
                      <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chosen ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-slate-800">{option.label}</span>
                        <span className="mt-0.5 block card-caption text-[11.5px] leading-snug">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {PURPOSE_NOTE[editorPurpose] && <AlertMessage type="info" message={PURPOSE_NOTE[editorPurpose] ?? ''} />}
            {!request && draft.questions.length > 0 && (
              <AlertMessage type="warning" message="Letters sent automatically have no student form, so its questions will not be kept." />
            )}
            {problems.purpose && <p role="alert" className="text-sm font-medium text-rose-800">{problems.purpose}</p>}
          </AppointmentSection>

          <AppointmentSection title="Name and description" description="How the letter appears in lists, to students and to staff." icon={FileSignature}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" htmlFor="letter-template-name" error={problems.name}>
                <input
                  id="letter-template-name"
                  type="text"
                  value={draft.name}
                  maxLength={255}
                  onChange={(event) => { set({ name: event.target.value }); clearProblem('name'); }}
                  aria-invalid={problems.name ? true : undefined}
                  className={`form-control form-control-md ${problems.name ? 'form-control-error' : ''}`}
                  placeholder="For example: Student Confirmation Letter"
                />
              </Field>
              <Field label="Category" htmlFor="letter-template-type" hint="Shown under the name, to group similar letters.">
                <SelectMenu id="letter-template-type" value={draft.type} options={typeOptions.map((type) => ({ value: type, label: type }))} onChange={(type) => set({ type })} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Short description" htmlFor="letter-template-description" hint={request ? 'Students see this when choosing a letter.' : 'Staff see this in the list of letter types.'} error={problems.description}>
                  <textarea
                    id="letter-template-description"
                    rows={3}
                    value={draft.description}
                    maxLength={500}
                    onChange={(event) => { set({ description: event.target.value }); clearProblem('description'); }}
                    className="form-control form-control-md resize-none"
                    placeholder="What this letter is for, for example: Confirms you are a registered student, for banks and agencies."
                  />
                </Field>
              </div>
              {request && (
                <Field label="Usually ready in (working days)" htmlFor="letter-template-ready-days" hint="Shown to students before they send a request. Leave blank to say nothing." error={problems.readyInDays}>
                  <input
                    id="letter-template-ready-days"
                    type="text"
                    inputMode="numeric"
                    value={draft.readyInDays}
                    maxLength={2}
                    onChange={(event) => { set({ readyInDays: event.target.value.replace(/\D/g, '') }); clearProblem('readyInDays'); }}
                    className="form-control form-control-md w-40"
                    placeholder="For example: 2"
                  />
                </Field>
              )}
            </div>
          </AppointmentSection>
        </div>
      )}

      {shownStep === 'form' && (
        <LetterQuestionsEditor
          questions={draft.questions}
          onChange={changeQuestions}
          wording={`${editorContent}\n${draft.contentMs}`}
          takenNames={editorFields.map((f) => f.name)}
          purposes={purposes}
          lists={lists}
          listItems={listItems}
          onNeedList={needList}
          error={problems.formQuestions || problems.asksRecipient}
          onOpenLists={onOpenLists}
        />
      )}

      {shownStep === 'letter' && (
        <LetterWordingEditor
          values={draft}
          onChange={set}
          placeholders={placeholders}
          problems={{ content: problems.content, contentMs: problems.contentMs, customFields: problems.customFields }}
          onEdited={(field) => clearProblem(field)}
          onMessage={onMessage}
        />
      )}

      {shownStep === 'finish' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7 space-y-6">
            <AppointmentSection title="Signature and reference number" icon={FileSignature}>
              <Field label="Signed by (name)" htmlFor="letter-template-signatory-name" hint={`Leave blank to use ${LETTERHEAD.signatoryName}.`} error={problems.signatoryName}>
                <input id="letter-template-signatory-name" type="text" value={draft.signatoryName} maxLength={120} onChange={(event) => { set({ signatoryName: event.target.value }); clearProblem('signatoryName'); }} className="form-control form-control-md" placeholder={LETTERHEAD.signatoryName} />
              </Field>
              <Field label="Signed by (title)" htmlFor="letter-template-signatory-title" hint={`Leave blank to use ${LETTERHEAD.signatoryOffice}.`} error={problems.signatoryTitle}>
                <input id="letter-template-signatory-title" type="text" value={draft.signatoryTitle} maxLength={120} onChange={(event) => { set({ signatoryTitle: event.target.value }); clearProblem('signatoryTitle'); }} className="form-control form-control-md" placeholder={LETTERHEAD.signatoryOffice} />
              </Field>
              {draft.contentMs.trim() && (
                <>
                  <Field label="Signed by on the Malay page (name)" htmlFor="letter-template-signatory-name-ms" hint={`Leave blank to use ${malayNameFallback}.`} error={problems.signatoryNameMs}>
                    <input id="letter-template-signatory-name-ms" type="text" value={draft.signatoryNameMs} maxLength={120} onChange={(event) => { set({ signatoryNameMs: event.target.value }); clearProblem('signatoryNameMs'); }} className="form-control form-control-md" placeholder={malayNameFallback} />
                  </Field>
                  <Field label="Signed by on the Malay page (title)" htmlFor="letter-template-signatory-title-ms" hint={`Leave blank to use ${malayTitleFallback}.`} error={problems.signatoryTitleMs}>
                    <input id="letter-template-signatory-title-ms" type="text" value={draft.signatoryTitleMs} maxLength={120} onChange={(event) => { set({ signatoryTitleMs: event.target.value }); clearProblem('signatoryTitleMs'); }} className="form-control form-control-md" placeholder={malayTitleFallback} />
                  </Field>
                </>
              )}
              <Field label="Reference number starts with" htmlFor="letter-template-prefix" hint={`Letters are numbered ${referenceExample}, then 0002 and so on.`} error={problems.referencePrefix}>
                <input id="letter-template-prefix" type="text" value={draft.referencePrefix} maxLength={64} onChange={(event) => { set({ referencePrefix: event.target.value }); clearProblem('referencePrefix'); }} className="form-control form-control-md" placeholder={DEFAULT_REFERENCE_PREFIX} />
              </Field>
              {request && (
                <Field label="Valid for (months)" htmlFor="letter-template-valid-months" hint="For letters accepted only for a while, such as bank or student pass letters. Leave blank if it has no end date." error={problems.validMonths}>
                  <input id="letter-template-valid-months" type="text" inputMode="numeric" value={draft.validMonths} maxLength={2} onChange={(event) => { set({ validMonths: event.target.value.replace(/\D/g, '') }); clearProblem('validMonths'); }} className="form-control form-control-md w-40" placeholder="For example: 3" />
                </Field>
              )}
            </AppointmentSection>
          </div>
          <div className="lg:col-span-5">
            <AppointmentSection title="Status" description={guided ? 'You can change this later.' : undefined} icon={ShieldCheck}>
              <fieldset className="space-y-2">
                <legend className="sr-only">Status</legend>
                {statusChoices(request, guided).map((choice) => {
                  const chosen = draft.status === choice.value;
                  return (
                    <label
                      key={choice.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${chosen ? 'border-brand-navy bg-slate-50 ring-1 ring-brand-navy' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <input
                        type="radio"
                        name="letter-template-status"
                        value={choice.value}
                        checked={chosen}
                        onChange={() => { set({ status: choice.value }); clearProblem('status'); }}
                        className="mt-1 accent-[#0c1424]"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-slate-800">{choice.value}</span>
                        <span className="block card-caption text-[11.5px] leading-snug">{choice.description}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              {problems.status && <p role="alert" className="text-sm font-medium text-rose-800">{problems.status}</p>}
            </AppointmentSection>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5">
        <div>
          {stepIndex > 0 && (
            <PortalButton icon={ArrowLeft} disabled={saving} onClick={() => goTo(steps[stepIndex - 1])}>
              Back
            </PortalButton>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!last && (
            <PortalButton variant={guided ? 'primary' : 'secondary'} icon={ArrowRight} iconPosition="right" onClick={next}>
              {guided ? 'Continue' : `Next: ${STEP_LABELS[steps[stepIndex + 1]]}`}
            </PortalButton>
          )}
          {last && guided && (
            <PortalButton variant="primary" icon={Check} isLoading={saving} onClick={() => void save()}>
              Create letter type
            </PortalButton>
          )}
        </div>
      </div>

      <PortalConfirmModal
        isOpen={confirmingDelete && current !== null}
        title="Delete this letter type?"
        message={
          current
            ? `"${current.name}" will be deleted permanently.${
                current.status !== 'Active' ? '' : isAppointmentLetter(current.purpose) ? ' No more of these appointment letters are made until another letter type is active.' : ' Students will no longer be able to ask for this letter.'
              } To keep the wording but stop using it, set its status to Archived instead.`
            : ''
        }
        confirmLabel="Delete"
        tone="danger"
        isLoading={saving}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </RecordPage>
  );
};
