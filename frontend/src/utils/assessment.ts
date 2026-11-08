export function assessmentLabel(value?: string): string {
  return value === 'P1' ? 'Research Project 1' : value === 'P2' ? 'Research Project 2' : value || 'Assessment not classified';
}
