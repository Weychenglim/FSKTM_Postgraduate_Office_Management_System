import {SupervisorRequestDisclosure} from './SupervisorRequestFields';
import React, { useId } from 'react';
import { UserRound, Check, X, type LucideIcon } from 'lucide-react';
import { IconHeading } from './IconHeading';
import { AppointmentIcon } from './AppointmentPrimitives';
import { orderApprovalEvents, type ApprovalEvent } from '../utils/approvalProcess';
import { PortalButton, PortalCard, StatusBadge } from './PortalPrimitives';
import { formatRequestRecordedAt, formatRequestDisplayDate } from './ApprovalProcess';
import { requestStatusLabel } from '../utils/lecturerRequests';

export function readableRecordStatus(value: string): string {
  const labels: Record<string,string> = {ACTIVE:'Active',ENDED:'Ended',COMPLETED:'Completed',WITHDRAWN:'Withdrawn',REPLACED:'Replaced'};
  return labels[value] ?? requestStatusLabel(value);
}

function readableAction(value: string): string {
  const labels: Record<string,string> = {SUBMIT:'Request submitted',SUBMITTED:'Request submitted',NOMINATE:'Supporting supervisor nominated',NOMINATED:'Supporting supervisor nominated',ACCEPT:'Request accepted',SUPERVISOR_ACCEPT:'Supervisor accepted',APPROVE:'Request approved',COORDINATOR_APPROVE:'Coordinator approved',ENDORSE:'Request endorsed',REJECT:'Request rejected',SUPERVISOR_REJECT:'Supervisor rejected',COORDINATOR_REJECT:'Coordinator rejected',SYSTEM_CLOSE_CAPACITY:'Closed automatically: capacity full',CANCEL:'Request cancelled',CANCELLED:'Request cancelled',ACTIVATED:'Appointment started',ENDED:'Appointment ended',REPLACED:'Appointment replaced'};
  const words = value.replaceAll('_',' ').toLowerCase();
  return labels[value] ?? (words ? words.charAt(0).toUpperCase()+words.slice(1) : 'Recorded activity');
}

export function RequestAuditHistory({ events, title = 'Audit history', showTeamRetention = false, sidebar = false }: { events: ApprovalEvent[]; title?: string; showTeamRetention?: boolean; sidebar?:boolean }) {
  if (!events.length) return null;
  const content=<ol className="mt-4 divide-y divide-slate-200">{orderApprovalEvents(events).map(event => <li key={event.id} className="space-y-2 py-4 first:pt-0 last:pb-0 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className="card-value">{readableAction(event.action)}</p>{formatRequestRecordedAt(event.createdAt)!=='Not recorded'?<p className="card-caption text-slate-500">{formatRequestDisplayDate(event.createdAt)}</p>:null}</div>
      {event.actorName||event.actorRole?<p className="card-description">{[event.actorName,event.actorRole].filter(Boolean).join(' · ')}</p>:null}
      {event.newStatus?<p className="card-caption text-slate-500">{event.previousStatus ? `${readableRecordStatus(event.previousStatus)} → ` : ''}{readableRecordStatus(event.newStatus)}</p>:null}
      {event.reason ? <p className="card-description whitespace-pre-wrap"><span className="font-semibold">Reason: </span>{event.reason}</p> : null}
      {event.retainTeam != null && (showTeamRetention || event.retainTeam) ? <p className="card-description">{event.retainTeam ? 'Team retention acknowledged.' : 'Team retention was not acknowledged.'}</p> : null}
    </li>)}</ol>;
  if(sidebar)return <SupervisorRequestDisclosure title={`${title} (${events.length} ${events.length===1?'event':'events'})`}>{content}</SupervisorRequestDisclosure>;
  return <details className="group"><summary className="section-label cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy">{title}<span className="card-caption ml-2 font-normal text-slate-500">({events.length} {events.length === 1 ? 'event' : 'events'})</span></summary>
    {content}
  </details>;
}

export function RequestMetadata({ submittedAt, submittedBy, statusLabel, statusTone = 'neutral', dateLabel = 'Submitted' }: { reference?: string; submittedAt?: string | null; submittedBy?: string; statusLabel?: string; statusTone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; dateLabel?: string }) {
  const date = formatRequestDisplayDate(submittedAt);
  const actor = submittedBy && submittedBy !== 'Not recorded' ? submittedBy.split(' · ')[0] : null;
  return <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
    {date!=='Not recorded'||actor?<p className="card-description text-slate-500 [overflow-wrap:anywhere]">{date!=='Not recorded'?`${dateLabel} ${date}`:dateLabel}{actor?` · by ${actor}`:''}</p>:null}
    {statusLabel?<StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>:null}
  </div>;
}

export function RequestDetailCard({ children, progress, actions, audit, padding }: { children?: React.ReactNode; progress?: React.ReactNode; actions?: React.ReactNode; audit?: React.ReactNode; padding?: React.ComponentProps<typeof PortalCard>['padding'] }) {
  const hasContent = React.Children.toArray(children).length > 0;
  return <PortalCard padding={padding} className="divide-y divide-slate-200">
    {hasContent ? <div className="space-y-6 pb-6">{children}</div> : null}
    {progress ? <div className={hasContent ? 'py-6' : 'pb-6'}>{progress}</div> : null}
    {actions ? <div className="py-6">{actions}</div> : null}
    {audit ? <div className="pt-6">{audit}</div> : null}
  </PortalCard>;
}

export const requestBodyTextClass = 'font-sans text-xs font-normal leading-relaxed text-slate-700 whitespace-pre-wrap break-words';

/** Readable, equal-width actions for narrow detail sidebars; caller owns capabilities. */
export function RequestDetailActions({ children }: { children: React.ReactNode }) {
  return <div data-detail-actions className="space-y-3 [&_.flex]:flex-col [&_.flex]:items-stretch [&_.flex]:gap-3 [&_button]:w-full">{children}</div>;
}

export function PrimaryRequestDecisionButtons({ positiveLabel, disabled, positiveDisabled = false, onPositive, onReject }: {
  positiveLabel: 'Accept request' | 'Approve request'; disabled: boolean; positiveDisabled?: boolean;
  onPositive: () => void; onReject: () => void;
}) {
  return <div className="flex flex-wrap gap-3">
    <PortalButton icon={Check} variant="primary" disabled={disabled || positiveDisabled} onClick={onPositive}>{positiveLabel}</PortalButton>
    <PortalButton icon={X} variant="danger" disabled={disabled} onClick={onReject}>Reject request</PortalButton>
  </div>;
}

export function RequestField({ label, value, narrative = false }: { label: string; value?: string | null; narrative?: boolean }) {
  return <div><dt className="card-label">{label}</dt><dd className={`${narrative ? requestBodyTextClass : 'card-value whitespace-pre-wrap break-words'} mt-1`}>{value?.trim() || 'Not recorded'}</dd></div>;
}

export function RequestSection({ title, description, actions, children, headingClassName = 'section-label', icon }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; headingClassName?: string; icon?: LucideIcon }) {
  const titleId = useId();
  return <section aria-labelledby={titleId} className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><IconHeading titleId={titleId} title={title} description={description} titleClassName={headingClassName} icon={icon ? <AppointmentIcon icon={icon} tone="info" /> : undefined} />{actions}</div>{children}</section>;
}

export function ViewStudentRecordAction({studentId,onOpen,disabled=false}:{studentId:string;onOpen?: (studentId:string)=>void;disabled?:boolean}) {
  return onOpen?<PortalButton variant="primary" icon={UserRound} size="sm" disabled={disabled} onClick={()=>onOpen(studentId)}>View student record</PortalButton>:null;
}
