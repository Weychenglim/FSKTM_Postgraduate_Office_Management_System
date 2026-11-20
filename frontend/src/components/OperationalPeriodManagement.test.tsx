import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as management from './OperationalPeriodManagement';
import {WindowScheduleStatus} from './WindowScheduleStatus';
assert.equal(typeof management.OperationalHistory,'function','Period history renderer is required');
const markup=renderToStaticMarkup(<management.OperationalHistory events={[{id:1,action:'EXTEND',reason:'Faculty approval',actorName:'Office staff',createdAt:'2026-10-16T01:00:00Z',before:{closesAt:'2026-10-20T04:00:00Z'},after:{closesAt:'2026-10-23T04:00:00Z'}}]}/>);
assert.match(markup,/Faculty approval/);
assert.match(markup,/Office staff/);
assert.match(markup,/Deadline extended/);
assert.match(markup,/Closes/);
assert.match(markup,/20 Oct 2026/);
assert.match(markup,/23 Oct 2026/);
assert.doesNotMatch(markup,/Previous deadline|New deadline/);
const historyEvents=Array.from({length:12},(_,index)=>({id:index+1,action:'UPDATE',reason:`History record ${index+1}`,actorName:'Office',createdAt:`2026-11-${String(index+1).padStart(2,'0')}T01:00:00Z`,before:{},after:{}}));
const paginated=renderToStaticMarkup(<management.OperationalHistory events={historyEvents}/>);
assert.equal((paginated.match(/<li /g)??[]).length,5);
assert.match(paginated,/Showing 1–5 of 12 changes/);
assert.ok(paginated.indexOf('History record 12')<paginated.indexOf('History record 11'),'Newest changes must appear first');
assert.doesNotMatch(paginated,/History record 1</);
assert.doesNotMatch(markup,/History pages/,'Short histories do not need pagination');
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
const appointmentCloseButton = '{appointmentClosureLabel(managedAppointment)}';
const closeActionEnd = periodDetailSource.indexOf(appointmentCloseButton) + appointmentCloseButton.length;
const marksActionRow = periodDetailSource.slice(periodDetailSource.indexOf('{managedMarks?<div'), closeActionEnd);
assert.match(periodDetailSource, /justify-end gap-3 border-t/);
assert.match(marksActionRow, /<Settings2 aria-hidden="true"/);
assert.match(marksActionRow, /Extend deadline/);
assert.match(marksActionRow, /icon=\{CalendarClock\}/);
const appointmentActionStart = periodDetailSource.indexOf("{managedAppointment?.lifecycleStatus==='PUBLISHED'?<PortalButton size=\"sm\"");
const appointmentActions = periodDetailSource.slice(appointmentActionStart, closeActionEnd);
assert.match(appointmentActions, /icon=\{CalendarClock\}/);
assert.match(appointmentActions, /icon=\{CalendarX\} variant="dangerSolid"/);
assert.ok(appointmentActions.indexOf('Extend deadline') < appointmentActions.indexOf(appointmentCloseButton));
assert.doesNotMatch(appointmentActions, /sm:ml-auto/);
assert.match(periodDetailSource, /aria-label="Window history"/);
assert.match(periodDetailSource, /<PeriodExtensions/);
assert.doesNotMatch(periodDetailSource, /Select task/);

const unchanged=renderToStaticMarkup(<management.OperationalHistory events={[{id:2,action:'UPDATE',reason:'Reviewed schedule',actorName:'Office staff',createdAt:'2026-10-16T01:00:00Z',before:{closesAt:'2026-10-20T04:00:00Z',name:'Old intake'},after:{closesAt:'2026-10-20T12:00:00+08:00',name:'New intake'}}]}/>);
assert.doesNotMatch(unchanged,/>Closes</,'Equivalent timestamps must not appear as changed deadlines');
assert.match(unchanged,/Old intake/);assert.match(unchanged,/New intake/);
const created=renderToStaticMarkup(<management.OperationalHistory events={[{id:3,action:'CREATE',reason:'',actorName:'Office staff',createdAt:'2026-10-16T01:00:00Z',before:{},after:{closesAt:'2026-10-20T04:00:00Z'}}]}/>);
assert.match(created,/Window created/);assert.doesNotMatch(created,/>Closes</,'Creation must not repeat the current schedule');

for(const [lifecycle,effective,label,tone] of [
 ['DRAFT','UPCOMING','Draft','amber'],['PUBLISHED','UPCOMING','Upcoming','blue'],
 ['PUBLISHED','SCHEDULED','Upcoming','blue'],['PUBLISHED','OPEN','Open','emerald'],
 ['PUBLISHED','ENDED','Deadline passed','amber'],['PUBLISHED','CLOSED','Deadline passed','amber'],
 ['CLOSED','CLOSED','Closed','slate'],['ARCHIVED','OPEN','Archived','slate']
]) {
 const badge=renderToStaticMarkup(<WindowScheduleStatus lifecycleStatus={lifecycle} effectiveStatus={effective}/>);
 assert.match(badge,new RegExp(`>${label}<`));
 assert.match(badge,new RegExp(tone));
 assert.doesNotMatch(badge,/PUBLISHED|<p/);
}
