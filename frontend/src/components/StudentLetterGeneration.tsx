/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Student letters (UC23): ask the postgraduate office for an official letter,
// then follow the request. The student never sees a letter's wording before
// the office approves it, so a letter cannot be copied from the screen.

import React, { useCallback, useEffect, useState } from 'react';
import { Clock, FilePlus2, FileText, Inbox, Info, Send } from 'lucide-react';
import { PageHeader, PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { OfficeToolViews } from './OfficeToolPrimitives';
import { AppointmentIcon } from './AppointmentPrimitives';
import { LoadingState, ErrorState, EmptyState } from './StateViews';
import { StudentLetterRequests, shortDate } from './IssuedLetters';
import { StudentLetterRequestForm, type LetterRequestStart } from './StudentLetterRequestForm';
import { GeneratedLetter, LetterTemplate } from '../types';
import { getMyLetterRequests, getStudentLetterTemplates, inactiveStudentReason } from '../services';
import { isCustomQuestion, listInWords } from '../utils/letterEditor';

export type StudentLetterView = 'new' | 'history';

interface StudentLetterGenerationProps {
  /** Which tab is open; driven by the route when the app provides it. */
  view?: StudentLetterView;
  onViewChange?: (view: StudentLetterView) => void;
  /** The letter whose application form is open, from the route. */
  requestTemplateId?: string | null;
  onOpenRequestForm?: (templateId: string) => void;
  onCloseRequestForm?: () => void;
  // The signed-in student's identity, shown on the application form.
  studentName?: string;
  studentId?: string;
  programme?: string;
}

/** What a letter's form will ask, in a few words, e.g. "who it is for and your travel date". */
export function askedFor(template: LetterTemplate): string {
  const questions = template.formQuestions ?? [];
  const parts = [
    questions.some((question) => question.kind === 'recipient') ? 'who it is for' : '',
    ...questions.filter(isCustomQuestion).map((question) => (question.label ?? '').replace(/\?$/, '').toLowerCase()),
  ].filter(Boolean);
  return parts.length ? listInWords(parts) : '';
}

export const StudentLetterGeneration: React.FC<StudentLetterGenerationProps> = ({
  view,
  onViewChange,
  requestTemplateId,
  onOpenRequestForm,
  onCloseRequestForm,
  studentName = '',
  studentId = '',
  programme = '',
}) => {
  const [localView, setLocalView] = useState<StudentLetterView>('new');
  const activeView = view ?? localView;
  const changeView = (next: StudentLetterView) => (onViewChange ? onViewChange(next) : setLocalView(next));
  const [localFormId, setLocalFormId] = useState<string | null>(null);
  const formTemplateId = onOpenRequestForm ? requestTemplateId ?? null : localFormId;
  // Last time's answers, when the student asks for the same letter again.
  const [start, setStart] = useState<(LetterRequestStart & { templateId: string }) | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  // Letters the student may ask for (Active templates, without their wording).
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // The student's requests ("My requests").
  const [letters, setLetters] = useState<GeneratedLetter[]>([]);
  const [lettersLoading, setLettersLoading] = useState(true);
  const [lettersError, setLettersError] = useState<string | null>(null);

  // Set when the server refuses letters because the student's status is not Active.
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    getStudentLetterTemplates()
      .then(setTemplates)
      .catch((err) => {
        const reason = inactiveStudentReason(err);
        if (reason) setBlockedReason(reason);
        else setTemplatesError(err instanceof Error ? err.message : 'Failed to load the letters you can request.');
      })
      .finally(() => setTemplatesLoading(false));
  }, []);

  const loadLetters = useCallback(() => {
    setLettersLoading(true);
    setLettersError(null);
    getMyLetterRequests()
      .then(setLetters)
      .catch((err) => {
        const reason = inactiveStudentReason(err);
        if (reason) setBlockedReason(reason);
        else setLettersError(err instanceof Error ? err.message : 'Failed to load your requests.');
      })
      .finally(() => setLettersLoading(false));
  }, []);

  useEffect(() => {
    loadTemplates();
    loadLetters();
  }, [loadTemplates, loadLetters]);

  const pendingFor = (templateId: string) =>
    letters.find((letter) => letter.templateId === templateId && letter.status === 'Pending') ?? null;
  const currentCopies = (templateId: string) =>
    letters.filter((letter) => letter.templateId === templateId && letter.status === 'Issued');

  const replaceLetter = (changed: GeneratedLetter) =>
    setLetters((rows) => rows.map((row) => (row.id === changed.id ? changed : row)));

  const openForm = (template: LetterTemplate, from: LetterRequestStart | null = null) => {
    setStart(from ? { ...from, templateId: template.id } : null);
    if (onOpenRequestForm) onOpenRequestForm(template.id);
    else setLocalFormId(template.id);
  };

  const closeForm = (next: StudentLetterView = 'new') => {
    setLocalFormId(null);
    setStart(null);
    if (next === 'history' || !onCloseRequestForm) changeView(next);
    else onCloseRequestForm();
  };

  // Ask for the same letter again, starting from that request's answers.
  const requestAgain = (letter: GeneratedLetter) => {
    const template = templates.find((t) => t.id === letter.templateId);
    if (!template) {
      showToast(`A ${letter.templateName} cannot be requested right now.`);
      return;
    }
    const details = letter.requestDetails ?? {};
    openForm(template, {
      details: details.organisation ? details : undefined,
      answers: Object.fromEntries(Object.entries(details.answers ?? {}).map(([name, answer]) => [name, answer.answer])),
    });
  };

  if (blockedReason) {
    return (
      <div id="student-letter-generation-workspace" className="space-y-6 text-left font-sans text-xs pb-12">
        <PageHeader title="Letter Generation" />
        <div role="alert" className="bg-white border border-amber-200 rounded-2xl p-8 text-center shadow-3xs max-w-xl mx-auto">
          <Info className="w-6 h-6 text-amber-500 mx-auto" />
          <p className="mt-3 text-sm font-black text-slate-800">Letter requests are not available</p>
          <p className="mt-1.5 text-[12px] font-semibold text-slate-500 leading-relaxed">{blockedReason}</p>
        </div>
      </div>
    );
  }

  if (formTemplateId) {
    const template = templates.find((t) => t.id === formTemplateId);
    return (
      <div id="student-letter-generation-workspace" className="text-left font-sans text-xs">
        <PortalToast message={toast} />
        {templatesLoading || lettersLoading ? (
          <LoadingState message="Opening the form…" />
        ) : !template ? (
          <div className="app-card p-8 text-center space-y-3 max-w-xl mx-auto">
            <p className="text-sm font-black text-slate-800">This letter cannot be requested right now</p>
            <p className="text-[12px] font-semibold text-slate-500">It may have been withdrawn by the office. Choose another letter.</p>
            <PortalButton size="sm" onClick={() => closeForm()}>Back to letters</PortalButton>
          </div>
        ) : (
          <StudentLetterRequestForm
            key={`${template.id}:${start?.templateId === template.id ? 'again' : 'new'}`}
            template={template}
            student={{ name: studentName, matricNumber: studentId, programme }}
            currentCopies={currentCopies(template.id)}
            pending={pendingFor(template.id)}
            start={start?.templateId === template.id ? start : null}
            onCancel={() => closeForm()}
            onSeeRequests={() => closeForm('history')}
            onSent={(created) => {
              setLetters((rows) => [created, ...rows]);
              closeForm('history');
              showToast(`Request sent for a ${created.templateName}. You will be notified when the office decides.`);
            }}
            onBlocked={setBlockedReason}
            onRefused={(message) => {
              loadTemplates();
              loadLetters();
              closeForm();
              showToast(message);
            }}
            onMessage={showToast}
          />
        )}
      </div>
    );
  }

  const waiting = letters.filter((letter) => letter.status === 'Pending').length;

  return (
    <div id="student-letter-generation-workspace" className="space-y-6 text-left font-sans text-xs pb-12">
      <PortalToast message={toast} />

      <PageHeader title="Letter Generation" />

      <OfficeToolViews<StudentLetterView>
        label="Letter Generation views"
        appearance="workspace"
        value={activeView}
        onChange={changeView}
        options={[
          { value: 'new', label: 'Request a letter', icon: FilePlus2 },
          { value: 'history', label: waiting ? `My requests (${waiting} waiting)` : `My requests (${letters.length})`, icon: Inbox },
        ]}
      />

      {activeView === 'history' ? (
        <StudentLetterRequests
          letters={letters}
          loading={lettersLoading}
          error={lettersError}
          onRetry={loadLetters}
          onMessage={showToast}
          onLetterChange={replaceLetter}
          onRequestAgain={requestAgain}
          readyInDays={Object.fromEntries(templates.map((template) => [template.id, template.readyInDays]))}
        />
      ) : (
        <>
          <section aria-labelledby="letter-choices-heading" className="app-card appointment-workspace-card">
            <div>
              <h2 id="letter-choices-heading" className="section-label">Which letter do you need?</h2>
            </div>

            {templatesLoading ? (
              <LoadingState message="Loading the letters you can request…" />
            ) : templatesError ? (
              <ErrorState message={templatesError} onRetry={loadTemplates} />
            ) : templates.length === 0 ? (
              <EmptyState icon={FileText} title="No letters can be requested right now" description="Check again later, or contact the postgraduate office." />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => {
                  const pending = pendingFor(template.id);
                  const copies = currentCopies(template.id);
                  const asks = askedFor(template);
                  return (
                    <li key={template.id}>
                      <article aria-label={template.name} className="flex h-full flex-col gap-3 rounded-xl border border-slate-200 p-5">
                        <div className="flex items-start gap-3">
                          <AppointmentIcon icon={FileText} tone="info" />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-brand-navy">{template.name}</h3>
                            <p className="card-caption mt-0.5">{template.type}</p>
                          </div>
                          {pending ? <StatusBadge tone="warning" dot>Waiting</StatusBadge> : copies.length ? <StatusBadge tone="success" dot>You have it</StatusBadge> : null}
                        </div>
                        {template.description && <p className="card-description text-slate-700">{template.description}</p>}
                        <dl className="space-y-1.5 text-[12.5px]">
                          {asks && (
                            <div className="flex gap-2">
                              <dt className="text-slate-500">You will be asked</dt>
                              <dd className="font-medium text-slate-700">{asks}</dd>
                            </div>
                          )}
                          {template.readyInDays ? (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                              <dd>Usually ready in {template.readyInDays} working day{template.readyInDays === 1 ? '' : 's'}</dd>
                            </div>
                          ) : null}
                        </dl>
                        {copies.length > 0 && !pending && (
                          <p className="card-description">
                            {template.asksRecipient
                              ? `You have ${copies.length === 1 ? 'a copy' : `${copies.length} copies`} for ${listInWords(copies.map((copy) => copy.requestDetails?.organisation || copy.referenceNumber))}.`
                              : `Your current copy: ${copies[0].referenceNumber}, approved ${shortDate(copies[0].decidedAt)}.`}
                          </p>
                        )}
                        {pending && <p className="card-description text-amber-800">Requested on {shortDate(pending.requestedAt)}, waiting for the office.</p>}
                        <div className="mt-auto flex flex-wrap gap-2 pt-1">
                          {pending ? (
                            <PortalButton size="sm" onClick={() => changeView('history')}>See request</PortalButton>
                          ) : (
                            <PortalButton size="sm" variant="primary" icon={Send} aria-label={`Request a ${template.name}`} onClick={() => openForm(template)}>
                              Request
                            </PortalButton>
                          )}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};
