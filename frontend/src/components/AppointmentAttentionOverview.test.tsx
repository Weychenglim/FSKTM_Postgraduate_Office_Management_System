import assert from 'node:assert/strict';
import React from 'react';
import { test } from 'node:test';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { OfficeAttentionTable } from './OfficeSupervisorAttention';
import { OfficePanelAttentionTable } from './OfficePanelAttention';
import { ProjectStageFilter } from './AttentionProjectStage';
import { AppointmentAttentionOverview } from './AppointmentAttentionOverview';
import { OfficeSupervisorStudentOverviewContent } from './OfficeSupervisorStudentOverview';
import { PanelAppointmentDetail } from './PanelAppointmentDetail';
import type { SupervisoryWorkspace } from '../types/coSupervision';
import type { PanelRecord, SupervisorApplicationRecord } from '../types';

const student = { id: 1, matricNo: 'PG1', studentName: 'Student One', programme: 'Computing', semester: 'Intake I', applicationId: null, pendingStatus: null, reason: '', projectStage: 'P1' };
test('Project stage is disabled without an active semester', () => {
  const html = render(<ProjectStageFilter value="P1" semester={null} onChange={() => {}} />);
  assert.match(html, /<select[^>]*disabled/);
  assert.match(html, /<option value="" selected="">No active semester/);
});

test('Project stage keeps the RP1 count in the dropdown without a semester hint', () => {
  const html = render(<ProjectStageFilter value="" semester="Semester I 2026/2027" rp1Count={3} onChange={() => {}} />);
  assert.match(html, /<option value="P1">RP1 \(3\)<\/option>/);
  assert.doesNotMatch(html, /Semester I 2026\/2027/);
});
test('Without Supervisor and Without Panel rows always offer one student overview action', () => {
  const supervisor = render(<OfficeAttentionTable category="students" rows={[student, { ...student, id: 2, applicationId: 9, pendingStatus: 'PENDING_COORDINATOR' }]} onStudent={() => {}} onRequest={() => {}} onWorkload={() => {}} />);
  const panelRows = [student, { ...student, id: 2, pendingStatus: 'PENDING_COORDINATOR' }].map((row, index) => ({ ...row, profileId: index + 10, supervisorId: 5, supervisorName: 'Dr Supervisor', recommendationId: index ? 8 : null }));
  const panel = render(<OfficePanelAttentionTable category="students" rows={panelRows} onRecord={() => {}} onWorkload={() => {}} />);
  for (const html of [supervisor, panel]) {
    assert.match(html, />Project stage<.*>RP1</);
    assert.equal((html.match(/>View details<\/span>/g) ?? []).length, 2);
    assert.doesNotMatch(html, />View request<|>View student<|>View Panel record</);
  }
  const opened: string[] = [];
  const element = OfficePanelAttentionTable({ category: 'students', rows: panelRows, onRecord: id => opened.push(id), onWorkload: () => {} });
  for (const row of element.props.rows) row.cells.at(-1).props.children.props.onClick();
  assert.deepEqual(opened, ['profile-10', 'profile-11'], 'A pending recommendation does not change the overview destination');
});

test('An overview separates current appointment status from an ongoing request', () => {
  const html = render(<AppointmentAttentionOverview module="Panel" studentName="Student One" studentId="PG1" programme="Computing" projectStage="P1" projectSemester="Semester I" active={false} supervisor="Dr Primary" research={{ title: 'Current saved title', area: 'Networks', abstract: 'Current saved abstract' }} pendingRequest={{ status: 'PENDING_COORDINATOR', candidate: 'Dr Proposed', onOpen: () => {} }} onOpenStudent={() => {}} />);
  assert.match(html, /Programme<\/dt>.*Project stage<\/dt><dd[^>]*>RP1<span[^>]*>Semester I<\/span>/);
  for (const label of ['Student overview', 'No active Panel appointment', 'Awaiting Coordinator approval', 'Dr Primary', 'Dr Proposed', 'View request', 'View student record', 'Current saved title', 'Current saved abstract']) assert.ok(html.includes(label), label);
  assert.doesNotMatch(html, /Approval progress|End Appointment|Administrative details|>Review request</);
});

test('An overview without an ongoing request cannot imply that a request exists', () => {
  const html = render(<AppointmentAttentionOverview module="Supervisor" studentName="Student One" studentId="PG1" programme="Computing" active={false} />);
  assert.match(html, /No active primary supervisor|No ongoing request/);
  assert.doesNotMatch(html, /View request|Approval progress|End Appointment/);
});

test('Supervisor overview shows only the selected student and links their exact pending request', () => {
  const request: SupervisorApplicationRecord = { id: 91, studentId: 'PG1', studentName: 'Student One', programme: 'Computing', semester: 'S1', proposedSupervisor: 'Dr Proposed', proposedSupervisorId: 'L1', status: 'PENDING_COORDINATOR', researchTitle: 'Submitted title', researchArea: '', researchAbstract: '', researchProfileReady: false, rejectionReason: '', submittedAt: '', workflow: [] };
  const workspace: SupervisoryWorkspace = { teams: [{ studentId: 1, matricNo: 'PG1', studentName: 'Student One', programme: 'Computing', studentStatus: 'ACTIVE', primarySupervisor: null, primaryAppointmentId: null, research: { title: 'Saved profile title', area: '', abstract: '' }, appointments: [], nominations: [], canNominate: false }], appointments: [], nominations: [], primaryApplication: request };
  let opened = 0;
  const element = OfficeSupervisorStudentOverviewContent({ workspace, identity: 'PG1', onOpenRequest: id => { opened = id; } });
  element.props.pendingRequest.onOpen();
  assert.equal(opened, 91);
  const html = render(element);
  assert.match(html, /View request/);
  assert.match(html, /Saved profile title/);
  assert.doesNotMatch(html, /Submitted title|End Appointment/);
  assert.doesNotMatch(render(<OfficeSupervisorStudentOverviewContent workspace={{ ...workspace, primaryApplication: { ...request, studentId: 'OTHER' } }} identity="PG1" />), /Dr Proposed|View request/);
  assert.doesNotMatch(render(<OfficeSupervisorStudentOverviewContent workspace={{ ...workspace, primaryApplication: { ...request, status: 'APPROVED' } }} identity="PG1" />), /View request/, 'A past approved application is not an ongoing request');
});

test('Panel profile overview keeps pending and newly active appointment states distinct', () => {
  const record: PanelRecord = { recordId: 'recommendation-8', recommendationId: 8, id: 'PG1', studentName: 'Student One', programme: 'Computing', semester: 'S1', projectStage: 'P2', projectSemester: 'S2', supervisor: 'Dr Primary', panelMember: 'Dr Proposed', status: 'Pending', updatedDate: '16 Oct 2026' };
  const pending = render(<PanelAppointmentDetail overview record={record} onBack={() => {}} onViewRequest={() => {}} />);
  assert.match(pending, /Panel appointment overview|No active Panel appointment|View request/);
  assert.match(pending, /Programme<\/dt>.*Project stage<\/dt><dd[^>]*>RP2<span[^>]*>S2<\/span>/);
  assert.doesNotMatch(pending, /Current project stage/);
  assert.doesNotMatch(pending, /Approval progress|End Appointment/);
  const active = render(<PanelAppointmentDetail overview record={{ ...record, status: 'Approved', appointmentLifecycle: { appointmentId: 17, status: 'ACTIVE', endOutcome: null, endReason: null, endedAt: null, endedBy: null, supersedesAppointmentId: null, replacementAppointmentId: null } }} onBack={() => {}} onViewRequest={() => {}} onViewAppointment={() => {}} />);
  assert.match(active, /Active Panel appointment|View appointment/);
  assert.doesNotMatch(active, /No active Panel appointment|View request|End Appointment/);
});
