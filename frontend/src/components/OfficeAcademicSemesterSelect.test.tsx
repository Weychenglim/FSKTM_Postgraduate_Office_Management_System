import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {test} from 'node:test';
import type {AcademicSemester} from '../types/academicSemester';
import {OfficeAcademicSemesterSelect} from './OfficeAcademicSemesterSelect';
import {getStatusBadgeTone} from './PortalPrimitives';

const semester={id:1,label:'Semester I 2026/2027',startsOn:'2026-09-01',endsOn:'2027-02-28',lifecycleStatus:'DRAFT',effectiveStatus:'DRAFT'} as AcademicSemester;
test('Office semester selectors share labels, dates, placeholder behavior and status styling',()=>{
  for(const id of ['timeline-academic-semester','capacity-academic-semester','period-academic-semester']) {
    const html=renderToStaticMarkup(<OfficeAcademicSemesterSelect id={id} semesters={[semester]} selectedId={1} onChange={()=>{}}/>);
    assert.match(html,/class="capacity-field-label">Academic semester/);
    assert.match(html,/class="capacity-semester-dates">01 Sept 2026 – 28 Feb 2027/);
    assert.match(html,/<option value="" disabled="" hidden="">Select semester/);
    assert.match(html,/bg-amber-50 text-amber-800/);
    assert.match(html,/aria-label="Semester status"/);
  }
});
test('Effective semester status overrides stored lifecycle consistently',()=>{
  const html=renderToStaticMarkup(<OfficeAcademicSemesterSelect id="semester" semesters={[{...semester,lifecycleStatus:'ACTIVE',effectiveStatus:'EXPIRED'}]} selectedId={1} onChange={()=>{}}/>);
  assert.match(html,/>Expired</);
  assert.doesNotMatch(html,/>Active</);
  const empty=renderToStaticMarkup(<OfficeAcademicSemesterSelect id="semester" semesters={[]} selectedId={null} onChange={()=>{}}/>);
  assert.match(empty,/No available semesters/);
  assert.match(empty,/<button[^>]*disabled=""/);
  assert.doesNotMatch(empty,/aria-label="Semester status"/);
});
test('Matching lifecycle statuses use matching portal badge colours',()=>{
  for(const status of ['ACTIVE','PUBLISHED','OPEN']) assert.equal(getStatusBadgeTone(status),'success');
  assert.equal(getStatusBadgeTone('DRAFT'),'warning');
  assert.equal(getStatusBadgeTone('UPCOMING'),'info');
  for(const status of ['CLOSED','ARCHIVED']) assert.equal(getStatusBadgeTone(status),'neutral');
});
