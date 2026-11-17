/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The "Questions for students" step of a letter type: the questions students answer when
// they ask for it, in order, with a live preview of their form. "Who is the
// letter for?" offers the office's recipients list; the office's own questions
// become blanks it can place in the letter.

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, CalendarDays, List, ListChecks, ListPlus, Pencil, Plus, ToggleLeft, Trash2, Type, X, type LucideIcon } from 'lucide-react';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { AppointmentIcon } from './AppointmentPrimitives';
import { ToggleSwitch } from './ToggleSwitch';
import { PortalSelect } from './PortalSelect';
import { LetterFormFields } from './LetterFormFields';
import type { ChoiceListSummary, LetterFormQuestion, LetterQuestion, LetterQuestionKind, LetterRecipientPurpose } from '../types';
import { EMPTY_REQUEST_DETAILS, OPTIONAL_DETAIL_LABELS, offeredDetails } from '../utils/letterRecipients';
import { MAX_QUESTIONS, QUESTION_KINDS, isCustomQuestion, listInWords, newQuestion, questionKindLabel } from '../utils/letterEditor';

interface LetterQuestionsEditorProps {
  questions: LetterQuestion[];
  onChange: (questions: LetterQuestion[]) => void;
  /** Both pages of the wording, to know which optional lines it shows. */
  wording: string;
  /** Tags the office's own blanks use, which questions may not take. */
  takenNames: readonly string[];
  purposes: LetterRecipientPurpose[] | null;
  lists: ChoiceListSummary[] | null;
  /** The entries of a simple list, for the preview; loaded on demand. */
  listItems: Record<string, { id: string; name: string }[]>;
  onNeedList: (listId: string) => void;
  error?: string;
  onOpenLists: () => void;
}

const today = new Date().toISOString();
const KIND_ICONS: Record<LetterQuestionKind, LucideIcon> = { recipient: Building2, extras: ListPlus, text: Type, date: CalendarDays, choice: List, yesno: ToggleLeft };

export const LetterQuestionsEditor: React.FC<LetterQuestionsEditorProps> = ({
  questions,
  onChange,
  wording,
  takenNames,
  purposes,
  lists,
  listItems,
  onNeedList,
  error,
  onOpenLists,
}) => {
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState<LetterQuestionKind | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [labelError, setLabelError] = useState<string | null>(null);
  const simpleLists = (lists ?? []).filter((list) => list.kind === 'SIMPLE');
  const offered = offeredDetails(wording);
  const has = (kind: LetterQuestionKind) => questions.some((question) => question.kind === kind);

  useEffect(() => {
    for (const question of questions) if (question.kind === 'choice' && question.listId) onNeedList(String(question.listId));
  }, [questions, onNeedList]);

  const replace = (index: number, changes: Partial<LetterQuestion>) =>
    onChange(questions.map((question, i) => (i === index ? { ...question, ...changes } : question)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...questions];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved);
    onChange(next);
    setEditing(null);
  };
  const remove = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
    setEditing(null);
  };

  const startAdding = (kind: LetterQuestionKind) => {
    setMenuOpen(false);
    if (kind === 'recipient' || kind === 'extras') {
      const added = newQuestion(kind, '', []);
      onChange(kind === 'recipient' ? [added, ...questions] : [...questions, added]);
      return;
    }
    setAdding(kind);
    setNewLabel('');
    setLabelError(null);
  };

  const finishAdding = () => {
    if (!adding) return;
    const label = newLabel.trim();
    if (!label) {
      setLabelError('Type the question the student sees, for example "Travel date".');
      return;
    }
    const taken = [...takenNames, ...questions.map((question) => question.name ?? '').filter(Boolean)];
    const added = newQuestion(adding, label, taken);
    onChange([...questions, added]);
    setAdding(null);
    setEditing(questions.length);
  };

  // The student's form as it will look, built from the questions being edited.
  const preview = useMemo<LetterFormQuestion[]>(
    () =>
      questions.flatMap((question): LetterFormQuestion[] => {
        if (question.kind === 'recipient') {
          const all = purposes ?? [];
          const options = question.purposes?.length ? all.filter((p) => question.purposes?.includes(p.code)) : all;
          return [{ ...question, kind: 'recipient', options }];
        }
        if (question.kind === 'extras') {
          return offered.length ? [{ kind: 'extras', options: offered.map((code) => ({ code, label: OPTIONAL_DETAIL_LABELS[code] })) }] : [];
        }
        if (question.kind === 'choice' && !question.listId) {
          const typed = [...new Set((question.options ?? []).map((option) => option.trim()).filter(Boolean))];
          return [{ ...question, kind: 'choice', list: { id: null, name: '', itemNoun: 'Option', items: typed.map((option) => ({ id: option, name: option })) } }];
        }
        if (question.kind === 'choice') {
          const list = simpleLists.find((item) => item.id === String(question.listId));
          return [{ ...question, kind: 'choice', list: { id: list?.id ?? null, name: list?.name ?? '', itemNoun: list?.itemNoun ?? 'Item', items: listItems[String(question.listId)] ?? [] } }];
        }
        return [{ ...question, kind: question.kind as 'text' | 'date' | 'yesno' }];
      }),
    [questions, purposes, offered, simpleLists, listItems],
  );

  const summary = (question: LetterQuestion) => {
    if (question.kind === 'recipient') {
      const chosen = question.purposes?.length
        ? (purposes ?? []).filter((p) => question.purposes?.includes(p.code)).map((p) => p.label)
        : ['every purpose'];
      return `Students choose from ${listInWords(chosen)}${question.askAddress === false ? '.' : ', then give the address.'}`;
    }
    if (question.kind === 'extras') {
      return offered.length
        ? `Students tick ${listInWords(offered.map((code) => OPTIONAL_DETAIL_LABELS[code].toLowerCase()))} to show them on the letter.`
        : 'The letter shows none of these yet. Add Semesters Left or Current Semester in Write the letter.';
    }
    const parts = [
      questionKindLabel(question.kind),
      question.kind === 'yesno' ? '' : question.required ? 'Required' : 'Optional',
      wording.includes(`{{${question.name}}}`) ? 'Shown on the letter' : 'Not on the letter yet',
    ].filter(Boolean);
    if (question.kind === 'choice') {
      const list = simpleLists.find((item) => item.id === String(question.listId));
      const typed = (question.options ?? []).filter((option) => option.trim()).length;
      parts.splice(1, 0, question.listId ? (list ? `from ${list.name}` : 'No list chosen') : typed ? `${typed} option${typed === 1 ? '' : 's'}` : 'No options yet');
    }
    return parts.join(' · ');
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
      <section aria-labelledby="letter-questions-heading" className="xl:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <AppointmentIcon icon={ListChecks} tone="info" />
          <div className="min-w-0">
            <h2 id="letter-questions-heading" className="section-label">Questions</h2>
            <p className="card-caption mt-0.5">The student's name, matric number, programme and today's date are filled in for them.</p>
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

        {questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center card-description">
            No questions yet. Students can still write a note to the office.
          </p>
        ) : (
        <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {questions.map((question, index) => (
            <li key={`${question.kind}-${question.name ?? index}`} className="px-4 py-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="card-value text-slate-800">{isCustomQuestion(question) ? question.label : questionKindLabel(question.kind)}</p>
                  <p className="card-caption mt-0.5 text-[11.5px]">{summary(question)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <PortalButton size="icon" variant="ghost" icon={ArrowUp} aria-label={`Move ${question.label ?? questionKindLabel(question.kind)} up`} disabled={index === 0} onClick={() => move(index, -1)} />
                  <PortalButton size="icon" variant="ghost" icon={ArrowDown} aria-label={`Move ${question.label ?? questionKindLabel(question.kind)} down`} disabled={index === questions.length - 1} onClick={() => move(index, 1)} />
                  {question.kind !== 'extras' && (
                    <PortalButton size="icon" variant="ghost" icon={editing === index ? X : Pencil} aria-label={`${editing === index ? 'Close' : 'Edit'} ${question.label ?? questionKindLabel(question.kind)}`} onClick={() => setEditing(editing === index ? null : index)} />
                  )}
                  <PortalButton size="icon" variant="ghost" icon={Trash2} aria-label={`Remove ${question.label ?? questionKindLabel(question.kind)}`} onClick={() => remove(index)} />
                </div>
              </div>

              {editing === index && question.kind === 'recipient' && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <fieldset className="space-y-2">
                    <legend className="text-[12.5px] font-semibold text-slate-700">Purposes students can choose</legend>
                    <p className="card-caption">Select none to offer every purpose.</p>
                    <div className="flex flex-wrap gap-2">
                      {(purposes ?? []).map((purpose) => {
                        const on = question.purposes?.includes(purpose.code) ?? false;
                        return (
                          <button
                            key={purpose.code}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              replace(index, { purposes: on ? (question.purposes ?? []).filter((code) => code !== purpose.code) : [...(question.purposes ?? []), purpose.code] })
                            }
                            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold cursor-pointer ${on ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                          >
                            {purpose.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                    <div>
                      <p id={`ask-address-${index}`} className="text-[12.5px] font-semibold text-slate-700">Ask for the address</p>
                    </div>
                    <ToggleSwitch id={`ask-address-switch-${index}`} checked={question.askAddress !== false} onChange={(on) => replace(index, { askAddress: on })} labelledBy={`ask-address-${index}`} className="py-0" />
                  </div>
                  <PortalButton size="sm" variant="ghost" onClick={onOpenLists}>Edit purposes and organisations in Lists</PortalButton>
                </div>
              )}

              {editing === index && isCustomQuestion(question) && (
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                  <label className="form-label sm:col-span-2">
                    Question
                    <input className="form-control form-control-sm mt-1" maxLength={80} value={question.label ?? ''} onChange={(event) => replace(index, { label: event.target.value })} />
                  </label>
                  <label className="form-label sm:col-span-2">
                    Help text (optional)
                    <input className="form-control form-control-sm mt-1" maxLength={200} value={question.hint ?? ''} placeholder="Shown under the question" onChange={(event) => replace(index, { hint: event.target.value })} />
                  </label>
                  {question.kind === 'choice' && !question.listId && (
                    <fieldset className="space-y-2 sm:col-span-2">
                      <legend className="form-label">Options</legend>
                      {(question.options ?? []).map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300" />
                          <input
                            className="form-control form-control-sm"
                            maxLength={120}
                            aria-label={`Option ${optionIndex + 1}`}
                            placeholder={`Option ${optionIndex + 1}`}
                            value={option}
                            onChange={(event) => {
                              const options = [...(question.options ?? [])];
                              options[optionIndex] = event.target.value;
                              replace(index, { options });
                            }}
                            onPaste={(event) => {
                              const lines = event.clipboardData.getData('text').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
                              if (lines.length < 2) return;
                              event.preventDefault();
                              const options = [...(question.options ?? [])];
                              options.splice(optionIndex, 1, ...lines);
                              replace(index, { options });
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') return;
                              event.preventDefault();
                              const options = [...(question.options ?? [])];
                              options.splice(optionIndex + 1, 0, '');
                              replace(index, { options });
                            }}
                          />
                          <PortalButton
                            size="icon"
                            variant="ghost"
                            icon={X}
                            aria-label={`Remove option ${optionIndex + 1}`}
                            disabled={(question.options ?? []).length <= 2}
                            onClick={() => replace(index, { options: (question.options ?? []).filter((_, i) => i !== optionIndex) })}
                          />
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-5">
                        <button type="button" className="text-[12.5px] font-semibold text-blue-700 hover:underline cursor-pointer" onClick={() => replace(index, { options: [...(question.options ?? []), ''] })}>
                          + Add option
                        </button>
                        <span className="card-caption">Paste a list to add many at once.</span>
                      </div>
                      {simpleLists.length > 0 && (
                        <button type="button" className="pl-5 text-[12px] font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer" onClick={() => replace(index, { options: undefined, listId: Number(simpleLists[0].id) })}>
                          Use a saved list instead
                        </button>
                      )}
                    </fieldset>
                  )}
                  {question.kind === 'choice' && Boolean(question.listId) && (
                    <label className="form-label sm:col-span-2">
                      Saved list
                      <PortalSelect
                        className="form-control form-control-sm mt-1"
                        value={question.listId ? String(question.listId) : ''}
                        onChange={(event) => replace(index, { listId: Number(event.target.value) || undefined })}
                      >
                        {simpleLists.map((list) => (
                          <option key={list.id} value={list.id}>{list.name} ({list.itemCount})</option>
                        ))}
                      </PortalSelect>
                      <span className="mt-1 flex flex-wrap gap-x-4">
                        <button type="button" className="text-[12px] font-semibold text-blue-700 hover:underline cursor-pointer" onClick={onOpenLists}>Edit saved lists</button>
                        <button type="button" className="text-[12px] font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer" onClick={() => replace(index, { listId: undefined, options: ['', ''] })}>Type the options instead</button>
                      </span>
                    </label>
                  )}
                  {question.kind !== 'yesno' && (
                    <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 accent-brand-navy" checked={Boolean(question.required)} onChange={(event) => replace(index, { required: event.target.checked })} />
                      Students must answer
                    </label>
                  )}
                  <p className="card-caption sm:col-span-2">
                    {wording.includes(`{{${question.name}}}`) ? 'The answer is shown on the letter.' : 'To show the answer on the letter, add it with Insert detail in step 3, Write the letter.'}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ol>
        )}

        {adding ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label htmlFor="new-question-label" className="block text-[12.5px] font-semibold text-slate-700">
              {questionKindLabel(adding)}: type the question students will see
            </label>
            <input
              id="new-question-label"
              autoFocus
              className={`form-control form-control-sm ${labelError ? 'form-control-error' : ''}`}
              maxLength={80}
              value={newLabel}
              placeholder={adding === 'date' ? 'For example: Travel date' : adding === 'choice' ? 'For example: Which embassy?' : adding === 'yesno' ? 'For example: Travelling with family?' : 'For example: Passport number'}
              onChange={(event) => {
                setNewLabel(event.target.value);
                setLabelError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  finishAdding();
                }
              }}
            />
            {labelError && <p role="alert" className="text-sm text-rose-800">{labelError}</p>}
            <div className="flex justify-end gap-2">
              <PortalButton size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</PortalButton>
              <PortalButton size="sm" variant="primary" onClick={finishAdding}>Add question</PortalButton>
            </div>
          </div>
        ) : (
          menuOpen ? (
            <div role="group" aria-labelledby="add-question-heading" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 id="add-question-heading" className="card-value text-slate-800">Add a question</h3>
                <PortalButton size="icon" variant="ghost" icon={X} aria-label="Close" onClick={() => setMenuOpen(false)} />
              </div>
              {[true, false].map((readyMade) => (
                <div key={String(readyMade)} className="space-y-2">
                  <p className="card-label">{readyMade ? 'Common questions' : 'Your own question'}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {QUESTION_KINDS.filter((kind) => kind.readyMade === readyMade).map((kind) => {
                      const taken = kind.readyMade && has(kind.kind);
                      const Icon = KIND_ICONS[kind.kind];
                      return (
                        <button
                          key={kind.kind}
                          type="button"
                          disabled={taken}
                          onClick={() => startAdding(kind.kind)}
                          className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-brand-navy hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                          <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-slate-800">{kind.label}{taken ? ' (added)' : ''}</span>
                            <span className="block text-[12px] text-slate-500">{kind.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <PortalButton icon={Plus} disabled={questions.length >= MAX_QUESTIONS} onClick={() => setMenuOpen(true)}>
              Add question
            </PortalButton>
          )
        )}
      </section>

      <section aria-labelledby="letter-form-preview-heading" className="xl:col-span-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-5 py-4">
          <h2 id="letter-form-preview-heading" className="text-base font-semibold text-brand-navy">What the student sees</h2>
          <StatusBadge tone="neutral">Preview</StatusBadge>
        </div>
        <div className="space-y-4 px-5 py-5">
          <LetterFormFields
            questions={preview}
            programme="MASTER OF DATA SCIENCE (COURSEWORK)"
            applicationDate={new Date(today).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            details={EMPTY_REQUEST_DETAILS}
            onDetails={() => undefined}
            answers={{}}
            onAnswer={() => undefined}
            preview
          />
        </div>
      </section>
    </div>
  );
};
