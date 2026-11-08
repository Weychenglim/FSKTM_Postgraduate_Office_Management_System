const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Interpret datetime-local input as Malaysia wall time, never device time. */
export function malaysiaDeadline(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || value.startsWith('0000-')) {
    throw new Error('Enter a valid Malaysia date and time.');
  }
  const parsed = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(parsed.getTime())
    || new Date(parsed.getTime() + MALAYSIA_OFFSET_MS).toISOString().slice(0, 16) !== value) {
    throw new Error('Enter a valid Malaysia date and time.');
  }
  return parsed.toISOString();
}

function parseInstant(value: string): Date {
  // API timestamps must carry an offset; accepting a timezone-free value would
  // silently reintroduce device-dependent interpretation.
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : NaN);
}

export function toMalaysiaDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = parseInstant(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  return new Date(parsed.getTime() + MALAYSIA_OFFSET_MS).toISOString().slice(0, 16);
}

export function formatMalaysiaDateTime(value: string | null | undefined): string {
  const formatted = formatMalaysiaDateTimeCompact(value);
  return formatted === 'Not configured' || formatted === 'Invalid date'
    ? formatted : `${formatted} (Malaysia, UTC+08:00)`;
}

/** Use when the surrounding section already identifies Malaysia time. */
export function formatMalaysiaDateTimeCompact(value: string | null | undefined): string {
  if (!value) return 'Not configured';
  const parsed = parseInstant(value);
  if (!Number.isFinite(parsed.getTime())) return 'Invalid date';
  return parsed.toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Display workflow timestamps and date-only appointments in faculty time. */
export function formatMalaysiaDate(value: string): string {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+08:00`)
    : parseInstant(value);
  if (!Number.isFinite(parsed.getTime())) return 'Invalid date';
  return parsed.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric',
  });
}
