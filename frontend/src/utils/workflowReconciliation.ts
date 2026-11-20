import type {
  ReconciliationAllowedResolution,
  ReconciliationFilters,
  ReconciliationResolution,
  ReconciliationIssue,
} from '../types';
import { ApiError } from '../services/apiClient';
import { officeMarksDeadlineRoute } from './officeDashboard';
import { marksConfigurationRoute } from './periodPresentation';
import {
  APP_ROUTES,
  routeForMarkRecord,
  routeForPanelRecord,
  routeForStaffAccount,
  routeForStudentProgress,
  routeForSupervisorApplication,
  routeForSupervisorResearchRequest,
  routeForSupervisorSupervisee,
  routeForSupportingSupervisorRequest,
} from '../constants/routes';

export const buildReconciliationQuery = (filters: ReconciliationFilters): string => {
  const params = new URLSearchParams();
  if (filters.reviewStatus) params.set('reviewStatus', filters.reviewStatus);
  if (filters.module) params.set('module', filters.module);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.repairability) params.set('repairability', filters.repairability);
  if (filters.programme) params.set('programme', filters.programme);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 25));
  return `?${params.toString()}`;
};

export const resolutionPayload = (
  resolution: ReconciliationAllowedResolution,
  programme?: string,
): ReconciliationResolution => ({
  action: resolution.action,
  ...(resolution.semesterId ? { semesterId: resolution.semesterId } : {}),
  ...(resolution.requiresProgramme && programme ? { programme } : {}),
});

export const reconciliationErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.status === 409) {
    return error.message.includes('changed after preview')
      ? 'The issue changed after preview. Refresh and review it again.'
      : error.message;
  }
  return error instanceof Error ? error.message : 'Unable to complete reconciliation.';
};

export const reconciliationRecordRoute = (
  targetModule?: string,
  recordType?: string,
  recordId?: string,
): string | null => {
  if (!recordId) return null;
  if (targetModule === 'SUPERVISOR_APPOINTMENTS' && recordType === 'SUPERVISOR_APPLICATION') {
    return routeForSupervisorApplication(`request-${recordId}`);
  }
  if (targetModule === 'SUPERVISOR_APPOINTMENTS' && recordType === 'RESEARCH_AMENDMENT') {
    return routeForSupervisorResearchRequest(recordId);
  }
  if (targetModule === 'PANEL_APPOINTMENTS' && recordType === 'PANEL_RECOMMENDATION') {
    return routeForPanelRecord(`recommendation-${recordId}`);
  }
  if (targetModule === 'PANEL_APPOINTMENTS' && recordType === 'PANEL_APPOINTMENT' && /^\d+$/.test(recordId)) {
    return routeForPanelRecord(`appointment-${recordId}`);
  }
  if (targetModule === 'MARKS') {
    if (recordType === 'EVALUATION_PERIOD') return APP_ROUTES.marksConfig;
    if (recordType === 'MARKS_TASK' || recordType === 'EVALUATION_TASK') return APP_ROUTES.marksTasks;
    return recordType === 'MARK_RECORD'
      ? routeForMarkRecord(recordId)
      : APP_ROUTES.marks;
  }
  if (targetModule === 'DASHBOARD' && recordType === 'TIMELINE_ENTRY') {
    return APP_ROUTES.dashboardTimeline;
  }
  if (targetModule === 'DASHBOARD' && recordType === 'SEMESTER_TIMELINE') return APP_ROUTES.dashboardTimeline;
  return null;
};

const capacityIssueTypes = new Set(['CAPACITY_PLAN_MISSING', 'CAPACITY_MULTIPLE_PUBLISHED', 'CAPACITY_PLAN_INCOMPLETE', 'CAPACITY_ENTRY_ROLE_MISMATCH', 'CAPACITY_LEGACY_LIMIT_DIVERGENCE', 'CAPACITY_AVAILABILITY_OVERLAP']);

export function reconciliationOwningRoute(issue: ReconciliationIssue) {
  const recovery = reconciliationMarksRecovery(issue);
  if (recovery) return recovery.route;
  const state = issue.currentState ?? {};
  if (capacityIssueTypes.has(issue.issueType)) {
    const params = new URLSearchParams();
    const { semesterId, staffNo } = state;
    if (typeof semesterId === 'number' && Number.isSafeInteger(semesterId) && semesterId > 0) params.set('semester', String(semesterId));
    if (issue.issueType === 'CAPACITY_AVAILABILITY_OVERLAP') params.set('view', 'availability');
    if (issue.issueType === 'CAPACITY_MULTIPLE_PUBLISHED') params.set('view', 'history');
    if (typeof staffNo === 'string' && staffNo) params.set('lecturer', staffNo);
    return params.size ? `${APP_ROUTES.dashboardLecturerCapacity}?${params}` : APP_ROUTES.dashboardLecturerCapacity;
  }
  if (issue.module === 'MARKS' && issue.recordType === 'EVALUATION_TASK' && /^\d+$/.test(issue.recordId)) {
    return routeForMarkRecord(`MRK-${issue.recordId.padStart(5, '0')}`);
  }
  if (issue.module === 'MARKS' && issue.recordType === 'EVALUATION_PERIOD' && typeof state.semesterId === 'number' && /^\d+$/.test(issue.recordId)) {
    return marksConfigurationRoute(state.semesterId, Number(issue.recordId));
  }
  if (issue.recordType === 'RESEARCH_PROFILE' && issue.studentId && state.studentUserId !== null
    && issue.issueType !== 'RESEARCH_PROFILE_IDENTITY_MISMATCH') return routeForStudentProgress(issue.studentId);
  if (issue.recordType === 'CO_SUPERVISOR_NOMINATION') return routeForSupportingSupervisorRequest(issue.recordId);
  if (issue.recordType === 'CO_SUPERVISOR_APPOINTMENT' && typeof state.sourceId === 'number') return routeForSupportingSupervisorRequest(String(state.sourceId));
  if (['CO_SUPERVISOR_APPOINTMENT', 'CO_SUPERVISOR_TEAM'].includes(issue.recordType) && issue.studentId) return routeForSupervisorSupervisee(issue.studentId);
  if (['COORDINATOR_PROFILE_MISSING', 'COORDINATOR_PROGRAMME_MISSING', 'COORDINATOR_ROLE_MISMATCH'].includes(issue.issueType)
    && typeof state.userId === 'number') return routeForStaffAccount(String(state.userId));
  if (issue.issueType === 'PROGRAMME_COORDINATOR_UNAVAILABLE') return APP_ROUTES.registryStaff;
  return reconciliationRecordRoute(issue.navigation.targetModule, issue.navigation.recordType, issue.navigation.recordId);
}

export function reconciliationMarksRecovery(issue: ReconciliationIssue) {
  const state = issue.currentState;
  if (issue.issueType !== 'MARKS_TASK_INCONSISTENT' || state.closedWithUnfinishedWork !== true || !/^\d+$/.test(issue.recordId)) return null;
  const { periodId, semesterId } = state;
  const canGrant = state.canGrantCompletionWindow === true && typeof periodId === 'number' && typeof semesterId === 'number';
  return canGrant
    ? { route: officeMarksDeadlineRoute({ id: periodId, semesterId }, Number(issue.recordId)), canGrant }
    : { route: routeForMarkRecord(`MRK-${issue.recordId.padStart(5, '0')}`), canGrant };
}

const sentenceLabel = (value: string) => {
  const label = value.toLowerCase().replaceAll('_', ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export function reconciliationIdentity(issue: ReconciliationIssue) {
  const state = issue.currentState;
  const reference = `${sentenceLabel(issue.recordType)} #${issue.recordId}`;
  const name = String(state.lecturerName || issue.studentId || state.semesterLabel || state.recordedSemester || reference);
  const context = [state.staffNo, state.semesterLabel !== name ? state.semesterLabel : state.semesterCode,
    state.planVersion != null ? `Version ${state.planVersion}` : null].filter(Boolean).join(' · ');
  return {
    name,
    context: context || [issue.programme, name === reference ? null : reference].filter(Boolean).join(' · '),
  };
}

/** Keep the list scannable; the review page retains the full title and explanation. */
export function reconciliationListSummary(issue: ReconciliationIssue) {
  switch (issue.issueType) {
    case 'CAPACITY_ENTRY_ROLE_MISMATCH':
      return { title: 'Capacity roles differ', fact: '' };
    case 'SEMESTER_UNASSIGNED':
      return { title: 'Semester not linked', fact: '' };
    case 'CAPACITY_PLAN_MISSING':
      return { title: 'No capacity plan', fact: '' };
    case 'CAPACITY_LEGACY_LIMIT_DIVERGENCE': {
      const state = issue.currentState;
      const fact = [['Supervisor', 'supervisorLimit', 'legacySupervisorLimit'], ['Panel', 'panelLimit', 'legacyPanelLimit']]
        .filter(([, current, legacy]) => state[current] != null && state[current] !== state[legacy])
        .map(([role, current, legacy]) => `${role}: ${state[current]} vs ${state[legacy] ?? 'not set'} (old)`)
        .join(' · ');
      return { title: 'Capacity limits differ', fact };
    }
    default:
      return { title: issue.title, fact: '' };
  }
}

export function reconciliationRepairDetails(issue: ReconciliationIssue, resolution: ReconciliationAllowedResolution | null, programme = '') {
  const details: { label: string; value: string }[] = [];
  if (resolution?.action === 'ASSIGN_SEMESTER') details.push({ label: 'Assign to semester',
    value: [issue.suggestion.semesterLabel || `Semester #${resolution.semesterId}`, issue.suggestion.semesterCode].filter(Boolean).join(' · '),
  });
  if (resolution?.action === 'COPY_CAPACITY_PLAN') {
    details.push({ label: 'Create draft for', value: String(issue.currentState.semesterLabel || `Semester #${issue.recordId}`) });
    details.push({ label: 'Copy from', value: [issue.suggestion.sourceSemesterLabel || `Capacity plan #${issue.suggestion.sourcePlanId}`,
      issue.suggestion.sourcePlanVersion != null ? `Version ${issue.suggestion.sourcePlanVersion}` : null].filter(Boolean).join(' · '),
    });
  }
  if (resolution?.requiresProgramme && programme) details.push({ label: 'Managed programme', value: programme });
  return details;
}

/** Explanations describe existing server checks; they never decide repair eligibility. */
export function reconciliationExplanation(issue: ReconciliationIssue) {
  const state = issue.currentState;
  const repairable = issue.repairability === 'REPAIRABLE';
  let why = issue.summary;
  let effect = issue.severity === 'BLOCKING'
    ? 'This inconsistency can prevent the affected workflow from completing correctly.'
    : 'This record needs review; the warning does not itself change workflow access.';
  let next = repairable
    ? 'Review the proposed repair below. Applying it requires a reason and confirmation.'
    : 'Send the affected record reference and the evidence on this page to the system administrator for review.';
  let actionLabel = 'Open source record';
  if (issue.recordType === 'EVALUATION_PERIOD') actionLabel = 'Open evaluation period settings';
  if (issue.recordType === 'RESEARCH_PROFILE') actionLabel = 'Open student progress record';
  if (issue.recordType === 'SUPERVISOR_APPLICATION') actionLabel = 'View Supervisor application';
  if (issue.recordType === 'PANEL_RECOMMENDATION') actionLabel = 'View Panel recommendation';
  if (issue.recordType === 'SEMESTER_TIMELINE' || issue.recordType === 'TIMELINE_ENTRY') actionLabel = 'Open Timeline';
  if (issue.issueType.startsWith('CAPACITY_')) actionLabel = 'Review capacity limits';
  switch (issue.issueType) {
    case 'CAPACITY_LEGACY_LIMIT_DIVERGENCE': {
      const differences = [['Supervisor', 'supervisorLimit', 'legacySupervisorLimit'], ['Panel', 'panelLimit', 'legacyPanelLimit']]
        .filter(([, current, legacy]) => state[current] != null && state[current] !== state[legacy])
        .map(([role, current, legacy]) => `${role}: ${state[current]} in the published semester policy versus ${state[legacy] ?? 'not set'} in the old lecturer profile`);
      why = differences.length ? `${differences.join('. ')}.` : issue.summary;
      effect = 'The published semester limits remain in force. A different old profile value does not make the semester policy invalid.';
      next = 'Check whether the difference is intentional. Do not change approved semester limits just to match an older profile. This check offers no automatic repair.';
      break;
    }
    case 'SEMESTER_UNASSIGNED':
      why = 'This saved record is not linked to an academic semester. A typed semester name alone does not create that link.';
      effect = 'Semester-specific lists and reports may omit this record until it is linked.';
      next = issue.repairability === 'REPAIRABLE'
        ? 'One semester matches all available label and date evidence. Review that assignment below.'
        : 'There is no single verified semester match. Review the recorded label and dates with a system administrator before linking this record.';
      break;
    case 'CAPACITY_PLAN_MISSING':
      why = 'This semester has no saved capacity plan.';
      effect = state.lifecycleStatus === 'DRAFT'
        ? 'A complete published policy is needed before semester activation.'
        : 'Lecturer capacity cannot be resolved from a published policy for this semester.';
      next = issue.repairability === 'REPAIRABLE'
        ? 'The repair copies the single verified earlier published policy into a draft. Review the limits separately before you publish it.'
        : 'Prepare a capacity draft in Lecturer capacity, review the limits, then publish it through the normal approval flow.';
      break;
    case 'CAPACITY_MULTIPLE_PUBLISHED':
      effect = 'More than one policy claims to supply the semester limits.';
      next = 'Review the publication history with a system administrator. Do not delete versions or overwrite published history.';
      actionLabel = 'Review capacity versions';
      break;
    case 'CAPACITY_PLAN_INCOMPLETE':
      effect = 'The published policy does not cover all required lecturer roles or limits.';
      next = 'Review the listed readiness problems in Lecturer capacity and prepare the necessary policy revision.';
      break;
    case 'CAPACITY_ENTRY_ROLE_MISMATCH':
      effect = 'The saved limits no longer align with the lecturer’s current Supervisor or Panel roles.';
      next = 'Check the lecturer roles and the policy version. Preserve historical versions; use the capacity workflow for any revision.';
      break;
    case 'CAPACITY_AVAILABILITY_OVERLAP':
      why = 'Two uncancelled availability restrictions cover overlapping dates for the same lecturer, semester and role.';
      effect = 'The restrictions duplicate part of the same date range.';
      next = 'Compare both restrictions and their reasons. For a current or scheduled restriction, ask the lecturer to cancel the duplicate in My availability. For historical records requiring correction, send the role and dates to a system administrator.';
      actionLabel = 'Review lecturer availability';
      break;
    case 'MARKS_TASKS_MISSING':
      effect = 'Some eligible evaluators have no active task in this open evaluation period.';
      next = 'Review the affected period and missing evaluator assignments, then generate the missing eligible tasks using the repair below.';
      break;
    case 'MARKS_TASK_INCONSISTENT': {
      const recovery = reconciliationMarksRecovery(issue);
      if (!recovery) {
        actionLabel = 'View Marks record';
        if (repairable) next = 'Review the task and the proposed lifecycle change below. The repair records the decision and preserves existing assessment evidence.';
        break;
      }
      effect = 'The evaluator needs individual extra time before they can submit these marks.';
      if (recovery.canGrant) {
        next = 'If the evaluation should still be submitted, set a new deadline for this evaluator’s task.';
        actionLabel = 'Grant individual extra time';
      } else {
        effect = 'Submissions are closed for this task.';
        next = typeof state.completionWindowBlocker === 'string' ? state.completionWindowBlocker : issue.summary;
        actionLabel = 'View Marks record';
      }
      break;
    }
    case 'MARKS_STAGE_REVIEW':
      why = 'This evaluation was flagged for review against the student’s RP Registration.';
      effect = 'The Programme Coordinator may need to confirm how this evaluation should be handled.';
      next = repairable
        ? 'Check the student’s RP Registration for the evaluation’s semester and compare it with the Marks record before applying the available action.'
        : 'Use the semester on the Marks record to check the student in RP Registration. If the stage needs correcting, ask the Programme Coordinator to correct it. If the stage is correct, ask the Coordinator to review the evaluation.';
      actionLabel = 'View Marks record';
      break;
    case 'SUPERVISOR_HANDOFF_INCOMPLETE':
    case 'PANEL_HANDOFF_INCOMPLETE':
      effect = 'The approved request has not produced its final appointment record.';
      actionLabel = issue.issueType === 'SUPERVISOR_HANDOFF_INCOMPLETE' ? 'View Supervisor application' : 'View Panel recommendation';
      next = repairable
        ? 'Verify the original Coordinator approval, then use the repair below to create the final appointment from that approval.'
        : 'Open the approved request and check the blocker below. Recheck this finding once the prerequisite has been resolved.';
      break;
    case 'APPOINTMENT_LINEAGE_INCONSISTENT':
      effect = 'The saved appointment and its approval or replacement history disagree.';
      next = 'Compare the appointment and approval history. Send the appointment reference and the discrepancies shown here to a system administrator for a controlled correction.';
      actionLabel = issue.recordType === 'PANEL_APPOINTMENT' ? 'View Panel appointment' : 'View Supervisor application';
      break;
    case 'CO_SUPERVISOR_HANDOFF_MISSING':
    case 'CO_SUPERVISOR_RECORD_INCONSISTENT':
      next = 'Review the nomination and its decision history. Send the references and discrepancies shown here to the system administrator for a controlled correction.';
      actionLabel = 'View co-supervisor nomination';
      break;
    case 'CO_SUPERVISOR_PRIMARY_INCONSISTENT':
      next = 'Compare the nomination with the student’s current supervisory team. Ask the active primary Supervisor and Programme Coordinator to review the pending nomination.';
      actionLabel = 'View co-supervisor nomination';
      break;
    case 'CO_SUPERVISOR_PANEL_OVERLAP':
    case 'CO_SUPERVISOR_PRIMARY_OVERLAP':
    case 'CO_SUPERVISOR_TEAM_INCONSISTENT':
      next = 'Verify the current team and pending requests with the Programme Coordinator. Use the appointment or request workflow to record any approved correction, then recheck this finding.';
      actionLabel = issue.recordType === 'CO_SUPERVISOR_NOMINATION' ? 'View co-supervisor nomination' : 'View supervisory team';
      break;
    case 'COORDINATOR_PROFILE_MISSING':
    case 'COORDINATOR_PROGRAMME_MISSING':
      effect = 'The Coordinator cannot receive programme-specific workflow decisions until the assignment is valid.';
      next = repairable
        ? 'Verify the staff account and intended programme, then select that managed programme in the repair below.'
        : 'Check the staff account and ask the registry administrator to verify the Coordinator duty and managed programme.';
      actionLabel = 'Review staff account';
      break;
    case 'COORDINATOR_ROLE_MISMATCH':
      effect = 'The profile alone cannot grant access to programme decisions.';
      next = 'In the staff account, review Duties and the managed programme. Ask the registry administrator to reconcile the portal role with the approved Coordinator assignment.';
      actionLabel = 'Review staff account';
      break;
    case 'PROGRAMME_COORDINATOR_UNAVAILABLE':
      effect = 'Pending Supervisor or Panel requests cannot reach a valid Coordinator for this programme.';
      next = 'Open Staff accounts and ask the registry administrator to verify the programme has an eligible Coordinator with sign-in access. Recheck after the assignment is corrected.';
      actionLabel = 'Open Staff accounts';
      break;
    case 'RESEARCH_AMENDMENT_STALE':
      effect = 'The pending request refers to an older research record or supervisory team.';
      next = 'Open the amendment and compare it with the current approved record. If the request is stale, use Cancel request and record why. Ask the original submitter to submit a fresh request.';
      actionLabel = 'View research amendment';
      break;
    case 'RESEARCH_PROFILE_UNLINKED':
      effect = 'The Student account and the approved research record cannot be checked together.';
      next = repairable
        ? 'Verify that the matched Student account belongs to this matric number, then confirm the link below.'
        : 'Ask Registry Management to verify ownership using the matric number and existing profile links. Include this issue’s references and any downstream records already using the profile.';
      break;
    case 'RESEARCH_PROFILE_IDENTITY_MISMATCH':
      effect = 'The profile is linked to a different matric identity or its linked Student record is missing.';
      next = 'Ask Registry Management to verify both identities and confirm ownership with a system administrator before changing either record.';
      break;
    case 'RESEARCH_PROGRAMME_MISMATCH':
      effect = 'The Registry and the approved research profile show different programmes.';
      next = 'Compare the programme records and approved transfer history. Ask Registry Management and the Programme Coordinator to verify which programme is authoritative.';
      break;
    case 'RESEARCH_REVISION_CHAIN_BROKEN':
      effect = 'The saved research record cannot be traced through a complete revision history.';
      next = 'Review the student’s approved research history. Send the profile reference and the listed revision numbers to the system administrator.';
      break;
    case 'RESEARCH_PROFILE_SUPERVISOR_MISMATCH':
      effect = 'The research profile names a different Supervisor from the sole active appointment.';
      next = 'Verify the active Supervisor appointment, then confirm the proposed profile correction below.';
      break;
  }
  return { why, effect, next, actionLabel };
}
