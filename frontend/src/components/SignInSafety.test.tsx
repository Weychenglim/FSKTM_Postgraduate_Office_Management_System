import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ForcedPasswordChange } from './ForcedPasswordChange';
import { LoginCard } from './LoginCard';

const expiredNotice = 'Your session has ended. Please sign in again.';
assert.match(renderToStaticMarkup(<LoginCard notice={expiredNotice} />), /Your session has ended/);
assert.doesNotMatch(renderToStaticMarkup(<LoginCard />), /session has ended/);

const forced = renderToStaticMarkup(
  <ForcedPasswordChange userName="Aisyah" onChanged={() => {}} onLogout={() => {}} />,
);
for (const id of ['forced-current-pw', 'forced-new-pw', 'forced-confirm-pw']) {
  assert.ok(forced.includes(`id="${id}"`), `forced change form is missing ${id}`);
}
assert.match(forced, /Set New Password/);
assert.match(forced, /Sign out instead/);

const app = readFileSync(resolve('src/App.tsx'), 'utf8');
assert.match(app, /if \(currentUser\.mustChangePassword\) \{[\s\S]{0,400}<ForcedPasswordChange/);
assert.match(
  app,
  /const handleExpiry = \(event: Event\) => \{[\s\S]{0,160}setSessionNotice\(reason \|\| 'Your session has ended\. Please sign in again\.'\);/,
);
assert.match(app, /onChanged=\{\(\) => setCurrentUser\(\(user\) => \(user \? \{ \.\.\.user, mustChangePassword: false \} : user\)\)\}/);
assert.match(app, /const handleLogout = \(\) => \{[\s\S]{0,120}setSessionNotice\(null\);/);
assert.match(app, /notice=\{sessionNotice\}/);
assert.match(app, /PASSWORD_CHANGE_REQUIRED_EVENT, handlePasswordChangeRequired/);

console.log('Sign-in safety rendering and wiring passed.');
