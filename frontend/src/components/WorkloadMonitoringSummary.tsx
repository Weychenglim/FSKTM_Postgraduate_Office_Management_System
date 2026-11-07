import React from 'react';
import { UsersRound, UserCheck, Gauge, ContactRound } from 'lucide-react';
import type { PanelWorkloadRecord, SupervisorWorkloadRecord } from '../types';
import { AppointmentSummaryCard } from './AppointmentPrimitives';

type WorkloadSummaryProps =
  | { kind: 'supervisor'; records: SupervisorWorkloadRecord[] }
  | { kind: 'panel'; records: PanelWorkloadRecord[] };

/** Summarize the complete filtered collection, before pagination. */
export function WorkloadMonitoringSummary(props: WorkloadSummaryProps) {
  let available = 0;
  let full = 0;
  let overCapacity = 0;
  for (const record of props.records) {
    const configured = record.capacityState !== 'NOT_CONFIGURED' && Boolean(record.semesterCode) && record.capacityPlanVersion != null;
    if (configured && record.capacityState === 'AVAILABLE') available++;
    else if (configured && record.capacityState === 'FULL') full++;
    else if (configured && record.capacityState === 'OVER_CAPACITY') overCapacity++;
  }

  const active = props.kind === 'panel'
    ? props.records.reduce((total, record) => total + record.confirmedAppointments, 0)
    : props.records.reduce((total, record) => total + (record.activeLoad ?? record.currentStudents), 0);

  return <section aria-label={`${props.kind === 'panel' ? 'Panel' : 'Supervisor'} workload summary`} className="space-y-3">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AppointmentSummaryCard icon={UsersRound} title="Lecturers" value={props.records.length} />
      <AppointmentSummaryCard icon={ContactRound} title="Active appointments" value={active} />
      <AppointmentSummaryCard icon={UserCheck} title="Available" value={available} />
      <AppointmentSummaryCard icon={Gauge} title="At or over capacity" value={full + overCapacity} />
    </div>
  </section>;
}
