import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { appointmentDetailTypography as typography } from './AppointmentPrimitives';

const sections = await import('./SupervisorSectionAFormSections').catch(() => assert.fail('Section A form sections must be implemented'));
const particulars = { name: 'Student One', studentId: 'PG01', programme: 'Computing', semester: 'S1 2026/2027', identityNumber: '', identityType: '' as const, email: 'student@example.test', phone: '', address: '' };
const course = { courseName: 'Research methods', courseCode: 'WQD7001', semesterSession: 'S1 2026/2027', grade: 'Distinction' };

test('Particulars are read only and missing registry values carry honest correction guidance', () => {
  const html = renderToStaticMarkup(<sections.SupervisorStudentParticulars particulars={particulars} correctionGuidance />);
  for (const value of ['Student One', 'PG01', 'Computing', 'S1 2026/2027', 'student@example.test', 'Not recorded']) assert.ok(html.includes(value));
  assert.match(html, /Postgraduate Office/);
  assert.doesNotMatch(html, /<input|Maya|verified/i);
  assert.ok(html.includes(`class="${typography.label}"`));
  assert.ok(html.includes(`class="${typography.body} mt-1`));
});

test('Courses use labelled repeatable rows with bounded inputs and an explicit none choice', () => {
  const html = renderToStaticMarkup(<sections.CoursesTakenSection rows={[course]} noCoursesTaken={false} onRowsChange={() => {}} onNoCoursesTakenChange={() => {}} />);
  for (const value of ['Courses taken', 'Course name', 'Course code', 'Semester/session', 'Grade', 'Research methods', 'Add another course', 'Remove course 1', 'Have you completed any courses?']) assert.ok(html.includes(value));
  assert.match(html, /maxLength="255"/i);
  assert.ok(html.includes(`class="${typography.heading}"`));
  const none = renderToStaticMarkup(<sections.CoursesTakenSection rows={[]} noCoursesTaken onRowsChange={() => {}} onNoCoursesTakenChange={() => {}} />);
  assert.match(none, /<input(?=[^>]*type="radio")(?=[^>]*value="no")(?=[^>]*checked)[^>]*>/);
  assert.doesNotMatch(none, /Course name 1/);
});

test('Origin choice is explicit and does not impose document requirements', () => {
  const html = renderToStaticMarkup(<sections.ResearchTitleOriginFields value="" onChange={() => {}} />);
  assert.match(html, /type="radio"/);
  assert.doesNotMatch(html, /checked/);
  const missing = renderToStaticMarkup(<sections.ResearchTitleOriginFields value="STUDENT" onChange={() => {}} />);
  assert.doesNotMatch(missing, /Postgraduate Office/);
  assert.doesNotMatch(missing, /not configured|role="alert"/i);
});

test('Review includes draft research, supervisor, results, filenames and required declaration', () => {
  const html = renderToStaticMarkup(<sections.SupervisorApplicationReviewSection researchTitle="Draft title" projectCourseCodes="WQD7002" researchArea="Networks" researchAbstract="A detailed abstract" supervisorName="Dr One" titleOrigin="STUDENT" rows={[course]} noCoursesTaken={false} filenames={['proposal.pdf']} declarationText="I confirm these particulars and results are accurate." declarationAccepted={false} onDeclarationAcceptedChange={() => {}} />);
  for (const value of ['Draft title', 'WQD7002', 'Networks', 'Dr One', '1 completed course', 'proposal.pdf', 'I confirm these particulars and results are accurate.']) assert.ok(html.includes(value));
  assert.match(html, /href="#courses-taken"/);
  assert.match(html, /A detailed abstract/);
  assert.match(html, /Research methods/);
  assert.doesNotMatch(html, /authenticated account and submission time|I have reviewed this application/);
  assert.match(html, /type="checkbox"[^>]*required/);
  assert.doesNotMatch(html, /type="checkbox"[^>]*checked/);
});

test('Whole student form exposes four sequential steps and blocks hidden native validation', async () => {
  const { SupervisorAppointmentApplicationPage } = await import('./SupervisorAppointmentApplicationPage');
  const html = renderToStaticMarkup(<SupervisorAppointmentApplicationPage onBack={() => {}} onSuccess={() => {}} />);
  const sections = ['student-particulars', 'project-details', 'courses-taken', 'supervisor-selection', 'supporting-documents', 'review-declaration'];
  for (const id of sections) {
    assert.ok(html.includes(`id="${id}"`));
    if (id !== 'review-declaration') assert.ok(html.includes(`href="#${id}"`));
  }
  assert.match(html, /Loading student particulars/);
  assert.match(html, /<form[^>]*noValidate/);
  assert.equal((html.match(/data-application-step=/g) ?? []).length, 4);
  assert.match(html, /data-application-step="1"[^>]*>/);
  assert.match(html, /data-application-step="2"[^>]*hidden/);
  assert.match(html, /aria-current="step"/);
  assert.match(html, />Continue</);
  assert.match(html, /Save draft/);
});


test('Review distinguishes an explicit no-documents policy from missing selections', () => {
  const html = renderToStaticMarkup(<sections.SupervisorApplicationReviewSection researchTitle="Study" projectCourseCodes="PRJ001" researchArea="Computing" researchAbstract="Study abstract" supervisorName="Dr One" titleOrigin="STUDENT" rows={[]} noCoursesTaken filenames={[]} noDocumentsRequired declarationText="I confirm." declarationAccepted={false} onDeclarationAcceptedChange={() => {}} />);
  assert.match(html, /No supporting documents required/);
  assert.doesNotMatch(html, /No files selected/);
});

test('Student next-step guidance reflects the explicit no-documents setup', async () => {
  const {SupervisorAppointmentGuidanceView} = await import('./StudentAppointmentGuidance');
  const html = renderToStaticMarkup(<SupervisorAppointmentGuidanceView requirements={[]} noDocumentsRequired loading={false} error={null} onRetry={() => {}} hasSupervisor={false} />);
  assert.match(html, /No supporting documents required/);
  assert.doesNotMatch(html, /not configured|PDF or DOCX/);
});
