import type { SupervisorDocumentRequirement } from '../types';
import type { SupervisorSectionAInput } from '../types/supervisorSectionA';
import type { SupervisorResearchIntent } from '../types/supervisorResearchIntent';

export const SUPERVISOR_DOCUMENT_MAX_FILES = 5;
export const SUPERVISOR_DOCUMENT_MAX_TOTAL_BYTES = 10 * 1024 * 1024;

const isAcceptedDocument = (file: File): boolean => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'pdf' || extension === 'docx';
};

export function validateSupervisorDocumentFile(file: File): string | null {
  if (!isAcceptedDocument(file)) {
    return `${file.name} must be a PDF or DOCX document.`;
  }
  if (file.size > SUPERVISOR_DOCUMENT_MAX_TOTAL_BYTES) {
    return `${file.name} exceeds the 10 MB combined upload limit.`;
  }
  return null;
}

export function validateSupervisorDocumentSelection(
  requirements: SupervisorDocumentRequirement[],
  files: Map<string, File>,
  noDocumentsRequired = false,
): string | null {
  if (noDocumentsRequired && requirements.length === 0) {
    return files.size ? "Remove previously selected files; no supporting documents are required." : null;
  }
  if (requirements.length === 0) {
    return 'Document requirements are not configured. Contact the Postgraduate Office.';
  }
  if (files.size > SUPERVISOR_DOCUMENT_MAX_FILES) {
    return `Upload no more than ${SUPERVISOR_DOCUMENT_MAX_FILES} documents.`;
  }
  const missing = requirements.filter(
    (requirement) => requirement.isRequired && !files.has(requirement.code),
  );
  if (missing.length > 0) {
    return `Upload the required document: ${missing.map((item) => item.label).join(', ')}.`;
  }
  for (const file of files.values()) {
    const fileError = validateSupervisorDocumentFile(file);
    if (fileError) return fileError;
  }
  const totalBytes = [...files.values()].reduce((total, file) => total + file.size, 0);
  if (totalBytes > SUPERVISOR_DOCUMENT_MAX_TOTAL_BYTES) {
    return 'Supervisor application documents must not exceed 10 MB combined.';
  }
  return null;
}

export function buildSupervisorApplicationFormData(
  fields: {
    proposedSupervisorId: string;
    researchTitle: string;
    researchArea: string;
    researchAbstract: string;
    projectCourseCodes?: string;
    replacesAppointmentId?: number | null;
    replacementReason?: string;
    sectionA?: SupervisorSectionAInput;
    researchIntent?: SupervisorResearchIntent;
  },
  files: Map<string, File>,
): FormData {
  const body = new FormData();
  body.append('proposedSupervisorId', fields.proposedSupervisorId);
  body.append('researchTitle', fields.researchTitle);
  body.append('researchArea', fields.researchArea);
  body.append('researchAbstract', fields.researchAbstract);
  body.append('projectCourseCodes', (fields.projectCourseCodes ?? '').trim());
  if (fields.sectionA) body.append('sectionA', JSON.stringify(fields.sectionA));
  if (fields.researchIntent) body.append('researchIntent', JSON.stringify(fields.researchIntent));
  if (fields.replacesAppointmentId) {
    body.append('replacesAppointmentId', String(fields.replacesAppointmentId));
  }
  if (fields.replacementReason?.trim()) {
    body.append('replacementReason', fields.replacementReason.trim());
  }
  for (const [requirementCode, file] of files) {
    body.append('documents', file);
    body.append('requirementCodes', requirementCode);
  }
  return body;
}

export const formatSupervisorDocumentSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
