import React from 'react';
import type {RubricVersion} from '../types';
import {PortalButton, PortalCard, StatusBadge} from './PortalPrimitives';
import {PortalSelect} from './PortalSelect';
import {EmptyState} from './StateViews';

export function rubricFamilies(rubrics: RubricVersion[]) {
  const codes = [...new Set(rubrics.map(row => row.familyCode))];
  return codes.map(code => {
    const versions = rubrics.filter(row => row.familyCode === code).sort((a, b) => b.version - a.version);
    return {code, versions, current: versions.find(row => row.isActive) ?? versions[0]};
  });
}

export type RubricFamilyFilters = {search: string; status: string; page: number};

export function RubricFamilyList({rubrics, busy, onManage, filters, onFiltersChange}: {rubrics: RubricVersion[]; busy: boolean; onManage: (rubric: RubricVersion) => void; filters: RubricFamilyFilters; onFiltersChange: (filters: RubricFamilyFilters) => void}) {
  const {search, status, page} = filters;
  const rows = rubricFamilies(rubrics).filter(({code, current}) =>
    (status === 'all' || Boolean(current.isArchived) === (status === 'archived')) &&
    `${code} ${current.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const shownPage = Math.min(page, pages);
  return <PortalCard padding="none" className="overflow-hidden">
    <div className="grid gap-4 border-b border-slate-200 p-6 sm:grid-cols-[minmax(0,1fr)_200px]">
      <label className="form-label">Find a rubric family<input id="rubric-family-search" className="form-control form-control-md mt-2" value={search} placeholder="Name or family code" onChange={event => {onFiltersChange({...filters, search: event.target.value, page: 1});}} /></label>
      <label className="form-label">Status<PortalSelect id="rubric-family-status" className="form-control form-control-md mt-2" value={status} onChange={event => {onFiltersChange({...filters, status: event.target.value, page: 1});}}><option value="available">Available families</option><option value="archived">Archived families</option><option value="all">All families</option></PortalSelect></label>
    </div>
    {rows.length ? <div className="overflow-x-auto" role="region" aria-label="Rubric families" tabIndex={0}><table className="data-table min-w-[760px] [&_th]:px-6 [&_th]:py-4 [&_td]:px-6 [&_td]:py-5">
      <colgroup><col style={{width: '32%'}} /><col style={{width: '17%'}} /><col style={{width: '17%'}} /><col style={{width: '18%'}} /><col style={{width: '16%'}} /></colgroup>
      <thead><tr><th className="data-th">Family</th><th className="data-th">Current version</th><th className="data-th">Setup</th><th className="data-th">Usage</th><th className="data-th">Action</th></tr></thead>
      <tbody>{rows.slice((shownPage - 1) * 10, shownPage * 10).map(({code, current, versions}) => <tr key={code}>
        <td className="data-td"><span className="card-value block">{current.name}</span><span className="card-description mt-1 block">{code}</span></td>
        <td className="data-td">Version {current.version}{current.isArchived ? <span className="mt-2 block"><StatusBadge tone="neutral">Archived</StatusBadge></span> : null}</td>
        <td className="data-td"><StatusBadge tone={current.isReady ? 'success' : 'warning'}>{current.isReady ? 'Ready' : 'Needs setup'}</StatusBadge></td>
        <td className="data-td">{versions.reduce((count, version) => count + (version.usage?.length ?? 0), 0)} evaluation periods</td>
        <td className="data-td"><PortalButton disabled={busy} onClick={() => onManage(current)}>Manage rubric</PortalButton></td>
      </tr>)}</tbody></table></div> : <EmptyState title="No matching rubric families" description="Change the search or status filter." />}
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4"><span className="card-description">{rows.length} {rows.length === 1 ? 'family' : 'families'} · Page {shownPage} of {pages}</span><div className="flex gap-2"><PortalButton disabled={shownPage <= 1} onClick={() => onFiltersChange({...filters, page: shownPage - 1})}>Previous</PortalButton><PortalButton disabled={shownPage >= pages} onClick={() => onFiltersChange({...filters, page: shownPage + 1})}>Next</PortalButton></div></footer>
  </PortalCard>;
}

export function RubricVersionHistory({versions, selected, onSelect}: {versions: RubricVersion[]; selected: RubricVersion; onSelect: (row: RubricVersion) => void}) {
  return <PortalCard padding="none" className="overflow-hidden"><details>
    <summary className="cursor-pointer px-6 py-5 text-sm font-semibold text-slate-800">Version history · {versions.length} {versions.length === 1 ? 'version' : 'versions'}</summary>
    <div className="max-h-96 overflow-auto"><table className="data-table min-w-[600px] [&_th]:px-6 [&_th]:py-4 [&_td]:px-6 [&_td]:py-4"><thead><tr><th className="data-th">Version</th><th className="data-th">Setup</th><th className="data-th">Usage</th><th className="data-th">Action</th></tr></thead><tbody>{versions.map(version => <tr key={version.id}><td className="data-td">Version {version.version}{version.isActive ? ' · Current' : ''}</td><td className="data-td">{version.isReady ? 'Ready' : 'Needs setup'}</td><td className="data-td">{version.usage?.length ?? 0} evaluation periods</td><td className="data-td"><PortalButton disabled={selected.id === version.id} onClick={() => onSelect(version)}>View version {version.version}</PortalButton></td></tr>)}</tbody></table></div>
  </details></PortalCard>;
}
