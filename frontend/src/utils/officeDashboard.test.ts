import assert from 'node:assert/strict';
import test from 'node:test';
import type { DashboardTask } from '../types';
import { groupOfficeAttention, officeTaskRoute, officeWorkloadNavigationState, officeMarksDeadlineRoute, officeHomeAttention } from './officeDashboard';

const task = (changes: Partial<DashboardTask>): DashboardTask => ({id:'request-1',name:'Record',status:'pending',statusText:'Waiting',target:'',targetModule:'PANEL_APPOINTMENTS',...changes});
test('home summaries combine capacity roles honestly and distinguish Office review from other owners',()=>{
  const summary=officeHomeAttention([
    task({id:'capacity_panel_1',recordType:'LECTURER_CAPACITY',recordId:'STAFF1',status:'critical'}),
    task({id:'capacity_supervisor_1',recordType:'LECTURER_CAPACITY',recordId:'STAFF1',status:'critical'}),
    task({id:'coordinator',waitingOn:'PROGRAMME_COORDINATOR',waitingDays:50}),
    task({id:'office',targetModule:'SUPERVISOR_APPOINTMENTS',waitingOn:'FACULTY_PROCESSING'}),
    task({id:'done',status:'completed'}),
  ]);
  const capacity=summary.review.find(row=>row.id.startsWith('capacity:'))!;
  assert.ok(capacity);assert.match(capacity.detail,/1 Supervisor/);assert.match(capacity.detail,/1 Panel/);
  assert.doesNotMatch(capacity.detail,/2 lecturers/);assert.equal(capacity.urgency,'normal');
  assert.equal(summary.waiting.length,1);assert.match(summary.waiting[0].detail,/Programme Coordinator/);
  assert.doesNotMatch(summary.waiting[0].title,/urgent|overdue/i);
  assert.ok(summary.review.some(row=>row.route==='/supervisor-appointments'));
  assert.equal([...summary.review,...summary.waiting].reduce((count,row)=>count+row.count,0),4);
});
test('home keeps every category discoverable and prioritises real overdue evaluations',()=>{
  const summary=officeHomeAttention([
    task({id:'capacity_panel_1',recordType:'LECTURER_CAPACITY',status:'critical'}),
    task({id:'data',recordType:'RECONCILIATION_ISSUE',status:'critical'}),
    task({id:'marks1',targetModule:'MARKS',deadlineState:'OVERDUE'}),
    task({id:'marks2',targetModule:'MARKS',deadlineState:'DUE_TODAY'}),
    task({id:'marks3',targetModule:'MARKS',deadlineState:'NO_DEADLINE'}),
    task({id:'task_upload',targetModule:'DASHBOARD'}),
    task({id:'panel1',waitingOn:'SELECTED_PANEL'}),
    task({id:'panel2',waitingOn:'PROGRAMME_COORDINATOR'}),
  ]);
  const rows=[...summary.review,...summary.waiting];
  assert.equal(rows.reduce((count,row)=>count+row.count,0),8);
  assert.equal(summary.review[0].urgency,'overdue');
  assert.ok(rows.some(row=>row.route==='/dashboard/timeline'));
  assert.ok(rows.length>5,'Do not silently cap categories at five');
  assert.equal(summary.waiting.length,1,'One workspace should not become a per-owner feed');
});
test('merging different waiting owners retains the strongest real deadline and deduplicates records',()=>{
  const first=task({id:'panel1',waitingOn:'SELECTED_PANEL'});
  const overdue=task({id:'panel2',waitingOn:'PROGRAMME_COORDINATOR',deadlineState:'OVERDUE'});
  const summary=officeHomeAttention([first,first,overdue]);
  assert.equal(summary.waiting.length,1);
  assert.equal(summary.waiting[0].count,2);
  assert.equal(summary.waiting[0].urgency,'overdue');
  assert.match(summary.waiting[0].detail,/Includes 1 overdue record\./);
  assert.match(summary.waiting[0].detail,/2 records in preview/);
});
test('Marks deadline navigation preserves the selected semester and period, or opens the Marks activity',()=>{
  assert.equal(officeMarksDeadlineRoute({id:42,semesterId:7}),'/dashboard/periods?semester=7&manage=window#marks-period-42');
  assert.equal(officeMarksDeadlineRoute(),'/dashboard/periods#period-panel-MARKS');
  assert.equal(officeMarksDeadlineRoute({id:42,semesterId:null}),'/dashboard/periods#period-panel-MARKS');
});
test('Dashboard-origin workloads retain return context without changing participant navigation',()=>{
  assert.deepEqual(officeWorkloadNavigationState('/panel-appointments/workload'),{officeDashboardOrigin:true});
  assert.deepEqual(officeWorkloadNavigationState('/panel-appointments/workload?monitor=panel-capacity'),{officeDashboardOrigin:true});
  assert.deepEqual(officeWorkloadNavigationState('/supervisor-appointments/workload'),{officeDashboardOrigin:true});
  assert.equal(officeWorkloadNavigationState('/dashboard/participant-lifecycle'),undefined);
});
test('capacity groups preserve counting units and exact destinations without counting completed/calendar items', () => {
  const rows = [task({id:'capacity_panel_1',recordType:'LECTURER_CAPACITY',recordId:'STAFF/1',semesterCode:'S1',status:'critical',statusText:'Not Configured'}),task({id:'capacity_panel_2',recordType:'LECTURER_CAPACITY',recordId:'STAFF2',semesterCode:'S1',status:'critical',statusText:'Not Configured'}),task({id:'capacity_supervisor_1',recordType:'LECTURER_CAPACITY',recordId:'STAFF/1',semesterCode:'S1',status:'critical',statusText:'Not Configured'}),task({id:'task_upload',status:'completed'}),task({id:'timeline_1',recordType:'TIMELINE_ENTRY',status:'upcoming'})];
  const groups = groupOfficeAttention(rows);
  assert.equal(groups.length,2);
  assert.deepEqual(groups.map(group=>group.tasks.length).sort(),[1,2]);
  assert.equal(officeTaskRoute(rows[0]),'/dashboard/lecturer-capacity?lecturer=STAFF%2F1');
});
test('actual overdue work precedes blocking configuration and ordinary waits, with no SLA inferred', () => {
  const groups=groupOfficeAttention([task({waitingDays:100,waitingOn:'PROGRAMME_COORDINATOR'}),task({id:'capacity_panel_1',recordType:'LECTURER_CAPACITY',status:'critical'}),task({id:'evaluation1',targetModule:'MARKS',deadlineState:'OVERDUE',dueAt:'2026-10-01'})]);
  assert.equal(groups.length,3);
  assert.equal(groups[0].tasks[0].id,'evaluation1');
  assert.equal(groups[2].tasks[0].waitingDays,100);
  assert.doesNotMatch(groups[2].title,/overdue|urgent/i);
});
