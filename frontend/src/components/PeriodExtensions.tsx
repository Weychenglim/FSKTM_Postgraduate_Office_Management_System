import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ChevronDown, ChevronRight} from 'lucide-react';
import type {CompletionWindowRegisterRow as Grant} from '../types/marks';
import type {OperationalHistoryEvent} from '../types/operationalPeriods';
import {getEvaluationPeriod} from '../services/marksApi';
import {getOperationalExceptions, revokeOperationalException} from '../services/operationalPeriodsApi';
import {getPeriodCompletionWindows, revokeCompletionWindow} from '../services/marksCompletionApi';
import {formatMalaysiaDateTimeCompact as stamp} from '../utils/malaysiaDateTime';
import {completeDecision} from '../utils/decisionSubmission';
import {PortalButton, PortalCard, StatusBadge} from './PortalPrimitives';
import {PortalSelect} from './PortalSelect';
import {DecisionDialog} from './DecisionDialog';

type Props = {
  kind:'marks'|'appointment'; periodId:number; periodName:string; coverage:string; semesterLabel?:string;
  events:OperationalHistoryEvent[]; expanded:boolean; onOpen:()=>void;
  refreshing:boolean; onChanged:()=>Promise<unknown>;
};
const label=(value:string)=>value.toLowerCase().replaceAll('_',' ').replace(/^./,letter=>letter.toUpperCase());
export function deadlineChanges(events:OperationalHistoryEvent[]) {
  return events.filter(event=>typeof event.before.closesAt==='string'&&typeof event.after.closesAt==='string'
    &&new Date(event.after.closesAt).getTime()>new Date(event.before.closesAt).getTime())
    .sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()||b.id-a.id);
}
export function ExtensionSummary({activeCount,totalCount,changes,onOpen}:{activeCount:number;totalCount:number;changes:OperationalHistoryEvent[];onOpen:(tab:'individual'|'deadlines')=>void}) {
  const previous=totalCount-activeCount;
  return <section aria-label="Extensions" className="extension-view space-y-4">
    <h2 className="section-heading">Extensions</h2>
    {!totalCount&&!changes.length?<p className="card-description">No extensions yet.</p>:<div className="divide-y divide-slate-200 border-t border-slate-200">
      {changes.length?<button type="button" aria-label="View deadline changes" onClick={()=>onOpen('deadlines')} className="extension-summary-row">
        <span className="min-w-0"><span className="extension-summary-label">Common deadline</span><span className="extension-summary-value">{stamp(String(changes[0].after.closesAt))}</span><span className="extension-summary-secondary">Previous deadline: {stamp(String(changes[0].before.closesAt))}</span></span>
        <span className="extension-summary-action">{changes.length} deadline {changes.length===1?'change':'changes'} <ChevronRight aria-hidden="true" size={18}/></span>
      </button>:<div className="extension-summary-row"><span><span className="extension-summary-label">Common deadline</span><span className="extension-summary-secondary">No deadline extensions</span></span></div>}
      {totalCount?<button type="button" aria-label="View individual extra time" onClick={()=>onOpen('individual')} className="extension-summary-row">
        <span className="min-w-0"><span className="extension-summary-label">Individual extra time</span><span className="extension-summary-secondary"><span className="font-semibold text-slate-900">{activeCount} active {activeCount===1?'grant':'grants'}</span>{previous>0?` · ${previous} previous ${previous===1?'grant':'grants'}`:''}</span></span>
        <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-slate-500"/>
      </button>:<div className="extension-summary-row"><span><span className="extension-summary-label">Individual extra time</span><span className="extension-summary-secondary">No individual extra time</span></span></div>}
    </div>}
  </section>;
}

/** One register per period; preserve the filters while its parent switches page content. */
export function PeriodExtensions({kind,periodId,periodName,coverage,semesterLabel,events,expanded,onOpen,refreshing,onChanged}:Props) {
  const [grants,setGrants]=useState<Grant[]>([]);
  const [loadedEvents,setLoadedEvents]=useState<OperationalHistoryEvent[]|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const generation=useRef(0);
  const [tab,setTab]=useState<'individual'|'deadlines'>('individual');
  const [query,setQuery]=useState(''),[programme,setProgramme]=useState(''),[status,setStatus]=useState('');
  const [page,setPage]=useState(1);
  const [revoking,setRevoking]=useState<Grant|null>(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async(propagate=false)=>{
    const version=++generation.current;setLoading(true);setError('');
    try {
      if(kind==='marks') {
        const [result,period]=await Promise.all([
          getPeriodCompletionWindows(periodId),getEvaluationPeriod(periodId),
        ]);
        if(version===generation.current){setGrants(result.windows);setLoadedEvents((period.auditEvents??[]).map(event=>({...event,before:event.beforeValues,after:event.afterValues})));}
      } else {
        const result=await getOperationalExceptions(periodId);
        if(version===generation.current)setGrants(result.exceptions.map(item=>({
          id:item.id,taskId:0,studentId:item.matricNo||String(item.studentId),studentName:item.studentName||`Student ${item.studentId}`,
          programme:item.programme||'',evaluatorName:item.participantName||'—',evaluatorRole:'Participant',deadline:item.deadline,
          reason:item.reason,status:item.status,createdAt:item.createdAt,grantedBy:item.grantedBy??{id:0,name:'Office'},
          revokedAt:item.revokedAt??null,revocationReason:item.revocationReason??'',supersedesId:null,canRevoke:item.status==='ACTIVE'&&!!item.canRevoke,
        })));
      }
    } catch(failure){if(version===generation.current)setError(failure instanceof Error?failure.message:'Extensions could not be loaded.');if(propagate)throw failure;}
    finally {if(version===generation.current)setLoading(false);}
  },[kind,periodId]);
  useEffect(()=>{if(!refreshing)void load();return()=>{generation.current+=1;};},[load,refreshing]);
  const changes=deadlineChanges(loadedEvents??events);
  const options=[...new Set(grants.map(item=>item.programme).filter(Boolean))].sort();
  const statuses=[...new Set(grants.map(item=>item.status))].sort();
  const filtered=grants.filter(item=>(!programme||item.programme===programme)&&(!status||item.status===status)
    &&`${item.studentName} ${item.studentId} ${item.evaluatorName} ${item.evaluatorRole}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/10)),currentPage=Math.min(page,pages);
  const visible=filtered.slice((currentPage-1)*10,currentPage*10);
  const activeCount=grants.filter(item=>item.status==='ACTIVE').length;
  const retry=<PortalButton size="sm" onClick={()=>void load()}>Retry</PortalButton>;
  const state=loading||refreshing?<p role="status" className="card-description">Loading extensions…</p>:error?<div role="alert" className="space-y-3"><p className="card-description">{error}</p>{retry}</div>:null;
  if(!expanded)return <PortalCard>{state?<section aria-label="Extensions" className="space-y-4"><h2 className="section-heading">Extensions</h2>{state}</section>:<ExtensionSummary activeCount={activeCount} totalCount={grants.length} changes={changes} onOpen={selected=>{setTab(selected);onOpen();}}/>}</PortalCard>;
  return <div className="extension-view space-y-5">
    <PortalCard className="extension-context">
      <div><p className="extension-context-kicker">{kind==='marks'?'Evaluation window':'Submission window'}</p><h2 className="extension-context-title">{periodName}</h2></div>
      <dl className="extension-context-facts">{semesterLabel?<div><dt>Semester</dt><dd>{semesterLabel}</dd></div>:null}<div><dt>Coverage</dt><dd>{coverage}</dd></div></dl>
    </PortalCard>
    <PortalCard className="extension-register">
      <div className="extension-view-switch" aria-label="Extension views">
        <button type="button" aria-pressed={tab==='individual'} onClick={()=>setTab('individual')}>Individual extra time</button>
        <button type="button" aria-pressed={tab==='deadlines'} onClick={()=>setTab('deadlines')}>Deadline changes</button>
      </div>
      {state??(tab==='deadlines'?<section aria-label="Deadline changes">
        <div className="extension-section-heading"><div><h2>Deadline changes</h2><p>Common deadline extensions for this window.</p></div><span>{changes.length} {changes.length===1?'change':'changes'}</span></div>
        {!changes.length?<p className="card-description py-5">No common deadline extensions recorded.</p>:<ol className="extension-history">{changes.map(event=><li key={event.id}>
          <div className="extension-history-header"><h3>Deadline extended</h3><p>Changed by {event.actorName} <span aria-hidden="true">·</span> <time dateTime={event.createdAt}>{stamp(event.createdAt)}</time></p></div>
          <dl className="extension-history-dates"><div><dt>Previous deadline</dt><dd>{stamp(String(event.before.closesAt))}</dd></div><div><dt>New deadline</dt><dd>{stamp(String(event.after.closesAt))}</dd></div></dl>
          <dl className="extension-history-details"><div><dt>Coverage</dt><dd>{event.after.programmeScope==='SELECTED'&&Array.isArray(event.after.programmes)?event.after.programmes.join(', '):event.after.programmeScope==='ALL'?'All programmes':coverage}</dd></div><div><dt>Reason</dt><dd>{event.reason||'No reason recorded.'}</dd></div></dl>
        </li>)}</ol>}
      </section>:<section aria-label="Individual extra time" className="space-y-4">
        <div className="extension-section-heading"><div><h2>Individual extra time</h2><p>Review grants and their current status.</p></div></div>
        <div className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <label className="form-label">Find a student or evaluator<input type="search" className="form-control form-control-md mt-1" placeholder="Name or student ID" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}}/></label>
          <label className="form-label">Programme<PortalSelect className="form-control form-control-md mt-1" value={programme} onChange={event=>{setProgramme(event.target.value);setPage(1);}}><option value="">All programmes</option>{options.map(option=><option key={option}>{option}</option>)}</PortalSelect></label>
          <label className="form-label">Extension status<PortalSelect className="form-control form-control-md mt-1" value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}><option value="">All statuses</option>{statuses.map(option=><option key={option} value={option}>{label(option)}</option>)}</PortalSelect></label>
        </div>
        <div className="flex items-center justify-between gap-3"><p role="status" className="card-caption">{filtered.length} {filtered.length===1?'grant':'grants'}</p>{query||programme||status?<PortalButton size="sm" onClick={()=>{setQuery('');setProgramme('');setStatus('');setPage(1);}}>Clear filters</PortalButton>:null}</div>
        {!filtered.length?<p className="card-description py-5">{grants.length?'No grants match these filters.':'No individual extra time has been granted.'}</p>:<>
          <div className="hidden grid-cols-[1.5fr_1.3fr_1.2fr_1fr] gap-4 border-b border-slate-200 px-3 pb-3 text-xs font-semibold text-slate-500 md:grid" aria-hidden="true"><span>Student</span><span>{kind==='marks'?'Evaluator':'Participant'}</span><span>Personal deadline</span><span>Extension status</span></div>
          <div className="divide-y divide-slate-200">{visible.map(item=><details key={item.id} className="group">
            <summary className="cursor-pointer list-none rounded-md px-3 py-4 focus-visible:outline-2 focus-visible:outline-indigo-600 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="grid items-start gap-3 md:grid-cols-[1.5fr_1.3fr_1.2fr_1fr] md:gap-4">
                <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{item.studentName}</span><span className="card-caption block mt-1">{item.studentId}</span><span className="card-caption block mt-1">{item.programme||'Programme unavailable'}</span></span>
                <span><span className="block text-sm text-slate-800">{item.evaluatorName}</span><span className="card-caption block mt-1">{item.evaluatorRole}</span></span>
                <span><span className="card-caption block md:hidden">Personal deadline</span><time dateTime={item.deadline} className="text-sm leading-6 text-slate-800">{stamp(item.deadline)}</time></span>
                <span className="flex items-center justify-between gap-2"><StatusBadge tone={item.status==='ACTIVE'?'info':'neutral'}>{label(item.status)}</StatusBadge><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 group-open:rotate-180"/></span>
              </span>
            </summary>
            <div className="space-y-4 rounded-lg bg-slate-50 p-4 mb-4 text-sm">
              {item.submissionStatus?<p><span className="text-slate-500">Submission status: </span>{label(item.submissionStatus)}</p>:null}
              <div><p className="font-medium text-slate-900">Reason</p><p className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">{item.reason}</p></div>
              <p className="card-description">Granted by {item.grantedBy.name} · {stamp(item.createdAt)}</p>
              {item.taskId?<p className="card-caption">Task #{item.taskId} · Grant #{item.id}{item.supersedesId?` · Replaces grant #${item.supersedesId}`:''}</p>:null}
              {item.revokedAt?<p className="card-description">Revoked {stamp(item.revokedAt)} · {item.revocationReason}</p>:null}
              {item.canRevoke?<PortalButton size="sm" variant="dangerSolid" disabled={busy||loading||refreshing||!!error} onClick={()=>{setReason('');setRevoking(item);}}>Revoke extra time</PortalButton>:null}
            </div>
          </details>)}</div>
          {pages>1?<nav aria-label="Extension pages" className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4"><PortalButton size="sm" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</PortalButton><span className="card-caption">Page {currentPage} of {pages}</span><PortalButton size="sm" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Next</PortalButton></nav>:null}
        </>}
      </section>)}
    </PortalCard>
    <DecisionDialog isOpen={!!revoking} decisionKey={revoking?String(revoking.id):undefined} title="Revoke extra time?" context={revoking?`${revoking.studentName} · ${revoking.studentId} · ${revoking.evaluatorName}`:undefined} message="This removes this individual grant. The common deadline stays unchanged." confirmLabel="Revoke extra time" tone="warning" busy={busy} dirty={!!reason.trim()} canConfirm={!!reason.trim()} successMessage="Extra time revoked." onClose={()=>setRevoking(null)} onReload={async()=>{await load(true);}} onConfirm={async()=>{
      if(!revoking||!reason.trim())return false;
      setBusy(true);
      try{return await completeDecision(async()=>{await (kind==='marks'?revokeCompletionWindow(revoking.id,reason.trim()):revokeOperationalException(revoking.id,reason.trim()));setReason('');},async()=>{await onChanged();await load(true);});}finally{setBusy(false);}
    }}><label className="form-label block">Reason<textarea className="form-control form-control-md mt-1" required rows={3} value={reason} onChange={event=>setReason(event.target.value)}/></label></DecisionDialog>
  </div>;
}
