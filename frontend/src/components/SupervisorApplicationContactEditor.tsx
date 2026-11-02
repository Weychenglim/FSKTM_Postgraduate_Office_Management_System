import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { SupervisorStudentParticularsData } from '../types/supervisorSectionA';
import { updateSupervisorApplicationContact } from '../services/supervisorSectionAApi';
import { fieldErrors } from '../services/apiClient';
import { PortalButton, PortalConfirmModal } from './PortalPrimitives';
import { useRecordDraft } from './RecordDraft';

export function SupervisorApplicationContactEditor({ particulars, onSaved, onEditingChange, disabled = false }: {
  particulars: SupervisorStudentParticularsData;
  onSaved: (particulars: SupervisorStudentParticularsData) => void;
  onEditingChange: (editing: boolean) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(particulars.phone);
  const [address, setAddress] = useState(particulars.address);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirty = phone !== particulars.phone || address !== particulars.address;
  useRecordDraft(editing && dirty, saving);
  const close = () => { setEditing(false); onEditingChange(false); };
  const discard = () => {
    if (saving || disabled) return;
    setPhone(particulars.phone); setAddress(particulars.address);
    setError(''); setErrors({}); setDiscardOpen(false); close();
  };
  const requestClose = () => {
    if (saving || disabled) return;
    if (dirty) setDiscardOpen(true); else discard();
  };
  const save = async () => {
    if (saving || disabled) return;
    setSaving(true); setError(''); setErrors({});
    try {
      const result = await updateSupervisorApplicationContact({ phone, address });
      onSaved(result.studentParticulars);
      setSaved(true); close();
    } catch (reason) {
      const errors = fieldErrors(reason);
      setErrors(errors);
      setError(errors.phone || errors.address ? '' : reason instanceof Error ? reason.message : 'Contact details could not be saved. Try again.');
    } finally { setSaving(false); }
  };
  if (!editing) return <div className="flex flex-wrap items-center gap-3">
    <PortalButton icon={Pencil} disabled={disabled} onClick={() => {
      setPhone(particulars.phone); setAddress(particulars.address); setError(''); setErrors({}); setSaved(false);
      setEditing(true); onEditingChange(true);
    }}>Edit contact details</PortalButton>
    {saved ? <p role="status" className="text-xs text-emerald-700">Contact details saved.</p> : null}
  </div>;
  return <fieldset disabled={saving || disabled} className="space-y-4 border-t border-slate-200 pt-5">
    <legend className="sr-only">Edit contact details</legend>
    <PortalConfirmModal isOpen={discardOpen} title="Discard contact changes?"
      message="Your unsaved phone and address changes will be discarded. Other application writing will be kept."
      confirmLabel="Discard changes" cancelLabel="Keep editing" onConfirm={discard} onCancel={() => setDiscardOpen(false)} />
    <p className="text-xs text-slate-500">Changes are saved to your student profile.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <label className="card-label block" htmlFor="application-phone">Phone</label>
        <input id="application-phone" type="tel" autoComplete="tel" className="form-control form-control-md" maxLength={32} value={phone}
          onChange={event => setPhone(event.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'application-phone-error' : undefined}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }} />
        {errors.phone ? <p id="application-phone-error" role="alert" className="text-xs text-rose-700">{errors.phone}</p> : null}
      </div>
      <div className="space-y-2">
        <label className="card-label block" htmlFor="application-address">Address</label>
        <textarea id="application-address" autoComplete="street-address" className="form-control form-control-md" rows={3} maxLength={2000} value={address}
          onChange={event => setAddress(event.target.value)} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'application-address-error' : undefined} />
        {errors.address ? <p id="application-address-error" role="alert" className="text-xs text-rose-700">{errors.address}</p> : null}
      </div>
    </div>
    {error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : null}
    <div className="flex flex-wrap gap-2">
      <PortalButton variant="primary" isLoading={saving} onClick={() => void save()}>Save contact details</PortalButton>
      <PortalButton onClick={requestClose}>Cancel</PortalButton>
    </div>
  </fieldset>;
}
