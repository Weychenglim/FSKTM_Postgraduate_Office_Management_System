import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GeneratedLetter, NotificationItem, StudentProgressDossier } from '../types';
import { SIDEBAR_ITEMS, SIDEBAR_MENU_ORDER } from '../constants/navigation';
import { APP_ROUTES, isKnownAppPath, sidebarItemForPath } from '../constants/routes';
import { announcementItems, appointmentRows, humanStatus, marksRows, recordCounts } from './myRecords';

assert.equal(humanStatus('PENDING_SUPERVISOR'), 'Pending Supervisor');
assert.equal(humanStatus('Active'), 'Active');
assert.equal(humanStatus(null), '-');

const dossier = {
  supervisor: {
    currentRecordId: '1',
    records: [
      {
        recordId: '1', status: 'APPROVED', proposedSupervisor: 'Dr Proposed', submittedAt: '2026-08-01T09:00:00+08:00',
        appointment: { appointmentDate: '2026-08-10', status: 'ACTIVE', supervisor: 'Dr Aminah' },
      },
      { recordId: '2', status: 'PENDING_SUPERVISOR', proposedSupervisor: 'Dr Second', submittedAt: '2026-09-01T09:00:00+08:00', appointment: null },
    ],
  },
  panel: {
    records: [
      { recordId: '7', status: 'APPROVED', recommendedMember: 'Dr Panel', waitingSince: null, waitingDays: null, appointment: { appointmentDate: '2026-09-15', status: 'ACTIVE', panelMember: 'Dr Panel' } },
    ],
  },
  marks: {
    summaryStatus: null,
    completionRate: null,
    tasks: [
      { taskId: '31', status: 'IN_PROGRESS', period: 'P1 Evaluation', semester: 'Semester 1 2026/2027', evaluatorRole: 'SUPERVISOR', dueAt: '2026-10-20T17:00:00+08:00' },
    ],
  },
} as unknown as StudentProgressDossier;

assert.deepEqual(appointmentRows(dossier), [
  { key: 'supervisor-1', kind: 'Supervisor', person: 'Dr Aminah', status: 'Active', date: '2026-08-10' },
  { key: 'supervisor-2', kind: 'Supervisor', person: 'Dr Second', status: 'Pending Supervisor', date: '2026-09-01T09:00:00+08:00' },
  { key: 'panel-7', kind: 'Panel', person: 'Dr Panel', status: 'Active', date: '2026-09-15' },
]);
assert.deepEqual(marksRows(dossier), [
  { key: '31', period: 'P1 Evaluation', semester: 'Semester 1 2026/2027', role: 'Supervisor', status: 'In Progress', dueAt: '2026-10-20T17:00:00+08:00' },
]);

const notifications = [
  { id: 'a', isAnnouncement: true },
  { id: 'b', isAnnouncement: false },
  { id: 'c', isAnnouncement: true },
] as NotificationItem[];
// Only approved letters count; requests still pending or rejected do not.
const letters = [
  { id: 'l1', status: 'Issued' },
  { id: 'l2', status: 'Issued' },
  { id: 'l3', status: 'Pending' },
  { id: 'l4', status: 'Rejected' },
] as GeneratedLetter[];
assert.deepEqual(announcementItems(notifications).map((n) => n.id), ['a', 'c']);
assert.deepEqual(recordCounts({ dossier, letters, notifications }), { appointments: 3, marks: 1, letters: 2, announcements: 2 });

// nothing loaded yet, or nothing shared: every category is empty, not broken
assert.deepEqual(recordCounts({ dossier: null, letters: [], notifications: [] }), { appointments: 0, marks: 0, letters: 0, announcements: 0 });
const hidden = { supervisor: null, panel: null, marks: null } as unknown as StudentProgressDossier;
assert.deepEqual(appointmentRows(hidden), []);
assert.deepEqual(marksRows(hidden), []);

// /my-profile is a real page under the Dashboard entry, for students only
assert.equal(APP_ROUTES.myProfile, '/my-profile');
assert.equal(isKnownAppPath('/my-profile'), true);
assert.equal(sidebarItemForPath('/my-profile'), SIDEBAR_ITEMS.DASHBOARD);
const app = readFileSync(resolve('src/App.tsx'), 'utf8');
assert.match(app, /pathname === APP_ROUTES\.myProfile && !isStudentWorkspace \? \(\s*<Navigate to=\{APP_ROUTES\.dashboard\} replace \/>/);
const header = readFileSync(resolve('src/components/TopHeader.tsx'), 'utf8');
assert.match(header, /\{userRole === 'Student' && \([\s\S]{0,200}navigate\(APP_ROUTES\.myProfile\)/, 'My Profile is only in the student menu');
assert.match(header, /<span>My Profile<\/span>/);
assert.match(header, /setDropdownOpen\(false\); navigate\(APP_ROUTES\.settings\);/, 'Settings in the profile menu opens Settings');
assert.ok(!SIDEBAR_MENU_ORDER.includes(SIDEBAR_ITEMS.SETTINGS), 'Settings is in the profile menu, not the sidebar');
const page = readFileSync(resolve('src/components/StudentMyRecords.tsx'), 'utf8');
for (const text of ['No records found.', 'Uploaded by you', "getDocuments({ view: 'all' }", 'routeForDocument(file.id)', 'Change in Settings', 'getStudentProgressDossier(currentUser.studentId)']) {
  assert.ok(page.includes(text), `My Profile is missing ${text}`);
}
assert.ok(!page.includes('Available when File Management is released'), 'Files in My Profile show the student\'s real uploads');

console.log('My Profile tests passed.');
