import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListChips, ListFiltersButton, ListSearch, ListToolbar, ListToolbarRow } from './ListToolbar';
import { APP_ROUTES, routeForStudentRecord } from '../constants/routes';

const html = renderToStaticMarkup(
  <ListToolbar>
    <ListChips
      label="Show requests by status"
      value="Pending"
      onChange={() => undefined}
      options={[
        { value: 'Pending', label: 'Pending', count: 3 },
        { value: 'Issued', label: 'Approved', count: 1250 },
        { value: 'All', label: 'All', count: null },
      ]}
    />
    <ListToolbarRow>
      <ListSearch label="Search requests" placeholder="Search student" value="amir" onChange={() => undefined} />
      <ListFiltersButton open={false} active={2} onToggle={() => undefined} />
    </ListToolbarRow>
  </ListToolbar>,
);

assert.match(html, /role="group" aria-label="Show requests by status"/);
assert.match(html, /aria-pressed="true"[^>]*>Pending<span[^>]*>3<\/span>/, 'the chosen chip is pressed and shows its count');
assert.match(html, /aria-pressed="false"[^>]*>Approved<span[^>]*>1,250<\/span>/, 'large counts are grouped');
assert.match(html, /aria-pressed="false"[^>]*>All<\/button>/, 'a chip with no count shows only its name');
const box = /<input[^>]*>/.exec(html)?.[0] ?? '';
for (const part of ['type="search"', 'aria-label="Search requests"', 'placeholder="Search student"', 'value="amir"']) assert.ok(box.includes(part), part);
assert.match(html, /aria-expanded="false"[^>]*>.*Filters \(2\)/s, 'the Filters button says how many are in use');
assert.doesNotMatch(renderToStaticMarkup(<ListFiltersButton open active={0} onToggle={() => undefined} />), /\(0\)/);

assert.equal(routeForStudentRecord('A/1'), '/registry/students/A%2F1');
assert.equal(APP_ROUTES.registryRegister, '/registry/register');

const here = dirname(fileURLToPath(import.meta.url));
for (const screen of ['OfficeLetterRequests', 'IssuedLetters', 'LetterTypesList', 'FileRepository', 'AcademicFAQEditor', 'StaffLecturersRegistry']) {
  const source = readFileSync(join(here, `${screen}.tsx`), 'utf8');
  assert.match(source, /<ListToolbar>/, `${screen} uses the shared list toolbar`);
  assert.doesNotMatch(source, /WorkspaceFilterCard/, `${screen} no longer puts a filter box above its rows`);
}

console.log('List toolbar: chips, search, Filters button and the screens that use them');
