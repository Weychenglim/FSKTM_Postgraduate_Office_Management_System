import {TimelineEventPicker} from './TimelineEventPicker';
import React,{useEffect,useState} from 'react';
import {Link} from 'react-router';
import {APP_ROUTES} from '../constants/routes';
import type {SemesterTimelineEntry,TimelineLevel,TimelineRole} from '../types/timeline';
import {createPeriodCalendarEvent} from '../services/linkedPeriodCalendar';
import {linkTimelinePeriod} from '../services/operationalPeriodsApi';
import {completeDecision} from '../utils/decisionSubmission';
import {formatMalaysiaDate,formatMalaysiaDateTime} from '../utils/malaysiaDateTime';
import {PortalSelect} from './PortalSelect';
import {DecisionDialog} from './DecisionDialog';

export type PeriodCalendarStatus='loading'|'error'|'missing'|'ready';
export function PeriodCalendarConnection({semesterId,kind,periodId,name,opensAt,closesAt,entries,status,editable,onRefresh,onInteractionChange}:{semesterId:number;kind:'appointment'|'marks';periodId:number;name:string;opensAt:string|null;closesAt:string|null;entries:SemesterTimelineEntry[];status:PeriodCalendarStatus;editable:boolean;onRefresh:()=>Promise<unknown>|void;onInteractionChange:(busy:boolean)=>void}) {
 const [mode,setMode]=useState<'link'|'create'|null>(null);
 const [entryId,setEntryId]=useState('');
 const [title,setTitle]=useState(name);
 const [level,setLevel]=useState<TimelineLevel>('P1');
 const [roles,setRoles]=useState<TimelineRole[]>(kind==='marks'?['LECTURER']:kind==='appointment'?['STUDENT','LECTURER']:[]);
 const [saving,setSaving]=useState(false);
 const linked=entries.filter(entry=>kind==='appointment'?entry.operationalPeriodId===periodId:entry.marksPeriodId===periodId);
 const available=entries.filter(entry=>!entry.operationalPeriodId&&!entry.marksPeriodId);
 const canChange=editable&&status==='ready'&&!!opensAt&&!!closesAt&&!linked.length;
 useEffect(()=>{onInteractionChange(mode!==null||saving);return()=>onInteractionChange(false);},[mode,saving,onInteractionChange]);
 const open=(next:'link'|'create')=>{setEntryId('');setTitle(name);setLevel('P1');setRoles(kind==='marks'?['LECTURER']:['STUDENT','LECTURER']);setMode(next);};
 return <section aria-label="Semester timeline connection" className="space-y-4">
  <div><h3 className="section-heading">Semester timeline</h3><p className="card-description mt-1">Event dates follow this window automatically.</p></div>
  {status==='loading'?<p role="status" className="card-description">Loading timeline connection…</p>:status==='error'?<p role="alert" className="card-description">Timeline connection could not be checked. Reload calendar events before linking or creating an event.</p>:status==='missing'?<div className="space-y-2"><p className="card-description">{editable?'No semester timeline exists yet. Set it up in Academic calendar, then return to link this window.':'Calendar links cannot be changed for this semester.'}</p>{editable?<Link className="period-text-link" to={`${APP_ROUTES.dashboardTimeline}?semester=${semesterId}`}>Set up semester timeline →</Link>:null}</div>:<>
   {linked.length?<ul className="space-y-2">{linked.map(entry=><li key={entry.id}><p className="card-value">Linked: {entry.title||entry.detail}</p><p className="card-description mt-1">Research Project {entry.level==='P1'?'1':'2'} · {formatMalaysiaDate(entry.deadlineStart)} – {formatMalaysiaDate(entry.deadlineEnd)}</p></li>)}</ul>:<p className="card-value">Not linked to the semester timeline</p>}
   {editable&&(!opensAt||!closesAt)?<p className="card-description">Configure opening and closing dates before linking an event.</p>:null}
   {canChange?<div className="flex flex-wrap gap-x-6 gap-y-3"><button type="button" className="period-text-link" disabled={!available.length||saving} onClick={()=>open('link')}>Link existing event</button><button type="button" className="period-text-link" disabled={saving} onClick={()=>open('create')}>Create linked event</button></div>:null}
   {canChange&&!available.length?<p className="card-description">No unlinked events are available. You can create a linked event here.</p>:null}
  </>}
  <DecisionDialog isOpen={mode!==null} decisionKey={`${semesterId}:${kind}:${periodId}:${mode}`} title={mode==='create'?'Create linked timeline event':'Link timeline event'} context={name} message="After linking, manage dates through this submission window. The timeline follows automatically. Linking does not enable submission restrictions." confirmLabel={mode==='create'?'Create linked event':'Link event'} busy={saving} dirty={mode==='link'?!!entryId:title!==name||level!=='P1'||roles.join()!==(kind==='marks'?'LECTURER':'STUDENT,LECTURER')} canConfirm={canChange&&(mode==='link'?available.some(entry=>String(entry.id)===entryId):!!title.trim()&&roles.length>0)} successMessage={mode==='create'?'Linked timeline event created.':'Timeline event linked.'} onClose={()=>setMode(null)} onReload={async()=>{await onRefresh();}} onConfirm={async()=>{
   if(!canChange||!mode)return false;
   setSaving(true);
   try{return await completeDecision(()=>mode==='link'?linkTimelinePeriod(Number(entryId),kind,periodId):createPeriodCalendarEvent({semesterId,kind,periodId,title,level,targetRoles:roles,opensAt:opensAt!,closesAt:closesAt!}),async()=>{await onRefresh();});}
   finally{setSaving(false);}
  }}>
   {mode==='link'?<TimelineEventPicker id="period-calendar-event" entries={available} value={entryId} onChange={setEntryId} disabled={saving} emptyLabel="Choose an unlinked event"/>:<>
    <label className="form-label block">Event title<input className="form-control form-control-md mt-1" required value={title} onChange={event=>setTitle(event.target.value)}/></label>
    <label className="form-label block">Research phase<PortalSelect id="period-calendar-phase" className="form-control form-control-md mt-1" value={level} onChange={event=>setLevel(event.target.value as TimelineLevel)}><option value="P1">Research Project 1</option><option value="P2">Research Project 2</option></PortalSelect></label>
    <fieldset className="space-y-2"><legend className="form-label mb-2">Who can see this event?</legend>{(kind==='marks'?['LECTURER','OFFICE_STAFF'] as TimelineRole[]:['STUDENT','LECTURER','OFFICE_STAFF'] as TimelineRole[]).map(role=><label key={role} className="flex items-center gap-3 text-xs text-slate-700"><input type="checkbox" checked={roles.includes(role)} onChange={event=>setRoles(current=>event.target.checked?[...current,role]:current.filter(value=>value!==role))}/>{role==='STUDENT'?'Students':role==='LECTURER'?'Lecturers':'Office staff'}</label>)}</fieldset>
   </>}
   {mode==='link'&&entryId?<p className="card-description">Linking replaces this event’s displayed dates with the window dates below. Its title, phase and audience stay the same.</p>:null}
   <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700"><p>Opens: {formatMalaysiaDateTime(opensAt)}</p><p>Closes: {formatMalaysiaDateTime(closesAt)}</p></div>
  </DecisionDialog>
 </section>;
}
