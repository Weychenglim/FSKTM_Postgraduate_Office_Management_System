import {DecisionFeedbackProvider, useDecisionFeedback} from './DecisionFeedback';
import { PortalModal, useModalTitle } from './PortalModal';
import { useDraftDiscard } from './useDraftDiscard';
import { DraftNavigationGuard } from './DraftNavigationGuard';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  History,
  Pencil,
  Plus,
  Settings2,
  X,
} from 'lucide-react';

import type {
  SupervisorDocumentRequirement,
  SupervisorDocumentRequirementAudit,
} from '../types';
import {
  createSupervisorDocumentRequirement,
  getSupervisorDocumentSetup,
  updateSupervisorDocumentSetup,
  getSupervisorDocumentRequirementAudits,
  getSupervisorDocumentRequirements,
  updateSupervisorDocumentRequirement,
} from '../services';
import { PageHeader, PortalButton, StatusBadge } from './PortalPrimitives';
import { WorkspacePagination } from './RequestWorkspacePrimitives';
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

const RequirementsContent: React.FC<Props> = ({ onBack,backLabel='Back to Supervisor Appointments' }) => {
  const publish = useDecisionFeedback()!;
  const inFlight = useRef(false);
  const [requirements, setRequirements] = useState<SupervisorDocumentRequirement[]>([]);
  const [audits, setAudits] = useState<SupervisorDocumentRequirementAudit[]>([]);
  const [filter, setFilter] = useState<Filter>('Active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SupervisorDocumentRequirement | null>(null);
  const [noDocumentsRequired, setNoDocumentsRequired] = useState(false);
  const [setupDialog, setSetupDialog] = useState(false);
  const [policyChoice, setPolicyChoice] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const titleId = useModalTitle();
  const checklistId = useId();
  const dirty = dialogOpen && (setupDialog ? (!!reason.trim() || policyChoice !== noDocumentsRequired) : (!!reason.trim() || form.label !== (editing?.label ?? '') || form.description !== (editing?.description ?? '') || form.isRequired !== (editing?.isRequired ?? true) || form.isActive !== (editing?.isActive ?? true) || form.displayOrder !== (editing?.displayOrder ?? requirements.length + 1)));
  const discard = useDraftDiscard(dirty, saving);
  const requestClose = () => discard.request(() => setDialogOpen(false));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRequirements, nextAudits, setup] = await Promise.all([
      getSupervisorDocumentRequirements(),
      getSupervisorDocumentRequirementAudits(),
      getSupervisorDocumentSetup(),
    ]);
      setNoDocumentsRequired(setup.noDocumentsRequired);
      setRequirements(nextRequirements);
      setAudits(nextAudits);
      setHistoryPage(1);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Requirements could not be loaded.');
      return false;
    } finally {setLoading(false);}
  }, []);

  useEffect(() => {void load();}, [load]);

  const filtered = useMemo(() => requirements.filter((item) => (
    filter === 'All' || (filter === 'Active' ? item.isActive : !item.isActive)
  )), [filter, requirements]);

  const openCreate = () => {
    setSetupDialog(false);
    setEditing(null);
    setForm({ ...emptyForm, displayOrder: requirements.length + 1 });
    setReason('');
    setSaveError(null);
    setDialogOpen(true);
  };

  const openEdit = (requirement: SupervisorDocumentRequirement) => {
    setSetupDialog(false);
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
    setDialogOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || loading || error || (setupDialog ? (!reason.trim() || policyChoice === noDocumentsRequired || (policyChoice && requirements.some(item => item.isActive))) : !form.label.trim() || (editing && !reason.trim()))) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      if (setupDialog) {
        await updateSupervisorDocumentSetup(policyChoice, reason.trim());
      } else if (editing) {
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
      setDialogOpen(false);
      setReason('');
      const refreshed = await load();
      publish(refreshed ? (setupDialog ? 'Document setup saved.' : 'Requirement saved.') : 'Requirement saved, but the latest configuration could not be loaded. Reload before making more changes.', refreshed ? 'success' : 'warning');
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Requirement changes could not be saved.');
    } finally {
      inFlight.current = false;
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

      <section data-document-workspace className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="px-6 pt-6 sm:px-7 sm:pt-7">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="section-label">Document requirements</h2>
            <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Document requirement actions">
            <PortalButton size="sm" variant="primary" icon={Settings2} disabled={loading || saving || !!error} className="shrink-0" onClick={() => {setPolicyChoice(noDocumentsRequired); setSetupDialog(true); setReason(''); setSaveError(null); setDialogOpen(true);}}>Document settings</PortalButton>
            <PortalButton disabled={loading || saving || !!error || noDocumentsRequired} onClick={openCreate} variant="primary" size="sm" icon={Plus}>Add requirement</PortalButton>
            </div>
          </header>
          {!loading && !error && <div className="mt-6">
            <div className="min-w-0 space-y-2">
              <p className="card-value text-slate-800">{noDocumentsRequired ? 'No documents required' : 'Document checklist'}</p>
              <p className="card-description">{noDocumentsRequired ? 'Students can submit without supporting documents. Saved checklist items remain available.' : !activeCount ? 'Add an active requirement to finish setup.' : 'Up to five active requirements. Required and optional items apply to new applications.'}</p>
            </div>
          </div>}
          <div role="tablist" aria-label="Document requirement status" className="mt-7 flex gap-6 border-b border-slate-200">
            {(['Active', 'Inactive', 'All'] as const).map((option,index,options) => <button
              key={option} id={`${checklistId}-${option}`} type="button" role="tab" aria-label={option}
              aria-selected={filter === option} aria-controls={`${checklistId}-panel`} tabIndex={filter === option ? 0 : -1}
              onClick={() => setFilter(option)}
              onKeyDown={event => {
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowRight' ? (index + 1) % options.length : event.key === 'ArrowLeft' ? (index + options.length - 1) % options.length : null;
                if (next === null) return;
                event.preventDefault(); setFilter(options[next]); document.getElementById(`${checklistId}-${options[next]}`)?.focus();
              }}
              className={`card-value -mb-px border-b-2 px-1 pb-3 pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${filter === option ? 'border-brand-navy text-brand-navy' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}>
              {option} <span className="ml-1 font-normal text-slate-500">({option === 'All' ? requirements.length : requirements.filter(item => option === 'Active' ? item.isActive : !item.isActive).length})</span>
            </button>)}
          </div>
        </div>
        <div id={`${checklistId}-panel`} role="tabpanel" aria-labelledby={`${checklistId}-${filter}`} tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-navy">
        {loading ? <LoadingState message="Loading document requirements..." /> : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          noDocumentsRequired ? <p className="card-description px-6 py-7">No checklist items in this view. Change the filter to view saved items.</p> : <EmptyState className="px-6" title={requirements.length === 0 ? 'No requirements added yet' : `No ${filter.toLowerCase()} requirements`} description={requirements.length === 0 ? 'Add your first item to complete setup.' : 'Choose another tab to view saved requirements.'} />
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
                      <button type="button" disabled={loading || saving || !!error} onClick={() => openEdit(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" title="Edit requirement">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </section>

      <details data-configuration-history className="group rounded-lg border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-5 [&::-webkit-details-marker]:hidden">
          <ClipboardList className="h-4 w-4 text-slate-500" />
          <h2 className="section-label">Configuration history</h2><span className="card-description">({audits.length})</span><span aria-hidden="true" className="ml-auto text-slate-400 group-open:rotate-180">⌄</span>
        </summary>
        {audits.length === 0 ? (
          <p className="card-description px-5 py-6">No configuration changes recorded.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {audits.slice((historyPage - 1) * 10, historyPage * 10).map((audit) => (
              <div data-audit-entry key={audit.id} className="grid gap-3 border-t border-slate-100 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] [overflow-wrap:anywhere]">
                <div>
                  <p className="card-value text-slate-800">{audit.action === 'SETUP' ? (audit.afterValues.noDocumentsRequired ? 'No documents required' : 'Document checklist selected') : `${audit.requirementLabel} · ${audit.action === 'CREATE' ? 'Created' : 'Updated'}`}</p>
                  <p className="card-description mt-1">{audit.reason || 'Initial configuration.'}</p>
                </div>
                <p className="card-description sm:text-right">{audit.actorName}<br />{new Date(audit.createdAt).toLocaleString('en-GB')}</p>
              </div>
            ))}
          </div>
        )}
        {audits.length > 10 && <div className="border-t border-slate-100 px-5 py-4"><WorkspacePagination page={historyPage} pageCount={Math.ceil(audits.length / 10)} total={audits.length} noun="changes" onPage={setHistoryPage} /></div>}
      </details>

      <DraftNavigationGuard dirty={dirty} busy={saving} onDiscard={() => setDialogOpen(false)} />
      <PortalModal isOpen={dialogOpen} onClose={requestClose} busy={saving} labelledBy={titleId} className="max-w-2xl p-0">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div><h2 id={titleId} className="section-heading">{setupDialog ? 'Change document policy' : editing ? 'Edit document requirement' : 'Add document requirement'}</h2>
            <p className="card-description mt-1">Applies to future supervisor applications.</p></div>
          <button type="button" className="icon-button h-9 w-9 shrink-0" aria-label="Close document requirement" disabled={saving} onClick={requestClose}><X className="h-4 w-4" aria-hidden="true" /></button>
        </header>
        <form onSubmit={save}><fieldset disabled={saving}>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {setupDialog ? <>
                <fieldset className="space-y-3">
                  <legend className="section-label mb-3">Supporting documents for new applications</legend>
                  {[{value:false,label:'Use a document checklist',description:'Choose required and optional uploads.'},{value:true,label:'No documents required',description:'Students can submit without uploading documents.'}].map(option => <label key={String(option.value)} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-4 ${policyChoice === option.value ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'}`}>
                    <input type="radio" name="document-policy" value={option.value ? 'none' : 'checklist'} checked={policyChoice === option.value} disabled={option.value && activeCount > 0} onChange={() => setPolicyChoice(option.value)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-navy" />
                    <span><span className="card-value block text-slate-800">{option.label}</span><span className="card-description mt-1 block">{option.value && activeCount > 0 ? 'Deactivate active checklist items before selecting this policy.' : option.description}</span></span>
                  </label>)}
                </fieldset>
                {!policyChoice && noDocumentsRequired && <p className="card-description">Add an active checklist item after saving to complete setup.</p>}
                <label className="block"><span className="form-label">Reason for change</span><textarea required maxLength={2000} className="form-control form-control-md mt-1.5 min-h-24" value={reason} onChange={event => setReason(event.target.value)} /></label>
              </> : <>
              <label className="block"><span className="form-label">Label</span><input className="form-control form-control-md mt-1.5" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} required /></label>
              <label className="block"><span className="form-label">Guidance</span><textarea className="form-control form-control-md mt-1.5 min-h-28" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label className="block"><span className="form-label">Display order</span><input type="number" min={0} className="form-control form-control-md mt-1.5" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} /></label>
              <label className="flex items-center justify-between border-b border-slate-100 py-3 text-xs font-bold text-slate-700"><span>Required for submission</span><input type="checkbox" checked={form.isRequired} onChange={(event) => setForm({ ...form, isRequired: event.target.checked })} /></label>
              <label className="flex items-center justify-between border-b border-slate-100 py-3 text-xs font-bold text-slate-700"><span>Active</span><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /></label>
              {editing && <label className="block"><span className="form-label">Reason for change</span><textarea className="form-control form-control-md mt-1.5 min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}
              </>}
              {saveError && <p role="alert" className="card-description rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{saveError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <PortalButton type="button" variant="secondary" onClick={requestClose}>Cancel</PortalButton>
              <PortalButton type="submit" variant="primary" disabled={saving || (setupDialog ? (!reason.trim() || policyChoice === noDocumentsRequired || (policyChoice && requirements.some(item => item.isActive))) : !form.label.trim() || Boolean(editing && !reason.trim()))}>{saving ? 'Saving...' : 'Save changes'}</PortalButton>
            </div>
          </fieldset></form>
      </PortalModal>
      {discard.dialog}
    </div>
  );
};

export const SupervisorDocumentRequirements: React.FC<Props> = props => <DecisionFeedbackProvider scopeKey="supervisor-requirements"><RequirementsContent {...props}/></DecisionFeedbackProvider>;
