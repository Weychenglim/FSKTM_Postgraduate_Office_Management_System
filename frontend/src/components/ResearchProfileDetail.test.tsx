import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ResearchAmendmentRouteContent, ResearchProfileHistoryCard, ResearchAmendmentForm} from './ResearchAmendments';
import type {ResearchAmendmentOptions, ResearchRevision} from '../services/researchAmendmentsApi';

const noop=()=>{};
const profile={studentId:7,revision:2,title:'Current approved title',abstract:'First paragraph.\n\nSecond paragraph.',programme:'Computing'};
const options:ResearchAmendmentOptions={profile,students:[{id:7,name:'Student Seven',matricNo:'PG-007',programme:'Computing'}],programmes:['Computing','Cybersecurity'],canSubmitResearch:false,canCorrect:true,canTransfer:false};
const revision:ResearchRevision={id:2,studentId:7,revision:2,kind:'RESEARCH',before:{...profile,title:'Earlier title'},after:profile,actorName:'Dr Reviewer',createdAt:'2026-10-20T08:00:00Z',reason:'Approved clarification',requestId:9};
const render=(role:'Student'|'Lecturer'|'Programme Coordinator'|'Office Staff/Admin'='Office Staff/Admin',overrides:Partial<React.ComponentProps<typeof ResearchAmendmentRouteContent>>={})=>renderToStaticMarkup(<ResearchAmendmentRouteContent role={role} routeView="profile" options={options} rows={[]} revisions={[revision]} busy={false} onAction={noop} onNavigateToNew={noop} requestForm={null} {...overrides}/>);

test('All roles read independent overview and current research without input-style field boxes',()=>{
  for(const role of ['Student','Lecturer','Programme Coordinator','Office Staff/Admin'] as const){
    const html=render(role);
    assert.match(html,/aria-label="Student overview"/);
    assert.match(html,/data-current-research/);
    for(const value of ['Student Seven','PG-007','Current approved title','First paragraph.','Second paragraph.','Current version'])assert.ok(html.includes(value),value);
    assert.doesNotMatch(html,/Earlier title|bg-slate-50 p-3|Correct research or request transfer/);
    assert.equal(html.split('>Computing<').length-1,1,'Programme is not duplicated');
    if(role!=='Office Staff/Admin')assert.doesNotMatch(html,/Correct research text|Request programme transfer/);
  }
});

test('Only matching current saved-version metadata can describe the profile',()=>{
  assert.match(render(),/Dr Reviewer/);
  for(const changed of [{...revision,revision:3},{...revision,studentId:8},{...revision,studentId:undefined},{...revision,after:{...profile,title:'Different saved record'}}])assert.doesNotMatch(render('Lecturer',{revisions:[changed]}),/Dr Reviewer|Latest recorded update/);
  assert.doesNotMatch(render('Student',{revisions:[]}),/Latest recorded update|Not recorded.*Not recorded/);
});

test('History summaries stay visible and preserve individually expandable immutable records',()=>{
  const initial={...revision,id:1,revision:0,kind:'BASELINE' as const,after:{...profile,title:'Initial saved title'},before:{title:'',abstract:'',programme:''}};
  const html=renderToStaticMarkup(<ResearchProfileHistoryCard revisions={[initial,revision]} studentView={false}/>);
  assert.match(html,/<section[^>]*aria-label="Revision history"/);
  assert.match(html,/2 saved versions/);
  assert.ok(html.indexOf('Revision 2')<html.indexOf('Initial record'));
  assert.equal((html.match(/<details/g)||[]).length,2,'Only individual versions collapse');
  assert.match(html,/Recorded before this revision|Earlier title|Approved clarification|Initial saved title/);
  assert.equal(initial.revision,0);
});

test('Office corrections keep their attestation and omit transfer creation',()=>{
  const html=renderToStaticMarkup(<ResearchAmendmentForm options={options} initialKind="CORRECTION" busy={false} onSave={noop}/>);
  assert.match(html,/value="CORRECTION" selected/);
  assert.match(html,/I confirm this corrects typography/);
  assert.doesNotMatch(html,/Destination programme|Request programme transfer/);
});
