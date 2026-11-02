import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for (const host of ['MarkEntryDetail','SubmittedMarksActions','MarksCompletionWindows','TimelineManagement','WorkflowReconciliationCentre','EvaluationTaskAssignment']) {
 test(`${host} reviews consequential writes and reports the committed outcome`,()=>{
 const source=readFileSync(new URL(`./${host}.tsx`,import.meta.url),'utf8');
 assert.match(source, /<DecisionDialog/); assert.match(source, /kind="confirmation"/);
 assert.match(source, /successMessage=/);
 if(host==='SubmittedMarksActions'||host==='MarksCompletionWindows') {
   assert.match(source, /<PortalConfirmModal isOpen=\{(?:discardOpen|!!discardAction)\} title="Discard unsaved changes\?"/);
 } else if(host==='EvaluationTaskAssignment') {
   assert.match(source, /<PortalConfirmModal isOpen=\{!!generationReview\} title="Generate evaluation tasks\?"/);
 } else assert.doesNotMatch(source, /<PortalConfirmModal/);
 if(host!=='MarkEntryDetail') assert.match(source,/completeDecision\(/);
 });
}

test('Office correction keeps optimistic concurrency and audited delta payload',()=>{
 const source=readFileSync(new URL('./SubmittedMarksActions.tsx',import.meta.url),'utf8');
 assert.match(source,/expectedVersion: actions!\.version!/);
 assert.match(source,/validateSubmittedMarksCorrection\(original, values, comments, reason\)/);
 assert.match(source,/const changedScores = components\.filter\(component => Number\(values\[component\.id\]\) !== Number\(component\.marksAwarded\)\)/);
 assert.match(source,/scores: changedScores\s*\.map\(component => \(\{componentId: Number\(component\.id\), marksAwarded: values\[component\.id\]\}\)\)/);
 assert.doesNotMatch(source,/return null;/);
 const submit=source.slice(source.indexOf('const submit ='),source.indexOf('const reviewLatest ='));
 assert.doesNotMatch(submit,/catch\s*\(|setConfirmOpen\(false\)/);
});
test('Repair and backup preserve required acknowledgements without another approval stage',()=>{
 const repair=readFileSync(new URL('./WorkflowReconciliationCentre.tsx',import.meta.url),'utf8');
 const backup=readFileSync(new URL('./EvaluationTaskAssignment.tsx',import.meta.url),'utf8');
 assert.match(repair,/expectedFingerprint: preview\.issue\.fingerprint/);
 assert.match(repair,/!reason\.trim\(\) \|\| !confirmed/);
 assert.match(backup,/if \(!backupForm\.confirmed\)/);
 assert.match(backup,/originalTaskId: backupForm\.originalTaskId/);
 const submit=backup.slice(backup.indexOf('const handleBackupSubmit'),backup.indexOf('return (',backup.indexOf('const handleBackupSubmit')));
 assert.doesNotMatch(submit,/catch\s*\(|setDrawerOpen\(false\)|showToast\(/);
});

test('Committed Office decisions require a latest record after refresh failure',()=>{
 const source=readFileSync(new URL('./SubmittedMarksActions.tsx',import.meta.url),'utf8');
 assert.match(source,/setAwaitingLatest\(!!outcome\.refreshFailed\)/);
 assert.match(source,/submitting\.current \|\| awaitingLatest \|\| !eligible/);
 assert.match(source,/await onReload\(\);\s*clearAction\(\);\s*setAwaitingLatest\(false\)/);
 assert.match(source,/awaitingLatest \? <div/);
 assert.match(source,/disabled=\{busy\} onClick=\{\(\) => void reviewLatest\(\)\}/);
});
