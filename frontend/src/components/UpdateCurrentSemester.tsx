/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Check, ChevronDown, GraduationCap, Info, Search } from 'lucide-react';
import type { MoveState, SemesterOutcome, SemesterStudent } from '../services/registrySemestersApi';
import { changeStudentSemester, getSemesterMove, moveStudents } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { filterPeople, findStudents, intakeFilterOptions, matchesIntake, shortProgramme, shortSemester, studentCount } from '../utils/registrySemesters';
import { PeopleFilters, PersonRow, PersonTickRow, SelectionBar } from './RegistryPersonRow';
import { PortalButton } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const TILE_TONES = ['bg-blue-50 text-blue-600 border-blue-100', 'bg-amber-50 text-amber-600 border-amber-100', 'bg-emerald-50 text-emerald-600 border-emerald-100', 'bg-purple-50 text-purple-600 border-purple-100'];
const FIRST_ROWS = 5;
const isNotRegistered = (row: SemesterStudent) => row.outcome === 'NOT_REGISTERED';

/** Who is on the active semester. Activating a normal semester puts everyone on it, so the office only marks who didn't register. Only some take a Special Semester, so those are ticked. */
export const UpdateCurrentSemester: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<MoveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const [programme, setProgramme] = useState('All');
  const [intake, setIntake] = useState('All');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<{ moved: number; leftOut: number; semester: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getSemesterMove()
      .then(found => { if (!cancelled) setState(found); })
      .catch(err => { if (!cancelled) setError(errorText(err, 'Could not load the students.')); });
    return () => { cancelled = true; };
  }, [reload]);

  const waiting = useMemo(() => state?.students ?? [], [state]);
  const special = Boolean(state?.semester?.isSpecial);
  const onSemester = useMemo(() => state?.onSemester ?? [], [state]);
  const notRegistered = useMemo(() => onSemester.filter(isNotRegistered), [onSemester]);
  const studying = onSemester.length - notRegistered.length;
  const onLeave = state?.onLeave ?? 0;
  const attention = state?.attention ?? [];
  const intakes = useMemo(() => intakeFilterOptions(onSemester.map(row => row.intake)), [onSemester]);
  const inIntake = useMemo(() => onSemester.filter(row => matchesIntake(row.intake, intake)), [onSemester, intake]);
  const programmes = useMemo(() => {
    const groups = new Map<string, SemesterStudent[]>();
    for (const row of inIntake) groups.set(row.programme, [...(groups.get(row.programme) ?? []), row]);
    return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second));
  }, [inIntake]);
  const results = useMemo(() => findStudents(inIntake, query).filter(row => !isNotRegistered(row)).slice(0, 5), [inIntake, query]);
  const specialShown = special ? filterPeople(waiting, { programme, intake, query }) : [];
  const allSpecialTicked = specialShown.length > 0 && specialShown.every(student => added.has(student.matric));

  const tick = (matric: string, on: boolean) => setAdded(current => {
    const next = new Set(current);
    if (on) next.add(matric);
    else next.delete(matric);
    return next;
  });

  const tickShown = (on: boolean) => setAdded(current => {
    const next = new Set(current);
    for (const student of specialShown) {
      if (on) next.add(student.matric);
      else next.delete(student.matric);
    }
    return next;
  });

  const move = async (matrics: string[]) => {
    if (!state?.semester) return null;
    setBusy(true);
    setProblem(null);
    try {
      return await moveStudents(state.semester.id, matrics);
    } catch (err) {
      setProblem(errorText(err, 'Could not update the students.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const updateChosen = async () => {
    const result = await move([...added]);
    if (result) setDone(result);
  };

  const updateWaiting = async () => {
    if (await move(waiting.map(student => student.matric))) setReload(value => value + 1);
  };

  const setOutcome = async (row: SemesterStudent, outcome: SemesterOutcome) => {
    setBusy(true);
    setProblem(null);
    try {
      await changeStudentSemester(row.matric, row.rowId, { outcome });
      setState(current => current && { ...current, onSemester: current.onSemester?.map(item => (item.rowId === row.rowId ? { ...item, outcome } : item)) });
      setQuery('');
    } catch (err) {
      setProblem(errorText(err, 'Could not save this.'));
    } finally {
      setBusy(false);
    }
  };

  const page = (children: React.ReactNode) => (
    <RecordPage
      title="Current semester"
      backLabel="Back to Student Registry"
      onBack={() => navigate(APP_ROUTES.registry)}
      dirty={!done && added.size > 0}
      busy={busy}
    >
      {children}
    </RecordPage>
  );

  if (error) return page(<ErrorState message={error} onRetry={() => setReload(value => value + 1)} />);
  if (!state) return page(<LoadingState message="Loading the students..." />);
  if (done) {
    return page(
      <section aria-label="Students updated" className="app-card flex flex-col items-center gap-2.5 px-6 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-7 w-7" aria-hidden="true" /></span>
        <h3 className="text-[20px] font-extrabold text-brand-navy">{studentCount(done.moved)} updated to {shortSemester(done.semester)}</h3>
        {done.leftOut > 0 && <p className="text-[13.5px] text-slate-500">{studentCount(done.leftOut)} left out. Update them later from this page.</p>}
        <PortalButton className="mt-2" onClick={() => navigate(APP_ROUTES.registry)}>Back to Student Registry</PortalButton>
      </section>,
    );
  }
  if (!state.semester) {
    return page(
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] font-semibold text-amber-900">
        There is no active semester. Set one in Academic Semesters first.
      </p>,
    );
  }

  const notes = (
    <>
      {state.notStarted > 0 && (
        <p className="flex items-start gap-2 text-[13px] text-slate-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {studentCount(state.notStarted)} on a later intake.
        </p>
      )}
    </>
  );

  if (special) {
    if (waiting.length === 0) {
      return page(
        <div className="space-y-3">
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-[14px] font-semibold text-slate-700">
            Every Active student is already on {shortSemester(state.semester.label)}.
          </p>
          {notes}
        </div>,
      );
    }
    return page(
      <div className="space-y-5">
        <section aria-label="Summary" className="app-card space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
            {state.movingFrom && (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Now</p>
                  <p className="text-[14px] font-extrabold text-slate-900">{shortSemester(state.movingFrom)}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </>
            )}
            <div className="rounded-2xl bg-brand-navy px-4 py-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Updating to</p>
              <p className="text-[14px] font-extrabold text-white">{shortSemester(state.semester.label)}</p>
            </div>
          </div>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[44px] font-black leading-none tracking-tight text-brand-navy tabular-nums">{added.size}</span>
            <span className="text-[17px] font-bold text-slate-900">{added.size === 1 ? 'student' : 'students'}</span>
          </p>
        </section>

        <section aria-label="Who is taking the Special Semester" className="app-card">
          <div className="space-y-3 p-5 sm:p-6">
            <h3 className="text-[15.5px] font-extrabold text-brand-navy">Who is taking the Special Semester?</h3>
            <PeopleFilters people={waiting} programme={programme} intake={intake} query={query} onProgramme={setProgramme} onIntake={setIntake} onQuery={setQuery} disabled={busy} />
          </div>
          <label className="flex cursor-pointer items-center gap-3 border-y border-slate-200 bg-slate-50 px-5 py-3 text-[13px] font-bold text-brand-navy sm:px-6">
            <input type="checkbox" className="h-[18px] w-[18px] cursor-pointer" checked={allSpecialTicked} disabled={busy || specialShown.length === 0} onChange={event => tickShown(event.target.checked)} />
            Select all ({specialShown.length})
          </label>
          {specialShown.length ? (
            <ul aria-label="Students" className="divide-y divide-slate-100">
              {specialShown.map(student => (
                <PersonTickRow key={student.matric} person={student} checked={added.has(student.matric)} disabled={busy} onChange={on => tick(student.matric, on)} />
              ))}
            </ul>
          ) : (
            <p className="px-6 py-10 text-center text-[13px] font-semibold text-slate-400">Nobody here.</p>
          )}
        </section>

        {notes}

        {added.size > 0 && (
          <SelectionBar
            count={added.size}
            label={`Update ${studentCount(added.size)}`}
            busy={busy}
            problem={problem}
            onClear={() => setAdded(new Set())}
            onAction={() => void updateChosen()}
          />
        )}
      </div>,
    );
  }

  const shown = open ? (programmes.find(([name]) => name === open)?.[1] ?? []) : [];

  return page(
    <div className="space-y-5">
      <section aria-label="Summary" className="app-card space-y-5 p-5 sm:p-6">
        <div className="w-fit rounded-2xl bg-brand-navy px-4 py-2.5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Current semester</p>
          <p className="text-[14px] font-extrabold text-white">{shortSemester(state.semester.label)}</p>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[44px] font-black leading-none tracking-tight text-brand-navy tabular-nums">{studying}</span>
          <span className="text-[17px] font-bold text-slate-900">{studying === 1 ? 'student' : 'students'}</span>
          {notRegistered.length > 0 && <span className="text-[14px] font-semibold text-rose-700">{notRegistered.length} not registered</span>}
          {onLeave > 0 && <span className="text-[14px] font-semibold text-slate-500">{onLeave} on leave</span>}
        </p>
        {waiting.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] font-semibold text-amber-900">
            <span>{studentCount(waiting.length)} not on this semester yet.</span>
            <PortalButton variant="primary" size="sm" isLoading={busy} onClick={() => void updateWaiting()}>Update {studentCount(waiting.length)}</PortalButton>
          </div>
        )}
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </section>

      {onSemester.length > 0 && (
        <>
          {intakes.length > 1 && (
            <SelectMenu
              variant="filter"
              prefix="Intake"
              aria-label="Filter by intake"
              value={intake}
              options={[{ value: 'All', label: 'All intakes', triggerLabel: 'All' }, ...intakes]}
              disabled={busy}
              onChange={value => { setIntake(value); setOpen(null); }}
            />
          )}
          <div className="grid gap-3.5 md:grid-cols-3">
            {programmes.map(([name, group], index) => {
              const out = group.filter(isNotRegistered).length;
              const isOpen = open === name;
              return (
                <button
                  key={name}
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => { setOpen(isOpen ? null : name); setShowAll(false); }}
                  className={`relative rounded-2xl border bg-white p-5 text-left transition hover:border-slate-300 ${isOpen ? 'border-brand-navy ring-1 ring-brand-navy' : 'border-slate-200/80'}`}
                >
                  <span className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border ${TILE_TONES[index % TILE_TONES.length]}`}>
                    <GraduationCap className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="block pr-12 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{shortProgramme(name) || 'No programme'}</span>
                  <span className="mt-2 block text-[24px] font-extrabold leading-none tracking-tight text-brand-navy tabular-nums">{group.length - out}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-blue-700">
                    {out ? `${out} not registered` : 'See who'} <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
          {open && (
            <section aria-label={`Students in ${shortProgramme(open)}`} className="app-card space-y-3 p-5 sm:p-6">
              <ul className="divide-y divide-slate-100">
                {(showAll ? shown : shown.slice(0, FIRST_ROWS)).map(row => (
                  <PersonRow
                    key={row.rowId}
                    person={row}
                    muted={isNotRegistered(row)}
                    action={(
                      <button type="button" disabled={busy} className={`text-[13px] font-bold ${isNotRegistered(row) ? 'text-slate-500 hover:text-slate-700' : 'text-blue-700 hover:text-blue-900'}`} onClick={() => void setOutcome(row, isNotRegistered(row) ? 'STUDIED' : 'NOT_REGISTERED')}>
                        {isNotRegistered(row) ? 'Undo' : 'Mark not registered'}
                      </button>
                    )}
                  />
                ))}
              </ul>
              {!showAll && shown.length > FIRST_ROWS && (
                <button type="button" className="text-[13px] font-bold text-blue-700 hover:text-blue-900" onClick={() => setShowAll(true)}>Show all {shown.length}</button>
              )}
            </section>
          )}
          <section aria-label="Not registered" className="app-card space-y-4 p-5 sm:p-6">
            <h3 className="text-[15.5px] font-extrabold text-brand-navy">Didn't register</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                className="form-control form-control-md pl-10"
                aria-label="Find a student"
                placeholder="Search name or ID"
                value={query}
                disabled={busy}
                onChange={event => setQuery(event.target.value)}
              />
            </div>
            {query.trim() !== '' && (
              results.length ? (
                <ul aria-label="Students found" className="divide-y divide-slate-100">
                  {results.map(row => (
                    <PersonRow key={row.rowId} person={row} action={<PortalButton size="sm" disabled={busy} onClick={() => void setOutcome(row, 'NOT_REGISTERED')}>Mark not registered</PortalButton>} />
                  ))}
                </ul>
              ) : <p className="text-[13px] text-slate-500">Nobody found.</p>
            )}
            {notRegistered.length > 0 && (
              <ul aria-label="Marked not registered" className="flex flex-wrap gap-2">
                {notRegistered.map(row => (
                  <li key={row.rowId} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-2 text-[13px] font-semibold text-slate-800">
                    {row.name}
                    <button type="button" aria-label={`Undo ${row.name}`} disabled={busy} className="rounded-full px-1 text-slate-500 hover:text-slate-800" onClick={() => void setOutcome(row, 'STUDIED')}>&times;</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {attention.length > 0 && (
        <section aria-label="Needs a decision" className="app-card space-y-3 p-5 sm:p-6">
          <h3 className="text-[15.5px] font-extrabold text-brand-navy">Needs a decision</h3>
          <ul className="divide-y divide-slate-100">
            {attention.map(row => (
              <PersonRow
                key={row.matric}
                person={row}
                detail={row.warnings.map(warning => <p key={warning.code} className={`mt-0.5 text-[12.5px] font-semibold ${warning.level === 'stop' ? 'text-rose-700' : 'text-amber-800'}`}>{warning.text}</p>)}
                action={<Link to={`${APP_ROUTES.registry}?student=${encodeURIComponent(row.matric)}`} className="text-[13px] font-bold text-blue-700 hover:text-blue-900">Open record</Link>}
              />
            ))}
          </ul>
        </section>
      )}

      {notes}
    </div>,
  );
};
