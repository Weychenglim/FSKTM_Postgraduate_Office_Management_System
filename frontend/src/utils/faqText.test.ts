import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FAQ_PORTAL_LINKS, askedDifferently, parseFaqText, parseInline, safeHref } from './faqText';

// bold, links and plain text
assert.deepEqual(parseInline('Pay **before week 2** at [the portal](https://maya.um.edu.my).'), [
  { kind: 'text', text: 'Pay ' },
  { kind: 'bold', text: 'before week 2' },
  { kind: 'text', text: ' at ' },
  { kind: 'link', text: 'the portal', href: 'https://maya.um.edu.my', internal: false },
  { kind: 'text', text: '.' },
]);

// addresses written out become links, without the full stop after them
assert.deepEqual(parseInline('See https://hep.um.edu.my/accommodation. Or email pgoffice@um.edu.my!'), [
  { kind: 'text', text: 'See ' },
  { kind: 'link', text: 'https://hep.um.edu.my/accommodation', href: 'https://hep.um.edu.my/accommodation', internal: false },
  { kind: 'text', text: '. Or email ' },
  { kind: 'link', text: 'pgoffice@um.edu.my', href: 'mailto:pgoffice@um.edu.my', internal: false },
  { kind: 'text', text: '!' },
]);

// portal links stay inside the portal
assert.deepEqual(parseInline('[your files](/files)'), [{ kind: 'link', text: 'your files', href: '/files', internal: true }]);

// a script or unknown link is never linked: only its words are kept
for (const bad of ['javascript:void0', '//evil.example', 'data:text/html,hi', 'vbscript:x', 'JAVASCRIPT:void0']) {
  assert.equal(safeHref(bad), null, bad);
  assert.deepEqual(parseInline(`[click](${bad})`), [{ kind: 'text', text: 'click' }], bad);
}
assert.ok(parseInline('[click](javascript:alert(1))').every(part => part.kind === 'text'));
assert.deepEqual(safeHref('mailto:pgoffice@um.edu.my'), { href: 'mailto:pgoffice@um.edu.my', internal: false });

// HTML is only ever text
assert.deepEqual(parseInline('<img src=x onerror=alert(1)>'), [{ kind: 'text', text: '<img src=x onerror=alert(1)>' }]);

// paragraphs, line breaks and bullets
assert.deepEqual(parseFaqText('Line one\nLine two\n\n- First\n- **Second**\n\nAfter'), [
  { kind: 'paragraph', parts: [{ kind: 'text', text: 'Line one' }, { kind: 'break' }, { kind: 'text', text: 'Line two' }] },
  { kind: 'list', items: [[{ kind: 'text', text: 'First' }], [{ kind: 'bold', text: 'Second' }]] },
  { kind: 'paragraph', parts: [{ kind: 'text', text: 'After' }] },
]);
assert.deepEqual(parseFaqText('   \n'), []);

// "Matched:" shows only when the student asked in other words
assert.equal(askedDifferently('How do I register courses?', 'how do i register courses'), false);
assert.equal(askedDifferently('nak daftar kursus', 'How do I register courses?'), true);

// every portal button the office can choose has words and a page, and matches the backend
const models = readFileSync(resolve('..', 'backend', 'faq', 'models.py'), 'utf8');
const backendLinks = [...models.slice(models.indexOf('class PortalLink'), models.indexOf('question = models')).matchAll(/([A-Z_]+) = "\1", "([^"]+)"/g)];
assert.equal(backendLinks.length, Object.keys(FAQ_PORTAL_LINKS).length);
for (const [, key, label] of backendLinks) {
  assert.equal(FAQ_PORTAL_LINKS[key as keyof typeof FAQ_PORTAL_LINKS]?.label, label, key);
}

// the rendered answer never uses raw HTML
const component = readFileSync(resolve('src/components/FaqText.tsx'), 'utf8');
assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
assert.match(component, /rel="noopener noreferrer"/);

// students ask; only the office manages the knowledge base
const app = readFileSync(resolve('src/App.tsx'), 'utf8');
assert.match(app, /isStudentWorkspace \? \(\s*<StudentFAQChatbot \/>/);
const chat = readFileSync(resolve('src/components/StudentFAQChatbot.tsx'), 'utf8');
assert.doesNotMatch(chat, /setTimeout\(|mocks\/|AI Assistant/);

console.log('faqText.test.ts passed');
