import assert from 'node:assert/strict';
import { audiencesOf, toggleAudience } from './announcementAudience';

// picking a group replaces Everyone, and groups add up in a fixed order
assert.deepEqual(toggleAudience(['All'], 'Lecturers'), ['Lecturers']);
assert.deepEqual(toggleAudience(['Lecturers'], 'All Students'), ['All Students', 'Lecturers']);
assert.deepEqual(toggleAudience(['All Students', 'Lecturers'], 'Coordinators'), ['All Students', 'Lecturers', 'Coordinators']);

// nothing is chosen at first; removing a group keeps the rest, and removing the last leaves nothing
assert.deepEqual(toggleAudience([], 'Staff'), ['Staff']);
assert.deepEqual(toggleAudience(['All Students', 'Lecturers'], 'All Students'), ['Lecturers']);
assert.deepEqual(toggleAudience(['Lecturers'], 'Lecturers'), []);

// Everyone stands alone, and clicking it again clears it
assert.deepEqual(toggleAudience(['All Students', 'Staff'], 'All'), ['All']);
assert.deepEqual(toggleAudience([], 'All'), ['All']);
assert.deepEqual(toggleAudience(['All'], 'All'), []);

// older rows have only a target
assert.deepEqual(audiencesOf({ target: 'Staff' }), ['Staff']);
assert.deepEqual(audiencesOf({ target: 'Staff', audiences: [] }), ['Staff']);
assert.deepEqual(audiencesOf({ target: 'All Students', audiences: ['All Students', 'Staff'] }), ['All Students', 'Staff']);
