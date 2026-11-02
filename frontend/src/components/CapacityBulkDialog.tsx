import React, {useEffect, useMemo, useState} from 'react';
import type {SemesterCapacityPlan} from '../types';
import type {CapacityBulkCommand, CapacityBulkMode} from '../types/lecturerCapacity';
import type {CapacityWorkspaceLecturer} from '../services/capacityWorkspaceApi';
import {buildCapacityBulkPreview} from '../utils/capacityBulk';
import {DecisionDialog} from './DecisionDialog';
import {PortalButton} from './PortalPrimitives';
import {PortalSelect} from './PortalSelect';
import {AlertMessage} from './AlertMessage';
import {CoordinatorDataTable} from './CoordinatorBrowsePrimitives';
import {WorkspacePagination} from './RequestWorkspacePrimitives';

const lecturerCount = (count: number) => `${count} ${count === 1 ? 'lecturer' : 'lecturers'}`;

export function CapacityBulkDialog({plan, matching, selected, busy, onClose, onSave, onReload, onDraftChange}: {
  plan: SemesterCapacityPlan; matching: CapacityWorkspaceLecturer[]; selected: CapacityWorkspaceLecturer[]; busy: boolean;
  onClose: () => void; onSave: (command: CapacityBulkCommand) => Promise<void | false>; onReload: () => Promise<void>;
  onDraftChange?: (dirty: boolean) => void;
}) {
  const [scope, setScope] = useState(selected.length ? 'selected' : 'matching');
  const [supervisor, setSupervisor] = useState(''), [panel, setPanel] = useState('');
  const [mode, setMode] = useState<CapacityBulkMode>('MISSING_ONLY');
  const [reviewing, setReviewing] = useState(false), [page, setPage] = useState(1);
  const targets = scope === 'selected' ? selected : matching;
  const preview = useMemo(() => buildCapacityBulkPreview(targets, {supervisor, panel}, mode), [targets, supervisor, panel, mode]);
  const dirty = !!supervisor.trim() || !!panel.trim() || mode !== 'MISSING_ONLY';
  useEffect(() => {onDraftChange?.(dirty);}, [dirty, onDraftChange]);
  const canSave = targets.length > 0 && preview.entries.length > 0 && preview.errors.length === 0;
  const warningCount = preview.changes.filter(change => change.warnings.length).length;
  const pages = Math.max(1, Math.ceil(preview.changes.length / 5));
  return <>
    <DecisionDialog isOpen decisionKey={`bulk-${plan.id}`} title={reviewing ? 'Review bulk changes' : 'Set limits in bulk'} kind="confirmation"
      context={<><p>{plan.semesterLabel}</p><p className="mt-1 text-xs font-normal text-slate-600">Draft v{plan.version}</p></>}
      message={reviewing ? `${lecturerCount(preview.entries.length)} will change. Published limits stay unchanged.` : 'Set common limits, then edit individual exceptions.'}
      confirmLabel={reviewing ? 'Save draft limits' : 'Preview changes'} successMessage={`Draft limits saved for ${lecturerCount(preview.entries.length)}.`}
      busy={busy} dirty={dirty} canConfirm={canSave} onClose={onClose} onReload={onReload}
      onConfirm={async () => { if (!reviewing) {setPage(1);setReviewing(true);return false;} return onSave({entries: preview.entries, mode, expectedVersion: plan.version, expectedFingerprint: plan.contentFingerprint}); }}>
      {!reviewing ? <>
        <label className="form-label block">Lecturers<PortalSelect id="capacity-bulk-scope" className="form-control form-control-sm mt-1" value={scope} onChange={event => setScope(event.target.value)}>
          {selected.length > 0 && <option value="selected">Selected lecturers ({selected.length})</option>}
          <option value="matching">All matching lecturers ({matching.length})</option>
        </PortalSelect></label>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="form-label min-w-0">Supervisor limit<input className="form-control form-control-md mt-1" type="number" min="0" max="2147483647" step="1" placeholder="Leave unchanged" value={supervisor} onChange={event => setSupervisor(event.target.value)} /></label>
          <label className="form-label min-w-0">Panel limit<input className="form-control form-control-md mt-1" type="number" min="0" max="2147483647" step="1" placeholder="Leave unchanged" value={panel} onChange={event => setPanel(event.target.value)} /></label>
        </div>
        <label className="form-label block">Update mode<PortalSelect id="capacity-bulk-mode" className="form-control form-control-sm mt-1" value={mode} onChange={event => setMode(event.target.value as CapacityBulkMode)}>
          <option value="MISSING_ONLY">Fill missing limits only</option><option value="REPLACE">Replace draft limits</option>
        </PortalSelect></label>
        {dirty && preview.errors.length > 0 && <AlertMessage type="error" title="Complete the limits" message={preview.errors[0]}>{preview.errors.length > 1 && <details className="mt-2"><summary>All {preview.errors.length} issues</summary><ul className="mt-2 list-disc space-y-1 pl-4">{preview.errors.map(message => <li key={message}>{message}</li>)}</ul></details>}</AlertMessage>}
        {dirty && !preview.errors.length && !preview.entries.length && <p className="card-description">No draft limits would change.</p>}
      </> : <>
        <p className="card-description">{mode === 'MISSING_ONLY' ? 'Filling missing limits only.' : 'Replacing the specified draft limits.'} {lecturerCount(targets.length - preview.entries.length)} unchanged.</p>
        {warningCount > 0 && <AlertMessage type="warning" title={`${lecturerCount(warningCount)} below publication minimums`} message="You can save this draft. Publication requires limits that meet the live minimums." />}
        <div className="[&_.data-td]:!p-3 [&_.data-td-strong]:!p-3 [&_.card-label]:hidden"><CoordinatorDataTable label="Bulk capacity preview" columns={['Lecturer', 'Changes']} rows={preview.changes.slice((page - 1) * 5, page * 5).map(change => ({key: change.row.lecturerId, cells: [<><p>{change.row.lecturerName}</p><p className="card-caption mt-1">{change.row.staffNo}</p></>, <div className="space-y-1">{change.values.map(value => <p key={value}>{value}</p>)}{change.warnings.map(message => <p className="text-amber-800" key={message}>{message}</p>)}</div>]}))} /></div>
        <WorkspacePagination total={preview.changes.length} page={page} pageCount={pages} pageSize={5} onPage={setPage} noun="lecturers" />
        <PortalButton size="sm" onClick={() => setReviewing(false)}>Back to settings</PortalButton>
      </>}
    </DecisionDialog>
  </>;
}
