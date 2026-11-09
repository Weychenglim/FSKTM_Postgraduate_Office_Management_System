import { APP_ROUTES } from '../constants/routes';
import type { DashboardTask } from '../types';
import { resolveDashboardTaskRoute, formatWaitingText } from './workflowAgeing';

export function officeMarksDeadlineRoute(period?:{id:number;semesterId:number|null}) {
  return period && Number.isInteger(period.id) && period.id>0 && Number.isInteger(period.semesterId) && period.semesterId!>0
    ? `${APP_ROUTES.dashboardPeriods}?semester=${period.semesterId}&manage=window#marks-period-${period.id}`
    : `${APP_ROUTES.dashboardPeriods}#period-panel-MARKS`;
}

export interface OfficeAttentionGroup {
  id: string;
  title: string;
  priority: number;
  tasks: DashboardTask[];
  route: string;
}

export interface OfficeHomeAttentionRow {
  id:string;title:string;detail:string;route:string;count:number;
  urgency:'overdue'|'due'|'blocking'|'normal';
}

const homeUrgencyRank={overdue:0,due:1,blocking:2,normal:3} as const;

/** Workspace summaries count role entries, never inferred unique people. */
export function officeHomeAttention(tasks:DashboardTask[]):{review:OfficeHomeAttentionRow[];waiting:OfficeHomeAttentionRow[]} {
  const rows=new Map<string,{row:OfficeHomeAttentionRow;tasks:DashboardTask[];waiting:boolean;priority:number}>();
  for(const group of groupOfficeAttention(tasks)) {
    const waiting=group.tasks.every(task=>Boolean(task.waitingOn)&&task.waitingOn!=='FACULTY_PROCESSING');
    const capacity=group.id.startsWith('capacity:');
    const id=capacity?`capacity:${group.tasks[0].semesterCode??'unknown'}`:waiting?`waiting:${group.tasks[0].targetModule??group.route}`:group.id;
    const urgency=group.tasks.some(task=>task.deadlineState==='OVERDUE')?'overdue':group.tasks.some(task=>task.deadlineState==='DUE_TODAY')?'due':group.id==='reconciliation'&&group.tasks.some(task=>task.status==='critical')?'blocking':'normal';
    const current=rows.get(id);
    if(current){
      for(const task of group.tasks)if(!current.tasks.some(existing=>existing.id===task.id))current.tasks.push(task);
      if(homeUrgencyRank[urgency]<current.priority){current.row.urgency=urgency;current.priority=homeUrgencyRank[urgency];}
      continue;
    }
    rows.set(id,{row:{id,title:capacity?'Review capacity settings':group.id==='reconciliation'?'Check inconsistent records':waiting&&group.tasks[0].targetModule==='PANEL_APPOINTMENTS'?'Panel appointment requests':waiting&&group.tasks[0].targetModule==='SUPERVISOR_APPOINTMENTS'?'Supervision requests':group.title,detail:'',route:group.route,count:0,urgency},tasks:[...group.tasks],waiting,priority:homeUrgencyRank[urgency]});
  }
  const result:{review:OfficeHomeAttentionRow[];waiting:OfficeHomeAttentionRow[]}={review:[],waiting:[]};
  for(const item of [...rows.values()].sort((left,right)=>left.priority-right.priority)) {
    const {row,tasks:entries}=item;row.count=entries.length;
    if(row.id.startsWith('capacity:')) {
      const counts=[['Supervisor',entries.filter(task=>task.id.startsWith('capacity_supervisor_')).length],['Panel',entries.filter(task=>task.id.startsWith('capacity_panel_')).length],['Other',entries.filter(task=>!/^capacity_(supervisor|panel)_/.test(task.id)).length]] as const;
      row.detail=`${counts.filter(([,count])=>count).map(([role,count])=>`${count} ${role}`).join(' · ')} role ${entries.length===1?'entry':'entries'} in preview${entries[0].semesterCode?` · ${entries[0].semesterCode}`:''}`;
    }else if(item.waiting) {
      const owners=[...new Set(entries.map(task=>formatWaitingText({waitingOn:task.waitingOn}).replace(/^Waiting on /,'')))];
      row.detail=`${entries.length} ${entries.length===1?'record':'records'} in preview · ${entries.length===1?formatWaitingText(entries[0]):`Waiting on ${owners.join(', ')}`}`;
    }else {
      const unit=row.id==='reconciliation'?(row.urgency==='blocking'?'blocking issue':'issue'):'record';
      row.detail=`${entries.length} ${unit}${entries.length===1?'':'s'} in preview`;
    }
    if(row.urgency==='overdue'&&!/overdue/i.test(row.title)) {
      const count=entries.filter(task=>task.deadlineState==='OVERDUE').length;
      row.detail=`Includes ${count} overdue ${count===1?'record':'records'}. ${row.detail}`;
    }
    if(row.urgency==='due'&&!/due today/i.test(row.title)) {
      const count=entries.filter(task=>task.deadlineState==='DUE_TODAY').length;
      row.detail=`Includes ${count} ${count===1?'record':'records'} due today. ${row.detail}`;
    }
    result[item.waiting?'waiting':'review'].push(row);
  }
  return result;
}

export function officeWorkloadNavigationState(route: string) {
  return [APP_ROUTES.supervisorAppointmentWorkload, APP_ROUTES.panelAppointmentWorkload].some(path=>path===route.split('?')[0])
    ? {officeDashboardOrigin:true} : undefined;
}

export function officeTaskRoute(task: DashboardTask): string {
  if (task.recordType === 'LECTURER_CAPACITY') return `${APP_ROUTES.dashboardLecturerCapacity}${task.recordId ? `?lecturer=${encodeURIComponent(task.recordId)}` : ''}`;
  if (task.id === 'task_upload') return APP_ROUTES.dashboardTimeline;
  return resolveDashboardTaskRoute(task);
}

export function groupOfficeAttention(tasks: DashboardTask[]): OfficeAttentionGroup[] {
  const groups = new Map<string, OfficeAttentionGroup>();
  for (const task of tasks) {
    if (['completed', 'complete', 'done'].includes(task.status.toLowerCase()) || task.recordType === 'TIMELINE_ENTRY') continue;
    let id: string, title: string, priority: number, route = officeTaskRoute(task);
    if (task.recordType === 'LECTURER_CAPACITY') {
      const role = task.id.startsWith('capacity_supervisor_') ? 'Supervisor' : task.id.startsWith('capacity_panel_') ? 'Panel' : 'Lecturer';
      id = `capacity:${task.semesterCode ?? 'unknown'}:${role}:${task.statusText}`;
      title = `${role} capacity: ${task.statusText || 'review required'}`;
      priority = task.status === 'critical' ? 1 : 3;
      route = APP_ROUTES.dashboardLecturerCapacity;
    } else if (task.recordType === 'RECONCILIATION_ISSUE') {
      id = 'reconciliation'; title = 'Blocking data checks'; priority = 1;
      route = APP_ROUTES.dashboardWorkflowReconciliation;
    } else if (task.targetModule === 'MARKS') {
      id = `marks:${task.deadlineState ?? 'monitor'}`;
      title = task.deadlineState === 'OVERDUE' ? 'Overdue evaluations' : task.deadlineState === 'DUE_TODAY' ? 'Evaluations due today' : 'Evaluation work to monitor';
      priority = task.deadlineState === 'OVERDUE' ? 0 : task.deadlineState === 'DUE_TODAY' ? 2 : 4;
      route = APP_ROUTES.marksRecords;
    } else if (task.id === 'task_upload') {
      id = 'calendar-setup'; title = 'Calendar needs setup'; priority = 3;
    } else {
      id = `${task.targetModule}:${task.waitingOn ?? 'monitor'}`;
      title = task.targetModule === 'PANEL_APPOINTMENTS' ? 'Panel requests awaiting review' : task.targetModule === 'SUPERVISOR_APPOINTMENTS' ? 'Supervision requests awaiting review' : 'Records to review';
      priority = 4;
      route = task.targetModule === 'PANEL_APPOINTMENTS' ? APP_ROUTES.panelAppointments : task.targetModule === 'SUPERVISOR_APPOINTMENTS' ? APP_ROUTES.supervisorAppointments : route;
    }
    const group = groups.get(id);
    if (group) {
      if (!group.tasks.some(existing => existing.id === task.id)) group.tasks.push(task);
    } else groups.set(id, {id, title, priority, route, tasks: [task]});
  }
  return [...groups.values()].sort((left, right) => left.priority - right.priority);
}
