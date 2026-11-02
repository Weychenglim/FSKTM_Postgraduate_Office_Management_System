import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {CandidateCapacity, CandidateCapacityBreakdown} from './CandidateCapacity';

test('candidate availability identifies the role and highlights the last place',()=>{
  for(const role of ['Supervisor','Panel'] as const){
    const html=render(<CandidateCapacity role={role} capacityState="AVAILABLE" availableSlots={1} limit={5} load={4}/>);
    assert.match(html,new RegExp(`1 ${role} place remaining`));
    assert.match(html,/amber/);
    assert.doesNotMatch(html,/active|reserved/);
  }
});
test('restrictions override numerical availability and unknown capacity is not zero',()=>{
  for(const state of ['NOT_CONFIGURED','TEMPORARILY_UNAVAILABLE','INELIGIBLE','FULL','OVER_CAPACITY'] as const){
    const html=render(<CandidateCapacity role="Panel" capacityState={state} availableSlots={3} limit={5} load={2}/>);
    assert.doesNotMatch(html,/remaining/);
  }
  assert.match(render(<CandidateCapacity role="Panel" limit={0} load={0}/>),/Availability not configured/);
});
test('selected capacity explains accepted reservations without counting unanswered requests',()=>{
  const html=render(<CandidateCapacityBreakdown activeLoad={3} reservedLoad={1} limit={6}/>);
  assert.match(html,/3 active/);
  assert.match(html,/1 awaiting Coordinator approval/);
  assert.match(html,/Limit 6/);
  assert.doesNotMatch(render(<CandidateCapacityBreakdown/>),/0 active|Limit 0/);
});
