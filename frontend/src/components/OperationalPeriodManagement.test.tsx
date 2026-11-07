import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as management from './OperationalPeriodManagement';
assert.equal(typeof management.OperationalHistory,'function','Period history renderer is required');
const markup=renderToStaticMarkup(<management.OperationalHistory events={[{id:1,action:'EXTEND',reason:'Faculty approval',actorName:'Office staff',createdAt:'2026-10-16T01:00:00Z',before:{closesAt:'2026-10-20T04:00:00Z'},after:{closesAt:'2026-10-23T04:00:00Z'}}]}/>);
assert.match(markup,/Faculty approval/);
assert.match(markup,/Office staff/);
assert.match(markup,/Deadline extended/);
assert.match(markup,/Closes/);
assert.match(markup,/20 Oct 2026/);
assert.match(markup,/23 Oct 2026/);
assert.doesNotMatch(markup,/Previous deadline|New deadline/);
assert.equal(typeof management.CalendarPeriodLinkFields,'function','Explicit calendar event picker is required');
const entry={id:7,level:'P1' as const,step:1,title:'Calendar event',detail:'Event details',action:'Students',deadlineStart:'2026-10-20',deadlineEnd:'2026-10-22',weekLabel:'Week 1',targetRoles:['STUDENT' as const],status:'Upcoming' as const,displayOrder:1};
const link=renderToStaticMarkup(<management.CalendarPeriodLinkFields entries={[entry]} selectedId="7" onChange={()=>{}}/>);
assert.match(link,/Calendar event/);
assert.match(link,/Owning period dates/);
assert.match(link,/role="combobox"/);
assert.doesNotMatch(link,/<select(?! aria-hidden="true")/);
const noEvents=renderToStaticMarkup(<management.CalendarPeriodLinkFields entries={[]} selectedId="" onChange={()=>{}}/>);
assert.match(noEvents,/Create or import/);
console.log('Period extension history displays actors, reasons and deadline changes');

const periodDetailSource = readFileSync(new URL('./OperationalPeriodManagement.tsx', import.meta.url), 'utf8');
const marksActionRow = periodDetailSource.slice(periodDetailSource.indexOf('{managedMarks?<div'), periodDetailSource.indexOf("{managedAppointment?.lifecycleStatus==='PUBLISHED'?<PortalButton className=\"sm:ml-auto\""));
assert.match(periodDetailSource, /items-center justify-end gap-3 border-t/);
assert.match(marksActionRow, /<Settings2 aria-hidden="true"/);
assert.match(marksActionRow, /Extend deadline/);
assert.match(marksActionRow, /icon=\{CalendarClock\}/);
const appointmentActionStart = periodDetailSource.indexOf("{managedAppointment?.lifecycleStatus==='PUBLISHED'?<PortalButton size=\"sm\"");
const closeActionEnd = periodDetailSource.indexOf('Close submissions early', appointmentActionStart) + 'Close submissions early'.length;
const appointmentActions = periodDetailSource.slice(appointmentActionStart, closeActionEnd);
assert.match(appointmentActions, /icon=\{CalendarClock\}/);
assert.match(appointmentActions, /icon=\{CalendarX\} variant="dangerSolid"/);
assert.ok(appointmentActions.indexOf('Extend deadline') < appointmentActions.indexOf('Close submissions early'));
assert.doesNotMatch(appointmentActions, /sm:ml-auto/);
assert.match(periodDetailSource, /aria-label="Window history"/);
assert.match(periodDetailSource, /aria-label="Task completion windows"/);
assert.match(periodDetailSource, /Review extra-time grants and revocations for an individual evaluation task\./);

const unchanged=renderToStaticMarkup(<management.OperationalHistory events={[{id:2,action:'UPDATE',reason:'Reviewed schedule',actorName:'Office staff',createdAt:'2026-10-16T01:00:00Z',before:{closesAt:'2026-10-20T04:00:00Z',name:'Old intake'},after:{closesAt:'2026-10-20T12:00:00+08:00',name:'New intake'}}]}/>);
assert.doesNotMatch(unchanged,/>Closes</,'Equivalent timestamps must not appear as changed deadlines');
assert.match(unchanged,/Old intake/);assert.match(unchanged,/New intake/);
const created=renderToStaticMarkup(<management.OperationalHistory events={[{id:3,action:'CREATE',reason:'',actorName:'Office staff',createdAt:'2026-10-16T01:00:00Z',before:{},after:{closesAt:'2026-10-20T04:00:00Z'}}]}/>);
assert.match(created,/Window created/);assert.doesNotMatch(created,/>Closes</,'Creation must not repeat the current schedule');

for(const [lifecycle,effective,label,tone] of [
 ['DRAFT','UPCOMING','DRAFT','amber'],['PUBLISHED','UPCOMING','UPCOMING','blue'],
 ['PUBLISHED','OPEN','OPEN','emerald'],['PUBLISHED','ENDED','CLOSED','slate'],
 ['CLOSED','OPEN','CLOSED','slate'],['ARCHIVED','OPEN','ARCHIVED','slate']
]) {
 const badge=renderToStaticMarkup(<management.WindowScheduleStatus lifecycleStatus={lifecycle} effectiveStatus={effective}/>);
 assert.match(badge,new RegExp(label));
 assert.match(badge,new RegExp(tone));
 assert.doesNotMatch(badge,/PUBLISHED|<p/);
}

for(const [life,effective,enforced,label] of [['PUBLISHED','UPCOMING',false,'Dates unrestricted'],['PUBLISHED','UPCOMING',true,'Not open yet'],['PUBLISHED','OPEN',true,'Accepting submissions'],['PUBLISHED','ENDED',true,'Submissions closed'],['DRAFT','UPCOMING',false,'DRAFT'],['ARCHIVED','ENDED',true,'ARCHIVED']] as const) {
 assert.match(renderToStaticMarkup(<management.WindowSubmissionAccess lifecycleStatus={life} effectiveStatus={effective} enforced={enforced}/>),new RegExp(label));
}
