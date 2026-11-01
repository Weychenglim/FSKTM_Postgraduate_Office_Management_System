import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FaqChangeRow, FaqQuestionGroup } from '../types';
import { APP_ROUTES, routeForFaqEntry, sidebarItemForPath } from '../constants/routes';
import { SIDEBAR_ITEMS } from '../constants/navigation';
import { faqEntryQuery } from '../services/faqApi';
import { FAQ_STATUS_CHIP, FAQ_STATUS_LABEL, documentState, entryHint, faqHistoryLine, groupLine, passageSource, percent } from './faqOffice';

const models = readFileSync(resolve('..', 'backend', 'faq', 'models.py'), 'utf8');
const section = (start: string, end: string) => models.slice(models.indexOf(start), models.indexOf(end, models.indexOf(start)));

// every status the backend has gets a label and a chip
const statuses = [...section('class Status(models.TextChoices)', 'class PortalLink').matchAll(/([A-Z_]+) = "\1"/g)].map(match => match[1]);
assert.deepEqual(statuses.sort(), Object.keys(FAQ_STATUS_LABEL).sort());
assert.deepEqual(Object.keys(FAQ_STATUS_CHIP).sort(), Object.keys(FAQ_STATUS_LABEL).sort());

// every history action the backend records reads as words
const change = (action: string, details: Record<string, unknown> = {}): FaqChangeRow => ({ id: 1, action, actor: 'Siti', at: '2026-10-15T02:00:00Z', details });
const actions = [...section('class FaqChange(models.Model)', 'entry = models').matchAll(/([A-Z_]+) = "\1"/g)].map(match => match[1]);
assert.equal(actions.length, 13);
for (const action of actions) assert.notEqual(faqHistoryLine(change(action)), action, action);
assert.equal(faqHistoryLine(change('IMPORTED', { status: 'NEEDS_CHECKING' })), 'Imported from the FAQ PDF as needs checking');
assert.equal(faqHistoryLine(change('EDITED', { fields: ['answer', 'other ways students ask'] })), 'Changed the answer, other ways students ask');
assert.equal(faqHistoryLine(change('EDITED', { fields: ['answer'], source: "the office's review list" })), "Changed the answer from the office's review list");

// the quiet line under a question in the list
assert.equal(entryHint({ status: 'NEEDS_CHECKING', note: 'answer appears to be a fragment', altCount: 0, portalLink: '' }), 'answer appears to be a fragment');
assert.equal(entryHint({ status: 'PUBLISHED', note: '', altCount: 2, portalLink: 'SUPERVISOR_APPOINTMENTS' }), '2 other ways to ask · Button: Open Supervisor Appointments');
assert.equal(entryHint({ status: 'PUBLISHED', note: '', altCount: 1, portalLink: '' }), '1 other way to ask');
assert.equal(entryHint({ status: 'DRAFT', note: '', altCount: 0, portalLink: '' }), '');

// what the chatbot did with a group of student questions
const group = (fields: Partial<FaqQuestionGroup>): FaqQuestionGroup => ({
  key: 'k', text: 'bila daftar', count: 3, lastAsked: '', noMatch: 0, notHelpful: 0, lastOutcome: 'NO_MATCH', lastEntry: null, ids: ['1'], ...fields,
});
assert.equal(groupLine(group({}), '14 Oct 2026'), 'Asked 3 times · last on 14 Oct 2026 · no answer found');
assert.equal(groupLine(group({ count: 1, lastOutcome: 'CHOICES' }), 'today'), 'Asked 1 time · last on today · the chatbot offered choices');
assert.equal(
  groupLine(group({ lastOutcome: 'ANSWERED', lastEntry: { id: '9', question: 'How do I register courses?' } }), 'today'),
  'Asked 3 times · last on today · the chatbot showed "How do I register courses?"',
);
assert.equal(percent(null), 'None yet');
assert.equal(percent(86), '86%');

// the list asks only for what is set, and each screen has an address under FAQ
assert.equal(faqEntryQuery({ search: '', category: '', status: '', page: 1 }), '');
assert.equal(faqEntryQuery({ search: ' fee ', category: '3', status: 'NEEDS_CHECKING', page: 2 }), '?search=fee&category=3&status=NEEDS_CHECKING&page=2');
assert.equal(routeForFaqEntry('12'), '/faq/entries/12');
for (const path of [APP_ROUTES.faqEntryNew, APP_ROUTES.faqQuestions, APP_ROUTES.faqSettings, '/faq/entries/12']) {
  assert.equal(sidebarItemForPath(path), SIDEBAR_ITEMS.FAQ_CHATBOT, path);
}

// the office screens run on live data, with styled dropdowns
for (const file of ['AcademicFAQEditor', 'FaqEntryPage', 'FaqDocumentsTab']) {
  const source = readFileSync(resolve(`src/components/${file}.tsx`), 'utf8');
  assert.doesNotMatch(source, /mocks\/|MOCK_|<select\b|dangerouslySetInnerHTML/, file);
}

// reference documents and their passages
assert.deepEqual(documentState({ status: 'READY', passages: 42, archived: false }).label, 'Ready, 42 passages');
assert.deepEqual(documentState({ status: 'READY', passages: 1, archived: false }).label, 'Ready, 1 passage');
assert.deepEqual(documentState({ status: 'NO_TEXT', passages: 0, archived: false }).label, 'No text found (scanned PDF?)');
assert.deepEqual(documentState({ status: 'READY', passages: 3, archived: true }).label, 'Archived');
assert.equal(passageSource({ title: 'Postgraduate Handbook 2026', page: 12 }), 'From Postgraduate Handbook 2026, page 12');
assert.equal(passageSource({ title: 'Thesis guide', page: null }), 'From Thesis guide');
assert.equal(groupLine(group({ lastOutcome: 'DOCUMENT' }), 'today'), 'Asked 3 times · last on today · the chatbot showed a passage from a document');
assert.equal(sidebarItemForPath(APP_ROUTES.faqDocuments), SIDEBAR_ITEMS.FAQ_CHATBOT);
const chat = readFileSync(resolve('src/components/FaqChatParts.tsx'), 'utf8');
assert.match(chat, /not a reviewed FAQ answer/);

console.log('faqOffice.test.ts passed');
