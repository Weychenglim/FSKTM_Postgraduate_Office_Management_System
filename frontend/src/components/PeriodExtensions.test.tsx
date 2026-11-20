import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ExtensionSummary, deadlineChanges} from './PeriodExtensions';

const events = [
  {id:1,action:'UPDATE',reason:'Rename',actorName:'Office',createdAt:'2026-11-09',before:{name:'A'},after:{name:'B'}},
  {id:2,action:'EXTEND',reason:'Approval',actorName:'Office',createdAt:'2026-11-09',before:{closesAt:'2026-11-10T09:00:00Z'},after:{closesAt:'2026-11-12T09:00:00Z'}},
];
assert.deepEqual(deadlineChanges(events).map(event=>event.id),[2]);
const empty=renderToStaticMarkup(<ExtensionSummary activeCount={0} totalCount={0} changes={[]} onOpen={()=>{}}/>);
assert.match(empty,/No extensions yet/);
const summary=renderToStaticMarkup(<ExtensionSummary activeCount={2} totalCount={5} changes={deadlineChanges(events)} onOpen={()=>{}}/>);
assert.match(summary,/2 active grants/);
assert.match(summary,/3 previous grants/);
assert.match(summary,/12 Nov 2026/);
assert.match(summary,/1 deadline change/);
assert.match(summary,/Previous deadline/);
assert.doesNotMatch(summary,/Select task/);
console.log('Extension summary distinguishes active grants, historical grants and common deadline changes.');

assert.match(summary,/Common deadline/);
const many=renderToStaticMarkup(<ExtensionSummary activeCount={120} totalCount={250} changes={deadlineChanges(events)} onOpen={()=>{}}/>);
assert.match(many,/120 active grants/);
assert.match(many,/130 previous grants/);
const multiple=renderToStaticMarkup(<ExtensionSummary activeCount={0} totalCount={0} changes={[events[1],{...events[1],id:3},{...events[1],id:4}]} onOpen={()=>{}}/>);
assert.match(multiple,/3 deadline changes/);
assert.match(multiple,/10 Nov 2026/);
assert.match(multiple,/No individual extra time/);
