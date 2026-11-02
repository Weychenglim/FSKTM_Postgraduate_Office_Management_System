import React,{useCallback,useEffect,useRef,useState} from 'react';
import {PortalButton,PortalCard,StatusBadge} from './PortalPrimitives';
import {PortalSelect} from './PortalSelect';
import {DecisionDialog} from './DecisionDialog';
import {EmptyState,ErrorState,LoadingState} from './StateViews';
import {WorkspacePagination} from './RequestWorkspacePrimitives';
import {RecordPage} from './RecordPage';
import {cancelLecturerAvailability,createLecturerAvailability,getLecturerAvailability,type LecturerAvailabilityContext,type LecturerAvailabilityInput,type LecturerAvailabilityRole,type LecturerAvailabilityWindow} from '../services/lecturerAvailabilityApi';
import {formatMalaysiaDate,formatMalaysiaDateTime} from '../utils/malaysiaDateTime';
import {completeDecision} from '../utils/decisionSubmission';
import {DecisionFeedbackProvider} from './DecisionFeedback';

const roleLabel=(role:LecturerAvailabilityRole)=>role==='SUPERVISOR'?'Supervisor':'Panel';
function restrictionState(row:LecturerAvailabilityWindow) {
  if(row.isCancelled)return 'Cancelled';
  if(row.isEffective)return 'In effect';
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
  return row.startsOn>today?'Scheduled':'Ended';
}
type Confirmation={key:number;kind:'create';values:LecturerAvailabilityInput;semesterLabel:string}|{key:number;kind:'cancel';row:LecturerAvailabilityWindow};

export function LecturerAvailabilityPage(props:{onBack:()=>void;onChanged?:()=>void}) {
  return <DecisionFeedbackProvider scopeKey="lecturer-availability"><LecturerAvailabilityContent {...props}/></DecisionFeedbackProvider>;
}

function LecturerAvailabilityContent({onBack,onChanged}:{onBack:()=>void;onChanged?:()=>void}) {
  const [scope,setScope]=useState<{semesterId?:number;limit:number;offset:number}>({limit:10,offset:0});
  const [data,setData]=useState<LecturerAvailabilityContext|null>(null);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [role,setRole]=useState<LecturerAvailabilityRole|''>('');
  const [startsOn,setStartsOn]=useState('');
  const [endsOn,setEndsOn]=useState('');
  const [reason,setReason]=useState('');
  const [cancellationReason,setCancellationReason]=useState('');
  const [confirmation,setConfirmation]=useState<Confirmation|null>(null);
  const [busy,setBusy]=useState(false);
  const generation=useRef(0);
  const identity=useRef(0);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
  const load=useCallback(async()=>{
    const token=++generation.current;
    setLoading(true);setLoadError('');
    try {
      const result=await getLecturerAvailability(scope);
      if(token===generation.current&&mounted.current) {
        setData(result);
        setRole(previous=>result.roles.includes(previous as LecturerAvailabilityRole)?previous:result.roles[0]??'');
      }
    } catch(error) {
      if(token===generation.current&&mounted.current)setLoadError(error instanceof Error?error.message:'Availability could not be loaded.');
      throw error;
    } finally {if(token===generation.current&&mounted.current)setLoading(false);}
  },[scope]);
  useEffect(()=>{void load().catch(()=>{});return()=>{generation.current++;};},[load]);
  const selectedSemesterId=scope.semesterId??data?.semesterId;
  const semester=data?.semesters.find(row=>row.id===selectedSemesterId);
  const writable=!!data?.canManage&&!loading&&!loadError&&!busy&&!confirmation;
  const valid=!!semester&&role!==''&&!!startsOn&&!!endsOn&&startsOn<=endsOn&&startsOn>=semester.startsOn&&endsOn<=semester.endsOn&&!!reason.trim();
  const dirty=!!startsOn||!!endsOn||!!reason.trim();
  const openCreate=(event:React.FormEvent)=>{
    event.preventDefault();
    if(!writable||!valid||!semester)return;
    setConfirmation({key:++identity.current,kind:'create',semesterLabel:semester.label,values:{semesterId:semester.id,role,startsOn,endsOn,reason:reason.trim(),confirmed:true}});
  };
  const confirm=async()=>{
    if(!confirmation||busy)return false;
    setBusy(true);
    try {
      return await completeDecision(async()=>{
        if(confirmation.kind==='create') {
          await createLecturerAvailability(confirmation.values);
          if(mounted.current){setStartsOn('');setEndsOn('');setReason('');}
        } else {
          await cancelLecturerAvailability(confirmation.row.id,cancellationReason.trim());
          if(mounted.current)setCancellationReason('');
        }
        onChanged?.();
      },load);
    } finally {if(mounted.current)setBusy(false);}
  };
  const total=data?.pagination.total??0;
  const page=Math.floor(scope.offset/scope.limit)+1;
  const pageCount=Math.max(1,Math.ceil(total/scope.limit));
  const createConfirmation=confirmation?.kind==='create'?confirmation:null;
  const cancelConfirmation=confirmation?.kind==='cancel'?confirmation:null;
  return <RecordPage title="My availability" subtitle="Set when you cannot take new Supervisor or Panel assignments." backLabel="Back to dashboard" onBack={onBack} dirty={dirty||(!!cancelConfirmation&&!!cancellationReason.trim())} busy={busy}>
    {data?<div className="max-w-md space-y-2">
      <label htmlFor="availability-semester" className="form-label">Semester</label>
      <PortalSelect id="availability-semester" className="form-control form-control-md" value={selectedSemesterId??''} disabled={busy||!!confirmation} onChange={event=>setScope(previous=>({...previous,semesterId:Number(event.target.value),offset:0}))}>
        {!data.semesters.length?<option value="">No semester available</option>:data.semesters.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
      </PortalSelect>
    </div>:null}
    {loading?<LoadingState message="Loading your availability…"/>:null}
    {loadError?<ErrorState message={loadError} onRetry={()=>void load().catch(()=>{})}/>:null}
    {data&&!loading&&!loadError?<>
      <PortalCard className="space-y-5">
        <div className="space-y-2"><h2 className="section-heading">Add a restriction</h2><p className="text-sm leading-relaxed text-slate-700">Restrictions block new assignments for the selected role during these dates. Existing assignments stay in place. Your confirmation saves the restriction without Office approval.</p></div>
        {!data.canManage?<p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">New restrictions are unavailable for this semester or your current lecturer status. Your history remains available.</p>:null}
        <form onSubmit={openCreate} className="space-y-5">
          <fieldset disabled={!writable} className="grid min-w-0 gap-4 sm:grid-cols-3">
            <div className="min-w-0 space-y-2"><label htmlFor="availability-role" className="form-label">Role</label><PortalSelect name="role" id="availability-role" className="form-control form-control-md" value={role} required onChange={event=>setRole(event.target.value as LecturerAvailabilityRole)}>
              {!data.roles.length?<option value="">No eligible role</option>:data.roles.map(value=><option key={value} value={value}>{roleLabel(value)}</option>)}
            </PortalSelect></div>
            <div className="min-w-0 space-y-2"><label htmlFor="availability-start" className="form-label">Starts on</label><input type="date" id="availability-start" className="form-control form-control-md w-full min-w-0 text-sm text-slate-900" required min={semester?.startsOn} max={semester?.endsOn} value={startsOn} onChange={event=>setStartsOn(event.target.value)}/></div>
            <div className="min-w-0 space-y-2"><label htmlFor="availability-end" className="form-label">Ends on</label><input type="date" id="availability-end" className="form-control form-control-md w-full min-w-0 text-sm text-slate-900" required min={startsOn||semester?.startsOn} max={semester?.endsOn} value={endsOn} onChange={event=>setEndsOn(event.target.value)}/></div>
            <div className="min-w-0 space-y-2 sm:col-span-3"><label htmlFor="availability-reason" className="form-label">Reason</label><textarea id="availability-reason" className="form-control form-control-md w-full text-sm text-slate-900" required rows={3} value={reason} onChange={event=>setReason(event.target.value)}/></div>
          </fieldset>
          {startsOn&&endsOn&&startsOn>endsOn?<p role="alert" className="text-sm text-rose-800">The end date must be on or after the start date.</p>:null}
          <div className="flex justify-end"><PortalButton type="submit" variant="primary" disabled={!writable||!valid}>Save restriction</PortalButton></div>
        </form>
      </PortalCard>
      <PortalCard className="min-w-0 space-y-5">
        <div className="space-y-1"><h2 className="section-heading">Restriction history</h2><p className="text-sm text-slate-700">Scheduled, effective and past restrictions for this semester. Cancelled records remain in your history.</p></div>
        {!data.restrictions.length?<EmptyState title="No restrictions recorded" description="You have no availability restrictions in this semester."/>:<ul aria-label="Availability restriction history" className="divide-y divide-slate-200">
          {data.restrictions.map(row=>{
            const status=restrictionState(row);
            return <li key={row.id} className="min-w-0 space-y-3 py-5 first:pt-0 [overflow-wrap:anywhere]">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><h3 className="text-sm font-semibold text-brand-navy">{roleLabel(row.role)} · {formatMalaysiaDate(row.startsOn)} to {formatMalaysiaDate(row.endsOn)}</h3><p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{row.reason}</p></div><StatusBadge tone={row.isEffective?'warning':row.isCancelled?'neutral':'info'}>{status}</StatusBadge></div>
              <p className="text-sm leading-relaxed text-slate-700">Recorded {formatMalaysiaDateTime(row.createdAt)}{row.createdBy?` by ${row.createdBy.name}`:''}</p>
              {row.isCancelled?<p className="text-sm leading-relaxed text-slate-800">Cancelled {formatMalaysiaDateTime(row.cancelledAt)}{row.cancelledBy?` by ${row.cancelledBy.name}`:''}. Reason: {row.cancellationReason||'Not recorded'}</p>:<PortalButton size="sm" disabled={busy||!!confirmation} onClick={()=>{setCancellationReason('');setConfirmation({key:++identity.current,kind:'cancel',row});}}>Cancel restriction</PortalButton>}
            </li>;
          })}
        </ul>}
        <WorkspacePagination page={page} pageCount={pageCount} total={total} noun="restrictions" pageSize={scope.limit} onPage={value=>setScope(previous=>({...previous,semesterId:selectedSemesterId??undefined,offset:(value-1)*previous.limit}))} onPageSize={limit=>setScope(previous=>({...previous,semesterId:selectedSemesterId??undefined,limit,offset:0}))}/>
      </PortalCard>
    </>:null}
    <DecisionDialog isOpen={!!confirmation} decisionKey={confirmation?.key} kind="confirmation" title={cancelConfirmation?'Cancel availability restriction':'Confirm availability restriction'}
      confirmLabel={cancelConfirmation?'Confirm cancellation':'Confirm restriction'} cancelLabel="Go back" tone={cancelConfirmation?'warning':'info'} busy={busy}
      canConfirm={cancelConfirmation?!!cancellationReason.trim():!!createConfirmation} dirty={!!cancelConfirmation&&!!cancellationReason.trim()}
      onClose={()=>setConfirmation(null)} onComplete={()=>{setCancellationReason('');setConfirmation(null);}} onDiscard={()=>{setCancellationReason('');setConfirmation(null);}} onConfirm={confirm} onReload={load}
      successMessage={cancelConfirmation?'Restriction cancelled. Its history has been retained.':createConfirmation&&createConfirmation.values.startsOn>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'})?'Restriction saved and scheduled for the selected dates.':'Restriction saved for the selected dates.'}
      message={createConfirmation?<div className="space-y-4 text-sm leading-relaxed text-slate-800">
        <dl className="space-y-2"><div><dt className="font-semibold">Semester</dt><dd>{createConfirmation.semesterLabel}</dd></div><div><dt className="font-semibold">Role and dates</dt><dd>{roleLabel(createConfirmation.values.role)} · {formatMalaysiaDate(createConfirmation.values.startsOn)} to {formatMalaysiaDate(createConfirmation.values.endsOn)} (inclusive)</dd></div><div><dt className="font-semibold">Reason</dt><dd className="whitespace-pre-wrap">{createConfirmation.values.reason}</dd></div></dl>
        <p>During these dates, new {roleLabel(createConfirmation.values.role)} assignments are blocked, including pending requests reaching final activation. Existing assignments remain in place.</p><p>The restriction is saved immediately without Office approval. A future start date schedules its effect for that date.</p>
      </div>:cancelConfirmation?<div className="space-y-3 text-sm leading-relaxed text-slate-800"><p>{roleLabel(cancelConfirmation.row.role)} · {formatMalaysiaDate(cancelConfirmation.row.startsOn)} to {formatMalaysiaDate(cancelConfirmation.row.endsOn)}</p><p>{cancelConfirmation.row.reason}</p><p>This removes this restriction from new assignment checks. Other restrictions and capacity limits still apply. Existing assignments and the audit history remain in place.</p></div>:null}>
      {cancelConfirmation?<div className="space-y-2"><label htmlFor="availability-cancellation-reason" className="form-label">Reason for cancellation</label><textarea id="availability-cancellation-reason" required rows={3} className="form-control form-control-md text-sm text-slate-900" value={cancellationReason} onChange={event=>setCancellationReason(event.target.value)}/></div>:null}
    </DecisionDialog>
  </RecordPage>;
}
