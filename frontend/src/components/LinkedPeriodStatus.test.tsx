import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LinkedPeriodStatus,TimelineSubmissionStatus} from './LinkedPeriodStatus';

test('draft lifecycle remains explicit even while its dates are in progress and activity enforcement is enabled',()=>{
  const html=renderToStaticMarkup(<LinkedPeriodStatus status={{lifecycleStatus:'DRAFT',scheduleStatus:'OPEN',datesEnforced:true}}/>);
  assert.match(html,/DRAFT/);assert.match(html,/Schedule: Open/);assert.match(html,/Dates enforced/);assert.match(html,/Draft dates do not control submissions/);
});
test('Marks rules and closed windows do not imply open submission access',()=>{
  const html=renderToStaticMarkup(<LinkedPeriodStatus status={{lifecycleStatus:'CLOSED',scheduleStatus:'OPEN',datesEnforced:null}}/>);
  assert.match(html,/Evaluation rules apply/);assert.match(html,/This window is closed/);assert.doesNotMatch(html,/Dates enforced/);
});

test('compact table status retains lifecycle, schedule and enforcement without repeated guidance',()=>{
  const html=renderToStaticMarkup(<LinkedPeriodStatus compact status={{lifecycleStatus:'DRAFT',scheduleStatus:'UPCOMING',datesEnforced:false}}/>);
  assert.match(html,/DRAFT/);assert.match(html,/Schedule upcoming/);assert.match(html,/Dates not enforced/);assert.doesNotMatch(html,/Draft dates do not control submissions/);
});

for(const lifecycleStatus of ['DRAFT','PUBLISHED','CLOSED','ARCHIVED'])test(`dashboard hides unrestricted ${lifecycleStatus} status`,()=>{
  assert.equal(renderToStaticMarkup(<TimelineSubmissionStatus status={{lifecycleStatus,scheduleStatus:'UPCOMING',datesEnforced:false}}/>),'');
});
for(const [lifecycleStatus,scheduleStatus,label] of [['PUBLISHED','UPCOMING','Submissions not open yet'],['PUBLISHED','OPEN','Submissions open'],['PUBLISHED','ENDED','Submissions closed'],['CLOSED','OPEN','Submissions closed'],['DRAFT','OPEN','Dates not final']] as const)test(`dashboard ${lifecycleStatus} ${scheduleStatus} uses plain wording`,()=>{
 const html=renderToStaticMarkup(<TimelineSubmissionStatus status={{lifecycleStatus,scheduleStatus,datesEnforced:true}}/>);
 assert.match(html,new RegExp(label));assert.doesNotMatch(html,/PUBLISHED|enforced|Schedule:/);
});
test('Marks dashboard describes marking, without promising task eligibility',()=>{
 const html=renderToStaticMarkup(<TimelineSubmissionStatus marks status={{lifecycleStatus:'PUBLISHED',scheduleStatus:'UPCOMING',datesEnforced:null}}/>);
 assert.match(html,/Marking not open yet/);assert.doesNotMatch(html,/Evaluation rules|PUBLISHED/);
});
