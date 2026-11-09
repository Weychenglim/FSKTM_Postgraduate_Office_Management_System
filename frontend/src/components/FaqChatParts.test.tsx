import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaqReplyView, type ChatReply } from './FaqChatParts';

const official: ChatReply = {
  outcome: 'ANSWERED',
  answer: { id: '7', question: 'How do I renew my student pass?', answer: 'The long official answer.', category: 'During the semester', portalLink: 'LETTERS' },
  choices: [],
  related: [{ id: '9', question: 'A related question?' }],
  passage: null,
  contactText: '',
  mode: 'hybrid',
};

const render = (reply: ChatReply) => renderToStaticMarkup(
  <FaqReplyView reply={reply} asked="renew pass" typed busy={false} onPick={() => undefined} onOpenDocument={() => undefined} onPortalLink={() => undefined} />,
);

// the usual reply is unchanged when the AI has no part in it
const usual = render({ ...official, ai: null });
assert.match(usual, /The long official answer\./);
assert.match(usual, /A related question\?/);
assert.doesNotMatch(usual, /Written by AI/);

// an AI reply is labelled and links to the official answers it used
const written = render({ ...official, related: [], ai: { text: 'Submit **3 months** before it expires.', sources: [{ id: '7', question: 'How do I renew my student pass?' }] } });
assert.match(written, /<strong[^>]*>3 months<\/strong>/);
assert.match(written, /Written by AI from the PG Office FAQ/);
assert.match(written, /Official answer</);
assert.match(written, /How do I renew my student pass\?/);
assert.doesNotMatch(written, /The long official answer\./);
assert.doesNotMatch(written, /Matched:/);

const two = render({ ...official, ai: { text: 'Short.', sources: [{ id: '7', question: 'One?' }, { id: '8', question: 'Two?' }] } });
assert.match(two, /Official answers</);

console.log('FAQ reply view tests passed.');
