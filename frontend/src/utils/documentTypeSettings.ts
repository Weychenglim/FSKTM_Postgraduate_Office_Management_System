import type { DocumentTypeInput, DocumentTypeKind, DocumentTypeSetting, DocumentUploaderRole } from '../types';

export const UPLOADER_LABELS: Record<DocumentUploaderRole, string> = {
  STUDENT: 'Students',
  SUPERVISOR: 'Supervisors',
  PANEL: 'Panel members',
  COORDINATOR: 'Programme coordinators',
  LECTURER: 'Lecturers',
};

export const TYPE_KIND_LABELS: Record<DocumentTypeKind, string> = {
  STUDENT: 'Files about students',
  STAFF: 'Staff files',
  BOTH: 'Files about students, or staff files',
};

export const NEW_TYPE: DocumentTypeInput = {
  label: '',
  description: '',
  group: 'OTHER',
  kind: 'STUDENT',
  uploaders: ['STUDENT'],
  shareSupervisors: true,
  sharePanel: false,
  shareCoordinator: false,
  needsCheck: false,
  onePerStudent: false,
  required: false,
  requiredDueNote: '',
  requiredProgrammes: [],
  isActive: true,
};

const FIELDS = Object.keys(NEW_TYPE) as Array<keyof DocumentTypeInput>;
const SHARE_FIELDS: Array<keyof DocumentTypeInput> = ['shareSupervisors', 'sharePanel', 'shareCoordinator'];

export function draftFromType(type: DocumentTypeSetting): DocumentTypeInput {
  return {
    label: type.label,
    description: type.description,
    group: type.group,
    kind: type.kind,
    uploaders: [...type.uploaders],
    shareSupervisors: type.shareSupervisors,
    sharePanel: type.sharePanel,
    shareCoordinator: type.shareCoordinator,
    needsCheck: type.needsCheck,
    onePerStudent: type.onePerStudent,
    required: type.required,
    requiredDueNote: type.requiredDueNote,
    requiredProgrammes: [...type.requiredProgrammes],
    isActive: type.isActive,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only the fields that changed, ready to send. */
export function typeChanges(original: DocumentTypeInput, draft: DocumentTypeInput): Partial<DocumentTypeInput> {
  const changes: Partial<DocumentTypeInput> = {};
  for (const field of FIELDS) {
    if (!same(original[field], draft[field])) Object.assign(changes, { [field]: draft[field] });
  }
  return changes;
}

export const isStaffKind = (kind: DocumentTypeKind) => kind === 'STAFF';

/** A short line for the list: who uploads, who sees it, and whether the office checks it. */
export function typeSummary(type: DocumentTypeInput): string {
  const parts: string[] = [];
  if (type.uploaders.includes('STUDENT')) parts.push('Students upload');
  else parts.push(type.uploaders.length ? 'Staff upload' : 'Office uploads only');
  if (isStaffKind(type.kind)) {
    parts.push('uploader picks who sees it');
  } else {
    const seen = [
      type.shareSupervisors ? 'supervisors' : '',
      type.sharePanel ? 'panel' : '',
      type.shareCoordinator ? 'coordinator' : '',
    ].filter(Boolean);
    parts.push(seen.length ? `seen by ${seen.join(', ')}` : 'office only');
  }
  if (type.needsCheck) parts.push('office checks');
  if (type.required) parts.push('every student hands it in');
  return parts.join(' · ');
}

/** Uploader choices for a kind, keeping only the ones that still apply. */
export function keepUploaders(uploaders: DocumentUploaderRole[], allowed: DocumentUploaderRole[]): DocumentUploaderRole[] {
  return allowed.filter(role => uploaders.includes(role));
}

export function toggled<T>(values: T[], value: T, order: T[]): T[] {
  const next = values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  return order.filter(item => next.includes(item));
}

const files = (count: number) => (count === 1 ? '1 file' : `${count} files`);

/** What saving will also change, in plain words. */
export function saveNotices(type: DocumentTypeSetting | null, draft: DocumentTypeInput): string[] {
  if (!type) return [];
  const original = draftFromType(type);
  const notices: string[] = [];
  if (type.studentUploads > 0 && SHARE_FIELDS.some(field => original[field] !== draft[field])) {
    notices.push(`This also changes who can see the ${files(type.studentUploads)} students already uploaded.`);
  }
  if (original.isActive && !draft.isActive && type.files > 0) {
    notices.push(`${files(type.files)} ${type.files === 1 ? 'uses' : 'use'} this type. ${type.files === 1 ? 'It stays' : 'They stay'}, but nobody can choose it for new uploads.`);
  }
  if (original.needsCheck && !draft.needsCheck && type.waiting > 0) {
    notices.push(`${files(type.waiting)} still ${type.waiting === 1 ? 'waits' : 'wait'} in To check. The PG office can still accept or return ${type.waiting === 1 ? 'it' : 'them'}.`);
  }
  return notices;
}

/** A problem that stops saving, or null. */
export function typeProblem(draft: DocumentTypeInput, types: DocumentTypeSetting[], id: number | null): string | null {
  const label = draft.label.trim().replace(/\s+/g, ' ');
  if (!label) return 'Give the type a name.';
  if (label.length > 120) return 'Keep the name to 120 characters.';
  const twin = types.find(type => type.id !== id && type.label.toLocaleLowerCase() === label.toLocaleLowerCase());
  if (twin) return `There is already a type called ${twin.label}.`;
  if (draft.required && !draft.uploaders.includes('STUDENT')) return 'Students must be able to upload a document they have to hand in.';
  if (draft.requiredDueNote.trim().length > 120) return 'Keep the due note to 120 characters.';
  return null;
}

export function savedMessage(saved: DocumentTypeSetting, added: boolean): string {
  if (added) return `Added "${saved.label}".`;
  const updated = saved.updatedFiles ?? 0;
  return updated ? `Saved. ${files(updated)} students uploaded now ${updated === 1 ? 'uses' : 'use'} the new sharing.` : `Saved "${saved.label}".`;
}
