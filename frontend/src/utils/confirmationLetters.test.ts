import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LETTER_WORDS, buildLetterHtml, malayLetterDate, renderLetterBodyHtml } from './letterDocument';
import { COUNTRIES, MALAYSIA, MALAYSIAN_STATES } from './addressPlaces';
import {
  OPTIONAL_DETAIL_LABELS,
  OPTIONAL_DETAIL_TAGS,
  RECIPIENT_PURPOSE_LABELS,
  chosenDetailLabels,
  offeredDetails,
  recipientAddressLines,
} from './letterRecipients';

// the optional details are the server's, and the purpose names (a fallback for
// requests made before purposes were saved with them) are the seeded ones
const recipients = readFileSync(resolve('../backend/letters/recipients.py'), 'utf8');
const block = (name: string) => recipients.match(new RegExp(`^${name} = \\[([\\s\\S]*?)^\\]`, 'm'))?.[1] ?? '';
const seed = readFileSync(resolve('../backend/letters/migrations/0009_seed_recipients_and_questions.py'), 'utf8');
const seededPurposes = Object.fromEntries([...(seed.match(/^PURPOSES = \[([\s\S]*?)^\]/m)?.[1] ?? '').matchAll(/\("([A-Z]+)", "([^"]+)", "[^"]+", "[^"]+"\)/g)].map(([, code, label]) => [code, label]));
const serverDetails = Object.fromEntries([...block('OPTIONAL_DETAILS').matchAll(/\("([A-Z_]+)", "([^"]+)"/g)].map(([, code, label]) => [code, label]));
assert.ok(Object.keys(seededPurposes).length > 0, 'could not read PURPOSES from the seed migration');
assert.deepEqual(RECIPIENT_PURPOSE_LABELS, seededPurposes);
assert.deepEqual(OPTIONAL_DETAIL_LABELS, serverDetails);
const serverTags = Object.fromEntries([...block('OPTIONAL_DETAILS').matchAll(/\("([A-Z_]+)", "[^"]+", "([A-Z_]+)"\)/g)].map(([, code, tag]) => [code, `{{${tag}}}`]));
assert.deepEqual(OPTIONAL_DETAIL_TAGS, serverTags);

// a letter offers only the optional details its wording shows
assert.deepEqual(offeredDetails('| Balance (Max) | {{BALANCE_SEMESTERS_MAX}} |\n{{CURRENT_SEMESTER}}'), ['MAX_PERIOD', 'CURRENT_SEMESTER']);
assert.deepEqual(offeredDetails('{{RECIPIENT}}\n\nDear Sir/Madam,'), []);

// the PDF's Malay words are the screen's
const pdf = readFileSync(resolve('../backend/letters/pdf_export.py'), 'utf8');
for (const language of ['en', 'ms'] as const) {
  const name = language === 'en' ? 'ENGLISH' : 'MALAY';
  const words = pdf.match(new RegExp(`^${name} = \\{([^\\n]*)\\}`, 'm'))?.[1] ?? '';
  assert.match(words, new RegExp(`"reference": "${LETTER_WORDS[language].reference}"`));
  assert.match(words, new RegExp(`"date": "${LETTER_WORDS[language].date}"`));
  assert.ok(words.includes(`"stamp": "${LETTER_WORDS[language].stamp}"`), `${name} stamp`);
}

// the address is printed under the name, postcode and city together
const details = { organisation: 'CIMB Bank Berhad', addressLine1: 'Jalan Universiti', addressLine2: '', postcode: '50603', city: 'Kuala Lumpur', state: '', include: ['MAX_PERIOD'] };
assert.deepEqual(recipientAddressLines(details), ['Jalan Universiti', '50603 Kuala Lumpur']);
assert.deepEqual(recipientAddressLines({ ...details, state: 'Selangor', country: 'Malaysia' }), ['Jalan Universiti', '50603 Kuala Lumpur', 'Selangor']);
assert.deepEqual(recipientAddressLines({ ...details, postcode: '048616', city: 'Singapore', country: 'Singapore' }), ['Jalan Universiti', '048616 Singapore', 'Singapore']);

// the states and countries offered are the server's lists
const places = readFileSync(resolve('../backend/letters/places.py'), 'utf8');
const pythonTuple = (name: string) => {
  const from = places.indexOf(`${name} = (`);
  return [...places.slice(from, places.indexOf(')', from)).matchAll(/"([^"]+)"/g)].map(([, text]) => text);
};
assert.deepEqual([...MALAYSIAN_STATES], pythonTuple('MALAYSIAN_STATES'));
assert.deepEqual([...COUNTRIES], pythonTuple('COUNTRIES'));
assert.equal(COUNTRIES[0], MALAYSIA);
assert.deepEqual(chosenDetailLabels(details), ['Maximum period of study']);
assert.deepEqual(recipientAddressLines(undefined), []);

// "| Label | value |" lines become a details table, other lines stay paragraphs
const table = renderLetterBodyHtml('Details:\n\n| Name | **Ali** |\n| Matric Number | S123 |\n\nThank you.');
assert.match(table, /^<p[^>]*>Details:<\/p><table/);
assert.equal((table.match(/<tr>/g) ?? []).length, 2);
assert.match(table, /<td[^>]*>Name<\/td><td[^>]*>:<\/td><td[^>]*><strong>Ali<\/strong><\/td>/);
assert.match(table, /<\/table><p[^>]*>Thank you.<\/p>$/);
assert.doesNotMatch(renderLetterBodyHtml('a | b'), /<table/);
assert.match(renderLetterBodyHtml('| Date | {{VALID_UNTIL}} |', { highlightPlaceholders: true }), /<td[^>]*><span[^>]*>\{\{VALID_UNTIL\}\}<\/span><\/td>/);

// dates on the Malay page
assert.equal(malayLetterDate('23 October 2026'), '23 Oktober 2026');
assert.equal(malayLetterDate('23 JANUARY 2027'), '23 JANUARI 2027');
assert.equal(malayLetterDate('{{CURRENT_DATE}}'), '{{CURRENT_DATE}}');

// a bilingual letter prints a second, Malay sheet; an English one prints one sheet
(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:3000' } };
const base = { templateName: 'Student Confirmation Letter', refNo: 'UMF/PG/SCL/2026/0001', date: '23 October 2026', bodyParagraphs: 'Dear Sir/Madam,', studentName: 'Ali', matricNumber: 'S123' };
const english = buildLetterHtml(base);
assert.equal((english.match(/<div class="sheet">/g) ?? []).length, 1);
const both = buildLetterHtml({ ...base, bodyParagraphsMs: 'Tuan/Puan,' });
assert.equal((both.match(/<div class="sheet">/g) ?? []).length, 2);
assert.match(both, /Rujukan Kami: <span class="value">UMF\/PG\/SCL\/2026\/0001<\/span>/);
assert.match(both, /Tarikh: <span class="value">23 Oktober 2026<\/span>/);
assert.match(both, /Surat ini dikeluarkan atas permintaan pelajar/);

// the student applies on a page laid out like Maya's form, not in a pop-up
const student = readFileSync(resolve('src/components/StudentLetterGeneration.tsx'), 'utf8');
assert.match(student, /<StudentLetterRequestForm\b/);
assert.doesNotMatch(student, /PortalModal/);
const form = readFileSync(resolve('src/components/StudentLetterRequestForm.tsx'), 'utf8');
const fields = readFileSync(resolve('src/components/LetterFormFields.tsx'), 'utf8');
assert.match(form, /Letter Details Application Form/);
assert.match(form, /Required information/);
assert.match(form, /'Letter details', 'Check and send'/, 'two steps, ending with a check');
assert.match(form, /getLetterForm\(template\.id\)/, 'the questions come from the letter type');
for (const label of ['Programme', 'Purpose', 'Recipient', 'Address Line 1', 'Address Line 2', 'Postcode', 'City', 'State', 'Country', 'Application Date', 'Additional Information']) {
  assert.ok(fields.includes(`'${label}'`) || fields.includes(`"${label}"`), `the form has ${label}`);
}
assert.match(form, /requestLetter\(\s*template\.id,\s*note\.trim\(\),\s*recipientQuestion \? details : undefined,/);
assert.match(fields, /searchPlaceholder="Search"/, 'the recipient list can be searched');
assert.match(fields, /Not in the list\? Type the name/);
assert.match(fields, /purpose\?\.allowOther \?/, 'typing a name is offered only where the purpose allows it');
const app = readFileSync(resolve('src/App.tsx'), 'utf8');
assert.match(app, /onOpenRequestForm=\{\(templateId\) => navigate\(routeForLetterApplication\(templateId\)\)\}/);
const review = readFileSync(resolve('src/components/OfficeLetterRequests.tsx'), 'utf8');
assert.match(review, /malayBodyHtml=\{previewMsHtml \|\| undefined\}/);
const editor = readFileSync(resolve('src/components/LetterTypeEditor.tsx'), 'utf8');
const builder = readFileSync(resolve('src/components/LetterQuestionsEditor.tsx'), 'utf8');
assert.match(editor, /`\{\{RECIPIENT\}\}\\n\\n\$\{text/, 'adding "Who is the letter for?" puts Recipient at the top of the letter');
assert.match(editor, /Valid for \(months\)/);
assert.match(editor, /<LetterQuestionsEditor\b/);
assert.match(builder, /Questions students answer/);
assert.match(builder, /What the student sees/);
assert.match(builder, /<LetterFormFields\b[\s\S]*?preview/, 'the preview is the real form');

console.log('Confirmation letter tests passed.');
