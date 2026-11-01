import assert from 'node:assert/strict';
import type { DocumentTypeSetting } from '../types';
import {
  draftFromType,
  keepUploaders,
  NEW_TYPE,
  saveNotices,
  savedMessage,
  toggled,
  typeChanges,
  typeProblem,
  typeSummary,
} from './documentTypeSettings';

const thesis: DocumentTypeSetting = {
  id: 3,
  code: 'thesis',
  label: 'Thesis',
  description: '',
  group: 'RESEARCH_PROJECT',
  groupLabel: 'Research Project',
  kind: 'STUDENT',
  uploaders: ['STUDENT'],
  allowedKinds: ['PDF', 'DOCX'],
  shareSupervisors: true,
  sharePanel: true,
  shareCoordinator: false,
  needsCheck: true,
  onePerStudent: true,
  required: false,
  requiredDueNote: '',
  requiredProgrammes: [],
  isActive: true,
  files: 4,
  studentUploads: 3,
  waiting: 1,
};

assert.equal(typeSummary(draftFromType(thesis)), 'Students upload · seen by supervisors, panel · office checks');
assert.equal(typeSummary({ ...NEW_TYPE, uploaders: ['SUPERVISOR'], shareSupervisors: false }), 'Staff upload · office only');
assert.equal(typeSummary({ ...NEW_TYPE, kind: 'STAFF', uploaders: [] }), 'Office uploads only · uploader picks who sees it');

const draft = draftFromType(thesis);
assert.deepEqual(typeChanges(draft, draft), {}, 'Nothing changed, nothing sent');
assert.deepEqual(typeChanges(draft, { ...draft, sharePanel: false, label: 'Thesis draft' }), { label: 'Thesis draft', sharePanel: false });
assert.deepEqual(typeChanges(draft, { ...draft, uploaders: ['STUDENT', 'SUPERVISOR'] }), { uploaders: ['STUDENT', 'SUPERVISOR'] });

assert.deepEqual(saveNotices(thesis, draft), []);
assert.deepEqual(saveNotices(thesis, { ...draft, sharePanel: false }), ['This also changes who can see the 3 files students already uploaded.']);
assert.deepEqual(saveNotices(thesis, { ...draft, isActive: false, needsCheck: false }), [
  '4 files use this type. They stay, but nobody can choose it for new uploads.',
  '1 file still waits in To check. The PG office can still accept or return it.',
]);
assert.deepEqual(saveNotices({ ...thesis, files: 1 }, { ...draft, isActive: false }), ['1 file uses this type. It stays, but nobody can choose it for new uploads.']);
assert.deepEqual(saveNotices(null, NEW_TYPE), [], 'A new type changes no files');

assert.equal(typeProblem({ ...NEW_TYPE, label: '  ' }, [thesis], null), 'Give the type a name.');
assert.equal(typeProblem({ ...NEW_TYPE, label: 'THESIS' }, [thesis], null), 'There is already a type called Thesis.');
assert.equal(typeProblem({ ...NEW_TYPE, label: 'thesis' }, [thesis], 3), null, 'A type may keep its own name');
assert.equal(typeProblem({ ...NEW_TYPE, label: 'x'.repeat(121) }, [], null), 'Keep the name to 120 characters.');
assert.equal(typeProblem({ ...NEW_TYPE, label: 'Rubric', required: true, uploaders: ['SUPERVISOR'] }, [], null), 'Students must be able to upload a document they have to hand in.');
assert.equal(typeSummary({ ...draftFromType(thesis), required: true, needsCheck: false }), 'Students upload · seen by supervisors, panel · every student hands it in');

assert.deepEqual(keepUploaders(['STUDENT', 'COORDINATOR'], ['LECTURER', 'COORDINATOR']), ['COORDINATOR']);
assert.deepEqual(toggled(['PANEL'], 'STUDENT', ['STUDENT', 'SUPERVISOR', 'PANEL']), ['STUDENT', 'PANEL'], 'Kept in list order');
assert.deepEqual(toggled(['STUDENT', 'PANEL'], 'STUDENT', ['STUDENT', 'PANEL']), ['PANEL']);

assert.equal(savedMessage({ ...thesis, updatedFiles: 2 }, false), 'Saved. 2 files students uploaded now use the new sharing.');
assert.equal(savedMessage({ ...thesis, updatedFiles: 0 }, false), 'Saved "Thesis".');
assert.equal(savedMessage({ ...thesis, updatedFiles: 1 }, false), 'Saved. 1 file students uploaded now uses the new sharing.');
assert.equal(savedMessage(thesis, true), 'Added "Thesis".');

console.log('document type settings tests passed');
