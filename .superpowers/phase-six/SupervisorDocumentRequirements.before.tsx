import { RecordPage } from './RecordPage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  History,
  Pencil,
  Plus,
  X,
} from 'lucide-react';

import type {
  SupervisorDocumentRequirement,
  SupervisorDocumentRequirementAudit,
} from '../types';
import {
  createSupervisorDocumentRequirement,
  getSupervisorDocumentRequirementAudits,
  getSupervisorDocumentRequirements,
  updateSupervisorDocumentRequirement,
} from '../services';
import { PageHeader, PortalButton, StatusBadge } from './PortalPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';

type Filter = 'Active' | 'Inactive' | 'All';

interface Props {
  onBack?: () => void;
  backLabel?:string;
}

const emptyForm = {
  label: '',
  description: '',
  isRequired: true,
  isActive: true,
  displayOrder: 1,
};

export const SupervisorDocumentRequirements: React.FC<Props> = ({ onBack,backLabel='Back to Supervisor Appointments' }) => {
  const [requirements, setRequirements] = useState<SupervisorDocumentRequirement[]>([]);
  const [audits, setAudits] = useState<SupervisorDocumentRequirementAudit[]>([]);
  const [filter, setFilter] = useState<Filter>('Active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SupervisorDocumentRequirement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getSupervisorDocumentRequirements(),
      getSupervisorDocumentRequirementAudits(),
    ])
      .then(([nextRequirements, nextAudits]) => {
        setRequirements(nextRequirements);
        setAudits(nextAudits);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Requirements could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const filtered = useMemo(() => requirements.filter((item) => (
    filter === 'All' || (filter === 'Active' ? item.isActive : !item.isActive)
  )), [filter, requirements]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, displayOrder: requirements.length + 1 });
    setReason('');
    setSaveError(null);
    setDrawerOpen(true);
  };

  const openEdit = (requirement: SupervisorDocumentRequirement) => {
    setEditing(requirement);
    setForm({
      label: requirement.label,
      description: requirement.description,
      isRequired: requirement.isRequired,
      isActive: requirement.isActive,
      displayOrder: requirement.displayOrder,
    });
    setReason('');
    setSaveError(null);
    setDrawerOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.label.trim() || (editing && !reason.trim())) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editing) {
        await updateSupervisorDocumentRequirement(editing.id, {
          ...form,
          label: form.label.trim(),
          description: form.description.trim(),
          reason: reason.trim(),
        });
      } else {
        await createSupervisorDocumentRequirement({
          ...form,
          label: form.label.trim(),
          description: form.description.trim(),
        });
      }
      setDrawerOpen(false);
      load();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Requirement changes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = requirements.filter((item) => item.isActive).length;
  const requiredCount = requirements.filter((item) => item.isActive && item.isRequired).length;

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        title="Supervisor document requirements"
        subtitle="Control the private documents students must provide with new supervisor applications. Changes affect future submissions only."
        backLabel={backLabel}
        onBack={onBack}
        actions={(
          <PortalButton onClick={openCreate} variant="primary" size="sm" icon={Plus} className="shrink-0 whitespace-nowrap">
            Add requirement
          </PortalButton>
        )}
      />

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3">
        {[
          { label: 'Active requirements', value: activeCount, icon: FileCheck2 },
          { label: 'Required uploads', value: requiredCount, icon: CheckCircle2 },
          { label: 'Configuration changes', value: audits.length, icon: History },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 bg-white px-5 py-4">
            <Icon className="h-4 w-4 text-slate-500" />
            <div>
              <p className="card-metric text-brand-navy">{value}</p>
              <p className="card-caption uppercase text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="section-label">Submission checklist</h2>
            <p className="card-description mt-1">A maximum of five items may be active.</p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['Active', 'Inactive', 'All'] as Filter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-md px-3 py-1.5 text-[10px] font-black ${filter === item ? 'bg-white text-brand-navy shadow-xs' : 'text-slate-400'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {loading ? <LoadingState message="Loading document requirements..." /> : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No requirements in this view" description="Add a requirement or change the current filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead><tr className="data-thead">
                <th className="data-th">Order</th>
                <th className="data-th">Requirement</th>
                <th className="data-th">Submission rule</th>
                <th className="data-th">Status</th>
                <th className="data-th">Usage</th>
                <th className="data-th text-center">Action</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td className="data-td font-mono">{item.displayOrder}</td>
                    <td className="data-td">
                      <p className="card-value text-slate-800">{item.label}</p>
                      <p className="card-description mt-1 max-w-md">{item.description || 'No additional guidance.'}</p>
                      <p className="card-caption mt-1 font-mono text-slate-300">{item.code}</p>
                    </td>
                    <td className="data-td"><StatusBadge tone={item.isRequired ? 'warning' : 'neutral'}>{item.isRequired ? 'Required' : 'Optional'}</StatusBadge></td>
                    <td className="data-td"><StatusBadge tone={item.isActive ? 'success' : 'neutral'}>{item.isActive ? 'Active' : 'Inactive'}</StatusBadge></td>
                    <td className="data-td">{item.isUsed ? 'Used by applications' : 'Not used'}</td>
                    <td className="data-td text-center">
                      <button type="button" onClick={() => openEdit(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" title="Edit requirement">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <ClipboardList className="h-4 w-4 text-slate-500" />
          <h2 className="section-label">Configuration audit</h2>
        </div>
        {audits.length === 0 ? (
          <p className="card-description px-5 py-6">No configuration changes recorded.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {audits.slice(0, 12).map((audit) => (
              <div key={audit.id} className="grid gap-1 px-5 py-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="card-value text-slate-800">{audit.requirementLabel} · {audit.action === 'CREATE' ? 'Created' : 'Updated'}</p>
                  <p className="card-description mt-1">{audit.reason || 'Initial configuration.'}</p>
                </div>
                <p className="card-description sm:text-right">{audit.actorName}<br />{new Date(audit.createdAt).toLocaleString('en-GB')}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {drawerOpen ? <RecordPage title={editing ? 'Edit document requirement' : 'Add document requirement'} subtitle="Applies to future supervisor applications" backLabel="Back to Document Requirements" onBack={() => setDrawerOpen(false)} pageKey="supervisor-document-requirement" dirty={!!reason.trim() || form.label !== (editing?.label ?? '') || form.description !== (editing?.description ?? '') || form.isRequired !== (editing?.isRequired ?? true) || form.isActive !== (editing?.isActive ?? true) || form.displayOrder !== (editing?.displayOrder ?? requirements.length + 1)} busy={saving}>{requestBack => <form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-200 bg-white">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <label className="block"><span className="form-label">Label</span><input className="form-control form-control-md mt-1.5" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} required /></label>
              <label className="block"><span className="form-label">Guidance</span><textarea className="form-control mt-1.5 min-h-28" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label className="block"><span className="form-label">Display order</span><input type="number" min={0} className="form-control form-control-md mt-1.5" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} /></label>
              <label className="flex items-center justify-between border-b border-slate-100 py-3 text-xs font-bold text-slate-700"><span>Required for submission</span><input type="checkbox" checked={form.isRequired} onChange={(event) => setForm({ ...form, isRequired: event.target.checked })} /></label>
              <label className="flex items-center justify-between border-b border-slate-100 py-3 text-xs font-bold text-slate-700"><span>Active</span><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /></label>
              {editing && <label className="block"><span className="form-label">Reason for change</span><textarea className="form-control mt-1.5 min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}
              {saveError && <p className="card-description rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{saveError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <PortalButton type="button" variant="secondary" onClick={requestBack}>Cancel</PortalButton>
              <PortalButton type="submit" variant="primary" disabled={saving || !form.label.trim() || Boolean(editing && !reason.trim())}>{saving ? 'Saving...' : 'Save changes'}</PortalButton>
            </div>
          </form>}</RecordPage> : null}
    </div>
  );
};
