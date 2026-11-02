/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ClosureApproval,
  EvaluationPeriodOption,
  EvaluationRecipientPreview,
  EvaluationPreviewTask,
  EvaluationTask,
  MarkRecord,
  MarkRecordDetail,
  MarksAssignmentOptions,
  RubricComponent,
  RubricVersion,
} from '../types';
import { buildMarkScorePayload } from '../utils/marksProductionManagement';
import { ApiError, request } from './apiClient';

export async function getMarkRecords(): Promise<MarkRecord[]> {
  return request<MarkRecord[]>('/marks/');
}

export async function getMarkRecordById(id: string): Promise<MarkRecordDetail> {
  return request<MarkRecordDetail>(`/marks/records/${encodeURIComponent(id)}/`);
}

export type SubmittedMarksCorrection = {
  expectedVersion: string;
  reason: string;
  scores: Array<{ componentId: number; marksAwarded: string }>;
  comments?: string;
};

export async function correctSubmittedMarkRecord(id: string, payload: SubmittedMarksCorrection): Promise<void> {
  await request(`/marks/records/${encodeURIComponent(id)}/correct/`, {method: 'POST', body: JSON.stringify(payload)});
}

export async function reopenSubmittedMarkRecord(id: string, payload: Pick<SubmittedMarksCorrection, 'expectedVersion' | 'reason'>): Promise<void> {
  await request(`/marks/records/${encodeURIComponent(id)}/reopen/`, {method: 'POST', body: JSON.stringify(payload)});
}

export async function getEvaluationPreviewTasks(): Promise<EvaluationPreviewTask[]> {
  return request<EvaluationPreviewTask[]>('/marks/evaluation-tasks/');
}

export async function getEvaluationPeriods(
  includeArchived = false,
): Promise<EvaluationPeriodOption[]> {
  const query = includeArchived ? '?includeArchived=true' : '';
  return request<EvaluationPeriodOption[]>(`/marks/periods/${query}`);
}

export async function getEvaluationPeriod(
  periodId: number,
): Promise<EvaluationPeriodOption> {
  return request<EvaluationPeriodOption>(`/marks/periods/${periodId}/`);
}

export type EvaluationPeriodPayload = {
  name: string;
  semesterId: number;
  rubricId: number;
  opensAt: string | null;
  closesAt: string | null;
  programmeScope?: 'ALL' | 'SELECTED';
  programmes?: string[];
  evaluatorRoles?: Array<'SUPERVISOR' | 'PANEL'>;
};

export async function getMarksProgrammeOptions(): Promise<string[]> {
  return request<string[]>('/marks/programme-options/');
}

export async function getEvaluationRecipientPreview(periodId: number): Promise<EvaluationRecipientPreview> {
  return request<EvaluationRecipientPreview>(`/marks/periods/${periodId}/recipient-preview/`);
}

export async function createEvaluationPeriod(
  payload: EvaluationPeriodPayload,
): Promise<EvaluationPeriodOption> {
  return request<EvaluationPeriodOption>('/marks/periods/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateEvaluationPeriod(
  periodId: number,
  payload: Partial<EvaluationPeriodPayload> & { reason?: string },
): Promise<EvaluationPeriodOption> {
  return request<EvaluationPeriodOption>(`/marks/periods/${periodId}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function publishEvaluationPeriod(
  periodId: number,
): Promise<EvaluationPeriodOption> {
  return request<EvaluationPeriodOption>(
    `/marks/periods/${periodId}/publish/`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function closeEvaluationPeriod(
  periodId: number,
  reason: string,
  approval?: ClosureApproval,
): Promise<EvaluationPeriodOption> {
  return request<EvaluationPeriodOption>(
    `/marks/periods/${periodId}/close/`,
    { method: 'POST', body: JSON.stringify({ reason, ...approval }) },
  );
}

export async function archiveEvaluationPeriod(
  periodId: number,
  reason: string,
): Promise<EvaluationPeriodOption> {
  return request<EvaluationPeriodOption>(
    `/marks/periods/${periodId}/archive/`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

export async function getRubricVersions(): Promise<RubricVersion[]> {
  return request<RubricVersion[]>('/marks/rubrics/');
}

export async function getRubricVersion(
  rubricId: number,
): Promise<RubricVersion> {
  return request<RubricVersion>(`/marks/rubrics/${rubricId}/`);
}

export type RubricPayload = {
  familyCode: string;
  name: string;
  description: string;
  targetMark: string;
};

export async function createRubricVersion(
  payload: RubricPayload,
): Promise<RubricVersion> {
  return request<RubricVersion>('/marks/rubrics/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateRubricVersion(
  rubricId: number,
  payload: Partial<Omit<RubricPayload, 'familyCode'>> & {
    isActive?: boolean;
  },
): Promise<RubricVersion> {
  return request<RubricVersion>(`/marks/rubrics/${rubricId}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function setRubricFamilyArchived(rubricId: number, archived: boolean): Promise<RubricVersion> {
  return request<RubricVersion>(`/marks/rubrics/${rubricId}/archive/`, {
    method: 'POST', body: JSON.stringify({archived}),
  });
}

export async function cloneRubricVersion(
  rubricId: number,
): Promise<RubricVersion> {
  return request<RubricVersion>(`/marks/rubrics/${rubricId}/clone/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export type RubricComponentPayload = {
  code: string;
  name: string;
  description: string;
  maxMarks: string;
  required: boolean;
  isActive: boolean;
  displayOrder: number;
};

export async function createRubricComponent(
  rubricId: number,
  payload: RubricComponentPayload,
): Promise<RubricComponent> {
  return request<RubricComponent>(
    `/marks/rubrics/${rubricId}/components/`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export async function updateRubricComponent(
  rubricId: number,
  componentId: number,
  payload: Partial<RubricComponentPayload>,
): Promise<RubricComponent> {
  return request<RubricComponent>(
    `/marks/rubrics/${rubricId}/components/${componentId}/`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
}

export async function getRubricComponents(): Promise<RubricComponent[]> {
  const rubrics = await getRubricVersions();
  return rubrics.flatMap((rubric) => rubric.components);
}

export async function getMarksAssignmentOptions(): Promise<MarksAssignmentOptions> {
  return request<MarksAssignmentOptions>('/marks/assignment-options/');
}

export async function generateEvaluationTasks(periodId: number): Promise<{
  createdCount: number;
  supervisorCreatedCount: number;
  panelCreatedCount: number;
  totalCount: number;
}> {
  return request(`/marks/periods/${periodId}/generate-tasks/`, {
    method: 'POST',
  });
}

export async function createBackupEvaluationTask(
  periodId: number,
  payload: {
    studentId: string;
    evaluatorId: number;
    reason: string;
    originalTaskId?: number;
  },
): Promise<EvaluationTask> {
  const created = await request<EvaluationTask>(
    `/marks/periods/${periodId}/manual-overrides/`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return withLegacyRubricFields(created);
}

export async function getEvaluationTasks(): Promise<EvaluationTask[]> {
  const tasks = await request<EvaluationTask[]>('/marks/my-evaluation-tasks/');
  return tasks.map(withLegacyRubricFields);
}

export async function getSubmittedEvaluations(): Promise<EvaluationTask[]> {
  const tasks = await request<EvaluationTask[]>('/marks/my-submitted-evaluations/');
  return tasks.map(withLegacyRubricFields);
}

const legacyScoreFields: Record<string, {
  score: keyof EvaluationTask;
  feedback: keyof EvaluationTask;
}> = {
  problem_definition: {
    score: 'problemDefinitionScore',
    feedback: 'problemDefinitionFeedback',
  },
  literature_review: {
    score: 'literatureReviewScore',
    feedback: 'literatureReviewFeedback',
  },
  methodology: {
    score: 'methodologyScore',
    feedback: 'methodologyFeedback',
  },
  technical_understanding: {
    score: 'technicalUnderstandingScore',
    feedback: 'technicalUnderstandingFeedback',
  },
  presentation: {
    score: 'presentationScore',
    feedback: 'presentationFeedback',
  },
};

function withLegacyRubricFields(task: EvaluationTask): EvaluationTask {
  const normalized: EvaluationTask = { ...task };
  for (const component of task.components || []) {
    const fields = legacyScoreFields[component.code];
    if (!fields) continue;
    (normalized as unknown as Record<string, unknown>)[fields.score] =
      component.marksAwarded === null ? undefined : Number(component.marksAwarded);
    (normalized as unknown as Record<string, unknown>)[fields.feedback] =
      component.feedback;
  }
  return normalized;
}

function taskScores(task: EvaluationTask) {
  // The rubric editor updates components; compatibility aliases are read-only
  // projections of the last API response and must never overwrite new input.
  return buildMarkScorePayload(task.components || []);
}

function taskWriteVersion(task: EvaluationTask): string {
  if (!task.writeVersion || !/^[a-f0-9]{64}$/.test(task.writeVersion)) {
    throw new ApiError('Reload this task before saving or submitting marks.', 409);
  }
  return task.writeVersion;
}

export async function saveMarkDraft(
  task: EvaluationTask,
): Promise<EvaluationTask> {
  if (!task.id) throw new Error('Evaluation task ID is missing.');
  const updated = await request<EvaluationTask>(
    `/marks/tasks/${task.id}/draft/`,
    {
      method: 'PUT',
      body: JSON.stringify({
        expectedVersion: taskWriteVersion(task),
        scores: taskScores(task),
        comments: task.comments || '',
      }),
    },
  );
  return withLegacyRubricFields(updated);
}

export async function submitMarkEntry(
  task: EvaluationTask,
  submissionId: string,
): Promise<EvaluationTask> {
  if (!task.id) throw new Error('Evaluation task ID is missing.');
  if (!submissionId) throw new Error('A submission reference is required. Review and submit again.');
  const submitted = await request<EvaluationTask>(
    `/marks/tasks/${task.id}/submit/`,
    { method: 'POST', body: JSON.stringify({ expectedVersion: taskWriteVersion(task), submissionId, scores: taskScores(task), comments: task.comments || '' }) },
  );
  return withLegacyRubricFields(submitted);
}
