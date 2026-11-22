import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ApiError } from '../services/apiClient';
import {
  buildReconciliationQuery,
  reconciliationErrorMessage,
  reconciliationRecordRoute,
  resolutionPayload,
} from './workflowReconciliation';
import { APP_ROUTES, routeForWorkflowReconciliation } from '../constants/routes';

assert.equal(routeForWorkflowReconciliation(), '/dashboard/workflow-reconciliation');
assert.equal(APP_ROUTES.dashboardWorkflowReconciliation, routeForWorkflowReconciliation());
assert.equal(
  buildReconciliationQuery({
    module: 'MARKS',
    severity: 'BLOCKING',
    repairability: 'REPAIRABLE',
    programme: 'Master of AI',
    search: 'student 1',
    page: 2,
    pageSize: 25,
  }),
  '?module=MARKS&severity=BLOCKING&repairability=REPAIRABLE&programme=Master+of+AI&search=student+1&page=2&pageSize=25',
);
assert.deepEqual(
  resolutionPayload({ action: 'ASSIGN_SEMESTER', label: 'Assign semester', semesterId: 7 }),
  { action: 'ASSIGN_SEMESTER', semesterId: 7 },
);
assert.equal(
  reconciliationErrorMessage(new ApiError('The issue changed after preview.', 409)),
  'The issue changed after preview. Refresh and review it again.',
);
assert.equal(
  reconciliationRecordRoute('MARKS', 'MARKS_TASK', '12'),
  APP_ROUTES.marksTasks,
);

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(
  new URL('../components/WorkflowReconciliationCentre.tsx', import.meta.url),
  'utf8',
);
assert.match(app, /WorkflowReconciliationCentre/);
assert.match(app, /currentUser\.role !== 'Office Staff\/Admin'/);
assert.match(workspace, /repairability === 'REPAIRABLE'/);
assert.match(workspace, /Refer for review/);
assert.match(workspace, /expectedFingerprint/);
assert.match(workspace, /I confirm this individual repair/);

console.log('workflow reconciliation tests passed');
