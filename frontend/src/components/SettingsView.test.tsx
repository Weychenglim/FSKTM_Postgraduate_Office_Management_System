import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsView } from './SettingsView';

const html = renderToStaticMarkup(<SettingsView currentUser={{ id: '5', fullName: 'Test Student', email: 'student@example.com', role: 'Student', phone: '0123456789', department: 'Computing' }} onLogout={() => {}} onUserUpdated={() => {}} onPasswordChanged={() => {}} />);
assert.match(html, /Loading settings/);
assert.match(html, /Urgent notifications always stay on/);
assert.match(html, /Email changes are managed by the Office/);
assert.match(html, /Not available/);
assert.match(html, /signed out on all devices/);
assert.doesNotMatch(html, /Receive important updates by email/);
assert.match(html, /value="0123456789"/);
assert.match(html, /<fieldset disabled/);
console.log('Settings loading safeguards and truthful notification controls passed');
