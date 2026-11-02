import React,{useEffect,useState} from 'react';
import type {SemesterTimelineEntry} from '../types/timeline';
import {formatMalaysiaDate} from '../utils/malaysiaDateTime';
import {submitDeadlineExtension} from '../utils/operationalDeadlineExtension';
import {completeDecision} from '../utils/decisionSubmission';
import {DecisionDialog} from './DecisionDialog';

export function InformationalEventExtension({entry,onClose,onReload,busy=false}:{entry:SemesterTimelineEntry|null;onClose:()=>void;onReload:()=>Promise<unknown>;busy?:boolean}) {
  const [deadline,setDeadline]=useState(entry?.deadlineEnd.slice(0,10)??'');
  const [reason,setReason]=useState('');
  useEffect(()=>{setDeadline(entry?.deadlineEnd.slice(0,10)??'');setReason('');},[entry?.id,entry?.deadlineEnd]);
  const independent=!!entry&&!entry.operationalPeriodId&&!entry.marksPeriodId;
  return <DecisionDialog standaloneGuard isOpen={independent} decisionKey={entry?`informational-event:${entry.id}:${entry.deadlineEnd}`:undefined} title="Extend calendar date" context={entry?.title} message="Extend this informational calendar event through a complete Malaysia day (UTC+08:00). Record a reason for the calendar audit history." confirmLabel="Save extension" successMessage="Calendar date extended." busy={busy} dirty={!!reason.trim()||deadline!==(entry?.deadlineEnd.slice(0,10)??'')} canConfirm={independent&&!!deadline&&!!reason.trim()} onClose={onClose} onReload={onReload} onConfirm={async()=>{
    if(!entry||!independent)return false;
    return completeDecision(()=>submitDeadlineExtension({kind:'event',id:entry.id,closesAt:entry.deadlineEnd},'everyone',deadline,reason,{}),onReload);
  }}>
    <div data-office-dashboard className="space-y-4">
      <p className="card-description">Current date: {entry?formatMalaysiaDate(entry.deadlineEnd):''} (complete Malaysia day)</p>
      <label className="form-label block">New deadline (complete Malaysia day)<input type="date" className="form-control form-control-md mt-1" required value={deadline} onChange={event=>setDeadline(event.target.value)}/></label>
      <label className="form-label block">Reason<textarea className="form-control form-control-md mt-1" rows={3} required value={reason} onChange={event=>setReason(event.target.value)}/></label>
    </div>
  </DecisionDialog>;
}
