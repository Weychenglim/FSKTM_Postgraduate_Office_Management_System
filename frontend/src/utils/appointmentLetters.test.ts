import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GeneratedLetter, MissingAppointmentLetter } from '../types';
import { SIDEBAR_ITEMS } from '../constants/navigation';
import { APP_ROUTES, isKnownAppPath, routeForFileLetter, routeForNotificationTarget, sidebarItemForPath } from '../constants/routes';
import { canReissue, letterOrigin, missingLettersSummary, recipientsLine } from './appointmentLetters';
import {
  LETTERHEAD,
  findPlaceholderProblems,
  letterClosing,
  letterDataFromIssued,
  placeholderPurposeHint,
  placeholdersFor,
} from './letterDocument';

const missing = (problem: string | null, id = '1'): MissingAppointmentLetter => ({
  kind: 'supervisor',
  appointmentId: id,
  studentName: 'Ali Hassan',
  matricNumber: 'S1',
  lecturerName: 'Dr Supervisor',
  appointedOn: '15 October 2026',
  problem,
});

// the banner appears only when appointments have no letter, and says what can be done
assert.equal(missingLettersSummary([]), null);
assert.deepEqual(missingLettersSummary([missing(null), missing(null, '2')]), {
  title: '2 approved appointments have no letter yet',
  detail: 'The templates are ready. Create the letters to send them to the students and lecturers.',
  ready: 2,
  blocked: 0,
});
const noTemplate = 'There is no active panel appointment letter template.';
assert.deepEqual(missingLettersSummary([missing(noTemplate)]), {
  title: '1 approved appointment has no letter yet',
  detail: noTemplate,
  ready: 0,
  blocked: 1,
});
assert.equal(
  missingLettersSummary([missing(null), missing(noTemplate, '2'), missing(noTemplate, '3')])?.detail,
  `1 can be made now. 2 cannot yet: ${noTemplate}`,
);

// appointment letters say how they were made and who they went to
assert.equal(letterOrigin({ purpose: 'SUPERVISOR_APPOINTMENT', letterType: 'Academic Certification' }), 'Sent automatically on supervisor approval');
assert.equal(letterOrigin({ purpose: 'PANEL_APPOINTMENT', letterType: 'Academic Certification' }), 'Sent automatically on panel approval');
assert.equal(letterOrigin({ purpose: 'REQUEST', letterType: 'Visa & Immigration' }), 'Visa & Immigration');
assert.equal(letterOrigin({ letterType: 'Visa & Immigration' }), 'Visa & Immigration');
assert.equal(
  recipientsLine([{ name: 'Ali Hassan', relation: 'Student' }, { name: 'Dr Panel', relation: 'Panel member' }]),
  'Ali Hassan (student), Dr Panel (panel member)',
);
assert.equal(recipientsLine(undefined), '');
assert.equal(canReissue({ purpose: 'PANEL_APPOINTMENT', status: 'Issued' }), true);
assert.equal(canReissue({ purpose: 'PANEL_APPOINTMENT', status: 'Revoked' }), false);
assert.equal(canReissue({ purpose: 'REQUEST', status: 'Issued' }), false);

// appointment tags only count as known in the letters that can use them
assert.deepEqual(findPlaceholderProblems('Panel {{PANEL_NAME}}'), { unknown: ['{{PANEL_NAME}}'], malformed: [] });
assert.deepEqual(findPlaceholderProblems('Panel {{PANEL_NAME}}', [], 'SUPERVISOR_APPOINTMENT'), { unknown: ['{{PANEL_NAME}}'], malformed: [] });
assert.deepEqual(findPlaceholderProblems('Panel {{PANEL_NAME}}, {{RESEARCH_TITLE}}', [], 'PANEL_APPOINTMENT'), { unknown: [], malformed: [] });
assert.equal(placeholderPurposeHint('{{PANEL_NAME}}'), '{{PANEL_NAME}} works only in panel appointment letters.');
assert.equal(placeholderPurposeHint('{{RESEARCH_TITLE}}'), '{{RESEARCH_TITLE}} works only in appointment letters.');
assert.equal(placeholderPurposeHint('{{CO_SUPERVISOR_NAME}}'), '{{CO_SUPERVISOR_NAME}} works only in supporting supervisor appointment letters.');
assert.equal(placeholderPurposeHint('{{STUDENT_NAME}}'), null);
const supervisorTags = placeholdersFor('SUPERVISOR_APPOINTMENT').map((p) => p.tag);
assert.ok(supervisorTags.includes('{{SUPERVISOR_ACCEPTED_DATE}}'));
assert.ok(supervisorTags.includes('{{STUDENT_NAME}}'));
assert.ok(!supervisorTags.includes('{{PANEL_NAME}}'));
assert.ok(!placeholdersFor().some((p) => p.tag === '{{RESEARCH_TITLE}}'));

// the server's hint wording is the same
const views = readFileSync(resolve('../backend/letters/placeholders.py'), 'utf8');
assert.match(views, /kinds = "appointment letters" if purposes == _APPOINTMENTS else " and "\.join\(PURPOSE_LABELS\[purpose\] for purpose in purposes\)\n\s+return f"\{tag\} works only in \{kinds\}\."/);

// each letter closes with its own signatory, and appointment letters with the office wording
assert.deepEqual(letterClosing({ purpose: 'REQUEST' }), {
  disclaimer: LETTERHEAD.disclaimer,
  malayDisclaimer: LETTERHEAD.malayDisclaimer,
  signatoryName: LETTERHEAD.signatoryName,
  signatoryOffice: LETTERHEAD.signatoryOffice,
  malaySignatoryName: LETTERHEAD.malaySignatoryName,
  malaySignatoryOffice: LETTERHEAD.malaySignatoryOffice,
});
assert.deepEqual(letterClosing({ purpose: 'SUPERVISOR_APPOINTMENT', signatoryName: ' Prof Signer ', signatoryTitle: 'Deputy Dean' }), {
  disclaimer: LETTERHEAD.appointmentDisclaimer,
  malayDisclaimer: LETTERHEAD.malayAppointmentDisclaimer,
  signatoryName: 'Prof Signer',
  signatoryOffice: 'Deputy Dean',
  malaySignatoryName: 'Prof Signer',
  malaySignatoryOffice: 'Deputy Dean',
});
// the Malay page takes its own lines when the template has them
assert.deepEqual(
  letterClosing({ purpose: 'SUPERVISOR_APPOINTMENT', signatoryName: 'Dean', signatoryTitle: 'Faculty', signatoryNameMs: ' Dekan ', signatoryTitleMs: 'Fakulti' }),
  {
    disclaimer: LETTERHEAD.appointmentDisclaimer,
    malayDisclaimer: LETTERHEAD.malayAppointmentDisclaimer,
    signatoryName: 'Dean',
    signatoryOffice: 'Faculty',
    malaySignatoryName: 'Dekan',
    malaySignatoryOffice: 'Fakulti',
  },
);
const issued = {
  id: '9', referenceNumber: 'UMF/PG/SV/2026/0001', templateId: '1', templateName: 'Supervisor appointment letter',
  letterType: 'Academic Certification', purpose: 'SUPERVISOR_APPOINTMENT', signatoryName: 'Prof Signer', signatoryTitle: '',
  status: 'Issued', date: '15 October 2026', requestedAt: '', issuedAt: null, studentName: 'Ali Hassan', matricNumber: 'S1',
  programName: '', note: '', decidedAt: null, decidedBy: '', rejectReason: '', withdrawnAt: null, revokedAt: null,
  revokeReason: '', content: 'Dear Ali',
} satisfies GeneratedLetter;
const printData = letterDataFromIssued(issued);
assert.equal(printData.signatoryName, 'Prof Signer');
assert.equal(printData.signatoryOffice, LETTERHEAD.signatoryOffice);
assert.equal(printData.disclaimer, LETTERHEAD.appointmentDisclaimer);

// the office screens offer the new choices
const editor = ['LetterTypeEditor', 'LetterWordingEditor'].map((name) => readFileSync(resolve(`src/components/${name}.tsx`), 'utf8')).join('\n');
assert.match(editor, /name="letter-template-purpose"/);
assert.match(editor, /When is this letter used\?/);
assert.match(editor, /findPlaceholderProblems\(editorContent, names, editorPurpose\)/);
assert.match(editor, /signatoryName: submitted\.signatoryName\.trim\(\)/);
assert.match(editor, /formQuestions: request \? submitted\.questions : \[\]/, 'appointment letters save no student form');
const register = readFileSync(resolve('src/components/IssuedLetters.tsx'), 'utf8');
assert.match(register, /<MissingAppointmentLetters /);
assert.match(register, /Reissue with current details/);
assert.match(register, /madeBy \}\)/);
assert.match(register, /closing=\{letterClosing\(letter\)\}/);
const review = readFileSync(resolve('src/components/OfficeLetterRequests.tsx'), 'utf8');
assert.match(review, /\{!automatic && \(\s*<PortalButton variant="danger"/, 'appointment letters are issued, not rejected');

// notices open the letter in Files, where lecturers can reach it; missing ones open the office register
assert.equal(routeForFileLetter('5'), '/files/letters/5');
assert.equal(routeForNotificationTarget({ targetModule: 'LETTERS', recordType: 'APPOINTMENT_LETTER', recordId: '5' }), '/files/letters/5');
assert.equal(routeForNotificationTarget({ targetModule: 'LETTERS', recordType: 'APPOINTMENT_LETTERS_MISSING', recordId: '3' }), APP_ROUTES.lettersIssued);
assert.equal(routeForNotificationTarget({ targetModule: 'LETTERS', recordType: 'GENERATED_LETTER', recordId: '5' }), APP_ROUTES.lettersMine);
assert.equal(isKnownAppPath('/files/letters/5'), true);
assert.equal(sidebarItemForPath('/files/letters/5'), SIDEBAR_ITEMS.FILE_MANAGEMENT);
const app = readFileSync(resolve('src/App.tsx'), 'utf8');
assert.match(app, /const AppointmentLetterPage = lazyNamed\('AppointmentLetterPage'/);
assert.match(app, /fileLetterMatch \? \(\s*<AppointmentLetterPage/);
const files = readFileSync(resolve('src/components/FileRepository.tsx'), 'utf8');
assert.match(files, /getReceivedLetters\(filters\.student\)/, "a lecturer sees their own letters about the student");
assert.match(files, /to=\{routeForFileLetter\(letter\.id\)\}/);
const letterPage = readFileSync(resolve('src/components/AppointmentLetterPage.tsx'), 'utf8');
assert.match(letterPage, /closing=\{letterClosing\(letter\)\}/);
assert.match(letterPage, /This letter isn't available to you\./);

console.log('Appointment letter tests passed.');
