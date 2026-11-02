/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Check, ChevronDown, GraduationCap, Info, Search } from 'lucide-react';
import type { MoveState, MoveStudent } from '../services/registrySemestersApi';
import { getSemesterMove, moveStudents } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { shortProgramme } from '../utils/programmeTransfers';
import { filterPeople, findStudents, intakeFilterOptions, matchesIntake, shortSemester, studentCount } from '../utils/registrySemesters';
import { PeopleFilters, PersonRow, PersonTickRow, SelectionBar } from './RegistryPersonRow';
import { PortalButton } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const TILE_TONES = ['bg-blue-50 text-blue-600 border-blue-100', 'bg-amber-50 text-amber-600 border-amber-100', 'bg-emerald-50 text-emerald-600 border-emerald-100', 'bg-purple-50 text-purple-600 border-purple-100'];
const FIRST_ROWS = 5;

/** Put students on the active semester. Nearly everyone goes on in a normal semester, so the page only asks about exceptions. Only some take a Special Semester, so those are ticked. */
export const UpdateCurrentSemester: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<MoveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [leftOut, setLeftOut] = useState<Set<string>>(new Set());
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

  const students = useMemo(() => state?.students ?? [], [state]);
  const special = Boolean(state?.semester?.isSpecial);
  const count = special ? added.size : students.length - leftOut.size;
  const intakes = useMemo(() => intakeFilterOptions(students.map(student => student.intake)), [students]);
  const inIntake = useMemo(() => students.filter(student => matchesIntake(student.intake, intake)), [students, intake]);
  const programmes = useMemo(() => {
    const groups = new Map<string, MoveStudent[]>();
    for (const student of inIntake) groups.set(student.programme, [...(groups.get(student.programme) ?? []), student]);
    return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second));
  }, [inIntake]);
  const results = useMemo(() => findStudents(inIntake, query).filter(student => !leftOut.has(student.matric)).slice(0, 5), [inIntake, query, leftOut]);
  const specialShown = special ? filterPeople(students, { programme, intake, query }) : [];
  const allSpecialTicked = specialShown.length > 0 && specialShown.every(student => added.has(student.matric));
  const allIntakeOut = inIntake.length > 0 && inIntake.every(student => leftOut.has(student.matric));

  const flip = (matric: string) => {
    setLeftOut(current => {
      const next = new Set(current);
      if (next.has(matric)) next.delete(matric);
      else next.add(matric);
      return next;
    });
    setQuery('');
  };

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

  const leaveOutIntake = () => setLeftOut(current => {
    const next = new Set(current);
    for (const student of inIntake) {
      if (allIntakeOut) next.delete(student.matric);
      else next.add(student.matric);
    }
    return next;
  });

  const update = async () => {
    if (!state?.semester) return;
    setBusy(true);
    setProblem(null);
    try {
      const matrics = special ? [...added] : students.filter(student => !leftOut.has(student.matric)).map(student => student.matric);
      setDone(await moveStudents(state.semester.id, matrics));
    } catch (err) {
      setProblem(errorText(err, 'Could not update the students.'));
    } finally {
      setBusy(false);
    }
  };

  const page = (children: React.ReactNode) => (
    <RecordPage
      title="Update current semester"
      backLabel="Back to Student Registry"
      onBack={() => navigate(APP_ROUTES.registry)}
      dirty={!done && (leftOut.size > 0 || added.size > 0)}
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
      {state.deferred > 0 && (
        <p className="flex items-start gap-2 text-[13px] text-slate-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {studentCount(state.deferred)} on deferment. This semester counts as leave for them.
        </p>
      )}
    </>
  );

  if (students.length === 0) {
    return page(
      <div className="space-y-3">
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-[14px] font-semibold text-slate-700">
          Every Active student is already on {shortSemester(state.semester.label)}.
        </p>
        {notes}
      </div>,
    );
  }

  const shown = open ? (programmes.find(([name]) => name === open)?.[1] ?? []) : [];

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
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[44px] font-black leading-none tracking-tight text-brand-navy tabular-nums">{count}</span>
            <span className="text-[17px] font-bold text-slate-900">{count === 1 ? 'student' : 'students'}</span>
          </p>
          {!special && (
            <PortalButton variant="primary" size="lg" className="w-full sm:w-auto" isLoading={busy} disabled={count === 0} onClick={() => void update()}>
              Update {studentCount(count)}
            </PortalButton>
          )}
        </div>
        {problem && !special && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </section>

      {!special && (
        <>
          {intakes.length > 1 && (
            <div className="flex flex-wrap items-center gap-3">
              <SelectMenu
                variant="filter"
                prefix="Intake"
                aria-label="Filter by intake"
                value={intake}
                options={[{ value: 'All', label: 'All intakes', triggerLabel: 'All' }, ...intakes]}
                disabled={busy}
                onChange={value => { setIntake(value); setOpen(null); }}
              />
              {intake !== 'All' && (
                <button type="button" disabled={busy} className="text-[13px] font-bold text-blue-700 hover:text-blue-900 cursor-pointer" onClick={leaveOutIntake}>
                  {allIntakeOut ? `Put all ${inIntake.length} back` : `Leave out all ${inIntake.length}`}
                </button>
              )}
            </div>
          )}
          <div className="grid gap-3.5 md:grid-cols-3">
            {programmes.map(([name, group], index) => {
              const out = group.filter(student => leftOut.has(student.matric)).length;
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
                    {out ? `${out} left out` : 'See who'} <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
          {open && (
            <section aria-label={`Students in ${shortProgramme(open)}`} className="app-card space-y-3 p-5 sm:p-6">
              <ul className="divide-y divide-slate-100">
                {(showAll ? shown : shown.slice(0, FIRST_ROWS)).map(student => (
                  <PersonRow
                    key={student.matric}
                    person={student}
                    muted={leftOut.has(student.matric)}
                    action={(
                      <button type="button" disabled={busy} className={`text-[13px] font-bold ${leftOut.has(student.matric) ? 'text-slate-500 hover:text-slate-700' : 'text-blue-700 hover:text-blue-900'}`} onClick={() => flip(student.matric)}>
                        {leftOut.has(student.matric) ? 'Put back' : 'Leave out'}
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
          <section aria-label="Leave someone out" className="app-card space-y-4 p-5 sm:p-6">
            <h3 className="text-[15.5px] font-extrabold text-brand-navy">Leave someone out</h3>
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
                  {results.map(student => (
                    <PersonRow key={student.matric} person={student} action={<PortalButton size="sm" disabled={busy} onClick={() => flip(student.matric)}>Leave out</PortalButton>} />
                  ))}
                </ul>
              ) : <p className="text-[13px] text-slate-500">Nobody found.</p>
            )}
            {leftOut.size > 0 && (
              <ul aria-label="Left out" className="flex flex-wrap gap-2">
                {students.filter(student => leftOut.has(student.matric)).map(student => (
                  <li key={student.matric} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-2 text-[13px] font-semibold text-slate-800">
                    {student.name}
                    <button type="button" aria-label={`Put ${student.name} back`} disabled={busy} className="rounded-full px-1 text-slate-500 hover:text-slate-800" onClick={() => flip(student.matric)}>&times;</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {special && (
        <section aria-label="Who is taking the Special Semester" className="app-card">
          <div className="space-y-3 p-5 sm:p-6">
            <h3 className="text-[15.5px] font-extrabold text-brand-navy">Who is taking the Special Semester?</h3>
            <PeopleFilters people={students} programme={programme} intake={intake} query={query} onProgramme={setProgramme} onIntake={setIntake} onQuery={setQuery} disabled={busy} />
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
      )}

      {notes}

      {special && added.size > 0 && (
        <SelectionBar
          count={added.size}
          label={`Update ${studentCount(added.size)}`}
          busy={busy}
          problem={problem}
          onClear={() => setAdded(new Set())}
          onAction={() => void update()}
        />
      )}
    </div>,
  );
};
