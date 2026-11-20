import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LecturerDashboardSummaryCards } from './LecturerDashboard';
import type { DashboardSummary } from '../types';

const summary: DashboardSummary = {
  activeSupervisees: 7, activePanelAssignments: 2, assignedMarkTasks: 5,
  pendingSupervisorRequests: 3, pendingPanelReviews: 1,
  pendingSupervisorApprovals: 0, pendingPanelApprovals: 0,
  incompleteMarkEntries: 4, overdueMarkEntries: 0,
  supervisorMarkTasks: 3, panelMarkTasks: 2,
};
const render = (data: DashboardSummary | null, loading = false, error: string | null = null) =>
  renderToStaticMarkup(<LecturerDashboardSummaryCards summary={data} loading={loading} error={error}
    onRetry={()=>{}} onNavigateToTab={()=>{}} />);
const cards = render(summary).split('</button>');
assert.match(cards[0], /Students Under Supervision[\s\S]*card-metric[^>]*>7</);
assert.match(cards[0], /3 pending requests/);
assert.match(cards[1], /My Panel Assignments[\s\S]*card-metric[^>]*>2</);
assert.match(cards[1], /1 pending review/);
assert.match(cards[2], /Assigned Marks Tasks[\s\S]*card-metric[^>]*>5</);
assert.match(cards[2], /3 supervisor, 2 panel\./);
assert.doesNotMatch(render(null,true), /card-metric|0 supervisor/,'Loading must not pretend there are zero tasks');
const failure=render(summary,false,'Dashboard unavailable');
assert.match(failure,/Dashboard unavailable|Retry/);
assert.doesNotMatch(failure,/card-metric/,'A failed refresh must not display stale counts as current');
const empty=render({...summary,activeSupervisees:0,activePanelAssignments:0,assignedMarkTasks:0,pendingSupervisorRequests:0,pendingPanelReviews:0,incompleteMarkEntries:0,supervisorMarkTasks:0,panelMarkTasks:0});
assert.equal((empty.match(/card-metric[^>]*>0</g)??[]).length,3,'A successful empty backend result displays real zeroes');
console.log('Lecturer dashboard assignment counts, separate pending badges and loading/error states passed');
