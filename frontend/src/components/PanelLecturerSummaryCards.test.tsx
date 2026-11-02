import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {PanelLecturerSummaryCards} from './PanelLecturerSummaryCards';
import type {PanelWorkloadSummary} from '../types';

const workload:PanelWorkloadSummary={workloadCount:4,currentStudents:4,confirmedAppointments:2,pendingNominations:2,workloadLimit:10,availableSlots:6,capacityState:'AVAILABLE',selectable:true,semesterCode:'2026-2027-S1',capacityPlanVersion:2};
test('Panel landing metrics use active plus reserved capacity and incoming review counts',()=>{
  const html=render(<PanelLecturerSummaryCards workload={workload} reviewCount={3} awaitingCoordinatorCount={1}/>);
  assert.equal((html.match(/<article/g)??[]).length,3);
  for(const text of ['Panel workload','Needs your review','Awaiting Coordinator','2 active · 2 awaiting approval'])assert.ok(html.includes(text),text);
  assert.match(html,/4 <span[^>]*>\/ 10/);
  assert.match(html,/card-metric">3</);
  assert.match(html,/card-metric">1</);
  const single=render(<PanelLecturerSummaryCards workload={{...workload,workloadCount:2,currentStudents:2,confirmedAppointments:1,pendingNominations:1}} reviewCount={0} awaitingCoordinatorCount={0}/>);
  assert.match(single,/1 active · 1 awaiting approval/);
  assert.doesNotMatch(single,/active appointment \+|reserved nomination/);
});
test('missing capacity configuration is explicit rather than a zero-seat capacity bar',()=>{
  const html=render(<PanelLecturerSummaryCards workload={{...workload,capacityState:'NOT_CONFIGURED',workloadLimit:0,selectable:false}} reviewCount={0} awaitingCoordinatorCount={0}/>);
  assert.match(html,/Not configured/);
  assert.doesNotMatch(html,/\/ 0/);
});
test('temporary unavailability includes its recorded end date',()=>{
  const html=render(<PanelLecturerSummaryCards workload={{...workload,capacityState:'TEMPORARILY_UNAVAILABLE',selectable:false,unavailableUntil:'2026-10-25'}} reviewCount={0} awaitingCoordinatorCount={0}/>);
  assert.match(html,/Temporarily unavailable/);
  assert.match(html,/25 Oct 2026/);
});
