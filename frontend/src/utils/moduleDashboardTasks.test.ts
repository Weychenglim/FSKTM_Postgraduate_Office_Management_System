import assert from 'node:assert/strict';
import type { DashboardTask } from '../types/dashboard';
import type { OfficeAttentionRecord, OfficeAttentionSummary } from '../services/officeAttentionApi';
import { officeAttentionCategoryRoute, officeAttentionRecordRoute } from './officeAttention';
import { resolveDashboardTaskRoute } from './workflowAgeing';

const task = (targetModule: DashboardTask['targetModule'], recordType: string, target: string): DashboardTask => ({
  id: 'x', name: 'x', status: 'pending', statusText: '', target, targetModule, recordType,
});

assert.equal(resolveDashboardTaskRoute(task('FILES', 'SUBMISSION', 'File Submission')), '/files');
assert.equal(resolveDashboardTaskRoute(task('REGISTRY', 'PROJECT_STAGE', 'Registry Management')), '/registry/project-stages');
assert.equal(resolveDashboardTaskRoute(task('LETTERS', 'LETTER_REQUESTS', 'Letter Generation')), '/letters/requests');
assert.equal(resolveDashboardTaskRoute(task('FAQ', 'FAQ_QUESTIONS', 'FAQ Chatbot')), '/faq/questions');

const group = (category: OfficeAttentionSummary['category']) => ({ category, responsibility: 'review' } as OfficeAttentionSummary);
assert.equal(officeAttentionCategoryRoute(group('letters')), '/letters/requests');
assert.equal(officeAttentionCategoryRoute(group('questions')), '/faq/questions');
assert.equal(officeAttentionCategoryRoute(group('panel')), '/dashboard/attention?category=panel&responsibility=review');

const row = (category: OfficeAttentionRecord['category'], recordType: string) => ({ category, recordType } as OfficeAttentionRecord);
assert.equal(officeAttentionRecordRoute(row('letters', 'LETTER_REQUESTS')), '/letters/requests');
assert.equal(officeAttentionRecordRoute(row('questions', 'FAQ_QUESTIONS')), '/faq/questions');
assert.equal(officeAttentionRecordRoute(row('panel', 'OTHER')), '/panel-appointments');

console.log('Dashboard tasks from Letters, Files, Registry and the FAQ open their own pages');
