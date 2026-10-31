import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DemoUser, PortalMaintenance } from '../types';
import { MaintenanceBanner, MaintenanceScreen, SignInMaintenanceNotice } from './MaintenanceNotices';
import { SettingsView } from './SettingsView';

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const planned: PortalMaintenance = { status: 'planned', startsAt: inHours(2), expectedEnd: inHours(3), message: 'Moving to a new server.' };
const on: PortalMaintenance = { ...planned, status: 'on', startsAt: inHours(-1) };
const off: PortalMaintenance = { status: 'off', startsAt: null, expectedEnd: null, message: '' };
const startedSincePlanned: PortalMaintenance = { ...planned, startsAt: inHours(-0.01) };

assert.equal(renderToStaticMarkup(<MaintenanceBanner maintenance={null} />), '');
assert.equal(renderToStaticMarkup(<MaintenanceBanner maintenance={off} />), '');
assert.equal(renderToStaticMarkup(<MaintenanceBanner maintenance={on} />), '', 'while it is on, nobody sees the portal at all');
assert.equal(renderToStaticMarkup(<MaintenanceBanner maintenance={startedSincePlanned} />), '', 'a planned start that has passed counts as on');
const banner = renderToStaticMarkup(<MaintenanceBanner maintenance={planned} />);
assert.match(banner, /Planned maintenance:/);
assert.match(banner, /save your work before it starts/);
assert.doesNotMatch(banner, /<button/, 'nobody manages maintenance from the portal');

const signedIn = renderToStaticMarkup(<MaintenanceScreen maintenance={on} onSignOut={() => {}} />);
assert.match(signedIn, /The portal is under maintenance/);
assert.match(signedIn, /Moving to a new server\./);
assert.match(signedIn, /Expected back by/);
assert.match(signedIn, /pg\.fsktm@um\.edu\.my/);
assert.match(signedIn, /You stay signed in/);
assert.match(signedIn, /Sign out/);

const visitor = renderToStaticMarkup(<MaintenanceScreen maintenance={on} />);
assert.match(visitor, /opens the portal as soon as it is back/);
assert.doesNotMatch(visitor, /Sign out|Sign in|password/i, 'no sign-in form or sign-in wording for visitors');

assert.equal(renderToStaticMarkup(<SignInMaintenanceNotice maintenance={off} />), '');
assert.equal(renderToStaticMarkup(<SignInMaintenanceNotice maintenance={on} />), '');
assert.match(renderToStaticMarkup(<SignInMaintenanceNotice maintenance={planned} />), /The portal will be unavailable then/);

const settings = (role: DemoUser['role']) => renderToStaticMarkup(
  <SettingsView currentUser={{ id: '9', fullName: 'Olivia Office', email: 'office@example.com', role, phone: '', department: 'PG Office' }} onLogout={() => {}} onUserUpdated={() => {}} onPasswordChanged={() => {}} />,
);
assert.doesNotMatch(settings('Office Staff/Admin'), /maintenance/i, 'the switch is in Django admin, not in the office Settings');

// While maintenance is on the app shows only this page, before it decides between sign-in and the portal.
const app = readFileSync(resolve('src/App.tsx'), 'utf8');
const screenAt = app.indexOf('<MaintenanceScreen');
assert.ok(screenAt > 0 && screenAt < app.indexOf('<LoginCard'), 'the maintenance page comes before the sign-in page');
assert.ok(app.indexOf('!maintenanceWatch.checked') < screenAt, 'the app waits for the maintenance check first');

console.log('Portal maintenance banner, page and sign-in notice passed');
