/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The "Student form" step of a letter type: the questions students answer when
// they ask for it, in order, with a live preview of their form. "Who is the
// letter for?" offers the office's recipients list; the office's own questions
// become blanks it can place in the letter.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { AppointmentIcon } from './AppointmentPrimitives';
import { ToggleSwitch } from './ToggleSwitch';
import { PortalSelect } from './PortalSelect';
import { LetterFormFields } from './LetterFormFields';
import { FloatingMenu } from './FloatingMenu';
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
  const addButton = useRef<HTMLDivElement>(null);
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
    if (adding === 'choice' && simpleLists[0]) added.listId = Number(simpleLists[0].id);
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
      return `Offers ${listInWords(chosen)}${question.askAddress === false ? ', without the address' : ', then the address'}.`;
    }
    if (question.kind === 'extras') {
      return offered.length
        ? `Tick boxes for ${listInWords(offered.map((code) => OPTIONAL_DETAIL_LABELS[code].toLowerCase()))}. Those lines print only when ticked.`
        : 'The letter shows none of these yet. Add Semesters Left or Current Semester in Write the letter.';
    }
    const parts = [
      questionKindLabel(question.kind),
      question.required ? 'required' : 'optional',
      wording.includes(`{{${question.name}}}`) ? 'in the letter' : 'not in the letter yet',
    ];
    if (question.kind === 'choice') {
      const list = simpleLists.find((item) => item.id === String(question.listId));
      parts.splice(1, 0, list ? `from ${list.name}` : 'no list chosen');
    }
    return parts.join(' · ');
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
      <section aria-labelledby="letter-questions-heading" className="xl:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <AppointmentIcon icon={ListChecks} tone="info" />
          <div className="min-w-0">
            <h2 id="letter-questions-heading" className="section-label">Questions students answer</h2>
            <p className="card-description mt-1">In the order students see them. Their answers go on the letter where you place them.</p>
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

        <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          <li className="flex items-center gap-3 px-4 py-3 bg-slate-50/60">
            <span className="card-value text-slate-500">Programme</span>
            <span className="card-caption">From the student record. Always asked.</span>
          </li>
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
                    <legend className="text-[12.5px] font-semibold text-slate-700">Purposes offered</legend>
                    <p className="card-caption">None ticked offers every purpose. Purposes and their organisations are kept in Lists.</p>
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
                      <p className="card-caption">Students must fill it in; only the second line is optional.</p>
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
                    Hint (optional)
                    <input className="form-control form-control-sm mt-1" maxLength={200} value={question.hint ?? ''} placeholder="Shown beside the field" onChange={(event) => replace(index, { hint: event.target.value })} />
                  </label>
                  {question.kind === 'choice' && (
                    <label className="form-label sm:col-span-2">
                      List
                      <PortalSelect
                        className="form-control form-control-sm mt-1"
                        value={question.listId ? String(question.listId) : ''}
                        onChange={(event) => replace(index, { listId: Number(event.target.value) || undefined })}
                      >
                        <option value="">Choose a list</option>
                        {simpleLists.map((list) => (
                          <option key={list.id} value={list.id}>{list.name} ({list.itemCount})</option>
                        ))}
                      </PortalSelect>
                      {simpleLists.length === 0 && (
                        <span className="card-caption mt-1 block">
                          No lists yet. <button type="button" className="font-semibold text-blue-700 hover:underline cursor-pointer" onClick={onOpenLists}>Make one in Lists</button>
                        </span>
                      )}
                    </label>
                  )}
                  {question.kind !== 'yesno' && (
                    <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 accent-brand-navy" checked={Boolean(question.required)} onChange={(event) => replace(index, { required: event.target.checked })} />
                      Students must answer
                    </label>
                  )}
                  <p className="card-caption sm:col-span-2">
                    {wording.includes(`{{${question.name}}}`) ? 'The answer is in the letter.' : 'To print the answer, add it from Insert detail in Write the letter.'}
                  </p>
                </div>
              )}
            </li>
          ))}
          <li className="flex items-center gap-3 px-4 py-3 bg-slate-50/60">
            <span className="card-value text-slate-500">Application date</span>
            <span className="card-caption">Today. Always shown.</span>
          </li>
        </ol>

        {adding ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label htmlFor="new-question-label" className="block text-[12.5px] font-semibold text-slate-700">
              {questionKindLabel(adding)}: what should the student be asked?
            </label>
            <input
              id="new-question-label"
              autoFocus
              className={`form-control form-control-sm ${labelError ? 'form-control-error' : ''}`}
              maxLength={80}
              value={newLabel}
              placeholder={adding === 'date' ? 'For example: Travel date' : adding === 'choice' ? 'For example: Which embassy?' : adding === 'yesno' ? 'For example: Travelling with family?' : 'For example: Passport expiry date'}
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
          <div ref={addButton} className="w-fit">
            <PortalButton icon={Plus} disabled={questions.length >= MAX_QUESTIONS} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              Add question
            </PortalButton>
            {menuOpen && (
              <FloatingMenu anchor={addButton} onClose={() => setMenuOpen(false)} width={320} className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {QUESTION_KINDS.map((kind) => {
                  const taken = (kind.kind === 'recipient' || kind.kind === 'extras') && has(kind.kind);
                  return (
                    <button
                      key={kind.kind}
                      type="button"
                      disabled={taken}
                      onClick={() => startAdding(kind.kind)}
                      className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      <span className="card-value text-slate-800">{kind.label}{taken ? ' (already added)' : ''}</span>
                      <span className="card-caption text-[11.5px]">{kind.description}</span>
                    </button>
                  );
                })}
              </FloatingMenu>
            )}
          </div>
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
