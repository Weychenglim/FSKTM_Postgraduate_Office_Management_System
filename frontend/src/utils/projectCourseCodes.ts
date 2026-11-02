/** Preserve historical text values and the existing API field name. */
export function parseProjectCourseCodes(value: string): string[] {
  const codes = value.split(',').map(code => code.trim()).filter(Boolean);
  return codes.length ? codes : [''];
}

export function serializeProjectCourseCodes(codes: string[]): string {
  return codes.map(code => code.trim()).filter(Boolean).join(', ');
}

export function validateProjectCourseCodes(codes: string[]): string | null {
  const populated = codes.map(code => code.trim()).filter(Boolean);
  if (!populated.length) return 'Enter your project course code.';
  if (populated.length !== 1 || /[,;\r\n]/.test(populated[0])) return 'Enter only one project course code.';
  return populated[0].length > 255 ? 'Project course code must not exceed 255 characters.' : null;
}
