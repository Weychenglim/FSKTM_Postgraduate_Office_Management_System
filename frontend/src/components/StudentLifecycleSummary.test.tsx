import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudentLifecycleHistory, StudentLifecycleSummary } from './StudentLifecycleSummary';

const lifecycle = {
  status: 'DEFERRED', effectiveAt: '2026-10-07T20:30:00Z',
  reason: 'Private latest reason', changedBy: 'Private Office actor',
  audits: [{ previousStatus: 'ACTIVE', newStatus: 'DEFERRED', reason: 'Private earlier reason',
    actor: 'Private audit actor', createdAt: '2026-10-07T20:30:00Z' }],
};
const publicMarkup = renderToStaticMarkup(<StudentLifecycleSummary lifecycle={lifecycle} projectStage="P2" projectSemester="Semester II 2026/2027" />);
assert.match(publicMarkup, /Deferred/);
assert.match(publicMarkup, /<dl[^>]*>.*Enrolment status.*Project stage.*>RP2<.*Current semester.*>Semester II 2026\/2027<.*<\/dl>/);
assert.match(publicMarkup, /08 Oct 2026.*04:30/);
assert.match(publicMarkup, /Malaysia, UTC\+08:00/);
assert.doesNotMatch(publicMarkup, /Private|audit history|Changed by|Reason:/);
const unchangedMarkup = renderToStaticMarkup(
  <StudentLifecycleSummary lifecycle={{ status: 'ACTIVE', effectiveAt: null }} />,
);
assert.match(unchangedMarkup, /Active/);
assert.doesNotMatch(unchangedMarkup, /Effective:|Status changed on|No lifecycle change recorded/,
  'A student without a recorded status change must not see a misleading effective-date row');
const internalMarkup = renderToStaticMarkup(<StudentLifecycleHistory lifecycle={lifecycle} />);
for (const value of ['Private latest reason','Private Office actor','Private earlier reason','Private audit actor','Active to Deferred']) {
  assert.ok(internalMarkup.includes(value), value);
}
assert.match(renderToStaticMarkup(<StudentLifecycleHistory lifecycle={{ status: 'ACTIVE', effectiveAt: null }} />), /No lifecycle changes recorded/);
console.log('Student lifecycle dossier public privacy, internal history and Malaysia timestamps passed');
