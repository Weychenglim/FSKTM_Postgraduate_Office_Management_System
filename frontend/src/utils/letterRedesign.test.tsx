import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LetterFormFields, answersFor, missingAnswers } from '../components/LetterFormFields';
import { daysLeft, isCurrentRequest, requestSteps } from '../components/IssuedLetters';
import { askedFor } from '../components/StudentLetterGeneration';
import { formSummary } from '../components/LetterTypesList';
import { APP_ROUTES, isKnownAppPath, sidebarItemForPath } from '../constants/routes';
import { SIDEBAR_ITEMS } from '../constants/navigation';
import type { GeneratedLetter, LetterFormQuestion, LetterTemplate } from '../types';
import { wordingProblems } from '../components/LetterWordingEditor';
import { EMPTY_REQUEST_DETAILS } from './letterRecipients';
import { renderLetterBodyHtml } from './letterDocument';
import { BLANK_TEMPLATE, fromFriendly, newQuestion, questionNames, sameValues, tagLabels, toFriendly, valuesOf } from './letterEditor';

const purposes = [
  {
    code: 'TRANSPORTATION',
    label: 'Transportation',
    organisationLabel: 'Company',
    allowOther: true,
    organisations: [{ id: '97', name: 'Keretapi Tanah Melayu Berhad (KTMB)', addressLine1: 'Stesen Sentral', addressLine2: '', postcode: '50470', city: 'Kuala Lumpur', state: '', country: '' }],
  },
];
const questions: LetterFormQuestion[] = [
  { kind: 'recipient', purposes: [], askAddress: true, options: purposes },
  { kind: 'extras', options: [{ code: 'CURRENT_SEMESTER', label: 'Current semester' }] },
  { kind: 'date', name: 'TRAVEL_DATE', label: 'Travel date', hint: '', required: true },
  { kind: 'choice', name: 'EMBASSY', label: 'Which embassy?', hint: '', required: false, listId: 3, list: { id: '3', name: 'Embassies', itemNoun: 'Embassy', items: [{ id: '8', name: 'Embassy of Japan' }] } },
  { kind: 'yesno', name: 'WITH_FAMILY', label: 'Travelling with family?', hint: '', required: false },
];

// what the student must answer before the check step
assert.deepEqual(missingAnswers(questions, EMPTY_REQUEST_DETAILS, {}), {
  purpose: 'Choose what the letter is for.',
  addressLine1: 'Enter the address.',
  postcode: 'Enter the postcode.',
  city: 'Enter the city.',
  state: 'Choose the state.',
  'answer:TRAVEL_DATE': 'Answer this question.',
});
const ktmbAddress = { addressLine1: 'Stesen Sentral', postcode: '50470', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan Kuala Lumpur' };
assert.deepEqual(missingAnswers(questions, { ...EMPTY_REQUEST_DETAILS, ...ktmbAddress, purpose: 'TRANSPORTATION' }, { TRAVEL_DATE: '2026-12-01' }), {
  organisation: 'Choose or type the company.',
});
// the second address line is the only one a student may leave out, and only when the letter asks for an address
assert.deepEqual(missingAnswers(questions, { ...EMPTY_REQUEST_DETAILS, ...ktmbAddress, purpose: 'TRANSPORTATION', organisation: 'KTMB' }, { TRAVEL_DATE: '2026-12-01' }), {});
assert.deepEqual(missingAnswers([{ ...questions[0], askAddress: false } as LetterFormQuestion], { ...EMPTY_REQUEST_DETAILS, purpose: 'TRANSPORTATION', organisation: 'KTMB' }, {}), {});
// the state comes from Malaysia's states, and is not asked for an address abroad
assert.deepEqual(missingAnswers(questions, { ...EMPTY_REQUEST_DETAILS, ...ktmbAddress, state: 'WP', purpose: 'TRANSPORTATION', organisation: 'KTMB' }, { TRAVEL_DATE: '2026-12-01' }), { state: 'Choose the state.' });
assert.deepEqual(missingAnswers(questions, { ...EMPTY_REQUEST_DETAILS, ...ktmbAddress, state: '', country: 'Singapore', purpose: 'TRANSPORTATION', organisation: 'KTMB' }, { TRAVEL_DATE: '2026-12-01' }), {});
assert.deepEqual(missingAnswers(questions, { ...EMPTY_REQUEST_DETAILS, ...ktmbAddress, country: '', purpose: 'TRANSPORTATION', organisation: 'KTMB' }, { TRAVEL_DATE: '2026-12-01' }), { country: 'Choose the country.' });
// only the office's own questions are sent, and a yes or no is always sent
assert.deepEqual(answersFor(questions, { TRAVEL_DATE: ' 2026-12-01 ', EMBASSY: '', stray: 'x' }), { TRAVEL_DATE: '2026-12-01', WITH_FAMILY: false });

// the form shows a row per question, in the Maya layout
const html = renderToStaticMarkup(
  <LetterFormFields
    questions={questions}
    programme="MASTER OF DATA SCIENCE (COURSEWORK)"
    applicationDate="25 Oct 2026"
    details={{ ...EMPTY_REQUEST_DETAILS, purpose: 'TRANSPORTATION' }}
    onDetails={() => undefined}
    answers={{}}
    onAnswer={() => undefined}
  />,
);
for (const label of ['Programme', 'Purpose', 'Recipient', 'Address Line 1', 'State', 'Country', 'Additional Information', 'Travel date', 'Which embassy?', 'Travelling with family?', 'Application Date']) {
  assert.ok(html.includes(label), `the form shows ${label}`);
}
assert.ok(html.indexOf('Purpose') < html.indexOf('Travel date') && html.indexOf('Travel date') < html.indexOf('Application Date'), 'rows follow the question order');
assert.match(html, /type="date"/);
assert.equal((html.match(/aria-required="true"/g) ?? []).length, 5, 'every address line but the second is required, with the state and country');
const preview = renderToStaticMarkup(
  <LetterFormFields questions={questions} programme="" applicationDate="" details={EMPTY_REQUEST_DETAILS} onDetails={() => undefined} answers={{}} onAnswer={() => undefined} preview />,
);
assert.ok((preview.match(/disabled=""/g) ?? []).length >= 5, 'nothing can be typed in the office preview');
const noAddress = renderToStaticMarkup(
  <LetterFormFields questions={[{ ...questions[0], askAddress: false } as LetterFormQuestion]} programme="" applicationDate="" details={EMPTY_REQUEST_DETAILS} onDetails={() => undefined} answers={{}} onAnswer={() => undefined} />,
);
assert.ok(!noAddress.includes('Address Line 1'), 'a letter can skip the address rows');

// new questions get a free tag name
const blank = newQuestion('date', 'Travel date', ['TRAVEL_DATE']);
assert.equal(blank.name, 'TRAVEL_DATE_B');
assert.equal(blank.required, true);
assert.equal(newQuestion('yesno', 'With family?', []).required, false);
assert.deepEqual(newQuestion('recipient', '', []), { kind: 'recipient', purposes: [], askAddress: true });
assert.deepEqual(questionNames([{ kind: 'recipient' }, { kind: 'text', name: 'NOTE_ONE', label: 'A' }]), ['NOTE_ONE']);

// the office writes with [names] while the letter keeps its tags
const labels = tagLabels([
  { tag: '{{STUDENT_NAME}}', label: 'Student Name', kind: 'record' },
  { tag: '{{TRAVEL_DATE}}', label: 'Travel date', kind: 'student' },
  { tag: '{{ATTENDANCE}}', label: 'Student Name', kind: 'office' },
  { tag: '{{NOTE_A}}', label: 'Note [main]', kind: 'office' },
]);
assert.equal(toFriendly('Dear {{STUDENT_NAME}}, on {{TRAVEL_DATE}}. {{OOPS}}', labels), 'Dear [Student Name], on [Travel date]. {{OOPS}}');
assert.equal(labels.toLabel.get('{{ATTENDANCE}}'), 'Student Name (office fills in)', 'two details never share a name');
assert.equal(labels.toLabel.get('{{NOTE_A}}'), 'Note (main)');
const typed = 'Dear [Student Name] and [Student Name (office fills in)], see [page 2].';
assert.equal(fromFriendly(typed, labels), 'Dear {{STUDENT_NAME}} and {{ATTENDANCE}}, see [page 2].');
assert.equal(toFriendly(fromFriendly(typed, labels), labels), typed, 'what the office types comes back as typed');
assert.match(renderLetterBodyHtml('Dear {{STUDENT_NAME}}', { highlightPlaceholders: true, tagLabels: labels.toLabel }), />Student Name<\/span>/, 'the preview names details too');

// the wording is checked as it is typed
const wording = wordingProblems({ ...BLANK_TEMPLATE, content: 'Dear {{STUDENT_NAME}} {{OOPS}}', questions: [{ kind: 'recipient', purposes: [], askAddress: true }] });
assert.match(wording.content ?? '', /\{\{OOPS\}\} is not a detail this letter can fill in/);
assert.match(wording.content ?? '', /does not show it/);
assert.equal(wording.contentMs, undefined);
assert.deepEqual(wordingProblems(BLANK_TEMPLATE), { content: undefined, contentMs: undefined });
assert.match(wordingProblems({ ...BLANK_TEMPLATE, content: 'Valid until {{VALID_UNTIL}}' }).content ?? '', /Signature and status step/);

// how a letter type and its form are described
const template = { id: '1', name: 'Visa Letter', type: 'Visa', status: 'Active', lastModified: '', modifiedBy: '', description: '', purpose: 'REQUEST', formQuestions: questions } as unknown as LetterTemplate;
assert.equal(formSummary(template), 'Who it is for, Additional information, 3 questions');
assert.equal(askedFor(template), 'who it is for, travel date, which embassy and travelling with family');
assert.equal(formSummary({ ...template, purpose: 'PANEL_APPOINTMENT' }), 'Sent automatically');
assert.equal(formSummary({ ...template, formQuestions: [] }), 'A note only');
assert.ok(sameValues(valuesOf(template), valuesOf({ ...template })));

// a request's progress, from sending it to the letter being ready
const base = { id: '5', referenceNumber: '', templateId: '1', templateName: 'Visa Letter', letterType: 'Visa', purpose: 'REQUEST', requestedAt: '2026-10-25T02:42:00Z', note: '', decidedBy: '', rejectReason: '', revokeReason: '' } as unknown as GeneratedLetter;
const waiting = requestSteps({ ...base, status: 'Pending' }, 2);
assert.deepEqual(waiting.map((step) => step.state), ['completed', 'current', 'upcoming']);
assert.match(waiting[1].description ?? '', /Usually ready in 2 working days/);
const rejected = requestSteps({ ...base, status: 'Rejected', decidedAt: '2026-10-26T01:00:00Z', rejectReason: 'Attendance below 80%.' });
assert.equal(rejected[1].state, 'rejected');
assert.equal(rejected[1].reason, 'Attendance below 80%.');
const replaced = requestSteps({ ...base, status: 'Revoked', replacedById: '9', revokeReason: 'Replaced by UMF/PG/2027/0002.' });
assert.equal(replaced[2].label, 'Replaced by a newer copy');
assert.equal(isCurrentRequest({ ...base, status: 'Issued' }), true);
assert.equal(isCurrentRequest({ ...base, status: 'Withdrawn' }), false);

// days until a letter stops being valid, counted in Malaysia
const today = new Date('2026-10-25T04:00:00Z');
assert.equal(daysLeft('2026-10-25', today), 0);
assert.equal(daysLeft('2026-11-04', today), 10);
assert.ok((daysLeft('2026-10-01', today) ?? 0) < 0);
assert.equal(daysLeft(null, today), null);

// the office's new tabs have their own addresses under Letter Generation
for (const path of [APP_ROUTES.lettersTypes, APP_ROUTES.lettersLists]) {
  assert.equal(isKnownAppPath(path), true, path);
  assert.equal(sidebarItemForPath(path), SIDEBAR_ITEMS.LETTER_GENERATION, path);
}

console.log('Letter redesign tests passed.');
