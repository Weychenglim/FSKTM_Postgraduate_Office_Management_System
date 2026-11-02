import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const module = await import('./PortalSelect').catch(() => null);
test('Hidden options stay in the native form contract but are not menu choices',()=>{
  assert.ok(module);
  const html=renderToStaticMarkup(<module.PortalSelect><option value="" hidden>Hidden placeholder</option><option value="1">Computing</option></module.PortalSelect>);
  assert.match(html,/>Computing<\/span>/);
  assert.match(html,/<option value="" hidden="">Hidden placeholder/);
  assert.doesNotMatch(html,/>Hidden placeholder<\/span>/);
});
test('Existing form selectors expose the shared combobox without losing native form constraints', () => {
  assert.ok(module, 'A shared select adapter is required for existing form and filter controls');
  const { PortalSelect } = module;
  const html = renderToStaticMarkup(<PortalSelect id="programme" name="programme" required value="2" onChange={() => {}} aria-describedby="programme-help"><option value="">Select programme</option><option value={2}>Computing</option><option value="3" disabled>Closed programme</option></PortalSelect>);
  assert.match(html, /<button[^>]*id="programme"[^>]*role="combobox"/);
  assert.match(html, /aria-describedby="programme-help"/);
  assert.match(html, /<select[^>]*name="programme"[^>]*required/);
  assert.match(html, /<select[^>]*aria-hidden="true"[^>]*tabindex="-1"/);
  assert.match(html, /<option value="2" selected="">Computing/);
  assert.match(html, /<option value="3" disabled="">Closed programme/);
  assert.match(html, />Computing<\/span>/);
  assert.ok(html.indexOf('<button') < html.indexOf('<select'), 'Wrapping labels must activate the styled control');
});

test('Every module uses the shared styled selector rather than exposing OS dropdowns', () => {
  function check(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) check(path);
      else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.') && !['PortalSelect.tsx', 'SelectMenu.tsx'].includes(entry.name)) {
        assert.doesNotMatch(readFileSync(path, 'utf8'), /<select\b/, `${path} exposes a native dropdown`);
      }
    }
  }
  check('src');
});

test('Select adapters preserve options supplied in fragments, implicit values and numeric defaults', () => {
  assert.ok(module);
  const { PortalSelect } = module;
  const html = renderToStaticMarkup(<PortalSelect defaultValue={25}><><option value={10}>10 rows</option><option value={25}>25 rows</option></><option>All semesters</option></PortalSelect>);
  assert.match(html, />25 rows<\/span>/);
  const implicit = renderToStaticMarkup(<PortalSelect value="All semesters"><option>All semesters</option></PortalSelect>);
  assert.match(implicit, />All semesters<\/span>/);
});

test('Required empty fields and unavailable choices retain their disabled and validation states', () => {
  assert.ok(module);
  const { PortalSelect } = module;
  const html = renderToStaticMarkup(<PortalSelect required disabled value="" aria-invalid="true"><option value="" disabled>Choose a lecturer</option></PortalSelect>);
  assert.match(html, /role="combobox"[^>]*aria-required="true"[^>]*aria-invalid="true"/);
  assert.match(html, /<button[^>]*disabled=""/);
  assert.match(html, />Choose a lecturer<\/span>/);
});
