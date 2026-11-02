import {Info} from 'lucide-react';
import {AlertMessage} from './AlertMessage';
import {SubmissionScheduleField} from './SubmissionScheduleField';
import {TimelineEventPicker} from './TimelineEventPicker';
import {EventDateImport} from './EventDateImport';
import {extensionImpact} from '../utils/linkedWindowDates';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router';
import {APP_ROUTES} from '../constants/routes';
import type {EvaluationPeriodOption, EvaluationPreviewTask, CompletionWindow} from '../types/marks';
import type {SemesterTimelineEntry} from '../types/timeline';
import type {AcademicSemesterLifecycle} from '../types/academicSemester';
import type {OperationalActivity, OperationalException, OperationalExceptionCandidate, OperationalPeriod, OperationalPeriodsResponse,OperationalHistoryEvent} from '../types/operationalPeriods';
import {createOperationalPeriod,updateOperationalPeriod,transitionOperationalPeriod,getOperationalPeriods,publishOperationalPeriod,setOperationalEnforcement,getOperationalExceptions,getOperationalExceptionCandidates,revokeOperationalException} from '../services/operationalPeriodsApi';
import {getEvaluationPeriod,getEvaluationPeriods,getEvaluationPreviewTasks,getMarksProgrammeOptions} from '../services/marksApi';
import {getCompletionWindows,revokeCompletionWindow} from '../services/marksCompletionApi';
import {formatMalaysiaDateTime,formatMalaysiaDate,malaysiaDeadline,toMalaysiaDateTimeLocalValue} from '../utils/malaysiaDateTime';
import {submitDeadlineExtension,type DeadlineExtensionTarget} from '../utils/operationalDeadlineExtension';
import {completeDecision,createDecisionSubmission,decisionFailure} from '../utils/decisionSubmission';
import {canEditTimelineSemester,defaultMarksExtensionScope,getOperationalProgrammeOptions} from '../utils/operationalPeriodAccess';
import {PortalButton,PortalCard,PortalToast,StatusBadge,getStatusBadgeTone} from './PortalPrimitives';
import {CoordinatorDataTable} from './CoordinatorBrowsePrimitives';
import {PeriodActivityOverview} from './PeriodActivityOverview';
import {PeriodCalendarConnection,type PeriodCalendarStatus} from './PeriodCalendarConnection';
import {marksConfigurationRoute,programmeWindowCoverage} from '../utils/periodPresentation';
import {PortalSelect} from './PortalSelect';
import {DecisionDialog} from './DecisionDialog';
import {DraftNavigationGuard} from './DraftNavigationGuard';
import {RecordPage} from './RecordPage';
import {SubmissionWindowDialog} from './SubmissionWindowDialog';
import {DecisionFeedbackProvider,useDecisionFeedback} from './DecisionFeedback';
import {parsePeriodAnchor} from './officePeriodHelpers';
import {SupervisorRequestDisclosure} from './SupervisorRequestFields';

/** Show shared schedules once, while keeping every programme and coverage gap visible. */
export function ProgrammeCoverageReview({coverage}:{coverage:ReturnType<typeof programmeWindowCoverage>}) {
  const windows=[...new Map(coverage.flatMap(row=>row.periods.map(period=>[period.id,period] as const))).values()];
  const uncovered=coverage.filter(row=>!row.periods.length);
  return <section aria-label="Programme coverage review" className="space-y-4 text-xs leading-6 text-slate-700">
    <h3 className="text-sm font-semibold text-slate-900">Published windows</h3>
    {windows.map(period=><article key={period.id} className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><h4 className="min-w-0 flex-1 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{period.name}</h4><WindowScheduleStatus lifecycleStatus={period.lifecycleStatus} effectiveStatus={period.effectiveStatus}/></div>
      <div><p className="mb-1 text-slate-500">Programmes</p><ul className="space-y-1">{coverage.filter(row=>row.periods.some(item=>item.id===period.id)).map(row=><li key={row.programme}>{row.programme}</li>)}</ul></div>
      <div className="border-t border-slate-100 pt-3"><p className="mb-2 text-slate-500">Malaysia time (UTC+08:00)</p><dl className="grid gap-3 sm:grid-cols-2">{[['Opens',period.opensAt],['Closes',period.closesAt]].map(([label,value])=><div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-900"><time dateTime={value}>{formatMalaysiaDateTime(value).replace(' (Malaysia, UTC+08:00)','')}</time></dd></div>)}</dl></div>
    </article>)}
    {uncovered.length?<div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-900">No published window. New submissions will be blocked.</p><ul className="space-y-1 text-amber-900">{uncovered.map(row=><li key={row.programme}>{row.programme}</li>)}</ul></div>:null}
  </section>;
}

export function WindowSubmissionAccess({lifecycleStatus,effectiveStatus,enforced}:{lifecycleStatus:string;effectiveStatus:string;enforced:boolean}) {
 const label=lifecycleStatus!=='PUBLISHED'?lifecycleStatus:!enforced?'Dates unrestricted':effectiveStatus==='OPEN'?'Accepting submissions':effectiveStatus==='UPCOMING'||effectiveStatus==='SCHEDULED'?'Not open yet':'Submissions closed';
 const tone=lifecycleStatus==='DRAFT'?'warning':label==='Accepting submissions'?'success':label==='Not open yet'?'info':'neutral';
 return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

export function WindowScheduleStatus({lifecycleStatus,effectiveStatus}:{lifecycleStatus:string;effectiveStatus:string}) {
 const status=lifecycleStatus==='PUBLISHED'?effectiveStatus:lifecycleStatus;
 const label=status==='ENDED'?'CLOSED':status;
 return <StatusBadge tone={getStatusBadgeTone(label)}>{label}</StatusBadge>;
}

const activities:OperationalActivity[]=['SUPERVISOR_APPLICATION','PANEL_RECOMMENDATION'];
const activityName=(value:OperationalActivity)=>value==='SUPERVISOR_APPLICATION'?'Supervisor applications':'Panel recommendations';
const errorMessage=(failure:unknown)=>failure instanceof Error?failure.message:'The records could not be loaded.';
type Extension={target:DeadlineExtensionTarget;name:string};
type Action={kind:'publish'|'close'|'archive';period:OperationalPeriod}|{kind:'enforcement';activity:OperationalActivity;enabled:boolean}|{kind:'revoke-appointment';id:number}|{kind:'revoke-marks';id:number};

function WindowDateTime({value}:{value:string}) {
  const local=toMalaysiaDateTimeLocalValue(value);
  if(!local) return <span className="card-description">{formatMalaysiaDateTime(value)}</span>;
  const time=new Date(value).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'});
  return <time dateTime={value} className="card-description block"><span className="block whitespace-nowrap">{formatMalaysiaDate(value)}</span><span className="block whitespace-nowrap mt-1">{time} MYT</span></time>;
}

const windowStamp=(value:string)=>formatMalaysiaDateTime(value).replace(' (Malaysia, UTC+08:00)','');

/** Match appointment history rows; only show fields whose displayed value changed. */
export function OperationalHistory({events}:{events:OperationalHistoryEvent[]}) {
  if(!events.length)return <p className="card-description">No window changes recorded.</p>;
  const labels:Record<string,string>={CREATE:'Window created',UPDATE:'Window updated',PUBLISH:'Window published',CLOSE:'Submissions closed',ARCHIVE:'Window archived',EXTEND:'Deadline extended',GRANT:'Extra time granted',RENEW:'Extra time renewed',REVOKE:'Extra time revoked'};
  const fields:[string,string,(value:unknown)=>string][]=[
    ['name','Name',value=>String(value??'')],
    ['opensAt','Opens',value=>typeof value==='string'?windowStamp(value):''],
    ['closesAt','Closes',value=>typeof value==='string'?windowStamp(value):''],
    ['deadline','Deadline',value=>typeof value==='string'?windowStamp(value):''],
    ['programmeScope','Programme scope',value=>value==='ALL'?'All programmes':'Selected programmes'],
    ['programmes','Programmes',value=>Array.isArray(value)?[...value].sort().join(', '):''],
    ['evaluatorRoles','Evaluator roles',value=>Array.isArray(value)?[...value].sort().map(role=>role==='SUPERVISOR'?'Supervisor':role==='PANEL'?'Panel':String(role)).join(', '):''],
  ];
  return <ol aria-label="Period change history" className="divide-y divide-slate-200">{events.map(event=>{
    const changes=event.action==='CREATE'?[]:fields.flatMap(([key,label,format])=>{
      if(!(key in event.before)||!(key in event.after))return [];
      const before=format(event.before[key]),after=format(event.after[key]);
      return before!==after?[{label,before,after}]:[];
    });
    return <li key={event.id} className="space-y-2 py-5 first:pt-0 last:pb-0 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"><p className="card-value">{labels[event.action]??event.action.replaceAll('_',' ').toLowerCase().replace(/^./,letter=>letter.toUpperCase())}</p><time dateTime={event.createdAt} className="card-caption text-slate-500">{windowStamp(event.createdAt)}</time></div>
      <p className="card-description">{event.actorName}</p>
      {changes.length?<dl className="space-y-2">{changes.map(change=><div key={change.label} className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]"><dt className="card-description">{change.label}</dt><dd className="text-sm leading-6 text-slate-700"><span className="text-slate-500">{change.before||'Not set'}</span> → {change.after||'Not set'}</dd></div>)}</dl>:null}
      {event.reason?<p className="card-description whitespace-pre-wrap">{event.reason}</p>:null}
    </li>;
  })}</ol>;
}

export function CalendarPeriodLinkFields({entries,selectedId,onChange}: {
  entries:SemesterTimelineEntry[];selectedId:string;onChange:(value:string)=>void;
}) {
  return <div className="space-y-3"><p className="card-description">Owning period dates will appear on the selected calendar event. Choose the event explicitly after reviewing its meaning.</p>
    {entries.length?<label className="form-label block">Calendar event<PortalSelect className="form-control form-control-md mt-1" value={selectedId} onChange={event=>onChange(event.target.value)}><option value="">Select an unlinked calendar event</option>{entries.map(entry=><option key={entry.id} value={entry.id}>{entry.title} · {entry.level} · {formatMalaysiaDate(entry.deadlineStart)} to {formatMalaysiaDate(entry.deadlineEnd)}</option>)}</PortalSelect></label>:<p className="card-description">Create or import an informational calendar event first, then return here to link it.</p>}


  </div>;
}

export function DeadlineExtensionScopeFields({kind,value,onChange,everyoneAllowed}: {
  kind:DeadlineExtensionTarget['kind'];value:'everyone'|'selected';onChange:(value:'everyone'|'selected')=>void;everyoneAllowed:boolean;
}) {
  return <label className="form-label block">Apply to<PortalSelect className="form-control form-control-md mt-1" value={value} onChange={event=>onChange(event.target.value as 'everyone'|'selected')}><option value="everyone" disabled={!everyoneAllowed}>Everyone in period scope</option>{kind!=='event'?<option value="selected">Selected cases / tasks</option>:null}</PortalSelect></label>;
}

export function OperationalPeriodManagement({semesterId,semesterLifecycle,entries,onTimelineRefresh,onInteractionChange,manageLinkedWindow,periodAnchor,calendarStatus='ready',semesterLabel}: {
  semesterId:number; semesterLifecycle:AcademicSemesterLifecycle; entries:SemesterTimelineEntry[]; onTimelineRefresh:()=>Promise<unknown>|void; onInteractionChange?:(busy:boolean)=>void;manageLinkedWindow?:boolean;periodAnchor?:string;calendarStatus?:PeriodCalendarStatus;semesterLabel?:string;
}) {
  return <DecisionFeedbackProvider scopeKey={`operational-periods:${semesterId}`}><OperationalPeriodManagementContent semesterId={semesterId} semesterLifecycle={semesterLifecycle} entries={entries} onTimelineRefresh={onTimelineRefresh} onInteractionChange={onInteractionChange} manageLinkedWindow={manageLinkedWindow} periodAnchor={periodAnchor} calendarStatus={calendarStatus} semesterLabel={semesterLabel}/></DecisionFeedbackProvider>;
}

function OperationalPeriodManagementContent({semesterId,semesterLifecycle,entries,onTimelineRefresh,onInteractionChange,manageLinkedWindow,periodAnchor,calendarStatus,semesterLabel}: {
  semesterId:number; semesterLifecycle:AcademicSemesterLifecycle; entries:SemesterTimelineEntry[]; onTimelineRefresh:()=>Promise<unknown>|void; onInteractionChange?:(busy:boolean)=>void;manageLinkedWindow?:boolean;periodAnchor?:string;calendarStatus:PeriodCalendarStatus;semesterLabel?:string;
}) {
  const calendarEditable=canEditTimelineSemester(semesterLifecycle);
  const [data,setData]=useState<OperationalPeriodsResponse|null>(null);
  const [marks,setMarks]=useState<EvaluationPeriodOption[]>([]);
  const [tasks,setTasks]=useState<EvaluationPreviewTask[]>([]);
  const [programmes,setProgrammes]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const generation=useRef(0);
  const focusedAnchor=useRef('');
  const [createOpen,setCreateOpen]=useState(false);
  const [activeTab,setActiveTab]=useState<OperationalActivity|'MARKS'>('SUPERVISOR_APPLICATION');
  const [formError,setFormError]=useState('');
  const [formNotice,setFormNotice]=useState('');
  const [formBlocked,setFormBlocked]=useState(false);
  const [creationLinkConflict,setCreationLinkConflict]=useState(false);
  const [notice,setNotice]=useState<{message:string;tone:'success'|'warning'}|null>(null);
  const formSubmission=useRef(createDecisionSubmission());
  const initialForm=useRef('');
  const feedback=useDecisionFeedback();
  const [editingPeriod,setEditingPeriod]=useState<OperationalPeriod|null>(null);
  const [editReason,setEditReason]=useState('');
  const [timelineEntryId,setTimelineEntryId]=useState('');
  const [activity,setActivity]=useState<OperationalActivity>('SUPERVISOR_APPLICATION');
  const [name,setName]=useState('');
  const [programmeScope,setProgrammeScope]=useState<'ALL'|'SELECTED'>('ALL');
  const [selectedProgrammes,setSelectedProgrammes]=useState<string[]>([]);
  const [opensAt,setOpensAt]=useState('');
  const [closesAt,setClosesAt]=useState('');
  const formSnapshot=JSON.stringify([activity,name,programmeScope,selectedProgrammes,opensAt,closesAt,editReason,timelineEntryId]);
  const formDirty=createOpen&&formSnapshot!==initialForm.current;
  const [action,setAction]=useState<Action|null>(null);
  const [actionReason,setActionReason]=useState('');
  const [actionConfirmed,setActionConfirmed]=useState(false);
  const [managed,setManaged]=useState<{kind:'appointment'|'marks';id:number}|null>(null);
  const [calendarBusy,setCalendarBusy]=useState(false);
  const [extension,setExtension]=useState<Extension|null>(null);
  const [scope,setScope]=useState<'everyone'|'selected'>('everyone');
  const initialExtension=useRef<{scope:'everyone'|'selected';deadline:string}>({scope:'everyone',deadline:''});
  const [deadline,setDeadline]=useState('');
  const [reason,setReason]=useState('');
  const [candidates,setCandidates]=useState<OperationalExceptionCandidate[]>([]);
  const [selectedCandidate,setSelectedCandidate]=useState('');
  const [taskIds,setTaskIds]=useState<number[]>([]);
  const [detailLoading,setDetailLoading]=useState(false);
  const [detailError,setDetailError]=useState<string|null>(null);
  const [history,setHistory]=useState<{kind:'appointment'|'marks';id:number;name:string}|null>(null);
  const [exceptions,setExceptions]=useState<OperationalException[]>([]);
  const [windows,setWindows]=useState<CompletionWindow[]>([]);
  const [historyTask,setHistoryTask]=useState('');
  const detailGeneration=useRef(0);
  const candidateGeneration=useRef(0);
  const [mutationBusy,setMutationBusy]=useState(false);
  const interacting=createOpen||managed!==null||action!==null||extension!==null||calendarBusy||mutationBusy;
  useEffect(()=>{onInteractionChange?.(interacting);},[interacting,onInteractionChange]);
  useEffect(()=>()=>onInteractionChange?.(false),[onInteractionChange]);

  const load=useCallback(async()=>{
    const version=++generation.current;setLoading(true);setError(null);
    try {
      const [periods,marksPeriods,preview,options]=await Promise.all([getOperationalPeriods(semesterId),getEvaluationPeriods(true),getEvaluationPreviewTasks(),getMarksProgrammeOptions()]);
      if(version!==generation.current)return;
      setData(periods);setMarks(marksPeriods.filter(period=>period.semesterId===semesterId));setTasks(preview);setProgrammes(getOperationalProgrammeOptions(options));
    }catch(failure){if(version===generation.current){setError(errorMessage(failure));throw failure;}}
    finally{if(version===generation.current)setLoading(false);}
  },[semesterId]);
  useEffect(()=>{void load().catch(()=>{});return()=>{generation.current+=1;detailGeneration.current+=1;candidateGeneration.current+=1;};},[load]);

  useEffect(()=>{
    if(loading||error)return;
    const followAnchor=()=>{
      const hash=periodAnchor??window.location.hash;
      if(hash==='#period-panel-MARKS') {
        if(focusedAnchor.current===hash)return;
        if(activeTab!=='MARKS'){setActiveTab('MARKS');return;}
        focusedAnchor.current=hash;
        document.getElementById('period-panel-MARKS')?.focus();
        return;
      }
      const anchor=parsePeriodAnchor(hash);
      if(!anchor){focusedAnchor.current='';return;}
      if(focusedAnchor.current===hash)return;
      const targetTab=anchor.kind==='marks'?'MARKS':data?.periods.find(period=>period.id===anchor.id)?.activity;
      if(!targetTab)return;
      if(targetTab!==activeTab){setActiveTab(targetTab);return;}
      if(manageLinkedWindow){
        const exists=anchor.kind==='marks'?marks.some(period=>period.id===anchor.id):data?.periods.some(period=>period.id===anchor.id);
        if(exists){focusedAnchor.current=hash;setHistory(null);setManaged({kind:anchor.kind,id:anchor.id});}
        return;
      }
      const target=document.getElementById(`${anchor.kind==='marks'?'marks':'operational'}-period-${anchor.id}`);
      if(target){focusedAnchor.current=hash;target.scrollIntoView({block:'start'});target.focus({preventScroll:true});}
    };
    followAnchor();window.addEventListener('hashchange',followAnchor);
    return()=>{window.removeEventListener('hashchange',followAnchor);};
  },[loading,error,data,marks,activeTab,periodAnchor,manageLinkedWindow]);

  const refreshHistory=useCallback(async()=>{
    if(!history)return;
    const version=++detailGeneration.current;setDetailLoading(true);setDetailError(null);
    try{
      if(history.kind==='appointment') {
        const result=await getOperationalExceptions(history.id);
        if(version===detailGeneration.current)setExceptions(result.exceptions);
      } else {
        const [period,result]=await Promise.all([getEvaluationPeriod(history.id),historyTask?getCompletionWindows(Number(historyTask)):Promise.resolve(null)]);
        if(version===detailGeneration.current){
          setMarks(values=>values.map(value=>value.id===period.id?period:value));
          setWindows(result?.windows??[]);
        }
      }
    }catch(failure){if(version===detailGeneration.current)setDetailError(errorMessage(failure));throw failure;}
    finally{if(version===detailGeneration.current)setDetailLoading(false);}
  },[history,historyTask]);
  useEffect(()=>{setExceptions([]);setWindows([]);void refreshHistory().catch(()=>{});return()=>{detailGeneration.current+=1;};},[refreshHistory]);

  const openExtension=async(value:Extension)=>{
    initialExtension.current={scope:value.target.kind==='marks'&&value.target.allowEveryone===false?'selected':'everyone',deadline:value.target.kind==='event'?value.target.closesAt?.slice(0,10)??'':toMalaysiaDateTimeLocalValue(value.target.closesAt)};
    ++candidateGeneration.current;setHistory(null);setExtension(value);setScope(initialExtension.current.scope);setDeadline(initialExtension.current.deadline);setReason('');setTaskIds([]);setCandidates([]);setSelectedCandidate('');setDetailError(null);setDetailLoading(false);
    if(value.target.kind==='appointment'){
      const version=++candidateGeneration.current;setDetailLoading(true);
      try{const result=await getOperationalExceptionCandidates(value.target.id);if(version===candidateGeneration.current)setCandidates(result.candidates);}
      catch(failure){if(version===candidateGeneration.current)setDetailError(errorMessage(failure));}
      finally{if(version===candidateGeneration.current)setDetailLoading(false);}
    }
  };
  const refreshAll=async()=>{await load();await onTimelineRefresh();};
  const runMutation=async(save:()=>Promise<unknown>,refresh:()=>Promise<unknown>=refreshAll)=>{
    setMutationBusy(true);
    try{return await completeDecision(save,refresh);}finally{setMutationBusy(false);}
  };
  const confirmCreate=()=>runMutation(async()=>{
    if(!calendarEditable)throw new Error('Appointment periods require a Draft or Active semester.');
    const opening=malaysiaDeadline(opensAt),closing=malaysiaDeadline(closesAt);
    if(new Date(opening)>=new Date(closing))throw new Error('The deadline must be later than the opening time.');
    if(!name.trim())throw new Error('A period name is required.');
    if(programmeScope==='SELECTED'&&!selectedProgrammes.length)throw new Error('Select at least one programme.');
    const payload={semesterId,activity,name:name.trim(),programmeScope,programmes:programmeScope==='ALL'?[]:selectedProgrammes,opensAt:opening,closesAt:closing};
    if(editingPeriod){
      if(!editReason.trim())throw new Error('A reason for the change is required.');
      const {semesterId:_,activity:__,...editable}=payload;
      await updateOperationalPeriod(editingPeriod.id,{...editable,expectedRevision:editingPeriod.revision,reason:editReason.trim()});
    }else {
      if(timelineEntryId&&(calendarStatus!=='ready'||!entries.some(entry=>String(entry.id)===timelineEntryId&&!entry.operationalPeriodId&&!entry.marksPeriodId)))throw new Error('Reload calendar events and choose an available event before saving.');
      await createOperationalPeriod({...payload,...(timelineEntryId?{timelineEntryId:Number(timelineEntryId)}:{})});
    }
  });
  const confirmAction=async()=>{
    if(!action)return false;
    if(!calendarEditable&&action.kind!=='revoke-marks'&&action.kind!=='revoke-appointment')throw new Error('Appointment period changes require a Draft or Active semester.');
    if(action.kind!=='publish'&&!actionReason.trim())throw new Error('A reason is required.');
    if(action.kind==='enforcement'&&action.enabled&&!actionConfirmed)throw new Error('Confirm the programme coverage and submission rules first.');
    return runMutation(async()=>{
      if(action.kind==='publish')return publishOperationalPeriod(action.period.id,action.period.revision);
      if(action.kind==='close'||action.kind==='archive')return transitionOperationalPeriod(action.period.id,action.kind,action.period.revision,actionReason.trim());
      if(action.kind==='enforcement')return setOperationalEnforcement({semesterId,activity:action.activity,enabled:action.enabled,reason:actionReason.trim()});
      if(action.kind==='revoke-appointment')return revokeOperationalException(action.id,actionReason.trim());
      if(action.kind==='revoke-marks')return revokeCompletionWindow(action.id,actionReason.trim());
      throw new Error('Unknown period action.');
    },async()=>{await refreshAll();if(history)await refreshHistory();});
  };
  const openAction=(value:Action)=>{setActionReason('');setActionConfirmed(false);setAction(value);};
  const openPeriodForm=(period:OperationalPeriod|null)=>{
    setManaged(null);setHistory(null);
    formSubmission.current=createDecisionSubmission();setFormError('');setFormNotice('');setFormBlocked(false);setCreationLinkConflict(false);
    setEditingPeriod(period);setEditReason('');setTimelineEntryId('');setName(period?.name??'');
    const formActivity=period?.activity??(activeTab==='MARKS'?'SUPERVISOR_APPLICATION':activeTab);
    setActivity(formActivity);setProgrammeScope(period?.programmeScope??'ALL');
    setSelectedProgrammes(period?.programmes??[]);setOpensAt(toMalaysiaDateTimeLocalValue(period?.opensAt));
    setClosesAt(toMalaysiaDateTimeLocalValue(period?.closesAt));setCreateOpen(true);
    initialForm.current=JSON.stringify([formActivity,period?.name??'',period?.programmeScope??'ALL',period?.programmes??[],toMalaysiaDateTimeLocalValue(period?.opensAt),toMalaysiaDateTimeLocalValue(period?.closesAt),'','']);
  };
  const savePeriodForm=async()=>{
    if(formSubmission.current.isBusy()||formSubmission.current.isBlocked()||mutationBusy)return;
    setFormError('');
    try {
      const result=await formSubmission.current.run(confirmCreate);
      if(!result.started)return;
      const outcome={message:result.value.refreshFailed?'Submission window saved. The latest record could not be loaded. Reload before another action.':'Submission window saved.',tone:result.value.refreshFailed?'warning' as const:'success' as const};
      if(feedback)feedback(outcome.message,outcome.tone);else setNotice(outcome);
      setCreateOpen(false);
    }catch(failure){const outcome=decisionFailure(failure);setFormError(outcome.message);setFormBlocked(outcome.blocked);setCreationLinkConflict(!editingPeriod&&!!timelineEntryId&&typeof failure==='object'&&failure!==null&&'status' in failure&&failure.status===409);}
  };
  const openHistory=(value:NonNullable<typeof history>)=>{
    candidateGeneration.current+=1;setExtension(null);setDetailLoading(false);setDetailError(null);setHistoryTask('');setHistory(value);
  };
  const scopedTasks=tasks.filter(task=>task.periodId===(extension?.target.kind==='marks'?extension.target.id:history?.kind==='marks'?history.id:null));
  const eligibleTasks=scopedTasks.filter(task=>task.taskId&&task.status!=='SUBMITTED'&&task.canGrantCompletionWindow);
  const linkableEntries=entries.filter(entry=>!entry.operationalPeriodId&&!entry.marksPeriodId);
  const selectedCalendarEvent=linkableEntries.find(entry=>String(entry.id)===timelineEntryId);
  const editingLinkedEvents=editingPeriod?entries.filter(entry=>entry.operationalPeriodId===editingPeriod.id):[];
  const extensionPeriod=extension?.target.kind==='appointment'?data?.periods.find(period=>period.id===extension.target.id):undefined;
  const extensionLinkedEvents=extension?entries.filter(entry=>extension.target.kind==='appointment'?entry.operationalPeriodId===extension.target.id:extension.target.kind==='marks'?entry.marksPeriodId===extension.target.id:false):[];
  const extensionEnforced=!!extensionPeriod&&!!data?.enforcement[extensionPeriod.activity];
  const managedAppointment=managed?.kind==='appointment'?data?.periods.find(period=>period.id===managed.id):null;
  const managedMarks=managed?.kind==='marks'?marks.find(period=>period.id===managed.id):null;
  const managedWindow=managedAppointment??managedMarks;
  const recordReady=!loading&&!error;
  useEffect(()=>{
    if(managed&&data&&!loading&&!error&&!managedWindow){setManaged(null);setHistory(null);setNotice({message:'This window is no longer available. The overview has been refreshed.',tone:'warning'});}
  },[managed,data,loading,error,managedWindow]);
  const coverage=action?.kind==='enforcement'?programmeWindowCoverage(data?.periods.filter(period=>period.activity===action.activity)??[],programmes):[];
  const openManaged=(kind:'appointment'|'marks',id:number)=>{setHistory(null);setManaged({kind,id});};
  const selectActivity=(code:OperationalActivity|'MARKS')=>{setActiveTab(code);setHistory(null);requestAnimationFrame(()=>document.getElementById(`period-panel-${code}`)?.focus({preventScroll:true}));};
  const historyContent=history?<section aria-label="Window history" className="space-y-5">
      {history.kind==='appointment'?<OperationalHistory events={data?.periods.find(period=>period.id===history.id)?.history??[]}/>:<OperationalHistory events={(marks.find(period=>period.id===history.id)?.auditEvents??[]).map(event=>({...event,before:event.beforeValues,after:event.afterValues}))}/>}
      {history.kind==='marks'&&scopedTasks.some(task=>task.taskId)?<label className="form-label block">Evaluation task<PortalSelect className="form-control form-control-md mt-1" value={historyTask} onChange={event=>setHistoryTask(event.target.value)}><option value="">Select task</option>{scopedTasks.filter(task=>task.taskId).map(task=><option key={task.taskId} value={task.taskId}>{task.studentName} · {task.panelMember} · {task.evaluatorRoleLabel??task.evaluatorRole} · {task.status}</option>)}</PortalSelect></label>:null}
      {detailLoading?<p role="status">Loading history…</p>:detailError?<AlertMessage type="error" title="Couldn’t load extra time history" message={detailError} actions={<PortalButton onClick={()=>void refreshHistory().catch(()=>{})}>Retry history</PortalButton>}/>:<>

        {history.kind==='marks'&&historyTask&&!windows.length?<p className="card-description">No completion windows for this task.</p>:null}
        {exceptions.map(item=><article key={item.id} className="space-y-2 rounded-lg bg-slate-50 p-3"><p className="card-value">{item.studentName??`Student ${item.studentId}`}{item.participantName?` · ${item.participantName}`:''} · {item.status}</p><p className="card-description">Personal deadline: {formatMalaysiaDateTime(item.deadline)}<br/>{item.reason}<br/>Granted: {formatMalaysiaDateTime(item.createdAt)}</p>{item.revocationReason?<p className="card-description">Revoked: {item.revocationReason}</p>:null}{item.canRevoke?<PortalButton size="sm" disabled={mutationBusy||loading||!!error||detailLoading||!!detailError} onClick={()=>openAction({kind:'revoke-appointment',id:item.id})}>Revoke extra time</PortalButton>:null}</article>)}
        {windows.map(item=><article key={item.id} className="space-y-2 rounded-lg bg-slate-50 p-3"><p className="card-value">{item.status} · {formatMalaysiaDateTime(item.deadline)}</p><p className="card-description">{item.reason} · {item.grantedBy.name}<br/>Granted: {formatMalaysiaDateTime(item.createdAt)}</p>{item.revocationReason?<p className="card-description">Revoked: {item.revocationReason}</p>:null}{item.canRevoke?<PortalButton size="sm" disabled={mutationBusy||loading||!!error||detailLoading||!!detailError} onClick={()=>openAction({kind:'revoke-marks',id:item.id})}>Revoke completion window</PortalButton>:null}</article>)}
      </>}
    </section>:null;

  const decisionDialogs = <>
    <DecisionDialog isOpen={!!action} size={action?.kind==='enforcement'&&action.enabled?'wide':'default'} decisionKey={action?JSON.stringify(action):undefined} title={action?.kind==='publish'?'Publish submission window':action?.kind==='close'?'Close submissions early':action?.kind==='archive'?'Archive submission window':action?.kind==='enforcement'?`${action.enabled?'Enable':'Turn off'} date restrictions`:'Revoke extra time'} context={action&&'period' in action?action.period.name:action?.kind==='enforcement'?activityName(action.activity):undefined} message={action?.kind==='publish'?(data?.enforcement[action.period.activity]?'Date restrictions are enabled. Publishing makes these dates apply to new submissions for the covered programmes. Existing requests remain reviewable.':'Publishing makes this schedule available. Dates will not restrict submissions until date restrictions are enabled for this activity.'):action?.kind==='enforcement'&&action.enabled?'New submissions will require an open published window or approved personal extra time. Existing requests remain available for approval or rejection.':action?.kind==='enforcement'?'New submissions will no longer be limited by these window dates. Normal semester and eligibility rules still apply.':action?.kind==='close'?'This closes the window. Date restrictions must be enabled to block new submissions. Existing requests remain reviewable.':'Record the reason for this change.'} confirmLabel="Confirm change" successMessage="Period control updated." standaloneGuard busy={mutationBusy} dirty={!!actionReason.trim()||actionConfirmed} canConfirm={action?.kind==='publish'||!!actionReason.trim()&&(action?.kind!=='enforcement'||!action.enabled||actionConfirmed)} onConfirm={confirmAction} onReload={refreshAll} onClose={()=>setAction(null)}>
      {action?.kind==='enforcement'&&action.enabled?<div className="space-y-6"><ProgrammeCoverageReview coverage={coverage}/><label className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-50 p-4 text-xs font-normal leading-6 text-slate-700"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={actionConfirmed} onChange={event=>setActionConfirmed(event.target.checked)}/><span className="min-w-0">I have reviewed programme coverage, opening and closing times, including programmes that will be blocked.</span></label></div>:null}
      {action?.kind==='publish'?<p className="card-description">{formatMalaysiaDateTime(action.period.opensAt)} to {formatMalaysiaDateTime(action.period.closesAt)}<br/>{action.period.programmeScope==='ALL'?'All programmes':action.period.programmes.join(', ')}</p>:<label className="form-label block">Reason<textarea className="form-control form-control-md mt-1" rows={3} required value={actionReason} onChange={event=>setActionReason(event.target.value)}/></label>}
    </DecisionDialog>
    <DecisionDialog isOpen={!!extension} decisionKey={extension?`${extension.target.kind}:${extension.target.id}`:undefined} title="Extend deadline" context={extension?.name} message="Use a common deadline for everyone or grant extra time to selected eligible cases. Enter exact Malaysia time and a reason." confirmLabel="Save extension" successMessage="Deadline extension saved." standaloneGuard dirty={!!reason.trim()||scope!==initialExtension.current.scope||deadline!==initialExtension.current.deadline||scope==='selected'&&(!!selectedCandidate||taskIds.length>0)} busy={mutationBusy} canConfirm={!!deadline&&!!reason.trim()&&(scope==='everyone'||(extension?.target.kind==='appointment'?!!selectedCandidate&&!detailLoading&&!detailError:taskIds.length>0))} onConfirm={async()=>{
      if(!extension)return false;
      return runMutation(()=>submitDeadlineExtension(extension.target,scope,deadline,reason,{taskIds,candidate:candidates.find((_,index)=>String(index)===selectedCandidate)}),async()=>{await load();await onTimelineRefresh();});
    }} onReload={refreshAll} onClose={()=>{candidateGeneration.current+=1;setExtension(null);}}>
      <p className="card-description">Current deadline: {extension?.target.kind==='event'&&extension.target.closesAt?`${formatMalaysiaDate(extension.target.closesAt)} (complete Malaysia day)`:formatMalaysiaDateTime(extension?.target.closesAt)}</p>
      {extension?.target.kind==='appointment'?<div className="flex flex-wrap gap-2"><StatusBadge>{extensionPeriod?.lifecycleStatus}</StatusBadge><StatusBadge>{extensionPeriod?.effectiveStatus}</StatusBadge><StatusBadge tone={extensionEnforced?'success':'warning'}>{extensionEnforced?'Dates enforced':'Dates not enforced'}</StatusBadge></div>:null}
      <DeadlineExtensionScopeFields kind={extension?.target.kind??'event'} value={scope} onChange={setScope} everyoneAllowed={extension?.target.kind==='marks'?extension.target.allowEveryone!==false:calendarEditable}/>
      {scope==='selected'&&extension?.target.kind==='appointment'?<div className="space-y-2">{detailLoading?<p role="status">Loading eligible cases…</p>:detailError?<AlertMessage type="error" title="Couldn’t load this information" message={detailError}/>:<label className="form-label block">Student and participant<PortalSelect className="form-control form-control-md mt-1" value={selectedCandidate} onChange={event=>setSelectedCandidate(event.target.value)}><option value="">Select eligible case</option>{candidates.map((candidate,index)=><option key={`${candidate.studentId}:${candidate.participantId}`} value={index}>{candidate.studentName} · {candidate.matricNo??candidate.studentId}{candidate.participantName?` · ${candidate.participantName}`:''}</option>)}</PortalSelect></label>}{!detailLoading&&!detailError&&!candidates.length?<p>No eligible cases available.</p>:null}</div>:null}
      {scope==='selected'&&extension?.target.kind==='marks'?<fieldset className="max-h-56 space-y-3 overflow-y-auto"><legend className="form-label mb-2">Eligible unfinished evaluation tasks</legend>{eligibleTasks.length?eligibleTasks.map(task=><label key={task.taskId} className="flex items-start gap-2 text-xs"><input type="checkbox" checked={taskIds.includes(task.taskId!)} onChange={event=>setTaskIds(values=>event.target.checked?[...values,task.taskId!]:values.filter(value=>value!==task.taskId))}/><span>{task.studentName} · {task.panelMember} · {task.evaluatorRoleLabel??task.evaluatorRole}<br/>Effective deadline: {formatMalaysiaDateTime(task.effectiveDueAt??task.dueAt)}</span></label>):<p>No eligible unfinished tasks.</p>}</fieldset>:null}
      <label className="form-label block">{extension?.target.kind==='event'?'New deadline (complete Malaysia day)':'New deadline (Malaysia time)'}<input type={extension?.target.kind==='event'?'date':'datetime-local'} className="form-control form-control-md mt-1" required value={deadline} onChange={event=>setDeadline(event.target.value)}/></label>
      <section aria-label="Extension impact" className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2"><p className="card-description">{extension?.target.kind==='appointment'?extensionImpact(extensionPeriod,extensionEnforced,scope,deadline):scope==='selected'?'Only the selected people receive extra time. The general deadline and linked timeline remain unchanged.':'The common deadline changes for everyone covered by this window.'}</p>{scope==='everyone'&&(extensionLinkedEvents.length||calendarStatus!=='ready')?<p className="card-description">{extensionLinkedEvents.length?`Linked timeline: ${extensionLinkedEvents.map(entry=>entry.title||entry.detail).join(', ')}. Saving will also update the displayed event dates.`:'Any linked timeline events will follow the new common deadline.'}</p>:null}</section>
      <label className="form-label block">Reason<textarea className="form-control form-control-md mt-1" rows={3} required value={reason} onChange={event=>setReason(event.target.value)}/></label>
    </DecisionDialog>
  </>;

  return <><DraftNavigationGuard dirty={formDirty} busy={createOpen&&mutationBusy} onDiscard={()=>setCreateOpen(false)}/><PortalToast message={notice?.message??null} tone={notice?.tone} onClose={()=>setNotice(null)}/>
   {loading?<PortalCard><p role="status" className="card-description">Loading submission windows…</p></PortalCard>:error?<AlertMessage type="error" title="Couldn’t load submission windows" message={error} actions={<PortalButton onClick={()=>void load().catch(()=>{})}>Retry periods</PortalButton>}/>:data?<>
    <PeriodActivityOverview data={data} marks={marks} selected={activeTab} busy={interacting} onSelect={selectActivity}/>
    <PortalCard id="operational-periods" className="period-workspace space-y-5">
     {!calendarEditable?<p role="status" className="rounded-lg bg-slate-50 p-3 card-description">This semester is closed. Appointment windows and calendar events are read only. Eligible unfinished Marks tasks can receive completion windows.</p>:null}
     {activeTab!=='MARKS'?<section id={`period-panel-${activeTab}`} tabIndex={-1} aria-label={activityName(activeTab)} className="space-y-5 outline-none">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="section-heading">{activityName(activeTab)}</h2><p className="card-description mt-1">{activeTab==='SUPERVISOR_APPLICATION'?'When students may submit new Supervisor applications.':'When Supervisors may submit new Panel recommendations.'}</p></div><PortalButton id="add-submission-window" variant="primary" size="sm" disabled={interacting||!calendarEditable} onClick={()=>openPeriodForm(null)}>Add submission window</PortalButton></div>
      <div className="period-rules"><div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><h3 className="card-value">Submission rules</h3><StatusBadge tone={data.enforcement[activeTab]?'success':'warning'}>{data.enforcement[activeTab]?'Dates enforced':'Dates not enforced'}</StatusBadge></div><p className="card-description">{data.enforcement[activeTab]?'New submissions require an open window or approved extra time.':!data.periods.some(period=>period.activity===activeTab&&period.lifecycleStatus==='PUBLISHED')?'Dates are unrestricted. Publish a window to enable date restrictions.':'Dates are unrestricted until you enable date restrictions.'}</p></div><PortalButton size="sm" disabled={interacting||!calendarEditable||(!data.enforcement[activeTab]&&!data.periods.some(period=>period.activity===activeTab&&period.lifecycleStatus==='PUBLISHED'))} onClick={()=>openAction({kind:'enforcement',activity:activeTab,enabled:!data.enforcement[activeTab]})}>{data.enforcement[activeTab]?'Turn off date restrictions':'Review and enable'}</PortalButton></div>
      {!data.periods.some(period=>period.activity===activeTab)?<div className="period-empty"><h3 className="card-value">No submission windows yet</h3><p className="card-description mt-1">Add a window, review its dates and programme scope, then publish it. Enable date restrictions separately when you are ready.</p></div>:<div className="period-window-table"><CoordinatorDataTable label={`${activityName(activeTab)} windows`} columns={['Window','Programmes','Opens','Closes','Submission access','Action']} rows={data.periods.filter(period=>period.activity===activeTab).map(period=>({key:period.id,cells:[
       <div id={`operational-period-${period.id}`} tabIndex={-1}><p className="card-value">{period.name}</p></div>,
       <span className="card-description">{period.programmeScope==='ALL'?'All programmes':period.programmes.join(', ')}</span>,
       <WindowDateTime value={period.opensAt}/>,<WindowDateTime value={period.closesAt}/>,
       <WindowSubmissionAccess lifecycleStatus={period.lifecycleStatus} effectiveStatus={period.effectiveStatus} enforced={data.enforcement[activeTab]}/>,
       <PortalButton size="sm" disabled={interacting} onClick={()=>openManaged('appointment',period.id)}>Manage window</PortalButton>,
      ]}))}/></div>}
      <p className="period-review-note">Existing applications and recommendations remain available for approval or rejection after the submission deadline.</p>
     </section>:<section id="period-panel-MARKS" tabIndex={-1} aria-label="Marks evaluations" className="space-y-5 outline-none">
      <div><h2 className="section-heading">Marks evaluations</h2><p className="card-description mt-1">Review evaluation deadlines, timeline links and extra time for this semester.</p></div>
      <div className="period-marks-context"><div><h3 className="card-value">Evaluation setup is in Marks Entry</h3><p className="card-description mt-1">Configure evaluation dates, rubrics and evaluator roles there. Published evaluation windows control when assigned lecturers may save and submit marks.</p></div><Link className="period-text-link shrink-0" to={marksConfigurationRoute(semesterId)}>Configure evaluation periods →</Link></div>
      {!marks.length?<div className="period-empty"><h3 className="card-value">No evaluation periods for this semester</h3><p className="card-description mt-1">Use Configure evaluation periods to prepare the first period in Marks Entry.</p></div>:<div className="period-window-table"><CoordinatorDataTable label="Marks evaluation windows" columns={['Window','Programmes','Opens','Closes','Status','Action']} rows={marks.map(period=>({key:period.id,cells:[
       <div id={`marks-period-${period.id}`} tabIndex={-1}><p className="card-value">{period.name}</p><p className="card-description mt-1">{period.evaluatorRoles.map(role=>role==='SUPERVISOR'?'Supervisor':'Panel').join(', ')}</p></div>,
       <span className="card-description">{period.programmeScope==='ALL'?'All programmes':period.programmes.join(', ')}</span>,
       <WindowDateTime value={period.opensAt}/>,<WindowDateTime value={period.closesAt}/>,<WindowScheduleStatus lifecycleStatus={period.lifecycleStatus} effectiveStatus={period.effectiveStatus}/>,
       <PortalButton size="sm" disabled={interacting} onClick={()=>openManaged('marks',period.id)}>Manage window</PortalButton>,
      ]}))}/></div>}
     </section>}
     {!managed?historyContent:null}
    </PortalCard>
   </>:null}
    {!managed && decisionDialogs}
    {managed&&managedWindow?<RecordPage title={managedWindow.name} subtitle={managed.kind==='appointment'?'Review this submission window, its timeline connection and change history.':'Review this evaluation window, its timeline connection and extra time.'} backLabel="Back to periods & deadlines" onBack={()=>{setManaged(null);setHistory(null);}} pageKey={`manage-window:${semesterId}:${managed.kind}:${managed.id}`} busy={mutationBusy||calendarBusy}>
     <div data-office-dashboard className="period-workspace space-y-5">{error?<PortalCard><div role="alert" className="space-y-3"><p>{error}</p><p className="card-description">Reload this window before making another change.</p><PortalButton onClick={()=>void refreshAll().catch(()=>{})}>Reload window</PortalButton></div></PortalCard>:loading?<p role="status" className="card-description">Refreshing window…</p>:null}<fieldset disabled={!recordReady} className="space-y-5 min-w-0"><PortalCard className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="section-heading">Submission schedule</h2><span aria-label="Submission schedule status"><StatusBadge tone={getStatusBadgeTone(managedWindow.lifecycleStatus)}>{managedWindow.lifecycleStatus}</StatusBadge></span></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
       <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">Malaysia time (UTC+08:00)</p>{managedWindow.lifecycleStatus==='PUBLISHED'?<p className="text-xs font-medium text-slate-600">{managedWindow.effectiveStatus==='OPEN'?'Open now':managedWindow.effectiveStatus==='UPCOMING'?'Opens soon':'Submissions ended'}</p>:null}</div>
       <dl className="grid gap-5 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Opens</dt><dd className="mt-2"><time dateTime={managedWindow.opensAt} className="text-sm font-medium leading-6 text-slate-900">{windowStamp(managedWindow.opensAt)}</time></dd></div><div className="border-t border-slate-200 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0"><dt className="text-xs text-slate-500">Closes</dt><dd className="mt-2"><time dateTime={managedWindow.closesAt} className="text-sm font-medium leading-6 text-slate-900">{windowStamp(managedWindow.closesAt)}</time></dd></div></dl>
      </div>
      <dl className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]"><dt className="text-xs leading-6 text-slate-500">Programmes</dt><dd className="text-sm leading-6 text-slate-900">{managedWindow.programmeScope==='ALL'?'All programmes':managedWindow.programmes.join(', ')}</dd></dl>
      <p className="period-review-note">{managedAppointment?(managedAppointment.lifecycleStatus==='DRAFT'?'Publish this draft before its dates can control submissions.':data?.enforcement[managedAppointment.activity]?'Dates are enforced for new submissions. Existing requests remain reviewable.':'Dates are not enforced for this activity. Publishing this window does not enable restrictions.'):'Assigned lecturers may save and submit marks while the evaluation window or an eligible completion window permits it.'}</p>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">{managedAppointment?.lifecycleStatus==='DRAFT'?<><PortalButton size="sm" disabled={!calendarEditable||mutationBusy} onClick={()=>openPeriodForm(managedAppointment)}>Edit draft</PortalButton><PortalButton size="sm" variant="primary" disabled={!calendarEditable||mutationBusy} onClick={()=>openAction({kind:'publish',period:managedAppointment})}>Review and publish</PortalButton></>:null}
       {managedAppointment?.lifecycleStatus==='PUBLISHED'?<PortalButton size="sm" disabled={!calendarEditable||mutationBusy} onClick={()=>void openExtension({name:managedAppointment.name,target:{kind:'appointment',id:managedAppointment.id,revision:managedAppointment.revision,closesAt:managedAppointment.closesAt}})}>Extend deadline</PortalButton>:null}
       {managedMarks?<><Link className="period-text-link" to={marksConfigurationRoute(semesterId,managedMarks.id)}>Open evaluation configuration →</Link>{!['DRAFT','ARCHIVED'].includes(managedMarks.lifecycleStatus)?<PortalButton size="sm" disabled={mutationBusy} onClick={()=>void openExtension({name:managedMarks.name,target:{kind:'marks',id:managedMarks.id,closesAt:managedMarks.closesAt,allowEveryone:defaultMarksExtensionScope(managedMarks.lifecycleStatus,semesterLifecycle)==='everyone'}})}>Extend deadline</PortalButton>:null}</>:null}
      {managedAppointment?.lifecycleStatus==='PUBLISHED'?<PortalButton className="sm:ml-auto" size="sm" variant="dangerSolid" disabled={mutationBusy||!calendarEditable} onClick={()=>openAction({kind:'close',period:managedAppointment})}>Close submissions early</PortalButton>:managedAppointment&&['DRAFT','CLOSED'].includes(managedAppointment.lifecycleStatus)?<PortalButton className="sm:ml-auto" size="sm" variant="dangerSolid" disabled={mutationBusy||!calendarEditable} onClick={()=>openAction({kind:'archive',period:managedAppointment})}>Archive window</PortalButton>:null}</div>
     </PortalCard><PortalCard>      <PeriodCalendarConnection key={`${managed.kind}:${managed.id}`} semesterId={semesterId} kind={managed.kind} periodId={managed.id} name={managedWindow.name} opensAt={managedWindow.opensAt} closesAt={managedWindow.closesAt} entries={entries} status={calendarStatus} editable={recordReady&&calendarEditable&&managedWindow.lifecycleStatus!=='ARCHIVED'} onRefresh={onTimelineRefresh} onInteractionChange={setCalendarBusy}/></PortalCard><PortalCard>
      <div className="[&>details]:border-t-0 [&>details>summary]:py-0 [&>details>summary]:min-h-8 [&>details>div]:pt-5 [&>details>div]:pb-0">
       <SupervisorRequestDisclosure title="History" onToggle={event=>{if(event.currentTarget.open)openHistory({kind:managed.kind,id:managed.id,name:managedWindow.name});else setHistory(null);}}>
        {historyContent}
       </SupervisorRequestDisclosure>
      </div>
     </PortalCard></fieldset></div>
      {decisionDialogs}
    </RecordPage>:null}
    {createOpen?<SubmissionWindowDialog title={editingPeriod?'Edit submission window':'Add submission window'} semesterLabel={semesterLabel??`Academic semester ${semesterId}`} dirty={formDirty} busy={mutationBusy} onClose={()=>setCreateOpen(false)} returnFocusId={editingPeriod?`operational-period-${editingPeriod.id}`:'add-submission-window'} footer={requestClose=><><PortalButton disabled={mutationBusy} onClick={requestClose}>Cancel</PortalButton>{formBlocked?<PortalButton disabled={mutationBusy} onClick={async()=>{try{if(editingPeriod){await refreshAll();setCreateOpen(false);}else{await onTimelineRefresh();formSubmission.current.clearBlock();setFormBlocked(false);setFormError('');setFormNotice('Calendar events refreshed. Review the selected event or choose Do not link now before creating the draft.');}}catch(failure){setFormError(errorMessage(failure));}}}>{editingPeriod?'Review latest record':'Reload calendar events'}</PortalButton>:<PortalButton form="submission-window-form" type="submit" variant="primary" isLoading={mutationBusy} disabled={!name.trim()||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(opensAt)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(closesAt)||(programmeScope==='SELECTED'&&!selectedProgrammes.length)||(!!editingPeriod&&!editReason.trim())||!!timelineEntryId&&(calendarStatus!=='ready'||!selectedCalendarEvent)}>{editingPeriod?'Save draft':'Create draft'}</PortalButton>}</>}>
      <form id="submission-window-form" className="space-y-6" onSubmit={event=>{event.preventDefault();void savePeriodForm();}}>
      <p className="card-description">{data?.enforcement[activity]?'Date restrictions are already enabled for this activity. This draft will not affect access until published. Existing requests remain reviewable.':'Save a draft, publish it, then enable date restrictions separately. Existing requests remain reviewable.'}</p>
      <fieldset className="space-y-7 min-w-0" disabled={mutationBusy||formBlocked}>
      <section aria-label="Window details" className="space-y-4"><h3 className="section-heading">Window details</h3>
      <label className="form-label block">Window name<input className="form-control form-control-md mt-1" required value={name} onChange={event=>setName(event.target.value)}/></label>
<div className="grid gap-5 sm:grid-cols-2">
      <label className="form-label block">Activity<PortalSelect disabled={!!editingPeriod} className="form-control form-control-md mt-1" value={activity} onChange={event=>setActivity(event.target.value as OperationalActivity)}>{activities.map(code=><option key={code} value={code}>{activityName(code)}</option>)}</PortalSelect></label>
      <label className="form-label block">Programme scope<PortalSelect className="form-control form-control-md mt-1" value={programmeScope} onChange={event=>setProgrammeScope(event.target.value as 'ALL'|'SELECTED')}><option value="ALL">All programmes</option><option value="SELECTED">Selected programmes</option></PortalSelect></label>
</div>
      {programmeScope==='SELECTED'?<fieldset className="space-y-2"><legend className="form-label mb-2">Programmes</legend>{programmes.length?programmes.map(programme=><label key={programme} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedProgrammes.includes(programme)} onChange={event=>setSelectedProgrammes(values=>event.target.checked?[...values,programme]:values.filter(value=>value!==programme))}/>{programme}</label>):<p>No programme choices available.</p>}</fieldset>:null}
      </section>
      {!editingPeriod?<section aria-label="Link during creation" className="space-y-4 border-t border-slate-200 pt-6"><h3 className="section-heading">Semester timeline <span className="font-normal text-slate-500">(optional)</span></h3>
       {calendarStatus==='ready'?<><TimelineEventPicker id="submission-window-calendar-event" entries={linkableEntries} value={timelineEntryId} onChange={setTimelineEntryId}/>{selectedCalendarEvent?<div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3"><p className="card-description">Research Project {selectedCalendarEvent.level==='P1'?'1':'2'} · {formatMalaysiaDate(selectedCalendarEvent.deadlineStart)} – {formatMalaysiaDate(selectedCalendarEvent.deadlineEnd)}</p><EventDateImport key={`${selectedCalendarEvent.id}:${selectedCalendarEvent.deadlineStart}:${selectedCalendarEvent.deadlineEnd}`} entry={selectedCalendarEvent} opensAt={opensAt} closesAt={closesAt} onApply={dates=>{setOpensAt(dates.opensAt);setClosesAt(dates.closesAt);if(!dates.opensAt.split('T')[1])requestAnimationFrame(()=>document.getElementById('submission-opens-time')?.focus());}}/></div>:<p className="card-description">{linkableEntries.length?'Choose an unlinked event from this semester, or connect one later from Manage window.':'No unlinked events are available. Save without a link, then create a linked event from Manage window.'}</p>}</>:<p role={calendarStatus==='error'?'alert':'status'} className="card-description">{calendarStatus==='loading'?'Loading timeline events. You can create the draft without a link.':calendarStatus==='error'?'Timeline events could not be loaded. Retry below, or save without a link.':calendarStatus==='missing'?'No semester timeline exists. You can save a draft now and connect an event after setting up Academic calendar.':'No unlinked events are available. You can create a linked event after saving the draft.'}</p>}
       {timelineEntryId&&calendarStatus!=='ready'&&!formBlocked?<PortalButton size="sm" disabled={mutationBusy} onClick={()=>setTimelineEntryId('')}>Continue without timeline link</PortalButton>:null}
       {calendarStatus==='error'||timelineEntryId&&!selectedCalendarEvent?<PortalButton size="sm" disabled={mutationBusy} onClick={()=>void Promise.resolve(onTimelineRefresh()).catch(()=>{})}>Reload calendar events</PortalButton>:null}
      </section>:null}
      <section aria-label="Submission schedule" className="space-y-4 border-t border-slate-200 pt-6"><div><h3 className="section-heading">Submission schedule</h3><p className="card-description mt-1">Malaysia time (UTC+08:00). Choose an exact time for each date.</p></div>
      {selectedCalendarEvent||editingLinkedEvents.length?<div aria-label="Linked date impact" className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900"><Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/><p className="min-w-0 [overflow-wrap:anywhere]">Saving these dates also updates the calendar event{editingLinkedEvents.length>1?'s':''}: {editingLinkedEvents.length?editingLinkedEvents.map(entry=>entry.title||entry.detail).join(', '):selectedCalendarEvent?.title||selectedCalendarEvent?.detail}.</p></div>:editingPeriod&&calendarStatus!=='ready'?<AlertMessage type="warning" title="Calendar connection not verified" message="Any linked calendar events will follow the date changes you save."/>:null}
      <div className="grid gap-6 sm:grid-cols-2"><SubmissionScheduleField id="submission-opens" label="Opens" value={opensAt} onChange={setOpensAt}/><SubmissionScheduleField id="submission-closes" label="Closes" value={closesAt} onChange={setClosesAt}/></div>

      </section>
      {editingPeriod?<label className="form-label block">Reason for change<textarea className="form-control form-control-md mt-1" required value={editReason} onChange={event=>setEditReason(event.target.value)}/></label>:null}
      </fieldset>
      {formError?<AlertMessage type="error" title={formBlocked?"Window needs review":"Window wasn’t saved"} message={formError}/>:null}
      {formNotice?<AlertMessage type="info" message={formNotice}/>:null}
      {formBlocked&&creationLinkConflict?<PortalButton size="sm" disabled={mutationBusy} onClick={()=>{setTimelineEntryId('');formSubmission.current.clearBlock();setFormBlocked(false);setCreationLinkConflict(false);setFormError('');setFormNotice('Timeline link removed. Review your details and create the draft without a link.');}}>Continue without timeline link</PortalButton>:null}
      </form>
    </SubmissionWindowDialog>:null}
  </>;
}
