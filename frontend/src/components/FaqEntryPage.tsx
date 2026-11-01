/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Bold, Link2, List, X } from 'lucide-react';
import type { FaqCategorySummary, FaqEntryDetail, FaqEntryInput, FaqPortalLink } from '../types';
import { fieldErrors } from '../services/apiClient';
import {
  createFaqEntry,
  deleteFaqEntry,
  getFaqCategories,
  getFaqEntry,
  reviewFaqQuestions,
  stepFaqEntry,
  updateFaqEntry,
} from '../services/faqApi';
import { APP_ROUTES, routeForFaqEntry } from '../constants/routes';
import { FAQ_PORTAL_LINKS } from '../utils/faqText';
import { FAQ_STATUS_CHIP, FAQ_STATUS_LABEL, faqHistoryLine } from '../utils/faqOffice';
import { historyTime } from '../utils/documentDisplay';
import { PortalButton, PortalConfirmModal, PortalToast, SegmentedControl } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';
import { OverflowMenu, type MenuAction } from './DocumentParts';
import { FloatingMenu } from './FloatingMenu';
import { FaqReplyView, YouBubble } from './FaqChatParts';

type Form = { question: string; altQuestions: string[]; answer: string; category: string; portalLink: FaqPortalLink };
const EMPTY: Form = { question: '', altQuestions: [], answer: '', category: '', portalLink: '' };
const NO_BUTTON = 'NONE';
const SAFE_LINK = /^(https?:\/\/|mailto:|\/(?!\/))/i;
const HISTORY_SHOWN = 4;
const TOOL = 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-brand-navy cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const formFrom = (entry: FaqEntryDetail): Form => ({
  question: entry.question,
  altQuestions: entry.altQuestions,
  answer: entry.answer,
  category: entry.category.id,
  portalLink: entry.portalLink,
});
const same = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);

const AltQuestions: React.FC<{ id: string; values: string[]; onChange: (values: string[]) => void }> = ({ id, values, onChange }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const text = draft.trim().replace(/\s+/g, ' ');
    if (text && !values.some(value => value.toLowerCase() === text.toLowerCase())) onChange([...values, text]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Other ways students ask it">
          {values.map(value => (
            <li key={value} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1 text-[13px] font-semibold text-indigo-900">
              {value}
              <button type="button" aria-label={`Remove "${value}"`} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/10 cursor-pointer" onClick={() => onChange(values.filter(item => item !== value))}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          className="form-control form-control-md text-[14px]"
          maxLength={500}
          value={draft}
          placeholder="For example: boleh bayar yuran ansuran?"
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              add();
            }
          }}
        />
        <PortalButton onClick={add} disabled={!draft.trim()}>Add</PortalButton>
      </div>
    </div>
  );
};

/** The answer box with buttons for bold, bullet points and links; it grows with the text. */
const AnswerEditor: React.FC<{ id: string; value: string; invalid: boolean; onChange: (value: string) => void }> = ({ id, value, invalid, onChange }) => {
  const box = useRef<HTMLTextAreaElement>(null);
  const linkButton = useRef<HTMLDivElement>(null);
  const pending = useRef<[number, number] | null>(null);
  const [linking, setLinking] = useState<{ text: string; url: string; start: number; end: number } | null>(null);
  const [linkProblem, setLinkProblem] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
    if (pending.current) {
      element.focus();
      element.setSelectionRange(...pending.current);
      pending.current = null;
    }
  }, [value]);

  const selection = () => {
    const element = box.current;
    return element ? [element.selectionStart, element.selectionEnd] : [value.length, value.length];
  };

  const replace = (start: number, end: number, text: string, select: [number, number]) => {
    pending.current = select;
    onChange(value.slice(0, start) + text + value.slice(end));
  };

  const bold = () => {
    const [start, end] = selection();
    const chosen = value.slice(start, end) || 'bold text';
    replace(start, end, `**${chosen}**`, [start + 2, start + 2 + chosen.length]);
  };

  const bullets = () => {
    const [start, end] = selection();
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const nextBreak = value.indexOf('\n', end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const listed = lines.every(line => /^\s*- /.test(line) || !line.trim());
    const changed = lines.map(line => (listed ? line.replace(/^(\s*)- /, '$1') : line.trim() ? `- ${line.replace(/^\s*/, '')}` : line)).join('\n');
    replace(lineStart, lineEnd, changed, [lineStart + changed.length, lineStart + changed.length]);
  };

  const openLink = () => {
    const [start, end] = selection();
    setLinkProblem(null);
    setLinking({ text: value.slice(start, end), url: 'https://', start, end });
  };

  const addLink = () => {
    if (!linking) return;
    const url = linking.url.trim();
    if (!SAFE_LINK.test(url) || url === 'https://') {
      setLinkProblem('Give the full web address, starting with https://');
      return;
    }
    const text = linking.text.trim() || url;
    const inserted = `[${text}](${url})`;
    setLinking(null);
    replace(linking.start, linking.end, inserted, [linking.start + inserted.length, linking.start + inserted.length]);
  };

  return (
    <div>
      <div className="flex items-center gap-1 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 px-2 py-1">
        <button type="button" className={TOOL} title="Bold" aria-label="Bold" onClick={bold}><Bold className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" className={TOOL} title="Bullet points" aria-label="Bullet points" onClick={bullets}><List className="h-4 w-4" aria-hidden="true" /></button>
        <div ref={linkButton}>
          <button type="button" className={TOOL} title="Link" aria-label="Link" aria-expanded={linking !== null} onClick={() => (linking ? setLinking(null) : openLink())}>
            <Link2 className="h-4 w-4" aria-hidden="true" />
          </button>
          {linking && (
            <FloatingMenu anchor={linkButton} onClose={() => setLinking(null)} width={320} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
              <label className="form-label block">
                Text to show
                <input className="form-control form-control-sm mt-1" value={linking.text} placeholder="For example: the fee schedule" onChange={event => setLinking({ ...linking, text: event.target.value })} />
              </label>
              <label className="form-label block">
                Web address
                <input
                  autoFocus
                  className={`form-control form-control-sm mt-1 ${linkProblem ? 'form-control-error' : ''}`}
                  value={linking.url}
                  onChange={event => {
                    setLinking({ ...linking, url: event.target.value });
                    setLinkProblem(null);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addLink();
                    }
                  }}
                />
              </label>
              {linkProblem && <p role="alert" className="text-[12px] font-semibold text-rose-700">{linkProblem}</p>}
              <div className="flex justify-end gap-2">
                <PortalButton size="sm" variant="ghost" onClick={() => setLinking(null)}>Cancel</PortalButton>
                <PortalButton size="sm" variant="primary" onClick={addLink}>Add link</PortalButton>
              </div>
            </FloatingMenu>
          )}
        </div>
      </div>
      <textarea
        id={id}
        ref={box}
        rows={6}
        className={`form-control block resize-none overflow-hidden rounded-t-none px-3.5 py-3 text-[14px] font-medium leading-relaxed${invalid ? ' form-control-error' : ''}`}
        maxLength={5000}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
};

export const FaqEntryPage: React.FC<{ entryId: string | null }> = ({ entryId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const ids = useId();
  const done = useRef(false);
  const fromQuestions: string[] = Array.isArray(location.state?.fromQuestions) ? location.state.fromQuestions : [];
  const [entry, setEntry] = useState<FaqEntryDetail | null>(null);
  const [form, setForm] = useState<Form>(() => ({ ...EMPTY, question: typeof location.state?.question === 'string' ? location.state.question : '' }));
  const [categories, setCategories] = useState<FaqCategorySummary[]>([]);
  const [loading, setLoading] = useState(Boolean(entryId));
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(
    typeof location.state?.message === 'string' ? { message: location.state.message, tone: 'success' } : null,
  );
  const [reload, setReload] = useState(0);

  useEffect(() => {
    getFaqCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    setLoading(true);
    setLoadProblem(null);
    getFaqEntry(entryId)
      .then(found => {
        if (cancelled) return;
        setEntry(found);
        setForm(formFrom(found));
      })
      .catch(err => !cancelled && setLoadProblem(errorText(err, 'Could not open this answer.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [entryId, reload]);

  const saved = useMemo(() => (entry ? formFrom(entry) : EMPTY), [entry]);
  const dirty = !done.current && (entry ? !same(form, saved) : Boolean(form.question.trim() || form.answer.trim() || form.altQuestions.length));

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setProblems(current => ({ ...current, [key]: '' }));
  };

  const changes = (): FaqEntryInput => {
    const before = entry ? formFrom(entry) : EMPTY;
    const input: FaqEntryInput = {};
    if (form.question !== before.question) input.question = form.question;
    if (form.answer !== before.answer) input.answer = form.answer;
    if (form.category !== before.category) input.category = form.category;
    if (form.portalLink !== before.portalLink) input.portalLink = form.portalLink;
    if (JSON.stringify(form.altQuestions) !== JSON.stringify(before.altQuestions)) input.altQuestions = form.altQuestions;
    return input;
  };

  const save = async (publish: boolean) => {
    if (!form.category) {
      setProblems({ category: 'Choose a topic.' });
      return;
    }
    setBusy(publish ? 'publish' : 'save');
    setProblems({});
    try {
      if (!entry) {
        const created = await createFaqEntry({ ...changes(), category: form.category, publish });
        if (fromQuestions.length) await reviewFaqQuestions({ ids: fromQuestions, action: 'create', entryId: created.id }).catch(() => undefined);
        done.current = true;
        navigate(routeForFaqEntry(created.id), { replace: true, state: { message: publish ? 'Published. Students get this answer now.' : 'Saved as a draft.' } });
        return;
      }
      let updated = Object.keys(changes()).length ? await updateFaqEntry(entry.id, changes()) : entry;
      if (publish && updated.status !== 'PUBLISHED') updated = await stepFaqEntry(entry.id, 'publish');
      setEntry(updated);
      setForm(formFrom(updated));
      setToast({ message: publish ? 'Published. Students get this answer now.' : 'Changes saved.', tone: 'success' });
    } catch (err) {
      const fields = fieldErrors(err);
      if (Object.keys(fields).length) setProblems(fields);
      else setToast({ message: errorText(err, 'Could not save the answer.'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const step = async (name: 'checked' | 'archive' | 'restore', message: string) => {
    if (!entry) return;
    setBusy(name);
    try {
      const updated = await stepFaqEntry(entry.id, name);
      setEntry(updated);
      setForm(formFrom(updated));
      setToast({ message, tone: 'success' });
    } catch (err) {
      setToast({ message: errorText(err, 'Could not change the answer.'), tone: 'danger' });
      setReload(value => value + 1);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!entry) return;
    setBusy('delete');
    try {
      await deleteFaqEntry(entry.id);
      done.current = true;
      navigate(APP_ROUTES.faq, { replace: true, state: { message: `Deleted "${entry.question || 'the answer'}".` } });
    } catch (err) {
      setConfirmDelete(false);
      setToast({ message: errorText(err, 'Could not delete the answer.'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const status = entry?.status;
  const menu: MenuAction[] = entry
    ? [
        ...(status !== 'ARCHIVED' ? [{ label: 'Archive', onSelect: () => void step('archive', 'Archived. Students no longer get it.') }] : []),
        { label: 'Delete', danger: true, onSelect: () => setConfirmDelete(true) },
      ]
    : [];
  const categoryName = categories.find(category => category.id === form.category)?.name ?? entry?.category.name ?? '';
  const subtitle = entry
    ? [FAQ_STATUS_LABEL[entry.status], entry.category.name, ...(entry.imported ? [`Imported from FAQ.pdf${entry.source?.page ? `, page ${entry.source.page}` : ''}`] : [])].join(' · ')
    : 'A new question and answer for the chatbot. It stays a draft until you publish it.';
  const categoryOptions = categories.map(category => ({ value: category.id, label: category.name }));
  const linkOptions = [
    { value: NO_BUTTON, label: 'No button' },
    ...Object.entries(FAQ_PORTAL_LINKS).map(([value, link]) => ({ value, label: link.label })),
  ];
  const history = entry ? (allHistory ? entry.history : entry.history.slice(0, HISTORY_SHOWN)) : [];

  return (
    <RecordPage
      title={entry ? entry.question || 'FAQ with no question yet' : 'Add an FAQ'}
      subtitle={subtitle}
      backLabel="Back to answers"
      onBack={() => navigate(APP_ROUTES.faq)}
      pageKey={`faq-entry:${entryId ?? 'new'}`}
      dirty={dirty}
      busy={busy !== null}
      navigationComplete={done}
      actions={entry ? <OverflowMenu label="More answer actions" actions={menu} /> : undefined}
    >
      {loading ? (
        <LoadingState message="Opening the answer..." />
      ) : loadProblem ? (
        <ErrorState message={loadProblem} onRetry={() => setReload(value => value + 1)} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="min-w-0 space-y-5">
            {status === 'NEEDS_CHECKING' && entry?.source && (
              <section aria-label="Text in the PDF" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-[14px] font-extrabold text-amber-900">Check this answer before students see it</p>
                {entry.source.note && <p className="text-[13px] text-amber-900">{entry.source.note}. Write the correct question and answer, then publish.</p>}
                <p className="text-[12px] font-bold uppercase tracking-wider text-amber-800">Text in the PDF</p>
                <p className="whitespace-pre-line rounded-xl bg-white/70 p-3 text-[13px] text-slate-800 [overflow-wrap:anywhere]">{entry.source.text}</p>
              </section>
            )}
            {status === 'ARCHIVED' && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-300 bg-slate-100 px-5 py-4">
                <p className="text-[14px] font-semibold text-slate-800">Archived. Students don't get this answer.</p>
                <PortalButton variant="primary" isLoading={busy === 'restore'} onClick={() => void step('restore', 'Restored as a draft.')}>Restore</PortalButton>
              </div>
            )}

            <section aria-label="Question and answer" className="app-card space-y-6 p-5 shadow-sm sm:p-6">
              <div className="space-y-1.5">
                <label htmlFor={`${ids}-question`} className="form-label block">Question</label>
                <input
                  id={`${ids}-question`}
                  className={`form-control form-control-md text-[15px]${problems.question ? ' form-control-error' : ''}`}
                  maxLength={500}
                  value={form.question}
                  placeholder="For example: Can I pay the fees in instalments?"
                  onChange={event => set('question', event.target.value)}
                />
                {problems.question && <p role="alert" className="text-[12px] font-semibold text-rose-700">{problems.question}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={`${ids}-answer`} className="form-label block">Answer</label>
                  <SegmentedControl<'write' | 'preview'> options={['write', 'preview']} value={mode} onChange={setMode} labels={{ write: 'Write', preview: 'Preview as student' }} />
                </div>
                {mode === 'write' ? (
                  <AnswerEditor id={`${ids}-answer`} value={form.answer} invalid={Boolean(problems.answer)} onChange={value => set('answer', value)} />
                ) : (
                  <div aria-label="How students see it" className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <YouBubble text={form.question.trim() || 'The question'} />
                    {form.answer.trim() ? (
                      <FaqReplyView
                        reply={{
                          outcome: 'ANSWERED',
                          answer: { id: entry?.id ?? 'new', question: form.question, answer: form.answer, category: categoryName || 'Topic', portalLink: form.portalLink },
                          choices: [],
                          related: [],
                          passage: null,
                          contactText: '',
                          mode: 'hybrid',
                        }}
                        asked={form.question}
                        typed={false}
                        busy={false}
                        onPick={() => undefined}
                        onOpenDocument={() => undefined}
                        onPortalLink={() => undefined}
                      />
                    ) : (
                      <p className="card-description">Nothing written yet. Switch to Write to add the answer.</p>
                    )}
                  </div>
                )}
                {problems.answer && <p role="alert" className="text-[12px] font-semibold text-rose-700">{problems.answer}</p>}
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-5">
                <label htmlFor={`${ids}-alt`} className="form-label block">Other ways students ask it (optional)</label>
                <p className="card-description">The chatbot also matches these. Add short forms, common wordings or Malay.</p>
                <AltQuestions id={`${ids}-alt`} values={form.altQuestions} onChange={values => set('altQuestions', values)} />
                {problems.altQuestions && <p role="alert" className="text-[12px] font-semibold text-rose-700">{problems.altQuestions}</p>}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section aria-label="Publishing" className="app-card space-y-4 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-label">Status</h2>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${FAQ_STATUS_CHIP[status ?? 'DRAFT']}`}>{entry ? FAQ_STATUS_LABEL[entry.status] : 'New'}</span>
              </div>
              <p className="card-description">
                {!entry
                  ? 'Students get it once you publish it. Save a draft to finish it later.'
                  : entry.status === 'PUBLISHED'
                    ? `Students got this answer ${entry.askedThisMonth} time${entry.askedThisMonth === 1 ? '' : 's'} this month${entry.notHelpfulThisMonth ? `, and ${entry.notHelpfulThisMonth} said it didn't help` : ''}.`
                    : "Students don't get this answer until it is published."}
              </p>
              <div className="space-y-1.5">
                <label htmlFor={`${ids}-category`} className="form-label block">Topic</label>
                <SelectMenu id={`${ids}-category`} value={form.category} placeholder="Choose a topic" options={categoryOptions} onChange={value => set('category', value)} />
                {problems.category && <p role="alert" className="text-[12px] font-semibold text-rose-700">{problems.category}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${ids}-link`} className="form-label block">Button under the answer</label>
                <SelectMenu
                  id={`${ids}-link`}
                  value={form.portalLink || NO_BUTTON}
                  options={linkOptions}
                  onChange={value => set('portalLink', (value === NO_BUTTON ? '' : value) as FaqPortalLink)}
                />
                <p className="card-caption">Optional. Opens a page in the portal, such as Letter Generation.</p>
              </div>
              {status !== 'ARCHIVED' && (
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
                  {status === 'PUBLISHED' ? (
                    <PortalButton fullWidth variant="primary" isLoading={busy === 'save'} disabled={busy !== null || !dirty} onClick={() => void save(false)}>Save changes</PortalButton>
                  ) : (
                    <>
                      <PortalButton fullWidth variant="primary" isLoading={busy === 'publish'} disabled={busy !== null} onClick={() => void save(true)}>
                        {status === 'NEEDS_CHECKING' ? 'Mark as checked and publish' : 'Publish'}
                      </PortalButton>
                      <PortalButton fullWidth isLoading={busy === 'save'} disabled={busy !== null || (Boolean(entry) && !dirty)} onClick={() => void save(false)}>
                        {status === 'NEEDS_CHECKING' ? 'Save changes' : 'Save draft'}
                      </PortalButton>
                      {status === 'NEEDS_CHECKING' && (
                        <PortalButton fullWidth variant="ghost" isLoading={busy === 'checked'} disabled={busy !== null || dirty} onClick={() => void step('checked', 'Marked as checked. It is a draft until you publish it.')}>Mark as checked only</PortalButton>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>

            {entry && history.length > 0 && (
              <section aria-label="History" className="app-card space-y-1 p-5 shadow-sm">
                <h2 className="section-label">History</h2>
                {entry.checkedBy && <p className="card-description">Checked by {entry.checkedBy}{entry.checkedAt ? `, ${historyTime(entry.checkedAt)}` : ''}.</p>}
                <ol className="divide-y divide-slate-100">
                  {history.map(change => (
                    <li key={change.id} className="space-y-0.5 py-2.5 text-[12.5px]">
                      <p className="font-semibold text-slate-800">{faqHistoryLine(change)}</p>
                      <p className="text-slate-500">{change.actor || 'Import'}, {historyTime(change.at)}</p>
                    </li>
                  ))}
                </ol>
                {entry.history.length > HISTORY_SHOWN && (
                  <button type="button" className="back-link py-2" onClick={() => setAllHistory(value => !value)}>
                    {allHistory ? 'Show less' : `Show all ${entry.history.length} changes`}
                  </button>
                )}
              </section>
            )}
          </aside>
        </div>
      )}
      <PortalConfirmModal
        isOpen={confirmDelete}
        title="Delete this answer?"
        message="Students will no longer get this answer. It can't be undone; archiving keeps it instead. The history keeps a line with the question."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        tone="danger"
        isLoading={busy === 'delete'}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </RecordPage>
  );
};
