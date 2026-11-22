import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PanelRecommendationDetail} from './PanelRecordDetails';
import {PanelRecommendationReviewDrawer} from './LecturerPanelAppointments';
import type {PanelRecommendationDraft} from '../types';
import type {PanelPresentation} from '../utils/panelPresentation';

const record:PanelRecommendationDraft={id:71,studentId:'PG071',studentName:'Aina Sofea Rahman',programme:'Master of Data Science',semester:'Semester I',supervisorName:'Dr Nadia',recommendedMember:'Dr Amir',recommendedMemberId:'L071',proposedTopic:'Current saved title',abstract:'Full first paragraph.\n\nFull second paragraph.',status:'SUBMITTED_TO_PANEL',submittedDate:'20 Oct 2026',justification:'Expertise in interpretable machine learning.',workflow:[]};
const render=(row:PanelPresentation=record)=>renderToStaticMarkup(<PanelRecommendationDetail record={row}/>);

test('Panel requests separate overview, nomination, current research and review in reading order',()=>{
  const html=render();
  for(const title of ['Nomination details','Research summary','Review and outcome'])assert.ok(html.includes(`>${title}</h2>`),title);
  assert.match(html,/aria-label="Request overview"/);
  assert.match(html,/data-panel-request-columns/);
  assert.ok(html.indexOf('Nomination justification')<html.indexOf('Research summary'));
  assert.ok(html.indexOf('Dr Amir')>html.indexOf('Nomination details'),'Candidate belongs to nomination');
  assert.match(html,/aria-label="Research summary"/);
  assert.match(html,/Full first paragraph\.\n\nFull second paragraph\./);
  assert.doesNotMatch(html,/Research submitted with this request|data-detail-actions/);
});

test('Replacement context and terminal decision reasons remain distinct and visible',()=>{
  const pending=render({...record,replacesAppointmentId:12,replacementReason:'Additional expertise required.',replacedPanelMember:'Dr Previous',replacedAppointmentStatus:'ACTIVE'});
  assert.match(pending,/Panel member being replaced/);
  assert.match(pending,/continues until this replacement is approved/);
  const ended=render({...record,status:'REJECTED_BY_PANEL',replacesAppointmentId:12,replacedPanelMember:'Dr Previous',replacedAppointmentStatus:'ENDED',rejectionReason:'Unable to commit this semester.'});
  assert.match(ended,/Previous Panel member/);
  assert.ok(ended.indexOf('Unable to commit this semester.')>ended.indexOf('Review and outcome'));
  assert.doesNotMatch(ended,/continues until this replacement is approved/);
  const absent=render({...record,status:'NOT_SUBMITTED',justification:undefined});
  assert.doesNotMatch(absent,/Nomination details|Review and outcome|data-panel-review/);
  assert.match(absent,/No Panel recommendation has been submitted/);
  assert.match(render({...record,status:'NOT_SUBMITTED',justification:undefined,unavailableUntil:'2026-11-01'}),/Unavailable for new appointments until/);
});

test('Panel reviewers share decision styling while preserving role, capability and busy gates',()=>{
  const view=(extra:Partial<React.ComponentProps<typeof PanelRecommendationReviewDrawer>>={})=>renderToStaticMarkup(<PanelRecommendationReviewDrawer isOpen recommendation={record} reviewerRole="SELECTED_PANEL" onClose={()=>{}} {...extra}/>);
  assert.match(view(),/data-detail-actions/);
  assert.match(view(),/>Accept request</);
  assert.match(view(),/>Reject request</);
  assert.match(view({recommendation:{...record,status:'PENDING_COORDINATOR',canReview:true},reviewerRole:'PROGRAMME_COORDINATOR'}),/>Approve request</);
  for(const extra of [{readOnly:true},{recommendation:{...record,canReview:false}},{recommendation:{...record,participantEligible:false}}])assert.doesNotMatch(view(extra),/>Accept request<|>Reject request</);
  const busy=view({busy:true,onOpenStudent:()=>{}});
  assert.equal((busy.match(/disabled=""/g)||[]).length,4,'Back, student and both decisions are disabled');
});
