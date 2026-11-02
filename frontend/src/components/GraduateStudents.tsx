/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, Check, CircleX, Info } from 'lucide-react';
import type { GraduationItem, GraduationListCheck, GraduationOverview, GraduationResult, GraduationStudent } from '../services/registrySemestersApi';
import { checkGraduationList, getGraduationOverview, graduateStudents } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { fixLink, parseMatricList, studentCount } from '../utils/registrySemesters';
import { PortalButton } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { ImportSteps } from './RegistryImportMatch';
import { PersonRow } from './RegistryPersonRow';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const STEPS = ['Senate list', 'Check', 'Confirm'] as const;
const FIRST_UNFINISHED = 4;

const ItemLines: React.FC<{ student: GraduationStudent; items: GraduationItem[]; tone: 'amber' | 'rose' }> = ({ student, items, tone }) => (
  <ul className={`mt-1 space-y-0.5 text-[12.5px] font-semibold ${tone === 'rose' ? 'text-rose-700' : 'text-amber-800'}`}>
    {items.map(item => {
      const link = fixLink(item, student.matric);
      return (
        <li key={`${item.code}:${item.recordId ?? ''}`}>
          {item.text}{' '}
          {link && <Link to={link.to} className="font-bold text-blue-700 hover:text-blue-900">{link.label}</Link>}
        </li>
      );
    })}
  </ul>
);

const SectionHead: React.FC<{ tone: 'green' | 'amber' | 'rose'; icon: typeof Check; title: string; note: string }> = ({ tone, icon: Icon, title, note }) => {
  const colours = { green: 'bg-emerald-50 text-emerald-600 border-emerald-100', amber: 'bg-amber-50 text-amber-600 border-amber-100', rose: 'bg-rose-50 text-rose-600 border-rose-100' };
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colours[tone]}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <div className="min-w-0">
        <h3 className="text-[15.5px] font-extrabold text-brand-navy">{title}</h3>
        <p className="text-[13px] text-slate-500">{note}</p>
      </div>
    </div>
  );
};

/** Graduate the students on the Senate's list, one step at a time, because it can't be undone. */
export const GraduateStudents: React.FC = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<GraduationOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [found, setFound] = useState<GraduationListCheck | null>(null);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [showUnfinished, setShowUnfinished] = useState(false);
  const [showReady, setShowReady] = useState(false);
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

  const chosenFromCheck = found?.check.filter(student => included.has(student.matric)) ?? [];
  const going = [...(found?.ready ?? []), ...chosenFromCheck];

  const check = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setFound(await checkGraduationList(parseMatricList(text)));
      setIncluded(new Set());
      setShowReady(false);
      setStep(1);
    } catch (err) {
      setProblem(errorText(err, 'Could not check this list.'));
    } finally {
      setBusy(false);
    }
  };

  const graduate = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setResult(await graduateStudents({
        matrics: going.map(student => student.matric),
        earlyApproved: chosenFromCheck.filter(student => student.early).map(student => student.matric),
        reason: reason.trim(),
      }));
    } catch (err) {
      setProblem(errorText(err, 'Could not graduate these students.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleIncluded = (matric: string, on: boolean) => setIncluded(current => {
    const next = new Set(current);
    if (on) next.add(matric);
    else next.delete(matric);
    return next;
  });

  const page = (children: React.ReactNode) => (
    <RecordPage
      title="Graduate students"
      subtitle="The portal can't see CGPA or credits, so the Senate's list is your proof."
      backLabel="Back to Student Registry"
      onBack={() => navigate(APP_ROUTES.registry)}
      dirty={!result && (step > 0 || Boolean(text.trim()))}
      busy={busy}
    >
      <div className="space-y-5">
        {!result && <ImportSteps current={step} steps={STEPS} label="Graduation steps" />}
        {children}
      </div>
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

  if (step === 0) {
    const unfinished = [...overview.stop, ...overview.check];
    const shown = showUnfinished ? unfinished : unfinished.slice(0, FIRST_UNFINISHED);
    return page(
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <section aria-label="Senate list" className="app-card space-y-4 p-5 sm:p-6">
          <div>
            <h3 className="text-[15.5px] font-extrabold text-brand-navy">Who is on the Senate's list?</h3>
            <p className="mt-0.5 text-[13.5px] text-slate-500">Paste their matric numbers from Excel or the Senate's letter.</p>
          </div>
          <textarea
            aria-label="Matric numbers"
            className="form-control min-h-40 px-3.5 py-3 font-mono text-[13px] leading-relaxed"
            placeholder={'25990011\n25990012\n25990013'}
            value={text}
            disabled={busy}
            onChange={event => setText(event.target.value)}
          />
          {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
          <div className="flex justify-end">
            <PortalButton variant="primary" className="w-full sm:w-auto" isLoading={busy} disabled={!text.trim()} onClick={() => void check()}>Check these students</PortalButton>
          </div>
        </section>
        <section aria-label="Still unfinished" className="app-card space-y-4 p-5 sm:p-6">
          <div>
            <h3 className="text-[15.5px] font-extrabold text-brand-navy">Still unfinished</h3>
            <p className="mt-0.5 text-[13.5px] text-slate-500">
              {unfinished.length
                ? `${studentCount(unfinished.length)} who reached the minimum still ${unfinished.length === 1 ? 'has' : 'have'} something to sort out.`
                : 'Nothing is unfinished for students who reached the minimum.'}
            </p>
          </div>
          {shown.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {shown.map(student => (
                <PersonRow key={student.matric} person={student} detail={<ItemLines student={student} items={student.items} tone={student.group === 'stop' ? 'rose' : 'amber'} />} />
              ))}
            </ul>
          )}
          {!showUnfinished && unfinished.length > FIRST_UNFINISHED && (
            <button type="button" className="text-[13px] font-bold text-blue-700 hover:text-blue-900" onClick={() => setShowUnfinished(true)}>See all {unfinished.length}</button>
          )}
          {overview.tooEarly > 0 && (
            <p className="flex items-start gap-2 text-[12.5px] text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {studentCount(overview.tooEarly)} 2 or more semesters below the minimum {overview.tooEarly === 1 ? "isn't" : "aren't"} listed.
            </p>
          )}
        </section>
      </div>,
    );
  }

  if (step === 1 && found) {
    const total = found.ready.length + found.check.length + found.stop.length + found.notFound.length + found.notActive.length;
    return page(
      <>
        <div>
          <h3 className="text-[22px] font-extrabold tracking-tight text-brand-navy">Here is what we found</h3>
          <p className="mt-0.5 text-[14px] text-slate-500">We checked {total} matric {total === 1 ? 'number' : 'numbers'} from your list.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Ready', count: found.ready.length, icon: Check, tone: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
            { label: 'Check first', count: found.check.length, icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600 border-amber-100' },
            { label: "Can't graduate yet", count: found.stop.length, icon: CircleX, tone: 'bg-rose-50 text-rose-600 border-rose-100' },
          ].map(({ label, count, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span>
                <span className="block text-[22px] font-extrabold leading-tight text-brand-navy tabular-nums">{count}</span>
                <span className="block text-[12.5px] font-semibold text-slate-500">{label}</span>
              </span>
            </div>
          ))}
        </div>
        {found.check.length > 0 && (
          <section aria-label="Check first" className="app-card space-y-4 p-5 sm:p-6">
            <SectionHead tone="amber" icon={AlertTriangle} title="Check first" note="They only graduate if you tick them." />
            <ul className="divide-y divide-slate-100">
              {found.check.map(student => (
                <PersonRow
                  key={student.matric}
                  person={student}
                  detail={<ItemLines student={student} items={student.items} tone="amber" />}
                  action={(
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-slate-800">
                      <input type="checkbox" className="h-4 w-4" checked={included.has(student.matric)} onChange={event => toggleIncluded(student.matric, event.target.checked)} />
                      {student.early ? 'Approved to finish early' : 'Include'}
                    </label>
                  )}
                />
              ))}
            </ul>
          </section>
        )}
        {found.stop.length > 0 && (
          <section aria-label="Can't graduate yet" className="app-card space-y-4 p-5 sm:p-6">
            <SectionHead tone="rose" icon={CircleX} title="Can't graduate yet" note="They will be left out. Sort these out first." />
            <ul className="divide-y divide-slate-100">
              {found.stop.map(student => (
                <PersonRow key={student.matric} person={student} detail={<ItemLines student={student} items={student.items.filter(item => item.level === 'stop')} tone="rose" />} />
              ))}
            </ul>
          </section>
        )}
        {found.ready.length > 0 && (
          <section aria-label="Ready" className="app-card space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHead tone="green" icon={Check} title="Ready" note="Nothing unfinished." />
              <button type="button" aria-expanded={showReady} className="text-[13px] font-bold text-blue-700 hover:text-blue-900" onClick={() => setShowReady(value => !value)}>
                {showReady ? 'Hide names' : 'Show names'}
              </button>
            </div>
            {showReady && <ul className="divide-y divide-slate-100">{found.ready.map(student => <PersonRow key={student.matric} person={student} />)}</ul>}
          </section>
        )}
        {(found.notFound.length > 0 || found.notActive.length > 0) && (
          <div className="space-y-1 text-[13px] text-slate-500">
            {found.notFound.length > 0 && <p className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Not found in the portal: {found.notFound.join(', ')}.</p>}
            {found.notActive.map(student => <p key={student.matric} className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{student.name} is already {student.status}.</p>)}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PortalButton onClick={() => setStep(0)}>Back</PortalButton>
          <PortalButton variant="primary" className="w-full sm:w-auto" disabled={going.length === 0} onClick={() => { setProblem(null); setStep(2); }}>Continue with {studentCount(going.length)}</PortalButton>
        </div>
      </>,
    );
  }

  return page(
    <>
      <section aria-label="Confirm" className="app-card space-y-5 p-5 sm:p-6">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[44px] font-black leading-none tracking-tight text-brand-navy tabular-nums">{going.length}</span>
          <span className="text-[17px] font-bold text-slate-900">{going.length === 1 ? 'student' : 'students'} will graduate</span>
        </p>
        <ul aria-label="Students" className="flex flex-wrap gap-2">
          {going.map(student => <li key={student.matric} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[13px] font-semibold text-slate-800">{student.name}</li>)}
        </ul>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-bold text-slate-700">Reason</span>
          <input
            className="form-control form-control-md"
            maxLength={1000}
            placeholder="For example: Senate meeting, 12 March 2027"
            value={reason}
            disabled={busy}
            onChange={event => setReason(event.target.value)}
          />
          <span className="block text-[12.5px] text-slate-500">Saved on each student's history.</span>
        </label>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] font-semibold text-amber-900">
          This can't be undone in the portal. Their supervisor and panel appointments end as Completed, and each student gets a notice.
        </p>
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PortalButton disabled={busy} onClick={() => setStep(1)}>Back</PortalButton>
        <PortalButton variant="primary" size="lg" className="w-full sm:w-auto" isLoading={busy} disabled={!reason.trim() || going.length === 0} onClick={() => void graduate()}>
          Graduate {studentCount(going.length)}
        </PortalButton>
      </div>
    </>,
  );
};
