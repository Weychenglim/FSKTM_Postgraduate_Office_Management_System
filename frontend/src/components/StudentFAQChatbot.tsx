/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BadgeCheck, BookOpen, CalendarDays, ChevronRight, ClipboardList, FileText, GraduationCap, Info, MailOpen, Microscope, RotateCcw, Wallet, type LucideIcon } from 'lucide-react';
import type { FaqLink, FaqReply, FaqStart } from '../types';
import { ApiError } from '../services/apiClient';
import { askFaq, downloadFaqDocument, getFaqStart, openFaqAnswer, sendFaqFeedback } from '../services/faqApi';
import { PageHeader, PortalButton } from './PortalPrimitives';
import { FloatingMenu } from './FloatingMenu';
import { AssistantRow, ContactBox, FaqComposer, FaqReplyView, QuestionList, SMALL_NOTE, Thinking, YouBubble } from './FaqChatParts';

type Feedback = 'none' | 'sending' | 'yes' | 'no';

type ChatItem =
  | { kind: 'you'; id: number; text: string }
  | { kind: 'reply'; id: number; asked: string; typed: boolean; reply: FaqReply; feedback: Feedback; contact: string }
  | { kind: 'topic'; id: number; name: string; questions: FaqLink[] }
  | { kind: 'problem'; id: number; text: string; retry?: () => void };

type NewItem = ChatItem extends infer Item ? (Item extends ChatItem ? Omit<Item, 'id'> : never) : never;

const TOPIC_ICONS: ReadonlyArray<[RegExp, LucideIcon]> = [
  [/research|thesis|dissertation/i, Microscope],
  [/graduat|complet/i, GraduationCap],
  [/fee|fund/i, Wallet],
  [/exam|grade/i, BadgeCheck],
  [/admission|offer/i, MailOpen],
  [/registration|course/i, ClipboardList],
  [/semester/i, CalendarDays],
  [/application|apply/i, FileText],
];
const topicIcon = (name: string) => TOPIC_ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? BookOpen;

const problemText = (err: unknown) =>
  err instanceof ApiError && err.status === 429
    ? 'You have asked a lot of questions in a short time. Please wait a moment, then try again.'
    : 'Something went wrong while looking for an answer.';

/** Pick a topic on one side and read its questions on the other, without leaving the page. */
const TopicBrowser: React.FC<{ topics: FaqStart['categories']; disabled: boolean; onPick: (link: FaqLink) => void }> = ({ topics, disabled, onPick }) => {
  const [openId, setOpenId] = useState('');
  const open = topics.find(topic => topic.id === openId) ?? topics[0];
  if (!open) return null;
  return (
    <div className="app-card overflow-hidden md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3 md:block md:space-y-1 md:border-b-0 md:border-r md:bg-slate-50/70">
        {topics.map(topic => {
          const Icon = topicIcon(topic.name);
          const on = topic.id === open.id;
          return (
            <button
              key={topic.id}
              type="button"
              aria-pressed={on}
              onClick={() => setOpenId(topic.id)}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition cursor-pointer md:w-full ${on ? 'bg-brand-navy text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 md:border-transparent md:bg-transparent'}`}
            >
              <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${on ? 'text-white' : 'text-slate-400'}`} />
              <span className="min-w-0 flex-1">{topic.name}</span>
              <span className={`shrink-0 text-[11.5px] font-bold ${on ? 'text-slate-300' : 'text-slate-400'}`}>{topic.questions.length}</span>
            </button>
          );
        })}
      </div>
      <ul aria-label={`Questions about ${open.name}`} className="divide-y divide-slate-100">
        {open.questions.map(link => (
          <li key={link.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(link)}
              className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[13.5px] font-semibold text-brand-navy transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:opacity-50 cursor-pointer"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{link.question}</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const StudentFAQChatbot: React.FC = () => {
  const navigate = useNavigate();
  const [start, setStart] = useState<FaqStart | null>(null);
  const [startProblem, setStartProblem] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const nextId = useRef(1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const newestQuestion = useRef<HTMLDivElement>(null);
  const topicsButton = useRef<HTMLDivElement>(null);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const hasAsked = items.length > 0;

  const loadStart = useCallback(() => {
    setStartProblem(false);
    getFaqStart().then(setStart).catch(() => setStartProblem(true));
  }, []);

  useEffect(loadStart, [loadStart]);

  // The question box moves between the welcome card and the chat, so typing carries on there.
  const shown = useRef(hasAsked);
  useEffect(() => {
    if (shown.current === hasAsked) return;
    shown.current = hasAsked;
    inputRef.current?.focus({ preventScroll: true });
  }, [hasAsked]);

  // Each new question moves to the top, so its answer is read from the start.
  useEffect(() => {
    if (items.length) newestQuestion.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [items.length]);

  const add = (item: NewItem) => setItems(current => [...current, { ...item, id: nextId.current++ } as ChatItem]);

  const update = (id: number, change: Partial<Extract<ChatItem, { kind: 'reply' }>>) =>
    setItems(current => current.map(item => (item.id === id && item.kind === 'reply' ? { ...item, ...change } : item)));

  const run = async (asked: string, typed: boolean, load: () => Promise<FaqReply>) => {
    setBusy(true);
    try {
      add({ kind: 'reply', asked, typed, reply: await load(), feedback: 'none', contact: '' });
    } catch (err) {
      add({ kind: 'problem', text: problemText(err), retry: () => void run(asked, typed, load) });
    } finally {
      setBusy(false);
    }
  };

  const ask = (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    add({ kind: 'you', text: question });
    const last = [...items].reverse().find((item): item is Extract<ChatItem, { kind: 'reply' }> => item.kind === 'reply')?.reply;
    void run(question, true, () => askFaq(question, last && { questionId: last.questionId, token: last.token }));
  };

  const pick = (link: FaqLink, from?: FaqReply) => {
    if (busy) return;
    add({ kind: 'you', text: link.question });
    const asked = from?.outcome === 'CHOICES' ? { questionId: from.questionId, token: from.token } : undefined;
    void run(link.question, false, () => openFaqAnswer(link.id, asked));
  };

  const showTopic = (topic: FaqStart['categories'][number]) => {
    if (busy) return;
    add({ kind: 'you', text: topic.name });
    add({ kind: 'topic', name: topic.name, questions: topic.questions });
  };

  const startOver = () => {
    setItems([]);
    setInput('');
    setTopicsOpen(false);
  };

  const feedback = async (item: Extract<ChatItem, { kind: 'reply' }>, helpful: boolean) => {
    update(item.id, { feedback: 'sending' });
    try {
      const result = await sendFaqFeedback(item.reply.questionId, item.reply.token, helpful);
      update(item.id, { feedback: helpful ? 'yes' : 'no', contact: result.contactText });
    } catch {
      update(item.id, { feedback: helpful ? 'yes' : 'no', contact: helpful ? '' : start?.contactText ?? '' });
    }
  };

  const feedbackRow = (item: Extract<ChatItem, { kind: 'reply' }>) =>
    item.feedback === 'none' || item.feedback === 'sending' ? (
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
        <span className={SMALL_NOTE}>Did this help?</span>
        <PortalButton size="sm" disabled={item.feedback === 'sending'} onClick={() => void feedback(item, true)}>Yes</PortalButton>
        <PortalButton size="sm" disabled={item.feedback === 'sending'} onClick={() => void feedback(item, false)}>No</PortalButton>
      </div>
    ) : item.feedback === 'yes' ? (
      <p className={`${SMALL_NOTE} border-t border-slate-200 pt-3`}>Thanks for letting us know.</p>
    ) : (
      <>
        <p>Sorry about that.</p>
        <ContactBox text={item.contact || start?.contactText || ''} />
      </>
    );

  const openDocument = async (documentId: string, fileName: string) => {
    try {
      await downloadFaqDocument(documentId, fileName);
    } catch {
      add({ kind: 'problem', text: 'The document could not be opened. It may have been removed.' });
    }
  };

  const renderReply = (item: Extract<ChatItem, { kind: 'reply' }>) => (
    <FaqReplyView
      reply={item.reply}
      asked={item.asked}
      typed={item.typed}
      busy={busy}
      onPick={link => pick(link, item.reply)}
      onOpenDocument={(documentId, fileName) => void openDocument(documentId, fileName)}
      onPortalLink={route => navigate(route)}
      afterChoices={
        item.feedback === 'none' ? (
          <PortalButton size="sm" variant="ghost" onClick={() => void feedback(item, false)}>None of these</PortalButton>
        ) : item.feedback === 'no' ? (
          <>
            <p>Sorry about that.</p>
            <ContactBox text={item.contact || start?.contactText || ''} />
          </>
        ) : null
      }
      footer={item.reply.outcome === 'ANSWERED' || item.reply.outcome === 'DOCUMENT' ? feedbackRow(item) : undefined}
    />
  );

  const composer = <FaqComposer value={input} onChange={setInput} onSend={() => ask(input)} busy={busy} inputRef={inputRef} placeholder="Ask a question" />;

  const contact = start?.contactText || 'For anything about your own application, records or results, contact the PG Office.';
  const lastQuestionId = [...items].reverse().find(item => item.kind === 'you')?.id;

  if (!hasAsked) {
    return (
      <div id="student-faq-chatbot-view" className="mx-auto max-w-5xl space-y-8 text-left font-sans animate-fade-in">
        <section aria-labelledby="faq-welcome" className="relative overflow-hidden rounded-3xl bg-brand-navy px-5 py-10 text-center shadow-sm sm:px-10 sm:py-14">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.4),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.18),transparent_50%)]" />
          <div className="relative mx-auto max-w-2xl space-y-5">
            <div className="space-y-2">
              <h1 id="faq-welcome" className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">What would you like to know?</h1>
              <p className="text-[13.5px] font-medium text-slate-300">Answers come from the PG Office FAQ. I can't see your own records.</p>
            </div>
            <div className="text-left">{composer}</div>
            {start && start.commonQuestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2" aria-label="Popular questions" role="group">
                {start.commonQuestions.map(question => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => ask(question)}
                    className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="faq-topics" className="space-y-3">
          <h2 id="faq-topics" className="section-heading">Browse by topic</h2>
          {start ? (
            <TopicBrowser topics={start.categories} disabled={busy} onPick={link => pick(link)} />
          ) : startProblem ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="card-description">The topics could not be loaded.</p>
              <PortalButton size="sm" icon={RotateCcw} onClick={loadStart}>Try again</PortalButton>
            </div>
          ) : (
            <p className="card-description">Loading topics…</p>
          )}
        </section>

        <p className="flex items-start justify-center gap-2 text-[12.5px] font-medium text-slate-500">
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-pre-line"><span className="font-bold text-slate-600">About your own case: </span>{contact}</span>
        </p>
      </div>
    );
  }

  return (
    <div id="student-faq-chatbot-view" className="mx-auto max-w-3xl space-y-6 text-left font-sans animate-fade-in">
      <PageHeader
        title="FAQ Chatbot"
        actions={
          <>
            {start && start.categories.length > 0 && (
              <div ref={topicsButton}>
                <PortalButton icon={BookOpen} aria-haspopup="menu" aria-expanded={topicsOpen} onClick={() => setTopicsOpen(open => !open)}>
                  Topics
                </PortalButton>
                {topicsOpen && (
                  <FloatingMenu anchor={topicsButton} onClose={() => setTopicsOpen(false)} width={300} align="right" role="menu" className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    {start.categories.map(topic => (
                      <button
                        key={topic.id}
                        type="button"
                        role="menuitem"
                        disabled={busy}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                        onClick={() => {
                          setTopicsOpen(false);
                          showTopic(topic);
                        }}
                      >
                        <span className="min-w-0">{topic.name}</span>
                        <span className="card-caption shrink-0">{topic.questions.length}</span>
                      </button>
                    ))}
                  </FloatingMenu>
                )}
              </div>
            )}
            <PortalButton icon={RotateCcw} onClick={startOver}>Start over</PortalButton>
          </>
        }
      />

      <section role="log" aria-live="polite" aria-label="Conversation" className="space-y-5">
        {items.map(item => {
          if (item.kind === 'you') {
            return (
              <div key={item.id} ref={item.id === lastQuestionId ? newestQuestion : undefined} className="scroll-mt-24">
                <YouBubble text={item.text} />
              </div>
            );
          }
          if (item.kind === 'topic') {
            return (
              <AssistantRow key={item.id}>
                <p>Questions about {item.name}:</p>
                <QuestionList questions={item.questions} disabled={busy} onPick={link => pick(link)} />
              </AssistantRow>
            );
          }
          if (item.kind === 'problem') {
            return (
              <AssistantRow key={item.id}>
                <p role="alert">{item.text}</p>
                {item.retry && <PortalButton size="sm" icon={RotateCcw} disabled={busy} onClick={item.retry}>Try again</PortalButton>}
              </AssistantRow>
            );
          }
          return <React.Fragment key={item.id}>{renderReply(item)}</React.Fragment>;
        })}

        {busy && <Thinking />}
      </section>

      {composer}
    </div>
  );
};
