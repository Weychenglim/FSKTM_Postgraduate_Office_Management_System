import {DashboardHeader} from './DashboardHeader';
/** @license SPDX-License-Identifier: Apache-2.0 */
import React from 'react';
import {UsersRound,ChevronRight,CalendarDays,Gauge,FileChartColumn,BarChart3,CheckCircle2} from 'lucide-react';
import {PortalButton,PortalCard} from './PortalPrimitives';
import {ErrorState,LoadingState} from './StateViews';
import {AlertMessage} from './AlertMessage';
import {APP_ROUTES,sidebarItemForPath} from '../constants/routes';
import {getDashboardSummary,getPanelWorkloads} from '../services';
import {getOfficeAttention,type OfficeAttentionSummary} from '../services/officeAttentionApi';
import {officeAttentionPreview,officeAttentionCategoryRoute} from '../utils/officeAttention';
import {useOfficeRead} from './useOfficeRead';
import {OfficeSemesterContext} from './OfficeSemesterContext';
import {OfficeCalendarPreview} from './OfficeCalendarPreview';
import type {MarkRecordStatusTab} from '../utils/markRecords';
import {officeMonitoringRoute} from '../utils/officeMonitoring';
import {AppointmentIcon} from './AppointmentPrimitives';

interface AdministrationDashboardProps {
  onNavigateToTab:(tabName:string)=>void;
  onNavigateToRoute?:(route:string)=>void;
  onNavigateToMarksRecords?:(statusTab?:MarkRecordStatusTab)=>void;
  onNavigateToTimeline?:()=>void;
}

const toolGroups=[
  {name:'Semester and dates',icon:CalendarDays,items:[
    {label:'Academic semesters',detail:'Prepare, activate and close semesters.',route:APP_ROUTES.dashboardSemesters},
    {label:'Academic calendar',detail:'Manage research dates and events.',route:APP_ROUTES.dashboardTimeline},
    {label:'Periods and extensions',detail:'Set submission windows and extra time.',route:APP_ROUTES.dashboardPeriods},
  ]},
  {name:'Capacity and workload',icon:Gauge,items:[
    {label:'Lecturer capacity',detail:'Set Supervisor and Panel limits.',route:APP_ROUTES.dashboardLecturerCapacity},
    {label:'Supervisor workload',detail:'Review active supervision commitments.',route:APP_ROUTES.supervisorAppointmentWorkload},
    {label:'Panel workload',detail:'Review Panel assignments and limits.',route:APP_ROUTES.panelAppointmentWorkload},
  ]},
  {name:'Reports and checks',icon:FileChartColumn,items:[
    {label:'Reconciliation',detail:'Investigate inconsistent records.',route:APP_ROUTES.dashboardWorkflowReconciliation},
  ]},
];

export const AdministrationDashboard:React.FC<AdministrationDashboardProps>=({onNavigateToTab,onNavigateToRoute,onNavigateToMarksRecords,onNavigateToTimeline})=>{
  const attention=useOfficeRead(getOfficeAttention),summary=useOfficeRead(getDashboardSummary),workload=useOfficeRead(getPanelWorkloads);
  const preview=officeAttentionPreview(attention.data?.summary??[]);
  const groups={review:preview.filter(row=>row.responsibility==='review'),waiting:preview.filter(row=>row.responsibility==='waiting')};
  const attentionEmpty = !attention.loading && !attention.error && !groups.review.length && !groups.waiting.length;
  const navigate=(route:string)=>{
    if(onNavigateToRoute)onNavigateToRoute(route);
    else if(route===APP_ROUTES.dashboardTimeline&&onNavigateToTimeline)onNavigateToTimeline();
    else if(route===APP_ROUTES.marksRecords&&onNavigateToMarksRecords)onNavigateToMarksRecords('All Records');
    else onNavigateToTab(sidebarItemForPath(route));
  };
  const link=(route:string)=>({href:route,onClick:(event:React.MouseEvent<HTMLAnchorElement>)=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();navigate(route);
  }});
  const monitoringItem=(label:string,count:number,route:string)=><a key={label} {...link(route)} className="home-monitoring-item" aria-label={`${count} ${label}`}>
    <span>{label}</span><span className={`home-monitoring-count${count>0?' home-monitoring-nonzero':''}`}>{count}</span><span className="home-monitoring-action" aria-hidden="true">View<ChevronRight size={15}/></span>
  </a>;
  const attentionRows=(rows:OfficeAttentionSummary[],label:string)=>rows.length>0&&<div className={`home-attention-section${label==='Waiting on others'?' home-waiting':''}`}><h3>{label}</h3>{rows.map(row=><a key={row.id} {...link(officeAttentionCategoryRoute(row))} className="home-attention-link" data-office-attention={row.id}><div><span>{row.title}</span><small className={row.urgency!=='normal'?`home-${row.urgency}`:undefined}>{row.urgency!=='normal'&&<i aria-hidden="true"/>}{row.detail}</small></div><ChevronRight size={15} aria-hidden="true"/></a>)}</div>;
  return <div id="admin-dashboard-container" className="office-home text-left pb-12">
    <DashboardHeader context={<OfficeSemesterContext compact onNavigate={navigate}/>} actions={<div className="home-heading-actions"><PortalButton variant="secondary" icon={BarChart3} onClick={()=>navigate(APP_ROUTES.dashboardReports)}>View Workflow Reports</PortalButton><PortalButton data-office-preserve variant="secondary" icon={UsersRound} onClick={()=>navigate(APP_ROUTES.dashboardParticipantLifecycle)}>Manage Participants</PortalButton></div>}/>
    <div className="home-layout-container"><div className="home-overview-grid">
      <PortalCard padding="none" id="office-needs-attention" className="home-attention" role="region" aria-label="Needs attention">
        <header><h2 className="section-heading">Needs attention</h2></header>
        {attention.loading?<LoadingState message="Loading attention records…" className="home-state"/>:attention.error?<ErrorState message={attention.error} onRetry={attention.reload} className="home-state"/>:attentionEmpty?<div className="home-attention-empty" role="status"><CheckCircle2 aria-hidden="true" size={18}/><p>No items need attention.</p></div>:<>
          {attentionRows(groups.review,'For Office review')}{attentionRows(groups.waiting,'Waiting on others')}
        </>}
        {!attentionEmpty ? <div className="home-attention-footer"><PortalButton size="sm" variant="ghost" onClick={()=>navigate(`${APP_ROUTES.dashboardAttention}?view=all`)}>View all attention</PortalButton></div> : null}
      </PortalCard>
      <OfficeCalendarPreview onOpen={()=>navigate(APP_ROUTES.dashboardTimeline)}/>
    </div></div>
    <section className="home-tools" aria-labelledby="office-tools-title"><div className="home-tools-heading"><h2 className="section-heading" id="office-tools-title">Office tools</h2><p>Open the workspace for the task you need.</p></div>
      <div className="home-tool-groups">{toolGroups.map(group=><section className="home-tool-group" key={group.name}><h3><AppointmentIcon icon={group.icon} tone="neutral"/>{group.name}</h3><ul>{group.items.map(item=><li key={item.route}><a {...link(item.route)} data-office-tool={item.route} className="home-tool-link"><div><span>{item.label}</span><small>{item.detail}</small></div><ChevronRight size={15} aria-hidden="true"/></a></li>)}</ul></section>)}</div>
      <section className="home-monitoring" aria-label="Monitoring counts">
        <div className="home-monitoring-heading"><h3 className="section-label">Monitoring</h3><span>Count</span></div>
        <div className="home-monitoring-grid">
          {summary.loading?<span role="status">Loading monitoring counts…</span>:summary.error?<AlertMessage type="error" title="Monitoring counts unavailable" message={summary.error} actions={<PortalButton size="sm" onClick={summary.reload}>Retry counts</PortalButton>}/>:summary.data&&<>
            {monitoringItem('Pending Supervisor requests',summary.data.pendingSupervisorRequests,officeMonitoringRoute('supervisor-pending'))}
            {monitoringItem('Pending Panel approvals',summary.data.pendingPanelApprovals,officeMonitoringRoute('panel-pending'))}
            {monitoringItem('Incomplete evaluations',summary.data.incompleteMarkEntries,officeMonitoringRoute('incomplete'))}
            {monitoringItem('Backup evaluator assignments',summary.data.backupMarkTasks??0,officeMonitoringRoute('backup'))}
          </>}
          {workload.loading?<span role="status">Loading Panel workload summary…</span>:workload.error?<AlertMessage type="error" title="Panel workload summary unavailable" message="Reload the summary to view the current count." actions={<PortalButton size="sm" onClick={workload.reload}>Retry workload</PortalButton>}/>:monitoringItem('Lecturers at or over their configured Panel limit',workload.data?.filter(row=>row.capacityState==='OVER_CAPACITY'||row.capacityState==='FULL').length??0,officeMonitoringRoute('panel-capacity'))}
        </div>
      </section>
    </section>
  </div>;
};
