import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSupervisorApplicationFormData } from './supervisorDocuments';

const helpers = await import('./supervisorSectionA').catch(() => assert.fail('Section A validation must be implemented'));
const course = { courseName: ' Research methods ', courseCode: ' WQD7001 ', semesterSession: ' S1 2026/2027 ', grade: ' A ' };
const valid = { titleOrigin: 'SUPERVISOR' as const, noCoursesTaken: false, courseResults: [course], declarationAccepted: true };

test('Section A requires an explicit origin, course declaration and fresh accepted declaration', () => {
  assert.equal(helpers.validateSupervisorSectionA(valid), null);
  assert.match(helpers.validateSupervisorSectionA({ ...valid, titleOrigin: '' })!, /title.*origin|proposed.*title/i);
  assert.match(helpers.validateSupervisorSectionA({ ...valid, courseResults: [] })!, /course/i);
  assert.match(helpers.validateSupervisorSectionA({ ...valid, noCoursesTaken: true })!, /both|remove/i);
  assert.equal(helpers.validateSupervisorSectionA({ ...valid, noCoursesTaken: true, courseResults: [] }), null);
  assert.match(helpers.validateSupervisorSectionA({ ...valid, declarationAccepted: false })!, /declaration/i);
});

test('Section A validates complete bounded rows without imposing a grade scale', () => {
  assert.match(helpers.validateSupervisorSectionA({ ...valid, courseResults: [{ ...course, grade: ' ' }] })!, /grade|complete/i);
  for (const [key, limit] of [['courseName',255], ['courseCode',64], ['semesterSession',64], ['grade',32]] as const) {
    assert.equal(helpers.validateSupervisorSectionA({ ...valid, courseResults: [{ ...course, [key]: 'x'.repeat(limit) }] }), null);
    assert.ok(helpers.validateSupervisorSectionA({ ...valid, courseResults: [{ ...course, [key]: 'x'.repeat(limit + 1) }] }));
  }
  assert.equal(helpers.validateSupervisorSectionA({ ...valid, courseResults: Array.from({ length: 50 }, () => course) }), null);
  assert.match(helpers.validateSupervisorSectionA({ ...valid, courseResults: Array.from({ length: 51 }, () => course) })!, /50/);
  assert.deepEqual(helpers.buildSupervisorSectionAInput(valid), { version: 1, titleOrigin: 'SUPERVISOR', noCoursesTaken: false, courseResults: [{ courseName: 'Research methods', courseCode: 'WQD7001', semesterSession: 'S1 2026/2027', grade: 'A' }], declarationAccepted: true });
});

test('Title origin does not impose uploads or proposal configuration', () => {
  for (const titleOrigin of ['STUDENT', 'SUPERVISOR'] as const) {
    assert.equal(helpers.validateSupervisorSectionA({ ...valid, titleOrigin }), null);
  }
});

test('Multipart serializes Section A separately, preserves private uploads and legacy callers', () => {
  const fields = { proposedSupervisorId: 'L1', researchTitle: 'Title', researchArea: 'Area', researchAbstract: 'Abstract', replacesAppointmentId: 4, replacementReason: ' New topic ', projectCourseCodes: ' WQD7002 ' };
  const files = new Map([['research-proposal', new File(['%PDF'], 'proposal.pdf')]]);
  const body = buildSupervisorApplicationFormData({ ...fields, sectionA: helpers.buildSupervisorSectionAInput(valid) }, files);
  assert.deepEqual(JSON.parse(String(body.get('sectionA'))), { version: 1, titleOrigin: 'SUPERVISOR', noCoursesTaken: false, courseResults: [{ courseName: 'Research methods', courseCode: 'WQD7001', semesterSession: 'S1 2026/2027', grade: 'A' }], declarationAccepted: true });
  assert.equal(body.get('replacementReason'), 'New topic');
  assert.equal(body.get('replacesAppointmentId'), '4');
  assert.equal(body.get('projectCourseCodes'), 'WQD7002');
  assert.deepEqual(body.getAll('requirementCodes'), ['research-proposal']);
  assert.equal((body.get('documents') as File).name, 'proposal.pdf');
  assert.equal(body.has('studentParticulars'), false);
  assert.equal(buildSupervisorApplicationFormData(fields, files).has('sectionA'), false);
});
