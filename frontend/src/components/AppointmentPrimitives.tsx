import React from 'react';
import { IconHeading } from './IconHeading';
import { CircleHelp, UserRound, type LucideIcon } from 'lucide-react';
import { PortalButton, ProgressBar, StatusBadge } from './PortalPrimitives';

type AppointmentTone = React.ComponentProps<typeof StatusBadge>['tone'];
const iconTones: Record<AppointmentTone, string> = {
  brand: 'bg-slate-100 text-brand-navy ring-slate-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-100',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-800 ring-amber-100',
  danger: 'bg-rose-50 text-rose-700 ring-rose-100',
};

/** Decorative companion to a visible label; never conveys status on its own. */
export function AppointmentIcon({ icon: Icon, tone = 'neutral' }: { icon: LucideIcon; tone?: AppointmentTone }) {
  return <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${iconTones[tone]}`}>
    <Icon aria-hidden="true" focusable="false" className="h-[18px] w-[18px]" strokeWidth={1.75} />
  </span>;
}

export const appointmentDetailTypography = {
  label: 'text-xs font-semibold leading-relaxed text-slate-500',
  body: 'text-xs font-normal leading-relaxed text-slate-700',
  name: 'text-sm font-semibold leading-relaxed text-brand-navy',
  heading: 'text-base font-semibold leading-relaxed text-brand-navy',
  disclosure: 'cursor-pointer py-5 text-sm font-semibold leading-relaxed text-brand-navy',
};

export function AppointmentSection({ title, description, children, id, actions, detail = false, icon }: {
  title: string; description?: string; children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean; id?: string; actions?: React.ReactNode; detail?: boolean; icon?: LucideIcon;
}) {
  return <section id={id} aria-label={title} className={`${detail ? 'space-y-6 p-6 md:p-8' : 'space-y-4 p-5'} rounded-2xl border border-slate-200 bg-white shadow-sm`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><IconHeading className="flex-1" title={title} description={description} titleClassName={detail ? appointmentDetailTypography.heading : 'section-label'} descriptionClassName={`${detail ? appointmentDetailTypography.body : 'card-description'} mt-1`} icon={icon ? <AppointmentIcon icon={icon} tone="info" /> : undefined} /><div className="flex flex-wrap gap-2">{actions}</div></div>
    {children}
  </section>;
}

export function AppointmentMemberCard({ label, name, status, tone, children, actions, detail = false, icon = UserRound }: {
  label: string; name: string; status: string; tone: React.ComponentProps<typeof StatusBadge>['tone']; children?: React.ReactNode; actions?: React.ReactNode; detail?: boolean; icon?: LucideIcon;
}) {
  if (detail) return <article aria-label={label} className="space-y-6 rounded-xl border border-slate-200 p-6">
    <div className="space-y-3"><div className="flex items-center gap-3"><AppointmentIcon icon={icon} tone="info" /><p className={appointmentDetailTypography.label}>{label}</p></div>
      <div className="flex flex-wrap items-start justify-between gap-3"><h3 className={`${appointmentDetailTypography.name} break-words`}>{name}</h3><StatusBadge tone={tone}>{status}</StatusBadge></div>
    </div>
    {children}{actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
  </article>;
  return <article className="space-y-2 rounded-xl border border-slate-200 p-4">
    <div className="flex items-center gap-3"><AppointmentIcon icon={icon} tone="info" /><p className="card-label">{label}</p></div><h3 className="section-label break-words">{name}</h3><StatusBadge tone={tone}>{status}</StatusBadge>
    {children}{actions ? <div className="flex flex-wrap gap-2 pt-2">{actions}</div> : null}
  </article>;
}

export type AppointmentGuidanceCard = { title: string; content: React.ReactNode };

export function AppointmentGuidance({ cards, onShowFAQChatbot }: { cards: AppointmentGuidanceCard[]; onShowFAQChatbot?: () => void }) {
  return <section aria-label="Appointment guidance" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><AppointmentIcon icon={CircleHelp} /><h2 className="section-label">Appointment guidance</h2></div>{onShowFAQChatbot ? <PortalButton size="sm" onClick={onShowFAQChatbot}>Appointment FAQ</PortalButton> : null}</div>
    <div className="grid gap-5 sm:grid-cols-2">{cards.map(card => <article key={card.title} className="space-y-2"><h3 className="card-value">{card.title}</h3><div className="card-description space-y-2 text-slate-700">{card.content}</div></article>)}</div>
  </section>;
}

export function AppointmentSummaryCard({ title, value, description, badge, tone = 'neutral', progress, icon, iconTone = 'info', supportingContent }: {
  title: string; value: React.ReactNode; supportingContent?: React.ReactNode; description?: string; badge?: string; tone?: React.ComponentProps<typeof StatusBadge>['tone']; progress?: { current: number; max: number }; icon?: LucideIcon; iconTone?: AppointmentTone;
}) {
  return <article aria-label={title} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3">{icon ? <AppointmentIcon icon={icon} tone={iconTone} /> : null}<h2 className="card-label">{title}</h2></div>{badge ? <StatusBadge tone={tone}>{badge}</StatusBadge> : null}</div>
    <p className="card-metric">{progress ? <>{progress.current} <span className="font-medium text-slate-400">/ {progress.max}</span></> : value}</p>
    {progress ? <ProgressBar value={progress.current} max={progress.max} tone="info" /> : null}
    {supportingContent}
    {description ? <p className="card-description">{description}</p> : null}
  </article>;
}

/** One short supporting line keeps workload cards compact across both modules. */
export function AppointmentWorkloadDetails({active,reserved,available,unavailable}: {
  active:number; reserved:number; available?:number; unavailable?:string;
}) {
  const text=unavailable ?? (available==null?'Availability not configured'
    : `${active} active${reserved>0?` · ${reserved} awaiting approval`:''}`);
  return <p className="card-description">{text}</p>;
}
