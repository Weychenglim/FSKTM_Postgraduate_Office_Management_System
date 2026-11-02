import { PortalSelect } from './PortalSelect';
import { OfficeMonitoringNotice, useOfficeMonitoring } from './OfficeMonitoringContext';
import React,{useEffect} from 'react';
import {useListState} from './ListState';
import {CoordinatorDataTable} from './CoordinatorBrowsePrimitives';
import {AppointmentViewSwitch,WorkspaceSectionHeader,WorkspacePagination,RequestViewSwitch,WorkspaceFilterCard,type RequestListView} from './RequestWorkspacePrimitives';
import {PortalButton,StatusBadge} from './PortalPrimitives';
import {panelRequestPending,panelStatusLabel,panelStatusTone,panelRecordedDate,type PanelPresentation} from '../utils/panelPresentation';
import {formatRequestDisplayDate} from './ApprovalProcess';
import {useExcelExport} from '../utils/useExcelExport';
import {Download} from 'lucide-react';

type Filters={view?:string;q?:string;programme?:string;semester?:string;status?:string;from?:string;to?:string;sort?:string;appointments?:boolean;requestViewForRecord?:(record:PanelPresentation)=>RequestListView};
export function filterPanelBrowse(records:PanelPresentation[],f:Filters):PanelPresentation[]{
  const current=f.view!=='history';
  return records.filter(r=>{
    if(f.appointments?(!r.appointmentLifecycle||(r.appointmentLifecycle.status==='ACTIVE')!==current):(f.requestViewForRecord?f.requestViewForRecord(r)!==(current?'requests':'history'):panelRequestPending(r.status)!==current))return false;
    const date=panelRecordedDate(f.appointments?r.appointmentDate:r.submittedAt||r.submittedDate)?.slice(0,10)??'';
    return (!f.q||[r.id,r.studentName,r.studentId,r.supervisorName,r.recommendedMember,r.recommendedMemberId,r.proposedTopic].join(' ').toLowerCase().includes(f.q.trim().toLowerCase()))&&(!f.programme||r.programme===f.programme)&&(!f.semester||r.semester===f.semester)&&(!f.status||(f.appointments?r.appointmentLifecycle?.status:r.status)===f.status)&&(!f.from||!!date&&date>=f.from)&&(!f.to||!!date&&date<=f.to);
  }).sort((a,b)=>f.sort==='name'?a.studentName.localeCompare(b.studentName):f.sort==='waiting'?(b.waitingDays??-1)-(a.waitingDays??-1):String(f.appointments?b.appointmentDate??b.coordinatorDecisionAt??'':b.submittedAt??b.submittedDate).localeCompare(String(f.appointments?a.appointmentDate??a.coordinatorDecisionAt??'':a.submittedAt??a.submittedDate)));
}
function date(value?:string|null){return formatRequestDisplayDate(panelRecordedDate(value));}
export function PanelBrowse({scope,title,description,records,onOpen,canReview,appointments=false,initialHistory=false,exportable=false,embedded=false,view:controlledView,onViewChange,requestViewForRecord}:{scope:string;title:string;description?:string;records:PanelPresentation[];onOpen:(row:PanelPresentation)=>void;canReview?:(row:PanelPresentation)=>boolean;appointments?:boolean;initialHistory?:boolean;exportable?:boolean;embedded?:boolean;view?:RequestListView;onViewChange?:(view:RequestListView)=>void;requestViewForRecord?:(record:PanelPresentation)=>RequestListView}) {
  const excel = useExcelExport();
  const monitoring = useOfficeMonitoring();
  const pendingApprovals = monitoring?.view === 'panel-pending';
  if (pendingApprovals) records = records.filter(record => record.status === 'PENDING_COORDINATOR');
  const key=`PanelBrowse:${scope}`;
  const [rememberedView,setView]=useListState<'requests'|'history'>(key,'view',initialHistory?'history':'requests');
  const view=pendingApprovals?'requests':controlledView??rememberedView;
  const [q,setQ]=useListState(key,'q',''),[programme,setProgramme]=useListState(key,'programme',''),[semester,setSemester]=useListState(key,'semester',''),[status,setStatus]=useListState(key,'status',''),[from,setFrom]=useListState(key,'from',''),[,setTo]=useListState(key,'to',''),[sort,setSort]=useListState(key,'sort',appointments?'name':initialHistory?'newest':'waiting');
  const [page,setPage]=useListState(key,'page',1),[size,setSize]=useListState(key,'size',10);
  const base=appointments?records.filter(r=>!!r.appointmentLifecycle):records.filter(r=>r.status!=='NOT_SUBMITTED');
  const facet=filterPanelBrowse(base,{view,appointments,requestViewForRecord});
  const change=(setter:(value:string)=>void)=>(value:string)=>{setter(value);setPage(1);};
  const options=(field:'programme'|'semester')=>[...new Set(facet.map(r=>r[field]??'').filter(Boolean))].sort();
  const statuses=[...new Set(facet.map(r=>appointments?r.appointmentLifecycle!.status:r.status))];
  const effectiveStatus=!(appointments&&view==='requests')&&statuses.some(value=>value===status)?status:'';
  const filtered=filterPanelBrowse(base,{view,q,programme,semester,status:effectiveStatus,from,sort,appointments,requestViewForRecord}).sort((a,b)=>!appointments&&view==='requests'&&sort==='waiting'?Number(!!canReview?.(b))-Number(!!canReview?.(a)):0);
  const pageCount=Math.max(1,Math.ceil(filtered.length/size)),safePage=Math.min(page,pageCount);
  useEffect(()=>{if(page!==safePage)setPage(safePage);},[page,safePage,setPage]);
  const reset=()=>{setQ('');setProgramme('');setSemester('');setStatus('');setFrom('');setTo('');setSort(appointments?'name':view==='requests'?'waiting':'newest');setPage(1);};
  const changeView=(value:'requests'|'history')=>{setView(value);onViewChange?.(value);reset();setSort(appointments?'name':value==='requests'?'waiting':'newest');};
  const statusFilter=!(appointments&&view==='requests')?<label className="form-label">Status<PortalSelect className="form-control form-control-sm mt-1" value={effectiveStatus} onChange={e=>change(setStatus)(e.target.value)}><option value="">All statuses</option>{statuses.map(v=><option value={v} key={v}>{panelStatusLabel(v)}</option>)}</PortalSelect></label>:null;
  const secondaryFilters=<>
    <label className="form-label min-w-0">Programme<PortalSelect className="form-control form-control-sm mt-1" value={programme} onChange={e=>change(setProgramme)(e.target.value)}><option value="">All programmes</option>{options('programme').map(v=><option key={v}>{v}</option>)}</PortalSelect></label>
    <label className="form-label min-w-0">Semester<PortalSelect className="form-control form-control-sm mt-1" value={semester} onChange={e=>change(setSemester)(e.target.value)}><option value="">All semesters</option>{options('semester').map(v=><option key={v}>{v}</option>)}</PortalSelect></label>
    {statusFilter}
    <label className="form-label min-w-0">{appointments?'Appointment date':'Submitted'} on or after<input className="form-control form-control-sm mt-1" type="date" value={from} onChange={e=>change(setFrom)(e.target.value)}/></label>
    <label className="form-label min-w-0">Sort by<PortalSelect className="form-control form-control-sm mt-1" value={sort} onChange={e=>change(setSort)(e.target.value)}>{!appointments&&(view==='requests'||sort==='waiting')?<option value="waiting">Longest waiting at this stage</option>:null}<option value="newest">Newest first</option><option value="name">Student name</option></PortalSelect></label>
  </>;
  const reviewHistory=!!requestViewForRecord&&!appointments&&view==='history';
  const finalHistory = !appointments && view === 'history' && !reviewHistory;
  const columns=['Student','Programme','Panel member',appointments?'Appointment status':finalHistory?'Outcome':'Current stage',...(reviewHistory?['Your Panel decision']:[]),...(!finalHistory?[appointments?'Started on':'Waiting at this stage']:[]),...(appointments&&view==='history'?['Ended on','Outcome']:[]),'Action'];
  const exportRows=()=>excel.download('panel_appointment_records.xlsx',filtered,[{header:'Student ID',value:r=>r.studentId},{header:'Student Name',value:r=>r.studentName},{header:'Programme',value:r=>r.programme},{header:'Semester',value:r=>r.semester??''},{header:'Supervisor',value:r=>r.supervisorName??''},{header:'Panel Member',value:r=>r.recommendedMember},{header:'Status',value:r=>panelStatusLabel(appointments?r.appointmentLifecycle!.status:r.status)},{header:'Submitted',value:r=>date(r.submittedAt||r.submittedDate)},{header:'Waiting at this stage',value:r=>panelRequestPending(r.status)?r.waitingDays??'Not recorded':'Final outcome recorded'}]);
  const headerDescription = [description, appointments ? (view === 'requests' ? 'Current appointments are active Panel assignments. They can continue across semesters.' : 'These assignments have ended. View their dates and recorded outcomes.') : null].filter(Boolean).join(' ');
  return <section className={embedded ? "space-y-5 [&_td]:[overflow-wrap:anywhere]" : "appointment-workspace-card rounded-2xl border border-slate-200 bg-white shadow-sm [&_td]:[overflow-wrap:anywhere]"}><OfficeMonitoringNotice/>
    <WorkspaceSectionHeader title={embedded ? undefined : title} description={headerDescription} actions={<>{appointments?<AppointmentViewSwitch view={view==='history'?'past':'current'} onChange={value=>changeView(value==='past'?'history':'requests')} currentLabel="Current" pastLabel="Past"/>:pendingApprovals?null:<RequestViewSwitch view={view} reviewCount={canReview?base.filter(canReview).length:0} onChange={changeView}/>}</>}/>
    <WorkspaceFilterCard fieldsClassName="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4" onReset={reset} actions={exportable?<PortalButton variant="primary" size="sm" icon={Download} title="Download all matching records across every page as Excel" aria-description="Includes all filtered records across every page" disabled={!filtered.length||excel.busy} isLoading={excel.busy} onClick={()=>void exportRows()}>Export Excel</PortalButton>:null}>
      <label className="form-label min-w-0">{appointments?'Find an appointment':'Find a request'}<input className="form-control form-control-sm mt-1" type="search" value={q} onChange={e=>change(setQ)(e.target.value)} placeholder="Student, matric number, Panel or supervisor"/></label>
      {secondaryFilters}
    </WorkspaceFilterCard>
    {excel.error?<p role="alert" className="card-description text-rose-700">{excel.error}</p>:null}
    {filtered.length?<CoordinatorDataTable label={title} columns={columns} rows={filtered.slice((safePage-1)*size,safePage*size).map((r,index)=>({key:`${r.appointmentLifecycle?.appointmentId??r.id??r.studentId}-${index}`,cells:[<><p>{r.studentName}</p><p className="card-caption mt-1">{r.studentId}</p></>,r.programme||'Not recorded',r.recommendedMember||'Not recorded',<StatusBadge tone={panelStatusTone(appointments?r.appointmentLifecycle!.status:r.status)}>{panelStatusLabel(appointments?r.appointmentLifecycle!.status:r.status)}</StatusBadge>,...(reviewHistory?[<><p>{r.selectedPanelDecision==='ACCEPTED'?'Accepted':r.selectedPanelDecision==='REJECTED'?'Rejected':'No decision recorded'}</p>{r.selectedPanelDecision?<p className="card-caption mt-1">{date(r.panelDecisionAt)}</p>:null}</>]:[]),...(!finalHistory?[appointments?date(r.appointmentDate||r.coordinatorDecisionAt):panelRequestPending(r.status)?r.waitingDays==null?'Waiting time unavailable':`${r.waitingDays} calendar ${r.waitingDays===1?'day':'days'}`:panelStatusLabel(r.status)]:[]),...(appointments&&view==='history'?[date(r.appointmentLifecycle?.endedAt),panelStatusLabel(r.appointmentLifecycle?.endOutcome||r.appointmentLifecycle!.status)]:[]),<div className="flex justify-end"><PortalButton size="sm" data-panel-record-action className="min-h-11 whitespace-nowrap" aria-label={`${appointments?'View appointment':canReview?.(r)?'Review request':'View request'} for ${r.studentName}`} variant={canReview?.(r)?'primary':'secondary'} onClick={()=>onOpen(r)}>{appointments?'View appointment':canReview?.(r)?'Review request':'View request'}</PortalButton></div>]}))}/>:<p role="status" className="card-description py-6 text-center">{q||programme||semester||effectiveStatus||from?`No matching ${appointments?'appointments':'requests'}. Adjust the filters to see more records.`:appointments?view==='history'?'No past appointments.':'No current appointments.':view==='history'?requestViewForRecord?'No reviewed or cancelled requests yet.':'No final request outcomes yet.':'No ongoing appointment requests.'}</p>}
    <WorkspacePagination page={safePage} pageCount={pageCount} total={filtered.length} pageSize={size} noun={appointments?'appointments':'requests'} onPage={setPage} onPageSize={value=>{setSize(value);setPage(1);}}/>
  </section>;
}
