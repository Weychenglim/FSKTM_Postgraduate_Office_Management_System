import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkEntryDetail } from './MarkEntryDetail';
const task: any = { studentId:'S1', studentName:'Student', researchTitle:'Research', status:'DRAFT SAVED', canEdit:false, canSubmit:false, components:[{id:1,name:'Criterion',maxMarks:'10',marksAwarded:'5',feedback:'',required:true}] };
const render = (value: any) => renderToStaticMarkup(<MarkEntryDetail task={value} onBack={()=>{}} onSave={()=>{}} onSubmit={()=>{}}/>);
assert.doesNotMatch(render(task), />Save draft</);
assert.match(render(task), /disabled=""/);
assert.match(render({...task, canEdit:true,canSubmit:true}), /Save draft/);
console.log('Task permission rendering passed');

const closed = render({...task, periodEffectiveStatus: 'CLOSED', completionWindow: { status:'ACTIVE', deadline:'2026-10-01T04:00:00Z' }});
assert.match(closed, /Marking closed/);
assert.match(closed, /This task is read only\. Marks cannot be saved or submitted\./);
assert.doesNotMatch(closed, />Save draft</);
