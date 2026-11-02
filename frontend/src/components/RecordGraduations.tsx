/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, ChevronDown } from 'lucide-react';
import type { GraduationItem, GraduationOverview, GraduationResult, GraduationStudent } from '../services/registrySemestersApi';
import { getGraduationOverview, graduateStudents } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { filterPeople, fixLink, studentCount } from '../utils/registrySemesters';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { PeopleFilters, PersonRow, PersonTickRow, SelectionBar } from './RegistryPersonRow';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const FIRST_NAMES = 6;
type View = 'all' | 'ready' | 'check';

const ItemLines: React.FC<{ student: GraduationStudent; items: GraduationItem[]; tone: 'amber' | 'rose' }> = ({ student, items, tone }) => (
  <ul className={`mt-1 space-y-0.5 text-[12.5px] font-semibold ${tone === 'rose' ? 'text-rose-700' : 'text-amber-800'}`}>
    {items.map(item => {
      const link = fixLink(item, student.matric);
      return (
        <li key={`${item.code}:${item.recordId ?? ''}:${item.text}`}>
          {item.text}{' '}
          {link && <Link to={link.to} className="font-bold text-blue-700 hover:text-blue-900">{link.label}</Link>}
        </li>
      );
    })}
  </ul>
);

const nameList = (students: GraduationStudent[]) => {
  const names = students.slice(0, FIRST_NAMES).map(student => student.name).join(', ');
  return students.length > FIRST_NAMES ? `${names} and ${students.length - FIRST_NAMES} more` : names;
};

/** Tick the students on the Senate's list. Nobody starts ticked, because the portal can't see CGPA or credits. */
export const RecordGraduations: React.FC = () => {
  const navigate = useNavigate();
  const titleId = useId();
  const [overview, setOverview] = useState<GraduationOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>('all');
  const [programme, setProgramme] = useState('All');
  const [intake, setIntake] = useState('All');
  const [query, setQuery] = useState('');
  const [showStopped, setShowStopped] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<GraduationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getGraduationOverview()
      .then(data => { if (!cancelled) setOverview(data); })
      .catch(err => { if (!cancelled) setLoadError(errorText(err, 'Could not load the students.')); });
    return () => { cancelled = true; };
  }, [reload]);

  const everyone = useMemo(() => [...(overview?.ready ?? []), ...(overview?.check ?? [])], [overview]);
  const filters = { programme, intake, query };
  const matching = filterPeople(everyone, filters);
  const stopped = filterPeople(overview?.stop ?? [], filters);
  const shown = view === 'all' ? matching : matching.filter(student => student.group === view);
  const readyShown = shown.filter(student => student.group === 'ready');
  const selectable = readyShown.length ? readyShown : shown;
  const allSelected = selectable.length > 0 && selectable.every(student => picked.has(student.matric));
  const going = everyone.filter(student => picked.has(student.matric));
  const early = going.filter(student => student.early);
  const unfinished = going.filter(student => student.group === 'check' && !student.early);

  const toggle = (matric: string, on: boolean) => setPicked(current => {
    const next = new Set(current);
    if (on) next.add(matric);
    else next.delete(matric);
    return next;
  });

  const toggleAll = (on: boolean) => setPicked(current => {
    const next = new Set(current);
    for (const student of selectable) {
      if (on) next.add(student.matric);
      else next.delete(student.matric);
    }
    return next;
  });

  const record = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setResult(await graduateStudents({
        matrics: going.map(student => student.matric),
        earlyApproved: early.map(student => student.matric),
        reason: reason.trim(),
      }));
      setConfirming(false);
    } catch (err) {
      setProblem(errorText(err, 'Could not record these graduations.'));
    } finally {
      setBusy(false);
    }
  };

  const page = (children: React.ReactNode) => (
    <RecordPage
      title="Record graduations"
      subtitle={result ? undefined : "Tick the students on the Senate's list."}
      backLabel="Back to Student Registry"
      onBack={() => navigate(APP_ROUTES.registry)}
      dirty={!result && picked.size > 0}
      busy={busy}
    >
      {children}
    </RecordPage>
  );

  if (loadError) return page(<ErrorState message={loadError} onRetry={() => setReload(value => value + 1)} />);
  if (!overview) return page(<LoadingState message="Loading the students..." />);

  if (result) {
    return page(
      <section aria-label="Result" className="app-card space-y-4 p-6">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-7 w-7" aria-hidden="true" /></span>
          <h3 className="text-[20px] font-extrabold text-brand-navy">{studentCount(result.graduated.length)} graduated</h3>
          <p className="text-[13.5px] text-slate-500">{result.graduated.map(student => student.name).join(', ')}</p>
        </div>
        {result.skipped.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[13.5px] font-extrabold text-amber-900">{studentCount(result.skipped.length)} could not graduate</p>
            <ul className="mt-1 space-y-0.5 text-[13px] text-amber-900">
              {result.skipped.map(student => <li key={student.matric}>{student.name || student.matric}: {student.why}</li>)}
            </ul>
          </div>
        )}
        <div className="flex justify-center"><PortalButton onClick={() => navigate(APP_ROUTES.registry)}>Back to Student Registry</PortalButton></div>
      </section>,
    );
  }

  const tooEarly = overview.tooEarly > 0 && (
    <p className="text-[13px] text-slate-500">{studentCount(overview.tooEarly)} too early to graduate.</p>
  );

  if (everyone.length === 0 && overview.stop.length === 0) {
    return page(
      <section aria-label="Nobody yet" className="app-card space-y-1 p-6 text-center">
        <p className="text-[15px] font-bold text-slate-800">Nobody can graduate yet.</p>
        {tooEarly}
      </section>,
    );
  }

  const pills: Array<[View, string, number]> = [
    ['all', 'All', matching.length],
    ['ready', 'Ready', matching.filter(student => student.group === 'ready').length],
    ['check', 'Check first', matching.filter(student => student.group === 'check').length],
  ];

  return page(
    <section aria-label="Students who can graduate" className="app-card">
      <div className="space-y-3 p-5 sm:p-6">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {pills.map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition cursor-pointer ${view === value ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
              <span className={view === value ? 'text-white/70' : 'text-slate-400'}>{count}</span>
            </button>
          ))}
        </div>
        <PeopleFilters people={[...everyone, ...overview.stop]} programme={programme} intake={intake} query={query} onProgramme={setProgramme} onIntake={setIntake} onQuery={setQuery} />
      </div>

      <label className="flex cursor-pointer items-center gap-3 border-y border-slate-200 bg-slate-50 px-5 py-3 text-[13px] font-bold text-brand-navy sm:px-6">
        <input type="checkbox" className="h-[18px] w-[18px] cursor-pointer" checked={allSelected} disabled={selectable.length === 0} onChange={event => toggleAll(event.target.checked)} />
        Select all{readyShown.length ? ' ready' : ''} ({selectable.length})
      </label>

      {shown.length ? (
        <ul aria-label="Students" className="divide-y divide-slate-100">
          {shown.map(student => (
            <PersonTickRow
              key={student.matric}
              person={student}
              checked={picked.has(student.matric)}
              onChange={on => toggle(student.matric, on)}
              detail={student.group === 'check' ? <ItemLines student={student} items={student.items} tone="amber" /> : undefined}
              badge={<StatusBadge tone={student.group === 'ready' ? 'success' : 'warning'}>{student.group === 'ready' ? 'Ready' : 'Check first'}</StatusBadge>}
            />
          ))}
        </ul>
      ) : (
        <p className="px-6 py-10 text-center text-[13px] font-semibold text-slate-400">Nobody here.</p>
      )}

      {stopped.length > 0 && (
        <div className="border-t border-slate-200">
          <button type="button" aria-expanded={showStopped} onClick={() => setShowStopped(value => !value)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-[13px] font-bold text-brand-navy hover:bg-slate-50 sm:px-6 cursor-pointer">
            {studentCount(stopped.length)} can't graduate yet
            <ChevronDown className={`h-4 w-4 transition ${showStopped ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {showStopped && (
            <ul className="divide-y divide-slate-100 px-5 pb-4 sm:px-6">
              {stopped.map(student => (
                <PersonRow key={student.matric} person={student} detail={<ItemLines student={student} items={student.items.filter(item => item.level === 'stop')} tone="rose" />} />
              ))}
            </ul>
          )}
        </div>
      )}

      {tooEarly && <div className="border-t border-slate-200 px-5 py-3 sm:px-6">{tooEarly}</div>}

      {picked.size > 0 && (
        <SelectionBar
          count={picked.size}
          label={`Record ${picked.size} ${picked.size === 1 ? 'graduation' : 'graduations'}`}
          onClear={() => setPicked(new Set())}
          onAction={() => { setProblem(null); setConfirming(true); }}
        />
      )}

      <DialogShell
        title={`Record ${going.length} ${going.length === 1 ? 'graduation' : 'graduations'}?`}
        titleId={titleId}
        isOpen={confirming}
        busy={busy}
        onClose={() => setConfirming(false)}
        footer={<>
          <PortalButton disabled={busy} onClick={() => setConfirming(false)}>Cancel</PortalButton>
          <PortalButton variant="primary" isLoading={busy} disabled={!reason.trim()} onClick={() => void record()}>
            Record {going.length} {going.length === 1 ? 'graduation' : 'graduations'}
          </PortalButton>
        </>}
      >
        <p className="text-[13.5px] font-semibold text-slate-800">{nameList(going)}</p>
        <p className="text-[13.5px] text-slate-600">This can't be undone. Appointments end as Completed and each student gets a notice.</p>
        {(early.length > 0 || unfinished.length > 0) && (
          <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900">
            {early.length > 0 && <p>Approved to finish early: {nameList(early)}.</p>}
            {unfinished.length > 0 && <p>Still unfinished: {nameList(unfinished)}.</p>}
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
          Senate meeting or letter
          <input
            className="form-control form-control-md"
            maxLength={1000}
            placeholder="For example: Senate meeting, 12 March 2027"
            value={reason}
            disabled={busy}
            onChange={event => setReason(event.target.value)}
          />
        </label>
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
    </section>,
  );
};
