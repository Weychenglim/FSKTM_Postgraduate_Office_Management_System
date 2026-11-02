import { MemoryRouter } from 'react-router';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoSupervisorNominationCard, CoSupervisorAppointmentCard, SupervisoryTeamTimeline, StudentSupervisorsOverview, LecturerSupervisoryTeamCard } from './SupervisoryTeamManagement';
import type { CoSupervisorNomination, CoSupervisorAppointment } from '../types/coSupervision';

const nomination: CoSupervisorNomination = {
  id: 1, studentId: 7, matricNo: 'PG007', studentName: 'Research Student',
  candidate: { id: 8, name: 'Dr Supporting' }, nominator: { id: 9, name: 'Dr Primary' },
  status: 'PENDING_COORDINATOR', justification: 'Complementary research expertise', reason: '',
  submittedAt: '2026-09-01T00:00:00Z', waitingDays: 3, responsibleStage: 'PROGRAMME_COORDINATOR',
  replacesAppointmentId: null, allowedActions: ['approve', 'coordinator-reject'], history: [],
};
const html = renderToStaticMarkup(<CoSupervisorNominationCard nomination={nomination} busy={false} onAction={() => {}} />);
assert.match(html, /Dr Supporting/);
assert.match(html, /3 calendar days/);
assert.match(html, /Approve/);
assert.match(html, /Reject/);
assert.doesNotMatch(html, />Accept</);
const readOnly = renderToStaticMarkup(<CoSupervisorNominationCard nomination={{ ...nomination, allowedActions: [] }} busy={false} onAction={() => {}} />);
assert.doesNotMatch(readOnly, />Approve</);
assert.doesNotMatch(readOnly, />Reject</);
const appointment: CoSupervisorAppointment = { id: 2, studentId: 7, matricNo: 'PG007', studentName: 'Research Student', supervisor: nomination.candidate, status: 'ENDED', appointmentDate: '2026-01-01', endOutcome: 'WITHDRAWN', endReason: 'Research changed', endedAt: '2026-09-01T00:00:00Z', supersedesId: null, canEnd: false, history: [] };
const ended = renderToStaticMarkup(<CoSupervisorAppointmentCard appointment={appointment} busy={false} canReplace={false} onEnd={() => {}} onReplace={() => {}} />);
assert.match(ended, /Research changed/);
assert.doesNotMatch(ended, />End appointment</);
assert.doesNotMatch(ended, />Replace</);
const endedDetail = renderToStaticMarkup(<CoSupervisorAppointmentCard detail appointment={{...appointment, endedAt:'2026-10-13T18:30:00Z'}} busy={false} canReplace={false} onEnd={() => {}} onReplace={() => {}} />);
assert.match(endedDetail, /Appointment summary|Appointment outcome|Audit history/);
assert.match(endedDetail, /14 Oct 2026/, 'Supporting lifecycle uses the actual Malaysia ending time');
assert.doesNotMatch(endedDetail, /Approval progress|End appointment|>Replace</, 'Ended relationships are not approval requests');
console.log('Supervisory team role-specific rendering passed');

const timeline = renderToStaticMarkup(<SupervisoryTeamTimeline entries={[
  { id: 'panel-current-status', title: 'Panel appointment', date: null, status: 'FACULTY_PROCESSING' },
]} />);
assert.match(timeline, /Faculty processing/);
assert.doesNotMatch(timeline, /FACULTY_PROCESSING|Invalid Date|null|undefined/);
const confirmed = renderToStaticMarkup(<SupervisoryTeamTimeline entries={[
  { id: 'panel-current-status', title: 'Panel appointment', date: '2026-09-15', status: 'CONFIRMED' },
]} />);
assert.match(confirmed, /Confirmed/);
assert.match(confirmed, /2026/);
assert.equal(renderToStaticMarkup(<SupervisoryTeamTimeline entries={[]} />), '');
console.log('Student-safe supervisory timeline rendering passed');

const workspace: import('../types/coSupervision').SupervisoryWorkspace = {
  teams: [{ studentId:7, studentName:'Research Student', matricNo:'PG007', programme:'Current programme', studentStatus:'Active', primarySupervisor:{id:9,name:'Dr Primary'}, primaryAppointmentId:4,
    research:{title:'Current approved title',area:'Research area',abstract:'Full current abstract'}, appointments:[appointment], nominations:[nomination], canNominate:true,
    timeline:[{id:1,title:'Semester milestone',status:'COMPLETED'}] }], appointments:[{...appointment,canEnd:true}], nominations:[nomination],
};
const studentTeam = renderToStaticMarkup(<StudentSupervisorsOverview workspace={workspace} actions={<button>View appointment</button>} />);
assert.match(studentTeam, /Dr Primary|Current approved title|No supporting supervisors assigned/);
assert.match(studentTeam, /<section aria-label="Research profile"/);
assert.doesNotMatch(studentTeam, /<summary[^>]*>Research profile/);
assert.match(studentTeam, /Full current abstract|Previous supporting supervisors/);
assert.doesNotMatch(studentTeam, /Research changed|Complementary research expertise|Audit history|Ended reason/);
assert.doesNotMatch(studentTeam, /Timeline and progress|Semester milestone|>Approve<|>End appointment<|>Replace</);
assert.match(studentTeam, />View appointment</);
assert.match(renderToStaticMarkup(<StudentSupervisorsOverview workspace={{teams:[],appointments:[],nominations:[]}} />), /Supervisor not appointed/);
const activeSupporting = renderToStaticMarkup(<StudentSupervisorsOverview workspace={{...workspace, teams:[{...workspace.teams[0], appointments:[{...appointment,status:'ACTIVE'}]}]}} />);
assert.match(activeSupporting, /Dr Supporting|Active since/);
assert.doesNotMatch(activeSupporting, /No supporting supervisors assigned/);
console.log('Student overview retains own team and histories without staff controls or duplicate milestones');

const mixedActivity = [
  {id:'primary-workflow-1',title:'Primary supervisor application',date:'2026-10-09',status:'APPROVED'},
  {id:'panel-workflow-2',title:'Panel recommendation',date:'2026-10-09',status:'REJECTED_BY_PANEL'},
  {id:'co-appointment-1-event-7',title:'Co-supervisor: Approved',date:'2026-10-09',status:'ACTIVE'},
  {id:'timeline-5',title:'Shared semester milestone',date:'2026-11-01',status:'upcoming'},
];
const appointmentActivity = renderToStaticMarkup(React.createElement(SupervisoryTeamTimeline,{entries:mixedActivity,kind:'appointments'} as any));
assert.doesNotMatch(appointmentActivity, /Shared semester milestone|Timeline and progress|<details/);
for (const text of ['Primary supervisor application','Panel recommendation','Co-supervisor: Approved']) assert.ok(appointmentActivity.includes(text));
const semesterDates = renderToStaticMarkup(React.createElement(SupervisoryTeamTimeline,{entries:mixedActivity,kind:'semester'} as any));
assert.match(semesterDates,/Shared semester milestone/);
assert.doesNotMatch(semesterDates,/Primary supervisor application|Panel recommendation|Co-supervisor: Approved|Timeline and progress|<details/);
console.log('Lecturer appointment activity is separated from shared semester dates without nested disclosures');

const lecturerTeam = {...workspace.teams[0],timeline:mixedActivity};
const renderLecturerTeam = (team: typeof lecturerTeam) => renderToStaticMarkup(<LecturerSupervisoryTeamCard team={team} busy={false} onNominate={()=>{}} onEnd={()=>{}} onReplace={()=>{}} onNominationAction={()=>{}} />);
const lecturerTeamHtml = renderLecturerTeam(lecturerTeam);
for (const text of ['Primary supervisor','Dr Primary','Supporting supervisors (0/2)','No supporting supervisors assigned.','Current approved title','Research profile','Current programme','Full current abstract','Appointment activity (3)','Semester dates (1)','Supporting appointment history (2)','Complementary research expertise','Research changed','Office-managed dates','do not measure this student']) assert.ok(lecturerTeamHtml.includes(text), `Missing Lecturer team item: ${text}`);
assert.doesNotMatch(lecturerTeamHtml,/Timeline and progress|>Appointment history</);
assert.doesNotMatch(renderLecturerTeam({...lecturerTeam,canNominate:false,nominations:[],appointments:[]}),/>Nominate co-supervisor<|>Replace<|>End appointment</);
const activeLecturerTeam = renderLecturerTeam({...lecturerTeam,nominations:[],appointments:[{...appointment,status:'ACTIVE',canEnd:true}]});
assert.match(activeLecturerTeam,/Dr Supporting|>Replace<|>End appointment</);
assert.doesNotMatch(activeLecturerTeam,/No supporting supervisors assigned/);
const replacementPending = renderLecturerTeam({...lecturerTeam,appointments:[{...appointment,status:'ACTIVE',canEnd:true}],nominations:[{...nomination,replacesAppointmentId:appointment.id}]});
assert.doesNotMatch(replacementPending,/>Replace</);
assert.equal((activeLecturerTeam.match(/Research Student/g) ?? []).length,1,'Student identity appears once when no nomination is recorded');
console.log('Lecturer team cards retain current supervision, profile, histories and capability-gated actions');

const pendingTeamHtml = renderToStaticMarkup(<MemoryRouter><LecturerSupervisoryTeamCard collapsible={false} team={{...lecturerTeam,nominations:[{...nomination,status:'SUBMITTED_TO_CO_SUPERVISOR'}]}} busy={false} onNominate={()=>{}} onEnd={()=>{}} onReplace={()=>{}} onNominationAction={()=>{}} /></MemoryRouter>);
assert.doesNotMatch(pendingTeamHtml, /Nominate co-supervisor|View nomination details|No supporting supervisors assigned|Pending nominations/);
assert.match(pendingTeamHtml, /View nomination request/);
assert.ok(pendingTeamHtml.includes(`/supporting-requests/${nomination.id}`));
assert.doesNotMatch(pendingTeamHtml, /Complementary research expertise/,'Pending summary does not embed the request dossier');
console.log('Pending nomination prevents another action and links to the full request');

const renderDetail = (overrides: Partial<typeof lecturerTeam> = {}) => renderToStaticMarkup(<MemoryRouter><LecturerSupervisoryTeamCard collapsible={false} team={{...lecturerTeam,nominations:[],appointments:[],...overrides}} busy={false} onNominate={()=>{}} onEnd={()=>{}} onReplace={()=>{}} onNominationAction={()=>{}} /></MemoryRouter>);
const approvedSupportingDetail = renderDetail({nominations:[{...nomination,status:'APPROVED',allowedActions:[]}],appointments:[{...appointment,status:'ACTIVE',canEnd:true,history:[{id:11,action:'ACTIVATED',actor:'Coordinator',createdAt:'2026-11-02T00:00:00Z',newStatus:'ACTIVE'}]}]});
assert.match(approvedSupportingDetail,/aria-label="Supporting supervisors" class="[^"]*border-t border-slate-200 pt-6/,'Primary and supporting supervision have a clear divider');
assert.match(approvedSupportingDetail,/<footer data-supporting-appointment-actions/,'Supporting appointment actions have their own footer');
assert.doesNotMatch(approvedSupportingDetail,/Supporting appointment history|View nomination request/);
assert.doesNotMatch(approvedSupportingDetail,/Approval progress|Audit history|Appointment started|Complementary research expertise|Request summary/,'The team detail links to the approval dossier instead of embedding it or repeating activation');
assert.doesNotMatch(renderDetail({appointments:[{...appointment,status:'ACTIVE',history:[{id:12,action:'ACTIVATED',actor:'Coordinator',createdAt:'2026-11-02T00:00:00Z'}]}]}),/data-appointment-history|Audit history/,'Activation alone does not create a history section');
const changedSupportingDetail = renderDetail({appointments:[{...appointment,status:'ACTIVE',history:[{id:13,action:'UPDATED',actor:'Coordinator',createdAt:'2026-11-02T00:00:00Z',reason:'Recorded correction'}]}]});
assert.match(changedSupportingDetail,/Appointment changes|Recorded correction/,'Later lifecycle changes remain available');
console.log('Supporting detail separates member sections and action footers, links completed nominations, and keeps genuine changes');

const detailWithoutHistory = renderToStaticMarkup(<MemoryRouter><LecturerSupervisoryTeamCard collapsible={false} management={<div>Appointment record</div>} team={{...lecturerTeam,nominations:[{...nomination,status:'APPROVED',allowedActions:[]}]}} busy={false} onNominate={()=>{}} onEnd={()=>{}} onReplace={()=>{}} onNominationAction={()=>{}} /></MemoryRouter>);
assert.match(detailWithoutHistory,/Appointment record/);
assert.doesNotMatch(detailWithoutHistory,/Supporting appointment history|View nomination request|Research changed/,'Historical supporting appointments and completed nominations do not create a detail card');
console.log('Team details retain appointment management without the supporting history card');
