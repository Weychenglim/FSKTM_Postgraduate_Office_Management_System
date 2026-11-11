import type { DocumentKind, DocumentStudentRef } from '../types';
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
