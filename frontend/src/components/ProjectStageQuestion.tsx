/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useState } from 'react';
import { BookOpenCheck, ChevronRight } from 'lucide-react';
import type { ProjectStageQuestion as Question, StudentProject } from '../services/registrySemestersApi';
import { answerMyProjectStage, requestProjectStageCorrection } from '../services/registrySemestersApi';
import { confirmText, stageCard } from '../utils/projectStages';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, PortalConfirmModal, StatusBadge } from './PortalPrimitives';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** Asks a student once a semester whether they registered their Research Project in MAYA. Hidden when there is nothing to ask. */
export const ProjectStageQuestion: React.FC<{
  question: Question | null;
  onUpdate: (project: StudentProject) => void;
}> = ({ question, onUpdate }) => {
  const titleId = useId();
  const [confirming, setConfirming] = useState<'YES' | 'NO' | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!question) return null;
  const asking = question.answer === null && question.canChange;
  const view = stageCard(question);

  const reply = async () => {
    if (!confirming) return;
    setSending(true);
    setProblem(null);
    try {
      onUpdate(await answerMyProjectStage(confirming));
    } catch (err) {
      setProblem(errorText(err, 'Your answer could not be saved. Please try again.'));
    } finally {
      setSending(false);
      setConfirming(null);
    }
  };

  const sendCorrection = async () => {
    setSending(true);
    setProblem(null);
    try {
      onUpdate(await requestProjectStageCorrection(note));
      setCorrecting(false);
      setNote('');
    } catch (err) {
      setProblem(errorText(err, 'Your request could not be sent. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      aria-label="Research Project Registration"
      className={`rounded-2xl border bg-white p-5 shadow-3xs ${view.asking ? 'border-amber-300' : 'border-[#e2e8f0]'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="card-label block">Research Project Registration</span>
          <span className="card-metric mt-3 block">{view.value}</span>
        </div>
        <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-150 bg-slate-50 text-slate-500">
          <BookOpenCheck className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className="space-y-3 pt-4">
        <StatusBadge tone={view.badgeTone} className="text-[9px]">{view.badge}</StatusBadge>
        <p className={`[overflow-wrap:anywhere] ${view.asking ? 'text-[13.5px] font-semibold leading-relaxed text-slate-800' : 'card-description'}`}>{view.detail}</p>
        {problem && !correcting && <p role="alert" className="text-[12.5px] font-semibold text-rose-700">{problem}</p>}
        {view.asking ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <PortalButton variant="primary" disabled={sending} onClick={() => setConfirming('YES')}>Yes, I have registered</PortalButton>
            <PortalButton disabled={sending} onClick={() => setConfirming('NO')}>No, not this semester</PortalButton>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="card-description">{view.note}</p>
            {question.correction === null && (
              <button
                type="button"
                onClick={() => { setProblem(null); setCorrecting(true); }}
                className="inline-flex cursor-pointer items-center gap-1 rounded text-[10px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Request a correction<ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      <PortalConfirmModal
        isOpen={confirming !== null}
        tone="info"
        title="Confirm your answer"
        message={confirming ? `${confirmText(confirming, question.code, question.name)} Once confirmed, only your programme coordinator can change it.` : ''}
        confirmLabel="Confirm"
        isLoading={sending}
        onConfirm={() => void reply()}
        onCancel={() => setConfirming(null)}
      />
      <DialogShell
        title="Request a correction"
        titleId={titleId}
        isOpen={correcting}
        busy={sending}
        onClose={() => setCorrecting(false)}
        footer={<>
          <PortalButton disabled={sending} onClick={() => setCorrecting(false)}>Cancel</PortalButton>
          <PortalButton variant="primary" isLoading={sending} onClick={() => void sendCorrection()}>Send request</PortalButton>
        </>}
      >
        <p className="text-[13.5px] text-slate-600">Your programme coordinator will check your MAYA registration and update this record if needed. You can send one request each semester.</p>
        <div className="space-y-1.5">
          <label htmlFor={`${titleId}-note`} className="block form-label mb-0">Reason (optional)</label>
          <textarea id={`${titleId}-note`} className="form-control min-h-20 px-3.5 py-3 text-[14px]" maxLength={300} value={note} disabled={sending} onChange={event => setNote(event.target.value)} />
        </div>
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
    </section>
  );
};
