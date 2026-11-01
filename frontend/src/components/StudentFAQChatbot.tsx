/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, BookOpen, Bot, CalendarDays, ClipboardList, FileText, GraduationCap, MailOpen, MessageCircleQuestion, Microscope, RotateCcw, type LucideIcon } from 'lucide-react';
import type { FaqLink, FaqReply, FaqStart } from '../types';
import { ApiError } from '../services/apiClient';
import { askFaq, downloadFaqDocument, getFaqStart, openFaqAnswer, sendFaqFeedback } from '../services/faqApi';
import { PageHeader, PortalButton } from './PortalPrimitives';
import { AppointmentIcon } from './AppointmentPrimitives';
import { FloatingMenu } from './FloatingMenu';
import { AlertMessage } from './AlertMessage';
import { AssistantRow, ContactBox, FaqComposer, FaqReplyView, QuestionList, SMALL_NOTE, Thinking, YouBubble } from './FaqChatParts';

type Feedback = 'none' | 'sending' | 'yes' | 'no';

type ChatItem =
  | { kind: 'you'; id: number; text: string }
  | { kind: 'reply'; id: number; asked: string; typed: boolean; reply: FaqReply; feedback: Feedback; contact: string }
  | { kind: 'topic'; id: number; name: string; questions: FaqLink[] }
  | { kind: 'problem'; id: number; text: string; retry?: () => void };

type NewItem = ChatItem extends infer Item ? (Item extends ChatItem ? Omit<Item, 'id'> : never) : never;

const CARD = 'flex h-full w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30 cursor-pointer';
const TOPIC_ICONS: ReadonlyArray<[RegExp, LucideIcon]> = [
  [/research|thesis|dissertation/i, Microscope],
  [/graduat|complet/i, GraduationCap],
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

export const StudentFAQChatbot: React.FC = () => {
  const navigate = useNavigate();
  const [start, setStart] = useState<FaqStart | null>(null);
  const [startProblem, setStartProblem] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const nextId = useRef(1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
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

  // The newest message and the question box stay in view as the page grows.
  useEffect(() => {
    if (items.length || busy) composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items.length, busy]);

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
    void run(question, true, () => askFaq(question));
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

  const composer = <FaqComposer value={input} onChange={setInput} onSend={() => ask(input)} busy={busy} formRef={composerRef} inputRef={inputRef} />;

  const contact = start?.contactText || 'For anything about your own application, records or results, contact the PG Office.';

  return (
    <div id="student-faq-chatbot-view" className="mx-auto max-w-4xl space-y-6 text-left font-sans animate-fade-in">
      <PageHeader
        title="FAQ Chatbot"
        subtitle="Ask about postgraduate procedures. Answers come from the PG Office FAQ."
        actions={hasAsked ? <PortalButton icon={RotateCcw} onClick={startOver}>Start over</PortalButton> : undefined}
      />

      {!hasAsked ? (
        <>
          <section aria-label="Ask a question" className="app-card space-y-5 p-5 shadow-sm sm:p-7">
            <div className="flex items-start gap-3">
              <AppointmentIcon icon={Bot} tone="brand" />
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-brand-navy">Hi! What would you like to know?</h2>
                <p className="card-description mt-1">Ask in your own words. I answer from the PG Office FAQ and can't see your own records.</p>
              </div>
            </div>
            {composer}
          </section>

          {start && start.commonQuestions.length > 0 && (
            <section aria-labelledby="faq-popular" className="space-y-3">
              <h2 id="faq-popular" className="section-label">Popular questions</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {start.commonQuestions.map(question => (
                  <button key={question} type="button" className={CARD} onClick={() => ask(question)}>
                    <AppointmentIcon icon={MessageCircleQuestion} tone="info" />
                    <span className="min-w-0 flex-1 pt-2 text-[13px] font-semibold text-brand-navy [overflow-wrap:anywhere]">{question}</span>
                    <ArrowRight aria-hidden="true" className="mt-2.5 h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="faq-topics" className="space-y-3">
            <h2 id="faq-topics" className="section-label">Browse by topic</h2>
            {start ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {start.categories.map(topic => (
                  <button key={topic.id} type="button" className={CARD} onClick={() => showTopic(topic)}>
                    <AppointmentIcon icon={topicIcon(topic.name)} tone="brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-brand-navy">{topic.name}</span>
                      <span className="card-caption">{topic.questions.length} question{topic.questions.length === 1 ? '' : 's'}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : startProblem ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="card-description">The topics could not be loaded.</p>
                <PortalButton size="sm" icon={RotateCcw} onClick={loadStart}>Try again</PortalButton>
              </div>
            ) : (
              <p className="card-description">Loading topics…</p>
            )}
          </section>

          <AlertMessage type="info" title="About your own case" message={<p className="whitespace-pre-line">{contact}</p>} />
        </>
      ) : (
        <section aria-label="Chat" className="app-card overflow-hidden shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <AppointmentIcon icon={Bot} tone="brand" />
              <div className="min-w-0">
                <h2 className="section-label">FAQ Chatbot</h2>
                <p className="card-description">Answers from the PG Office FAQ</p>
              </div>
            </div>
            {start && start.categories.length > 0 && (
              <div ref={topicsButton} className="shrink-0">
                <PortalButton size="sm" icon={BookOpen} aria-haspopup="menu" aria-expanded={topicsOpen} onClick={() => setTopicsOpen(open => !open)}>
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
          </header>

          <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-5 px-5 py-6">
            {items.map(item => {
              if (item.kind === 'you') return <YouBubble key={item.id} text={item.text} />;
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
          </div>

          <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4">{composer}</div>
        </section>
      )}
    </div>
  );
};
