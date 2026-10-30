import assert from 'node:assert/strict';
import type { OfficeMaintenance, PortalMaintenance } from '../types';
import {
  CHECK_EVERY_MS,
  expectedBackLine,
  maintenanceStatus,
  maintenanceWindow,
  nextCheckDelay,
  savedMaintenanceMessage,
} from './maintenance';

// 10:00 pm to 11:30 pm on Saturday 31 October, Malaysia time
const planned: PortalMaintenance = {
  status: 'planned',
  startsAt: '2026-10-31T14:00:00+00:00',
  expectedEnd: '2026-10-31T15:30:00+00:00',
  message: 'Moving to a new server.',
};
const at = (iso: string) => Date.parse(iso);

assert.equal(maintenanceStatus(null), 'off');
assert.equal(maintenanceStatus(planned, at('2026-10-31T13:59:00Z')), 'planned');
assert.equal(maintenanceStatus(planned, at('2026-10-31T14:00:00Z')), 'on', 'it counts as on from its start');
assert.equal(maintenanceStatus({ ...planned, status: 'off' }, at('2026-11-01T00:00:00Z')), 'off');

assert.equal(maintenanceWindow(planned), 'Sat 31 Oct, 10:00 pm to 11:30 pm');
assert.equal(maintenanceWindow({ ...planned, expectedEnd: '2026-10-31T17:00:00Z' }), 'Sat 31 Oct, 10:00 pm to Sun 1 Nov, 1:00 am');
assert.equal(maintenanceWindow({ ...planned, expectedEnd: null }), 'from Sat 31 Oct, 10:00 pm');

assert.equal(expectedBackLine(planned, at('2026-10-31T15:00:00Z')), 'Expected back by Sat 31 Oct, 11:30 pm.');
assert.match(expectedBackLine(planned, at('2026-10-31T16:00:00Z')), /taking longer than planned/);
assert.match(expectedBackLine({ ...planned, expectedEnd: null }), /as soon as the work is done/);

assert.equal(nextCheckDelay(null), CHECK_EVERY_MS);
assert.equal(nextCheckDelay(planned, at('2026-10-31T13:59:40Z')), 21_000, 'checks again just after a planned start');
assert.equal(nextCheckDelay(planned, at('2026-10-31T13:50:00Z')), CHECK_EVERY_MS);
assert.equal(nextCheckDelay({ ...planned, status: 'on' }, at('2026-10-31T14:30:00Z')), CHECK_EVERY_MS);

const office = (values: Partial<OfficeMaintenance>): OfficeMaintenance => ({
  ...planned,
  defaultMessage: 'The portal is down for maintenance. Please try again later.',
  setBy: 'Olivia Office',
  updatedAt: null,
  history: [],
  ...values,
});
assert.equal(savedMaintenanceMessage('off', office({ status: 'on' })), 'Maintenance is on. Only PG office staff can use the portal.');
assert.equal(savedMaintenanceMessage('planned', office({ status: 'on' })), 'Maintenance is on. Only PG office staff can use the portal.');
assert.equal(savedMaintenanceMessage('off', office({})), 'Maintenance planned: Sat 31 Oct, 10:00 pm to 11:30 pm.');
assert.equal(savedMaintenanceMessage('planned', office({})), 'Maintenance updated.');
assert.equal(savedMaintenanceMessage('on', office({ status: 'on' })), 'Maintenance updated.');

console.log('Portal maintenance times, status and check timing passed');
