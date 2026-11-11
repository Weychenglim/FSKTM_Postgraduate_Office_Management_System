/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import { Plus } from 'lucide-react';
import type { LaterProgrammeRule, ProgrammeRule } from '../services/registrySemestersApi';
import { getProgrammeRules, removeProgrammeRule, saveProgrammeRule } from '../services/registrySemestersApi';
import { historyTime } from '../utils/documentDisplay';
import { semesterChoices, semesterCount, semesterParts, shortSemester, studentCount, validCourseCode } from '../utils/registrySemesters';
import { DialogShell } from './DocumentDialogs';
import { PageHeader, PortalButton, PortalConfirmModal, PortalToast } from './PortalPrimitives';
import { RegistryModuleTabs } from './RegistryModuleTabs';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const ruleFrom = (rule: ProgrammeRule) =>
  rule.changedBy ? `Changed by ${rule.changedBy}, ${historyTime(rule.changedAt ?? '')}` : `From the ${rule.source || 'handbook'}`;

interface Editing {
  rule: ProgrammeRule;
  later: LaterProgrammeRule | null;
  isNew: boolean;
}

const Durations: React.FC<{ minimum: number | null; maximum: number | null; specialCounts: boolean }> = ({ minimum, maximum, specialCounts }) => (
  <>
    <div>
      <p className="card-label">Minimum</p>
      <p className="text-[14px] font-bold text-slate-900">{semesterCount(minimum ?? 0)}</p>
      {specialCounts && <p className="text-[12px] font-medium text-slate-500">Special Semesters included</p>}
    </div>
    <div>
      <p className="card-label">Maximum</p>
      <p className="text-[14px] font-bold text-slate-900">{semesterCount(maximum ?? 0)}</p>
    </div>
  </>
);

const ROW = 'grid items-center gap-x-6 gap-y-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]';

/** Registry's Programmes tab: how long each programme takes, for each intake a rule covers. */
export const ProgrammeRules: React.FC = () => {
  const titleId = useId();
  const [rules, setRules] = useState<ProgrammeRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [firstIntake, setFirstIntake] = useState('');
  const [minimum, setMinimum] = useState('');
  const [maximum, setMaximum] = useState('');
  const [specialCounts, setSpecialCounts] = useState(true);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ programme: string; later: LaterProgrammeRule } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getProgrammeRules()
      .then(found => { if (!cancelled) setRules(found); })
      .catch(err => { if (!cancelled) setError(errorText(err, 'Could not load the programmes.')); });
    return () => { cancelled = true; };
  }, [reload]);

  const open = (rule: ProgrammeRule, later: LaterProgrammeRule | null, isNew = false) => {
    const source = later ?? rule;
    setEditing({ rule, later, isNew });
    setFirstIntake('');
    setMinimum(String(source.minSemesters ?? 3));
    setMaximum(String(source.maxSemesters ?? 8));
    setSpecialCounts(source.specialCounts);
    setCourseCode(source.researchCourseCode);
    setCourseName(source.researchCourseName);
    setProblem(null);
  };

  const save = async () => {
    if (!editing) return;
    const min = Number(minimum);
    const max = Number(maximum);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < 1) {
      setProblem('Enter whole numbers for the minimum and maximum.');
      return;
    }
    if (min > max) {
      setProblem('The minimum cannot be more than the maximum.');
      return;
    }
    const start = editing.isNew ? semesterParts(firstIntake) : editing.later ? semesterParts(editing.later.fromLabel) : null;
    if (editing.isNew && !start) {
      setProblem('Choose the first intake.');
      return;
    }
    if (courseCode.trim() && !validCourseCode(courseCode)) {
      setProblem('Enter a course code like WQD7025.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      setRules(await saveProgrammeRule({
        programme: editing.rule.programme,
        minSemesters: min,
        maxSemesters: max,
        specialCounts,
        fromSession: start?.session ?? '',
        fromTerm: start?.term ?? '',
        researchCourseCode: courseCode.trim().toUpperCase(),
        researchCourseName: courseName.trim(),
      }));
      setEditing(null);
      setToast('Saved.');
    } catch (err) {
      setProblem(errorText(err, 'Could not save this programme.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      setRules(await removeProgrammeRule(removing.later.id));
      setRemoving(null);
      setToast('Removed.');
    } catch (err) {
      setRemoving(null);
      setToast(errorText(err, 'Could not remove this rule.'));
    } finally {
      setBusy(false);
    }
  };

  const applies = editing && !editing.isNew ? (editing.later ?? editing.rule).activeStudents : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Student Registry" subtitle="How long each programme takes." />
      <RegistryModuleTabs active="programmes" />
      {error ? (
        <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />
      ) : !rules ? (
        <LoadingState message="Loading the programmes..." />
      ) : (
        <ul aria-label="Programmes" className="app-card divide-y divide-slate-100 px-5 sm:px-6">
          {rules.map(rule => (
            <li key={rule.programme} className="space-y-4 py-5">
              <div className={ROW}>
                <div className="min-w-0">
                  <p className="text-[14px] font-extrabold text-brand-navy [overflow-wrap:anywhere]">{rule.programme}</p>
                  <p className="mt-0.5 text-[12.5px] font-medium text-slate-500">
                    {!rule.hasRule ? 'No rule yet' : rule.laterRules.length ? `Intakes before ${shortSemester(rule.laterRules[0].fromLabel)}` : ruleFrom(rule)}
                  </p>
                  {rule.researchCourseCode && <p className="mt-0.5 text-[12.5px] font-semibold text-slate-600">Research Project {rule.researchCourseCode}</p>}
                </div>
                {rule.hasRule ? (
                  <Durations minimum={rule.minSemesters} maximum={rule.maxSemesters} specialCounts={rule.specialCounts} />
                ) : (
                  <p className="text-[13px] font-semibold text-amber-800 md:col-span-2">The portal can't check how long this programme takes.</p>
                )}
                <PortalButton size="sm" onClick={() => open(rule, null)} aria-label={`Edit ${rule.programme}`}>Edit</PortalButton>
              </div>
              {rule.laterRules.map(later => (
                <div key={later.id} className={`${ROW} rounded-xl border border-slate-200 bg-slate-50 px-4 py-3`}>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-slate-900">From {shortSemester(later.fromLabel)}</p>
                    <p className="mt-0.5 text-[12.5px] font-medium text-slate-500">{studentCount(later.activeStudents)}</p>
                    {later.researchCourseCode && <p className="mt-0.5 text-[12.5px] font-semibold text-slate-600">Research Project {later.researchCourseCode}</p>}
                  </div>
                  <Durations minimum={later.minSemesters} maximum={later.maxSemesters} specialCounts={later.specialCounts} />
                  <div className="flex flex-wrap items-center gap-2">
                    <PortalButton size="sm" onClick={() => open(rule, later)} aria-label={`Edit the rule from ${shortSemester(later.fromLabel)}`}>Edit</PortalButton>
                    <PortalButton size="sm" variant="ghost" onClick={() => setRemoving({ programme: rule.programme, later })} aria-label={`Remove the rule from ${shortSemester(later.fromLabel)}`}>Remove</PortalButton>
                  </div>
                </div>
              ))}
              {rule.hasRule && (
                <PortalButton size="sm" variant="ghost" icon={Plus} onClick={() => open(rule, null, true)} aria-label={`Add a rule for new intakes of ${rule.programme}`}>New intake rule</PortalButton>
              )}
            </li>
          ))}
        </ul>
      )}
      <DialogShell
        title={editing?.isNew ? 'New intake rule' : 'Change this rule'}
        titleId={titleId}
        isOpen={editing !== null}
        busy={busy}
        onClose={() => setEditing(null)}
        footer={<>
          <PortalButton onClick={() => setEditing(null)} disabled={busy}>Cancel</PortalButton>
          <PortalButton variant="primary" isLoading={busy} onClick={() => void save()}>Save</PortalButton>
        </>}
      >
        <p className="text-[14px] font-bold text-slate-800 [overflow-wrap:anywhere]">{editing?.rule.programme}</p>
        {editing?.later && <p className="text-[13px] font-semibold text-slate-600">From {shortSemester(editing.later.fromLabel)}</p>}
        {editing?.isNew && (
          <div className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
            <span id={`${titleId}-intake`}>First intake</span>
            <SelectMenu aria-labelledby={`${titleId}-intake`} value={firstIntake} placeholder="Choose an intake" options={semesterChoices()} disabled={busy} onChange={setFirstIntake} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
            Minimum semesters
            <input className="form-control form-control-md" type="number" min={1} max={20} value={minimum} disabled={busy} onChange={event => setMinimum(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
            Maximum semesters
            <input className="form-control form-control-md" type="number" min={1} max={20} value={maximum} disabled={busy} onChange={event => setMaximum(event.target.value)} />
          </label>
        </div>
        <label className="flex items-start gap-2.5 text-[13.5px] font-semibold text-slate-700">
          <input className="mt-0.5 h-4 w-4 shrink-0" type="checkbox" checked={specialCounts} disabled={busy} onChange={event => setSpecialCounts(event.target.checked)} />
          Include Special Semesters in the minimum
        </label>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
            Research Project code
            <input className="form-control form-control-md uppercase" maxLength={16} value={courseCode} placeholder="WQD7025" disabled={busy} onChange={event => setCourseCode(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
            Course name
            <input className="form-control form-control-md" maxLength={120} value={courseName} disabled={busy} onChange={event => setCourseName(event.target.value)} />
          </label>
        </div>
        <p className="text-[13px] text-slate-500">
          {editing?.isNew ? 'Students from earlier intakes are not affected.' : `Applies to ${studentCount(applies ?? 0)} straight away.`}
        </p>
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
      <PortalConfirmModal
        isOpen={removing !== null}
        title="Remove this rule?"
        message={`${studentCount(removing?.later.activeStudents ?? 0)} go back to the rule before it.`}
        confirmLabel="Remove"
        tone="danger"
        isLoading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
      <PortalToast message={toast} tone="success" onClose={() => setToast(null)} />
    </div>
  );
};
