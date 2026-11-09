/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ConfirmedStage, MarksImpact, ProjectStageChoice, ProjectStagesPage, StageToConfirm } from '../services/registrySemestersApi';
import { confirmProjectStages, correctProjectStage, getProjectStageImpact, getProjectStages } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { filterPeople, shortSemester, studentCount } from '../utils/registrySemesters';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { PeopleFilters, PersonRow, SelectionBar } from './RegistryPersonRow';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';

type Tab = 'confirm' | 'confirmed';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const STAGES: Array<{ value: ProjectStageChoice; label: string }> = [{ value: 'P1', label: 'P1' }, { value: 'P2', label: 'P2' }, { value: 'NONE', label: 'No project' }];
const CHANGE_OPTIONS = [...STAGES, { value: 'VOID' as const, label: 'Not confirmed' }];
const stageLabel = (stage: string) => STAGES.find(option => option.value === stage)?.label ?? stage;

const StagePicker: React.FC<{ name: string; value: string; disabled: boolean; onPick: (stage: ProjectStageChoice | '') => void }> = ({ name, value, disabled, onPick }) => (
  <div role="group" aria-label={`Project stage for ${name}`} className="flex gap-1.5">
    {STAGES.map(option => (
      <button key={option.value} type="button" aria-pressed={value === option.value} disabled={disabled} onClick={() => onPick(value === option.value ? '' : option.value)} className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold transition cursor-pointer ${value === option.value ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
        {option.label}
      </button>
    ))}
  </div>
);

export const ProjectStages: React.FC = () => {
  const navigate = useNavigate();
  const titleId = useId();
  const [data, setData] = useState<ProjectStagesPage | null>(null);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>('confirm');
  const [picks, setPicks] = useState<Map<string, ProjectStageChoice>>(new Map());
  const [programme, setProgramme] = useState('All');
  const [intake, setIntake] = useState('All');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [changing, setChanging] = useState<ConfirmedStage | null>(null);
  const [newStage, setNewStage] = useState<ProjectStageChoice | 'VOID'>('P1');
  const [reason, setReason] = useState('');
  const [impact, setImpact] = useState<MarksImpact | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getProjectStages(semesterId)
      .then(found => {
        if (cancelled) return;
        setData(found);
        setPicks(new Map(found.toConfirm.filter(row => row.suggested).map(row => [row.matric, row.suggested as ProjectStageChoice])));
      })
      .catch(err => { if (!cancelled) setError(errorText(err, 'Could not load the students.')); });
    return () => { cancelled = true; };
  }, [semesterId, reload]);

  useEffect(() => {
    setImpact(null);
    setChecked(false);
    if (!changing || !data?.semester || newStage === changing.stage) return undefined;
    let cancelled = false;
    getProjectStageImpact(data.semester.id, changing.matric, newStage)
      .then(found => { if (!cancelled) setImpact(found); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [changing, newStage, data?.semester]);

  const pick = (row: StageToConfirm, stage: ProjectStageChoice | '') => setPicks(current => {
    const next = new Map(current);
    if (stage) next.set(row.matric, stage);
    else next.delete(row.matric);
    return next;
  });

  const confirm = async () => {
    if (!data?.semester) return;
    setBusy(true);
    setProblem(null);
    try {
      await confirmProjectStages(data.semester.id, [...picks].map(([matric, stage]) => ({ matric, stage })));
      setReload(value => value + 1);
    } catch (err) {
      setProblem(errorText(err, 'Could not save this.'));
    } finally {
      setBusy(false);
    }
  };

  const open = (row: ConfirmedStage) => {
    setProblem(null);
    setReason('');
    setNewStage(row.stage);
    setChanging(row);
  };

  const saveChange = async () => {
    if (!changing || !data?.semester) return;
    setBusy(true);
    setProblem(null);
    try {
      await correctProjectStage({ semesterId: data.semester.id, matric: changing.matric, stage: newStage, reason: reason.trim(), revision: changing.revision, acknowledged: checked });
      setChanging(null);
      setReload(value => value + 1);
    } catch (err) {
      setProblem(errorText(err, 'Could not save this.'));
    } finally {
      setBusy(false);
    }
  };

  const page = (children: React.ReactNode) => (
    <RecordPage title="Project stages" backLabel="Back to Student Registry" onBack={() => navigate(APP_ROUTES.registry)} busy={busy}>
      {children}
    </RecordPage>
  );

  if (error) return page(<ErrorState message={error} onRetry={() => setReload(value => value + 1)} />);
  if (!data) return page(<LoadingState message="Loading the students..." />);
  const semesterOptions = data.semesters.map(row => ({ value: String(row.id), label: shortSemester(row.label) }));
  if (!data.semester) {
    return page(
      <div className="space-y-3">
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] font-semibold text-amber-900">There is no active semester. Set one in Academic Semesters first.</p>
        {semesterOptions.length > 0 && <SelectMenu variant="filter" prefix="Semester" aria-label="Semester" value="" placeholder="Choose" options={semesterOptions} onChange={value => setSemesterId(Number(value))} />}
      </div>,
    );
  }

  const filters = { programme, intake, query };
  const toConfirm = filterPeople(data.toConfirm, filters);
  const confirmed = filterPeople(data.confirmed, filters);
  const everyone = [...data.toConfirm, ...data.confirmed];
  const tabs: Array<[Tab, string, number]> = [['confirm', 'To confirm', data.toConfirm.length], ['confirmed', 'Confirmed', data.confirmed.length]];
  const hasImpact = Boolean(impact && (impact.notStarted || impact.draft || impact.submitted));
  const canSave = Boolean(changing && newStage !== changing.stage && reason.trim() && (!hasImpact || checked));

  return page(
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {tabs.map(([value, label, count]) => (
            <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[13.5px] font-extrabold transition cursor-pointer ${tab === value ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              {label}
              <span className={tab === value ? 'text-white/70' : 'text-slate-400'}>{count}</span>
            </button>
          ))}
        </div>
        <SelectMenu variant="filter" prefix="Semester" aria-label="Semester" value={String(data.semester.id)} options={semesterOptions} disabled={busy} onChange={value => setSemesterId(Number(value))} />
      </div>

      <section aria-label="Students" className="app-card">
        <div className="p-5 sm:p-6">
          <PeopleFilters people={everyone} programme={programme} intake={intake} query={query} onProgramme={setProgramme} onIntake={setIntake} onQuery={setQuery} />
        </div>
        <div className="border-t border-slate-200 px-5 py-4 sm:px-6">
          {tab === 'confirm' ? (
            toConfirm.length ? (
              <ul className="divide-y divide-slate-100">
                {toConfirm.map(row => (
                  <PersonRow
                    key={row.matric}
                    person={row}
                    detail={row.suggested ? <p className="mt-0.5 text-[12.5px] font-semibold text-blue-700">Suggested {row.suggested}</p> : <p className="mt-0.5 text-[12.5px] font-semibold text-amber-800">Has a supervisor or panel. Needs a stage.</p>}
                    action={<StagePicker name={row.name} value={picks.get(row.matric) ?? ''} disabled={busy} onPick={stage => pick(row, stage)} />}
                  />
                ))}
              </ul>
            ) : <p className="py-6 text-center text-[13px] font-semibold text-slate-400">Nobody to confirm.</p>
          ) : (
            confirmed.length ? (
              <ul className="divide-y divide-slate-100">
                {confirmed.map(row => (
                  <PersonRow
                    key={row.matric}
                    person={row}
                    action={<span className="flex items-center gap-3"><StatusBadge tone={row.stage === 'NONE' ? 'neutral' : 'info'}>{stageLabel(row.stage)}</StatusBadge><button type="button" className="text-[13px] font-bold text-blue-700 hover:text-blue-900" onClick={() => open(row)}>Change</button></span>}
                  />
                ))}
              </ul>
            ) : <p className="py-6 text-center text-[13px] font-semibold text-slate-400">Nobody confirmed yet.</p>
          )}
        </div>
      </section>

      {(data.notStudying > 0 || data.noActivity > 0) && (
        <p className="text-[13px] text-slate-500">
          {data.notStudying > 0 && `${studentCount(data.notStudying)} not studying this semester. `}
          {data.noActivity > 0 && `${studentCount(data.noActivity)} not on the project yet.`}
        </p>
      )}

      {tab === 'confirm' && picks.size > 0 && (
        <SelectionBar count={picks.size} label={`Confirm ${picks.size}`} busy={busy} problem={problem} onClear={() => setPicks(new Map())} onAction={() => void confirm()} />
      )}

      <DialogShell
        title={changing ? `Change ${changing.name}'s stage` : ''}
        titleId={titleId}
        isOpen={changing !== null}
        busy={busy}
        onClose={() => setChanging(null)}
        footer={<>
          <PortalButton disabled={busy} onClick={() => setChanging(null)}>Cancel</PortalButton>
          <PortalButton variant="primary" isLoading={busy} disabled={!canSave} onClick={() => void saveChange()}>Save</PortalButton>
        </>}
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
          New stage
          <SelectMenu value={newStage} options={CHANGE_OPTIONS} onChange={value => setNewStage(value as ProjectStageChoice | 'VOID')} disabled={busy} aria-label="New stage" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
          Reason
          <input className="form-control form-control-md" maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} />
        </label>
        {impact && hasImpact && (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900">
            <p>In Marks: {impact.notStarted} not started, {impact.draft} draft, {impact.submitted} submitted.</p>
            <p>Marks keeps these until the office reviews them.</p>
            <label className="flex items-center gap-2 font-bold">
              <input type="checkbox" className="h-4 w-4" checked={checked} onChange={event => setChecked(event.target.checked)} />
              I've checked this
            </label>
          </div>
        )}
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
    </div>,
  );
};
