import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Archive, CheckCircle2, Clock3, Gauge, RefreshCw} from 'lucide-react';
import type {AcademicSemester, SemesterActivationReadiness} from '../types/academicSemester';
import type {ClosurePreview} from '../types/marks';
import {activateAcademicSemester, getSemesterActivationReadiness} from '../services/academicSemestersApi';
import {getClosurePreview} from '../services/marksCompletionApi';
import {completeDecision} from '../utils/decisionSubmission';
import {ClosurePreviewSession} from '../utils/closurePreview';
import {PortalButton, StatusBadge} from './PortalPrimitives';
import {OfficeToolSection} from './OfficeToolPrimitives';
import {ClosureSummary} from './ClosureReview';
import {DecisionDialog} from './DecisionDialog';

export function SemesterActivationSection({semester, dirty, busy, onCapacity, onArchive, onActivated}: {
  semester: AcademicSemester; dirty: boolean; busy: boolean;
  onCapacity?: (id:number)=>void; onArchive: ()=>void; onActivated: (saved:AcademicSemester)=>Promise<void>;
}) {
  const [readiness,setReadiness]=useState<SemesterActivationReadiness|null>(null);
  const [checking,setChecking]=useState(true);
  const [error,setError]=useState('');
  const [open,setOpen]=useState(false);
  const [reason,setReason]=useState('');
  const [preview,setPreview]=useState<ClosurePreview|null>(null);
  const [reviewError,setReviewError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const [acknowledged,setAcknowledged]=useState(false);
  const generation=useRef(0);
  const session=useRef(new ClosurePreviewSession()).current;
  const isDraft=semester.lifecycleStatus==='DRAFT';

  const refresh=useCallback(async()=>{
    const request=++generation.current;
    setChecking(true);setError('');setReadiness(null);
    try {
      const data=await getSemesterActivationReadiness(semester.id);
      if(data.semesterId!==semester.id)throw Error('The semester changed. Reload its activation checks.');
      if(request===generation.current)setReadiness(data);
      return data;
    } catch(failure) {
      if(request===generation.current)setError(failure instanceof Error?failure.message:'Activation checks could not be loaded.');
      throw failure;
    } finally {if(request===generation.current)setChecking(false);}
  },[semester.id]);

  useEffect(()=>{
    if(!isDraft||open)return;
    void refresh().catch(()=>{});
    const onFocus=()=>{void refresh().catch(()=>{});};
    window.addEventListener('focus',onFocus);
    const timer=window.setInterval(onFocus,60000);
    return ()=>{generation.current++;window.removeEventListener('focus',onFocus);window.clearInterval(timer);};
  },[isDraft,open,semester.startsOn,semester.endsOn,refresh]);

  useEffect(()=>{
    if(!open)return;
    let current=true;const request=session.begin();
    setPreview(null);setReviewError('');setAcknowledged(false);setChecking(true);
    Promise.all([getSemesterActivationReadiness(semester.id),getClosurePreview('handover',semester.id)])
      .then(([data,review])=>{
        if(!current)return;
        if(data.semesterId!==semester.id||review.semesterId!==(data.currentSemester?.id??null))throw Error('The current semester changed. Reload and review activation again.');
        setReadiness(data);
        if(session.accept(request,review))setPreview(review);
      }).catch(failure=>{if(current)setReviewError(failure instanceof Error?failure.message:'Activation review could not be loaded.');})
      .finally(()=>{if(current)setChecking(false);});
    return ()=>{current=false;session.invalidate();};
  },[open,attempt,semester.id,session]);

  const close=()=>{setOpen(false);setReason('');};
  const confirm=async()=>{
    if(!preview||!readiness?.canActivate||dirty||busy||!reason.trim())return false;
    const approval=session.approval(preview,acknowledged);
    if(!approval)return false;
    let saved:AcademicSemester;
    return completeDecision(async()=>{saved=await activateAcademicSemester(semester.id,reason.trim(),approval);},()=>onActivated(saved!));
  };

  return <>
    {isDraft ? <OfficeToolSection title="Activation readiness" description="Prepare this semester now. Activate it only when all checks are ready."
      actions={<><StatusBadge tone={checking?'neutral':readiness?.canActivate?'success':'warning'}>{checking?'Checking':readiness?.canActivate?'Ready':'Not ready'}</StatusBadge><PortalButton size="sm" variant="secondary" icon={RefreshCw} isLoading={checking} disabled={busy||dirty||checking} onClick={()=>{void refresh().catch(()=>{});}}>Refresh checks</PortalButton></>}>
      <div className="px-5">
        {checking&&!open ? <p role="status" className="py-5 text-sm text-slate-600">Checking semester dates and lecturer limits…</p> : null}
        {error ? <div role="alert" className="space-y-3 py-5"><p className="text-sm text-rose-700">{error}</p><PortalButton size="sm" onClick={()=>{void refresh().catch(()=>{});}}>Retry checks</PortalButton></div> : null}
        {!checking&&!error&&readiness ? <dl className="divide-y divide-slate-200">
          {readiness.checks.filter(check=>check.key!=='draft'||!check.ready).map(check=>{
            const Icon=check.ready?CheckCircle2:Clock3;
            return <div key={check.key} className="flex flex-wrap items-start gap-3 py-4">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${check.ready?'text-emerald-600':'text-amber-600'}`} aria-hidden="true"/>
              <div className="min-w-0 flex-1 basis-48"><dt className="text-sm font-semibold text-slate-900">{check.label}</dt><dd className="mt-1 text-sm leading-relaxed text-slate-600">{check.message}</dd></div>
              {check.key==='capacity'&&onCapacity ? <PortalButton size="sm" icon={Gauge} disabled={dirty||busy} onClick={()=>onCapacity(semester.id)}>Review lecturer capacity</PortalButton>:null}
            </div>;
          })}
        </dl>:null}
      </div>
      <div className="space-y-3 border-t border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PortalButton variant="primary" disabled={busy||dirty||checking||!!error||!readiness?.canActivate} onClick={()=>{setReason('');setOpen(true);}}>Review activation</PortalButton>
          <PortalButton size="sm" variant="dangerSolid" icon={Archive} disabled={busy||dirty} onClick={onArchive}>Archive draft</PortalButton>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">{dirty?'Save your changes before reviewing activation or opening lecturer capacity.':readiness&&!readiness.canActivate?'Resolve the checks above before activation.':'Activation uses Malaysia time (UTC+08:00). All checks run again when you confirm.'}</p>
      </div>
    </OfficeToolSection>:null}
    <DecisionDialog isOpen={open} decisionKey={`semester-activation-${semester.id}-${attempt}`} kind="confirmation" title="Activate semester" context={semester.label}
      message={<div className="space-y-3 text-sm leading-relaxed"><p>This semester becomes the faculty’s current semester immediately.</p>
        {readiness?.currentSemester ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"><p className="font-semibold">{readiness.currentSemester.label} will be closed.</p><p className="mt-1">Its published Marks periods will close. Existing marks stay recorded; eligible unfinished work needs separately granted completion windows.</p></div>:<p>No current active semester will be closed.</p>}
      </div>}
      confirmLabel="Activate semester" successMessage="Semester activated." busy={busy} dirty={!!reason.trim()||acknowledged}
      canConfirm={!checking&&!reviewError&&!!preview&&!!readiness?.canActivate&&!!reason.trim()&&(!preview.requiresAcknowledgement||acknowledged)&&!dirty}
      onClose={close} onConfirm={confirm} onReload={async()=>{await refresh();setAttempt(value=>value+1);}}>
      {checking?<p role="status" className="text-sm text-slate-600">Loading the latest activation review…</p>:null}
      {reviewError?<div role="alert" className="space-y-2"><p className="text-sm text-rose-700">{reviewError}</p><PortalButton size="sm" onClick={()=>setAttempt(value=>value+1)}>Retry review</PortalButton></div>:null}
      {!checking&&readiness&&!readiness.canActivate?<p role="alert" className="text-sm text-amber-800">{readiness.checks.filter(check=>!check.ready).map(check=>check.message).join(' ')}</p>:null}
      {preview ? <section className="space-y-3" aria-label="Evaluation review">
        {preview.totals.unfinished===0?<p className="text-sm text-slate-700"><strong>No unfinished evaluations.</strong> Existing submitted marks remain recorded.</p>:<>
          <p className="text-sm font-semibold text-amber-800">{preview.totals.unfinished} evaluations need attention.</p>
          <details><summary className="cursor-pointer text-sm font-semibold text-slate-700">View evaluation breakdown</summary><div className="mt-3"><ClosureSummary preview={preview}/></div></details>
        </>}
        {preview.requiresAcknowledgement?<label className="flex items-start gap-3 text-sm leading-relaxed text-slate-700"><input className="mt-1 shrink-0" type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)}/>I acknowledge the unfinished evaluations and active completion windows in this review.</label>:null}
      </section>:null}
      <div className="academic-semester-fields"><label className="form-label">Reason for activation<textarea rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" value={reason} onChange={event=>setReason(event.target.value)} placeholder="Record why this semester is being activated."/></label></div>
    </DecisionDialog>
  </>;
}
