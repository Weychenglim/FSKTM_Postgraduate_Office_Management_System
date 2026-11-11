import assert from 'node:assert/strict';
import type { DocumentTypeOption, TaggableStudent } from '../types';
import { APP_ROUTES, routeForNotificationTarget } from '../constants/routes';
import { formatFileSize, historyTime, studentsLine, uploadedLine } from './documentDisplay';
import { EMPTY_DOCUMENT_FILTERS, filtersFromParams, filtersToParams, moreFilterCount } from './documentFilters';
import { defaultSharing, sharingNames, staffReach, staffTypeChoices } from './documentSharing';
import { suggestTypeForFile, tagText } from './documentTags';
import { acceptAttribute, acceptedKinds, fileProblem, kindForName, kindsSentence, nameAsTitle, titleFromFileName, typeForName, typeGroups } from './documentUpload';

const type = (overrides: Partial<DocumentTypeOption>): DocumentTypeOption => ({
  code: 'final-research-report', label: 'Final Research Report', description: '', group: 'RP2', groupLabel: 'Research Project 2',
  kind: 'STUDENT', uploaders: ['STUDENT'], allowedKinds: ['PDF', 'DOCX'], shareSupervisors: true, sharePanel: true,
  shareCoordinator: true, onePerStudent: true,
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
assert.deepEqual(studentsLine([]), { main: 'Staff file', sub: '' });
assert.deepEqual(studentsLine([{ matric: 'S1', name: 'Ali Hassan', programme: '' }]), { main: 'Ali Hassan', sub: 'S1' });
assert.deepEqual(
  studentsLine([{ matric: 'S1', name: 'Ali', programme: '' }, { matric: 'S2', name: 'Bella', programme: '' }, { matric: 'S3', name: 'Chen', programme: '' }]),
  { main: 'Ali and 2 more', sub: 'Bella, Chen' },
);
assert.equal(uploadedLine('Siti', true), 'Uploaded by you');

// Filters
const parsed = filtersFromParams(new URLSearchParams('view=staff&q=ali&student=S1&uploader=nobody&status=WAITING&kind=PDF&from=2026-10-01&to=yesterday'));
assert.equal(parsed.view, 'staff');
assert.equal(parsed.uploader, '', 'Unknown values fall back to empty');
assert.equal('status' in parsed, false, 'There is no check status to filter by');
assert.equal(filtersFromParams(new URLSearchParams('view=check')).view, 'all', 'The old To check view opens all files');
assert.equal(parsed.to, '', 'Dates must be YYYY-MM-DD');
assert.equal(filtersFromParams(new URLSearchParams('view=everything')).view, 'all');
assert.equal(filtersToParams({ ...EMPTY_DOCUMENT_FILTERS, q: ' ali ', type: 'final-research-report' }).toString(), 'q=ali&type=final-research-report');
assert.equal(filtersToParams(EMPTY_DOCUMENT_FILTERS).toString(), '', 'Defaults leave a clean address');
assert.equal(moreFilterCount({ ...EMPTY_DOCUMENT_FILTERS, uploader: 'me', kind: 'PDF', type: 'final-research-report' }), 2);
assert.equal(filtersFromParams(new URLSearchParams('archived=1')).archived, '1', 'The office can ask for archived files');
assert.equal(filtersFromParams(new URLSearchParams('archived=yes')).archived, '');
assert.equal(moreFilterCount({ ...EMPTY_DOCUMENT_FILTERS, archived: '1' }), 1);
assert.equal(filtersToParams({ ...EMPTY_DOCUMENT_FILTERS, archived: '1' }).toString(), 'archived=1');
const tagged = filtersFromParams(new URLSearchParams('group=RP2&programme=MASTER+OF+DATA+SCIENCE+(COURSEWORK)&intake=2025/2026&sender=student&required=1&tag=draft'));
assert.deepEqual(
  [tagged.group, tagged.programme, tagged.intake, tagged.sender],
  ['RP2', 'MASTER OF DATA SCIENCE (COURSEWORK)', '2025/2026', 'student'],
  'Each automatic tag is a filter in the address',
);
assert.equal('required' in tagged, false, 'Required documents are gone');
assert.equal(filtersFromParams(new URLSearchParams('sender=everyone')).sender, '');
assert.equal('tag' in tagged, false, 'Typed tags are gone');
assert.equal(moreFilterCount({ ...EMPTY_DOCUMENT_FILTERS, intake: '2025/2026', sender: 'office', group: 'LETTERS' }), 2);
assert.equal(historyTime('2026-10-14T02:05:00Z'), '14 Oct 2026, 10:05', 'History times are in Malaysia time');
assert.equal(historyTime('not a date'), '');
assert.equal(
  routeForNotificationTarget({ targetModule: 'FILES', recordType: 'REQUIRED_DOCUMENT', recordId: 'supervisor-appointment-form' }),
  APP_ROUTES.files,
  'An old required-document reminder just opens Files',
);

// The upload cards, grouped by stage with the student's own stage first
const timeline = [
  type({ code: 'p1-research-report', label: 'P1 Research Report', group: 'RP1', groupLabel: 'Research Project 1' }),
  type({ code: 'final-research-report', label: 'Final Research Report', group: 'RP2', groupLabel: 'Research Project 2' }),
  type({ code: 'turnitin-report', label: 'Turnitin Report', group: 'RP2', groupLabel: 'Research Project 2' }),
  type({ code: 'supporting-document', label: 'Supporting Document', group: 'SUPPORTING', groupLabel: 'Supporting Documents' }),
];
const grouped = (stage: string) => typeGroups(timeline, stage).map(group => `${group.group}:${group.types.map(item => item.code).join(',')}`);
assert.deepEqual(grouped(''), ['RP1:p1-research-report', 'RP2:final-research-report,turnitin-report', 'SUPPORTING:supporting-document']);
assert.deepEqual(grouped('P1'), grouped(''), 'RP1 students already see their documents first');
assert.deepEqual(grouped('P2'), ['RP2:final-research-report,turnitin-report', 'RP1:p1-research-report', 'SUPPORTING:supporting-document']);

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
assert.equal(fileProblem({ name: 'a.png', size: 10 }, type({}), false, tenMb), 'Unsupported file type. Final Research Report accepts PDF or Word (.docx).');
assert.equal(fileProblem({ name: 'a.docx', size: 10 }, type({}), false, tenMb), null);
assert.equal(titleFromFileName('C:\\fake\\Thesis_draft__3.pdf'), 'Thesis draft 3');
assert.equal(titleFromFileName('ethics-approval.pdf'), 'Ethics approval', 'Dashes become spaces and the first letter is a capital');
assert.equal(titleFromFileName('minutes 2026-11-11.docx'), 'Minutes 2026-11-11', 'Dashes inside a date stay');

// Staff type what a file is
assert.equal(typeForName('Turnitin Report', timeline)?.code, 'turnitin-report');
assert.equal(typeForName('  turnitin   report ', timeline)?.code, 'turnitin-report', 'Case and spaces do not matter');
assert.equal(typeForName('Ethics approval', timeline)?.code, 'supporting-document', 'Anything else is a supporting document');
assert.equal(typeForName('', timeline), null);
const staffOnly = [type({ code: 'staff-document', label: 'Staff Document', kind: 'STAFF', group: 'STAFF' })];
assert.equal(typeForName('Meeting minutes', staffOnly)?.code, 'staff-document');
assert.equal(typeForName('Meeting minutes', timeline.slice(0, 3)), null, 'No general type to fall back on');
assert.equal(nameAsTitle(' turnitin report', typeForName(' turnitin report', timeline)), 'Turnitin Report');
assert.equal(nameAsTitle('ethics   approval ', timeline[3]), 'Ethics approval');

// Sharing
assert.deepEqual(defaultSharing(type({ sharePanel: false })), { supervisors: true, panel: false, coordinator: true });
assert.deepEqual(
  sharingNames([student({ supervisors: ['Dr Co'], panel: ['Dr Panel'], coordinators: ['Prof C'] }), student({ supervisors: ['Dr Co', 'Dr Rizal'], coordinators: ['Prof C'] })]),
  { supervisors: ['Dr Co', 'Dr Rizal'], panel: ['Dr Panel'], coordinators: ['Prof C'] },
);
const types = [
  type({ code: 'p1-research-report', uploaders: ['STUDENT'] }),
  type({ code: 'turnitin-report', uploaders: ['STUDENT', 'SUPERVISOR'] }),
  type({ code: 'supporting-document', uploaders: ['STUDENT', 'SUPERVISOR', 'PANEL', 'COORDINATOR'] }),
  type({ code: 'staff-document', kind: 'STAFF', uploaders: ['LECTURER', 'COORDINATOR'] }),
];
const codes = (list: DocumentTypeOption[]) => list.map(item => item.code);
assert.deepEqual(codes(staffTypeChoices(types, { isOffice: false, role: 'Lecturer', staffFile: false, students: [{ roles: ['PANEL'] }] })), ['supporting-document']);
assert.deepEqual(codes(staffTypeChoices(types, { isOffice: false, role: 'Lecturer', staffFile: false, students: [{ roles: ['SUPERVISOR'] }, { roles: ['PANEL'] }] })), ['supporting-document'], 'Every picked student must allow the type');
assert.deepEqual(codes(staffTypeChoices(types, { isOffice: false, role: 'Lecturer', staffFile: false, students: [{ roles: ['SUPERVISOR'] }] })), ['turnitin-report', 'supporting-document']);
assert.deepEqual(codes(staffTypeChoices(types, { isOffice: false, role: 'Lecturer', staffFile: true, students: [] })), ['staff-document']);
assert.deepEqual(codes(staffTypeChoices(types, { isOffice: true, role: 'Office Staff/Admin', staffFile: false, students: [] })), ['p1-research-report', 'turnitin-report', 'supporting-document']);

// Automatic tags and the suggested type
assert.equal(tagText({ kind: 'programme', label: 'MASTER OF DATA SCIENCE (COURSEWORK)', filter: {} }), 'Master of Data Science (Coursework)');
assert.equal(tagText({ kind: 'semester', label: 'Semester 1 2025/2026', filter: {} }), 'Semester 1 2025/2026');
const choices = [
  type({ code: 'p1-research-report', label: 'P1 Research Report' }),
  type({ code: 'final-research-report', label: 'Final Research Report' }),
  type({ code: 'turnitin-report', label: 'Turnitin Report' }),
  type({ code: 'ai-use-declaration', label: 'AI Use Declaration' }),
  type({ code: 'supporting-document', label: 'Supporting Document' }),
];
const suggested = (name: string) => suggestTypeForFile(name, choices)?.code ?? null;
assert.equal(suggested('Turnitin_report_final.pdf'), 'turnitin-report');
assert.equal(suggested('TurnitinReport.pdf'), 'turnitin-report', 'Joined-up words are split');
assert.equal(suggested('Ali Final Research Report v2.docx'), 'final-research-report');
assert.equal(suggested('P1_research_report.pdf'), 'p1-research-report');
assert.equal(suggested('research_v2.docx'), null, 'Every telling word must be there');
assert.equal(suggested('AI-use-declaration-signed.pdf'), 'ai-use-declaration');
assert.equal(suggested('scan0012.jpg'), null);

// Who will see a staff upload
assert.deepEqual(
  staffReach({ supervisors: true, panel: true, coordinator: false }, [student({ supervisors: ['Dr Co', 'Dr Rizal'], panel: [] })]),
  ['The PG office', 'Dr Co, Dr Rizal (supervisors)', 'No panel member yet'],
);

console.log('Document display, filter, upload, sharing and automatic tag helpers behave as expected');
