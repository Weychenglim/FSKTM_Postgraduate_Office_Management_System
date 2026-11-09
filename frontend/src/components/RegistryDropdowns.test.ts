import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SelectMenu} from './SelectMenu';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const registry = readFileSync(resolve('src/components/StudentRegistry.tsx'), 'utf8');
const selectMenu = readFileSync(resolve('src/components/SelectMenu.tsx'), 'utf8');

// The browser's own <select> list cannot be styled, so the registry uses SelectMenu.
assert.doesNotMatch(registry, /<select\b/, 'the registry must not fall back to a native <select>');
assert.match(
  registry,
  /<SelectMenu\s+id="programme-selection"[\s\S]{0,300}placeholder="Select registered programme"/,
  'the registration form must use SelectMenu for the programme',
);
assert.equal((registry.match(/<SelectMenu\b/g) ?? []).length, 9, 'four filters, three in the form and two record fields');
assert.match(registry, /programme: '',/, 'the programme field starts empty so the placeholder shows');

// WAI-ARIA select-only combobox: focus stays on the button.
for (const contract of [
  /role="combobox"/,
  /aria-activedescendant=/,
  /role="listbox"/,
  /role="option"/,
  /aria-selected=\{isSelected\}/,
  /case 'Escape':/,
  /case 'Home':/,
  /case 'End':/,
  /createPortal\(/,
]) {
  assert.match(selectMenu, contract, `SelectMenu is missing ${contract}`);
}

const props = {value: 'all', options: [{value: 'all', label: 'All programmes'}], onChange: () => {}};
const closed = renderToStaticMarkup(createElement(SelectMenu, props));
assert.match(closed, /aria-haspopup="listbox"/);
assert.match(closed, /aria-expanded="false"/);
const searchable = renderToStaticMarkup(createElement(SelectMenu, {...props, searchPlaceholder: 'Find programme'}));
assert.match(searchable, /aria-haspopup="dialog"/);
console.log('Registry dropdown checks passed.');
