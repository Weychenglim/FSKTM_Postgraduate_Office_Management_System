import React from 'react';
import type {LinkedPeriodStatus as Status} from '../types/timeline';
import {StatusBadge,getStatusBadgeTone} from './PortalPrimitives';

export function LinkedPeriodStatus({status,compact=false}:{status:Status;compact?:boolean}) {
  if(compact) return <div className="timeline-linked-status">
    <StatusBadge tone={getStatusBadgeTone(status.lifecycleStatus)}>{status.lifecycleStatus}</StatusBadge>
    <span className="card-description">{status.scheduleStatus==='OPEN'?'Schedule open':status.scheduleStatus==='UPCOMING'?'Schedule upcoming':'Schedule ended'}</span>
    <span className="card-description">{status.datesEnforced===null?'Evaluation rules':status.datesEnforced?'Dates enforced':'Dates not enforced'}</span>
  </div>;
  return <div className="space-y-2 text-left"><div className="flex flex-wrap gap-2"><StatusBadge tone={getStatusBadgeTone(status.lifecycleStatus)}>{status.lifecycleStatus}</StatusBadge><span className="card-description">Schedule: {status.scheduleStatus==='OPEN'?'Open':status.scheduleStatus==='UPCOMING'?'Upcoming':'Ended'}</span></div><p className="card-description">{status.datesEnforced===null?'Evaluation rules apply.':status.datesEnforced?'Activity: Dates enforced':'Activity: Dates not enforced'}</p>{status.lifecycleStatus==='DRAFT'?<p className="card-description">Draft dates do not control submissions.</p>:status.lifecycleStatus==='CLOSED'||status.lifecycleStatus==='ARCHIVED'?<p className="card-description">This window is closed.</p>:null}</div>;
}

/** Dashboard wording describes the window schedule, never personal eligibility. */
export function TimelineSubmissionStatus({status,marks=false}:{status:Status;marks?:boolean}) {
  if(status.datesEnforced === false) return null;
  const subject = marks ? 'Marking' : 'Submissions';
  const label = status.lifecycleStatus === 'DRAFT' ? 'Dates not final'
    : ['CLOSED','ARCHIVED'].includes(status.lifecycleStatus) || status.scheduleStatus === 'ENDED' ? `${subject} closed`
    : status.scheduleStatus === 'UPCOMING' ? `${subject} not open yet` : `${subject} open`;
  const tone = label === `${subject} open` ? 'success' : label === `${subject} not open yet` ? 'info' : 'neutral';
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
