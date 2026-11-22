import assert from 'node:assert/strict';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkEntryDetail } from './MarkEntryDetail';
import { SubmittedMarkDetail } from './SubmittedMarkDetail';
import { UploadNewDocument } from './UploadNewDocument';
import { CoordinatorSupervisorApprovals } from './CoordinatorSupervisorApprovals';
import { StudentProgressDossier } from './StudentProgressDossier';
import { MarkEntryRecordDetail } from './MarkEntryRecordDetail';
import { SupervisorAppointmentManagement } from './SupervisorAppointmentManagement';
import { PanelAppointmentManagement } from './PanelAppointmentManagement';
import { StaffResearchWorkspace } from './StaffResearchWorkspace';
import { AnnouncementManagement } from './AnnouncementManagement';

const task: any = {id:'17', studentName:'Synthetic student', studentId:'M123', status:'SUBMITTED', semester:'Semester I 2026/2027', assessment:'P1', components:[], totalMark:null};
function page(node: React.ReactNode, label: string) {
  const html = renderToStaticMarkup(node);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${label}: one heading even while loading`);
  assert.match(html, /class="back-link/, `${label}: shared labelled return`);
  assert.doesNotMatch(html, /fixed inset|role="dialog"|<dialog/, `${label}: substantial record is not an overlay`);
  return html;
}
const marking = page(<MarkEntryDetail task={task} onBack={() => {}} onSave={async () => {}} onSubmit={async () => {}} />, 'Marks');
const submitted = page(<SubmittedMarkDetail task={task} onBack={() => {}} backLabel="Back to Marks Entry History" />, 'Submitted marks');
for (const html of [marking, submitted]) {
  assert.match(html, /<dl[^>]*>(?:(?!<\/dl>).)*Semester<\/dt><dd[^>]*>Semester I 2026\/2027<\/dd><\/div><div[^>]*><dt[^>]*>Assessment<\/dt><dd[^>]*>RP1<\/dd>/);
  assert.equal((html.match(/>Assessment<\/dt>/g) ?? []).length, 1);
}
page(<UploadNewDocument onBack={() => {}} onUploadSuccess={() => {}} />, 'File upload');
const coordinator = page(<MemoryRouter><CoordinatorSupervisorApprovals initialApplicationId="17" /></MemoryRouter>, 'Coordinator notification');
assert.doesNotMatch(coordinator, /<h1[^>]*>Supervisor Appointment Approvals|Programme Appointment Records|supervisory-team-management/i, 'Deep links open only the selected request');
const dossier = page(<StudentProgressDossier currentUserRole="Lecturer" studentId="M123" onBack={() => {}} onNavigateToRoute={() => {}} backLabel="Back to Appointment request" />, 'Loading dossier');
assert.match(dossier, /Back to Appointment request/);
const announcements = renderToStaticMarkup(<AnnouncementManagement />);
assert.match(announcements, /New announcement/, 'Announcements starts with a list and an explicit compose action');
assert.doesNotMatch(announcements, /Content Body/, 'The composer is a separate record page');
page(<SupervisorAppointmentManagement routeView="detail" routeRecordId="17" onNavigateToList={() => {}} />, 'Office supervisor loading');
page(<MemoryRouter><PanelAppointmentManagement routeView="detail" routeRecordId="17" onNavigateToList={() => {}} /></MemoryRouter>, 'Office panel loading');
page(<MarkEntryRecordDetail recordId="17" onBack={() => {}} />, 'Office marks loading');
page(<MemoryRouter><StaffResearchWorkspace role="Programme Coordinator" routeView="detail" routeRequestId="17" /></MemoryRouter>, 'Coordinator research notification');
console.log('Global records and loading states retain one heading and labelled return; announcements starts with its list');
