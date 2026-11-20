import React, { useId, useMemo, useState } from 'react';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { PortalSelect } from './PortalSelect';
import type { EvaluationRecipientPreview } from '../types';
import { formatMalaysiaDateTime as displayDateTime } from '../utils/malaysiaDateTime';
import { APP_ROUTES } from '../constants/routes';

const exclusionLabels: Record<string, [string, string]> = {
  NOT_CONFIRMED: ['Stage needs review', 'Check Project Stages in Student Registry.'],
  NO_SEMESTER_ROW: ['No semester on record', 'Check the student’s semester record in Registry.'],
  BREAK_AFTER_P1: ['Not studying right after RP1', 'Ask the programme coordinator to review the stage.'],
  NOT_ANSWERED: ['RP registration not answered', 'Check the student’s registration in Project Stages.'],
  NOT_STARTED: ['Project not started', 'Check Project Stages if the student should be taking RP1.'],
  COMPLETED: ['RP1 and RP2 completed', 'Check that the period uses the correct semester.'],
  STAGE_MISMATCH: ['Different project stage', 'Compare the assessment with the student’s stage in Registry.'],
  ON_LEAVE: ['On semester leave', 'Review the semester record before assigning work.'],
  NOT_REGISTERED: ['Not registered this semester', 'Review the semester record with Office.'],
  FINISHED: ['Studies finished before this semester', 'Check that the period uses the correct semester.'],
  STUDENT_NOT_LINKED: ['Student record not linked', 'Link the research profile to its student record.'],
  STUDENT_INELIGIBLE: ['Student not currently eligible', 'Review the student status and intake with Office.'],
  PERIOD_SEMESTER_NOT_CONFIGURED: ['Period semester missing', 'Configure the period semester first.'],
  PERIOD_STAGE_NOT_CONFIGURED: ['Period stage missing', 'Configure the period as P1 or P2 first.'],
  MISSING_RESEARCH_PROFILE: ['Research profile missing', 'Create or link the research profile before assigning work.'],
  MISSING_SUPERVISOR_APPOINTMENT: ['Eligible supervisor appointment missing', 'Review the supervisor appointment and lecturer status.'],
  MISSING_PANEL_APPOINTMENT: ['Eligible panel appointment missing', 'Review the panel appointment and lecturer status.'],
};

type EligibilityRow = NonNullable<EvaluationRecipientPreview['exclusions']>[number];
const fallbackReason = ['Registration needs review', 'Ask Office to review this student.'] as const;
const matchesStudent = (row: EligibilityRow, query: string) =>
  `${row.studentName} ${row.matricNo} ${row.programme}`.toLowerCase().includes(query);

function EligibilityRows({ rows, showReason = false }: { rows: EligibilityRow[]; showReason?: boolean }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const current = Math.min(page, pages);
  return <>
    {rows.length === 0 ? <p role="status">No students match this search.</p> :
      <ul className="divide-y divide-slate-100">{rows.slice((current - 1) * 10, current * 10).map(row => {
        const [label, action] = exclusionLabels[row.reason] ?? fallbackReason;
        return <li key={`${row.studentId ?? 'profile'}-${row.matricNo}-${row.reason}`} className="py-2.5">
          <p className="font-semibold text-slate-900">{row.studentName} <span className="font-normal text-slate-600">{row.matricNo}</span></p>
          {showReason ? <><p>{label}</p><p className="text-xs text-slate-600">{action}</p></> : null}
        </li>;
      })}</ul>}
    {pages > 1 ? <div className="flex flex-wrap items-center gap-3"><PortalButton size="sm" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</PortalButton><span className="text-xs" role="status">Page {current} of {pages}</span><PortalButton size="sm" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</PortalButton></div> : null}
  </>;
}

function EligibilityStudents({ preview, missing = false }: { preview: EvaluationRecipientPreview; missing?: boolean }) {
  const [query, setQuery] = useState('');
  const groupName = useId();
  const search = query.trim().toLowerCase();
  const source = (missing ? preview.missingAssignments : preview.exclusions) ?? [];
  const rows = source.filter(row => matchesStudent(row, search));
  const { supervisor, panel } = preview.missingAppointments;
  if (missing ? supervisor + panel === 0 : source.length === 0) {
    return <p className="rounded-lg bg-slate-50 px-4 py-4">{missing ? 'No eligible students are missing appointments or research profiles.' : 'No students were excluded from this preview.'}</p>;
  }

  const searchLabel = missing ? 'Search students with missing requirements' : 'Search excluded students';
  const groups = new Map<string, EligibilityRow[]>();
  if (!missing) for (const row of rows) {
    const group = groups.get(row.reason);
    if (group) group.push(row);
    else groups.set(row.reason, [row]);
  }

  return <div className="space-y-4">
    {missing ? <>
      <p>These students are eligible for this assessment. Their marking tasks need an appointment or research profile.</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 font-semibold text-slate-900">
        {supervisor > 0 ? <li>Supervisor tasks affected ({supervisor})</li> : null}
        {panel > 0 ? <li>Panel tasks affected ({panel})</li> : null}
      </ul>
      <p className="text-xs text-slate-600">A student may appear in both counts. Publishing is still available.</p>
    </> : <p>These students won’t receive tasks for this period and are outside the missing appointment counts.</p>}
    <a href={missing ? APP_ROUTES.registry : `${APP_ROUTES.registryProjectStages}${preview.semesterId ? `?semester=${preview.semesterId}` : ''}`} className="inline-block font-semibold text-blue-700 underline underline-offset-4">{missing ? 'Review Student Registry' : 'Review Project Stages'}</a>
    {source.length > 0 ? <label className="block text-xs font-semibold">{searchLabel}<input aria-label={searchLabel} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Student name, matric number or programme" className="form-control mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label> : null}
    {missing && source.length > 0 ? <EligibilityRows key={search} rows={rows} showReason /> : null}
    {!missing && rows.length === 0 ? <p role="status">No students match this search.</p> : null}
    {[...groups.entries()].sort(([, a], [, b]) => b.length - a.length).map(([reason, students]) => {
      const [label, action] = exclusionLabels[reason] ?? fallbackReason;
      return <details key={reason} name={groupName} className="rounded-lg border border-slate-200">
        <summary className="min-h-11 cursor-pointer rounded-lg px-4 py-3 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600">{label} <span className="ml-2 text-xs font-medium text-slate-600">({students.length} {students.length === 1 ? 'student' : 'students'})</span></summary>
        <div className="space-y-2 border-t border-slate-200 px-4 pb-3 pt-3">
          <p className="text-xs text-slate-600">{action}</p>
          <EligibilityRows key={search} rows={students} />
        </div>
      </details>;
    })}
  </div>;
}

const previewTabs = ['tasks', 'missing', 'excluded'] as const;

export function MarkEntryRecipientPreview({ preview }: { preview: EvaluationRecipientPreview }) {
  const [tab, setTab] = useState<(typeof previewTabs)[number]>('tasks');
  const id = useId();
  const tabs = {
    tasks: `Marking tasks (${preview.totals.total})`,
    missing: `Missing requirements (${preview.missingAppointments.supervisor + preview.missingAppointments.panel})`,
    excluded: `Excluded students (${preview.eligibility?.excludedStudents ?? preview.exclusions?.length ?? 0})`,
  };
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return preview.recipients.filter(row => (role === 'ALL' || row.evaluatorRole === role)
      && (!query || `${row.studentName} ${row.matricNo} ${row.evaluatorName}`.toLocaleLowerCase().includes(query)));
  }, [preview, search, role]);
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const offset = (currentPage - 1) * 10;
  const showProgramme = new Set(preview.recipients.map(row => row.programme)).size > 1;

  return <section aria-label="Recipient preview" className="space-y-6 text-sm text-slate-700">
    <dl className="grid grid-cols-3 gap-4 border-b border-slate-200 pb-5">
      {[['Students', preview.totals.students], ['Marking tasks', preview.totals.total], ['Already exist', preview.totals.existing]].map(([label, value]) => <div key={label}>
        <dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 text-xl font-bold text-slate-900">{value}</dd>
      </div>)}
    </dl>
    {preview.configurationIssues?.map(reason => <p key={reason} role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{exclusionLabels[reason]?.[1] ?? 'Review period configuration.'} Task creation is blocked.</p>)}
    {preview.eligibility ? <p>{preview.eligibility.expectedStudents} {preview.eligibility.expectedStudents === 1 ? 'student meets' : 'students meet'} the eligibility rules for this assessment.</p> : null}
    <div role="tablist" aria-label="Recipient preview views" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" onKeyDown={event => {
      const index = previewTabs.indexOf(tab);
      const next = { ArrowLeft: (index + previewTabs.length - 1) % previewTabs.length, ArrowRight: (index + 1) % previewTabs.length, Home: 0, End: previewTabs.length - 1 }[event.key];
      if (typeof next !== 'number') return;
      event.preventDefault();
      setTab(previewTabs[next]);
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}>
      {previewTabs.map(view => <button key={view} id={`${id}-tab-${view}`} type="button" role="tab" aria-selected={tab === view} aria-controls={`${id}-panel-${view}`} tabIndex={tab === view ? 0 : -1} onClick={() => setTab(view)} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${tab === view ? 'bg-brand-navy text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{tabs[view]}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel-tasks`} aria-labelledby={`${id}-tab-tasks`} hidden={tab !== 'tasks'} tabIndex={0} className="space-y-4">
      {preview.totals.total === 0 ? <p className="rounded-lg bg-slate-50 px-4 py-4">No marking tasks currently match this period.</p> : <>
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-0 flex-1 text-xs font-semibold">Search recipients
            <input aria-label="Search recipients" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Student name, ID or evaluator" className="form-control mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold">Evaluator role
            <PortalSelect aria-label="Preview evaluator role" value={role} onChange={event => { setRole(event.target.value); setPage(1); }} className="form-control mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
              <option value="ALL">All roles</option><option value="SUPERVISOR">Supervisor</option><option value="PANEL">Panel</option>
            </PortalSelect>
          </label>
        </div>
        <div role="region" aria-label="Recipient preview results" tabIndex={0} className="overflow-x-auto rounded-lg border border-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Estimated evaluation recipients before publication</caption>
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>{['Student', ...(showProgramme ? ['Programme'] : []), 'Evaluator', 'Role', 'Task'].map(label => <th scope="col" key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{filtered.slice(offset, offset + 10).map((row, index) => <tr key={`${row.matricNo}-${row.evaluatorId}-${row.evaluatorRole}-${index}`} className="border-t border-slate-100">
              <td className="px-4 py-4 align-top"><p className="font-semibold text-slate-900">{row.studentName}</p><p className="mt-1 text-xs text-slate-500">{row.matricNo}</p></td>
              {showProgramme ? <td className="max-w-64 px-4 py-4 align-top">{row.programme || 'Unspecified'}</td> : null}
              <td className="px-4 py-4 align-top">{row.evaluatorName}</td><td className="px-4 py-4 align-top">{row.evaluatorRole === 'SUPERVISOR' ? 'Supervisor' : 'Panel'}</td>
              <td className="px-4 py-4 align-top"><StatusBadge tone={row.taskStatus === 'NEW' ? 'info' : 'neutral'}>{row.taskStatus === 'NEW' ? 'New' : row.taskStatus === 'PAUSED' ? 'Paused' : row.taskStatus === 'BLOCKED' ? 'Existing work needs review' : 'Existing'}</StatusBadge></td>
            </tr>)}{filtered.length === 0 ? <tr><td colSpan={showProgramme ? 5 : 4} className="px-4 py-8 text-center text-slate-500">No recipients match these filters.</td></tr> : null}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-xs text-slate-500">Showing {filtered.length ? offset + 1 : 0}–{Math.min(offset + 10, filtered.length)} of {filtered.length} tasks</p>
          {pages > 1 ? <div className="flex items-center gap-3"><PortalButton size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</PortalButton><span className="text-xs">Page {currentPage} of {pages}</span><PortalButton size="sm" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</PortalButton></div> : null}
        </div>
      </>}
    </div>
    <div role="tabpanel" id={`${id}-panel-missing`} aria-labelledby={`${id}-tab-missing`} hidden={tab !== 'missing'} tabIndex={0}>
      <EligibilityStudents preview={preview} missing />
    </div>
    <div role="tabpanel" id={`${id}-panel-excluded`} aria-labelledby={`${id}-tab-excluded`} hidden={tab !== 'excluded'} tabIndex={0}>
      <EligibilityStudents preview={preview} />
    </div>
    <div className="space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
      <p>Tasks are created when you publish. Estimate checked at {displayDateTime(preview.generatedAt)}.</p>
      <details><summary className="cursor-pointer">About later appointments</summary><p className="mt-2">Eligible students and appointments added later are included automatically while the published period remains scheduled or open.</p></details>
    </div>
  </section>;
}
