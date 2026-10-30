import type { MaintenanceStatus, OfficeMaintenance, PortalMaintenance } from '../types';

export const CHECK_EVERY_MS = 60_000;

const DAY_AND_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
});
const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit', hour12: true });
const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });

const instant = (value: string | null): number => (value ? new Date(value).getTime() : NaN);

/** Planned maintenance counts as on from its start, before the next check says so. */
export function maintenanceStatus(maintenance: PortalMaintenance | null, now = Date.now()): MaintenanceStatus {
  if (!maintenance) return 'off';
  if (maintenance.status === 'planned' && instant(maintenance.startsAt) <= now) return 'on';
  return maintenance.status;
}

export function maintenanceMoment(value: string | null): string {
  return Number.isFinite(instant(value)) ? DAY_AND_TIME.format(new Date(value as string)) : '';
}

/** "Sat 31 Oct, 10:00 pm to 11:30 pm", or "from ..." when no end is expected. */
export function maintenanceWindow(maintenance: PortalMaintenance): string {
  const start = maintenanceMoment(maintenance.startsAt);
  if (!Number.isFinite(instant(maintenance.expectedEnd))) return `from ${start}`;
  const end = new Date(maintenance.expectedEnd as string);
  const sameDay = DAY.format(new Date(maintenance.startsAt as string)) === DAY.format(end);
  return `${start} to ${sameDay ? TIME.format(end) : maintenanceMoment(maintenance.expectedEnd)}`;
}

export function expectedBackLine(maintenance: PortalMaintenance, now = Date.now()): string {
  if (!Number.isFinite(instant(maintenance.expectedEnd))) return 'It will be back as soon as the work is done.';
  if (instant(maintenance.expectedEnd) <= now) return 'It is taking longer than planned. Please check again a little later.';
  return `Expected back by ${maintenanceMoment(maintenance.expectedEnd)}.`;
}

/** Ask the server again every minute, and right at a planned start. */
export function nextCheckDelay(maintenance: PortalMaintenance | null, now = Date.now()): number {
  if (maintenance?.status === 'planned') {
    const untilStart = instant(maintenance.startsAt) - now;
    if (untilStart > 0 && untilStart < CHECK_EVERY_MS) return untilStart + 1000;
  }
  return CHECK_EVERY_MS;
}

export function savedMaintenanceMessage(before: MaintenanceStatus, after: OfficeMaintenance): string {
  if (after.status === 'on' && before !== 'on') return 'Maintenance is on. Only PG office staff can use the portal.';
  if (after.status === 'planned' && before === 'off') return `Maintenance planned: ${maintenanceWindow(after)}.`;
  return 'Maintenance updated.';
}
