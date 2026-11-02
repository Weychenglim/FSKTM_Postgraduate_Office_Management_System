import type {
  EvaluationTask,
  EvaluationTaskComponent,
  EvaluationPeriodEffectiveStatus,
  EvaluationPeriodLifecycle,
  MarksAssignmentStudentOption,
} from '../types/marks';

type PeriodTargeting = {
  programmeScope?: string;
  programmes?: string[];
  evaluatorRoles?: Array<'SUPERVISOR' | 'PANEL'>;
};

export function getMarksAssignmentStudents(
  students: MarksAssignmentStudentOption[],
  period: PeriodTargeting | undefined,
): MarksAssignmentStudentOption[] {
  if (!period) return [];
  if (period.programmeScope !== 'SELECTED') return students;
  const programmes = new Set((period.programmes || []).map((programme) => programme.trim().toLocaleLowerCase()));
  return students.filter((student) => programmes.has(student.programme.trim().toLocaleLowerCase()));
}

export function validatePeriodTargeting(target: PeriodTargeting): string | null {
  if (!['ALL', 'SELECTED'].includes(target.programmeScope || '')) return 'Choose a programme scope.';
  if (target.programmeScope === 'SELECTED' && !target.programmes?.length) return 'Select at least one programme.';
  if (!target.evaluatorRoles?.length) return 'Select at least one evaluator role.';
  return null;
}

export function formatPeriodTargeting(target: PeriodTargeting): string {
  const programmes = target.programmeScope === 'SELECTED' ? (target.programmes || []).join(', ') : 'All programmes';
  const roles = (target.evaluatorRoles || ['SUPERVISOR', 'PANEL']).map((role) => role === 'SUPERVISOR' ? 'Supervisor' : 'Panel').join(' and ');
  return `${programmes} · ${roles}`;
}

export type PeriodPreviewApproval = {
  periodId: number;
  formSnapshot: string;
  periodSnapshot: string;
};

export function canPublishPeriodPreview(
  period: { id: number; lifecycleStatus: string } | null,
  formSnapshot: string,
  savedFormSnapshot: string,
  preview: PeriodPreviewApproval | null,
): boolean {
  return Boolean(period && period.lifecycleStatus === 'DRAFT' && preview
    && preview.periodId === period.id
    && formSnapshot === savedFormSnapshot
    && preview.formSnapshot === formSnapshot
    && preview.periodSnapshot === JSON.stringify(period));
}

export function replaceEvaluationTask(
  tasks: EvaluationTask[],
  updatedTask: EvaluationTask,
): EvaluationTask[] {
  return tasks.map((task) => (
    task.id === updatedTask.id ? updatedTask : task
  ));
}

type SetupPeriod = {
  lifecycleStatus: EvaluationPeriodLifecycle | string;
  taskTotals: {
    total: number;
    submitted: number;
    incomplete?: number;
    overdue?: number;
  };
};

type SetupRubric = {
  isArchived?: boolean;
  isReady: boolean;
  isActive: boolean;
};

export type MarksSetupChecklistItem = {
  id: 'period' | 'rubric' | 'tasks' | 'monitor';
  taskName: string;
  status: 'COMPLETED' | 'PENDING';
  actionLabel: string;
};

export type MarksAttentionItem = {
  id: 'overdue' | 'pending' | 'rubric';
  title: string;
  subtext: string;
  count: number;
};

const PERIOD_STATUS_LABELS: Record<EvaluationPeriodEffectiveStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  OPEN: 'Open',
  CLOSED: 'Closed',
  ARCHIVED: 'Archived',
};

export function formatPeriodStatus(
  status: EvaluationPeriodEffectiveStatus,
): string {
  return PERIOD_STATUS_LABELS[status];
}

export function buildMarksSetupChecklist(
  periods: SetupPeriod[],
  rubrics: SetupRubric[],
): MarksSetupChecklistItem[] {
  const currentPeriods = periods.filter(period => period.lifecycleStatus !== 'ARCHIVED');
  const hasPeriod = currentPeriods.length > 0;
  const hasReadyRubric = rubrics.some(
    (rubric) => rubric.isActive && !rubric.isArchived && rubric.isReady,
  );
  const totalTasks = currentPeriods.reduce(
    (total, period) => total + period.taskTotals.total,
    0,
  );
  const submittedTasks = currentPeriods.reduce(
    (total, period) => total + period.taskTotals.submitted,
    0,
  );
  return [
    {
      id: 'period',
      taskName: 'Configure mark entry period',
      status: hasPeriod ? 'COMPLETED' : 'PENDING',
      actionLabel: 'Open',
    },
    {
      id: 'rubric',
      taskName: 'Define rubric components',
      status: hasReadyRubric ? 'COMPLETED' : 'PENDING',
      actionLabel: 'View',
    },
    {
      id: 'tasks',
      taskName: 'Generate evaluation tasks',
      status: totalTasks > 0 ? 'COMPLETED' : 'PENDING',
      actionLabel: 'View',
    },
    {
      id: 'monitor',
      taskName: 'Monitor mark submissions',
      status:
        totalTasks > 0 && submittedTasks === totalTasks
          ? 'COMPLETED'
          : 'PENDING',
      actionLabel: 'Review',
    },
  ];
}

export function buildMarksAttentionItems(
  periods: SetupPeriod[],
  rubrics: SetupRubric[],
): MarksAttentionItem[] {
  const activePeriods = periods.filter(
    (period) => period.lifecycleStatus !== 'ARCHIVED',
  );
  const overdue = activePeriods.reduce(
    (total, period) => total + (period.taskTotals.overdue || 0),
    0,
  );
  const incomplete = activePeriods.reduce(
    (total, period) => total + (
      period.taskTotals.incomplete
      ?? Math.max(period.taskTotals.total - period.taskTotals.submitted, 0)
    ),
    0,
  );
  const unreadyRubrics = rubrics.filter(
    (rubric) => rubric.isActive && !rubric.isArchived && !rubric.isReady,
  ).length;
  return [
    {
      id: 'overdue',
      title: 'Overdue mark submissions',
      subtext: `${overdue} ${overdue === 1 ? 'task' : 'tasks'} past the closing time`,
      count: overdue,
    },
    {
      id: 'pending',
      title: 'Incomplete mark submissions',
      subtext: `${incomplete} ${incomplete === 1 ? 'task' : 'tasks'} not submitted`,
      count: incomplete,
    },
    {
      id: 'rubric',
      title: 'Rubric versions needing work',
      subtext: `${unreadyRubrics} active ${unreadyRubrics === 1 ? 'version' : 'versions'} not ready`,
      count: unreadyRubrics,
    },
  ];
}

export function marksMutationErrorMessage(error: unknown): string {
  if (
    error
    && typeof error === 'object'
    && 'status' in error
    && 'message' in error
  ) {
    const status = Number((error as { status?: unknown }).status);
    const message = (error as { message?: unknown }).message;
    if (
      [400, 403, 404, 409].includes(status)
      && typeof message === 'string'
      && message.trim()
    ) {
      return message;
    }
  }
  return 'Marks configuration could not be saved. Try again.';
}

export { toMalaysiaDateTimeLocalValue as toDateTimeLocalValue } from './malaysiaDateTime';

export function buildMarkScorePayload(
  components: EvaluationTaskComponent[],
): Array<{
  componentId: number;
  marksAwarded: number;
  feedback: string;
}> {
  return components.flatMap((component) => {
    if (component.marksAwarded === null) return [];
    return [{
      componentId: component.id,
      marksAwarded: Number(component.marksAwarded),
      feedback: component.feedback || '',
    }];
  });
}
