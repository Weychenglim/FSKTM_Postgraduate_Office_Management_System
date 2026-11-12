/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, ChevronDown, Upload } from 'lucide-react';
import type { GraduationItem, GraduationOverview, GraduationStudent, SenateListMatch, StepResult, WaitingStudent } from '../services/registrySemestersApi';
import { finishStudents, getGraduationOverview, matchSenateList, recordSenateDecision, returnToActive } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { filterPeople, fixLink, shortSemester, studentCount } from '../utils/registrySemesters';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { PeopleFilters, PersonRow, PersonTickRow, SelectionBar } from './RegistryPersonRow';
import { SelectMenu } from './SelectMenu';
import { DateField } from './DateFields';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const FIRST_NAMES = 6;
const today = () => new Date().toLocaleDateString('en-CA');
type Tab = 'finished' | 'senate';
type View = 'all' | 'ready' | 'check';
type Done = { title: string; result: StepResult };

const ItemLines: React.FC<{ matric: string; items: GraduationItem[]; tone: 'amber' | 'rose' }> = ({ matric, items, tone }) => (
  <ul className={`mt-1 space-y-0.5 text-[12.5px] font-semibold ${tone === 'rose' ? 'text-rose-700' : 'text-amber-800'}`}>
    {items.map(item => {
      const link = fixLink(item, matric);
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

const NameGrid: React.FC<{ people: Array<{ matric: string; name: string }> }> = ({ people }) => (
  <ol aria-label="Students" className="grid list-decimal gap-x-8 gap-y-1 pl-5 text-[13.5px] font-semibold text-slate-800 sm:grid-cols-2">
    {people.map(person => (
      <li key={person.matric}>
        {person.name} <span className="font-mono text-[12px] font-medium text-slate-500">{person.matric}</span>
      </li>
    ))}
  </ol>
);

/** Step one marks who has finished. Step two records what the Senate approved. Nobody starts ticked, because the portal can't see CGPA or credits. */
export const RecordGraduations: React.FC = () => {
  const navigate = useNavigate();
  const titleId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [overview, setOverview] = useState<GraduationOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>('all');
  const [programme, setProgramme] = useState('All');
  const [intake, setIntake] = useState('All');
  const [query, setQuery] = useState('');
  const [showStopped, setShowStopped] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lastSemester, setLastSemester] = useState('');
  const [senateDate, setSenateDate] = useState('');
  const [reference, setReference] = useState('');
  const [returning, setReturning] = useState<WaitingStudent | null>(null);
  const [reason, setReason] = useState('');
  const [match, setMatch] = useState<SenateListMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getGraduationOverview()
      .then(data => { if (!cancelled) setOverview(data); })
      .catch(err => { if (!cancelled) setLoadError(errorText(err, 'Could not load the students.')); });
    return () => { cancelled = true; };
  }, [reload]);

  const tab: Tab = chosenTab ?? (overview?.waiting.length ? 'senate' : 'finished');
  const everyone = useMemo(() => [...(overview?.ready ?? []), ...(overview?.check ?? [])].sort((a, b) => Number(Boolean(b.onP2)) - Number(Boolean(a.onP2))), [overview]);
  const waiting = useMemo(() => overview?.waiting ?? [], [overview]);
  const lastOptions = useMemo(() => (overview?.lastSemesters ?? []).map(row => ({ value: `${row.session}|${row.term}`, label: shortSemester(row.label) })), [overview]);
  const lastValue = lastSemester || lastOptions[0]?.value || '';
  const filters = { programme, intake, query };
  const matching = filterPeople(everyone, filters);
  const stopped = filterPeople(overview?.stop ?? [], filters);
  const shown = view === 'all' ? matching : matching.filter(student => student.group === view);
  const waitingShown = filterPeople(waiting, filters);
  const finishing = everyone.filter(student => picked.has(student.matric));
  const graduating = waiting.filter(student => picked.has(student.matric));
  const going = tab === 'finished' ? finishing : graduating;
  const early = finishing.filter(student => student.early);
  const unfinished = finishing.filter(student => student.group === 'check' && !student.early);

  const toggle = (matric: string, on: boolean) => setPicked(current => {
    const next = new Set(current);
    if (on) next.add(matric);
    else next.delete(matric);
    return next;
  });

  const switchTab = (next: Tab) => {
    setChosenTab(next);
    setPicked(new Set());
    setMatch(null);
    setProblem(null);
  };

  const again = () => {
    setDone(null);
    setPicked(new Set());
    setMatch(null);
    setReference('');
    setSenateDate('');
    setReload(value => value + 1);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await action();
    } catch (err) {
      setProblem(errorText(err, 'Could not save this.'));
    } finally {
      setBusy(false);
    }
  };

  const markFinished = () => run(async () => {
    const [lastSession, lastTerm] = lastValue.split('|');
    const result = await finishStudents({ matrics: finishing.map(student => student.matric), earlyApproved: early.map(student => student.matric), lastSession, lastTerm });
    setConfirming(false);
    setDone({ title: `${studentCount(result.finished?.length ?? 0)} marked as finished`, result });
  });

  const recordDecision = () => run(async () => {
    const result = await recordSenateDecision({ matrics: graduating.map(student => student.matric), decidedOn: senateDate, reference: reference.trim() });
    setConfirming(false);
    setDone({ title: `${studentCount(result.graduated?.length ?? 0)} graduated`, result });
  });

  const sendBack = () => run(async () => {
    if (!returning) return;
    await returnToActive({ matrics: [returning.matric], reason: reason.trim() });
    setReturning(null);
    setReason('');
    toggle(returning.matric, false);
    setReload(value => value + 1);
  });

  const readSenateList = (file: File) => run(async () => {
    const found = await matchSenateList(file);
    setMatch(found);
    setPicked(new Set(found.matched));
  });

  const page = (children: React.ReactNode) => (
    <RecordPage title="Graduation" backLabel="Back to Student Registry" onBack={() => navigate(APP_ROUTES.registry)} dirty={!done && picked.size > 0} busy={busy}>
      {children}
    </RecordPage>
  );

  if (loadError) return page(<ErrorState message={loadError} onRetry={() => setReload(value => value + 1)} />);
  if (!overview) return page(<LoadingState message="Loading the students..." />);

  if (done) {
    const names = [...(done.result.finished ?? []), ...(done.result.graduated ?? [])];
    return page(
      <section aria-label="Result" className="app-card space-y-4 p-6">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-7 w-7" aria-hidden="true" /></span>
          <h3 className="text-[20px] font-extrabold text-brand-navy">{done.title}</h3>
          <p className="text-[13.5px] text-slate-500">{names.map(student => student.name).join(', ')}</p>
        </div>
        {done.result.skipped.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[13.5px] font-extrabold text-amber-900">{studentCount(done.result.skipped.length)} skipped</p>
            <ul className="mt-1 space-y-0.5 text-[13px] text-amber-900">
              {done.result.skipped.map(student => <li key={student.matric}>{student.name || student.matric}: {student.why}</li>)}
            </ul>
          </div>
        )}
        <div className="flex justify-center"><PortalButton onClick={again}>Done</PortalButton></div>
      </section>,
    );
  }

  const tooEarly = overview.tooEarly > 0 && <p className="text-[13px] text-slate-500">{studentCount(overview.tooEarly)} too early to finish.</p>;
  const tabs: Array<[Tab, string, number]> = [['finished', 'Finished studies', everyone.length], ['senate', 'Senate decision', waiting.length]];
  const pills: Array<[View, string, number]> = [
    ['all', 'All', matching.length],
    ['ready', 'Ready', matching.filter(student => student.group === 'ready').length],
    ['check', 'Check first', matching.filter(student => student.group === 'check').length],
  ];
  const canRecord = tab === 'finished' ? Boolean(lastValue) : Boolean(senateDate);

  return page(
    <div className="space-y-5">
      <div role="group" aria-label="Step" className="flex flex-wrap gap-2">
        {tabs.map(([value, label, count]) => (
          <button key={value} type="button" aria-pressed={tab === value} onClick={() => switchTab(value)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[13.5px] font-extrabold transition cursor-pointer ${tab === value ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
            {label}
            <span className={tab === value ? 'text-white/70' : 'text-slate-400'}>{count}</span>
          </button>
        ))}
      </div>

      {tab === 'finished' ? (
        <section aria-label="Students who can be marked as finished" className="app-card">
          <div className="space-y-3 p-5 sm:p-6">
            <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
              {pills.map(([value, label, count]) => (
                <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition cursor-pointer ${view === value ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {label}
                  <span className={view === value ? 'text-white/70' : 'text-slate-400'}>{count}</span>
                </button>
              ))}
            </div>
            <PeopleFilters people={[...everyone, ...overview.stop]} programme={programme} intake={intake} query={query} onProgramme={setProgramme} onIntake={setIntake} onQuery={setQuery} />
          </div>
          {shown.length ? (
            <ul aria-label="Students" className="divide-y divide-slate-100 border-t border-slate-200">
              {shown.map(student => (
                <PersonTickRow
                  key={student.matric}
                  person={student}
                  checked={picked.has(student.matric)}
                  onChange={on => toggle(student.matric, on)}
                  detail={student.group === 'check' ? <ItemLines matric={student.matric} items={student.items} tone="amber" /> : undefined}
                  badge={student.onP2 ? <StatusBadge tone="info">On P2</StatusBadge> : <StatusBadge tone={student.group === 'ready' ? 'success' : 'warning'}>{student.group === 'ready' ? 'Ready' : 'Check first'}</StatusBadge>}
                />
              ))}
            </ul>
          ) : <p className="px-6 py-10 text-center text-[13px] font-semibold text-slate-400">Nobody here.</p>}
          {stopped.length > 0 && (
            <div className="border-t border-slate-200">
              <button type="button" aria-expanded={showStopped} onClick={() => setShowStopped(value => !value)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-[13px] font-bold text-brand-navy hover:bg-slate-50 sm:px-6 cursor-pointer">
                {studentCount(stopped.length)} can't finish yet
                <ChevronDown className={`h-4 w-4 transition ${showStopped ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {showStopped && (
                <ul className="divide-y divide-slate-100 px-5 pb-4 sm:px-6">
                  {stopped.map(student => <PersonRow key={student.matric} person={student} detail={<ItemLines matric={student.matric} items={student.items.filter(item => item.level === 'stop')} tone="rose" />} />)}
                </ul>
              )}
            </div>
          )}
          {tooEarly && <div className="border-t border-slate-200 px-5 py-3 sm:px-6">{tooEarly}</div>}
        </section>
      ) : (
        <section aria-label="Students waiting for the Senate" className="app-card">
          <div className="space-y-3 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PeopleFilters people={waiting} programme={programme} intake={intake} query={query} onProgramme={setProgramme} onIntake={setIntake} onQuery={setQuery} />
              <PortalButton size="sm" icon={Upload} isLoading={busy} disabled={waiting.length === 0} onClick={() => fileInput.current?.click()}>Use the Senate's list</PortalButton>
              <input ref={fileInput} type="file" accept=".xlsx,.csv,.pdf" className="hidden" aria-label="The Senate's list" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readSenateList(file); }} />
            </div>
            {match && (
              <div role="status" className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] font-semibold text-blue-900">
                <p>{studentCount(match.matched.length)} ticked from the list.</p>
                {match.notWaiting.length > 0 && <p className="text-amber-800">Not waiting for the Senate: {match.notWaiting.map(row => `${row.name} (${row.status})`).join(', ')}.</p>}
                {match.notFound.length > 0 && <p className="text-amber-800">Not found in the portal: {match.notFound.join(', ')}.</p>}
              </div>
            )}
            {problem && !confirming && !returning && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
          </div>
          {waitingShown.length ? (
            <ul aria-label="Students" className="divide-y divide-slate-100 border-t border-slate-200">
              {waitingShown.map(student => (
                <PersonTickRow
                  key={student.matric}
                  person={student}
                  checked={picked.has(student.matric)}
                  onChange={on => toggle(student.matric, on)}
                  detail={<>
                    <p className="mt-0.5 text-[12.5px] text-slate-500">Last semester: {shortSemester(student.lastSemester)}</p>
                    {student.items.length > 0 && <ItemLines matric={student.matric} items={student.items} tone="rose" />}
                  </>}
                  badge={<button type="button" className="text-[13px] font-bold text-blue-700 hover:text-blue-900" onClick={event => { event.preventDefault(); setProblem(null); setReason(''); setReturning(student); }}>Back to Active</button>}
                />
              ))}
            </ul>
          ) : <p className="border-t border-slate-200 px-6 py-10 text-center text-[13px] font-semibold text-slate-400">Nobody is waiting for the Senate.</p>}
        </section>
      )}

      {picked.size > 0 && (
        <SelectionBar
          count={picked.size}
          label={tab === 'finished' ? `Mark ${picked.size} as finished` : `Record ${picked.size} ${picked.size === 1 ? 'graduation' : 'graduations'}`}
          onClear={() => { setPicked(new Set()); setMatch(null); }}
          onAction={() => { setProblem(null); setConfirming(true); }}
        />
      )}

      <DialogShell
        title={tab === 'finished' ? `Mark ${studentCount(going.length)} as finished?` : `Record ${studentCount(going.length)} as graduated?`}
        titleId={titleId}
        isOpen={confirming}
        busy={busy}
        onClose={() => setConfirming(false)}
        footer={<>
          <PortalButton disabled={busy} onClick={() => setConfirming(false)}>Cancel</PortalButton>
          <PortalButton variant="primary" isLoading={busy} disabled={!canRecord} onClick={() => void (tab === 'finished' ? markFinished() : recordDecision())}>
            {tab === 'finished' ? 'Mark as finished' : 'Record as graduated'}
          </PortalButton>
        </>}
      >
        <NameGrid people={going} />
        {tab === 'finished' ? (
          <>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
              Last semester
              <SelectMenu value={lastValue} options={lastOptions} onChange={setLastSemester} disabled={busy} aria-label="Last semester" />
            </label>
            {(early.length > 0 || unfinished.length > 0) && (
              <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900">
                {early.length > 0 && <p>Approved to finish early: {nameList(early)}.</p>}
                {unfinished.length > 0 && <p>Not everything finished: {nameList(unfinished)}.</p>}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[13.5px] text-slate-600">Their supervisor and panel appointments will close, and each student will get a notice.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
                Senate date
                <DateField max={today()} value={senateDate} disabled={busy} onChange={setSenateDate} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
                Meeting reference
                <input className="form-control form-control-md" maxLength={120} value={reference} disabled={busy} onChange={event => setReference(event.target.value)} />
              </label>
            </div>
          </>
        )}
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>

      <DialogShell
        title={`Move ${returning?.name ?? ''} back to Active?`}
        titleId={`${titleId}-back`}
        isOpen={returning !== null}
        busy={busy}
        onClose={() => setReturning(null)}
        footer={<>
          <PortalButton disabled={busy} onClick={() => setReturning(null)}>Cancel</PortalButton>
          <PortalButton variant="primary" isLoading={busy} disabled={!reason.trim()} onClick={() => void sendBack()}>Back to Active</PortalButton>
        </>}
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
          Reason
          <input className="form-control form-control-md" maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} />
        </label>
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
    </div>,
  );
};
