/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { MarksImpact, ProjectStagesPage, StageChoice, StageRow } from '../services/registrySemestersApi';
import { changeProjectStages, getProjectStageImpact, getProjectStages } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { changeSummary, firstChip, marksLine, rowNote, rowsFor, STAGE_LABEL, STAGE_TONE, stageChips, stageChoices, touchesMarks } from '../utils/projectStages';
import type { StageChip } from '../utils/projectStages';
import { filterPeople, shortSemester, studentCount } from '../utils/registrySemesters';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { PeopleFilters, PersonRow, PersonTickRow, SelectionBar } from './RegistryPersonRow';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const Note: React.FC<{ row: StageRow }> = ({ row }) => {
  const note = rowNote(row);
  if (!note) return null;
  const warn = row.shown === 'NOT_CONFIRMED' || row.noSupervisor;
  return <p className={`mt-0.5 text-[12.5px] font-semibold ${warn ? 'text-amber-800' : 'text-slate-500'}`}>{note}</p>;
};

/** Each student's RP1/RP2 stage this semester. Coordinators fix the odd ones, the office looks. */
export const ProjectStages: React.FC = () => {
  const navigate = useNavigate();
  const titleId = useId();
  const [data, setData] = useState<ProjectStagesPage | null>(null);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [chip, setChip] = useState<StageChip | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [programme, setProgramme] = useState('All');
  const [intake, setIntake] = useState('All');
  const [query, setQuery] = useState('');
  const [changing, setChanging] = useState(false);
  const [choice, setChoice] = useState<StageChoice | null>(null);
  const [reason, setReason] = useState('');
  const [impact, setImpact] = useState<MarksImpact | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [leftOut, setLeftOut] = useState<Array<{ matric: string; name: string; why: string }>>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getProjectStages(semesterId)
      .then(found => {
        if (cancelled) return;
        setData(found);
        setChip(current => current ?? firstChip(found.rows));
      })
      .catch(err => { if (!cancelled) setError(errorText(err, 'Could not load the students.')); });
    return () => { cancelled = true; };
  }, [semesterId, reload]);

  const selected = useMemo(() => (data?.rows ?? []).filter(row => picked.has(row.matric)), [data, picked]);
  const single = selected.length === 1 ? selected[0] : null;

  useEffect(() => {
    setImpact(null);
    setChecked(false);
    if (!changing || !single || !choice || !data?.semester) return undefined;
    let cancelled = false;
    getProjectStageImpact(data.semester.id, single.matric, choice)
      .then(found => { if (!cancelled) setImpact(found); })
      .catch(err => { if (!cancelled) setProblem(errorText(err, 'Could not check Marks.')); });
    return () => { cancelled = true; };
  }, [changing, single, choice, data?.semester]);

  const switchSemester = (value: string) => {
    setPicked(new Set());
    setChip(null);
    setLeftOut([]);
    setSemesterId(Number(value));
  };

  const switchChip = (value: StageChip) => {
    setPicked(new Set());
    setChip(value);
  };

  const toggle = (matric: string, on: boolean) => setPicked(current => {
    const next = new Set(current);
    if (on) next.add(matric);
    else next.delete(matric);
    return next;
  });

  const openChange = () => {
    setProblem(null);
    setChoice(null);
    setReason('');
    setChanging(true);
  };

  const save = async () => {
    if (!data?.semester || !choice) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await changeProjectStages({
        semesterId: data.semester.id,
        stage: choice,
        reason,
        students: selected.map(row => ({ matric: row.matric, shown: row.shown })),
        checked,
        token: impact?.token ?? '',
      });
      setChanging(false);
      setPicked(new Set());
      setLeftOut(result.leftOut);
      setToast(changeSummary(result));
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
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] font-semibold text-amber-900">There is no active semester.</p>
        {semesterOptions.length > 0 && <SelectMenu variant="filter" prefix="Semester" aria-label="Semester" value="" placeholder="Choose" options={semesterOptions} onChange={switchSemester} />}
      </div>,
    );
  }

  const chips = stageChips(data.rows);
  const active = chip && chips.some(item => item.value === chip) ? chip : firstChip(data.rows);
  const listed = filterPeople(rowsFor(data.rows, active), { programme, intake, query });
  const choices = stageChoices(selected);
  const needsCheck = Boolean(single) && touchesMarks(impact);
  const waitingForImpact = Boolean(single && choice && !impact && !problem);
  const canSave = Boolean(choice && reason && !waitingForImpact && (!needsCheck || checked));

  return page(
    <div className="space-y-5">
      <div className="flex justify-end">
        <SelectMenu variant="filter" prefix="Semester" aria-label="Semester" value={String(data.semester.id)} options={semesterOptions} disabled={busy} onChange={switchSemester} />
      </div>

      {leftOut.length > 0 && (
        <div role="status" className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900">
          <div className="flex items-start justify-between gap-3">
            <p>Not changed:</p>
            <button type="button" className="text-[12.5px] font-bold text-amber-900 underline cursor-pointer" onClick={() => setLeftOut([])}>Close</button>
          </div>
          <ul className="space-y-0.5">
            {leftOut.map(row => <li key={row.matric}>{row.name || row.matric}: {row.why}</li>)}
          </ul>
        </div>
      )}

      <section aria-label="Students" className="app-card">
        <div className="space-y-3 p-5 sm:p-6">
          <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
            {chips.map(item => (
              <button key={item.value} type="button" aria-pressed={active === item.value} onClick={() => switchChip(item.value)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition cursor-pointer ${active === item.value ? 'border-brand-navy bg-brand-navy text-white' : item.attention ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {item.label}
                <span className={active === item.value ? 'text-white/70' : item.attention ? 'text-amber-700' : 'text-slate-400'}>{item.count}</span>
              </button>
            ))}
          </div>
          <PeopleFilters people={data.rows} programme={programme} intake={intake} query={query} onProgramme={setProgramme} onIntake={setIntake} onQuery={setQuery} />
        </div>
        {listed.length ? (
          <ul aria-label="Students" className={`divide-y divide-slate-100 border-t border-slate-200 ${data.canChange ? '' : 'px-5 py-4 sm:px-6'}`}>
            {listed.map(row => {
              const badge = <StatusBadge tone={STAGE_TONE[row.shown]}>{STAGE_LABEL[row.shown]}</StatusBadge>;
              return data.canChange ? (
                <PersonTickRow key={row.matric} person={row} checked={picked.has(row.matric)} onChange={on => toggle(row.matric, on)} detail={<Note row={row} />} badge={badge} />
              ) : (
                <PersonRow key={row.matric} person={row} detail={<Note row={row} />} action={badge} />
              );
            })}
          </ul>
        ) : <p className="border-t border-slate-200 px-6 py-10 text-center text-[13px] font-semibold text-slate-400">Nobody here.</p>}
        {data.notStudying > 0 && <p className="border-t border-slate-200 px-5 py-3 text-[13px] text-slate-500 sm:px-6">{studentCount(data.notStudying)} not studying this semester.</p>}
      </section>

      {picked.size > 0 && (
        <SelectionBar count={picked.size} label={`Change ${picked.size}`} busy={busy} onClear={() => setPicked(new Set())} onAction={openChange} />
      )}

      <DialogShell
        title={single ? `Change ${single.name}'s stage` : `Change ${studentCount(selected.length)}`}
        titleId={titleId}
        isOpen={changing}
        busy={busy}
        onClose={() => setChanging(false)}
        footer={<>
          <PortalButton disabled={busy} onClick={() => setChanging(false)}>Cancel</PortalButton>
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
        <div className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
          <span id={`${titleId}-reason`}>Reason</span>
          <SelectMenu aria-labelledby={`${titleId}-reason`} value={reason} placeholder="Choose a reason" options={data.reasons} disabled={busy} onChange={setReason} />
        </div>
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
      <PortalToast message={toast} tone="success" onClose={() => setToast(null)} />
    </div>,
  );
};
