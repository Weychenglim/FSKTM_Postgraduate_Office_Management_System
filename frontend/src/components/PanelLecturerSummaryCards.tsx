import React from 'react';
import { UsersRound, ClipboardCheck, Clock3 } from 'lucide-react';
import type {PanelWorkloadSummary} from '../types';
import {AppointmentSummaryCard,AppointmentWorkloadDetails} from './AppointmentPrimitives';
import {capacityStateLabel} from '../utils/lecturerCapacity';
import {formatMalaysiaDate} from '../utils/malaysiaDateTime';

export function PanelLecturerSummaryCards({workload,reviewCount,awaitingCoordinatorCount}:{workload:PanelWorkloadSummary;reviewCount:number;awaitingCoordinatorCount:number}) {
  const count=workload.workloadCount??workload.currentStudents;
  const configured=!!workload.capacityState&&workload.capacityState!=='NOT_CONFIGURED';
  return <div className="grid gap-4 md:grid-cols-3">
    <AppointmentSummaryCard icon={UsersRound} title="Panel workload" value={count} progress={configured&&workload.workloadLimit>0?{current:count,max:workload.workloadLimit}:undefined} badge={workload.capacityState==='AVAILABLE'&&workload.availableSlots===1?'1 place remaining':workload.capacityState?capacityStateLabel(workload.capacityState):'Not configured'} tone={workload.selectable&&workload.availableSlots!==1?'success':'warning'} supportingContent={<AppointmentWorkloadDetails active={workload.confirmedAppointments} reserved={workload.pendingNominations} available={workload.capacityState==='NOT_CONFIGURED'?undefined:workload.availableSlots} unavailable={workload.capacityState==='TEMPORARILY_UNAVAILABLE'&&workload.unavailableUntil?`Unavailable through ${formatMalaysiaDate(workload.unavailableUntil)}.`:undefined}/>}/>
    <AppointmentSummaryCard icon={ClipboardCheck} title="Needs your review" value={reviewCount} description="Incoming nominations awaiting your decision."/>
    <AppointmentSummaryCard icon={Clock3} title="Awaiting Coordinator" value={awaitingCoordinatorCount} description="Nominations you accepted that are awaiting final approval."/>
  </div>;
}
