import { Link } from 'react-router';
import { CircleHelp } from 'lucide-react';
import { APP_ROUTES } from '../constants/routes';
import type { TimelineUploadPreview } from '../types';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import { PortalSelect } from './PortalSelect';

export type TimelineLinkChoice = { row: string; keepWindowDates: boolean };

export function hasDifferentDates(
  existing: { deadlineStart: string; deadlineEnd: string },
  incoming: { deadlineStart: string; deadlineEnd: string },
) {
  return existing.deadlineStart !== incoming.deadlineStart || existing.deadlineEnd !== incoming.deadlineEnd;
}

export function TimelineLinkReview({ preview, semesterId, choices, onChoice, busy }: {
  preview: TimelineUploadPreview;
  semesterId: number;
  choices: Record<number, TimelineLinkChoice>;
  onChoice: (entryId: number, choice: TimelineLinkChoice) => void;
  busy: boolean;
}) {
  const available = new Set(preview.availableLinkRows);
  const candidates = preview.rows.filter(row => available.has(row.position));
  const assigned = new Set(Object.values(choices).map(choice => choice.row));

  return <section className="space-y-4" aria-label="Linked events to review">
    <div className="relative">
      <h3 className="section-heading flex min-h-10 items-center pr-12">Review linked events</h3>
      <details className="group">
        <summary aria-label="Why review linked events?" className="absolute right-0 top-0 grid size-10 cursor-pointer list-none place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy group-open:bg-slate-100 group-open:text-brand-navy [&::-webkit-details-marker]:hidden">
          <CircleHelp aria-hidden="true" className="size-[18px]" />
        </summary>
        <p className="mt-2 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          These calendar events are linked to submission windows. Review them to keep those links when you replace the draft.
          To change a window’s dates, use Manage period and preview the workbook again.
        </p>
      </details>
    </div>
    {preview.linkConflicts.map(event => {
      const choice = choices[event.entryId];
      const selected = candidates.find(row => String(row.position) === choice?.row);
      const datesDiffer = selected && hasDifferentDates(event, selected);
      const windowAnchor = event.operationalPeriodId ? `operational-period-${event.operationalPeriodId}` : `marks-period-${event.marksPeriodId}`;
      const manageUrl = `${APP_ROUTES.dashboardPeriods}?semester=${semesterId}&manage=window#${windowAnchor}`;
      return <article key={event.entryId} className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <h4 className="break-words text-base font-semibold leading-snug text-slate-900">{event.title}</h4>
          <p className="mt-1 text-xs text-slate-600">{event.level} · Step {event.step}</p>
        </div>
        <label className="block space-y-2">
          <span className="block text-sm font-medium text-slate-700">Calendar event to use</span>
          <PortalSelect aria-label={`Calendar event to use for ${event.title}`} data-linked-event={event.entryId}
            className="form-control form-control-md w-full" value={choice?.row ?? ''} disabled={busy}
            onChange={change => onChoice(event.entryId, { row: change.target.value, keepWindowDates: false })}>
            <option value="" hidden disabled>Select an option</option>
            <option value="keep">Keep existing event</option>
            {candidates.filter(row => row.level === event.level).map(row => <option key={row.position} value={row.position}
              disabled={assigned.has(String(row.position)) && choice?.row !== String(row.position)}>
              {row.level} step {row.step} in Excel · {row.title}
            </option>)}
          </PortalSelect>
        </label>
        {datesDiffer && selected && choice && <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h5 className="text-sm font-medium text-slate-700">Dates differ</h5>
            {busy ? <span className="text-sm text-slate-500">Manage period</span> : <Link className="rounded-sm text-sm font-semibold text-brand-navy underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand-navy" to={manageUrl}>Manage period</Link>}
          </div>
          <dl aria-label="Date comparison" className="grid grid-cols-1 gap-4 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm sm:grid-cols-2">
            {([['Current window dates', event], ['Excel dates', selected]] as const).map(([label, dates]) => <div key={label}>
              <dt className="font-semibold text-slate-800">{label}</dt>
              <dd className="mt-1 leading-relaxed text-slate-700">
                <time className="whitespace-nowrap" dateTime={dates.deadlineStart}>{formatMalaysiaDate(dates.deadlineStart)}</time>
                {' to '}
                <time className="whitespace-nowrap" dateTime={dates.deadlineEnd}>{formatMalaysiaDate(dates.deadlineEnd)}</time>
              </dd>
            </div>)}
          </dl>
          <label className="flex cursor-pointer items-start gap-3 py-1 text-sm leading-6 text-slate-800">
            <input id={`keep-window-dates-${event.entryId}`} type="checkbox" className="mt-1 size-4 shrink-0"
              checked={choice.keepWindowDates} disabled={busy}
              onChange={change => onChoice(event.entryId, { ...choice, keepWindowDates: change.target.checked })} />
            <span>Keep the current window dates.</span>
          </label>
        </div>}
      </article>;
    })}
  </section>;
}
