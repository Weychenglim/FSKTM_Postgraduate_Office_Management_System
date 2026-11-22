import type { CompletionWindow, CompletionWindowRegisterRow, ClosurePreview } from '../types/marks';
import { request } from './apiClient';
export function grantCompletionWindows(payload: { taskIds: number[]; deadline: string; reason: string }) {
  return request<{ windows: CompletionWindow[] }>('/marks/completion-windows/', { method: 'POST', body: JSON.stringify(payload) });
}
export function getCompletionWindows(taskId: number) {
  return request<{ windows: CompletionWindow[] }>(`/marks/tasks/${taskId}/completion-windows/`);
}
export function getPeriodCompletionWindows(periodId:number) {
  return request<{windows:CompletionWindowRegisterRow[]}>(`/marks/periods/${periodId}/completion-windows/`);
}
export function revokeCompletionWindow(id: number, reason: string) {
  return request<{ window: CompletionWindow }>(`/marks/completion-windows/${id}/revoke/`, { method: 'POST', body: JSON.stringify({ reason }) });
}
export function getClosurePreview(kind: 'semester' | 'handover' | 'period', id: number): Promise<ClosurePreview> {
  const url = kind === 'period' ? `/marks/periods/${id}/closure-preview/` : `/academics/semesters/${id}/${kind === 'handover' ? 'handover-preview' : 'closure-preview'}/`;
  return request<ClosurePreview>(url);
}
