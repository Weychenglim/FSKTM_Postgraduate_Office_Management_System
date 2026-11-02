import { PortalSelect } from './PortalSelect';
import { useReturnToFocusReload } from '../utils/returnToFocus';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CoordinatorDelegation, CoordinatorDelegationInput, CoordinatorDelegationOptions } from '../types/coordinatorDelegation';
import { createCoordinatorDelegation, getCoordinatorDelegationOptions, getCoordinatorDelegations, revokeCoordinatorDelegation } from '../services/coordinatorDelegationsApi';
import { ApiError } from '../services/apiClient';
import { malaysiaToday, validateDelegation } from '../utils/coordinatorDelegations';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { ErrorState, LoadingState } from './StateViews';

export function CoordinatorDelegationCard({ grant, office, onRevoke }: { grant: CoordinatorDelegation; office: boolean; onRevoke: (grant: CoordinatorDelegation) => void }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="section-label">{grant.programme} · {grant.coordinator.name}</h4><StatusBadge tone={grant.status === 'ACTIVE' ? 'success' : grant.status === 'REVOKED' ? 'danger' : 'neutral'}>{grant.status}</StatusBadge></div>
    <p className="card-description">{grant.startsOn} to {grant.endsOn} (inclusive, Malaysia time)</p>
    <p className="card-description whitespace-pre-wrap">{grant.justification}</p>
    <p className="card-description text-slate-500">Granted by {grant.grantedBy.name} · {new Date(grant.createdAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</p>
    {grant.revokedAt && <p className="card-description text-rose-700 whitespace-pre-wrap">Revoked by {grant.revokedBy?.name ?? 'Office'} · {new Date(grant.revokedAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}: {grant.revocationReason}</p>}
    {office && grant.canRevoke && <PortalButton variant="danger" onClick={() => onRevoke(grant)}>Revoke</PortalButton>}
  </article>;
}

/** Read-only dashboard context; Office keeps the full delegation management view. */
export function CoordinatorProgrammeSummary({ regularProgramme, effectiveProgrammes, rows, loading = false, error, onRetry }: {
  regularProgramme: string; effectiveProgrammes: string[]; rows: CoordinatorDelegation[];
  loading?: boolean; error?: string | null; onRetry?: () => void;
}) {
  const cover = rows.filter(row => row.status === 'ACTIVE' || row.status === 'SCHEDULED');
  const history = rows.filter(row => row.status === 'EXPIRED' || row.status === 'REVOKED');
  const additionalAccess = effectiveProgrammes.filter(programme => programme !== regularProgramme && !cover.some(row => row.programme === programme));
  return <section aria-label="Your programme" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="section-label">Your programme</h2>
    <p className="mt-2 text-sm font-normal leading-6 text-slate-800 [overflow-wrap:anywhere]">{regularProgramme || 'No regular programme assigned.'}</p>
    {additionalAccess.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4"><h3 className="section-label">Additional programme access</h3><ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">{additionalAccess.map(programme => <li key={programme}>{programme}</li>)}</ul></div>}
    {loading && <p role="status" className="mt-3 card-description">Checking temporary programme cover…</p>}
    {error && <div className="mt-4"><ErrorState message={error} onRetry={onRetry} /></div>}
    {!loading && !error && cover.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4">
      <h3 className="section-label">Temporary programme cover</h3>
      <ul className="mt-3 space-y-4">{cover.map(grant => <li key={grant.id} className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-normal leading-6 text-slate-800 [overflow-wrap:anywhere]">{grant.programme}</p><StatusBadge tone={grant.status === 'ACTIVE' ? 'success' : 'neutral'}>{grant.status === 'ACTIVE' ? 'Active' : 'Scheduled'}</StatusBadge></div>
        <p className="mt-1 card-description">{grant.startsOn} to {grant.endsOn} (Malaysia)</p>
      </li>)}</ul>
    </div>}
    {!loading && !error && history.length > 0 && <details className="mt-4 border-t border-slate-100 pt-4">
      <summary className="cursor-pointer rounded-sm text-xs font-semibold leading-6 text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600">Access history ({history.length})</summary>
      <div className="mt-3 space-y-3">{history.map(grant => <CoordinatorDelegationCard key={grant.id} grant={grant} office={false} onRevoke={() => {}} />)}</div>
    </details>}
  </section>;
}

const blank = (): CoordinatorDelegationInput => ({ programme: '', coordinatorId: 0, startsOn: malaysiaToday(), endsOn: '', justification: '' });
const fieldClass = 'text-xs font-bold font-sans normal-case tracking-normal mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-800';
export function CoordinatorDelegations({ office = false, regularProgramme = '', effectiveProgrammes = [], onRefreshScope }: { office?: boolean; regularProgramme?: string; effectiveProgrammes?: string[]; onRefreshScope?: () => void }) {
  const [rows, setRows] = useState<CoordinatorDelegation[]>([]);
  const [options, setOptions] = useState<CoordinatorDelegationOptions>({ programmes: [], coordinators: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState(blank);
  const [revoking, setRevoking] = useState<CoordinatorDelegation | null>(null);
  const [reason, setReason] = useState('');
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError(null);
    try {
      const [grants, choices] = await Promise.all([getCoordinatorDelegations(current.signal), office ? getCoordinatorDelegationOptions(current.signal) : Promise.resolve(null)]);
      if (current.signal.aborted) return;
      setRows(grants);
      if (choices) setOptions(choices);
    } catch (failure) {
      if (!current.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load coordinator delegations.');
    } finally { if (!current.signal.aborted) setLoading(false); }
  }, [office]);
  useEffect(() => { void load(); return () => controller.current?.abort(); }, [load]);
  useReturnToFocusReload(() => { if (onRefreshScope) onRefreshScope(); else void load(); }, !loading && !saving && !creating && !revoking);
  const cancel = () => { setCreating(false); setRevoking(null); setReason(''); setValues(blank()); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = revoking ? (!reason.trim() ? 'A revocation reason is required.' : null) : validateDelegation(values);
    if (validation) { setError(validation); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      if (revoking) await revokeCoordinatorDelegation(revoking.id, reason.trim());
      else await createCoordinatorDelegation({ ...values, justification: values.justification.trim() });
      cancel(); setMessage('Coordinator delegation saved.'); await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the delegation.');
      if (failure instanceof ApiError && failure.status === 409) { cancel(); await load(); }
    } finally { setSaving(false); }
  };
  if (!office) return <CoordinatorProgrammeSummary regularProgramme={regularProgramme} effectiveProgrammes={effectiveProgrammes} rows={rows} loading={loading} error={error} onRetry={() => void load()} />;
  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4 text-xs" aria-label="Acting coordinator delegations">
    <div className="flex flex-wrap justify-between gap-3"><h3 className="section-label">Acting coordinator delegations</h3><div className="flex gap-2">{office && !creating && !revoking && <PortalButton disabled={loading || saving} onClick={() => { setCreating(true); setError(null); }}>Grant acting access</PortalButton>}</div></div>
    <p className="card-description">Grant full coordinator access to an additional programme while retaining the coordinator’s regular programme. Only one acting coordinator may cover a programme at a time. Dates are inclusive in Malaysia time. To correct a grant, revoke it and create a new one.</p>
    {error && <ErrorState message={error} onRetry={!saving && !creating && !revoking ? () => void load() : undefined} />}{message && <p role="status" className="card-description text-emerald-700">{message}</p>}
    {office && (creating || revoking) && <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 border border-slate-200">
      {revoking ? <><h4 className="section-label">Revoke access to {revoking.programme} for {revoking.coordinator.name}</h4><label className="form-label block">Revocation reason<textarea required className={fieldClass} value={reason} onChange={e => setReason(e.target.value)} disabled={saving} /></label></> : <>
        <div className="grid gap-3 sm:grid-cols-2"><label className="form-label">Additional programme<PortalSelect required className={fieldClass} value={values.programme} disabled={saving} onChange={e => setValues({ ...values, programme: e.target.value, coordinatorId: 0 })}><option value="">Select programme</option>{options.programmes.map(p => <option key={p}>{p}</option>)}</PortalSelect></label>
        <label className="form-label">Active coordinator<PortalSelect required className={fieldClass} value={values.coordinatorId || ''} disabled={saving || !values.programme} onChange={e => setValues({ ...values, coordinatorId: Number(e.target.value) })}><option value="">Select coordinator</option>{options.coordinators.filter(c => c.programme !== values.programme).map(c => <option key={c.id} value={c.id}>{c.name} · {c.programme}</option>)}</PortalSelect></label>
        <label className="form-label">Start date (Malaysia)<input type="date" required min={malaysiaToday()} className={fieldClass} value={values.startsOn} disabled={saving} onChange={e => setValues({ ...values, startsOn: e.target.value })} /></label>
        <label className="form-label">End date (inclusive)<input type="date" required min={values.startsOn || malaysiaToday()} className={fieldClass} value={values.endsOn} disabled={saving} onChange={e => setValues({ ...values, endsOn: e.target.value })} /></label></div>
        <label className="form-label block">Justification<textarea required className={fieldClass} value={values.justification} disabled={saving} onChange={e => setValues({ ...values, justification: e.target.value })} /></label>
      </>}
      <div className="flex gap-2"><PortalButton type="submit" variant={revoking ? 'danger' : 'primary'} isLoading={saving}>{revoking ? 'Confirm revocation' : 'Create grant'}</PortalButton><PortalButton disabled={saving} onClick={cancel}>Cancel</PortalButton></div>
    </form>}
    {loading ? <LoadingState message="Loading coordinator delegations…" /> : <><h4 className="section-label">Current, scheduled and historical grants</h4>{rows.length === 0 ? <p className="card-description">No coordinator delegations recorded.</p> : rows.map(grant => <CoordinatorDelegationCard key={grant.id} grant={{ ...grant, canRevoke: grant.canRevoke && !saving }} office={office} onRevoke={grant => { setRevoking(grant); setCreating(false); setReason(''); setError(null); }} />)}</>}
  </section>;
}
