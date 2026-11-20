/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The Letter types tab: every letter the office keeps, with how it is issued,
// what students are asked, its status and when it was last updated.

import React, { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { WorkspacePagination } from './RequestWorkspacePrimitives';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';
import { ListChips, ListSearch, ListToolbar, ListToolbarRow, type ListChipOption } from './ListToolbar';
import { LoadingState, ErrorState, EmptyState } from './StateViews';
import type { LetterPurpose, LetterTemplate } from '../types';
import { AUDIENCE_NOTE, PURPOSE_CHIP, STATUS_TONE, isCustomQuestion } from '../utils/letterEditor';

type StatusFilter = 'current' | 'Archived';
const PAGE_SIZE = 10;
const PURPOSE_OPTIONS: SelectMenuOption<LetterPurpose | ''>[] = [
  { value: '', label: 'All letter types', triggerLabel: 'All' },
  { value: 'REQUEST', label: PURPOSE_CHIP.REQUEST },
  { value: 'SUPERVISOR_APPOINTMENT', label: PURPOSE_CHIP.SUPERVISOR_APPOINTMENT },
  { value: 'PANEL_APPOINTMENT', label: PURPOSE_CHIP.PANEL_APPOINTMENT },
  { value: 'CO_SUPERVISOR_APPOINTMENT', label: PURPOSE_CHIP.CO_SUPERVISOR_APPOINTMENT },
];

/** What students are asked when they request this letter, in a few words. */
export function formSummary(template: LetterTemplate): string {
  if ((template.purpose ?? 'REQUEST') !== 'REQUEST') return 'None';
  const questions = template.formQuestions ?? [];
  const parts = [
    questions.some((question) => question.kind === 'recipient') ? 'Who the letter is for' : '',
    questions.some((question) => question.kind === 'extras') ? 'optional study details' : '',
  ].filter(Boolean);
  const own = questions.filter(isCustomQuestion).length;
  if (own) parts.push(`${own} more question${own === 1 ? '' : 's'}`);
  if (!parts.length) return 'None';
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
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
        (template.status === 'Archived') === (status === 'Archived') &&
        (!query || [template.name, template.type, template.description].some((text) => text.toLowerCase().includes(query))),
    );
  }, [templates, search, purpose, status]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE);

  const archived = templates.filter((template) => template.status === 'Archived').length;
  const chips: ListChipOption<StatusFilter>[] = [
    { value: 'current', label: 'Current', count: templates.length - archived },
    { value: 'Archived', label: 'Archived', count: archived },
  ];

  return (
    <section aria-label="Letter types" className="app-card readable-list space-y-4 p-4 sm:p-5">
      <ListToolbar>
        {(archived > 0 || status === 'Archived') && (
          <ListChips
            label="Show current or archived letter types"
            options={chips}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        )}
        <ListToolbarRow>
          <ListSearch
            label="Search letter types"
            placeholder="Search name, category or description"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <SelectMenu<LetterPurpose | ''>
            variant="filter"
            prefix="Issued"
            aria-label="Filter by how the letter is issued"
            value={purpose}
            options={PURPOSE_OPTIONS}
            onChange={(value) => {
              setPurpose(value);
              setPage(1);
            }}
          />
        </ListToolbarRow>
      </ListToolbar>

      {loading ? (
        <LoadingState message="Loading letter types…" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        templates.length === 0 ? (
          <EmptyState icon={FileText} title="No letter types yet" description="Make the first one, for example a confirmation letter." actionLabel="New letter type" onAction={onCreate} />
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-6 card-description">No letter types match this search.</p>
        )
      ) : (
        <>
          <table aria-label="Letter types" className="data-table block table-fixed lg:table">
            <colgroup className="hidden lg:table-column-group">
              {[30, 20, 18, 11, 12, 9].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
            </colgroup>
            <thead className="hidden lg:table-header-group">
              <tr className="data-thead bg-slate-50">
                <th scope="col" className="data-th">Letter type</th>
                <th scope="col" className="data-th">How it is issued</th>
                <th scope="col" className="data-th">Questions for students</th>
                <th scope="col" className="data-th">Status</th>
                <th scope="col" className="data-th">Last updated</th>
                <th scope="col" className="data-th"><span className="sr-only">Action</span></th>
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
                    <span className="card-label mb-1 block lg:hidden">How it is issued</span>
                    {PURPOSE_CHIP[template.purpose ?? 'REQUEST']}
                    {(template.purpose ?? 'REQUEST') === 'REQUEST' && AUDIENCE_NOTE[template.audience ?? 'CURRENT'] && (
                      <p className="card-caption mt-1">{AUDIENCE_NOTE[template.audience ?? 'CURRENT']}</p>
                    )}
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Questions for students</span>
                    {formSummary(template)}
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Status</span>
                    <StatusBadge tone={STATUS_TONE[template.status]} dot>{template.status}</StatusBadge>
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle whitespace-nowrap lg:table-cell lg:px-5 lg:py-4">
                    <span className="card-label mb-1 block lg:hidden">Last updated</span>
                    {template.lastModified || 'Not recorded'}
                  </td>
                  <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4 lg:text-right">
                    <PortalButton size="sm" className="whitespace-nowrap" aria-label={`Edit ${template.name}`} onClick={() => onOpen(template)}>Edit</PortalButton>
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
