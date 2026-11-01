/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The pieces of the FAQ chatbot's conversation, shared by the student chatbot,
// the office's "How students see it" preview and the office's test page.

import React, { useLayoutEffect, useRef } from 'react';
import { ArrowRight, Bot, ChevronRight, FileText, Send } from 'lucide-react';
import type { FaqLink, FaqReply } from '../types';
import { FAQ_PORTAL_LINKS, askedDifferently } from '../utils/faqText';
import { passageSource } from '../utils/faqOffice';
import { PortalButton } from './PortalPrimitives';
import { AppointmentIcon } from './AppointmentPrimitives';
import { AlertMessage } from './AlertMessage';
import { FaqText } from './FaqText';

export const PASSED_ON = 'Your question has been passed to the office, without your name, so they can add an answer.';
export const OPTION = 'flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-[13px] font-semibold text-brand-navy transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';
export const SMALL_NOTE = 'text-[12px] font-medium text-slate-500';

export type ChatReply = Omit<FaqReply, 'questionId' | 'token'>;

export const AssistantRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-3">
    <AppointmentIcon icon={Bot} tone="brand" />
    <div className="min-w-0 max-w-2xl flex-1 space-y-3 rounded-2xl rounded-tl-md border border-slate-200 bg-slate-50 px-4 py-3.5 text-[13px] leading-relaxed text-slate-700">
      <span className="sr-only">FAQ Chatbot:</span>
      {children}
    </div>
  </div>
);

export const YouBubble: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex justify-end">
    <div className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-tr-md bg-brand-navy px-4 py-3 text-[13px] font-medium leading-relaxed text-white [overflow-wrap:anywhere]">
      <span className="sr-only">You: </span>
      {text}
    </div>
  </div>
);

export const QuestionList: React.FC<{ questions: FaqLink[]; disabled: boolean; onPick: (link: FaqLink) => void }> = ({ questions, disabled, onPick }) => (
  <div className="space-y-2">
    {questions.map(link => (
      <button key={link.id} type="button" disabled={disabled} className={OPTION} onClick={() => onPick(link)}>
        <span className="min-w-0 [overflow-wrap:anywhere]">{link.question}</span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    ))}
  </div>
);

export const ContactBox: React.FC<{ text: string; passedOn?: boolean }> = ({ text, passedOn = true }) => (
  <AlertMessage
    type="info"
    title="Please contact the PG Office"
    message={
      <>
        <p className="whitespace-pre-line">{text}</p>
        {passedOn && <p className="mt-2 text-[12px] opacity-80">{PASSED_ON}</p>}
      </>
    }
  />
);

export const Thinking: React.FC = () => (
  <div className="flex items-center gap-3">
    <AppointmentIcon icon={Bot} tone="brand" />
    <p role="status" className={`${SMALL_NOTE} flex items-center gap-2`}>
      <span aria-hidden="true" className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
      </span>
      Looking for an answer…
    </p>
  </div>
);

interface FaqReplyViewProps {
  reply: ChatReply;
  asked: string;
  typed: boolean;
  busy: boolean;
  onPick: (link: FaqLink) => void;
  onOpenDocument: (documentId: string, fileName: string) => void;
  onPortalLink: (route: string) => void;
  /** Shown under the choices, e.g. "None of these". */
  afterChoices?: React.ReactNode;
  /** Shown at the end of every reply, e.g. "Did this help?". */
  footer?: React.ReactNode;
}

/** One chatbot reply, as the student sees it. */
export const FaqReplyView: React.FC<FaqReplyViewProps> = ({ reply, asked, typed, busy, onPick, onOpenDocument, onPortalLink, afterChoices, footer }) => {
  if (reply.outcome === 'DOCUMENT' && reply.passage) {
    const passage = reply.passage;
    return (
      <AssistantRow>
        <p className="card-label">{passageSource(passage)}</p>
        <blockquote className="whitespace-pre-line border-l-4 border-slate-300 pl-4 text-slate-700 [overflow-wrap:anywhere]">{passage.text}</blockquote>
        <p className={SMALL_NOTE}>This is a passage from a document the PG Office uploaded, not a reviewed FAQ answer.</p>
        <PortalButton size="sm" icon={FileText} onClick={() => onOpenDocument(passage.documentId, passage.fileName)}>
          Open document
        </PortalButton>
        {footer}
      </AssistantRow>
    );
  }
  if (reply.outcome === 'NO_MATCH' || !reply.answer) {
    return (
      <AssistantRow>
        <p>I couldn't find this in the FAQ.</p>
        <ContactBox text={reply.contactText} />
        {footer}
      </AssistantRow>
    );
  }
  if (reply.outcome === 'CHOICES') {
    return (
      <AssistantRow>
        <p>I found a few questions that might match. Which one did you mean?</p>
        <QuestionList questions={reply.choices} disabled={busy} onPick={onPick} />
        {afterChoices}
        {footer}
      </AssistantRow>
    );
  }
  const answer = reply.answer;
  const button = answer.portalLink ? FAQ_PORTAL_LINKS[answer.portalLink] : null;
  return (
    <AssistantRow>
      {typed && askedDifferently(asked, answer.question) && <p className="card-label">Matched: {answer.question}</p>}
      <FaqText text={answer.answer} className="text-[13px] font-medium text-slate-800" />
      {button && (
        <PortalButton size="sm" variant="primary" icon={ArrowRight} iconPosition="right" onClick={() => onPortalLink(button.route)}>
          {button.label}
        </PortalButton>
      )}
      <p className="card-caption">From the PG Office FAQ · {answer.category}</p>
      {reply.related.length > 0 && (
        <div className="space-y-2">
          <p className="card-label">Related questions</p>
          <QuestionList questions={reply.related} disabled={busy} onPick={onPick} />
        </div>
      )}
      {footer}
    </AssistantRow>
  );
};

interface FaqComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  formRef?: React.Ref<HTMLFormElement>;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
}

/** The question box and Send button; the box grows as the question gets longer. */
export const FaqComposer: React.FC<FaqComposerProps> = ({ value, onChange, onSend, busy, formRef, inputRef, placeholder = 'Type your question' }) => {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const box = inputRef ?? ownRef;

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value, box]);

  return (
    <form
      ref={formRef}
      className="space-y-2"
      onSubmit={event => {
        event.preventDefault();
        onSend();
      }}
    >
      <label htmlFor="faq-question" className="sr-only">Your question</label>
      <div className="flex items-end gap-2">
        <textarea
          id="faq-question"
          ref={box}
          rows={1}
          maxLength={300}
          placeholder={placeholder}
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => {
            // Enter while an IME is composing picks a candidate; it must not send.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSend();
            }
          }}
          className="form-control form-control-md flex-1 resize-none overflow-hidden text-[13px] font-medium leading-relaxed"
        />
        <PortalButton type="submit" variant="primary" icon={Send} disabled={!value.trim() || busy}>
          Send
        </PortalButton>
      </div>
      <p className="card-caption">Press Enter to send, or Shift and Enter for a new line.</p>
    </form>
  );
};
