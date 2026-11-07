import assert from 'node:assert/strict';
import React from 'react';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {SubmittedMarksActions, MarkCorrectionHistoryView} from './SubmittedMarksActions';
import type {MarkRecordDetail} from '../types';

const record = {
  recordId: 'MRK-00001', student:{name:'Student',studentId:'S1'}, evaluator:{name:'Lecturer'}, entry: {status:'SUBMITTED',comments:'Original',totalMark:'80.00'},
  rubric: {components:[{id:'1',name:'Problem',marksAwarded:'30.00',maxMarks:'40.00'}]},
  officeActions: {canCorrect:true,canReopen:true,version:'reviewed'},
} as MarkRecordDetail;
const render = (value: MarkRecordDetail) => renderToStaticMarkup(<SubmittedMarksActions record={value} onChanged={async()=>{}} onReload={async()=>{}}/>);
assert.match(render(record), /Correct submitted marks/);
assert.match(render(record), /Reopen for Lecturer/);
assert.doesNotMatch(render({...record,officeActions:{...record.officeActions!,canReopen:false}}), /Reopen for Lecturer/);
for (const value of [{...record,officeActions:undefined}, {...record,officeActions:{...record.officeActions!,version:null}}, {...record,entry:{...record.entry,status:'DRAFT' as const}}]) {
  assert.equal(render(value), '');
}
const history: MarkRecordDetail['correctionHistory'] = [{id:1,action:'CORRECT',actorName:'Office Reviewer',actorRole:'Office Staff/Admin',reason:'Verified error',createdAt:'2026-10-07T12:00:00Z',beforeValues:{status:'SUBMITTED',totalMark:'80.00',comments:'Original',scores:{'1':'30.00'}},afterValues:{status:'SUBMITTED',totalMark:'85.00',comments:'Reviewed <text>',scores:{'1':'35.00'}}}];
const audit = renderToStaticMarkup(<MarkCorrectionHistoryView events={history} components={record.rubric.components}/>);
assert.match(audit, /Office Reviewer/); assert.match(audit, /Verified error/);
assert.match(audit, /Before/); assert.match(audit, /After/); assert.match(audit, /Problem/);
assert.match(audit, /80.00/); assert.match(audit, /85.00/); assert.match(audit, /Reviewed &lt;text&gt;/);
console.log('Submitted Marks action authority and readable before/after audit rendering passed');

const actionsSource = readFileSync(new URL('./SubmittedMarksActions.tsx', import.meta.url), 'utf8');
const modalStart = actionsSource.indexOf('<PortalModal');
const modalEnd = actionsSource.indexOf('</PortalModal>', modalStart);
assert.notEqual(modalStart, -1);
assert.notEqual(modalEnd, -1);
assert.match(actionsSource.slice(modalStart, modalEnd), /<AlertMessage type="error"/,
  'correction validation errors must use the shared alert inside the visible dialog');
console.log('Submitted Marks correction errors render through the shared alert inside the modal');
