import type { BadgeTone } from '../components/PortalPrimitives';
import type { AfterDue, SubmissionDetail, SubmissionState, SubmissionStage, SubmissionSummary } from '../services/submissionsApi';
import { historyTime } from './documentDisplay';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MALAYSIA_OFFSET_MINUTES = 8 * 60;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** "1 day 9 hours", "3 hours 5 minutes", "12 minutes". Two units at most. */
export function durationText(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < MINUTE) return 'less than a minute';
  const days = Math.floor(total / DAY);
  const hours = Math.floor((total % DAY) / HOUR);
  const minutes = Math.floor((total % HOUR) / MINUTE);
  if (days) return hours ? `${plural(days, 'day')} ${plural(hours, 'hour')}` : plural(days, 'day');
  if (hours) return minutes ? `${plural(hours, 'hour')} ${plural(minutes, 'minute')}` : plural(hours, 'hour');
  return plural(minutes, 'minute');
}

export function timeLeftText(dueAt: string, now: number): string {
  const left = (new Date(dueAt).getTime() - now) / 1000;
  if (!Number.isFinite(left)) return '';
  if (left <= 0) return 'Due date passed';
  return `${durationText(left)} left`;
}

/** The date and time a coordinator typed, read as Malaysia time. */
export const fromMalaysia = (date: string, time: string) => `${date}T${time || '23:59'}:00+08:00`;

/** A stored time as the date and time boxes show it, in Malaysia time. */
export function malaysiaParts(value: string | null): { date: string; time: string } {
  const parsed = value ? new Date(value) : null;
  if (!parsed || !Number.isFinite(parsed.getTime())) return { date: '', time: '23:59' };
  const shifted = new Date(parsed.getTime() + MALAYSIA_OFFSET_MINUTES * 60 * 1000);
  const iso = shifted.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** A week from now at 11:59 PM Malaysia time, as the date box wants it. */
export function defaultDueDate(now: number, days = 7): string {
  return malaysiaParts(new Date(now + days * DAY * 1000).toISOString()).date;
}

export const STATE_LABEL: Record<SubmissionState, string> = { ON_TIME: 'On time', LATE: 'Late', NOT_SENT: 'Not sent' };
export const STATE_TONE: Record<SubmissionState, BadgeTone> = { ON_TIME: 'success', LATE: 'warning', NOT_SENT: 'neutral' };
export const STAGE_LABEL: Record<SubmissionStage, string> = { ALL: 'Everyone', P1: 'RP1', P2: 'RP2' };

export function afterDueText(item: Pick<SubmissionSummary, 'afterDue' | 'lateUntil'>): string {
  if (item.afterDue === 'CLOSE') return 'Closes at the due date';
  return item.lateUntil ? `Late work until ${historyTime(item.lateUntil)}` : 'Late work accepted';
}

export const AFTER_DUE_OPTIONS: Array<{ value: AfterDue; label: string }> = [
  { value: 'CLOSE', label: 'Close' },
  { value: 'ACCEPT_LATE', label: 'Accept late, marked late' },
];

export function sentText(sentAt: string | null, lateBySeconds: number | null): string {
  if (!sentAt) return 'Not sent';
  return lateBySeconds ? `Sent ${historyTime(sentAt)}, ${durationText(lateBySeconds)} late` : `Sent ${historyTime(sentAt)}, on time`;
}

const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function submissionCsv(detail: Pick<SubmissionDetail, 'students'>): string {
  const header = ['Matric', 'Name', 'Programme', 'Status', 'Sent at', 'Late by', 'Due', 'Extension reason'];
  const rows = detail.students.map(row => [
    row.matric,
    row.name,
    row.programme,
    STATE_LABEL[row.state],
    row.sentAt ? historyTime(row.sentAt) : '',
    row.lateBySeconds ? durationText(row.lateBySeconds) : '',
    historyTime(row.dueAt),
    row.extension?.reason ?? '',
  ]);
  return [header, ...rows].map(line => line.map(cell).join(',')).join('\n');
}

export const csvName = (title: string) => `${title.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'submission'}.csv`;
