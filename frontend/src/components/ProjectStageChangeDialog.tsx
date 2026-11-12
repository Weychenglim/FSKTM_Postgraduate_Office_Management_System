/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import type { MarksImpact, StageChangeResult, StageRow } from '../services/registrySemestersApi';
import { changeProjectStages, getProjectStageImpact, keepProjectStageAnswers } from '../services/registrySemestersApi';
import { marksLine, stageChoices, touchesMarks } from '../utils/projectStages';
import type { DialogChoice } from '../utils/projectStages';
import { studentCount } from '../utils/registrySemesters';
import { DialogShell } from './DocumentDialogs';
import { PortalButton } from './PortalPrimitives';
import { SelectMenu } from './SelectMenu';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const ProjectStageChangeDialog: React.FC<{
  semesterId: number;
  rows: StageRow[];
  reasons: Array<{ value: string; label: string }>;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (result: StageChangeResult, kept: boolean) => void;
  onBusy?: (busy: boolean) => void;
}> = ({ semesterId, rows, reasons, isOpen, onClose, onSaved, onBusy }) => {
  const titleId = useId();
  const [choice, setChoice] = useState<DialogChoice | null>(null);
  const [reason, setReason] = useState('');
  const [impact, setImpact] = useState<MarksImpact | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const single = rows.length === 1 ? rows[0] : null;

  useEffect(() => {
    if (!isOpen) return;
    setChoice(null);
    setReason('');
    setProblem(null);
  }, [isOpen]);

  useEffect(() => {
    setImpact(null);
    setChecked(false);
    if (!isOpen || !single || !choice || choice === 'KEEP') return undefined;
    let cancelled = false;
    getProjectStageImpact(semesterId, single.matric, choice)
      .then(found => { if (!cancelled) setImpact(found); })
      .catch(err => { if (!cancelled) setProblem(errorText(err, 'Could not check Marks.')); });
    return () => { cancelled = true; };
  }, [isOpen, single, choice, semesterId]);

  const working = (on: boolean) => {
    setBusy(on);
    onBusy?.(on);
  };

  const save = async () => {
    if (!choice) return;
    working(true);
    setProblem(null);
    try {
      const result = choice === 'KEEP'
        ? await keepProjectStageAnswers(semesterId, rows.map(row => row.matric))
        : await changeProjectStages({
          semesterId,
          stage: choice,
          reason,
          students: rows.map(row => ({ matric: row.matric, shown: row.shown })),
          checked,
          token: impact?.token ?? '',
        });
      onSaved(result, choice === 'KEEP');
    } catch (err) {
      setProblem(errorText(err, 'Could not save this.'));
    } finally {
      working(false);
    }
  };

  const choices = stageChoices(rows);
  const keeping = choice === 'KEEP';
  const needsCheck = Boolean(single) && !keeping && touchesMarks(impact);
  const waitingForImpact = Boolean(single && choice && !keeping && !impact && !problem);
  const canSave = Boolean(choice && (keeping || reason) && !waitingForImpact && (!needsCheck || checked));

  return (
    <DialogShell
      title={single ? `Change ${single.name}'s RP registration` : `Change ${studentCount(rows.length)}`}
      titleId={titleId}
      isOpen={isOpen}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton disabled={busy} onClick={onClose}>Cancel</PortalButton>
        <PortalButton variant="primary" isLoading={busy} disabled={!canSave} onClick={() => void save()}>Save</PortalButton>
      </>}
    >
      <div role="group" aria-label="New stage" className="flex flex-wrap gap-2">
        {choices.map(option => (
          <button key={option.value} type="button" aria-pressed={choice === option.value} disabled={busy} onClick={() => { setProblem(null); setChoice(option.value); }} className={`rounded-lg border px-3.5 py-2 text-[13px] font-bold transition cursor-pointer ${choice === option.value ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
            {option.label}
          </button>
        ))}
      </div>
      {!keeping && (
        <div className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
          <span id={`${titleId}-reason`}>Reason</span>
          <SelectMenu aria-labelledby={`${titleId}-reason`} value={reason} placeholder="Choose a reason" options={reasons} disabled={busy} onChange={setReason} />
        </div>
      )}
      {impact && needsCheck && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900">
          <p>{marksLine(impact)}</p>
          <label className="flex items-center gap-2 font-bold">
            <input type="checkbox" className="h-4 w-4" checked={checked} onChange={event => setChecked(event.target.checked)} />
            I've checked this
          </label>
        </div>
      )}
      {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
    </DialogShell>
  );
};
