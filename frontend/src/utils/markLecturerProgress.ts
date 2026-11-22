import type { EvaluationRecipientPreview, EvaluationTaskRole, MarkRecord, MarkRecordPeriod } from '../types';

export interface LecturerMarkTask {
  studentId: string;
  studentName: string;
  role?: EvaluationTaskRole;
  status: string;
  recordId?: string;
  dueAt?: string | null;
  countsTowardsProgress: boolean;
  submitted: boolean;
}

export interface LecturerMarkPeriod {
  period: MarkRecordPeriod;
  tasks: Map<string, LecturerMarkTask>;
}

export interface LecturerMarkProgress {
  id: string;
  name: string;
  periods: Map<number, LecturerMarkPeriod>;
}

export function buildLecturerMarkProgress(periods: MarkRecordPeriod[], records: MarkRecord[], previews: EvaluationRecipientPreview[]) {
  const periodById = new Map(periods.map(period => [period.id, period]));
  const lecturers = new Map<string, LecturerMarkProgress>();
  const getTasks = (period: MarkRecordPeriod, name: string, evaluatorId?: number) => {
    const id = evaluatorId == null ? `name:${name}` : String(evaluatorId);
    let lecturer = lecturers.get(id);
    if (!lecturer) {
      lecturer = { id, name, periods: new Map() };
      lecturers.set(id, lecturer);
    }
    let group = lecturer.periods.get(period.id);
    if (!group) {
      group = { period, tasks: new Map() };
      lecturer.periods.set(period.id, group);
    }
    return group.tasks;
  };

  for (const record of records) {
    const period = record.periodId == null ? undefined : periodById.get(record.periodId);
    const review = record.stageReviewRequired || record.status === 'Review Required';
    const retired = record.taskLifecycleStatus === 'RETIRED';
    const submitted = record.status === 'Submitted';
    if (!period) continue;
    const tasks = getTasks(period, record.panelMember, record.evaluatorId);
    const historyOnly = retired && !review && !submitted;
    const assignmentKey = `${record.studentId}|${record.evaluatorRole}`;
    const key = historyOnly ? `${assignmentKey}|retired` : assignmentKey;
    const paused = record.taskLifecycleStatus === 'PAUSED';
    const status = review ? 'Stage review' : historyOnly ? 'Retired' : paused ? 'Paused' : submitted ? 'Submitted'
      : ['CLOSED', 'ARCHIVED'].includes(period.effectiveStatus) && !record.hasActiveCompletionWindow ? 'Closed unfinished'
        : record.status === 'Draft' ? 'Draft saved' : record.status;
    const task = {
      studentId: record.studentId, studentName: record.studentName, role: record.evaluatorRole,
      status, recordId: record.id, dueAt: record.effectiveDueAt ?? record.dueAt,
      countsTowardsProgress: !historyOnly && !paused && (!review || submitted), submitted,
    };
    if (!tasks.has(key) || (!paused && !retired)) tasks.set(key, task);
  }

  for (const preview of previews) {
    const period = periodById.get(preview.periodId);
    if (!period || !['OPEN', 'SCHEDULED'].includes(period.effectiveStatus)) continue;
    for (const recipient of preview.recipients) {
      if (recipient.taskStatus === 'EXISTING') continue;
      const tasks = getTasks(period, recipient.evaluatorName, recipient.evaluatorId);
      const key = `${recipient.matricNo}|${recipient.evaluatorRole}`;
      if (tasks.has(key) || (recipient.taskStatus === 'BLOCKED' && tasks.has(`${key}|retired`))) continue;
      const missing = recipient.taskStatus === 'NEW';
      tasks.set(key, {
        studentId: recipient.matricNo, studentName: recipient.studentName, role: recipient.evaluatorRole,
        status: missing ? 'Task missing' : recipient.taskStatus === 'PAUSED' ? 'Paused' : 'Stage review',
        countsTowardsProgress: missing, submitted: false,
      });
    }
  }
  return [...lecturers.values()];
}

export function lecturerTaskCounts(tasks: LecturerMarkTask[]) {
  const progress = tasks.filter(task => task.countsTowardsProgress);
  return {
    total: progress.length,
    submitted: progress.filter(task => task.submitted).length,
    missing: tasks.filter(task => task.status === 'Task missing').length,
    overdue: tasks.filter(task => task.status === 'Overdue').length,
    review: tasks.filter(task => task.status === 'Stage review').length,
    paused: tasks.filter(task => task.status === 'Paused').length,
    closed: tasks.filter(task => task.status === 'Closed unfinished').length,
  };
}
