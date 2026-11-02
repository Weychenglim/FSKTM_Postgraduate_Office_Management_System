import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const intent = await import('../utils/supervisorResearchIntent').catch(() => assert.fail('Research Intent schema must exist'));
const fields = await import('./SupervisorResearchIntent').catch(() => assert.fail('Research Intent editor and view must exist'));

test('nine labelled fields are grouped and empty, with bounds and explicit required descriptions', () => {
  const html = renderToStaticMarkup(<fields.SupervisorResearchIntentEditor value={intent.emptySupervisorResearchIntent()} onChange={() => {}} />);
  for (const group of ['Background and purpose', 'Questions and objectives', 'Research plan']) assert.ok(html.includes(group));
  for (const field of intent.RESEARCH_INTENT_FIELDS) {
    assert.ok(html.includes(`for="research-intent-${field.key}"`));
    assert.ok(html.includes(`id="research-intent-${field.key}"`));
  }
  assert.equal((html.match(/<textarea/g) ?? []).length, 9);
  assert.equal((html.match(/required=""/g) ?? []).length, 9);
  assert.equal((html.match(/aria-hidden="true">\*/g) ?? []).length, 9);
  assert.equal((html.match(/maxLength="10000"/g) ?? []).length, 9);
});

test('submitted view distinguishes legacy, loading, error/retry and real full text safely', () => {
  const props = { record: null, loading: false, error: null, onRetry: () => {} };
  assert.match(renderToStaticMarkup(<fields.SupervisorResearchIntentSection {...props} />), /No Research Intent was recorded/);
  assert.match(renderToStaticMarkup(<fields.SupervisorResearchIntentSection {...props} loading />), /Loading submitted Research Intent/);
  const failed = renderToStaticMarkup(<fields.SupervisorResearchIntentSection {...props} error="Access unavailable" />);
  assert.match(failed, /Access unavailable/); assert.match(failed, /Retry/);
  const record = { ...intent.emptySupervisorResearchIntent(), introduction: '<script>Actual student text</script>\nSecond paragraph' };
  const html = renderToStaticMarkup(<fields.SupervisorResearchIntentSection {...props} record={record} />);
  assert.match(html, /&lt;script&gt;Actual student text&lt;\/script&gt;/);
  assert.match(html, /Second paragraph/); assert.doesNotMatch(html, /<script>/);
  for (const field of intent.RESEARCH_INTENT_FIELDS) assert.ok(html.includes(field.label));
});


test('Embedded submitted intent groups the complete research text without another card', () => {
  const record = { ...intent.emptySupervisorResearchIntent(), introduction: 'Recorded introduction', methodology: 'Recorded method' };
  const html=renderToStaticMarkup(React.createElement(fields.SupervisorResearchIntentSection, {record,loading:false,error:null,onRetry:()=>{},embedded:true} as any));
  for(const group of ['Background and purpose','Questions and objectives','Research plan'])assert.ok(html.includes(group),group);
  assert.equal((html.match(/<details/g)||[]).length,3);
  assert.equal((html.match(/<details[^>]*open/g)||[]).length,1);
  assert.match(html,/Expand all/);
  assert.doesNotMatch(html,/bg-white rounded-2xl border/);
  assert.match(html,/Recorded introduction/);assert.match(html,/Recorded method/);
});
