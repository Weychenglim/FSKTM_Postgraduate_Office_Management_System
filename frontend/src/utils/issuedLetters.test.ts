import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GeneratedLetter } from '../types';
import { ApiError } from '../services/apiClient';
import {
  approvalFieldErrors,
  getLetterRequests,
  isAlreadyRequested,
  requestLetter,
} from '../services/lettersApi';
import { SIDEBAR_ITEMS } from '../constants/navigation';
import {
  APP_ROUTES,
  isKnownAppPath,
  routeForLetterApplication,
  routeForLetterRequest,
  routeForNotificationTarget,
  sidebarItemForPath,
} from '../constants/routes';
import {
  LETTERHEAD,
  PENDING_REFERENCE,
  letterDataFromIssued,
  letterFileName,
  openLetterWindow,
  printLetterInWindow,
} from './letterDocument';

// an issued letter prints with the server's reference number and date
const issued: GeneratedLetter = {
  id: '7',
  referenceNumber: 'UMF/PG/ENR/2026/0007',
  templateId: '3',
  templateName: 'Confirmation of Study',
  letterType: 'Academic Certification',
  status: 'Issued',
  date: '11 October 2026',
  requestedAt: '2026-10-10T09:00:00+08:00',
  issuedAt: '2026-10-11T10:30:00+08:00',
  studentName: 'Ali bin Abu',
  matricNumber: 'S2101234',
  programName: 'Master of Computer Science',
  note: '',
  decidedAt: '2026-10-11T10:30:00+08:00',
  decidedBy: 'Office Staff',
  rejectReason: '',
  withdrawnAt: null,
  revokedAt: null,
  revokeReason: '',
  content: 'This is to confirm that **Ali bin Abu** is registered.',
};
assert.deepEqual(letterDataFromIssued(issued), {
  templateName: 'Confirmation of Study',
  refNo: 'UMF/PG/ENR/2026/0007',
  date: '11 October 2026',
  bodyParagraphs: 'This is to confirm that **Ali bin Abu** is registered.',
  studentName: 'Ali bin Abu',
  matricNumber: 'S2101234',
  disclaimer: LETTERHEAD.disclaimer,
  malayDisclaimer: LETTERHEAD.malayDisclaimer,
  signatoryName: LETTERHEAD.signatoryName,
  signatoryOffice: LETTERHEAD.signatoryOffice,
  malaySignatoryName: LETTERHEAD.malaySignatoryName,
  malaySignatoryOffice: LETTERHEAD.malaySignatoryOffice,
});
assert.equal(letterFileName(letterDataFromIssued(issued)), 'UM_Confirmation_of_Study_S2101234');

// students request letters; they never fill or preview one themselves
const documentSource = readFileSync(resolve('src/utils/letterDocument.ts'), 'utf8');
const studentScreen = readFileSync(resolve('src/components/StudentLetterGeneration.tsx'), 'utf8');
const applicationForm = readFileSync(resolve('src/components/StudentLetterRequestForm.tsx'), 'utf8');
assert.doesNotMatch(documentSource, /generateReferenceNumber|Math\.random/);
assert.match(applicationForm, /requestLetter\(\s*template\.id,\s*note\.trim\(\),/);
for (const source of [studentScreen, applicationForm]) {
  assert.doesNotMatch(source, /LetterPages|renderLetterBodyHtml|\.content\b/, 'no wording reaches the student before approval');
}
assert.equal(PENDING_REFERENCE, 'Assigned on approval');

// a refused approval names the values that need attention
assert.deepEqual(
  approvalFieldErrors(new ApiError('Fill in', 400, { detail: 'Fill in', fieldErrors: { ATTENDANCE: 'Fill this in before approving.' } })),
  { ATTENDANCE: 'Fill this in before approving.' },
);
assert.equal(approvalFieldErrors(new ApiError('Bad', 400, { reason: 'Give the reason.' })), null);
assert.equal(approvalFieldErrors(new ApiError('Conflict', 409, { fieldErrors: { A: 'x' } })), null);
assert.equal(approvalFieldErrors(new Error('offline')), null);

// a second request for a pending letter is recognised
assert.equal(isAlreadyRequested(new ApiError('Already', 409, { code: 'letter_request_pending' })), true);
assert.equal(isAlreadyRequested(new ApiError('Other', 409, { detail: 'x' })), false);
assert.equal(isAlreadyRequested(new ApiError('Forbidden', 403, { code: 'letter_request_pending' })), false);

// the print window is opened first and filled when the letter arrives
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let written = '';
const listeners = new Map<string, EventListenerOrEventListenerObject>();
let printed = false;
const popup = {
  document: { open() {}, write(value: string) { written = value; }, close() {} },
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) { listeners.set(type, listener); },
  focus() {},
  print() { printed = true; },
  close() {},
};
let blocked = false;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { location: { origin: 'https://portal.example.test' }, open: () => (blocked ? null : popup) },
});
try {
  const win = openLetterWindow();
  assert.equal(win, popup);
  assert.equal(written, '');
  printLetterInWindow(win as unknown as Window, letterDataFromIssued(issued));
  assert.match(written, /UMF\/PG\/ENR\/2026\/0007/);
  assert.match(written, /<strong>Ali bin Abu<\/strong>/);
  assert.doesNotMatch(written, /<script\b/i);
  (listeners.get('load') as EventListener)(new Event('load'));
  assert.equal(printed, true);
  blocked = true;
  assert.equal(openLetterWindow(), null);
} finally {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
}

// the office list sends only the filters that are set; a request carries its note
const originalFetch = globalThis.fetch;
const requested: { url: string; body?: string }[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  requested.push({ url: String(input), body: typeof init?.body === 'string' ? init.body : undefined });
  return new Response(init?.method === 'POST' ? '{}' : '[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;
try {
  await getLetterRequests({ search: ' S2101234 ', from: '2026-01-01', to: '', status: 'Issued,Revoked' });
  await getLetterRequests();
  await requestLetter('3', 'For my embassy appointment');
} finally {
  globalThis.fetch = originalFetch;
}
assert.deepEqual(
  requested.map((r) => r.url),
  [
    '/api/letters/requests/?search=S2101234&from=2026-01-01&status=Issued%2CRevoked',
    '/api/letters/requests/',
    '/api/letters/requests/',
  ],
);
assert.deepEqual(JSON.parse(requested[2].body ?? '{}'), { templateId: '3', note: 'For my embassy appointment' });

// students' letter notifications open My Requests; a new request opens for the office
assert.equal(
  routeForNotificationTarget({ targetModule: 'LETTERS', recordType: 'GENERATED_LETTER', recordId: '7' }),
  APP_ROUTES.lettersMine,
);
assert.equal(
  routeForNotificationTarget({ targetModule: 'LETTERS', recordType: 'LETTER_REQUEST', recordId: '12' }),
  routeForLetterRequest('12'),
);
assert.equal(routeForLetterRequest('12'), '/letters/requests/12');
assert.equal(routeForLetterApplication('62'), '/letters/apply/62');
for (const path of [
  APP_ROUTES.lettersMine,
  APP_ROUTES.lettersIssued,
  APP_ROUTES.lettersRequests,
  routeForLetterRequest('12'),
  routeForLetterApplication('62'),
]) {
  assert.equal(isKnownAppPath(path), true, path);
  assert.equal(sidebarItemForPath(path), SIDEBAR_ITEMS.LETTER_GENERATION, path);
}

// the office approves on its own review page, with the values it typed in
const office = readFileSync(resolve('src/components/OfficeLetterRequests.tsx'), 'utf8');
assert.match(office, /approveLetterRequest\(request\.id, typed\)/);
assert.match(office, /rejectLetterRequest\(request\.id, text\)/);
assert.match(office, /<RecordPage\b/, 'the review is a record page, not an overlay');

// the PDF copy carries the same letterhead as the printed letter
const pdfSource = readFileSync(resolve('../backend/letters/pdf_export.py'), 'utf8');
const pythonStrings = (name: string) => {
  const match = pdfSource.match(new RegExp(`^${name} = (\\([\\s\\S]*?^\\)|"[^"\\n]*")`, 'm'));
  assert.ok(match, `could not read ${name} from letters/pdf_export.py`);
  return [...match[1].matchAll(/"([^"\n]*)"/g)].map(([, text]) => text);
};
assert.equal(pythonStrings('FACULTY').join(''), LETTERHEAD.faculty);
assert.deepEqual(pythonStrings('ADDRESS_LINES'), [...LETTERHEAD.addressLines]);
assert.equal(pythonStrings('MALAY_FACULTY').join(''), LETTERHEAD.malayFaculty);
assert.deepEqual(pythonStrings('MALAY_ADDRESS_LINES'), [...LETTERHEAD.malayAddressLines]);
assert.equal(pythonStrings('DISCLAIMER').join(''), LETTERHEAD.disclaimer);
assert.equal(pythonStrings('APPOINTMENT_DISCLAIMER').join(''), LETTERHEAD.appointmentDisclaimer);
assert.equal(pythonStrings('MALAY_DISCLAIMER').join(''), LETTERHEAD.malayDisclaimer);
assert.equal(pythonStrings('MALAY_APPOINTMENT_DISCLAIMER').join(''), LETTERHEAD.malayAppointmentDisclaimer);
assert.equal(pythonStrings('SIGNATORY_NAME').join(''), LETTERHEAD.signatoryName);
assert.equal(pythonStrings('SIGNATORY_OFFICE').join(''), LETTERHEAD.signatoryOffice);
assert.equal(pythonStrings('MALAY_SIGNATORY_NAME').join(''), LETTERHEAD.malaySignatoryName);
assert.equal(pythonStrings('MALAY_SIGNATORY_OFFICE').join(''), LETTERHEAD.malaySignatoryOffice);

console.log('Issued letter tests passed.');
