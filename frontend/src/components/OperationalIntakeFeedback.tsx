import {Clock3, Info, RefreshCw, X} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {getOperationalAvailability} from '../services/operationalPeriodsApi';
import type {OperationalActivity, OperationalAvailability} from '../types/operationalPeriods';
import {formatMalaysiaDate, formatMalaysiaDateTime} from '../utils/malaysiaDateTime';
import {PortalModal, useModalTitle} from './PortalModal';
import {PortalButton, type BadgeTone} from './PortalPrimitives';

export function isOperationalIntakeBlocked(availability: OperationalAvailability | null) {
  return availability?.enforcementEnabled === true && !availability.canSubmit;
}

/** A failed advisory read leaves the authoritative creation endpoint in control. */
export function useOperationalIntake(activity: OperationalActivity, studentId?: number, enabled = true) {
  const [availability,setAvailability]=useState<OperationalAvailability|null>(null);
  const [loading,setLoading]=useState(enabled);
  const [error,setError]=useState<string|null>(null);
  const generation=useRef(0);
  const refresh=useCallback(async () => {
    const version=++generation.current;
    if(!enabled){setAvailability(null);setLoading(false);return null;}
    setLoading(true);setError(null);
    try {
      const result=await getOperationalAvailability(activity,studentId);
      if(version===generation.current)setAvailability(result);
      return result;
    } catch (failure) {
      if(version===generation.current){setAvailability(null);setError(failure instanceof Error?failure.message:'Intake availability could not be checked.');}
      return null;
    } finally {if(version===generation.current)setLoading(false);}
  },[activity,studentId,enabled]);
  useEffect(()=>{setAvailability(null);void refresh();return()=>{generation.current+=1;};},[refresh]);
  return {availability,loading:enabled && (loading || (!availability && !error)),error,refresh,blocked:isOperationalIntakeBlocked(availability)};
}

export function OperationalIntakeFeedback({availability,loading,error,onRetry,activity = 'SUPERVISOR_APPLICATION'}: {
  availability: OperationalAvailability|null; loading:boolean; error:string|null; onRetry?:()=>void; activity?:OperationalActivity;
}) {
  const subject = activity === 'PANEL_RECOMMENDATION' ? 'Recommendations' : 'Applications';
  const ariaLabel = activity === 'PANEL_RECOMMENDATION' ? 'Recommendation availability' : 'Application availability';
  const unavailable = !loading && !error && availability !== null && !availability.canSubmit;
  let label = '';
  let tone: BadgeTone = 'neutral';
  let date: string | null = null;
  let dateLabel = '';
  let reason = '';

  if (availability && !loading && !error) {
    const personalDeadline = !!availability.effectiveDueAt && availability.effectiveDueAt !== availability.closesAt;
    const deadline = availability.effectiveDueAt || availability.closesAt;
    if (availability.canSubmit) {
      label = `${subject} open`;
      tone = 'success';
      if (availability.status !== 'UNRESTRICTED') {
        date = deadline;
        dateLabel = personalDeadline ? 'Your deadline' : 'Closes';
      }
    } else if (availability.status === 'UPCOMING') {
      label = `${subject} not open yet`;
      tone = 'info';
      date = availability.opensAt;
      dateLabel = 'Opens';
    } else if (['ENDED', 'CLOSED'].includes(availability.status)) {
      label = `${subject} closed`;
      date = deadline;
      dateLabel = personalDeadline ? 'Your deadline passed' : 'Closed';
    } else {
      label = `${subject} unavailable`;
      tone = 'warning';
      reason = availability.message;
    }
    // Keep the explanation when an unavailable period has no date to display.
    if (unavailable && !date) reason = availability.message;
  }

  return <SubmissionAvailabilityNotice ariaLabel={ariaLabel} loading={loading}
    title={loading ? 'Checking availability…' : error ? 'Couldn’t check availability' : label || 'Availability is checked when you submit'}
    description={error ? 'Try checking again before submitting.' : date ? <>{dateLabel} <time dateTime={date}>{formatMalaysiaDateTime(date)}</time></> : reason || null}
    tone={tone}
    action={onRetry && (unavailable || error) ? <PortalButton size="sm" icon={RefreshCw} onClick={onRetry}>{error ? 'Retry' : 'Check availability'}</PortalButton> : null} />;
}

/** Shared, quiet availability notice; permissions remain with the caller's API. */
export function SubmissionAvailabilityNotice({ariaLabel, title, description, action, loading=false, tone='info'}: {
  ariaLabel:string; title:string; description?:React.ReactNode; action?:React.ReactNode; loading?:boolean; tone?:BadgeTone;
}) {
  const Icon = loading || tone === 'info' ? Clock3 : Info;
  return <aside aria-label={ariaLabel} aria-live="polite" aria-busy={loading}
    className="flex min-w-0 flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-start gap-3">
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold leading-5 text-slate-800">{title}</p>
        {description ? <div className="text-xs font-normal leading-5 text-slate-600">{description}</div> : null}
      </div>
    </div>
    {action ? <div className="shrink-0 self-start sm:self-center">{action}</div> : null}
  </aside>;
}


/** Contextual response to an attempted application launch; never submits data. */
export function ApplicationAvailabilityModal({isOpen,onClose,onRetry,availability,loading,error}: {
  isOpen:boolean; onClose:()=>void; onRetry:()=>void;
  availability:OperationalAvailability|null; loading:boolean; error:string|null;
}) {
  const titleId=useModalTitle();
  const upcoming=availability?.status==='UPCOMING';
  const closed=availability && ['ENDED','CLOSED'].includes(availability.status);
  const title=error ? 'Availability could not be checked' : upcoming ? 'Applications not open yet' : closed ? 'Applications closed' : 'Applications unavailable';
  const date=upcoming ? availability?.opensAt : availability?.effectiveDueAt || availability?.closesAt;
  const descriptionId=`${titleId}-description`;
  const hasDate=!!date && Number.isFinite(new Date(date).getTime());
  return <PortalModal isOpen={isOpen} onClose={onClose} busy={loading} labelledBy={titleId} describedBy={descriptionId} className="max-w-md p-6 sm:p-7">
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {error ? <Info aria-hidden="true" className="h-5 w-5" /> : <Clock3 aria-hidden="true" className="h-5 w-5" />}
        </span>
        <h2 id={titleId} className="text-base font-semibold leading-6 text-slate-900">{title}</h2>
      </div>
      <button type="button" className="icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" aria-label="Close availability dialog" onClick={onClose} disabled={loading}><X aria-hidden="true" className="h-4 w-4" /></button>
    </div>
    <p id={descriptionId} className="mt-4 text-sm leading-6 text-slate-600">
      {error ? 'Please check availability again before starting an application.' : upcoming ? 'You can start a new application when the submission window opens.' : closed ? 'The submission window has closed. New applications are currently unavailable.' : availability?.message || 'Application availability is being checked.'}
    </p>
    {!error && hasDate ? <div className="mt-5 rounded-xl bg-slate-50 p-4">
      <p className="text-xs leading-5 text-slate-500">{upcoming ? 'Opens on' : 'Closed on'}</p>
      <time dateTime={date!} title={formatMalaysiaDateTime(date)} className="mt-1 block space-y-1">
        <span className="block text-base font-medium leading-6 text-slate-900">{formatMalaysiaDate(date!)}</span>
        <span className="block text-sm leading-5 text-slate-600">{new Date(date!).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'})} MYT</span>
      </time>
    </div> : null}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <PortalButton variant="ghost" className="!px-0" icon={RefreshCw} onClick={onRetry} isLoading={loading}>Check availability</PortalButton>
      <PortalButton variant="primary" onClick={onClose} disabled={loading}>Close</PortalButton>
    </div>
  </PortalModal>;
}
