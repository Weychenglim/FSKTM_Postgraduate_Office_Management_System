import { PortalSelect } from './PortalSelect';
import { RecordPage } from './RecordPage';
import { ClosureReview } from './ClosureReview';
import type { ClosureApproval } from '../types/marks';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Edit3,
  History,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Save,
  X,
  XCircle,
} from 'lucide-react';

import {
  archiveAcademicSemester,
  closeAcademicSemester,
  createAcademicSemester,
  extendAcademicSemester,
  getAcademicSemesterAudits,
  getAcademicSemesters,
  updateAcademicSemester,
} from '../services';
import type {
  AcademicSemester,
  AcademicSemesterAudit,
  AcademicSemesterInput,
  AcademicSemesterLifecycle,
} from '../types';
import {
  academicSemesterErrorMessage,
  formatSemesterLifecycle,
  isConsecutiveAcademicSession,
  validateSemesterDates,
} from '../utils/academicSemesters';
import {
  PageHeader,
  PortalButton,
  PortalCard,
  PortalConfirmModal,
  StatusBadge,
  getStatusBadgeTone,
} from './PortalPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { formatMalaysiaDateTimeCompact } from '../utils/malaysiaDateTime';
import {OfficeToolContext, OfficeToolSection, OfficeToolViews} from './OfficeToolPrimitives';
import {SemesterActivationSection} from './SemesterActivationSection';
import {AlertMessage} from './AlertMessage';
import {FieldError,FormFeedback} from './FormFeedback';
import {clearFeedbackFields,focusFeedback,readFormFeedback,type FormFeedbackState} from '../utils/formFeedback';
import {DecisionFeedbackProvider,useDecisionFeedback} from './DecisionFeedback';
import {ApiError} from '../services/apiClient';
import {PortalModal} from './PortalModal';

function SemesterTransitionSurface({hidden, busy, onClose, children}: {
  hidden: boolean; busy: boolean; onClose: () => void; children: React.ReactNode;
}) {
  return <PortalModal isOpen={!hidden} busy={busy} onClose={onClose} labelledBy="semester-transition-title" className="academic-semester-fields max-w-3xl p-6 sm:p-8">{children}</PortalModal>;
}

interface AcademicSemesterManagementProps {
  onBack: () => void;
  onManageParticipants?: () => void;
  onOpenReconciliation?: () => void;
  onOpenCapacity?: (semesterId?: number) => void;
}

type LifecycleFilter = 'ALL' | AcademicSemesterLifecycle;
type TransitionAction = 'close' | 'archive' | 'extend';

const EMPTY_FORM: AcademicSemesterInput = {
  academicSession: '',
  term: 'SEMESTER_I',
  startsOn: '',
  endsOn: '',
};
const SEMESTER_FIELDS={academicSession:{id:'semester-session',label:'Academic session'},term:{id:'semester-term',label:'Term'},startsOn:{id:'semester-start',label:'Starts on'},endsOn:{id:'semester-end',label:'Ends on'}};
const SEMESTER_FIELD_MAP={academic_session:'academicSession',academicSession:'academicSession',term:'term',starts_on:'startsOn',startsOn:'startsOn',ends_on:'endsOn',endsOn:'endsOn'};
const SEMESTER_IDS=Object.fromEntries(Object.entries(SEMESTER_FIELDS).map(([key,value])=>[key,value.id]));

const displayDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-MY', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const AUDIT_FIELD_LABELS: Record<string, string> = {
  academicSession: 'Academic session',
  term: 'Term',
  startsOn: 'Starts on',
  endsOn: 'Ends on',
  lifecycleStatus: 'Status',
};

function auditActionTitle(action: string): string {
  const titles: Record<string, string> = {
    CREATE: 'Semester created',
    UPDATE: 'Semester details updated',
    ACTIVATE: 'Semester activated',
    HANDOVER_CLOSE: 'Semester handed over',
    CLOSE: 'Semester closed',
    EXTEND: 'Semester dates extended',
    ARCHIVE: 'Semester archived',
  };
  return titles[action] ?? formatSemesterLifecycle(action);
}

function auditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value);
  if (field === 'term' || field === 'lifecycleStatus') return formatSemesterLifecycle(text);
  if ((field === 'startsOn' || field === 'endsOn') && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return displayDate(text);
  }
  return text;
}

function semesterAuditChanges(audit: AcademicSemesterAudit) {
  return Object.entries(AUDIT_FIELD_LABELS).flatMap(([field, label]) => {
    const before = audit.beforeValues[field];
    const after = audit.afterValues[field];
    if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return [];
    return [{ field, label, before: auditValue(field, before), after: auditValue(field, after) }];
  });
}

export const AcademicSemesterManagement: React.FC<AcademicSemesterManagementProps> = (props) => <DecisionFeedbackProvider scopeKey="academic-semesters"><AcademicSemesterManagementContent {...props}/></DecisionFeedbackProvider>;

const AcademicSemesterManagementContent: React.FC<AcademicSemesterManagementProps> = ({
  onBack,
  onOpenCapacity,
}) => {
  const [semesters, setSemesters] = useState<AcademicSemester[]>([]);
  const [filter, setFilter] = useState<LifecycleFilter>('ALL');
  const [includeArchived, setIncludeArchived] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [detailTab, setDetailTab] = useState<'overview' | 'history'>('overview');
  const [selected, setSelected] = useState<AcademicSemester | null>(null);
  const [audits, setAudits] = useState<AcademicSemesterAudit[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditAttempt, setAuditAttempt] = useState(0);
  const [form, setForm] = useState<AcademicSemesterInput>(EMPTY_FORM);
  const [transition, setTransition] = useState<TransitionAction | null>(null);
  const [pendingTransition, setPendingTransition] = useState<TransitionAction | null | undefined>(undefined);
  const [closureAcknowledged,setClosureAcknowledged]=useState(false);
  const [reason, setReason] = useState('');
  const [extensionEnd, setExtensionEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formFeedback,setFormFeedback]=useState<FormFeedbackState|null>(null);
  const [transitionError,setTransitionError]=useState<string|null>(null);
  const [transitionBlocked,setTransitionBlocked]=useState(false);
  const [replaceTransition,setReplaceTransition]=useState(false);
  const [savedRefreshFailure,setSavedRefreshFailure]=useState(false);
  const writeLock=useRef(false);
  const blockedSemesterId=useRef<number|null>(null);
  const feedback=useDecisionFeedback();

  const loadSemesters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getAcademicSemesters(includeArchived);
      setSemesters(rows);
      setSelected((current) => (
        current ? rows.find((row) => row.id === current.id) ?? null : null
      ));
      setSavedRefreshFailure(false);
      return true;
    } catch (loadError) {
      setError(loadError instanceof Error?loadError.message:'The semester list could not be loaded. Try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    let current = true;
    setAudits([]);
    setAuditError(null);
    setAuditsLoading(Boolean(selected));
    if (selected) {
      getAcademicSemesterAudits(selected.id)
        .then((rows) => { if (current) setAudits(rows); })
        .catch(() => {
          if (current) setAuditError('Semester audit history could not be loaded. Try again.');
        })
        .finally(() => { if (current) setAuditsLoading(false); });
    }
    return () => { current = false; };
  }, [selected, auditAttempt]);

  const active = semesters.find((semester) => semester.lifecycleStatus === 'ACTIVE') ?? null;
  const visible = useMemo(
    () => semesters.filter((semester) => filter === 'ALL' || semester.lifecycleStatus === filter),
    [filter, semesters],
  );

  const showToast = (message: string,tone:'success'|'warning'='success') => feedback?.(message,tone);

  const beginCreate = () => {
    if(savedRefreshFailure||saving||writeLock.current)return;
    setFormFeedback(null);setTransitionError(null);setTransitionBlocked(false);setReplaceTransition(false);setSavedRefreshFailure(false);
    setView('create');
    setDetailTab('overview');
    setSelected(null);
    setForm(EMPTY_FORM);
    setTransition(null);
    setPendingTransition(undefined);setClosureAcknowledged(false);
    setReason('');
    setAudits([]);
    setError(null);
  };

  const beginEdit = (semester: AcademicSemester, committed=false) => {
    if(!committed&&(savedRefreshFailure||saving||writeLock.current))return;
    setFormFeedback(null);setTransitionError(null);setTransitionBlocked(blockedSemesterId.current===semester.id);setReplaceTransition(false);setSavedRefreshFailure(false);
    setView('detail');
    setDetailTab('overview');
    setSelected(semester);
    setForm({
      academicSession: semester.academicSession,
      term: semester.term,
      startsOn: semester.startsOn,
      endsOn: semester.endsOn,
    });
    setTransition(null);
    setPendingTransition(undefined);setClosureAcknowledged(false);
    setReason('');
    setExtensionEnd(semester.endsOn);
  };

  const saveDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    if(saving||writeLock.current||savedRefreshFailure)return;
    const report=(feedback:FormFeedbackState)=>{setFormFeedback(feedback);focusFeedback(feedback,SEMESTER_IDS,'semester-save-feedback');};
    if (!isConsecutiveAcademicSession(form.academicSession)) {
      report({message:'Correct the highlighted fields, then save again.',fields:{academicSession:'Use consecutive years, for example 2026/2027.'}});
      return;
    }
    const dateError = validateSemesterDates(form.startsOn, form.endsOn);
    if (dateError) {
      report({message:'Correct the highlighted fields, then save again.',fields:{[!form.startsOn?'startsOn':'endsOn']:dateError}});
      return;
    }
    writeLock.current=true;setSaving(true);
    setFormFeedback(null);
    try {
      const saved = selected
        ? await updateAcademicSemester(selected.id, form)
        : await createAcademicSemester(form);
      beginEdit(saved,true);
      const outcome=selected ? 'Draft semester updated.' : 'Draft semester created.';
      if(await loadSemesters())showToast(outcome);
      else {setSavedRefreshFailure(true);showToast(`${outcome} The latest semester list could not be loaded. Reload before another action.`,'warning');}
    } catch (saveError) {
      report(readFormFeedback(saveError,academicSemesterErrorMessage(saveError),SEMESTER_FIELD_MAP));
    } finally {
      writeLock.current=false;setSaving(false);
    }
  };

  const runTransition = async (approval?: ClosureApproval) => {
    if (!selected || !transition || !reason.trim() || writeLock.current||transitionBlocked||savedRefreshFailure||pendingTransition!==undefined||replaceTransition)return;
    writeLock.current=true;setSaving(true);
    setTransitionError(null);
    try {
      const saved=transition==='close'?await closeAcademicSemester(selected.id, reason.trim(), approval)
        :transition==='archive'?await archiveAcademicSemester(selected.id, reason.trim())
        :await extendAcademicSemester(selected.id, extensionEnd, reason.trim());
      setSelected(saved);
      if (transition === 'archive') { setView('list'); setSelected(null); }
      setTransition(null);
      setPendingTransition(undefined);setClosureAcknowledged(false);
      setReason('');
      const outcome=`Semester ${transition === 'extend' ? 'extended' : transition==='close'?'ended':'archived'}.`;
      if(await loadSemesters())showToast(outcome);
      else {setSavedRefreshFailure(true);showToast(`${outcome} The latest semester list could not be loaded. Reload before another action.`,'warning');}
    } catch (transitionError) {
      if(!approval){setTransitionError(academicSemesterErrorMessage(transitionError));if(transitionError instanceof ApiError&&(transitionError.status===403||transitionError.status===409)){blockedSemesterId.current=selected.id;setTransitionBlocked(true);}}
      if (approval) throw transitionError;
    } finally {
      writeLock.current=false;setSaving(false);
    }
  };

  const lifecycleActions = selected?.lifecycleStatus === 'DRAFT'
    ? [] as TransitionAction[]
    : selected?.lifecycleStatus === 'ACTIVE'
      ? ['extend', 'close'] as TransitionAction[]
      : selected?.lifecycleStatus === 'CLOSED'
        ? ['archive'] as TransitionAction[]
        : [];

  const dirty = view === 'create'
    ? JSON.stringify(form) !== JSON.stringify(EMPTY_FORM)
    : !!selected && selected.lifecycleStatus === 'DRAFT' && (form.academicSession !== selected.academicSession || form.term !== selected.term || form.startsOn !== selected.startsOn || form.endsOn !== selected.endsOn);
  const transitionDirty=!!transition&&(reason!==''||(transition==='extend'&&extensionEnd!==selected?.endsOn)||closureAcknowledged);
  const chooseTransition=(next:TransitionAction|null)=>{
    if(saving||writeLock.current||pendingTransition!==undefined||(transitionBlocked&&next!==null)||(savedRefreshFailure&&next!==null))return;
    if(transitionDirty){setPendingTransition(next);return;}
    setTransition(next);setReason('');setExtensionEnd(selected?.endsOn??'');setTransitionError(null);setReplaceTransition(false);setClosureAcknowledged(false);
  };
  const discardTransition=()=>{
    const next=pendingTransition;
    setPendingTransition(undefined);setTransition(next??null);setReason('');setExtensionEnd(selected?.endsOn??'');setTransitionError(null);setReplaceTransition(false);setClosureAcknowledged(false);
  };
  const reviewLatestTransition=async()=>{
    if(saving||writeLock.current)return;
    setSaving(true);
    try {
      if(await loadSemesters()){
        blockedSemesterId.current=null;setTransition(null);setReason('');setExtensionEnd('');setClosureAcknowledged(false);setTransitionBlocked(false);setReplaceTransition(false);setTransitionError(null);
      }
    } finally {setSaving(false);}
  };
  if (view !== 'list') return <RecordPage title={selected ? selected.label : 'New academic semester'} subtitle={selected ? `${selected.code} · ${formatSemesterLifecycle(selected.lifecycleStatus)}` : 'Create a draft, then review readiness before activation.'} backLabel="Back to Academic Semesters"
    onBack={() => { setView('list'); setTransition(null); setReason(''); setError(null); }} pageKey="academic-semester:record" dirty={dirty || transitionDirty} busy={saving}>
    {error ? savedRefreshFailure?<AlertMessage type="warning" title="Changes saved; refresh required" message={error} actions={<PortalButton onClick={()=>void loadSemesters()}>Reload semesters</PortalButton>}/>:<ErrorState compact title="Couldn’t refresh semesters" message={error} onRetry={loadSemesters} /> : null}
    {selected ? <OfficeToolViews<typeof detailTab> appearance="workspace" label="Semester views" value={detailTab} options={[{value:'overview',label:'Overview',icon:LayoutDashboard},{value:'history',label:'History',icon:History}]} onChange={setDetailTab}/> : null}
      {detailTab === 'overview' && <PortalCard className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="section-heading">
              Semester details
            </h2>
          </div>
          <CalendarRange className="h-5 w-5 text-slate-500" />
        </div>

        {selected && selected.lifecycleStatus !== 'DRAFT' ? <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="card-label">Academic session</dt><dd className="card-value mt-1">{selected.academicSession}</dd></div>
          <div><dt className="card-label">Term</dt><dd className="card-value mt-1">{selected.term === 'SEMESTER_I' ? 'Semester I' : selected.term === 'SEMESTER_II' ? 'Semester II' : 'Special semester'}</dd></div>
          <div><dt className="card-label">Starts on</dt><dd className="card-value mt-1">{displayDate(selected.startsOn)}</dd></div>
          <div><dt className="card-label">Ends on</dt><dd className="card-value mt-1">{displayDate(selected.endsOn)}</dd></div>
          <div><dt className="card-label">Lifecycle</dt><dd className="card-value mt-1">{formatSemesterLifecycle(selected.lifecycleStatus)}</dd></div>
        </dl> : <form onSubmit={saveDraft} className="feedback-fields academic-semester-fields grid gap-4 md:grid-cols-2">
          <label className="form-label">
            Academic session
            <input
              id="semester-session" aria-invalid={!!formFeedback?.fields.academicSession} aria-describedby={formFeedback?.fields.academicSession?'semester-session-error':undefined}
              value={form.academicSession}
              disabled={saving||Boolean(selected && selected.lifecycleStatus !== 'DRAFT')}
              onChange={(event) => {setForm({ ...form, academicSession: event.target.value });setFormFeedback(value=>clearFeedbackFields(value,['academicSession']));}}
              placeholder="2026/2027"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-sans not-italic normal-case tracking-normal text-xs font-bold"
            />
            <FieldError id="semester-session-error" message={formFeedback?.fields.academicSession}/>
          </label>
          <label className="form-label">
            Term
            <PortalSelect
              id="semester-term" aria-invalid={!!formFeedback?.fields.term} aria-describedby={formFeedback?.fields.term?'semester-term-error':undefined}
              value={form.term}
              disabled={saving||Boolean(selected && selected.lifecycleStatus !== 'DRAFT')}
              onChange={(event) => {setForm({ ...form, term: event.target.value as AcademicSemesterInput['term'] });setFormFeedback(value=>clearFeedbackFields(value,['term']));}}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-sans not-italic normal-case tracking-normal text-xs font-bold"
            >
              <option value="SEMESTER_I">Semester I</option>
              <option value="SEMESTER_II">Semester II</option>
              <option value="SPECIAL">Special semester</option>
            </PortalSelect>
            <FieldError id="semester-term-error" message={formFeedback?.fields.term}/>
          </label>
          <label className="form-label">
            Starts on
            <input
              type="date"
              id="semester-start" aria-invalid={!!formFeedback?.fields.startsOn} aria-describedby={formFeedback?.fields.startsOn?'semester-start-error':undefined}
              value={form.startsOn}
              disabled={saving||Boolean(selected && selected.lifecycleStatus !== 'DRAFT')}
              onChange={(event) => {setForm({ ...form, startsOn: event.target.value });setFormFeedback(value=>clearFeedbackFields(value,['startsOn','endsOn']));}}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-sans not-italic normal-case tracking-normal text-xs font-bold"
            />
            <FieldError id="semester-start-error" message={formFeedback?.fields.startsOn}/>
          </label>
          <label className="form-label">
            Ends on
            <input
              type="date"
              id="semester-end" aria-invalid={!!formFeedback?.fields.endsOn} aria-describedby={formFeedback?.fields.endsOn?'semester-end-error':undefined}
              value={form.endsOn}
              disabled={saving||Boolean(selected && selected.lifecycleStatus !== 'DRAFT')}
              onChange={(event) => {setForm({ ...form, endsOn: event.target.value });setFormFeedback(value=>clearFeedbackFields(value,['startsOn','endsOn']));}}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-sans not-italic normal-case tracking-normal text-xs font-bold"
            />
            <FieldError id="semester-end-error" message={formFeedback?.fields.endsOn}/>
          </label>
          {(!selected || selected.lifecycleStatus === 'DRAFT') ? (
            <div className="md:col-span-2">
              <div className="mb-4"><FormFeedback id="semester-save-feedback" feedback={formFeedback} fields={SEMESTER_FIELDS}/></div>
              <PortalButton type="submit" icon={Save} variant="primary" disabled={saving || savedRefreshFailure || (!!selected && !dirty)}>
                {selected ? 'Save changes' : 'Create draft'}
              </PortalButton>
            </div>
          ) : null}
        </form>}

        {selected && lifecycleActions.length ? (
          <div className="mt-6 border-t border-slate-200 pt-5">
            <div className="flex flex-wrap gap-2">
              {lifecycleActions.map((action) => {
                const icons = { close: XCircle, archive: Archive, extend: Clock3 };
                return (
                  <PortalButton
                    key={action}
                    icon={icons[action]}
                    variant={action === 'close' ? 'danger' : 'secondary'}
                    disabled={saving || dirty || transitionBlocked || savedRefreshFailure}
                    onClick={() => chooseTransition(action)}
                  >
                    {action === 'close' ? 'End semester' : action === 'extend' ? 'Extend end date' : `${action[0].toUpperCase()}${action.slice(1)}`}
                  </PortalButton>
                );
              })}
            </div>
          </div>
        ) : null}
      </PortalCard>}

      {selected&&transitionBlocked&&!transition?<AlertMessage type="warning" title="Review latest semester" message="The previous action was rejected. Reload the semester before making another lifecycle decision." actions={<PortalButton onClick={()=>void reviewLatestTransition()}>Review latest record</PortalButton>}/>:null}
      {selected ? <div hidden={detailTab !== 'overview'}><SemesterActivationSection key={selected.id} semester={selected} dirty={dirty} busy={saving||!!transition||transitionBlocked||savedRefreshFailure} onCapacity={onOpenCapacity}
        onArchive={()=>chooseTransition('archive')}
        onActivated={async saved=>{
          // Commit the returned lifecycle before refresh so a failed read cannot offer activation again.
          setSelected(saved);
          setTransition(null);setReason('');
          try {
            const rows=await getAcademicSemesters(includeArchived);
            setSemesters(rows);setSelected(rows.find(row=>row.id===saved.id)??saved);setError(null);
          } catch(failure) {
            setSavedRefreshFailure(true);setError('Semester activated, but the latest semester list could not be loaded. Reload before another action.');
            throw failure;
          }
        }}/></div>:null}

      {transition && selected ? (
        <SemesterTransitionSurface hidden={detailTab!=='overview'} busy={saving||pendingTransition!==undefined||replaceTransition} onClose={()=>chooseTransition(null)}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 id="semester-transition-title" className="section-label">
                {`${transition === 'close' ? 'End' : transition[0].toUpperCase() + transition.slice(1)} ${selected.label}`}
              </h3>
            </div>
            <button type="button" title="Cancel" aria-label="Close dialog" disabled={saving} onClick={() => chooseTransition(null)} className="icon-button h-9 w-9 shrink-0 disabled:cursor-not-allowed disabled:opacity-50">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {transition === 'extend' ? <p className="card-description mt-3">Extending the semester does not extend submission deadlines. Manage those through Periods &amp; deadlines.</p> : null}
          {transition === 'extend' ? (
            <label className="form-label mt-4 block">
              New end date
              <input
                type="date"
                min={selected.endsOn}
                value={extensionEnd}
                disabled={saving}
                onChange={(event) => setExtensionEnd(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 md:max-w-xs font-sans not-italic normal-case tracking-normal text-xs font-bold"
              />
            </label>
          ) : null}
          <label className="form-label mt-4 block">
            Reason
            <textarea
              value={reason}
              disabled={saving}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-sans not-italic normal-case tracking-normal text-xs font-bold"
              placeholder="Record the operational reason for this change."
            />
          </label>
          {transitionError?<div className="mt-4"><AlertMessage type="error" title={transitionBlocked?'Review latest semester':'Semester wasn’t changed'} message={transitionError}/></div>:null}
          {transitionBlocked?<div className="mt-3"><PortalButton disabled={saving} onClick={()=>transitionDirty?setReplaceTransition(true):void reviewLatestTransition()}>Review latest record</PortalButton></div>:null}
          {transition === 'close' ? <ClosureReview key={`${selected.id}-${transition}`} kind="semester" id={selected.id} disabled={saving || transitionBlocked || pendingTransition!==undefined || replaceTransition || !reason.trim()} confirmLabel="End semester" onAcknowledgementChange={setClosureAcknowledged} onBlocked={failure=>{blockedSemesterId.current=selected.id;setTransitionBlocked(true);setTransitionError(academicSemesterErrorMessage(failure));}} onConfirm={runTransition} /> : null}
          <div className="mt-4 flex gap-2">
            {transition !== 'close' ? <PortalButton
              icon={transition === 'extend' ? RefreshCw : CheckCircle2}
              variant={transition==='archive'?'dangerSolid':'primary'}
              disabled={saving || transitionBlocked || savedRefreshFailure || pendingTransition!==undefined || replaceTransition || !reason.trim() || (transition === 'extend' && extensionEnd <= selected.endsOn)}
              onClick={() => void runTransition()}
            >
              {transition==='extend'?'Extend semester':'Archive semester'}
            </PortalButton> : null}
            <PortalButton variant="secondary" disabled={saving} onClick={() => chooseTransition(null)}>
              Cancel
            </PortalButton>
          </div>
          <PortalConfirmModal isOpen={pendingTransition!==undefined} title="Discard transition details?" message="Discard the transition details you entered?" confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={()=>setPendingTransition(undefined)} onConfirm={discardTransition}/>
          <PortalConfirmModal isOpen={replaceTransition} title="Review latest semester?" message="Replace the transition details you entered after loading the latest semester?" confirmLabel="Replace and review" cancelLabel="Keep editing" isLoading={saving} onCancel={()=>setReplaceTransition(false)} onConfirm={()=>void reviewLatestTransition()}/>
        </SemesterTransitionSurface>
      ) : null}

      {selected && detailTab === 'history' ? (
        <section className="border-y border-slate-200 py-5">
          <h2 className="section-label">Semester audit history</h2>
          {auditsLoading ? <LoadingState message="Loading semester audit history…" />
            : auditError ? <ErrorState compact title="Couldn’t load semester history" message={auditError} onRetry={() => setAuditAttempt((value) => value + 1)} />
            : !audits.length ? (
            <p className="card-description mt-2">No audit events are available.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-200">
              {audits.map((audit) => {
                const changes = semesterAuditChanges(audit);
                return (
                  <article key={audit.id} className="py-4 first:pt-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900">{auditActionTitle(audit.action)}</h3>
                        <p className="mt-1 text-sm text-slate-600">{audit.actor}</p>
                      </div>
                      <time dateTime={audit.createdAt} className="shrink-0 text-xs text-slate-500 sm:text-right">
                        {formatMalaysiaDateTimeCompact(audit.createdAt)}
                      </time>
                    </div>
                    {audit.reason ? (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5 text-slate-600">
                        <span className="font-medium text-slate-700">Reason:</span> {audit.reason}
                      </p>
                    ) : null}
                    {changes.length ? (
                      <details className="group mt-3">
                        <summary className="w-fit cursor-pointer list-none text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
                          <span className="inline-flex items-center gap-2">
                            <span className="transition-transform group-open:rotate-90" aria-hidden="true">›</span>
                            View changes <span className="text-xs font-normal text-slate-500">({changes.length})</span>
                          </span>
                        </summary>
                        <table className="data-table mt-2 w-full table-fixed">
                          <colgroup><col className="w-2/5"/><col className="w-[30%]"/><col className="w-[30%]"/></colgroup>
                          <thead>
                            <tr><th scope="col" className="data-th p-2">Field</th><th scope="col" className="data-th p-2">Before</th><th scope="col" className="data-th p-2">After</th></tr>
                          </thead>
                          <tbody>
                            {changes.map((change) => (
                              <tr key={change.field} className="border-t border-slate-100">
                                <th scope="row" className="data-td-strong p-2 [overflow-wrap:anywhere]">{change.label}</th>
                                <td className="data-td p-2 [overflow-wrap:anywhere]">{change.before}</td>
                                <td className="data-td p-2 [overflow-wrap:anywhere]">{change.after}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
  </RecordPage>;

  return (
    <div className="office-tool-page space-y-6 animate-fade-in">
      <PageHeader
        className="office-tool-heading"
        title="Academic Semesters"
        subtitle="Control the faculty-wide semester used by timelines, appointment workflows, marks, and reporting."
        backLabel="Back to Dashboard"
        onBack={onBack}
        actions={(
          <>
            <PortalButton icon={Plus} variant="primary" disabled={savedRefreshFailure||loading} onClick={beginCreate}>
              New semester
            </PortalButton>
          </>
        )}
      />

      {error ? savedRefreshFailure?<AlertMessage type="warning" title="Changes saved; refresh required" message={error} actions={<PortalButton onClick={()=>void loadSemesters()}>Reload semesters</PortalButton>}/>:<ErrorState compact title="Couldn’t load semesters" message={error} onRetry={loadSemesters} /> : null}

      <OfficeToolContext label="Current faculty semester">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="card-label">Current faculty semester</p>
            <h2 className="section-heading mt-1 text-slate-900">
              {loading ? 'Loading current semester…' : error ? 'Current semester could not be verified' : active?.label ?? 'No effective active semester'}
            </h2>
            <p className="card-description mt-1">
              {loading ? 'Checking the faculty semester.' : error ? 'Retry the semester read to verify current scope.' : active
                ? `${displayDate(active.startsOn)} to ${displayDate(active.endsOn)}`
                : 'New workflows remain paused until a semester is activated.'}
            </p>
          </div>
          {!loading && !error && <StatusBadge
            tone={getStatusBadgeTone(active?.effectiveStatus ?? 'CLOSED')}
          >
            {formatSemesterLifecycle(active?.effectiveStatus ?? 'CLOSED')}
          </StatusBadge>}
        </div>
      </OfficeToolContext>

      <OfficeToolSection title="Semester records" icon={CalendarRange} description="Open a semester to review its dates, lifecycle actions and history.">
      <div className="office-tool-filters"><label className="form-label block w-full sm:max-w-sm">Semester status
        <PortalSelect className="form-control form-control-md mt-1" value={filter} onChange={event => { const value = event.target.value as LifecycleFilter; setFilter(value); setIncludeArchived(value === 'ALL' || value === 'ARCHIVED'); }}>
          <option value="ALL">All semesters, including archived</option>
          {(['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'] as const).map(value => <option key={value} value={value}>{formatSemesterLifecycle(value)}</option>)}
        </PortalSelect>
      </label></div>

      {loading ? <LoadingState message="Loading academic semesters..." /> : null}
      {!loading && !error && !visible.length ? (
        <EmptyState title="No semesters in this view" description="Create a draft semester or change the lifecycle filter." />
      ) : null}

      {!loading && !error && visible.length ? (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[640px]">
            <thead className="data-thead">
              <tr>
                <th className="data-th">Semester</th>
                <th className="data-th">Starts on</th>
                <th className="data-th">Ends on</th>
                <th className="data-th">Status</th>
                <th className="data-th text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visible.map((semester) => (
                <tr key={semester.id} className="bg-white">
                  <td className="data-td">
                    <p className="card-value">{semester.label}</p>
                    <p className="font-mono text-xs text-slate-500">{semester.code}</p>
                  </td>
                  <td className="data-td">
                    {displayDate(semester.startsOn)}
                  </td>
                  <td className="data-td">
                    {displayDate(semester.endsOn)}
                  </td>
                  <td className="data-td">
                    <StatusBadge tone={getStatusBadgeTone(semester.effectiveStatus)}>
                      {formatSemesterLifecycle(semester.effectiveStatus)}
                    </StatusBadge>
                  </td>
                  <td className="data-td text-right">
                    <PortalButton icon={Edit3} variant="secondary" disabled={savedRefreshFailure||loading} onClick={() => beginEdit(semester)}>
                      Open
                    </PortalButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      </OfficeToolSection>

    </div>
  );
};
