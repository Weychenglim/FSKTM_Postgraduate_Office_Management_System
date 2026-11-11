import type { DocumentSharing, DocumentTypeOption, StaffAudience, TaggableStudent } from '../types';

export const STAFF_AUDIENCES: Array<{ value: StaffAudience; label: string }> = [
  { value: 'ACADEMIC', label: 'All lecturers and coordinators' },
  { value: 'COORDINATORS', label: 'Programme coordinators only' },
  { value: 'OFFICE', label: 'PG office only' },
];

export function defaultSharing(type: DocumentTypeOption | null | undefined): DocumentSharing {
  return {
    supervisors: Boolean(type?.shareSupervisors),
    panel: Boolean(type?.sharePanel),
    coordinator: Boolean(type?.shareCoordinator),
  };
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

/** The people each tick reaches for the picked students. */
export function sharingNames(students: TaggableStudent[]): { supervisors: string[]; panel: string[]; coordinators: string[] } {
  return {
    supervisors: unique(students.flatMap(student => student.supervisors)),
    panel: unique(students.flatMap(student => student.panel)),
    coordinators: unique(students.flatMap(student => student.coordinators)),
  };
}

export function namesOrNone(names: string[], none: string): string {
  return names.length ? names.join(', ') : none;
}

/** Types this staff member may pick: for staff files, or for every picked student through one of their roles. */
export function staffTypeChoices(
  types: DocumentTypeOption[],
  options: { isOffice: boolean; role: string; staffFile: boolean; students: Array<Pick<TaggableStudent, 'roles'>> },
): DocumentTypeOption[] {
  return types.filter(type => {
    if (options.staffFile) {
      if (type.kind === 'STUDENT') return false;
      if (options.isOffice) return true;
      return type.uploaders.includes('LECTURER') || (options.role === 'Programme Coordinator' && type.uploaders.includes('COORDINATOR'));
    }
    if (type.kind === 'STAFF') return false;
    if (options.isOffice) return true;
    if (!options.students.length) return type.uploaders.some(role => role === 'SUPERVISOR' || role === 'PANEL' || role === 'COORDINATOR');
    return options.students.every(student => student.roles.some(role => type.uploaders.includes(role)));
  });
}

const named = (names: string[], role: string, missing: string) => (names.length ? `${names.join(', ')} (${role})` : missing);

/** Who will see a staff upload about `students` with the `share` ticks. */
export function staffReach(share: DocumentSharing, students: TaggableStudent[]): string[] {
  const names = sharingNames(students);
  return [
    'The PG office',
    ...(share.supervisors ? [named(names.supervisors, names.supervisors.length === 1 ? 'supervisor' : 'supervisors', students.length ? 'No other supervisor' : 'Their supervisors')] : []),
    ...(share.panel ? [named(names.panel, 'panel member', students.length ? 'No panel member yet' : 'Their panel member')] : []),
    ...(share.coordinator ? [named(names.coordinators, 'programme coordinator', students.length ? 'No programme coordinator' : 'Their programme coordinator')] : []),
  ];
}
