/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ProjectStagesPage, StageChangeResult, StageRow } from '../services/registrySemestersApi';
import { getProjectStages } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { changeSummary, firstChip, rowNote, rowsFor, STAGE_LABEL, STAGE_TONE, stageChips } from '../utils/projectStages';
import type { StageChip } from '../utils/projectStages';
import { filterPeople, shortSemester, studentCount } from '../utils/registrySemesters';
import { PortalToast, StatusBadge } from './PortalPrimitives';
import { ProjectStageChangeDialog } from './ProjectStageChangeDialog';
import { RecordPage } from './RecordPage';
import { PeopleFilters, PersonRow, PersonTickRow, SelectionBar } from './RegistryPersonRow';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const StageNote: React.FC<{ row: StageRow }> = ({ row }) => {
  const note = rowNote(row);
  if (!note) return null;
  const warn = row.correctionRequested || row.shown === 'NOT_CONFIRMED' || row.noSupervisor;
  return <p className={`mt-0.5 text-[12.5px] font-semibold ${warn ? 'text-amber-800' : 'text-slate-500'}`}>{note}</p>;
};

/** Each student's RP1/RP2 stage this semester. Coordinators fix the odd ones, the office looks. */
export const ProjectStages: React.FC = () => {
  const navigate = useNavigate();
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
  const [busy, setBusy] = useState(false);
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

  const saved = (result: StageChangeResult, kept: boolean) => {
    setChanging(false);
    setPicked(new Set());
    setLeftOut(result.leftOut);
    setToast(changeSummary(result, kept));
    setReload(value => value + 1);
  };

  const page = (children: React.ReactNode) => (
    <RecordPage title="RP Registration" backLabel="Back to Student Registry" onBack={() => navigate(APP_ROUTES.registry)} busy={busy}>
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
                <PersonTickRow key={row.matric} person={row} checked={picked.has(row.matric)} onChange={on => toggle(row.matric, on)} detail={<StageNote row={row} />} badge={badge} />
              ) : (
                <PersonRow key={row.matric} person={row} detail={<StageNote row={row} />} action={badge} />
              );
            })}
          </ul>
        ) : <p className="border-t border-slate-200 px-6 py-10 text-center text-[13px] font-semibold text-slate-400">Nobody here.</p>}
        {data.notStudying > 0 && <p className="border-t border-slate-200 px-5 py-3 text-[13px] text-slate-500 sm:px-6">{studentCount(data.notStudying)} not studying this semester.</p>}
      </section>

      {picked.size > 0 && (
        <SelectionBar count={picked.size} label={`Change ${picked.size}`} busy={busy} onClear={() => setPicked(new Set())} onAction={() => setChanging(true)} />
      )}

      <ProjectStageChangeDialog
        semesterId={data.semester.id}
        rows={selected}
        reasons={data.reasons}
        isOpen={changing}
        onClose={() => setChanging(false)}
        onSaved={saved}
        onBusy={setBusy}
      />
      <PortalToast message={toast} tone="success" onClose={() => setToast(null)} />
    </div>,
  );
};
