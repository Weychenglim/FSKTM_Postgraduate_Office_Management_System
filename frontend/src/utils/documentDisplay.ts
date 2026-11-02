import type { DocumentCheckStatus, DocumentKind, DocumentStudentRef, PortalDocument, RequiredShow, RequiredState } from '../types';
import type { ApprovalStep } from './approvalProcess';
import { formatMalaysiaDate } from './malaysiaDateTime';

export const KIND_SHORT: Record<DocumentKind, string> = {
  PDF: 'PDF',
  DOCX: 'DOC',
  IMAGE: 'IMG',
  XLSX: 'XLS',
  PPTX: 'PPT',
};

export const KIND_CLASSES: Record<DocumentKind, string> = {
  PDF: 'bg-rose-100 text-rose-700',
  DOCX: 'bg-blue-100 text-blue-700',
  IMAGE: 'bg-violet-100 text-violet-700',
  XLSX: 'bg-emerald-100 text-emerald-700',
  PPTX: 'bg-orange-100 text-orange-700',
};

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(1).replace(/\.0$/, '')} MB`;
}

/** The chip shown only when someone needs to act or has just acted. */
export function checkChip(status: DocumentCheckStatus): { label: string; className: string } | null {
  if (status === 'WAITING') return { label: 'Waiting for a check', className: 'bg-amber-100 text-amber-800' };
  if (status === 'RETURNED') return { label: 'Returned', className: 'bg-rose-100 text-rose-700' };
  if (status === 'ACCEPTED') return { label: 'Accepted', className: 'bg-emerald-100 text-emerald-700' };
  return null;
}

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** The coordinator's check as a status badge; null when the file needs no check. */
export function checkBadge(status: DocumentCheckStatus): { label: string; tone: BadgeTone } | null {
  if (status === 'WAITING') return { label: 'Waiting for a check', tone: 'warning' };
  if (status === 'RETURNED') return { label: 'Returned', tone: 'danger' };
  if (status === 'ACCEPTED') return { label: 'Accepted', tone: 'success' };
  return null;
}

/** Where one required document stands for a student, as a status badge. */
export function requiredBadge(state: RequiredState, check?: DocumentCheckStatus): { label: string; tone: BadgeTone } {
  if (state === 'MISSING') return { label: 'Not handed in', tone: 'danger' };
  if (state === 'RETURNED') return { label: 'Returned, upload again', tone: 'warning' };
  if (state === 'WAITING') return { label: 'Waiting for check', tone: 'info' };
  return { label: check === 'ACCEPTED' ? 'Accepted' : 'Handed in', tone: 'success' };
}

/** The coordinator's check as progress steps, like a letter request; empty when the file needs no check. */
export function checkSteps(document: Pick<PortalDocument, 'checkStatus' | 'checkReason' | 'checkedBy' | 'checkedAt' | 'uploadedBy' | 'uploadedAt' | 'file'>): ApprovalStep[] {
  if (document.checkStatus === 'NONE') return [];
  const version = document.file?.number ?? 1;
  const uploaded: ApprovalStep = {
    id: 'uploaded',
    label: version > 1 ? `Version ${version} uploaded` : 'Uploaded',
    state: 'completed',
    actorName: document.uploadedBy.isMe ? 'You' : document.uploadedBy.name,
    occurredAt: document.file?.uploadedAt ?? document.uploadedAt,
  };
  const checker = document.checkedBy || 'Programme coordinator';
  if (document.checkStatus === 'WAITING') {
    return [uploaded, { id: 'check', label: 'Coordinator check', state: 'current', description: 'Waiting for the programme coordinator to check it.' }, { id: 'accepted', label: 'Accepted', state: 'upcoming' }];
  }
  if (document.checkStatus === 'RETURNED') {
    return [
      uploaded,
      { id: 'check', label: 'Returned', state: 'rejected', actorName: checker, occurredAt: document.checkedAt ?? undefined, reason: document.checkReason || undefined },
      { id: 'accepted', label: 'Accepted', state: 'not_reached', description: 'A corrected file is checked again.' },
    ];
  }
  return [
    uploaded,
    { id: 'check', label: 'Checked by the office', state: 'completed', actorName: checker, occurredAt: document.checkedAt ?? undefined },
    { id: 'accepted', label: 'Accepted', state: 'completed', showRecordedDetails: false },
  ];
}

/** "Ali Hassan" / "Ali Hassan and 2 more", with the IDs or remaining names underneath. */
export function studentsLine(students: DocumentStudentRef[]): { main: string; sub: string } {
  if (!students.length) return { main: 'Staff file', sub: '' };
  const [first, ...rest] = students;
  if (!rest.length) return { main: first.name, sub: first.matric };
  return { main: `${first.name} and ${rest.length} more`, sub: rest.map(student => student.name).join(', ') };
}


export function uploadedLine(name: string, isMe: boolean): string {
  return isMe ? 'Uploaded by you' : `Uploaded by ${name}`;
}

export const shortDocumentDate = (value: string | null | undefined): string => (value ? formatMalaysiaDate(value) : '');

const HISTORY_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "14 Oct 2026, 10:05" in Malaysia time. */
export const historyTime = (value: string): string => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? HISTORY_TIME.format(parsed) : '';
};

type RequiredCounts = { students: number; done: number; waiting: number; returned: number; missing: number };

export const stillToHandIn = (counts: RequiredCounts): number => counts.missing + counts.returned;

/** Uploads waiting for a check count as handed in. */
export const handedIn = (counts: RequiredCounts): number => counts.done + counts.waiting;

/** The chips on a required document's card; each one opens that group's names. */
export const requiredGroups = (counts: RequiredCounts): Array<{ show: RequiredShow; label: string; count: number; dot: string }> => [
  { show: 'done', label: 'Done', count: counts.done, dot: 'bg-emerald-500' },
  { show: 'waiting', label: 'To check', count: counts.waiting, dot: 'bg-amber-500' },
  { show: 'todo', label: 'Missing', count: stillToHandIn(counts), dot: 'bg-slate-400' },
];
