/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import type { ProgrammeRule } from '../services/registrySemestersApi';
import { getProgrammeRules, saveProgrammeRule } from '../services/registrySemestersApi';
import { historyTime } from '../utils/documentDisplay';
import { semesterCount } from '../utils/registrySemesters';
import { DialogShell } from './DocumentDialogs';
import { PageHeader, PortalButton, PortalToast } from './PortalPrimitives';
import { RegistryModuleTabs } from './RegistryModuleTabs';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const ruleFrom = (rule: ProgrammeRule) =>
  rule.changedBy ? `Changed by ${rule.changedBy}, ${historyTime(rule.changedAt ?? '')}` : `From the ${rule.source || 'handbook'}`;

/** Registry's Programmes tab: how long each programme takes. It decides who can graduate and what letters print. */
export const ProgrammeRules: React.FC = () => {
  const titleId = useId();
  const [rules, setRules] = useState<ProgrammeRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<ProgrammeRule | null>(null);
  const [minimum, setMinimum] = useState('');
  const [maximum, setMaximum] = useState('');
  const [specialCounts, setSpecialCounts] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getProgrammeRules()
      .then(found => { if (!cancelled) setRules(found); })
      .catch(err => { if (!cancelled) setError(errorText(err, 'Could not load the programmes.')); });
    return () => { cancelled = true; };
  }, [reload]);

  const edit = (rule: ProgrammeRule) => {
    setEditing(rule);
    setMinimum(String(rule.minSemesters ?? 3));
    setMaximum(String(rule.maxSemesters ?? 8));
    setSpecialCounts(rule.specialCounts);
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
    setBusy(true);
    setProblem(null);
    try {
      setRules(await saveProgrammeRule({ programme: editing.programme, minSemesters: min, maxSemesters: max, specialCounts }));
      setEditing(null);
      setToast(`Saved. This now applies to ${editing.programme}.`);
    } catch (err) {
      setProblem(errorText(err, 'Could not save this programme.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Student Registry" subtitle="How long each programme takes. This decides who can graduate and what letters print." />
      <RegistryModuleTabs active="programmes" office />
      {error ? (
        <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />
      ) : !rules ? (
        <LoadingState message="Loading the programmes..." />
      ) : (
        <ul aria-label="Programmes" className="app-card divide-y divide-slate-100 px-5 sm:px-6">
          {rules.map(rule => (
            <li key={rule.programme} className="grid items-center gap-x-6 gap-y-3 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-brand-navy [overflow-wrap:anywhere]">{rule.programme}</p>
                <p className="mt-0.5 text-[12.5px] font-medium text-slate-500">{rule.hasRule ? ruleFrom(rule) : 'No rule yet'}</p>
              </div>
              {rule.hasRule ? (
                <>
                  <div>
                    <p className="card-label">Minimum</p>
                    <p className="text-[14px] font-bold text-slate-900">{semesterCount(rule.minSemesters ?? 0)}</p>
                    {rule.specialCounts && <p className="text-[12px] font-medium text-slate-500">A Special Semester counts</p>}
                  </div>
                  <div>
                    <p className="card-label">Maximum</p>
                    <p className="text-[14px] font-bold text-slate-900">{semesterCount(rule.maxSemesters ?? 0)}</p>
                  </div>
                </>
              ) : (
                <p className="text-[13px] font-semibold text-amber-800 md:col-span-2">The portal can't check how long this programme takes.</p>
              )}
              <PortalButton size="sm" onClick={() => edit(rule)} aria-label={`Edit ${rule.programme}`}>Edit</PortalButton>
            </li>
          ))}
        </ul>
      )}
      <DialogShell
        title="Change this programme"
        titleId={titleId}
        isOpen={editing !== null}
        busy={busy}
        onClose={() => setEditing(null)}
        footer={<>
          <PortalButton onClick={() => setEditing(null)} disabled={busy}>Cancel</PortalButton>
          <PortalButton variant="primary" isLoading={busy} onClick={() => void save()}>Save</PortalButton>
        </>}
      >
        <p className="text-[14px] font-bold text-slate-800 [overflow-wrap:anywhere]">{editing?.programme}</p>
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
          A Special Semester counts toward the minimum
        </label>
        <p className="text-[13px] text-slate-500">
          This applies to {editing?.activeStudents ?? 0} Active {editing?.activeStudents === 1 ? 'student' : 'students'} straight away.
        </p>
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
      <PortalToast message={toast} tone="success" onClose={() => setToast(null)} />
    </div>
  );
};
