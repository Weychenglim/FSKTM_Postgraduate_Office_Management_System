type CorrectionOriginal = {
  comments: string;
  components: Array<{id: string | number; name: string; maxMarks: string | number; marksAwarded: string | null; feedback?: string}>;
};

export function validateSubmittedMarksCorrection(
  original: CorrectionOriginal,
  values: Record<string, string>,
  comments: string,
  reason: string,
  feedback: Record<string, string> = {},
): string | null {
  if (!reason.trim()) return 'Enter a correction reason.';
  let changed = comments !== original.comments;
  for (const component of original.components) {
    const value = values[component.id] ?? '';
    if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value))
      || Number(value) < 0 || Number(value) > Number(component.maxMarks)) {
      return `${component.name} must be between 0 and ${component.maxMarks}, with at most two decimal places.`;
    }
    changed ||= Number(value) !== Number(component.marksAwarded);
    changed ||= (feedback[component.id] ?? component.feedback ?? '') !== (component.feedback ?? '');
  }
  return changed ? null : 'Change a score, component feedback or the overall comments before saving a correction.';
}
