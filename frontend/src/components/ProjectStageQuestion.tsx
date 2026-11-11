/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import type { ProjectStageQuestion as Question } from '../services/registrySemestersApi';
import { answerMyProjectStage, getMyProjectStage } from '../services/registrySemestersApi';
import { answerText, questionText } from '../utils/projectStages';
import { PortalButton } from './PortalPrimitives';

/** Asks a student once a semester whether they registered their Research Project in Maya. Hidden when there is nothing to ask. */
export const ProjectStageQuestion: React.FC = () => {
  const [question, setQuestion] = useState<Question | null>(null);
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState<'YES' | 'NO' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyProjectStage()
      .then(found => { if (!cancelled) setQuestion(found); })
      .catch(() => { if (!cancelled) setQuestion(null); });
    return () => { cancelled = true; };
  }, []);

  if (!question) return null;
  const asking = question.answer === null || editing;

  const reply = async (answer: 'YES' | 'NO') => {
    setSending(answer);
    setProblem(null);
    try {
      setQuestion(await answerMyProjectStage(answer));
      setEditing(false);
    } catch (err) {
      setProblem(err instanceof Error && err.message ? err.message : 'Could not save your answer.');
    } finally {
      setSending(null);
    }
  };

  return (
    <section aria-label="Research Project" className="app-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      <div className="min-w-0 flex-[1_1_18rem]">
        <p className="card-label">Research Project</p>
        <p className="mt-1 text-[14.5px] font-bold text-slate-900 [overflow-wrap:anywhere]">
          {asking ? questionText(question.code, question.name) : answerText(question.answer ?? 'NO', question.code)}
        </p>
        {!asking && !question.canChange && <p className="mt-1 text-[12.5px] font-medium text-slate-500">Ask your programme coordinator to change this.</p>}
        {problem && <p role="alert" className="mt-1 text-[12.5px] font-semibold text-rose-700">{problem}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {asking ? (
          <>
            <PortalButton variant="primary" isLoading={sending === 'YES'} disabled={sending !== null} onClick={() => void reply('YES')}>Yes</PortalButton>
            <PortalButton isLoading={sending === 'NO'} disabled={sending !== null} onClick={() => void reply('NO')}>Not this semester</PortalButton>
            {editing && <PortalButton variant="ghost" disabled={sending !== null} onClick={() => setEditing(false)}>Cancel</PortalButton>}
          </>
        ) : question.canChange && (
          <PortalButton size="sm" onClick={() => setEditing(true)}>Change</PortalButton>
        )}
      </div>
    </section>
  );
};
