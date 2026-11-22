import {panelRecordedDate, type PanelPresentation} from './panelPresentation';

export type PanelAssignmentView = 'current' | 'past';
export type PanelAssignmentFilters = {view?: PanelAssignmentView; q?: string; programme?: string; semester?: string;
  status?: string; projectStage?: string; from?: string; to?: string; sort?: string; lecturer?: string};

export function panelLecturerKey(record: PanelPresentation): string {
  const staff = record.recommendedMemberId.trim();
  // Names alone cannot establish that two lecturers are the same person.
  return staff ? `staff:${staff.toLowerCase()}` : `appointment:${record.appointmentLifecycle!.appointmentId}`;
}

export function filterPanelAssignments(records: PanelPresentation[], filters: PanelAssignmentFilters = {}): PanelPresentation[] {
  const seen = new Set<number>();
  const search = filters.q?.trim().toLowerCase();
  return records.filter(record => {
    const appointment = record.appointmentLifecycle;
    if (!appointment || !['ACTIVE', 'ENDED', 'COMPLETED'].includes(appointment.status) || seen.has(appointment.appointmentId)) return false;
    seen.add(appointment.appointmentId);
    if ((appointment.status === 'ACTIVE') !== (filters.view !== 'past')) return false;
    const date = panelRecordedDate(record.appointmentDate || record.coordinatorDecisionAt)?.slice(0, 10) || '';
    return (!filters.lecturer || panelLecturerKey(record) === filters.lecturer)
      && (!search || [record.studentName, record.studentId, record.recommendedMember, record.recommendedMemberId,
        record.supervisorName, record.proposedTopic].some(value => value?.toLowerCase().includes(search)))
      && (filters.view === 'past' || !filters.projectStage || record.projectStage === filters.projectStage)
      && (!filters.programme || record.programme === filters.programme)
      && (!filters.semester || record.semester === filters.semester)
      && (!filters.status || appointment.status === filters.status)
      && (!filters.from || !!date && date >= filters.from) && (!filters.to || !!date && date <= filters.to);
  }).sort((a, b) => filters.sort === 'newest'
    ? String(b.appointmentDate || b.coordinatorDecisionAt || '').localeCompare(String(a.appointmentDate || a.coordinatorDecisionAt || ''))
    : a.studentName.localeCompare(b.studentName) || a.appointmentLifecycle!.appointmentId - b.appointmentLifecycle!.appointmentId);
}

export interface PanelLecturerGroup {key: string; name: string; staffNo: string; studentCount: number; assignmentCount: number; records: PanelPresentation[]}
export function groupPanelAssignments(records: PanelPresentation[]): PanelLecturerGroup[] {
  const groups = new Map<string, PanelLecturerGroup>();
  const seen = new Set<number>();
  for (const record of records) {
    const appointment = record.appointmentLifecycle;
    if (!appointment || seen.has(appointment.appointmentId)) continue;
    seen.add(appointment.appointmentId);
    const key = panelLecturerKey(record);
    const group = groups.get(key) ?? {key, name: record.recommendedMember || 'Lecturer not recorded',
      staffNo: record.recommendedMemberId, studentCount: 0, assignmentCount: 0, records: []};
    group.records.push(record); group.assignmentCount++;
    groups.set(key, group);
  }
  for (const group of groups.values()) group.studentCount = new Set(group.records.map(record => record.studentId.trim().toLowerCase() || `appointment:${record.appointmentLifecycle!.appointmentId}`)).size;
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}
