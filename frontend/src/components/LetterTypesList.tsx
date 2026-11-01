/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The Letter types tab: every letter the office keeps, with when it is used,
// what its student form asks and its status. Opening one shows its editor.

import React, { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { WorkspaceFilterCard, WorkspacePagination, WorkspaceSectionHeader } from './RequestWorkspacePrimitives';
import { PortalSelect } from './PortalSelect';
import { LoadingState, ErrorState, EmptyState } from './StateViews';
import type { LetterPurpose, LetterTemplate } from '../types';
import { PURPOSE_CHIP, STATUS_TONE, isCustomQuestion } from '../utils/letterEditor';

type StatusFilter = 'current' | 'Active' | 'Draft' | 'Archived' | 'all';
const PAGE_SIZE = 10;

/** What a letter's student form asks, in a few words. */
export function formSummary(template: LetterTemplate): string {
  if ((template.purpose ?? 'REQUEST') !== 'REQUEST') return 'Sent automatically';
  const questions = template.formQuestions ?? [];
  const parts = [
    questions.some((question) => question.kind === 'recipient') ? 'Who it is for' : '',
    questions.some((question) => question.kind === 'extras') ? 'Additional information' : '',
  ].filter(Boolean);
  const own = questions.filter(isCustomQuestion).length;
  if (own) parts.push(`${own} question${own === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'A note only';
}

export const LetterTypesList: React.FC<{
  templates: LetterTemplate[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (template: LetterTemplate) => void;
  onCreate: () => void;
}> = ({ templates, loading, error, onRetry, onOpen, onCreate }) => {
  const [search, setSearch] = useState('');
  const [purpose, setPurpose] = useState<LetterPurpose | ''>('');
  const [status, setStatus] = useState<StatusFilter>('current');
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return templates.filter(
      (template) =>
        (!purpose || (template.purpose ?? 'REQUEST') === purpose) &&
        (status === 'all' || (status === 'current' ? template.status !== 'Archived' : template.status === status)) &&
        (!query || [template.name, template.type, template.description].some((text) => text.toLowerCase().includes(query))),
    );
  }, [templates, search, purpose, status]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE);

  return (
    <section aria-label="Letter types" className="app-card appointment-workspace-card">
      <WorkspaceSectionHeader title="Letter types" description="The letters students can ask for and the ones sent after an appointment. Open one to change its form, wording or settings." />
      <WorkspaceFilterCard
        fieldsClassName="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4"
        onReset={() => {
          setSearch('');
          setPurpose('');
          setStatus('current');
          setPage(1);
        }}
      >
        <label className="form-label xl:col-span-2">
          Find a letter type
          <input type="search" className="form-control form-control-sm mt-1" value={search} placeholder="Name, type or description" onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </label>
        <label className="form-label">
          Used
          <PortalSelect className="form-control form-control-sm mt-1" value={purpose} onChange={(event) => { setPurpose(event.target.value as LetterPurpose | ''); setPage(1); }}>
            <option value="">Whenever</option>
            <option value="REQUEST">{PURPOSE_CHIP.REQUEST}</option>
            <option value="SUPERVISOR_APPOINTMENT">{PURPOSE_CHIP.SUPERVISOR_APPOINTMENT}</option>
            <option value="PANEL_APPOINTMENT">{PURPOSE_CHIP.PANEL_APPOINTMENT}</option>
            <option value="CO_SUPERVISOR_APPOINTMENT">{PURPOSE_CHIP.CO_SUPERVISOR_APPOINTMENT}</option>
          </PortalSelect>
        </label>
        <label className="form-label">
          Status
          <PortalSelect className="form-control form-control-sm mt-1" value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }}>
            <option value="current">Active and draft</option>
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
            <option value="Archived">Archived</option>
            <option value="all">All statuses</option>
          </PortalSelect>
        </label>
      </WorkspaceFilterCard>

      {loading ? (
        <LoadingState message="Loading letter types…" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        templates.length === 0 ? (
          <EmptyState icon={FileText} title="No letter types yet" description="Make the first one, for example a confirmation letter." actionLabel="New letter type" onAction={onCreate} />
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-6 card-description">No letter types match these filters.</p>
        )
      ) : (
        <>
          <table aria-label="Letter types" className="data-table block table-fixed lg:table">
            <colgroup className="hidden lg:table-column-group">
              {[32, 18, 20, 12, 18].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
            </colgroup>
            <thead className="hidden lg:table-header-group">
              <tr className="data-thead bg-slate-50">
                <th scope="col" className="data-th">Letter type</th>
                <th scope="col" className="data-th">Used</th>
                <th scope="col" className="data-th">Student form</th>
                <th scope="col" className="data-th">Status</th>
                <th scope="col" className="data-th">Action</th>
              </tr>
            </thead>
            <tbody className="block space-y-3 lg:table-row-group lg:space-y-0">
              {shown.map((template) => (
                <tr key={template.id} className="data-row grid grid-cols-2 rounded-xl border border-slate-200 py-2 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:py-0">
                  <td className="data-td-strong col-span-2 block min-w-0 px-3 py-2 align-middle [overflow-wrap:anywhere] lg:table-cell lg:px-5 lg:py-4">
                    <p>{template.name}</p>
                    {template.description && <p className="card-caption mt-1 line-clamp-2">{template.description}</p>}
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Used</span>
                    {PURPOSE_CHIP[template.purpose ?? 'REQUEST']}
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Student form</span>
                    {formSummary(template)}
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Status</span>
                    <StatusBadge tone={STATUS_TONE[template.status]} dot>{template.status}</StatusBadge>
                  </td>
                  <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <PortalButton size="sm" className="whitespace-nowrap" aria-label={`Edit ${template.name}`} onClick={() => onOpen(template)}>Edit</PortalButton>
                    <p className="card-caption mt-1.5">Changed {template.lastModified}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <WorkspacePagination page={Math.min(page, pageCount)} pageCount={pageCount} total={rows.length} noun="letter types" onPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}
    </section>
  );
};
