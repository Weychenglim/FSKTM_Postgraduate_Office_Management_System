import type { EvaluationTask } from '../types';
import type { AppointmentMarkingTarget } from './appointmentMarking';
import { markingRole } from './lecturerMarking';

export function lecturerMarksRoute(path: string): {view:'dashboard'|'history'|'task'|'invalid';taskId?:number} {
  if (path === '/marks') return {view:'dashboard'};
  if (path === '/marks/history') return {view:'history'};
  const match = /^\/marks\/tasks\/([1-9]\d*)$/.exec(path);
  if (match && Number.isSafeInteger(Number(match[1]))) return {view:'task',taskId:Number(match[1])};
  return {view:'invalid'};
}

export function lecturerMarksTaskRoute(taskId: number) { return `/marks/tasks/${taskId}`; }

/** Resolve only records returned by the authenticated Lecturer APIs. */
export function resolveLecturerMarkTask(tasks: EvaluationTask[], id: number, target?: AppointmentMarkingTarget | null) {
  return tasks.find(task => task.id === id && (!target || task.studentId === target.studentId && markingRole(task) === target.role)) ?? null;
}
