import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {OperationalPeriod} from '../types/operationalPeriods';
const helpers=await import('./periodPresentation').catch(()=>assert.fail('Period coverage and context helpers are required'));
const period=(values:Partial<OperationalPeriod>={}):OperationalPeriod=>({id:1,semesterId:7,activity:'SUPERVISOR_APPLICATION',name:'Main intake',programmeScope:'SELECTED',programmes:[' Data Science '],opensAt:'2026-10-01T00:00:00Z',closesAt:'2026-10-20T09:00:00Z',lifecycleStatus:'PUBLISHED',effectiveStatus:'ENDED',revision:1,...values});
test('restriction review reports actual published coverage without treating drafts as access',()=>{
 const coverage=helpers.programmeWindowCoverage([period(),period({id:2,lifecycleStatus:'DRAFT',programmes:['Cyber Security']})],['data science','Cyber Security']);
 assert.equal(coverage[0].periods.length,1);assert.equal(coverage[1].periods.length,0);
 assert.equal(helpers.programmeWindowCoverage([period({programmeScope:'ALL',programmes:[]})],['Data Science','Cyber Security']).every(row=>row.periods.length===1),true);
});
test('overview distinguishes no setup, drafts and published window states',()=>{
 assert.equal(helpers.windowScheduleLabel([]),'Not configured');
 assert.equal(helpers.windowScheduleLabel([period({lifecycleStatus:'DRAFT',effectiveStatus:'DRAFT'})]),'Draft only');
 assert.equal(helpers.windowScheduleLabel([period()]),'Deadline passed');
 assert.equal(helpers.windowScheduleLabel([period({effectiveStatus:'OPEN'}),period({id:2,effectiveStatus:'UPCOMING'})]),'Open · Upcoming');
});
test('Marks links retain exact semester and optional record and reject malformed scope',()=>{
 assert.equal(helpers.marksConfigurationRoute(7,4),'/marks/config?semester=7&period=4');
 assert.deepEqual(helpers.parseMarksPeriodContext('?semester=7&period=4'),{semesterId:7,periodId:4,invalid:false});
 assert.equal(helpers.parseMarksPeriodContext('?semester=oops').invalid,true);
 assert.equal(helpers.parseMarksPeriodContext('?period=4').invalid,true);
 assert.deepEqual(helpers.parseMarksPeriodContext(''),{semesterId:null,periodId:null,invalid:false});
});
