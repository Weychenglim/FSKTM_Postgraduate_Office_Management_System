/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AlertTriangle, BarChart3, BookOpen, CheckCircle2, Download, FileText, FlaskConical, MessageCircleQuestion, Plus, Search, Settings2 } from 'lucide-react';
import type {
  FaqCategorySummary,
  FaqChatbotSettings,
  FaqEntryList,
  FaqEntrySummary,
  FaqQuestionGroup,
  FaqQuestionStats,
  FaqSearchStatus,
  FaqStatus,
  FaqTryCandidate,
} from '../types';
import {
  downloadFaqReviewList,
  getFaqCategories,
  getFaqEntries,
  getFaqQuestionStats,
  getFaqQuestions,
  getFaqSearchStatus,
  getFaqSettings,
  reviewFaqQuestions,
  saveFaqSettings,
  tryFaqQuestion,
} from '../services/faqApi';
import { APP_ROUTES, routeForFaqEntry } from '../constants/routes';
import { entryHint, groupLine, percent } from '../utils/faqOffice';
import { historyTime, shortDocumentDate } from '../utils/documentDisplay';
import { PageHeader, PortalButton, PortalToast, SegmentedControl } from './PortalPrimitives';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { useListState } from './ListState';
import { OfficeToolViews } from './OfficeToolPrimitives';
import { AppointmentSection } from './AppointmentPrimitives';
import { WorkspaceFilterCard, WorkspacePagination, WorkspaceSectionHeader } from './RequestWorkspacePrimitives';
import { SummaryCardButton } from './SummaryCardButton';
import { ContactBox } from './FaqChatParts';
import { FaqEntryPage } from './FaqEntryPage';
import { FaqDocumentsTab } from './FaqDocumentsTab';
import { FaqTestChat } from './FaqTestChat';

type Tab = 'entries' | 'questions' | 'documents' | 'settings';
const TAB_ROUTES: Record<Tab, string> = {
  entries: APP_ROUTES.faq,
  questions: APP_ROUTES.faqQuestions,
  documents: APP_ROUTES.faqDocuments,
  settings: APP_ROUTES.faqSettings,
};
const VIEWS: readonly FaqStatus[] = ['PUBLISHED', 'NEEDS_CHECKING', 'DRAFT', 'ARCHIVED'];
const VIEW_LABEL: Record<FaqStatus, string> = { PUBLISHED: 'Live', NEEDS_CHECKING: 'To check', DRAFT: 'Drafts', ARCHIVED: 'Archived' };
const VIEW_HEADING: Record<FaqStatus, { title: string; description: string; empty: string }> = {
  PUBLISHED: { title: 'Live answers', description: 'What students get now. Open one to change it.', empty: 'No live answers yet.' },
  NEEDS_CHECKING: {
    title: 'Imported answers to check',
    description: "Imported from the office's FAQ.pdf. Students can't see them until they are checked and published.",
    empty: 'Nothing left to check.',
  },
  DRAFT: { title: 'Drafts', description: 'Not shown to students until they are published.', empty: 'No drafts.' },
  ARCHIVED: { title: 'Archived', description: "Kept for the record. Students can't see them.", empty: 'Nothing archived.' },
};
const PAGE_SIZE = 25;

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const AnswersTab: React.FC<{ view: FaqStatus; onView: (view: FaqStatus) => void; counts: Record<FaqStatus, number> | null }> = ({ view, onView, counts }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useListState('FaqEntries', 'search', '');
  const [category, setCategory] = useListState('FaqEntries', 'category', '');
  const [page, setPage] = useListState('FaqEntries', 'page', 1);
  const [data, setData] = useState<FaqEntryList | null>(null);
  const [categories, setCategories] = useState<FaqCategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(
    typeof location.state?.message === 'string' ? { message: location.state.message, tone: 'success' } : null,
  );
  const latest = useRef(0);

  useEffect(() => {
    getFaqCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const load = useCallback(() => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    getFaqEntries({ search, category, status: view, page, pageSize: PAGE_SIZE })
      .then(result => id === latest.current && setData(result))
      .catch(err => id === latest.current && setError(errorText(err, 'Could not load the answers.')))
      .finally(() => id === latest.current && setLoading(false));
  }, [search, category, view, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const rows = data?.results ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;
  const filtered = Boolean(search.trim() || category);
  const heading = VIEW_HEADING[view];
  const categoryOptions: SelectMenuOption<string>[] = [{ value: '', label: 'All topics' }, ...categories.map(item => ({ value: item.id, label: item.name }))];

  const download = async () => {
    try {
      await downloadFaqReviewList();
    } catch (err) {
      setToast({ message: errorText(err, 'Could not download the review list.'), tone: 'danger' });
    }
  };

  const open = (entry: FaqEntrySummary) => navigate(routeForFaqEntry(entry.id));
  const usage = (entry: FaqEntrySummary) =>
    entry.status !== 'PUBLISHED'
      ? 'Not live'
      : entry.notHelpfulThisMonth > 0
        ? `${entry.askedThisMonth} · ${entry.notHelpfulThisMonth} didn't help`
        : String(entry.askedThisMonth);

  return (
    <section aria-label="Answers" className="app-card appointment-workspace-card">
      <SegmentedControl<FaqStatus>
        className="w-fit flex-wrap"
        options={VIEWS}
        value={view}
        onChange={value => {
          onView(value);
          setPage(1);
        }}
        labels={Object.fromEntries(VIEWS.map(value => [value, counts ? `${VIEW_LABEL[value]} ${counts[value]}` : VIEW_LABEL[value]]))}
      />
      <WorkspaceSectionHeader
        title={heading.title}
        description={heading.description}
        actions={view === 'NEEDS_CHECKING' && rows.length > 0 ? <PortalButton size="sm" icon={Download} onClick={() => void download()}>Download the review list</PortalButton> : undefined}
      />
      <WorkspaceFilterCard
        fieldsClassName="grid grid-cols-1 items-end gap-3 sm:grid-cols-3"
        onReset={() => {
          setSearch('');
          setCategory('');
          setPage(1);
        }}
      >
        <label className="form-label sm:col-span-2">
          Find an answer
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Search className="h-3.5 w-3.5" aria-hidden="true" /></span>
            <input
              type="search"
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Question, answer or another way of asking"
              className="form-control form-control-sm pl-9"
            />
          </span>
        </label>
        <div className="form-label">
          Topic
          <div className="mt-1">
            <SelectMenu<string>
              size="sm"
              aria-label="Topic"
              value={category}
              options={categoryOptions}
              onChange={value => {
                setCategory(value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </WorkspaceFilterCard>

      {loading && !data ? (
        <LoadingState message="Loading answers..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title={filtered ? 'No answers match.' : heading.empty} description={filtered ? 'Change the search or the topic above.' : 'Use Add FAQ to write a new question and answer.'} />
      ) : (
        <>
          <table aria-label={heading.title} className="data-table block table-fixed lg:table">
            <colgroup className="hidden lg:table-column-group">
              {[44, 20, 12, 13, 11].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
            </colgroup>
            <thead className="hidden lg:table-header-group">
              <tr className="data-thead bg-slate-50">
                {['Question', 'Topic', 'Asked this month', 'Updated', 'Action'].map(column => <th key={column} scope="col" className="data-th">{column}</th>)}
              </tr>
            </thead>
            <tbody className="block space-y-3 lg:table-row-group lg:space-y-0">
              {rows.map(entry => (
                <tr key={entry.id} className="data-row grid grid-cols-2 rounded-xl border border-slate-200 py-2 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:py-0">
                  <td className="data-td-strong col-span-2 block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <button type="button" onClick={() => open(entry)} className="block text-left text-[13px] font-bold text-brand-navy hover:underline [overflow-wrap:anywhere] cursor-pointer">
                      {entry.question || '(No question yet)'}
                    </button>
                    {entryHint(entry) ? (
                      <span className="mt-0.5 block text-[12px] font-normal text-slate-500">{entryHint(entry)}</span>
                    ) : entry.altCount > 0 ? (
                      <span className="mt-0.5 block text-[12px] font-normal text-slate-500">Also matches {entry.altCount} other wording{entry.altCount === 1 ? '' : 's'}</span>
                    ) : null}
                  </td>
                  <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle lg:col-span-1 lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Topic</span>
                    <span className="text-[13px]">{entry.category.name}</span>
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Asked this month</span>
                    <span className={`text-[13px] tabular-nums ${entry.status === 'PUBLISHED' ? 'font-bold text-brand-navy' : 'text-slate-400'}`}>{usage(entry)}</span>
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Updated</span>
                    <span className="whitespace-nowrap text-[13px] text-slate-600">{entry.imported && entry.status === 'NEEDS_CHECKING' ? 'Imported' : shortDocumentDate(entry.updatedAt)}</span>
                  </td>
                  <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <PortalButton size="sm" variant={entry.status === 'NEEDS_CHECKING' ? 'primary' : 'secondary'} className="whitespace-nowrap" aria-label={`${entry.status === 'NEEDS_CHECKING' ? 'Check' : 'Edit'} ${entry.question}`} onClick={() => open(entry)}>
                      {entry.status === 'NEEDS_CHECKING' ? 'Check' : 'Edit'}
                    </PortalButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <WorkspacePagination page={Math.min(page, pageCount)} pageCount={pageCount} total={data?.count ?? 0} noun="answers" onPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </section>
  );
};

const AddToAnswer: React.FC<{ group: FaqQuestionGroup; onDone: (message: string) => void; onCancel: () => void }> = ({ group, onDone, onCancel }) => {
  const name = useId();
  const [candidates, setCandidates] = useState<FaqTryCandidate[] | null>(null);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<{ id: string; question: string }[]>([]);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    tryFaqQuestion(group.text)
      .then(reply => {
        setCandidates(reply.candidates);
        setChosen(group.lastEntry?.id ?? reply.candidates[0]?.id ?? '');
      })
      .catch(() => setCandidates([]));
  }, [group]);

  useEffect(() => {
    if (!search.trim()) return setFound([]);
    const timer = setTimeout(() => {
      getFaqEntries({ search, category: '', status: '', page: 1 })
        .then(result => setFound(result.results.slice(0, 6).map(entry => ({ id: entry.id, question: entry.question }))))
        .catch(() => setFound([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const options = [...(group.lastEntry ? [group.lastEntry] : []), ...(candidates ?? []), ...found].filter(
    (option, index, all) => option.question && all.findIndex(other => other.id === option.id) === index,
  );

  const add = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await reviewFaqQuestions({ ids: group.ids, action: 'add', entryId: chosen, text: group.text });
      onDone(`Added "${group.text}" to the answer. The chatbot now matches it.`);
    } catch (err) {
      setProblem(errorText(err, 'Could not add it.'));
      setBusy(false);
    }
  };

  return (
    <fieldset className="space-y-3 rounded-xl bg-slate-50 p-4">
      <legend className="sr-only">Which answer covers it?</legend>
      <p className="text-[13px] font-bold text-slate-800">Which answer covers it?</p>
      <p className="card-description">The question is added to that answer as another way students ask it.</p>
      {candidates === null ? (
        <p className="text-[13px] text-slate-500">Finding the closest answers...</p>
      ) : (
        <div className="space-y-1">
          {options.map(option => (
            <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg py-1.5 text-[13px] text-slate-800">
              <input type="radio" name={name} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0c1424]" checked={chosen === option.id} onChange={() => setChosen(option.id)} />
              {option.question}
            </label>
          ))}
        </div>
      )}
      <input type="search" className="form-control form-control-sm" placeholder="Search for another answer" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search for another answer" />
      {problem && <p role="alert" className="text-[12px] font-semibold text-rose-700">{problem}</p>}
      <span className="flex flex-wrap gap-2">
        <PortalButton size="sm" variant="primary" isLoading={busy} disabled={!chosen} onClick={() => void add()}>Add to this answer</PortalButton>
        <PortalButton size="sm" variant="ghost" onClick={onCancel}>Cancel</PortalButton>
      </span>
    </fieldset>
  );
};

const QuestionsTab: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<FaqQuestionGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);

  const load = useCallback(() => {
    setError(null);
    getFaqQuestions()
      .then(result => setGroups(result.groups))
      .catch(err => setError(errorText(err, 'Could not load the questions.')));
  }, []);

  useEffect(load, [load]);

  const settled = (message: string) => {
    setAdding(null);
    setToast({ message, tone: 'success' });
    load();
    onChanged();
  };

  const dismiss = async (group: FaqQuestionGroup) => {
    setBusy(group.key);
    try {
      await reviewFaqQuestions({ ids: group.ids, action: 'dismiss' });
      settled('Dismissed. It no longer shows here.');
    } catch (err) {
      setToast({ message: errorText(err, 'Could not dismiss it.'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Student questions" className="app-card appointment-workspace-card">
      <WorkspaceSectionHeader
        title="Questions the chatbot couldn't answer"
        description="Questions with no answer, or where a student said the answer didn't help. Similar questions are grouped, and no names are kept."
      />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !groups ? (
        <LoadingState message="Loading student questions..." />
      ) : groups.length === 0 ? (
        <EmptyState title="Nothing to look at right now." description="New questions the chatbot can't answer will appear here." />
      ) : (
        <ul className="space-y-3">
          {groups.map(group => (
            <li key={group.key} className="space-y-3 rounded-2xl border border-slate-200 p-5">
              <div className="space-y-1">
                <p className="text-[15px] font-bold text-brand-navy [overflow-wrap:anywhere]">"{group.text}"</p>
                <p className="text-[12px] text-slate-500">
                  {groupLine(group, historyTime(group.lastAsked))}
                  {group.notHelpful > 0 && <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">Didn't help</span>}
                </p>
              </div>
              {adding === group.key ? (
                <AddToAnswer group={group} onDone={settled} onCancel={() => setAdding(null)} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <PortalButton size="sm" variant="primary" onClick={() => navigate(APP_ROUTES.faqEntryNew, { state: { question: group.text, fromQuestions: group.ids } })}>Write an answer</PortalButton>
                  <PortalButton size="sm" onClick={() => setAdding(group.key)}>Add to an existing answer</PortalButton>
                  <PortalButton size="sm" variant="ghost" isLoading={busy === group.key} onClick={() => void dismiss(group)}>Dismiss</PortalButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </section>
  );
};

const NO_QUESTION = '';

const SettingsTab: React.FC = () => {
  const ids = useId();
  const contactBox = useRef<HTMLTextAreaElement>(null);
  const [settings, setSettings] = useState<FaqChatbotSettings | null>(null);
  const [live, setLive] = useState<string[]>([]);
  const [contact, setContact] = useState('');
  const [common, setCommon] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);

  const fill = (found: FaqChatbotSettings) => {
    setSettings(found);
    setContact(found.contactText);
    setCommon([0, 1, 2, 3].map(index => found.commonQuestions[index] ?? ''));
  };

  const load = useCallback(() => {
    setError(null);
    getFaqSettings().then(fill).catch(err => setError(errorText(err, 'Could not load the settings.')));
    getFaqEntries({ search: '', category: '', status: 'PUBLISHED', page: 1, pageSize: 100 })
      .then(result => setLive(result.results.map(entry => entry.question).filter(Boolean)))
      .catch(() => setLive([]));
  }, []);

  useEffect(load, [load]);

  useLayoutEffect(() => {
    const element = contactBox.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [contact, settings]);

  const save = async () => {
    setBusy(true);
    try {
      fill(await saveFaqSettings({ contactText: contact, commonQuestions: common }));
      setToast({ message: 'Settings saved. Students see them now.', tone: 'success' });
    } catch (err) {
      setToast({ message: errorText(err, 'Could not save the settings.'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return <LoadingState message="Loading settings..." />;

  const questionOptions = (current: string): SelectMenuOption<string>[] => [
    { value: NO_QUESTION, label: 'None' },
    ...(current && !live.includes(current) ? [{ value: current, label: current, description: 'Not a live answer, so students do not see it. Choose another.' }] : []),
    ...live.filter(question => question === current || !common.includes(question)).map(question => ({ value: question, label: question })),
  ];

  return (
    <div className="space-y-6">
      <AppointmentSection
        title="When the chatbot can't help"
        description="Shown when there is no answer, or a student says an answer didn't help. Give the email, the counter and its opening hours."
        icon={MessageCircleQuestion}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${ids}-contact`} className="form-label block">Contact text</label>
            <textarea
              id={`${ids}-contact`}
              ref={contactBox}
              rows={4}
              className="form-control resize-none overflow-hidden px-3.5 py-3 text-[14px] font-medium"
              maxLength={1000}
              value={contact}
              onChange={event => setContact(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <p className="form-label">How students see it</p>
            <ContactBox text={contact || '…'} />
          </div>
        </div>
      </AppointmentSection>

      <AppointmentSection
        title="Popular questions on the start screen"
        description="Up to four, picked from the live answers. Leave them empty to show the first question of each topic."
        icon={BookOpen}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {common.map((value, index) => (
            <div key={index} className="space-y-1.5">
              <span id={`${ids}-common-${index}`} className="form-label block">Question {index + 1}</span>
              <SelectMenu<string>
                aria-labelledby={`${ids}-common-${index}`}
                value={value}
                placeholder="None"
                searchPlaceholder="Search the live answers"
                options={questionOptions(value)}
                onChange={chosen => setCommon(current => current.map((item, at) => (at === index ? chosen : item)))}
              />
            </div>
          ))}
        </div>
      </AppointmentSection>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px] text-slate-500">{settings.updatedBy ? `Last changed by ${settings.updatedBy}, ${historyTime(settings.updatedAt)}` : ''}</span>
        <PortalButton variant="primary" isLoading={busy} disabled={!contact.trim()} onClick={() => void save()}>Save settings</PortalButton>
      </div>
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </div>
  );
};

/** FAQ Chatbot for the office (UC29): the answers, what students asked, documents and settings. */
export const AcademicFAQEditor: React.FC<{ view?: Tab | 'entry' | 'new' | 'test'; entryId?: string }> = ({ view = 'entries', entryId }) => {
  const navigate = useNavigate();
  const [answerView, setAnswerView] = useListState<FaqStatus>('FaqEntries', 'view', 'PUBLISHED');
  const [counts, setCounts] = useState<Record<FaqStatus, number> | null>(null);
  const [stats, setStats] = useState<FaqQuestionStats | null>(null);
  const [searchStatus, setSearchStatus] = useState<FaqSearchStatus | null>(null);

  const refresh = useCallback(() => {
    getFaqEntries({ search: '', category: '', status: '', page: 1, pageSize: 1 }).then(result => setCounts(result.statusCounts)).catch(() => undefined);
    getFaqQuestionStats().then(result => setStats(result.stats)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (view !== 'entry' && view !== 'new' && view !== 'test') refresh();
  }, [view, refresh]);

  useEffect(() => {
    getFaqSearchStatus().then(setSearchStatus).catch(() => setSearchStatus(null));
  }, []);

  if (view === 'entry' || view === 'new') return <FaqEntryPage key={entryId ?? 'new'} entryId={view === 'new' ? null : entryId ?? null} />;
  if (view === 'test') return <FaqTestChat />;

  const showAnswers = (next: FaqStatus) => {
    setAnswerView(next);
    if (view !== 'entries') navigate(APP_ROUTES.faq);
  };
  const waiting = stats?.waiting ?? 0;

  return (
    <div id="faq-knowledge-base" className="space-y-6">
      <PageHeader
        title="FAQ Chatbot"
        subtitle="The answers the chatbot gives students, and the questions it could not answer."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PortalButton icon={FlaskConical} onClick={() => navigate(APP_ROUTES.faqTest)}>Test the chatbot</PortalButton>
            <PortalButton variant="primary" icon={Plus} onClick={() => navigate(APP_ROUTES.faqEntryNew)}>Add FAQ</PortalButton>
          </div>
        }
      />

      {searchStatus?.mode === 'keywords' && (
        <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-[13px] font-semibold text-amber-900">
          The meaning search isn't available on the server, so the chatbot is matching keywords only. Answers still work, but paraphrases and Malay questions match less well.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCardButton
          title="Live answers"
          value={counts?.PUBLISHED ?? '-'}
          caption="answers"
          description="Shown to students now."
          icon={CheckCircle2}
          tone="success"
          selected={view === 'entries' && answerView === 'PUBLISHED'}
          onClick={() => showAnswers('PUBLISHED')}
        />
        <SummaryCardButton
          title="To check"
          value={counts?.NEEDS_CHECKING ?? '-'}
          caption="imported"
          description="Not shown to students until checked."
          icon={AlertTriangle}
          tone="warning"
          selected={view === 'entries' && answerView === 'NEEDS_CHECKING'}
          onClick={() => showAnswers('NEEDS_CHECKING')}
        />
        <SummaryCardButton
          title="Student questions"
          value={stats ? waiting : '-'}
          caption="waiting"
          description="Questions the chatbot couldn't answer."
          icon={MessageCircleQuestion}
          tone="info"
          selected={view === 'questions'}
          onClick={() => navigate(APP_ROUTES.faqQuestions)}
        />
        <SummaryCardButton
          title="Answered this month"
          value={stats ? percent(stats.answeredPercent) : '-'}
          description={stats ? `${stats.thisMonth} question${stats.thisMonth === 1 ? '' : 's'} asked · ${percent(stats.helpfulPercent)} marked helpful` : 'Loading...'}
          icon={BarChart3}
          tone="neutral"
        />
      </div>

      <OfficeToolViews<Tab>
        label="FAQ Chatbot views"
        appearance="workspace"
        value={view}
        onChange={tab => tab !== view && navigate(TAB_ROUTES[tab])}
        options={[
          { value: 'entries', label: 'Answers', icon: BookOpen },
          { value: 'questions', label: waiting ? `Student questions (${waiting})` : 'Student questions', icon: MessageCircleQuestion },
          { value: 'documents', label: 'Documents', icon: FileText },
          { value: 'settings', label: 'Settings', icon: Settings2 },
        ]}
      />

      {view === 'entries' && <AnswersTab view={answerView} onView={setAnswerView} counts={counts} />}
      {view === 'questions' && <QuestionsTab onChanged={refresh} />}
      {view === 'documents' && <FaqDocumentsTab />}
      {view === 'settings' && <SettingsTab />}
    </div>
  );
};
