/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// "Test the chatbot" (UC29): the student chat for the office, with each reply
// saying which answer it came from. Nothing is saved or counted.

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PenLine, RotateCcw } from 'lucide-react';
import type { FaqLink, FaqTryReply } from '../types';
import { downloadFaqDocument, tryFaqQuestion } from '../services/faqApi';
import { APP_ROUTES, routeForFaqEntry } from '../constants/routes';
import { PortalButton } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { AssistantRow, FaqComposer, FaqReplyView, Thinking, YouBubble } from './FaqChatParts';

type TestItem =
  | { kind: 'you'; id: number; text: string }
  | { kind: 'reply'; id: number; asked: string; typed: boolean; reply: FaqTryReply }
  | { kind: 'problem'; id: number; text: string };

type NewItem = TestItem extends infer Item ? (Item extends TestItem ? Omit<Item, 'id'> : never) : never;

const MATCH_WORDS: Record<FaqTryReply['match'], string> = { Strong: 'close match', Possible: 'possible match', None: 'no close match' };

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : 'Could not test this question.');

const SourceNote: React.FC<{ item: Extract<TestItem, { kind: 'reply' }>; onOpen: (id: string) => void; onWrite: (question: string) => void }> = ({ item, onOpen, onWrite }) => {
  const { reply } = item;
  const link = (id: string, question: string) => (
    <button key={id} type="button" onClick={() => onOpen(id)} className="font-bold text-blue-700 hover:underline text-left [overflow-wrap:anywhere] cursor-pointer">
      {question}
    </button>
  );
  const others = reply.candidates.filter(candidate => candidate.id !== reply.answer?.id).slice(0, 3);
  return (
    <div className="space-y-1.5 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-3 py-2.5 text-[12px] leading-relaxed text-slate-700">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">Only the office sees this</p>
      {reply.outcome === 'ANSWERED' && reply.answer ? (
        <p>Answered by {link(reply.answer.id, reply.answer.question)} ({MATCH_WORDS[reply.match]}).</p>
      ) : reply.outcome === 'CHOICES' ? (
        <p>No answer was close enough on its own, so the student is asked to choose.</p>
      ) : reply.outcome === 'DOCUMENT' ? (
        <p>No answer matched, so the chatbot showed a passage from a document.</p>
      ) : (
        <p>No answer matched this question.</p>
      )}
      {others.length > 0 && (
        <div>
          <p>{reply.outcome === 'ANSWERED' ? 'Also close:' : 'Closest answers:'}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {others.map(candidate => <li key={candidate.id}>{link(candidate.id, candidate.question)}</li>)}
          </ul>
        </div>
      )}
      {reply.outcome !== 'ANSWERED' && (
        <PortalButton size="sm" icon={PenLine} onClick={() => onWrite(item.asked)}>Write an answer for this question</PortalButton>
      )}
    </div>
  );
};

export const FaqTestChat: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<TestItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const nextId = useRef(1);
  const composerRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (items.length || busy) composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items.length, busy]);

  const add = (item: NewItem) => setItems(current => [...current, { ...item, id: nextId.current++ } as TestItem]);

  const run = async (question: string, typed: boolean) => {
    setBusy(true);
    try {
      add({ kind: 'reply', asked: question, typed, reply: await tryFaqQuestion(question) });
    } catch (err) {
      add({ kind: 'problem', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const ask = (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    add({ kind: 'you', text: question });
    void run(question, true);
  };

  const pick = (link: FaqLink) => {
    if (busy) return;
    add({ kind: 'you', text: link.question });
    void run(link.question, false);
  };

  const openDocument = async (documentId: string, fileName: string) => {
    try {
      await downloadFaqDocument(documentId, fileName);
    } catch {
      add({ kind: 'problem', text: 'The document could not be opened. It may have been removed.' });
    }
  };

  const openAnswer = (id: string) => navigate(routeForFaqEntry(id));
  const writeAnswer = (question: string) => navigate(APP_ROUTES.faqEntryNew, { state: { question } });

  return (
    <RecordPage
      title="Test the chatbot"
      subtitle="Ask the way a student would. Nothing is saved, and tests don't count in the figures."
      backLabel="Back to FAQ Chatbot"
      onBack={() => navigate(APP_ROUTES.faq)}
      pageKey="faq-test"
      actions={items.length ? <PortalButton icon={RotateCcw} onClick={() => { setItems([]); setInput(''); inputRef.current?.focus(); }}>Start over</PortalButton> : undefined}
    >
      <section aria-label="Test chat" className="app-card mx-auto max-w-4xl overflow-hidden shadow-sm">
        <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-5 px-5 py-6">
          <AssistantRow>
            <p>Ask a question the way a student would. You'll see exactly what the student gets, and a note under each reply says which answer it came from, so you can open it and fix it.</p>
          </AssistantRow>
          {items.map(item => {
            if (item.kind === 'you') return <YouBubble key={item.id} text={item.text} />;
            if (item.kind === 'problem') {
              return (
                <AssistantRow key={item.id}>
                  <p role="alert">{item.text}</p>
                </AssistantRow>
              );
            }
            return (
              <FaqReplyView
                key={item.id}
                reply={item.reply}
                asked={item.asked}
                typed={item.typed}
                busy={busy}
                onPick={pick}
                onOpenDocument={(documentId, fileName) => void openDocument(documentId, fileName)}
                onPortalLink={route => navigate(route)}
                footer={<SourceNote item={item} onOpen={openAnswer} onWrite={writeAnswer} />}
              />
            );
          })}
          {busy && <Thinking />}
        </div>
        <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4">
          <FaqComposer value={input} onChange={setInput} onSend={() => ask(input)} busy={busy} formRef={composerRef} inputRef={inputRef} placeholder="Type a test question" />
        </div>
      </section>
    </RecordPage>
  );
};
