import type { ResearchAmendment } from '../services/researchAmendmentsApi';
import type { ProgrammeCoordinators } from '../services/programmeTransfersApi';
import { historyTime } from './documentDisplay';

export type CoordinatorDirectory = Record<string, string[]>;
type Tone = 'success' | 'warning' | 'danger' | 'neutral';

const keyOf = (programme: string) => programme.trim().toLocaleLowerCase();
const SMALL_WORDS = new Set(['of', 'and', 'in', 'the', 'by']);

export function coordinatorDirectory(rows: ProgrammeCoordinators): CoordinatorDirectory {
  return Object.fromEntries(rows.map(row => [keyOf(row.programme), row.coordinators]));
}

export const coordinatorsOf = (directory: CoordinatorDirectory, programme: string): string[] => directory[keyOf(programme)] ?? [];

/** "MASTER OF DATA SCIENCE (COURSEWORK)" becomes "Data Science", for narrow columns. */
export function shortProgramme(programme: string): string {
  const core = programme.trim().replace(/^master of\s+/i, '').replace(/\s*\(.*\)\s*$/, '');
  if (!core) return programme;
  return core.toLowerCase().split(/\s+/).map((word, index) => (index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))).join(' ');
}

export const namesText = (names: string[]): string =>
  names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;

export const isPendingTransfer = (row: Pick<ResearchAmendment, 'status'>): boolean =>
  row.status === 'PENDING_SOURCE_COORDINATOR' || row.status === 'PENDING_DESTINATION_COORDINATOR';

/** Whose coordinator decides now: the current programme's or the new one's. */
export const waitingProgramme = (row: Pick<ResearchAmendment, 'status' | 'sourceProgramme' | 'destinationProgramme'>): string =>
  row.status === 'PENDING_DESTINATION_COORDINATOR' ? row.destinationProgramme : row.sourceProgramme;

export function waitingForText(row: ResearchAmendment, directory: CoordinatorDirectory): string {
  if (row.canDecide) return 'Waiting for you';
  const names = coordinatorsOf(directory, waitingProgramme(row));
  return names.length ? `Waiting for ${namesText(names)}` : 'Waiting for a programme coordinator';
}

export const stageText = (row: Pick<ResearchAmendment, 'status'>): string =>
  row.status === 'PENDING_DESTINATION_COORDINATOR' ? 'New programme coordinator' : 'Current programme coordinator';

/** When the request reached the step it is waiting at. */
export function stageSince(row: ResearchAmendment): string {
  const reached = [...row.events].reverse().find(event => event.newStatus === row.status && event.previousStatus !== event.newStatus);
  return reached?.createdAt ?? row.createdAt;
}

export function daysSince(value: string, now = Date.now()): number {
  const started = Date.parse(value);
  return Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 86_400_000)) : 0;
}

export const daysText = (days: number): string => (days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`);

const findEvent = (row: ResearchAmendment, actions: string[]) => row.events.find(event => actions.includes(event.action));

/** A finished transfer's outcome, or null while it is still waiting. */
export function transferOutcome(row: ResearchAmendment): { label: string; tone: Tone; at: string; reason: string } | null {
  if (row.status === 'APPROVED') {
    const event = findEvent(row, ['APPROVE']);
    return { label: 'Transferred', tone: 'success', at: event?.createdAt ?? row.updatedAt, reason: '' };
  }
  if (row.status === 'REJECTED') {
    const event = findEvent(row, ['REJECT']);
    return { label: `Rejected by ${event?.actorName ?? 'a coordinator'}`, tone: 'danger', at: event?.createdAt ?? row.updatedAt, reason: event?.reason ?? '' };
  }
  if (row.status === 'CANCELLED') {
    const event = findEvent(row, ['CANCEL', 'SYSTEM_CANCEL']);
    const who = event?.action === 'SYSTEM_CANCEL' ? 'Cancelled automatically' : `Cancelled by ${event?.actorName ?? 'the office'}`;
    return { label: who, tone: 'neutral', at: event?.createdAt ?? row.updatedAt, reason: event?.reason ?? '' };
  }
  return null;
}

export type TransferStepState = 'done' | 'now' | 'next' | 'skipped' | 'rejected' | 'stopped';
export interface TransferStep { key: 'requested' | 'current' | 'new' | 'transferred'; label: string; state: TransferStepState; detail: string; note?: string }

const by = (event: { actorName: string; createdAt: string }) => `${event.actorName}, ${historyTime(event.createdAt)}`;

/** The four steps of a transfer, from the request to the change of programme. */
export function transferSteps(row: ResearchAmendment, directory: CoordinatorDirectory): TransferStep[] {
  const submitted = findEvent(row, ['SUBMIT', 'SUBMITTED']);
  const endorsed = findEvent(row, ['ENDORSE']);
  const approved = findEvent(row, ['APPROVE']);
  const rejected = findEvent(row, ['REJECT']);
  const cancelled = findEvent(row, ['CANCEL', 'SYSTEM_CANCEL']);
  const skipped = submitted?.newStatus === 'PENDING_DESTINATION_COORDINATOR';
  const waitingNames = (programme: string) => {
    const names = coordinatorsOf(directory, programme);
    return names.length ? namesText(names) : 'a programme coordinator';
  };
  const stoppedAt = rejected?.previousStatus ?? cancelled?.previousStatus ?? '';

  const current: TransferStep = { key: 'current', label: 'Current programme coordinator', state: 'next', detail: waitingNames(row.sourceProgramme) };
  if (skipped) {
    Object.assign(current, { state: 'skipped', detail: `Skipped: nobody coordinated ${shortProgramme(row.sourceProgramme)} when it was requested` });
  } else if (endorsed) {
    Object.assign(current, { state: 'done', detail: `Approved by ${by(endorsed)}`, note: endorsed.reason || undefined });
  } else if (rejected && stoppedAt === 'PENDING_SOURCE_COORDINATOR') {
    Object.assign(current, { state: 'rejected', detail: `Rejected by ${by(rejected)}`, note: rejected.reason || undefined });
  } else if (row.status === 'PENDING_SOURCE_COORDINATOR') {
    Object.assign(current, { state: 'now', detail: row.canDecide ? 'Waiting for you' : `Waiting for ${waitingNames(row.sourceProgramme)}` });
  } else if (cancelled) {
    Object.assign(current, { state: 'stopped', detail: 'Not reached' });
  }

  const next: TransferStep = { key: 'new', label: 'New programme coordinator', state: 'next', detail: waitingNames(row.destinationProgramme) };
  if (approved) {
    Object.assign(next, { state: 'done', detail: `Approved by ${by(approved)}`, note: approved.reason || undefined });
  } else if (rejected && stoppedAt === 'PENDING_DESTINATION_COORDINATOR') {
    Object.assign(next, { state: 'rejected', detail: `Rejected by ${by(rejected)}`, note: rejected.reason || undefined });
  } else if (row.status === 'PENDING_DESTINATION_COORDINATOR') {
    Object.assign(next, { state: 'now', detail: row.canDecide ? 'Waiting for you' : `Waiting for ${waitingNames(row.destinationProgramme)}` });
  } else if (!isPendingTransfer(row)) {
    Object.assign(next, { state: 'stopped', detail: 'Not reached' });
  }

  const done: TransferStep = { key: 'transferred', label: 'Transferred', state: 'next', detail: 'Student Registry and the research profile change together' };
  if (row.status === 'APPROVED') {
    Object.assign(done, { state: 'done', detail: `Student Registry and the research profile changed, ${historyTime(approved?.createdAt ?? row.updatedAt)}` });
  } else if (row.status === 'REJECTED') {
    Object.assign(done, { state: 'stopped', detail: 'Not transferred' });
  } else if (row.status === 'CANCELLED') {
    Object.assign(done, { state: 'stopped', detail: cancelled ? `Cancelled by ${by(cancelled)}` : 'Cancelled', note: cancelled?.reason || undefined });
  }

  return [
    { key: 'requested', label: 'Requested', state: 'done', detail: submitted ? by(submitted) : historyTime(row.createdAt) },
    current,
    next,
    done,
  ];
}
