import { MarksHeading } from './MarksPrimitives';
import { CalendarClock } from 'lucide-react';
import { DecisionDialog } from './DecisionDialog';
import { completeDecision } from '../utils/decisionSubmission';
import React, { useEffect, useRef, useState } from 'react';
import type { CompletionWindow, EvaluationPreviewTask } from '../types/marks';
import { grantCompletionWindows, getCompletionWindows, revokeCompletionWindow } from '../services/marksCompletionApi';
import { PortalButton } from './PortalPrimitives';
import {PortalConfirmModal} from './PortalPrimitives';
import {DraftNavigationGuard} from './DraftNavigationGuard';
import {ErrorState} from './StateViews';
import { malaysiaDeadline, formatMalaysiaDateTime as date } from '../utils/malaysiaDateTime';

export { malaysiaDeadline } from '../utils/malaysiaDateTime';
export function CompletionWindowHistory({ windows, onRevoke }: { windows: CompletionWindow[]; onRevoke: (window: CompletionWindow) => void }) {
  return <div className="divide-y divide-slate-200">{windows.length ? windows.map(window => <article key={window.id} className="space-y-1 py-3 text-sm">
    <p className="card-value">{window.status} · Due {date(window.deadline)}</p>
    <p className="card-description">{window.reason}</p><p className="card-description">Granted by {window.grantedBy.name} · {date(window.createdAt)}</p>
    {window.supersedesId ? <p className="card-description">Replaces window #{window.supersedesId}</p> : null}
    {window.revokedAt ? <p className="card-description">Revoked {date(window.revokedAt)} · {window.revocationReason}</p> : null}
    {window.canRevoke ? <PortalButton onClick={() => onRevoke(window)}>Revoke window</PortalButton> : null}
  </article>) : <p className="card-description">No completion windows for this task.</p>}</div>;
}
export function MarksCompletionWindows({ tasks, onChanged }: { tasks: EvaluationPreviewTask[]; onChanged: () => Promise<void> }) {
  const [confirmationKey,setConfirmationKey] = useState('');
  const committed=useRef(false);
  const [confirmation,setConfirmation] = useState<'grant'|'revoke'|null>(null);
  const [selected,setSelected] = useState<number[]>([]);
  const [deadline,setDeadline] = useState('');
  const [reason,setReason] = useState('');
  const [historyTask,setHistoryTask] = useState<number|null>(null);
  const [windows,setWindows] = useState<CompletionWindow[]>([]);
  const [revoke,setRevoke] = useState<CompletionWindow|null>(null);
  const [revokeReason,setRevokeReason] = useState('');
  const [busy,setBusy] = useState(false);
  const [historyLoading,setHistoryLoading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [awaitingLatest,setAwaitingLatest] = useState(false);
  const [discardAction,setDiscardAction] = useState<null|(()=>void)>(null);
  const requestId=useRef(0);
  const grantDirty=selected.length>0||!!deadline||!!reason.trim();
  const revokeDirty=!!revokeReason.trim();
  const eligibleSelected=selected.length>0&&selected.every(id=>tasks.some(task=>task.taskId===id&&task.canGrantCompletionWindow));
  const selectedTasks=selected.map(id=>tasks.find(task=>task.taskId===id)).filter((task):task is EvaluationPreviewTask=>!!task);
  const historyIdentity=tasks.find(task=>task.taskId===historyTask);
  const taskIdentity=(task:EvaluationPreviewTask)=>`${task.studentName} · ${task.studentId} · Task #${task.taskId} · ${task.panelMember} · ${task.evaluatorRoleLabel||task.evaluatorRole||'Evaluator'} · ${task.semester}`;
  const resolveRevoke=(action:()=>void)=>{if(revokeDirty)setDiscardAction(()=>action);else action();};
  const loadHistory=async(id:number,propagateError=false,preserveRevoke=false)=>{
    const current=++requestId.current;setHistoryTask(id);setWindows([]);if(!preserveRevoke){setRevoke(null);setRevokeReason('');}setHistoryLoading(true);setError('');
    try{const result=await getCompletionWindows(id);if(current===requestId.current)setWindows(result.windows);}
    catch(error){if(current===requestId.current)setError(error instanceof Error?error.message:'Unable to load history.');if(propagateError)throw error;}
    finally{if(current===requestId.current)setHistoryLoading(false);}
  };
  useEffect(()=>()=>{requestId.current+=1;},[]);
  const refresh=async()=>{await onChanged();if(historyTask)await loadHistory(historyTask,true,true);};
  const grant=async()=>{
    if(busy||awaitingLatest||!eligibleSelected||!reason.trim())return false;
    const due=malaysiaDeadline(deadline);
    if(new Date(due).getTime()<=Date.now())throw new Error('Deadline must be in the future.');
    setBusy(true);
    try{const outcome=await completeDecision(async()=>{
      await grantCompletionWindows({taskIds:selected,deadline:due,reason:reason.trim()});
      committed.current=true;
      setSelected([]);setDeadline('');setReason('');
    },refresh);setAwaitingLatest(!!outcome.refreshFailed);return outcome;}finally{setBusy(false);}
  };
  const revokeWindow=async()=>{
    if(!revoke||!revokeReason.trim()||busy||awaitingLatest)return false;
    setBusy(true);
    try{const outcome=await completeDecision(async()=>{
      await revokeCompletionWindow(revoke.id,revokeReason.trim());committed.current=true;
      setRevoke(null);setRevokeReason('');
    },refresh);setAwaitingLatest(!!outcome.refreshFailed);return outcome;}finally{setBusy(false);}
  };
  return <section aria-label="Completion windows" className="marks-workspace space-y-4 rounded-xl border border-slate-200 bg-white p-5">
    <DraftNavigationGuard dirty={grantDirty||revokeDirty} busy={busy}/>
    <PortalConfirmModal isOpen={!!discardAction} title="Discard unsaved changes?" message="The revocation reason has not been saved."
      confirmLabel="Discard changes" cancelLabel="Keep editing" isLoading={busy}
      onCancel={()=>setDiscardAction(null)} onConfirm={()=>{if(!busy&&discardAction){discardAction();setDiscardAction(null);}}}/>
    <DecisionDialog isOpen={confirmation!==null} kind="confirmation" decisionKey={confirmationKey}
      title={confirmation==='revoke'?'Revoke this completion window?':'Grant these completion windows?'}
      context={<div>{confirmation==='grant'?selectedTasks.map(task=><p key={task.taskId}>{taskIdentity(task)}</p>):<p>{historyIdentity?taskIdentity(historyIdentity):`Task #${historyTask}`} · Window #{revoke?.id} · Due {revoke?date(revoke.deadline):'Unknown'}</p>}</div>}
      message={confirmation==='revoke'?<><p>The evaluator loses this completion window. The period remains closed.</p><p>Reason: {revokeReason}</p></>:<><p>Allow {selected.length} selected unfinished task(s) until {deadline} (Malaysia). Existing active windows are replaced; the period remains closed.</p><p>Reason: {reason}</p></>}
      confirmLabel={confirmation==='revoke'?'Revoke completion window':'Grant completion windows'} tone="warning"
      successMessage={confirmation==='revoke'?'Completion window revoked.':'Completion windows granted.'}
      onConfirm={confirmation==='revoke'?revokeWindow:grant} onClose={()=>{committed.current=false;setConfirmation(null);}} busy={busy} onReload={async()=>{await refresh();setAwaitingLatest(false);}}/>
    <MarksHeading icon={CalendarClock}>Task completion windows</MarksHeading>
    <p className="card-description">Give selected unfinished tasks extra time across all loaded roles and periods. The evaluation table filters do not change this selection. The period stays closed; a new window replaces any active window for that task.</p>
    {awaitingLatest?<div role="alert" className="space-y-2"><p>The change was saved, but the latest data could not be loaded. Review latest data before another change.</p><PortalButton disabled={busy} onClick={async()=>{setBusy(true);try{await refresh();setAwaitingLatest(false);setError('');}catch(failure){setError(failure instanceof Error?failure.message:'Unable to load latest data.');}finally{setBusy(false);}}}>Review latest data</PortalButton></div>:null}
    {notice?<p role="status" className="card-description text-green-700">{notice}</p>:null}
    <div role="region" aria-label="Task completion eligibility" tabIndex={0} className="max-h-72 overflow-auto focus-visible:outline-2 focus-visible:outline-blue-600"><table className="w-full min-w-[560px] text-left text-sm"><caption className="sr-only">Evaluation tasks and eligibility for extra time</caption><thead><tr><th scope="col" className="p-2 text-[10px] font-extrabold">Select</th><th scope="col" className="text-[10px] font-extrabold">Task</th><th scope="col" className="text-[10px] font-extrabold">Status</th><th scope="col" className="text-[10px] font-extrabold">History</th></tr></thead><tbody>
      {tasks.filter(task=>task.taskId).map(task=><tr key={task.taskId} className="border-t border-slate-100"><td className="p-2 text-xs font-semibold"><input type="checkbox" aria-label={`Select ${task.studentName}, ${task.panelMember}, Task #${task.taskId}`} disabled={busy||(!task.canGrantCompletionWindow&&!selected.includes(task.taskId!))} checked={selected.includes(task.taskId!)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,task.taskId!]:ids.filter(id=>id!==task.taskId))}/></td><td className="text-xs font-semibold">{task.studentName} · {task.panelMember}<span className="card-description block">Task #{task.taskId} · {task.studentId} · {task.evaluatorRoleLabel || task.evaluatorRole} · {task.semester}</span></td><td className="text-xs font-semibold">{task.status}{task.completionWindow?<span className="card-description block">Window: {task.completionWindow.status}</span>:null}</td><td className="text-xs font-semibold"><PortalButton disabled={busy} onClick={()=>resolveRevoke(()=>void loadHistory(task.taskId!))}>History</PortalButton></td></tr>)}
    </tbody></table></div>
    <div className="grid gap-3 md:grid-cols-2"><label className="form-label">Deadline (Malaysia, UTC+08:00)<input type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)} disabled={busy} className="form-control mt-1"/></label><label className="form-label">Reason<textarea value={reason} onChange={e=>setReason(e.target.value)} disabled={busy} className="form-control mt-1"/></label></div>
    {!eligibleSelected&&selected.length>0?<p role="alert" className="card-description text-amber-800">A selected task is no longer eligible or loaded. Remove it before granting.</p>:null}
    <PortalButton variant="primary" disabled={busy||awaitingLatest||!eligibleSelected||!deadline||!reason.trim()} onClick={()=>{committed.current=false;setConfirmationKey(selected.join(','));setConfirmation('grant');}}>Grant to {selected.length} selected task(s)</PortalButton>
    {grantDirty?<PortalButton disabled={busy} onClick={()=>{setSelected([]);setDeadline('');setReason('');}}>Clear grant draft</PortalButton>:null}
    {historyTask?<div className="border-t pt-4"><h3 className="section-label">Completion history · Task #{historyTask}</h3>{historyLoading?<p className="card-description">Loading history…</p>:error?<ErrorState compact title="Completion history could not be loaded" message={error} onRetry={()=>loadHistory(historyTask,false,true)}/>:<CompletionWindowHistory windows={windows} onRevoke={window=>resolveRevoke(()=>{setRevoke(window);setRevokeReason('');})}/ >}{revoke?<div className="mt-3 space-y-2"><label className="form-label block">Reason for revocation<textarea className="form-control mt-1" value={revokeReason} onChange={e=>setRevokeReason(e.target.value)} disabled={busy}/></label><PortalButton disabled={busy||awaitingLatest||!revokeReason.trim()} onClick={()=>{committed.current=false;setConfirmationKey(String(revoke?.id));setConfirmation('revoke');}}>Confirm revocation</PortalButton><PortalButton disabled={busy} onClick={()=>resolveRevoke(()=>{setRevoke(null);setRevokeReason('');})}>Cancel</PortalButton></div>:null}</div>:null}
  </section>;
}
