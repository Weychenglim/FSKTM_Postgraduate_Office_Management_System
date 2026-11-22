import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {ListState} from './ListState';
import {PanelAssignmentsWorkspace} from './PanelAssignmentsWorkspace';
import {PanelBrowse} from './PanelBrowse';
import {CoordinatorTeamViewSwitch} from './CoordinatorSupervisorWorkspace';
import type {PanelPresentation} from '../utils/panelPresentation';

const record: PanelPresentation = {studentId:'PG001',studentName:'Student One',programme:'Cyber Security',recommendedMember:'Dr Panel',
  recommendedMemberId:'L001',proposedTopic:'Research',submittedDate:'',status:'APPROVED',appointmentDate:'2026-10-02',
  appointmentLifecycle:{appointmentId:11,status:'ACTIVE',endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null}};
for (const role of ['office','coordinator'] as const) {
  const memory = new Map<string, unknown>([[`PanelAssignments:${role}:grouping`,'student']]);
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/panel-appointments?panelSection=appointments']}>
    <ListState.Provider value={memory}><PanelAssignmentsWorkspace role={role} records={[record]} onOpen={()=>{}}/></ListState.Provider>
  </MemoryRouter>);
  assert.doesNotMatch(html,/By lecturer|By student|Browse assignments by/,'Staff should not choose a browsing mode');
  assert.match(html,/Panel lecturers and their students/,'Obsolete student-mode memory must not bypass lecturer grouping');
  assert.doesNotMatch(html,/Panel student assignments/,'Student rows belong inside a selected lecturer');
  for (const text of ['Current','Past','View students','Find a student or Panel lecturer','Export Excel']) assert.ok(html.includes(text),text);
  assert.match(html,/aria-label="Appointment views"/);
  assert.match(html,/aria-pressed="true"/);
  assert.doesNotMatch(html,/aria-label="Appointments"|<option value="past">/);

}
const stageRecords: PanelPresentation[] = [
  {...record, projectStage:'P1', projectSemester:'Semester I'},
  {...record, studentId:'PG002', studentName:'Student Two', projectStage:'P2', projectSemester:'Semester I',
    appointmentLifecycle:{...record.appointmentLifecycle!, appointmentId:12}},
];
for (const role of ['office','coordinator'] as const) {
  const scope = `PanelAssignments:${role}`;
  const memory = new Map<string, unknown>([[`${scope}:source`, {projectStage:'P2'}]]);
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/panel-appointments?panelLecturer=staff%3Al001']}>
    <ListState.Provider value={memory}><PanelAssignmentsWorkspace role={role} records={stageRecords} onOpen={()=>{}}/></ListState.Provider>
  </MemoryRouter>);
  assert.match(html,/aria-label="Project stage"/);
  assert.match(html,/Student Two/);
  assert.doesNotMatch(html,/Student One/);
}
const lecturer = (view: string, rows: PanelPresentation[]) => renderToStaticMarkup(
  <ListState.Provider value={new Map<string, unknown>([['PanelBrowse:lecturer:view',view],['PanelBrowse:lecturer:projectStage','P1']])}>
    <PanelBrowse scope="lecturer" title="My Panel students" appointments records={rows} onOpen={()=>{}}/>
  </ListState.Provider>);
const current = lecturer('requests',stageRecords);
assert.match(current,/aria-label="Project stage"/);
assert.match(current,/Student One/);
assert.doesNotMatch(current,/Student Two/);
const past = lecturer('history', [{...stageRecords[1],appointmentLifecycle:{...stageRecords[1].appointmentLifecycle!,status:'ENDED'}}]);
assert.match(past,/Student Two/);
assert.doesNotMatch(past,/Project stage|RP2/);

const supervisor = renderToStaticMarkup(<CoordinatorTeamViewSwitch view="requests" onChange={()=>{}}/>);
assert.match(supervisor,/>Current</);assert.match(supervisor,/>Past</);
assert.match(supervisor,/aria-label="Supervision views"/);assert.match(supervisor,/aria-pressed="true"/);
assert.doesNotMatch(supervisor,/By student|By lecturer|<select/);
console.log('Panel and Supervisor appointments share a Current/Past switch and neither has grouping modes');
