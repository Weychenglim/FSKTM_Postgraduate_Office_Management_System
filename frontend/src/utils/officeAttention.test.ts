import assert from 'node:assert/strict';
import test from 'node:test';
import {officeAttentionCategoryRoute, officeAttentionRecordRoute, officeAttentionPreview} from './officeAttention';
import type {OfficeAttentionRecord, OfficeAttentionSummary} from '../services/officeAttentionApi';

test('attention preview stays bounded and category links keep responsibility',()=>{
  const groups=Array.from({length:7},(_,i)=>({id:`review:${i}`,category:'capacity',responsibility:i<5?'review':'waiting',count:40,urgency:'normal'} as OfficeAttentionSummary));
  assert.equal(officeAttentionPreview(groups).length,4);
  assert.equal(groups.length,7);
  const route=officeAttentionCategoryRoute({...groups[0],responsibility:'waiting'});
  assert.equal(route,'/dashboard/attention?category=capacity&responsibility=waiting');
});
test('attention opens exact records and the appropriate existing workspaces',()=>{
  const row=(recordType:string,recordId='7')=>({recordType,recordId} as OfficeAttentionRecord);
  assert.equal(officeAttentionRecordRoute(row('SUPERVISOR_APPLICATION')),'/supervisor-appointments/request-7');
  assert.equal(officeAttentionRecordRoute(row('CO_SUPERVISOR_NOMINATION')),'/supervisor-appointments/supporting-requests/7');
  assert.equal(officeAttentionRecordRoute(row('RESEARCH_AMENDMENT')),'/supervisor-appointments/research-changes/7');
  assert.equal(officeAttentionRecordRoute(row('PANEL_RECOMMENDATION')),'/panel-appointments/records/recommendation-7');
  assert.equal(officeAttentionRecordRoute(row('EVALUATION_TASK')),'/marks/records/MRK-00007');
  assert.equal(officeAttentionRecordRoute({...row('LECTURER_CAPACITY','STAFF 1'),semesterCode:'2026-S1'}),'/dashboard/lecturer-capacity?lecturer=STAFF+1');
  assert.equal(officeAttentionRecordRoute(row('RECONCILIATION_ISSUE')),'/dashboard/workflow-reconciliation');
  assert.equal(officeAttentionRecordRoute({id:'task_upload'} as OfficeAttentionRecord),'/dashboard/timeline');
});

test('document setup summary and record link directly to requirements',()=>{
  assert.equal(officeAttentionCategoryRoute({category:'documents',responsibility:'review'} as OfficeAttentionSummary),'/supervisor-appointments/requirements');
  assert.equal(officeAttentionRecordRoute({recordType:'SUPERVISOR_DOCUMENT_REQUIREMENTS',category:'documents'} as OfficeAttentionRecord),'/supervisor-appointments/requirements');
});
