/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The "Write the letter" step of a letter type: the English and Malay wording,
// with the details it fills in shown as [Student Name] rather than as tags, and
// the printed letter previewed beside it as it is typed.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bold, ChevronDown, Italic, List, ListChecks, Pencil, Plus, Trash2, Underline } from 'lucide-react';
import { PortalButton, SegmentedControl } from './PortalPrimitives';
import { AlertMessage } from './AlertMessage';
import { AppointmentSection } from './AppointmentPrimitives';
import { LetterPages } from './LetterPages';
import { FloatingMenu } from './FloatingMenu';
import type { LetterCustomField, LetterPlaceholder } from '../types';
import {
  APPOINTMENT_PLACEHOLDERS,
  fieldNameFromLabel,
  fillLetterTags,
  findPlaceholderProblems,
  formatLetterDate,
  letterClosing,
  placeholderPurposeHint,
  placeholdersFor,
  renderLetterBodyHtml,
} from '../utils/letterDocument';
import {
  DEFAULT_REFERENCE_PREFIX,
  describePlaceholderProblems,
  fromFriendly,
  isCustomQuestion,
  questionNames,
  tagLabels,
  toFriendly,
  type EditorValues,
  type TagLabel,
} from '../utils/letterEditor';
import { getLetterSampleValues } from '../services';

const REQUEST_TAGS = new Set(APPOINTMENT_PLACEHOLDERS.filter((p) => p.purposes.includes('REQUEST')).map((p) => p.tag));
const MAX_BLANKS = 20;
const BRACKETED_RE = /\[([^[\]\n]+)\]/g;

/** What is wrong with each page's wording, in words the office can act on. Both pages are checked. */
export function wordingProblems(draft: EditorValues): { content?: string; contentMs?: string } {
  const editorContent = draft.content;
  const editorContentMs = draft.contentMs;
  const editorPurpose = draft.purpose;
  const editorFields = draft.customFields;
  const request = editorPurpose === 'REQUEST';
  const recipientQuestion = request && draft.questions.some((question) => question.kind === 'recipient');
  const names = [...editorFields.map((f) => f.name), ...questionNames(draft.questions)];
  const both = `${editorContent}\n${editorContentMs}`;
  const english = [
    describePlaceholderProblems(findPlaceholderProblems(editorContent, names, editorPurpose)),
    request && both.includes('{{RECIPIENT}}') && !recipientQuestion ? 'This letter shows who it is for. Add "Who is the letter for?" in the Student form step.' : '',
    recipientQuestion && !editorContent.includes('{{RECIPIENT}}') ? 'Students say who this letter is for, but the letter does not show it. Add Recipient from Insert detail.' : '',
    request && both.includes('{{VALID_UNTIL}}') && !draft.validMonths.trim() ? 'This letter shows a valid-until date. Say how many months it stays valid in the Signature and status step.' : '',
  ].filter(Boolean).join(' ');
  const malay = [
    describePlaceholderProblems(findPlaceholderProblems(editorContentMs, names, editorPurpose)),
    recipientQuestion && editorContentMs.trim() && !editorContentMs.includes('{{RECIPIENT}}') ? 'The Malay page does not show who the letter is for. Add Recipient to it too.' : '',
  ].filter(Boolean).join(' ');
  return { content: english || undefined, contentMs: malay || undefined };
}

interface LetterWordingEditorProps {
  values: EditorValues;
  onChange: (changes: Partial<EditorValues>) => void;
  placeholders: LetterPlaceholder[] | null;
  /** Problems found when saving or continuing, shown until the wording changes. */
  problems: { content?: string; contentMs?: string; customFields?: string };
  onEdited: (field: 'content' | 'contentMs' | 'customFields') => void;
  onMessage: (message: string) => void;
}

export const LetterWordingEditor: React.FC<LetterWordingEditorProps> = ({ values, onChange, placeholders, problems, onEdited, onMessage }) => {
  const [language, setLanguage] = useState<'en' | 'ms'>('en');
  const [insertOpen, setInsertOpen] = useState(false);
  const [blankLabel, setBlankLabel] = useState('');
  const [blankError, setBlankError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameLabel, setRenameLabel] = useState('');
  const [sampleMatric, setSampleMatric] = useState('');
  const [sample, setSample] = useState<{ studentName: string; matricNumber: string; values: Record<string, string> } | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursor = useRef<number | null>(null);
  const insertMenuRef = useRef<HTMLDivElement>(null);

  const purpose = values.purpose;
  const request = purpose === 'REQUEST';
  const fields = values.customFields;
  const studentQuestions = request ? values.questions.filter(isCustomQuestion) : [];
  const recipientQuestion = request && values.questions.some((question) => question.kind === 'recipient');

  // The tags this kind of letter may use, from the server's registry (the local copy covers loading).
  const placeholderTags = (placeholders?.filter((p) => !p.purposes || p.purposes.includes(purpose)) ?? placeholdersFor(purpose).map((p) => ({ ...p, source: '' }))).map((p) => ({
    label: p.label,
    tag: p.tag,
    source: p.source,
    group: REQUEST_TAGS.has(p.tag) ? 'request' : placeholderPurposeHint(p.tag) ? 'appointment' : 'record',
  }));
  const offeredTags = placeholderTags.filter(
    (p) => (p.tag !== '{{RECIPIENT}}' || recipientQuestion) && (p.tag !== '{{VALID_UNTIL}}' || values.validMonths.trim() !== ''),
  );
  const labelEntries: TagLabel[] = [
    ...placeholderTags.map((p) => ({ tag: p.tag, label: p.label, kind: 'record' as const })),
    ...studentQuestions.map((q) => ({ tag: `{{${q.name}}}`, label: q.label || q.name || '', kind: 'student' as const })),
    ...fields.map((f) => ({ tag: `{{${f.name}}}`, label: f.label || f.name, kind: 'office' as const })),
  ];
  const labels = tagLabels(labelEntries);

  const stored = language === 'ms' ? values.contentMs : values.content;
  const shown = toFriendly(stored, labels);
  const store = (text: string, using = labels) => {
    const next = fromFriendly(text, using);
    onChange(language === 'ms' ? { contentMs: next } : { content: next });
    onEdited(language === 'ms' ? 'contentMs' : 'content');
  };

  // The text box grows with the letter, so the page never gets a second scrollbar.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    let width = 0;
    const fit = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    fit();
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === width) return;
      width = entry.contentRect.width;
      fit();
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [shown]);

  // After a change the text box did not make itself, put the caret back where it belongs.
  useEffect(() => {
    if (pendingCursor.current === null) return;
    const cursor = pendingCursor.current;
    pendingCursor.current = null;
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(cursor, cursor);
  }, [values.content, values.contentMs]);

  const type = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const typed = event.target.value;
    const settled = toFriendly(fromFriendly(typed, labels), labels);
    if (settled !== typed) pendingCursor.current = event.target.selectionStart + settled.length - typed.length;
    store(typed);
  };

  const insertTag = (tag: string, using = labels) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? shown.length;
    const end = textarea?.selectionEnd ?? shown.length;
    const before = shown.slice(0, start);
    const after = shown.slice(end);
    // Pad with a single space only where the detail would otherwise touch a word.
    const lead = before.length && !/[\s(]$/.test(before) ? ' ' : '';
    const trail = after.length && !/^[\s).,;:]/.test(after) ? ' ' : '';
    const insertion = `${lead}[${using.toLabel.get(tag) ?? tag}]${trail}`;
    setInsertOpen(false);
    store(before + insertion + after, using);
    pendingCursor.current = before.length + insertion.length;
  };

  const wrapSelection = (marker: string, label: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? shown.length;
    const end = textarea?.selectionEnd ?? shown.length;
    const selected = shown.slice(start, end) || label;
    const before = shown.slice(0, start);
    store(`${before}${marker}${selected}${marker}${shown.slice(end)}`);
    pendingCursor.current = before.length + marker.length + selected.length;
  };

  const toggleBulletList = () => {
    const textarea = textareaRef.current;
    const selStart = textarea?.selectionStart ?? 0;
    const selEnd = textarea?.selectionEnd ?? 0;
    const lineStart = shown.lastIndexOf('\n', selStart - 1) + 1;
    let lineEnd = shown.indexOf('\n', selEnd);
    if (lineEnd === -1) lineEnd = shown.length;
    const before = shown.slice(0, lineStart);
    const block = shown.slice(lineStart, lineEnd);
    const allBulleted = block.split('\n').every((l) => l.trim() === '' || /^\s*-\s+/.test(l));
    const newBlock = block.split('\n').map((l) => (l.trim() === '' ? l : allBulleted ? l.replace(/^\s*-\s+/, '') : `- ${l}`)).join('\n');
    store(before + newBlock + shown.slice(lineEnd));
    pendingCursor.current = (before + newBlock).length;
  };

  // The office names a blank it fills in; the tag behind it is made for them.
  const addBlank = () => {
    const label = blankLabel.trim();
    if (!label) {
      setBlankError('Type what the office should fill in, for example Attendance (%).');
      return;
    }
    const existing = fields.find((f) => f.label.trim().toLowerCase() === label.toLowerCase());
    if (existing) {
      insertTag(`{{${existing.name}}}`);
      setBlankLabel('');
      return;
    }
    if (fields.length >= MAX_BLANKS) {
      setBlankError(`A letter can have at most ${MAX_BLANKS} blanks for the office.`);
      return;
    }
    const officeTags = [...fields.map((f) => f.name), ...questionNames(values.questions)];
    const name = fieldNameFromLabel(label, officeTags);
    onChange({ customFields: [...fields, { name, label, hint: '' }] });
    onEdited('customFields');
    setBlankLabel('');
    setBlankError(null);
    insertTag(`{{${name}}}`, tagLabels([...labelEntries, { tag: `{{${name}}}`, label, kind: 'office' }]));
  };

  const renameBlank = (name: string) => {
    const label = renameLabel.trim();
    if (!label) return;
    onChange({ customFields: fields.map((f) => (f.name === name ? { ...f, label } : f)) });
    setRenaming(null);
  };

  const deleteBlank = (field: LetterCustomField) => {
    const tag = `{{${field.name}}}`;
    const strip = (text: string) => text.split(tag).join('').replace(/[ \t]{2,}/g, ' ').replace(/ ([.,;:)])/g, '$1');
    onChange({ content: strip(values.content), contentMs: strip(values.contentMs), customFields: fields.filter((f) => f.name !== field.name) });
    onEdited('customFields');
    onMessage(`Deleted "${field.label || field.name}" and took it out of the letter.`);
  };

  const loadSample = async () => {
    const matric = sampleMatric.trim();
    if (!matric) {
      setSampleError('Type a matric number.');
      return;
    }
    setSampleLoading(true);
    setSampleError(null);
    try {
      setSample(await getLetterSampleValues(matric));
    } catch (err) {
      setSample(null);
      setSampleError(err instanceof Error ? err.message : 'Could not find that student.');
    } finally {
      setSampleLoading(false);
    }
  };

  const live = wordingProblems(values);
  const englishIssue = problems.content ?? live.content;
  const malayIssue = problems.contentMs ?? live.contentMs;
  const asTyped = Array.from(new Set(Array.from(shown.matchAll(BRACKETED_RE), (match) => match[0]))).filter((text) => !labels.toTag.has(text.slice(1, -1)));
  const officeTags = [...fields.map((f) => f.name), ...questionNames(values.questions)];
  const previewHtml = (text: string) =>
    renderLetterBodyHtml(sample ? fillLetterTags(text, sample.values) : text, { highlightPlaceholders: true, officeFields: officeTags, tagLabels: labels.toLabel });
  const closing = letterClosing({
    purpose,
    signatoryName: values.signatoryName,
    signatoryTitle: values.signatoryTitle,
    signatoryNameMs: values.signatoryNameMs,
    signatoryTitleMs: values.signatoryTitleMs,
  });
  const reference = `${(values.referencePrefix.trim() || DEFAULT_REFERENCE_PREFIX).replace(/\/+$/, '')}/${new Date().getFullYear()}/####`;
  const inLetter = (name: string) => `${values.content}\n${values.contentMs}`.includes(`{{${name}}}`);

  const toolButton = 'p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer';
  const insertGroups = [
    { title: 'From the student record', tags: offeredTags.filter((p) => p.group === 'record').map((p) => ({ tag: p.tag, hint: p.source })) },
    { title: 'From the request', tags: offeredTags.filter((p) => p.group === 'request').map((p) => ({ tag: p.tag, hint: p.source })) },
    { title: 'From the appointment', tags: offeredTags.filter((p) => p.group === 'appointment').map((p) => ({ tag: p.tag, hint: p.source })) },
    { title: 'Student answers', tags: studentQuestions.map((q) => ({ tag: `{{${q.name}}}`, hint: 'The student answers it on the form' })) },
    { title: 'Office fills in', tags: fields.map((f) => ({ tag: `{{${f.name}}}`, hint: 'The office types it in when approving' })) },
  ].filter((group) => group.tags.length > 0 || group.title === 'Office fills in');

  return (
    <div className="space-y-6">
      <section aria-label="Letter wording" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 xl:grid-cols-2">
          <div className="min-w-0 border-b border-slate-200 xl:border-b-0 xl:border-r">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div className="min-w-0">
                <h3 className="section-label">Wording</h3>
                <p className="card-description mt-1">The letterhead, reference number, date and signature are added for you.</p>
              </div>
              <SegmentedControl<'en' | 'ms'>
                options={['en', 'ms'] as const}
                value={language}
                onChange={setLanguage}
                labels={{ en: 'English', ms: values.contentMs.trim() ? 'Malay' : 'Malay (optional)' }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 border-y border-slate-100 bg-slate-50/60 px-4 py-2">
              <button type="button" onClick={() => wrapSelection('**', 'bold')} className={toolButton} title="Bold" aria-label="Bold"><Bold className="w-4 h-4" /></button>
              <button type="button" onClick={() => wrapSelection('*', 'italic')} className={toolButton} title="Italic" aria-label="Italic"><Italic className="w-4 h-4" /></button>
              <button type="button" onClick={() => wrapSelection('__', 'underline')} className={toolButton} title="Underline" aria-label="Underline"><Underline className="w-4 h-4" /></button>
              <button type="button" onClick={toggleBulletList} className={toolButton} title="Bullet list" aria-label="Bullet list"><List className="w-4 h-4" /></button>
              <span aria-hidden="true" className="mx-2 h-5 w-px bg-slate-200" />
              <div ref={insertMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={insertOpen}
                  onClick={() => setInsertOpen(!insertOpen)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 cursor-pointer"
                >
                  <Plus aria-hidden="true" className="w-3.5 h-3.5" />
                  Insert detail
                  <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-slate-400" />
                </button>
                {insertOpen && (
                  <FloatingMenu anchor={insertMenuRef} onClose={() => setInsertOpen(false)} width={320} className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <p className="px-2 pb-2 card-caption">Goes in where the cursor is, and is filled in for each letter.</p>
                    {insertGroups.map((group) => (
                      <div key={group.title} className="py-1">
                        <p className="px-2 pb-1 card-label">{group.title}</p>
                        {group.tags.map((item) => (
                          <button
                            key={item.tag}
                            type="button"
                            onClick={() => insertTag(item.tag)}
                            title={item.hint || undefined}
                            className="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            {labels.toLabel.get(item.tag) ?? item.tag}
                          </button>
                        ))}
                        {group.title === 'Office fills in' && (
                          <div className="mt-1 space-y-2 px-2 pb-1">
                            <label htmlFor="office-detail-label" className="block text-[12px] font-semibold text-slate-600">New blank the office fills in when approving</label>
                            <div className="flex gap-2">
                              <input
                                id="office-detail-label"
                                type="text"
                                value={blankLabel}
                                maxLength={80}
                                onChange={(event) => { setBlankLabel(event.target.value); setBlankError(null); }}
                                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addBlank(); } }}
                                placeholder="For example: Attendance (%)"
                                className="form-control form-control-sm"
                              />
                              <PortalButton size="sm" variant="primary" onClick={addBlank}>Add</PortalButton>
                            </div>
                            {blankError && <p role="alert" className="text-[12px] text-rose-800">{blankError}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                    {request && studentQuestions.length === 0 && (
                      <p className="px-2 py-1 card-caption">To ask the student something, add a question in the Student form step.</p>
                    )}
                  </FloatingMenu>
                )}
              </div>
            </div>
            {language === 'ms' && !values.contentMs.trim() && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-blue-50/60 px-5 py-3">
                <p className="text-[12.5px] font-medium text-blue-900">The Malay letter is printed as a second page. Leave it empty for an English-only letter.</p>
                {values.content.trim() && <PortalButton size="sm" onClick={() => { onChange({ contentMs: values.content }); onEdited('contentMs'); }}>Start from the English text</PortalButton>}
              </div>
            )}
            <textarea
              ref={textareaRef}
              rows={20}
              value={shown}
              onChange={type}
              aria-label={language === 'ms' ? 'Malay letter content' : 'Letter content'}
              aria-invalid={(language === 'ms' ? malayIssue : englishIssue) ? true : undefined}
              className="block w-full resize-none overflow-hidden border-0 bg-white px-6 py-5 text-[14px] leading-7 text-slate-800 placeholder:text-slate-400 focus:outline-none"
              placeholder={language === 'ms' ? 'Tulis surat dalam Bahasa Melayu. Insert detail works here too.' : "Write the letter. Use Insert detail for the student's name, matric number and other details."}
            />
            <div className="space-y-3 border-t border-slate-100 px-5 py-4">
              {(englishIssue || malayIssue) && (
                <AlertMessage type="warning" title="Check the letter" message={[englishIssue, malayIssue && `Malay page: ${malayIssue}`].filter(Boolean).join(' ')} />
              )}
              {asTyped.length > 0 && (
                <p className="card-caption text-amber-800">
                  {asTyped.slice(0, 3).join(', ')} {asTyped.length === 1 ? 'is not a detail, so it prints' : 'are not details, so they print'} as typed. To fill in a detail, use Insert detail.
                </p>
              )}
              <p className="card-caption">
                Details in [square brackets] are filled in for each letter. A line such as | Name | [Student Name] | prints as a row of a details table.
              </p>
            </div>
          </div>

          <div className="min-w-0 rounded-b-2xl bg-slate-100/70 xl:rounded-bl-none xl:rounded-r-2xl">
            <div className="space-y-3 px-5 pt-5 pb-3">
              <div>
                <h3 className="section-label">Preview</h3>
                <p className="card-description mt-1">Changes as you type. Details still to be filled in are highlighted.</p>
              </div>
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadSample();
                }}
              >
                <label htmlFor="letter-sample-matric" className="sr-only">Preview with a student</label>
                <input
                  id="letter-sample-matric"
                  type="search"
                  className="form-control form-control-sm min-w-0 flex-1"
                  value={sampleMatric}
                  placeholder="Matric number, for example 23004955"
                  onChange={(event) => { setSampleMatric(event.target.value); setSampleError(null); }}
                />
                <PortalButton size="sm" type="submit" isLoading={sampleLoading}>Show</PortalButton>
                {sample && <PortalButton size="sm" variant="ghost" onClick={() => { setSample(null); setSampleMatric(''); }}>Clear</PortalButton>}
                <p className={`basis-full card-caption ${sampleError ? 'text-rose-700' : ''}`}>
                  {sampleError ?? (sample ? `Showing ${sample.studentName}'s details (${sample.matricNumber}). Answers and office blanks still show as blanks.` : 'Preview with a student: fills in the details from a real student record.')}
                </p>
              </form>
            </div>
            <div className="px-4 pb-5 sm:px-5">
              {values.content.trim() ? (
                <LetterPages
                  reference={reference}
                  referenceText={reference}
                  date={formatLetterDate()}
                  bodyHtml={previewHtml(values.content)}
                  malayBodyHtml={values.contentMs.trim() ? previewHtml(values.contentMs) : undefined}
                  closing={closing}
                />
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center card-description">Nothing written yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {(fields.length > 0 || problems.customFields) && (
        <AppointmentSection
          title="Blanks the office fills in"
          description="The office types these in when approving each letter, for details the portal does not hold. Add one from Insert detail."
          icon={ListChecks}
        >
          {problems.customFields && <p role="alert" className="text-sm font-medium text-rose-800">{problems.customFields}</p>}
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {fields.map((field) =>
              renaming === field.name ? (
                <li key={field.name} className="space-y-2 bg-slate-50 p-3">
                  <label htmlFor={`rename-${field.name}`} className="block text-[12.5px] font-semibold text-slate-700">Rename</label>
                  <input
                    id={`rename-${field.name}`}
                    autoFocus
                    type="text"
                    value={renameLabel}
                    maxLength={80}
                    onChange={(event) => setRenameLabel(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); renameBlank(field.name); } }}
                    className="form-control form-control-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <PortalButton size="sm" variant="ghost" onClick={() => setRenaming(null)}>Cancel</PortalButton>
                    <PortalButton size="sm" variant="primary" disabled={!renameLabel.trim()} onClick={() => renameBlank(field.name)}>Save</PortalButton>
                  </div>
                </li>
              ) : (
                <li key={field.name} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="card-value text-slate-800 truncate">{field.label || field.name}</p>
                    <p className="card-caption">{inLetter(field.name) ? 'In the letter' : 'Not in the letter yet'}</p>
                  </div>
                  <PortalButton size="icon" variant="ghost" icon={Pencil} aria-label={`Rename ${field.label || field.name}`} onClick={() => { setRenaming(field.name); setRenameLabel(field.label || field.name); }} />
                  <PortalButton size="icon" variant="ghost" icon={Trash2} aria-label={`Delete ${field.label || field.name}`} onClick={() => deleteBlank(field)} />
                </li>
              ),
            )}
          </ul>
        </AppointmentSection>
      )}
    </div>
  );
};
