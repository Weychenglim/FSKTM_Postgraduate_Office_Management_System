import assert from 'node:assert/strict';
import type { DocumentTypeOption, TaggableStudent } from '../types';
import { APP_ROUTES, routeForNotificationTarget } from '../constants/routes';
import { checkBadge, checkChip, checkSteps, formatFileSize, requiredBadge, historyTime, REQUIRED_STATES, requiredProgressLine, stillToHandIn, studentsLine, uploadedLine } from './documentDisplay';
import { EMPTY_DOCUMENT_FILTERS, filtersFromParams, filtersToParams, moreFilterCount } from './documentFilters';
import { defaultSharing, sharingNames, staffReach, staffTypeChoices, studentAudienceSentence, studentReach } from './documentSharing';
import { suggestTypeForFile, tagText, uploadTags } from './documentTags';
import { acceptAttribute, acceptedKinds, fileProblem, kindForName, kindsSentence, titleFromFileName } from './documentUpload';

const type = (overrides: Partial<DocumentTypeOption>): DocumentTypeOption => ({
  code: 'thesis', label: 'Thesis', description: '', group: 'RESEARCH_PROJECT', groupLabel: 'Research Project',
  kind: 'STUDENT', uploaders: ['STUDENT'], allowedKinds: ['PDF', 'DOCX'], shareSupervisors: true, sharePanel: true,
  shareCoordinator: true, needsCheck: false, onePerStudent: true, required: false, requiredDueNote: '', requiredProgrammes: [],
  isActive: true, ...overrides,
});
const student = (overrides: Partial<TaggableStudent>): TaggableStudent => ({
  matric: 'S1', name: 'Ali Hassan', programme: 'DS', status: 'Active', relation: 'Your supervisee', roles: ['SUPERVISOR'],
  supervisors: [], panel: [], coordinators: [], ...overrides,
});

// Display
assert.equal(formatFileSize(512), '512 B');
assert.equal(formatFileSize(640 * 1024), '640 KB');
assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB');
assert.equal(formatFileSize(10 * 1024 * 1024), '10 MB');
assert.equal(checkChip('NONE'), null, 'No chip when nobody needs to act');
assert.equal(checkChip('WAITING')?.label, 'Waiting for office');
assert.equal(checkChip('RETURNED')?.label, 'Returned');
assert.deepEqual(studentsLine([]), { main: 'Staff file', sub: '' });
assert.deepEqual(studentsLine([{ matric: 'S1', name: 'Ali Hassan', programme: '' }]), { main: 'Ali Hassan', sub: 'S1' });
assert.deepEqual(
  studentsLine([{ matric: 'S1', name: 'Ali', programme: '' }, { matric: 'S2', name: 'Bella', programme: '' }, { matric: 'S3', name: 'Chen', programme: '' }]),
  { main: 'Ali and 2 more', sub: 'Bella, Chen' },
);
assert.equal(uploadedLine('Siti', true), 'Uploaded by you');

// Filters
const parsed = filtersFromParams(new URLSearchParams('view=check&q=ali&student=S1&uploader=staff&status=BAD&kind=PDF&from=2026-10-01&to=yesterday'));
assert.equal(parsed.view, 'check');
assert.equal(parsed.status, '', 'Unknown values fall back to empty');
assert.equal(parsed.to, '', 'Dates must be YYYY-MM-DD');
assert.equal(filtersFromParams(new URLSearchParams('view=everything')).view, 'all');
assert.equal(filtersToParams({ ...EMPTY_DOCUMENT_FILTERS, q: ' ali ', type: 'thesis' }).toString(), 'q=ali&type=thesis');
assert.equal(filtersToParams(EMPTY_DOCUMENT_FILTERS).toString(), '', 'Defaults leave a clean address');
assert.equal(moreFilterCount({ ...EMPTY_DOCUMENT_FILTERS, uploader: 'me', kind: 'PDF', type: 'thesis' }), 2);
assert.equal(filtersFromParams(new URLSearchParams('archived=1')).archived, '1', 'The office can ask for archived files');
assert.equal(filtersFromParams(new URLSearchParams('archived=yes')).archived, '');
assert.equal(moreFilterCount({ ...EMPTY_DOCUMENT_FILTERS, archived: '1' }), 1);
assert.equal(filtersToParams({ ...EMPTY_DOCUMENT_FILTERS, archived: '1' }).toString(), 'archived=1');
const tagged = filtersFromParams(new URLSearchParams('group=RESEARCH_PROJECT&programme=MASTER+OF+DATA+SCIENCE+(COURSEWORK)&intake=2025/2026&sender=student&required=1&tag=draft'));
assert.deepEqual(
  [tagged.group, tagged.programme, tagged.intake, tagged.sender, tagged.required],
  ['RESEARCH_PROJECT', 'MASTER OF DATA SCIENCE (COURSEWORK)', '2025/2026', 'student', '1'],
  'Each automatic tag is a filter in the address',
);
assert.equal(filtersFromParams(new URLSearchParams('sender=everyone')).sender, '');
assert.equal('tag' in tagged, false, 'Typed tags are gone');
assert.equal(moreFilterCount({ ...EMPTY_DOCUMENT_FILTERS, intake: '2025/2026', sender: 'office', group: 'LETTERS' }), 2);
assert.equal(historyTime('2026-10-14T02:05:00Z'), '14 Oct 2026, 10:05', 'History times are in Malaysia time');
assert.equal(historyTime('not a date'), '');
const counts = { students: 40, done: 12, waiting: 3, returned: 2, missing: 23 };
assert.equal(requiredProgressLine(counts), '12 of 40 handed in · 3 waiting for a check · 25 still to hand in');
assert.equal(stillToHandIn(counts), 25, 'A returned file still has to be handed in');
assert.equal(requiredProgressLine({ ...counts, waiting: 0 }), '12 of 40 handed in · 25 still to hand in');
assert.equal(requiredProgressLine({ students: 0, done: 0, waiting: 0, returned: 0, missing: 0 }), 'No Active student has to hand it in yet.');
assert.equal(REQUIRED_STATES.MISSING.label, 'Not handed in');
assert.equal(
  routeForNotificationTarget({ targetModule: 'FILES', recordType: 'REQUIRED_DOCUMENT', recordId: 'supervisor-appointment-form' }),
  `${APP_ROUTES.filesUpload}?type=supervisor-appointment-form`,
  'A reminder opens the upload screen with the type chosen',
);

// Upload checks mirror the server
assert.equal(kindForName('Report.PDF'), 'PDF');
assert.equal(kindForName('photo.jpeg'), 'IMAGE');
assert.equal(kindForName('archive.zip'), null);
const everything = type({ allowedKinds: ['PDF', 'DOCX', 'IMAGE', 'XLSX', 'PPTX'], label: 'Other' });
assert.deepEqual(acceptedKinds(everything, false), ['PDF', 'DOCX', 'IMAGE'], 'Students never send Excel or PowerPoint');
assert.deepEqual(acceptedKinds(everything, true), ['PDF', 'DOCX', 'IMAGE', 'XLSX', 'PPTX']);
assert.equal(kindsSentence(['PDF', 'DOCX']), 'PDF or Word (.docx)');
assert.equal(kindsSentence(['PDF', 'DOCX', 'IMAGE']), 'PDF, Word (.docx) or JPG or PNG');
assert.equal(acceptAttribute(['PDF', 'IMAGE']), '.pdf,.jpg,.jpeg,.png');
const tenMb = 10 * 1024 * 1024;
assert.equal(fileProblem(null, type({}), false, tenMb), 'Choose a file to upload.');
assert.equal(fileProblem({ name: 'a.pdf', size: 0 }, type({}), false, tenMb), 'This file is empty.');
assert.equal(fileProblem({ name: 'a.pdf', size: 13 * 1024 * 1024 }, type({}), false, tenMb), 'File is 13 MB. The maximum is 10 MB.');
assert.equal(fileProblem({ name: 'a.png', size: 10 }, type({}), false, tenMb), 'Unsupported file type. Thesis accepts PDF or Word (.docx).');
assert.equal(fileProblem({ name: 'a.docx', size: 10 }, type({}), false, tenMb), null);
assert.equal(titleFromFileName('C:\\fake\\Thesis_draft__3.pdf'), 'Thesis draft 3');

// Sharing
assert.deepEqual(defaultSharing(type({ sharePanel: false })), { supervisors: true, panel: false, coordinator: true });
assert.deepEqual(
  sharingNames([student({ supervisors: ['Dr Co'], panel: ['Dr Panel'], coordinators: ['Prof C'] }), student({ supervisors: ['Dr Co', 'Dr Rizal'], coordinators: ['Prof C'] })]),
  { supervisors: ['Dr Co', 'Dr Rizal'], panel: ['Dr Panel'], coordinators: ['Prof C'] },
);
assert.equal(studentAudienceSentence(type({ sharePanel: false })), 'Seen by the PG office, your supervisor and your programme coordinator.');
assert.equal(studentAudienceSentence(type({ shareSupervisors: false, sharePanel: false, shareCoordinator: false })), 'Seen by the PG office only.');
const types = [
  type({ code: 'thesis', uploaders: ['STUDENT'] }),
  type({ code: 'evaluation-form', uploaders: ['SUPERVISOR', 'PANEL', 'COORDINATOR'] }),
  type({ code: 'research-proposal', uploaders: ['STUDENT', 'SUPERVISOR'] }),
  type({ code: 'staff-document', kind: 'STAFF', uploaders: ['LECTURER', 'COORDINATOR'] }),
  type({ code: 'other', kind: 'BOTH', uploaders: ['STUDENT', 'SUPERVISOR', 'PANEL', 'COORDINATOR', 'LECTURER'] }),
];
const codes = (list: DocumentTypeOption[]) => list.map(item => item.code);
assert.deepEqual(codes(staffTypeChoices(types, { isOffice: false, role: 'Lecturer', staffFile: false, students: [{ roles: ['PANEL'] }] })), ['evaluation-form', 'other']);
assert.deepEqual(codes(staffTypeChoices(types, { isOffice: false, role: 'Lecturer', staffFile: false, students: [{ roles: ['SUPERVISOR'] }, { roles: ['PANEL'] }] })), ['evaluation-form', 'other'], 'Every picked student must allow the type');
assert.deepEqual(codes(staffTypeChoices(types, { isOffice: false, role: 'Lecturer', staffFile: false, students: [{ roles: ['SUPERVISOR'] }] })), ['evaluation-form', 'research-proposal', 'other']);
assert.deepEqual(codes(staffTypeChoices(types, { isOffice: false, role: 'Lecturer', staffFile: true, students: [] })), ['staff-document', 'other']);
assert.deepEqual(codes(staffTypeChoices(types, { isOffice: true, role: 'Office Staff/Admin', staffFile: false, students: [] })), ['thesis', 'evaluation-form', 'research-proposal', 'other']);

// Automatic tags and the suggested type
assert.equal(tagText({ kind: 'programme', label: 'MASTER OF DATA SCIENCE (COURSEWORK)', filter: {} }), 'Master of Data Science (Coursework)');
assert.equal(tagText({ kind: 'semester', label: 'Semester 1 2025/2026', filter: {} }), 'Semester 1 2025/2026');
const choices = [
  type({ code: 'turnitin-report', label: 'Turnitin Report' }),
  type({ code: 'research-proposal', label: 'Research Proposal' }),
  type({ code: 'thesis', label: 'Thesis' }),
  type({ code: 'supervisor-appointment-form', label: 'Supervisor Appointment Form' }),
  type({ code: 'other', label: 'Other' }),
];
const suggested = (name: string) => suggestTypeForFile(name, choices)?.code ?? null;
assert.equal(suggested('Turnitin_report_final.pdf'), 'turnitin-report');
assert.equal(suggested('TurnitinReport.pdf'), 'turnitin-report', 'Joined-up words are split');
assert.equal(suggested('Ali Research Proposal v2.docx'), 'research-proposal');
assert.equal(suggested('proposal_v2.docx'), null, 'Every telling word must be there');
assert.equal(suggested('Thesis_chapter3.pdf'), 'thesis');
assert.equal(suggested('supervisor-appointment-signed.pdf'), 'supervisor-appointment-form', 'Words like "form" are not needed');
assert.equal(suggested('scan0012.jpg'), null);
const preview = uploadTags({ type: type({ required: true }), semester: 'Semester I 2026/2027', role: 'Office Staff/Admin', programmes: ['DS', 'DS', ''], intakes: ['2026/2027 Semester I'] });
assert.deepEqual(preview.map(tag => `${tag.kind}:${tag.label}`), [
  'category:Research Project', 'required:Required', 'semester:Semester I 2026/2027', 'from:PG office', 'programme:DS', 'intake:Intake 2026/2027 Semester I',
], 'The upload summary shows the tags the server will give');
assert.deepEqual(uploadTags({ type: null, semester: null, role: 'Student', programmes: [], intakes: [] }), []);

// Status badges and who will see an upload
assert.deepEqual(checkBadge('WAITING'), { label: 'Waiting for office', tone: 'warning' });
const checked = {
  checkReason: '', checkedBy: '', checkedAt: null, uploadedAt: '2026-10-26T01:00:00Z',
  uploadedBy: { name: 'Ali Hassan', role: 'Student', roleLabel: 'Student', isMe: false },
  file: { number: 2, name: 'form.pdf', kind: 'PDF' as const, size: 10, pageCount: 1, uploadedAt: '2026-10-26T02:00:00Z' },
};
assert.deepEqual(checkSteps({ ...checked, checkStatus: 'NONE' }), [], 'No steps when the office does not check the type');
const waitingSteps = checkSteps({ ...checked, checkStatus: 'WAITING' });
assert.deepEqual(waitingSteps.map(step => `${step.label}:${step.state}`), ['Version 2 uploaded:completed', 'Office check:current', 'Accepted:upcoming']);
assert.equal(waitingSteps[0].occurredAt, '2026-10-26T02:00:00Z', 'The step dates the version being checked');
const returnedSteps = checkSteps({ ...checked, checkStatus: 'RETURNED', checkReason: 'Sign page 2.', checkedBy: 'Siti', checkedAt: '2026-10-26T03:00:00Z' });
assert.deepEqual([returnedSteps[1].state, returnedSteps[1].reason, returnedSteps[1].actorName, returnedSteps[2].state], ['rejected', 'Sign page 2.', 'Siti', 'not_reached']);
assert.equal(checkSteps({ ...checked, checkStatus: 'ACCEPTED', checkedBy: 'Siti', checkedAt: '2026-10-26T03:00:00Z' })[2].state, 'completed');
assert.equal(checkBadge('NONE'), null);
assert.deepEqual(requiredBadge('MISSING'), { label: 'Not handed in', tone: 'danger' });
assert.equal(requiredBadge('DONE', 'ACCEPTED').label, 'Accepted');
assert.equal(requiredBadge('DONE', 'NONE').label, 'Handed in');
assert.deepEqual(
  studentReach(type({ sharePanel: false }), { supervisors: ['Dr Aisyah'], panel: [], coordinators: [] }),
  ['You', 'The PG office', 'Dr Aisyah (supervisor)', 'Your programme coordinator'],
);
assert.deepEqual(studentReach(type({}), undefined).slice(2), ['Your supervisor, once appointed', 'Your panel member, once appointed', 'Your programme coordinator']);
assert.deepEqual(
  staffReach({ supervisors: true, panel: true, coordinator: false }, [student({ supervisors: ['Dr Co', 'Dr Rizal'], panel: [] })]),
  ['The PG office', 'Dr Co, Dr Rizal (supervisors)', 'No panel member yet'],
);

console.log('Document display, filter, upload, sharing and automatic tag helpers behave as expected');
