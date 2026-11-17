type Tone = 'info' | 'success' | 'warning' | 'danger';

export const TOAST_MS = 4000;

export const toastDuration = (tone: Tone = 'success'): number | undefined =>
  tone === 'success' || tone === 'info' ? TOAST_MS : undefined;
