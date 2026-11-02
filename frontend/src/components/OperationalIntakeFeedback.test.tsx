import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {OperationalIntakeFeedback, isOperationalIntakeBlocked} from './OperationalIntakeFeedback';
import type {OperationalAvailability} from '../types/operationalPeriods';

const open: OperationalAvailability = {
  enforcementEnabled:true, canSubmit:true, status:'OPEN',
  opensAt:'2026-10-01T00:00:00Z', closesAt:'2026-10-16T04:00:00Z',
  effectiveDueAt:'2026-10-16T04:00:00Z', message:'Submissions are open.',
};
const render = (availability: OperationalAvailability | null, extra = {}) => renderToStaticMarkup(
  <OperationalIntakeFeedback availability={availability} loading={false} error={null} onRetry={() => {}} {...extra} />,
);

test('period blocking remains advisory and preserves existing enforcement rules', () => {
  assert.equal(isOperationalIntakeBlocked({...open, canSubmit:false}),true);
  assert.equal(isOperationalIntakeBlocked({...open, canSubmit:false, enforcementEnabled:false}),false);
  assert.equal(isOperationalIntakeBlocked(open),false);
  assert.equal(isOperationalIntakeBlocked(null),false);
});

test('open submissions show one deadline and no routine check action or card heading', () => {
  const html = render(open);
  assert.match(html,/Applications open/);
  assert.match(html,/Closes /);
  assert.match(html,/Malaysia, UTC\+08:00/);
  assert.doesNotMatch(html,/<h3|Check period|<button|Opens /);
  assert.doesNotMatch(html,/bg-amber-50|rounded-full/);
});

test('unrestricted intake does not invent or imply a configured deadline', () => {
  const html = render({...open, enforcementEnabled:false, status:'UNRESTRICTED', opensAt:null, closesAt:null, effectiveDueAt:null});
  assert.match(html,/Applications open/);
  assert.doesNotMatch(html,/Closes|deadline|Not configured|<button/);
});

test('panel forms use recommendation wording', () => {
  const html = render(open, {activity:'PANEL_RECOMMENDATION'});
  assert.match(html,/Recommendations open/);
  assert.doesNotMatch(html,/Applications/);
});

test('upcoming intake shows opening time and a way to recheck without losing a draft', () => {
  const html = render({...open, canSubmit:false, status:'UPCOMING', message:'Submissions have not opened yet.'});
  assert.match(html,/Applications not open yet/);
  assert.match(html,/Opens /);
  assert.match(html,/Check availability/);
  assert.doesNotMatch(html,/Closes /);
});

test('a personal extension replaces the general deadline', () => {
  const html = render({...open,effectiveDueAt:'2026-10-18T04:00:00Z'});
  assert.match(html,/Your deadline /);
  assert.match(html,/18 Oct 2026/);
  assert.doesNotMatch(html,/16 Oct 2026|Closes /);
});

test('ended intake uses past tense, including expired personal extensions', () => {
  const html = render({...open,canSubmit:false,status:'ENDED',message:'The submission deadline has passed.'});
  assert.match(html,/Applications closed/);
  assert.match(html,/Closed /);
  assert.doesNotMatch(html,/Closes /);
  const extended = render({...open,canSubmit:false,status:'ENDED',effectiveDueAt:'2026-10-18T04:00:00Z'});
  assert.match(extended,/Your deadline passed /);
  assert.doesNotMatch(extended,/16 Oct 2026/);
});

test('other unavailable states retain their reason without implying a deadline closure', () => {
  for (const status of ['MISSING','AMBIGUOUS','INELIGIBLE','UNAVAILABLE']) {
    const html = render({...open,canSubmit:false,status,message:'Contact the Office.'});
    assert.match(html,/Applications unavailable/);
    assert.match(html,/Contact the Office/);
    assert.doesNotMatch(html,/Applications open|Closed |Closes /);
  }
});

test('loading, failed and absent checks never show stale open availability', () => {
  const loading = render(open,{loading:true});
  assert.match(loading,/Checking availability/);
  assert.doesNotMatch(loading,/Applications open|<button/);
  const error = render(open,{error:'Network unavailable'});
  assert.match(error,/Couldn’t check availability/);
  assert.match(error,/Retry/);
  assert.doesNotMatch(error,/Applications open|Network unavailable|server/);
  assert.match(render(null),/Availability is checked when you submit/);
});

test('blocked availability uses a separate readable title, date and recheck action', () => {
  const html=render({...open,canSubmit:false,status:'UPCOMING'});
  assert.match(html,/<p[^>]*>Applications not open yet<\/p>/);
  assert.match(html,/sm:flex-row/);
  assert.doesNotMatch(html,/bg-amber-50|text-amber-900|rounded-full/);
});
