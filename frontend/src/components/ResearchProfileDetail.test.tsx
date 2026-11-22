import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ResearchAmendmentRouteContent, ResearchProfileHistoryCard, ResearchAmendmentForm} from './ResearchAmendments';
import {RequestedChangesComparison} from './RequestedChangesComparison';
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
    for(const value of ['Student Seven','PG-007','Current approved title','First paragraph.','Second paragraph.'])assert.ok(html.includes(value),value);
    assert.doesNotMatch(html, /Current version|Latest recorded update|Recorded by/);
    assert.doesNotMatch(html,/Earlier title|bg-slate-50 p-3|Correct research or request transfer/);
    assert.equal(html.split('>Computing<').length-1,1,'Programme is not duplicated');
    if(role!=='Office Staff/Admin')assert.doesNotMatch(html,/Correct research text|Request programme transfer/);
  }
});

test('Student profile shows submitted research intent in readable groups below current research', () => {
  const html = render('Student', {options: {...options, profile: {
    ...profile, researchArea: 'Human-computer interaction', submittedIntent: {
      record: {version: 1, introduction: 'Project background', aim: 'Explore the topic',
        researchQuestions: 'What changes?', researchObjectives: 'Measure the outcome',
        significance: 'Support better decisions', methodology: 'Interview participants',
        expectedOutcomes: 'Produce findings', skillsNeeded: 'Interviewing', timeline: 'Week one'},
      submittedAt: '2026-10-10T08:00:00Z', titleOrAbstractChanged: true,
    },
  }}});
  for (const value of ['Human-computer interaction', 'Background and purpose', 'Questions and objectives',
    'Research plan', 'Interview participants', 'Week one']) {
    assert.ok(html.includes(value), value);
  }
  assert.ok(html.indexOf('Current approved title') < html.indexOf('Background and purpose'));
  assert.doesNotMatch(html, /First submitted with your supervisor application|differs from the original submission/);
  assert.doesNotMatch(html, /max-w-\[\d+ch\]/, 'Research text uses the card width');
  assert.match(html, /<summary[^>]*>[^]*?<span[^>]*>Research plan<\/span>/);
  assert.match(html, /<dt class="[^"]*font-semibold[^"]*">Methodology<\/dt><dd class="[^"]*font-normal[^"]*">Interview participants<\/dd>/);
  assert.equal((html.match(/<details\b/g) || []).length, 3);
  assert.doesNotMatch(html, /<details[^>]*\bopen(?:=|\s|>)/);
});

test('Student profile explains when the original intent is unavailable', () => {
  assert.match(render('Student', {options: {...options, profile: {...profile, submittedIntent: null}}}),
    /No research intent on record/);
});

test('Student profile reads an approved plan even when there is no original submission', () => {
  const html = render('Student', {options: {...options, profile: {
    ...profile, submittedIntent: null, currentIntent: {methodology:'Survey postgraduate students.'},
  }}});
  assert.match(html, /Current research plan/);
  assert.match(html, /Survey postgraduate students\./);
  assert.match(html, /Not recorded/);
});

test('Plan comparison shows only changed fields and uses full width for long answers', () => {
  const html = renderToStaticMarkup(<RequestedChangesComparison
    before={{...profile, methodology:'Conduct interviews.', timeline:'Term one'}}
    after={{...profile, methodology:'Run a survey.', timeline:'Term one'}}/>);
  assert.match(html, /Methodology comparison/);
  assert.match(html, /Conduct interviews\..*Run a survey\./);
  assert.doesNotMatch(html, /Term one|sm:grid-cols-2/);
});

test('History summaries stay visible and preserve individually expandable immutable records',()=>{
  const initial={...revision,id:1,revision:0,kind:'BASELINE' as const,after:{...profile,title:'Initial saved title'},before:{title:'',abstract:'',programme:''}};
  const html=renderToStaticMarkup(<ResearchProfileHistoryCard revisions={[initial,revision]}/>);
  assert.match(html,/<section[^>]*aria-label="Revision history"/);
  assert.match(html,/Title updated/);
  assert.ok(html.indexOf('Revision 2')<html.indexOf('View initial record'));
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
