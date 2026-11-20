import type {CapacityRole,LecturerCapacityEntry,SemesterCapacityPlan} from '../types';
import type {CapacityPlanningBaseline,CapacityWorkspaceLecturer} from '../services/capacityWorkspaceApi';

/** The draft minimum includes reservations and deducts forecast RP2 releases. */
export function committedCapacityLoad(row:Pick<LecturerCapacityEntry,'supervisor'|'panel'>,role:CapacityRole):number|null {
  const resolution=role==='SUPERVISOR'?row.supervisor:row.panel;
  return resolution
    ? resolution.activeLoad - Math.min(resolution.activeLoad, resolution.expectedRp2Releases ?? 0) + resolution.reservedLoad
    : null;
}

/** Draft values and current published resolutions remain separate, including missing rows. */
export function capacityWorkspaceRows(roster:CapacityWorkspaceLecturer[],plan:SemesterCapacityPlan|null):CapacityWorkspaceLecturer[] {
  if(!plan)return roster;
  const saved=new Map(plan.entries.map(entry=>[entry.lecturerId,entry]));
  const rows=roster.map(row=>{
    const entry=saved.get(row.lecturerId);
    return {...row,id:entry?.id??row.id,supervisorLimit:entry?.supervisorLimit??null,panelLimit:entry?.panelLimit??null};
  });
  const currentIds=new Set(roster.map(row=>row.lecturerId));
  for(const entry of plan.entries)if(!currentIds.has(entry.lecturerId))rows.push({...entry,activeStudentCount:null,primaryStudentCount:null,supportingStudentCount:null,panelStudentCount:null});
  return rows;
}
export function capacityRowIssues(row:Pick<LecturerCapacityEntry,'staffNo'>,plan:SemesterCapacityPlan|null):string[] {
  return plan?.readinessErrors.filter(message=>message.startsWith(`${row.staffNo}:`)).map(message=>{
    const detail=message.slice(row.staffNo.length+1).trim();
    return detail==='capacity entry is required for this Lecturer.' ? 'Capacity limits not set.' : detail;
  })??[];
}
/** Include historic lecturers unique to either version without inventing selected values. */
export function capacityComparisonRows(roster:CapacityWorkspaceLecturer[],selected:SemesterCapacityPlan,comparison:SemesterCapacityPlan):CapacityWorkspaceLecturer[] {
  const combined=capacityWorkspaceRows(roster,comparison);
  return capacityWorkspaceRows(combined,selected);
}
export function capacityPlanningBaseline(baseline:CapacityPlanningBaseline):string {
  return baseline.eligibleLecturers>0&&baseline.studentsPerLecturer!==null
    ?baseline.studentsPerLecturer.toLocaleString('en-MY',{minimumFractionDigits:1,maximumFractionDigits:1}):'Unavailable';
}
export function capacityHasRole(row:CapacityWorkspaceLecturer,role:CapacityRole,includeRecorded=false):boolean {
  return role==='SUPERVISOR'?!!row.supervisor||(includeRecorded&&row.supervisorLimit!==null):!!row.panel||(includeRecorded&&row.panelLimit!==null);
}
