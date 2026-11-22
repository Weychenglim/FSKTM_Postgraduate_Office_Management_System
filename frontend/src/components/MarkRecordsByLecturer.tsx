import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { APP_ROUTES } from '../constants/routes';
import { getEvaluationRecipientPreview } from '../services/marksApi';
import type { EvaluationRecipientPreview, MarkRecord, MarkRecordPeriod } from '../types';
import { shortAssessmentLabel } from '../utils/assessment';
import { buildLecturerMarkProgress, lecturerTaskCounts, type LecturerMarkPeriod } from '../utils/markLecturerProgress';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import { formatPeriodStatus } from '../utils/marksProductionManagement';
import { PageHeader, PortalButton, StatusBadge } from './PortalPrimitives';
import { SelectMenu } from './SelectMenu';
import { WorkspacePagination, WORKSPACE_PAGE_SIZE } from './RequestWorkspacePrimitives';

const periodLabel = (period: MarkRecordPeriod) => `${period.assessment ? `${shortAssessmentLabel(period.assessment)} · ` : ''}${period.name}`;
const isCurrentPeriod = (period: MarkRecordPeriod) => ['OPEN', 'SCHEDULED'].includes(period.effectiveStatus);
const roleLabels = { SUPERVISOR: 'Supervision', PANEL: 'Panel' };
const actionClass = 'inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-brand-navy hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600';
const attentionOrder = ['Task missing', 'Overdue', 'Stage review', 'Paused'];
const missingReasons: Record<string, string> = {
  MISSING_RESEARCH_PROFILE: 'Research profile needed',
  MISSING_SUPERVISOR_APPOINTMENT: 'Eligible supervisor needed',
  MISSING_PANEL_APPOINTMENT: 'Eligible panel member needed',
};

function LecturerPeriodDetails({ group, choices, onSelectPeriod, checked, taskPage, onPage, onViewRecord }: {
  group: LecturerMarkPeriod; checked: boolean; taskPage: number; onPage: (page: number) => void;
  choices: LecturerMarkPeriod[]; onSelectPeriod: (id: string) => void;
  onViewRecord: (id: string) => void;
}) {
  const tasks = [...group.tasks.values()];
  const rank = (status: string) => attentionOrder.includes(status) ? attentionOrder.indexOf(status) : attentionOrder.length;
  tasks.sort((a, b) => rank(a.status) - rank(b.status) || a.studentName.localeCompare(b.studentName));
  const { submitted, total } = lecturerTaskCounts(tasks);
  const { period } = group;
  const holds = tasks.filter(task => task.status === 'Stage review' && !task.countsTowardsProgress).length;
  const paused = tasks.filter(task => task.status === 'Paused').length;
  const totalPages = Math.ceil(tasks.length / WORKSPACE_PAGE_SIZE);
  const page = Math.min(taskPage, totalPages);
  const start = (page - 1) * WORKSPACE_PAGE_SIZE;
  const tableRegion = useRef<HTMLDivElement>(null);
  const changePage = (next: number) => {
    onPage(next);
    tableRegion.current?.focus();
  };
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-3xs" aria-label="Mark entry tasks">
    <header className="grid gap-6 border-b border-slate-200 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.55fr)] xl:gap-10">
      <div className="min-w-0 space-y-6">
        <div className="max-w-lg space-y-2">
          <label htmlFor="lecturer-mark-entry-period" className="block text-sm font-medium text-slate-600">Mark entry period</label>
          <SelectMenu id="lecturer-mark-entry-period" aria-label="Mark entry period" value={String(period.id)} size="md" showSelectedDescription={false}
            className="min-h-11 w-full bg-white font-semibold text-brand-navy" onChange={onSelectPeriod} options={choices.map(({ period: choice }) => ({
              value: String(choice.id), label: choice.name,
              description: [shortAssessmentLabel(choice.assessment), choice.semester, choice.closesAt && `Deadline ${formatMalaysiaDate(choice.closesAt)}`].filter(Boolean).join(' · '),
            }))} />
        </div>
        <dl className="grid max-w-lg grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5 border-t border-slate-200 pt-4 sm:gap-8">
          <div>
            <dt className="text-sm text-slate-600">Assessment</dt>
            <dd className="mt-2"><span className="inline-block rounded-md bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-800">{shortAssessmentLabel(period.assessment)}</span></dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Marking window</dt>
            <dd className="mt-2 text-sm font-semibold leading-7 text-brand-navy">{period.effectiveStatus === 'CLOSED' ? 'Marking period closed' : formatPeriodStatus(period.effectiveStatus)}</dd>
          </div>
        </dl>
      </div>
      <div className="min-w-0 self-start rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 sm:px-6 sm:py-5">
        <p className="text-sm font-medium text-slate-600">Submission progress</p>
        <p className="mt-2 text-sm font-medium text-slate-700"><strong className="text-2xl font-semibold tabular-nums text-brand-navy">{submitted} of {total}</strong> submitted</p>
        <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 empty:hidden">
          {(holds > 0 || paused > 0) && <p className="flex items-baseline gap-2 text-sm font-medium text-amber-900"><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber-600" /><span>{[
            holds ? `${holds} ${holds === 1 ? 'task' : 'tasks'} on hold for stage review` : '',
            paused ? `${paused} paused` : '',
          ].filter(Boolean).join(' · ')}</span></p>}
          {isCurrentPeriod(period) && !checked && <p className="text-xs text-slate-600">Generated tasks only</p>}
        </div>
      </div>
    </header>
    <div ref={tableRegion} role="region" aria-label={`Student tasks for ${period.name}`} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600">
      <table className="data-table min-w-[610px]">
        <thead className="bg-slate-50"><tr>{['Student', 'Role', 'Deadline', 'Status', 'Action'].map(label => <th key={label} scope="col" className="data-th">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{tasks.slice(start, start + WORKSPACE_PAGE_SIZE).map(({ recordId, ...task }) => <tr key={recordId ?? `${task.studentId}-${task.role}`}>
          <td className="data-td"><div className="font-semibold text-brand-navy">{task.studentName}</div><div className="mt-1 text-xs text-slate-600">{task.studentId}</div></td>
          <td className="data-td">{task.role ? roleLabels[task.role] : 'Evaluator'}</td>
          <td className="data-td whitespace-nowrap">{task.dueAt ? formatMalaysiaDate(task.dueAt) : '—'}</td>
          <td className="data-td"><StatusBadge tone={task.status === 'Submitted' ? 'success' : task.status === 'Overdue' ? 'danger' : attentionOrder.includes(task.status) ? 'warning' : 'neutral'}>
            {task.status === 'Closed unfinished' ? 'Unsubmitted at closure' : task.status}
          </StatusBadge></td>
          <td className="data-td whitespace-nowrap">{recordId ? <PortalButton size="sm" aria-label={`View marks for ${task.studentName}`} onClick={() => onViewRecord(recordId)}>View marks</PortalButton>
            : task.status === 'Task missing' ? <Link to={`${APP_ROUTES.marksTasks}?period=${period.id}`} className={actionClass}>Open task assignment</Link>
            : task.status === 'Stage review' ? <Link to={APP_ROUTES.dashboardWorkflowReconciliation} className={actionClass}>Open reconciliation</Link> : '—'}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {totalPages > 1 && <nav aria-label="Student task pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 md:px-6">
      <p role="status" className="text-sm tabular-nums text-slate-600">{start + 1}–{Math.min(start + WORKSPACE_PAGE_SIZE, tasks.length)} of {tasks.length} tasks</p>
      <div className="flex gap-2">
        <PortalButton size="sm" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</PortalButton>
        <PortalButton size="sm" disabled={page === totalPages} onClick={() => changePage(page + 1)}>Next</PortalButton>
      </div>
    </nav>}
  </section>;
}

export function MarkRecordsByLecturer({ records, periods, query, semester, programme, needsFollowUp, onViewRecord, periodOptionsUnavailable, onRetryPeriods }: {
  records: MarkRecord[]; periods: MarkRecordPeriod[]; query: string; semester: string; onViewRecord: (id: string) => void;
  programme: string; needsFollowUp: boolean;
  periodOptionsUnavailable: boolean; onRetryPeriods: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const lecturerId = params.get('lecturer');
  const page = Number(params.get('lecturerPage')) || 1;
  const backParams = new URLSearchParams(params);
  backParams.delete('lecturer');
  backParams.delete('taskPeriod');
  backParams.delete('taskPage');
  const backToLecturers = () => {
    if (state?.fromLecturerList) navigate(-1);
    else setParams(backParams, { replace: true, state });
  };
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => { if (lecturerId) heading.current?.querySelector('h1')?.focus(); }, [lecturerId]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; previews: EvaluationRecipientPreview[]; failed: boolean }>();
  const checkKey = periods.filter(isCurrentPeriod).map(period => period.id).join(',');
  const requestKey = `${attempt}:${checkKey}`;
  useEffect(() => {
    if (!checkKey) return;
    let cancelled = false;
    Promise.allSettled(checkKey.split(',').map(id => getEvaluationRecipientPreview(Number(id)))).then(results => {
      if (cancelled) return;
      const previews = results.flatMap(result => result.status === 'fulfilled' && !result.value.configurationIssues?.length ? [result.value] : []);
      setResult({ key: requestKey, previews, failed: previews.length !== results.length });
    });
    return () => { cancelled = true; };
  }, [checkKey, requestKey]);
  const current = result?.key === requestKey ? result : undefined;
  const checking = !!checkKey && !current;
  const previews = current?.previews;
  const checked = new Set(previews?.map(preview => preview.periodId));
  const allLecturers = useMemo(() => {
    const matches = (row: { programme: string }) => row.programme.trim().toLowerCase() === programme.toLowerCase();
    return buildLecturerMarkProgress(periods, programme ? records.filter(matches) : records,
      previews?.map(preview => programme ? { ...preview, recipients: preview.recipients.filter(matches) } : preview) ?? []);
  }, [periods, records, previews, programme]);
  const selected = allLecturers.find(lecturer => lecturer.id === lecturerId);
  const taskPeriods = [...selected?.periods.values() ?? []];
  const taskPeriod = taskPeriods.find(group => String(group.period.id) === params.get('taskPeriod')) ?? taskPeriods[0];
  const taskPage = Math.max(Math.trunc(Number(params.get('taskPage'))) || 1, 1);
  const setTaskView = (periodId: string, page: number) => {
    const next = new URLSearchParams(params);
    next.set('taskPeriod', periodId);
    if (page > 1) next.set('taskPage', String(page)); else next.delete('taskPage');
    setParams(next, { replace: true, state });
  };
  const lecturers = useMemo(() => allLecturers
    .filter(lecturer => lecturer.name.toLowerCase().includes(query.trim().toLowerCase()))
    .map(lecturer => {
      const tasks = [...lecturer.periods.values()].flatMap(group => [...group.tasks.values()]);
      const countStudents = (role: string) => new Set(tasks.filter(task => task.role === role && task.status !== 'Retired').map(task => task.studentId)).size;
      return { ...lecturer, supervision: countStudents('SUPERVISOR'), panel: countStudents('PANEL'), counts: lecturerTaskCounts(tasks) };
    })
    .filter(({ counts }) => !needsFollowUp || counts.missing + counts.overdue + counts.review > 0)
    .sort((a, b) => (b.counts.missing + b.counts.overdue + b.counts.review) - (a.counts.missing + a.counts.overdue + a.counts.review)
      || a.name.localeCompare(b.name)), [allLecturers, query, needsFollowUp]);
  const gapPeriods = previews?.flatMap(preview => {
    const assignments = preview.missingAssignments?.filter(row => !programme || row.programme.trim().toLowerCase() === programme.toLowerCase());
    return assignments?.length ? [{ periodId: preview.periodId, assignments }] : [];
  });
  const pages = Math.max(1, Math.ceil(lecturers.length / WORKSPACE_PAGE_SIZE));
  const currentPage = Math.min(Math.max(Math.trunc(page), 1), pages);
  const taskCheck = <>
    {checking && <p role="status" className="text-sm text-slate-600">Checking for missing tasks…</p>}
    {current?.failed && <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-amber-800">
      Some periods could not be checked for missing tasks. <PortalButton size="sm" onClick={() => setAttempt(value => value + 1)}>Retry task check</PortalButton>
    </div>}
  </>;
  if (lecturerId) return <div ref={heading} className="space-y-5">
    <PageHeader title={selected?.name ?? 'Lecturer tasks'} subtitle={[taskPeriod?.period.semester || semester || 'All semesters', programme].filter(Boolean).join(' · ')} backLabel="Back to lecturers" onBack={backToLecturers} />
    {periodOptionsUnavailable && <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-amber-800">Some evaluation periods could not be loaded. <PortalButton size="sm" onClick={onRetryPeriods}>Retry periods</PortalButton></p>}
    {taskCheck}
    {taskPeriod ? <LecturerPeriodDetails group={taskPeriod} choices={taskPeriods} onSelectPeriod={id => setTaskView(id, 1)} checked={checked.has(taskPeriod.period.id)} taskPage={taskPage}
      onPage={page => setTaskView(String(taskPeriod.period.id), page)} onViewRecord={onViewRecord} />
      : !checking && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No tasks for this lecturer in the selected periods.</p>}
  </div>;

  return <div className="space-y-4 border-t border-slate-100 px-5 py-4 md:px-6">
    {taskCheck}
    {!!gapPeriods?.length && <details className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold text-amber-900">Missing appointments or research profiles</summary>
      <div className="mt-2 max-h-64 space-y-3 overflow-y-auto text-slate-700">{gapPeriods.map(preview => {
        const period = periods.find(period => period.id === preview.periodId);
        return <section key={preview.periodId}>
          <h3 className="font-semibold">{period && periodLabel(period)}</h3>
          <ul className="mt-1 space-y-1">{preview.assignments.map(row => <li key={`${row.matricNo}-${row.reason}`}>
            {row.studentName} <span className="text-slate-600">({row.matricNo}) · {missingReasons[row.reason] ?? 'Check eligibility'}</span>
          </li>)}</ul>
        </section>;
      })}</div>
    </details>}
    {!lecturers.length && !checking && <p className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-600">
      {needsFollowUp && !current?.failed && !periodOptionsUnavailable ? 'No lecturers need follow-up in this view.' : 'No lecturer tasks match this view.'}
    </p>}
    {!!lecturers.length && <div role="region" aria-label="Lecturer task list" tabIndex={0} className="overflow-x-auto rounded-xl border border-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600">
      <table aria-label="Marking progress by lecturer" className="data-table min-w-[570px]">
        <thead className="bg-slate-50"><tr>
          <th scope="col" className="data-th w-[25%]">Lecturer</th>
          <th scope="col" className="data-th whitespace-nowrap">Supervisees</th>
          <th scope="col" className="data-th whitespace-nowrap">Panel students</th>
          <th scope="col" className="data-th w-[30%]">Task status</th>
          <th scope="col" className="data-th text-left">Action</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">{lecturers.slice((currentPage - 1) * WORKSPACE_PAGE_SIZE, currentPage * WORKSPACE_PAGE_SIZE).map(lecturer => {
          const { missing, overdue, review, paused, closed, submitted, total } = lecturer.counts;
          const detailParams = new URLSearchParams(backParams);
          detailParams.set('lecturer', lecturer.id);
          return <tr key={lecturer.id} className="hover:bg-slate-50/60">
            <th scope="row" className="data-td text-left font-semibold text-brand-navy">{lecturer.name}</th>
            <td className="data-td tabular-nums text-slate-700">{lecturer.supervision}</td>
            <td className="data-td tabular-nums text-slate-700">{lecturer.panel}</td>
            <td className="data-td"><div className="flex flex-wrap gap-1.5">
              {missing > 0 && <StatusBadge tone="warning">{missing} {missing === 1 ? 'task' : 'tasks'} missing</StatusBadge>}
              {overdue > 0 && <StatusBadge tone="danger">{overdue} overdue</StatusBadge>}
              {review > 0 && <StatusBadge tone="warning">{review} {review === 1 ? 'needs' : 'need'} stage review</StatusBadge>}
              {paused > 0 && <StatusBadge tone="neutral">{paused} paused</StatusBadge>}
              {closed > 0 && <StatusBadge tone="neutral">{closed} unsubmitted at closure</StatusBadge>}
              {!missing && !overdue && !review && !paused && !closed && (
                checking ? <StatusBadge tone="neutral">Checking tasks</StatusBadge>
                  : current?.failed || periodOptionsUnavailable ? <StatusBadge tone="neutral">Check incomplete</StatusBadge>
                  : total === 0 ? <StatusBadge tone="neutral">No active tasks</StatusBadge>
                  : submitted === total ? <StatusBadge tone="success">All submitted</StatusBadge>
                  : <StatusBadge tone="info">In progress</StatusBadge>
              )}
            </div></td>
            <td className="data-td text-left"><Link to={`?${detailParams}`} state={{ ...state, fromLecturerList: true }}
              aria-label={`View tasks for ${lecturer.name}`} className={`${actionClass} whitespace-nowrap`}>View tasks</Link></td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    <WorkspacePagination page={currentPage} pageCount={pages} total={lecturers.length} noun="lecturers" onPage={nextPage => {
      const next = new URLSearchParams(params);
      nextPage === 1 ? next.delete('lecturerPage') : next.set('lecturerPage', String(nextPage));
      setParams(next, { replace: true, state });
    }} />
  </div>;
}
