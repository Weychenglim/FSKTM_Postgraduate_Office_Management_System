import { ClosurePreviewSession } from '../utils/closurePreview';
import React, { useEffect, useRef, useState } from 'react';
import type { ClosureApproval, ClosurePreview } from '../types/marks';
import { getClosurePreview } from '../services/marksCompletionApi';
import { ApiError } from '../services/apiClient';
import { PortalButton } from './PortalPrimitives';
import { AlertTriangle } from 'lucide-react';

export function ClosureSummary({ preview, retireUnfinished = false }: { preview: ClosurePreview; retireUnfinished?: boolean }) {
  return <section aria-label="Closure preview" className="space-y-3 text-xs">
    <h3 className="section-label">Unfinished marks review</h3>
    {retireUnfinished ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="space-y-2"><h4 className="text-sm font-bold">Closing this period retires all unfinished evaluation tasks</h4>
        <p className="text-sm leading-6">Lecturers will no longer be able to complete these tasks. Any extra-time windows for them will end. Submitted marks, saved drafts and history will be preserved.</p></div>
    </div> : <p className="card-description">Closing preserves existing marks. Only separately granted completion windows allow eligible unfinished tasks to continue.</p>}
    <div className="overflow-auto"><table className="data-table"><thead><tr>{['Period','Submitted','Not started','Draft','Paused','Active windows','Unfinished'].map(label=><th className="data-th p-2" key={label}>{label}</th>)}</tr></thead>
    <tbody>{[...preview.periods, { ...preview.totals, periodId: -1, name: 'Total' }].map(row=><tr key={row.periodId}><th className="data-td-strong p-2">{row.name}</th>{[row.submitted,row.notStarted,row.draft,row.paused,row.activeWindows,row.unfinished].map((count,i)=><td className="data-td p-2" key={i}>{count}</td>)}</tr>)}</tbody></table></div>
  </section>;
}
export function ClosureReview({ kind, id, disabled, confirmLabel='Confirm closure / handover', onAcknowledgementChange, onBlocked, onConfirm, children }: { children?: React.ReactNode; kind: 'semester' | 'handover' | 'period'; id: number; disabled: boolean; confirmLabel?: string; onAcknowledgementChange?: (acknowledged:boolean)=>void; onBlocked?: (error:ApiError)=>void; onConfirm: (approval: ClosureApproval) => Promise<void> }) {
  const session = useRef(new ClosurePreviewSession());
  const [preview,setPreview]=useState<ClosurePreview|null>(null);
  const [acknowledged,setAcknowledged]=useState(false);
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let current=true; const generation = session.current.begin(); setPreview(null); setAcknowledged(false); onAcknowledgementChange?.(false); setError('');
    getClosurePreview(kind,id).then(value=>{if(current && session.current.accept(generation, value))setPreview(value)}).catch(reason=>{if(current)setError(reason instanceof Error?reason.message:'Unable to load closure preview.');});
    return ()=>{current=false;session.current.invalidate();};
  },[kind,id,revision]);
  const confirm=async()=>{
    if(!preview || busy || disabled || (preview.requiresAcknowledgement && !acknowledged))return;
    const approval=session.current.approval(preview,acknowledged);
    if(!approval)return;
    session.current.invalidate();
    setBusy(true);setError('');
    try { await onConfirm(approval); setPreview(null); }
    catch(reason){setPreview(null);setAcknowledged(false);onAcknowledgementChange?.(false);if(reason instanceof ApiError && (reason.status===403||reason.status===409))onBlocked?.(reason);if(reason instanceof ApiError && reason.status===409)setRevision(v=>v+1);else setError(reason instanceof Error?reason.message:'Unable to complete transition.');}
    finally{setBusy(false);}
  };
  return <div className={kind === 'period' ? 'space-y-4' : 'my-4 space-y-4 border-y border-slate-200 py-4'}>
    {error?<p role="alert" className="card-description text-red-700">{error}</p>:null}
    {preview?<><ClosureSummary preview={preview} retireUnfinished={kind === 'period'}/>{preview.requiresAcknowledgement?<label className="card-description flex items-start gap-3 text-slate-700"><input className="mt-0.5 shrink-0" type="checkbox" checked={acknowledged} onChange={e=>{setAcknowledged(e.target.checked);onAcknowledgementChange?.(e.target.checked);}} disabled={busy}/><span>{kind === 'period' ? 'I understand that closing this period will retire its unfinished tasks and end their extra-time windows.' : 'I acknowledge the unfinished tasks and active completion windows shown above.'}</span></label>:null}</>:!error?<p className="card-description">Loading closure preview…</p>:null}
    {children}
    <div className="flex gap-2">{error?<PortalButton disabled={busy} onClick={()=>setRevision(v=>v+1)}>Retry</PortalButton>:null}<PortalButton variant={kind === 'period' ? 'dangerSolid' : 'primary'} disabled={disabled||busy||!preview||(preview.requiresAcknowledgement&&!acknowledged)} onClick={()=>void confirm()}>{confirmLabel}</PortalButton></div>
  </div>;
}
