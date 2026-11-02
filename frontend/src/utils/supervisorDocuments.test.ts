import assert from 'node:assert/strict';

import type { SupervisorDocumentRequirement } from '../types';
import {
  buildSupervisorApplicationFormData,
  validateSupervisorDocumentSelection,
} from './supervisorDocuments';

const requirements: SupervisorDocumentRequirement[] = [
  {
    id: 1,
    code: 'research-proposal',
    label: 'Research Proposal',
    description: 'Upload the current research proposal.',
    isRequired: true,
    isActive: true,
    displayOrder: 1,
    isUsed: false,
  },
  {
    id: 2,
    code: 'supporting-evidence',
    label: 'Supporting Evidence',
    description: '',
    isRequired: false,
    isActive: true,
    displayOrder: 2,
    isUsed: false,
  },
];

const proposal = new File(['%PDF-1.7\n%%EOF'], 'proposal.pdf', {
  type: 'application/pdf',
});
const invalid = new File(['plain text'], 'notes.txt', { type: 'text/plain' });

assert.match(
  validateSupervisorDocumentSelection(requirements, new Map()),
  /Research Proposal/,
);
assert.match(
  validateSupervisorDocumentSelection(
    requirements,
    new Map([['research-proposal', invalid]]),
  ),
  /PDF or DOCX/,
);
assert.equal(
  validateSupervisorDocumentSelection(
    requirements,
    new Map([['research-proposal', proposal]]),
  ),
  null,
);

const body = buildSupervisorApplicationFormData(
  {
    proposedSupervisorId: 'DEMO-LECT-001',
    researchTitle: 'Private document persistence',
    researchArea: 'Secure Software Engineering',
    researchAbstract: 'A complete research abstract.',
  },
  new Map([['research-proposal', proposal]]),
);
assert.equal(body.get('proposedSupervisorId'), 'DEMO-LECT-001');
assert.equal(body.get('researchArea'), 'Secure Software Engineering');
assert.deepEqual(body.getAll('requirementCodes'), ['research-proposal']);
assert.equal((body.getAll('documents')[0] as File).name, 'proposal.pdf');

const courseBody = buildSupervisorApplicationFormData(
  {
    proposedSupervisorId: 'DEMO-LECT-001',
    researchTitle: 'Manual course codes',
    researchArea: 'Software Engineering',
    researchAbstract: 'A complete research abstract.',
    ...{ projectCourseCodes: '  ABC1234, XYZ9000  ' },
  },
  new Map([['research-proposal', proposal]]),
);
assert.equal(courseBody.get('projectCourseCodes'), 'ABC1234, XYZ9000');
assert.equal(body.get('projectCourseCodes'), '');

console.log('supervisor document utility tests passed');

// Explicit setup permits zero uploads; an untouched configuration still blocks.
assert.equal(validateSupervisorDocumentSelection([], new Map(), true), null);
assert.match(validateSupervisorDocumentSelection([], new Map())!, /not configured/);
assert.match(validateSupervisorDocumentSelection([], new Map([['old', proposal]]), true)!, /Remove previously selected/);
assert.match(validateSupervisorDocumentSelection(requirements, new Map(), true)!, /Research Proposal/);
