import assert from 'node:assert/strict';
import type { DocumentTypeOption, PortalDocument } from '../types';
import type { MySubmission } from '../services/submissionsApi';
import { addLabel, documentSlots } from './documentSlots';

const type = (code: string, label: string, group: string, groupLabel: string, onePerStudent = true): DocumentTypeOption => ({
  code, label, description: '', group, groupLabel, kind: 'STUDENT', uploaders: ['STUDENT'], allowedKinds: ['PDF'],
  shareSupervisors: true, sharePanel: true, shareCoordinator: true, onePerStudent, isActive: true,
});
const types = [
  type('p1-research-report', 'P1 Research Report', 'RP1', 'Research Project 1'),
  type('final-research-report', 'Final Research Report', 'RP2', 'Research Project 2'),
  type('turnitin-report', 'Turnitin Report', 'RP2', 'Research Project 2'),
  type('supporting-document', 'Supporting Document', 'SUPPORTING', 'Supporting Documents', false),
];
const file = (id: number, code: string, title: string, uploadedAt = '2026-02-14T02:00:00Z'): PortalDocument => ({
  id, reference: `DOC-${id}`, title, description: '', type: { code, label: code }, group: '', groupLabel: '', students: [],
  isStaffFile: false, staffAudience: '', staffAudienceLabel: '', staffProgrammes: [], share: { supervisors: true, panel: true, coordinator: true },
  autoTags: [], semester: null, uploadedBy: { name: 'Ali', role: 'Student', roleLabel: 'Student', isMe: true }, uploadedAt, file: null,
  archived: false, archivedAt: null, archivedBy: '', archiveReason: '',
  permissions: { canDownload: true, canDelete: true, canUploadVersion: true, canEdit: true, canChangeSharing: false, canArchive: false, canRestore: false },
});
const NOW = Date.parse('2026-11-11T04:00:00Z');
const submission = (overrides: Partial<MySubmission>): MySubmission => ({
  id: 7, title: 'RP2 final report', type: { code: 'final-research-report', label: 'Final Research Report', allowedKinds: ['PDF'] },
  semester: 'Semester I 2026/2027', dueAt: '2026-11-23T15:59:00Z', originalDueAt: '2026-11-23T15:59:00Z', extended: false, closesAt: null,
  afterDue: 'CLOSE', isOpen: true, canSend: true, lateIfSentNow: false, why: '', state: 'NOT_SENT', sentAt: null, lateBySeconds: null,
  documentId: null, ...overrides,
});
const view = (groups: ReturnType<typeof documentSlots>) =>
  groups.map(group => `${group.label}${group.now ? ' (now)' : ''}: ${group.rows.map(row => `${row.name} | ${row.line} | ${row.tone} | ${row.action ?? '-'}`).join(' ; ')}`);

// Nothing sent yet: every document has a row with Upload, in the faculty's order.
assert.deepEqual(view(documentSlots(types, '', [], [], NOW)), [
  'Research Project 1: P1 Research Report | Not sent | plain | Upload',
  'Research Project 2: Final Research Report | Not sent | plain | Upload ; Turnitin Report | Not sent | plain | Upload',
  'Supporting Documents: ',
]);

// An RP2 student with a due date and an earlier P1 report.
const p2 = documentSlots(types, 'P2', [file(1, 'p1-research-report', 'My proposal'), file(2, 'supporting-document', 'Ethics approval', '2026-10-20T02:00:00Z')], [submission({})], NOW);
assert.deepEqual(view(p2), [
  'Research Project 2 (now): Final Research Report | Due 23 Nov 2026, 23:59 · 12 days 11 hours left | due | Upload ; Turnitin Report | Not sent | plain | Upload',
  'Research Project 1: P1 Research Report | Sent 14 Feb 2026 | sent | Replace',
  'Supporting Documents: Ethics approval | Sent 20 Oct 2026 | sent | -',
]);
assert.equal(addLabel(p2[2].addType!), 'Add a supporting document');
assert.equal(p2[1].rows[0].document?.id, 1, 'Replace adds a version to the file already there');

// Sent, late, closed and late-but-open submissions.
const states = documentSlots(types, 'P2', [file(3, 'final-research-report', 'Report')], [
  submission({ id: 1, title: 'Draft', state: 'ON_TIME', sentAt: '2026-11-10T14:04:00Z', documentId: 3 }),
  submission({ id: 2, title: 'Final', state: 'LATE', sentAt: '2026-11-10T14:04:00Z', lateBySeconds: 3 * 3600, canSend: false, documentId: 3 }),
  submission({ id: 3, title: 'Correction', canSend: false, why: 'This submission is closed.' }),
  submission({ id: 4, title: 'Late copy', lateIfSentNow: true }),
], NOW);
assert.deepEqual(states[0].rows.slice(0, 4).map(row => [row.name, row.line, row.tone, row.action]), [
  ['Draft', 'Sent 10 Nov 2026, 22:04, on time', 'sent', 'Replace'],
  ['Final', 'Sent 10 Nov 2026, 22:04, 3 hours late', 'late', null],
  ['Correction', 'This submission is closed.', 'closed', null],
  ['Late copy', 'Due 23 Nov 2026, 23:59 · will be marked late', 'late', 'Upload'],
], 'Two or more submissions of one type are named by their titles');

// A supporting submission gets its own row, and files of a switched-off type still show.
const supporting = documentSlots(types, '', [file(4, 'supporting-document', 'Ethics approval'), file(5, 'old-form', 'Old form')], [
  submission({ id: 9, title: 'Ethics approval for RP2', type: { code: 'supporting-document', label: 'Supporting Document', allowedKinds: ['PDF'] }, state: 'ON_TIME', sentAt: '2026-11-10T14:04:00Z', documentId: 4 }),
], NOW);
assert.deepEqual(view(supporting).slice(2), [
  'Supporting Documents: Ethics approval for RP2 | Sent 10 Nov 2026, 22:04, on time | sent | Replace',
  'Other files: Old form | Sent 14 Feb 2026 | sent | -',
]);

console.log('Document rows read as the student needs them.');
