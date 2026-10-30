/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Barrel for all shared domain models. Import from '../types' (or './types'
// at the src root), e.g. `import { StudentRecord, DemoUser } from '../types'`.
// This replaces the former single src/types.ts file; existing imports keep
// working because they resolve to this index.

export * from './auth';
export * from './student';
export * from './staffAccount';
export * from './marks';
export * from './appointment';
export * from './file';
export * from './announcement';
export * from './notification';
export * from './timeline';
export * from './letter';
export * from './dashboard';
export * from './workflowReport';
export * from './studentProgress';
export * from './academicSemester';
export * from './participantLifecycle';
export * from './workflowReconciliation';
export * from './lecturerCapacity';
export * from './faq';
export * from './maintenance';
