import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import type { DemoUser, PortalMaintenance } from '../types';
import { MaintenanceBanner, MaintenanceScreen, SignInMaintenanceNotice } from './MaintenanceNotices';
import { SettingsView } from './SettingsView';

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const planned: PortalMaintenance = { status: 'planned', startsAt: inHours(2), expectedEnd: inHours(3), message: 'Moving to a new server.' };
const on: PortalMaintenance = { ...planned, status: 'on', startsAt: inHours(-1) };
const off: PortalMaintenance = { status: 'off', startsAt: null, expectedEnd: null, message: '' };
const banner = (maintenance: PortalMaintenance | null, isOffice: boolean) =>
  renderToStaticMarkup(<MemoryRouter><MaintenanceBanner maintenance={maintenance} isOffice={isOffice} onChanged={() => {}} /></MemoryRouter>);

assert.equal(banner(null, false), '');
assert.equal(banner(off, true), '');
assert.equal(banner(on, false), '', 'everyone but the office gets the maintenance page instead');

const studentPlanned = banner(planned, false);
assert.match(studentPlanned, /Planned maintenance:/);
assert.match(studentPlanned, /save your work before it starts/);
assert.doesNotMatch(studentPlanned, /Manage|End maintenance/);

const officePlanned = banner(planned, true);
assert.match(officePlanned, /cannot use the portal then/);
assert.match(officePlanned, /Manage/);
assert.doesNotMatch(officePlanned, /End maintenance/);

const officeOn = banner(on, true);
assert.match(officeOn, /Maintenance is on\./);
assert.match(officeOn, /Only PG office staff can use the portal/);
assert.match(officeOn, /End maintenance/);

const screen = renderToStaticMarkup(<MaintenanceScreen maintenance={on} onSignOut={() => {}} />);
assert.match(screen, /The portal is under maintenance/);
assert.match(screen, /Moving to a new server\./);
assert.match(screen, /Expected back by/);
assert.match(screen, /pg\.fsktm@um\.edu\.my/);
assert.match(screen, /You stay signed in/);
assert.match(screen, /Sign out/);

assert.equal(renderToStaticMarkup(<SignInMaintenanceNotice maintenance={off} />), '');
assert.match(renderToStaticMarkup(<SignInMaintenanceNotice maintenance={on} />), /Only PG office staff can sign in until it ends/);
assert.match(renderToStaticMarkup(<SignInMaintenanceNotice maintenance={planned} />), /The portal will be unavailable then/);

const settings = (role: DemoUser['role']) => renderToStaticMarkup(
  <SettingsView currentUser={{ id: '9', fullName: 'Olivia Office', email: 'office@example.com', role, phone: '', department: 'PG Office' }} onLogout={() => {}} onUserUpdated={() => {}} onPasswordChanged={() => {}} />,
);
assert.match(settings('Office Staff/Admin'), /Portal maintenance/);
assert.doesNotMatch(settings('Student'), /Portal maintenance/);
assert.doesNotMatch(settings('Programme Coordinator'), /Portal maintenance/);

console.log('Portal maintenance banner, page, sign-in notice and Settings card passed');
