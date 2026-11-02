import type { SupervisorSectionADraft, SupervisorSectionAInput } from '../types/supervisorSectionA';

const courseFields = [
  ['courseName', 'course name', 255],
  ['courseCode', 'course code', 64],
  ['semesterSession', 'semester/session', 64],
  ['grade', 'grade', 32],
] as const;

export function validateSupervisorSectionA(draft: SupervisorSectionADraft): string | null {
  if (!draft.titleOrigin) return 'Choose who proposed the research title (title origin).';
  if (draft.noCoursesTaken && draft.courseResults.length > 0) return 'Remove course rows before declaring no completed courses; both cannot be submitted.';
  if (!draft.noCoursesTaken && draft.courseResults.length === 0) return 'Add completed courses or select No completed courses to declare.';
  if (draft.courseResults.length > 50) return 'Declare no more than 50 courses.';
  for (let index = 0; index < draft.courseResults.length; index++) {
    for (const [field, label, limit] of courseFields) {
      const value = draft.courseResults[index][field].trim();
      if (!value) return `Complete the ${label} for course ${index + 1}, or remove the row.`;
      if (value.length > limit) return `Course ${index + 1} ${label} must not exceed ${limit} characters.`;
    }
  }
  if (!draft.declarationAccepted) return 'Accept the declaration after reviewing your application.';
  return null;
}

export function buildSupervisorSectionAInput(draft: SupervisorSectionADraft): SupervisorSectionAInput {
  if (!draft.titleOrigin || !draft.declarationAccepted) throw new Error('Choose a title origin and accept the declaration.');
  return {
    version: 1,
    titleOrigin: draft.titleOrigin,
    noCoursesTaken: draft.noCoursesTaken,
    courseResults: draft.courseResults.map(row => ({
      courseName: row.courseName.trim(), courseCode: row.courseCode.trim(),
      semesterSession: row.semesterSession.trim(), grade: row.grade.trim(),
    })),
    declarationAccepted: true,
  };
}
