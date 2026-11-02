import React, { useMemo, useState } from 'react';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { PortalSelect } from './PortalSelect';
import type { EvaluationRecipientPreview } from '../types';
import { formatMalaysiaDateTime as displayDateTime } from '../utils/malaysiaDateTime';

export function MarkEntryRecipientPreview({ preview }: { preview: EvaluationRecipientPreview }) {
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
    {preview.missingAppointments.supervisor > 0 || preview.missingAppointments.panel > 0 ? <details className="rounded-lg border border-slate-200 px-4 py-3">
      <summary className="cursor-pointer font-semibold">Students not included</summary>
      <div className="mt-3 space-y-2 text-sm text-slate-600">
        {preview.missingAppointments.supervisor > 0 ? <p>Supervisor tasks: {preview.missingAppointments.supervisor} students not eligible.</p> : null}
        {preview.missingAppointments.panel > 0 ? <p>Panel tasks: {preview.missingAppointments.panel} students not eligible.</p> : null}
        <p>These counts cover missing eligible appointments or required research profiles. A student may appear in both counts. Publishing is still available.</p>
      </div>
    </details> : null}
    {preview.totals.total === 0 ? <p className="rounded-lg bg-slate-50 px-4 py-4">No recipients currently match this period.</p> : <>
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
            <td className="px-4 py-4 align-top"><StatusBadge tone={row.taskStatus === 'NEW' ? 'info' : 'neutral'}>{row.taskStatus === 'NEW' ? 'New' : 'Existing'}</StatusBadge></td>
          </tr>)}{filtered.length === 0 ? <tr><td colSpan={showProgramme ? 5 : 4} className="px-4 py-8 text-center text-slate-500">No recipients match these filters.</td></tr> : null}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-slate-500">Showing {filtered.length ? offset + 1 : 0}–{Math.min(offset + 10, filtered.length)} of {filtered.length} tasks</p>
        {pages > 1 ? <div className="flex items-center gap-3"><PortalButton size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</PortalButton><span className="text-xs">Page {currentPage} of {pages}</span><PortalButton size="sm" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</PortalButton></div> : null}
      </div>
    </>}
    <div className="space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
      <p>Tasks are created when you publish. Estimate checked at {displayDateTime(preview.generatedAt)}.</p>
      <details><summary className="cursor-pointer">About later appointments</summary><p className="mt-2">Eligible students and appointments added later are included automatically while the published period remains scheduled or open.</p></details>
    </div>
  </section>;
}
