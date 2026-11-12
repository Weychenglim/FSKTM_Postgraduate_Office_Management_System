/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import type { ProjectStageQuestion as Question } from '../services/registrySemestersApi';
import { answerMyProjectStage, getMyProjectStage, requestProjectStageCorrection } from '../services/registrySemestersApi';
import { answerText, confirmText, correctionLine, questionText } from '../utils/projectStages';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, PortalConfirmModal } from './PortalPrimitives';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** Asks a student once a semester whether they registered their Research Project in MAYA. Hidden when there is nothing to ask. */
export const ProjectStageQuestion: React.FC = () => {
  const titleId = useId();
  const [question, setQuestion] = useState<Question | null>(null);
  const [confirming, setConfirming] = useState<'YES' | 'NO' | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyProjectStage()
      .then(found => { if (!cancelled) setQuestion(found); })
      .catch(() => { if (!cancelled) setQuestion(null); });
    return () => { cancelled = true; };
  }, []);

  if (!question) return null;
  const asking = question.answer === null && question.canChange;

  const reply = async () => {
    if (!confirming) return;
    setSending(true);
    setProblem(null);
    try {
      setQuestion(await answerMyProjectStage(confirming));
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
      setQuestion(await requestProjectStageCorrection(note));
      setCorrecting(false);
      setNote('');
    } catch (err) {
      setProblem(errorText(err, 'Your request could not be sent. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-label="Research Project Registration" className="app-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      <div className="min-w-0 flex-[1_1_18rem]">
        <p className="card-label">Research Project Registration</p>
        <p className="mt-1 text-[14.5px] font-bold text-slate-900 [overflow-wrap:anywhere]">
          {asking ? questionText(question.code, question.name, question.semester) : answerText(question.answer ?? 'NO', question.code, question.name)}
        </p>
        {!asking && <p className="mt-1 text-[12.5px] font-medium text-slate-500">{correctionLine(question.correction)}</p>}
        {problem && !correcting && <p role="alert" className="mt-1 text-[12.5px] font-semibold text-rose-700">{problem}</p>}
      </div>
      {asking ? (
        <div className="flex flex-wrap gap-2">
          <PortalButton variant="primary" disabled={sending} onClick={() => setConfirming('YES')}>Yes, I have registered</PortalButton>
          <PortalButton disabled={sending} onClick={() => setConfirming('NO')}>No, not this semester</PortalButton>
        </div>
      ) : question.correction === null && (
        <PortalButton size="sm" onClick={() => { setProblem(null); setCorrecting(true); }}>Request a correction</PortalButton>
      )}
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
        <p className="text-[13.5px] text-slate-600">Your programme coordinator will check your MAYA registration and update your answer if needed. You can send one request each semester.</p>
        <div className="space-y-1.5">
          <label htmlFor={`${titleId}-note`} className="block text-[13px] font-bold text-slate-700">Reason (optional)</label>
          <textarea id={`${titleId}-note`} className="form-control min-h-20 px-3.5 py-3 text-[14px]" maxLength={300} value={note} disabled={sending} onChange={event => setNote(event.target.value)} />
        </div>
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
    </section>
  );
};
