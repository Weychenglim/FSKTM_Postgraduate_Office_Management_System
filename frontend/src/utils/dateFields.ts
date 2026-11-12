/**
 * Plain helpers for the DateField and TimeField pickers. Dates are
 * "YYYY-MM-DD" and times "HH:MM" (24-hour), the same strings the native
 * inputs gave, so callers and the API do not change.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad = (value: number) => String(value).padStart(2, '0');

export function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

export const isoDate = (year: number, month: number, day: number): string => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

export const todayInMalaysia = (now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  if (!date) return value;
  return isoDate(date.year, date.month, date.day + days);
}

export function addMonths(value: string, months: number): string {
  const date = parseDate(value);
  if (!date) return value;
  const first = new Date(Date.UTC(date.year, date.month - 1 + months, 1));
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth() + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return isoDate(year, month, Math.min(date.day, last));
}

/** Monday of the week ``value`` is in, and the Sunday after. */
export function weekBounds(value: string): [string, string] {
  const date = parseDate(value);
  if (!date) return [value, value];
  const weekday = (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7;
  return [addDays(value, -weekday), addDays(value, 6 - weekday)];
}

/** Six weeks, Monday first, covering the month of ``value``. */
export function monthGrid(value: string): Array<{ iso: string; day: number; inMonth: boolean }> {
  const date = parseDate(value);
  if (!date) return [];
  const [start] = weekBounds(isoDate(date.year, date.month, 1));
  return Array.from({ length: 42 }, (_, index) => {
    const iso = addDays(start, index);
    const cell = parseDate(iso)!;
    return { iso, day: cell.day, inMonth: cell.month === date.month };
  });
}

export const inRange = (value: string, min?: string, max?: string): boolean =>
  (!min || value >= min) && (!max || value <= max);

export function clampDate(value: string, min?: string, max?: string): string {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

export function monthTitle(value: string): string {
  const date = parseDate(value);
  return date ? `${MONTHS[date.month - 1]} ${date.year}` : '';
}

/** "12 Nov 2026", as the rest of the portal shows dates. */
export function dateLabel(value: string): string {
  const date = parseDate(value);
  return date ? `${date.day} ${MONTHS[date.month - 1].slice(0, 3)} ${date.year}` : '';
}

/** "12 November 2026", for screen readers. */
export function longDateLabel(value: string): string {
  const date = parseDate(value);
  return date ? `${date.day} ${MONTHS[date.month - 1]} ${date.year}` : '';
}

export function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value || '');
  if (!match) return null;
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** "9:00 AM", "11:59 PM". */
export function timeLabel(value: string): string {
  const time = parseTime(value);
  if (!time) return '';
  const hour = time.hour % 12 || 12;
  return `${hour}:${pad(time.minute)} ${time.hour < 12 ? 'AM' : 'PM'}`;
}

/** Every ``step`` minutes through the day, then 11:59 PM for end-of-day deadlines. The current value is kept if it falls between steps. */
export function timeOptions(step = 15, current = ''): Array<{ value: string; label: string }> {
  const values = new Set<string>();
  for (let minutes = 0; minutes < 24 * 60; minutes += step) values.add(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  values.add('23:59');
  const kept = parseTime(current);
  if (kept) values.add(`${pad(kept.hour)}:${pad(kept.minute)}`);
  return Array.from(values).sort().map(value => ({ value, label: timeLabel(value) }));
}
