import { MarkEntryRecipientPreview } from './MarkEntryRecipientPreview';
export { MarkEntryRecipientPreview } from './MarkEntryRecipientPreview';
import { PortalModal } from './PortalModal';
import { MarksHeading } from './MarksPrimitives';
import { PortalSelect } from './PortalSelect';
import { ClosureReview } from './ClosureReview';
import type { ClosureApproval } from '../types/marks';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {flushSync} from 'react-dom';
import { Link } from 'react-router';
import { APP_ROUTES } from '../constants/routes';
import {
  Archive,
  CalendarClock,
  History,
  CheckCircle2,
  Plus,
  Save,
  XCircle,
  X,
  Users,
} from 'lucide-react';

import {
  archiveEvaluationPeriod,
  closeEvaluationPeriod,
  createEvaluationPeriod,
  getEvaluationPeriod,
  getEvaluationPeriods,
  getMarksProgrammeOptions,
  getEvaluationRecipientPreview,
  getAcademicSemesters,
  getRubricVersions,
  publishEvaluationPeriod,
  updateEvaluationPeriod,
} from '../services';
import type {
  EvaluationPeriodOption,
  EvaluationRecipientPreview,
  AcademicSemester,
  RubricVersion,
} from '../types';
import {
  formatPeriodStatus,
  marksMutationErrorMessage,
  toDateTimeLocalValue,
  validatePeriodTargeting,
  canPublishPeriodPreview,
  type PeriodPreviewApproval,
} from '../utils/marksProductionManagement';
import {
  PageHeader,
  PortalButton,
  PortalCard,
  PortalConfirmModal,
  StatusBadge,
  getStatusBadgeTone,
} from './PortalPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { malaysiaDeadline, formatMalaysiaDateTime as displayDateTime } from '../utils/malaysiaDateTime';
import {parseMarksPeriodContext} from '../utils/periodPresentation';
import {ApiError} from '../services/apiClient';
import {AlertMessage} from './AlertMessage';
import {FieldError,FormFeedback} from './FormFeedback';
import {clearFeedbackFields,focusFeedback,readFormFeedback,type FormFeedbackState} from '../utils/formFeedback';
import {DraftNavigationGuard} from './DraftNavigationGuard';
import {DecisionFeedbackProvider, useDecisionFeedback} from './DecisionFeedback';
import {MarkEntryPeriodList} from './MarkEntryPeriodList';

interface MarkEntryPeriodConfigProps {
  onBack: () => void;
  onManageSemesters: () => void;
  onManageTimeline?: (period?:Pick<EvaluationPeriodOption,'id'|'semesterId'>) => void;
  contextSearch?: string;
}

type PeriodForm = {
  name: string;
  semesterId: string;
  rubricId: string;
  opensAt: string;
  closesAt: string;
  programmeScope: '' | 'ALL' | 'SELECTED';
  programmes: string[];
  evaluatorRoles: Array<'SUPERVISOR' | 'PANEL'>;
};

const EMPTY_FORM: PeriodForm = {
  name: '',
  semesterId: '',
  rubricId: '',
  opensAt: '',
  closesAt: '',
  programmeScope: '',
  programmes: [],
  evaluatorRoles: [],
};
const PERIOD_FIELDS=Object.fromEntries(['name','semesterId','rubricId','opensAt','closesAt','programmeScope','programmes','evaluatorRoles'].map(key=>[key,{id:`marks-period-${key}`,label:({name:'Period name',semesterId:'Academic semester',rubricId:'Rubric version',opensAt:'Opens at',closesAt:'Closes at',programmeScope:'Programme scope',programmes:'Programmes',evaluatorRoles:'Evaluator roles'} as Record<string,string>)[key]}]));
const PERIOD_FIELD_MAP=Object.fromEntries(Object.keys(PERIOD_FIELDS).map(key=>[key,key]));
const PERIOD_IDS=Object.fromEntries(Object.entries(PERIOD_FIELDS).map(([key,value])=>[key,value.id]));

const periodToForm = (period: EvaluationPeriodOption): PeriodForm => ({
  name: period.name,
  semesterId: period.semesterId ? String(period.semesterId) : '',
  rubricId: String(period.rubricId),
  opensAt: toDateTimeLocalValue(period.opensAt),
  closesAt: toDateTimeLocalValue(period.closesAt),
  programmeScope: period.programmeScope || 'ALL',
  programmes: period.programmes || [],
  evaluatorRoles: period.evaluatorRoles || ['SUPERVISOR', 'PANEL'],
});

export function MarksPeriodDeadlineControls({value,onChange,editable,error}: {
  value:string;onChange:(value:string)=>void;editable:boolean;onManageTimeline?:()=>void;error?:string;
}) {
  return <div className="space-y-3"><label className="form-label block">Closes at (Malaysia, UTC+08:00)
    <input id="marks-period-closesAt" aria-invalid={!!error} aria-describedby={error?'marks-period-closesAt-error':undefined} required type="datetime-local" disabled={!editable} value={value} onChange={event=>onChange(event.target.value)} className="form-control form-control-md mt-2 w-full disabled:bg-slate-100"/>
    <FieldError id="marks-period-closesAt-error" message={error}/>
  </label></div>;
}

const MarkEntryPeriodContent: React.FC<MarkEntryPeriodConfigProps> = ({
  onBack,
  onManageTimeline,
  contextSearch='',
}) => {
  const context=parseMarksPeriodContext(contextSearch);
  const contextScope=useRef(contextSearch);contextScope.current=contextSearch;
  const [contextSemester,setContextSemester]=useState<AcademicSemester|null>(null);
  const [contextBlocked,setContextBlocked]=useState(false);
  const contextRequest=useRef(0);
  const [periods, setPeriods] = useState<EvaluationPeriodOption[]>([]);
  const [rubrics, setRubrics] = useState<RubricVersion[]>([]);
  const [semesters, setSemesters] = useState<AcademicSemester[]>([]);
  const [selected, setSelected] = useState<EvaluationPeriodOption | null>(null);
  const [form, setForm] = useState<PeriodForm>(EMPTY_FORM);
  const [newBaseline,setNewBaseline]=useState<PeriodForm>(EMPTY_FORM);
  const [programmeOptions, setProgrammeOptions] = useState<string[]>([]);
  const [preview, setPreview] = useState<(EvaluationRecipientPreview & PeriodPreviewApproval) | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const selectionRequest = useRef(0);
  const previewRequest = useRef(0);
  const invalidatePreview = () => { setPreviewOpen(false); previewRequest.current += 1; setPreview(null); setPreviewLoading(false); setPreviewError(null); setFinalReview(null); };
  const updateForm = (change: React.SetStateAction<PeriodForm>) => { invalidatePreview();const next=typeof change==='function'?change(form):change;setForm(next);const changed=Object.keys(next).filter(key=>JSON.stringify(next[key as keyof PeriodForm])!==JSON.stringify(form[key as keyof PeriodForm]));setFormFeedback(current=>clearFeedbackFields(current,changed)); };
  const [reason, setReason] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [listFilters, setListFilters] = useState({search: '', status: 'current', page: 1});
  const [archivedAvailable, setArchivedAvailable] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const editorHeading = useRef<HTMLDivElement>(null);
  const [detailFocusRequest, setDetailFocusRequest] = useState(0);
  const listRegion = useRef<HTMLElement>(null);
  const [listFocusRequest, setListFocusRequest] = useState(0);
  const periodNameInput = useRef<HTMLInputElement>(null);
  const [newDraftFocusRequest, setNewDraftFocusRequest] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionError,setSelectionError]=useState<string|null>(null);
  const [selectionTarget,setSelectionTarget]=useState<EvaluationPeriodOption|null>(null);
  const [formFeedback,setFormFeedback]=useState<FormFeedbackState|null>(null);
  const [actionError,setActionError]=useState<string|null>(null);
  const [savedReadBlocked,setSavedReadBlocked]=useState(false);
  const [conflictBlocked,setConflictBlocked]=useState(false);
  const [replacement,setReplacement]=useState<null|(()=>void)>(null);
  const [recoveryPeriod,setRecoveryPeriod]=useState<EvaluationPeriodOption|null>(null);
  const [finalReview,setFinalReview]=useState<'publish'|'archive'|null>(null);
  const finalReviewIdentity=useRef<{contextSearch:string;periodId:number}|null>(null);
  const [acknowledged,setAcknowledged]=useState(false);
  const [closureContext,setClosureContext]=useState<{periodId:number;search:string}|null>(null);
  const [discardClosure,setDiscardClosure]=useState(false);
  const pendingWrite=useRef(false);
  const feedback=useDecisionFeedback();
  const fieldProps=(key:string)=>({id:PERIOD_FIELDS[key].id,'aria-invalid':!!formFeedback?.fields[key],'aria-describedby':formFeedback?.fields[key]?`${PERIOD_FIELDS[key].id}-error`:undefined});
  const fieldError=(key:string)=><FieldError id={`${PERIOD_FIELDS[key].id}-error`} message={formFeedback?.fields[key]}/>;
  const report=(feedback:FormFeedbackState)=>{setFormFeedback(feedback);focusFeedback(feedback,PERIOD_IDS,'marks-period-save-feedback');};
  const notify=(message:string,tone:'success'|'warning')=>feedback?.(message,tone);

  const loadWorkspace = useCallback(async () => {
    const requestId=++contextRequest.current;
    selectionRequest.current+=1;
    setSelecting(false);
    setLoading(true);
    setError(null);
    setContextBlocked(false);
    try {
      if(context.invalid)throw new ApiError('The requested evaluation context is invalid. Return to Periods & deadlines and open the configuration again.',400);
      const includesArchives = includeArchived || !!context.periodId;
      const [periodRows, rubricRows, semesterRows, programmes, archiveRows] = await Promise.all([
        getEvaluationPeriods(includesArchives),
        getRubricVersions(),
        getAcademicSemesters(),
        getMarksProgrammeOptions(),
        includesArchives ? Promise.resolve(null) : getEvaluationPeriods(true),
      ]);
      if(requestId!==contextRequest.current)return;
      const requestedSemester=context.semesterId?semesterRows.find(row=>row.id===context.semesterId):null;
      if(context.semesterId&&!requestedSemester)throw new ApiError('The requested academic semester is unavailable. Return to Periods & deadlines to choose another semester.',400);
      const requestedPeriod=context.periodId?periodRows.find(row=>row.id===context.periodId&&row.semesterId===context.semesterId):null;
      if(context.periodId&&!requestedPeriod)throw new ApiError('The requested evaluation period does not belong to this semester or is unavailable. Return to Periods & deadlines.',400);
      setContextSemester(requestedSemester??null);
      if(context.semesterId)setSelected(current=>current?.semesterId===context.semesterId?current:null);
      setProgrammeOptions(programmes);
      setArchivedAvailable((archiveRows ?? periodRows).some(period => period.lifecycleStatus === 'ARCHIVED' && (!context.semesterId || period.semesterId === context.semesterId)));
      invalidatePreview();
      setPeriods(periodRows.filter(row => (!context.semesterId || row.semesterId === context.semesterId) && (includeArchived || row.lifecycleStatus !== 'ARCHIVED')));
      setRubrics(rubricRows);
      const editableSemesters = semesterRows.filter((semester) => (
        semester.lifecycleStatus === 'DRAFT' || semester.lifecycleStatus === 'ACTIVE'
      ));
      setSemesters(editableSemesters);
      setForm((current) => (
        context.semesterId?(current.semesterId===String(context.semesterId)?current:{...EMPTY_FORM,semesterId:String(context.semesterId)}):current.semesterId
          ? current
          : {
              ...current,
              semesterId: String(
                editableSemesters.find((semester) => semester.effectiveStatus === 'ACTIVE')?.id
                ?? editableSemesters[0]?.id
                ?? '',
              ),
            }
      ));
      if(requestedPeriod&&!(selected?.id===requestedPeriod.id&&selected.semesterId===context.semesterId)){
        const detail=await getEvaluationPeriod(requestedPeriod.id);
        if(detail.semesterId!==context.semesterId)throw new ApiError('The evaluation period context changed. Return to Periods & deadlines and reload.',400);
        if(requestId!==contextRequest.current)return;
        setSelected(detail);setForm(periodToForm(detail));setReason('');
        setEditorOpen(true);
      } else if (selected) {
        const refreshed = periodRows.find((period) => period.id === selected.id&&(!context.semesterId||period.semesterId===context.semesterId));
        if (!refreshed) {
          setSelected(null);
          setEditorOpen(false);
          setForm({...EMPTY_FORM,semesterId:context.semesterId?String(context.semesterId):''});
        }
      }
    } catch (loadError) {
      if(requestId!==contextRequest.current)return;
      setError(marksMutationErrorMessage(loadError));
      if(contextSearch)setContextBlocked(true);
    } finally {
      if(requestId===contextRequest.current)setLoading(false);
    }
  }, [includeArchived, selected,contextSearch]);

  useEffect(() => {
    setEditorOpen(false);
    void loadWorkspace();
    return()=>{contextRequest.current+=1;selectionRequest.current+=1;};
  }, [includeArchived,contextSearch]);

  const readyRubrics = useMemo(
    () => rubrics.filter((rubric) => rubric.isActive && !rubric.isArchived && rubric.isReady),
    [rubrics],
  );

  const beginNew = (force=false) => {
    if(pendingWrite.current||saving||selecting||conflictBlocked||savedReadBlocked)return;
    if(!force&&editorOpen&&draftDirty){setReplacement(()=>()=>beginNew(true));return;}
    setFormFeedback(null);setActionError(null);setSelectionError(null);setSelectionTarget(null);setSavedReadBlocked(false);
    selectionRequest.current += 1;
    setSelecting(false);
    invalidatePreview();
    setSelected(null);
    const initial={
      ...EMPTY_FORM,
      semesterId: String(
        context.semesterId??semesters.find((semester) => semester.effectiveStatus === 'ACTIVE')?.id
        ?? semesters[0]?.id
        ?? '',
      ),
      rubricId: readyRubrics[0] ? String(readyRubrics[0].id) : '',
    };
    setForm(initial);setNewBaseline(initial);
    setReason('');
    setError(null);
    setEditorOpen(true);
    setNewDraftFocusRequest(request => request + 1);
  };

  useEffect(() => {
    if (newDraftFocusRequest === 0) return;
    periodNameInput.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    periodNameInput.current?.focus({ preventScroll: true });
  }, [newDraftFocusRequest]);

  useEffect(() => {
    if (detailFocusRequest === 0) return;
    editorHeading.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    editorHeading.current?.focus({ preventScroll: true });
  }, [detailFocusRequest]);

  const returnToList = (force=false) => {
    if(pendingWrite.current||saving||selecting)return;
    if(!force&&draftDirty){setReplacement(()=>()=>returnToList(true));return;}
    invalidatePreview();
    setEditorOpen(false);
    setListFocusRequest(request => request + 1);
  };

  useEffect(() => {
    if (listFocusRequest === 0) return;
    listRegion.current?.focus();
  }, [listFocusRequest]);

  const selectPeriod = async (period: EvaluationPeriodOption, force=false) => {
    if(pendingWrite.current||saving||selecting)return;
    if(!force&&editorOpen&&draftDirty){setReplacement(()=>()=>void selectPeriod(period,true));return;}
    setSelectionTarget(period);
    const requestId = ++selectionRequest.current;
    const requestedScope=contextSearch;
    invalidatePreview();
    setSelecting(true);
    setSelectionError(null);setFormFeedback(null);setActionError(null);
    try {
      const detail = await getEvaluationPeriod(period.id);
      if (requestId !== selectionRequest.current||requestedScope!==contextScope.current) return;
      if(context.semesterId&&detail.semesterId!==context.semesterId){const message='The evaluation period no longer belongs to the selected semester. Return to Periods & deadlines and reload.';setContextBlocked(true);setError(message);throw new ApiError(message,409);}
      setSelected(detail);
      setSavedReadBlocked(false);
      setConflictBlocked(false);
      setForm(periodToForm(detail));
      setReason('');
      setEditorOpen(true);
      setDetailFocusRequest(request => request + 1);
    } catch (loadError) {
      if (requestId === selectionRequest.current) setSelectionError(marksMutationErrorMessage(loadError));
    } finally {
      if (requestId === selectionRequest.current) setSelecting(false);
    }
  };

  const replacePeriod = (updated: EvaluationPeriodOption) => {
    invalidatePreview();
    setPeriods((current) => {
      if(updated.lifecycleStatus==='ARCHIVED'&&!includeArchived)return current.filter(period=>period.id!==updated.id);
      const exists = current.some((period) => period.id === updated.id);
      return exists
        ? current.map((period) => period.id === updated.id ? updated : period)
        : [updated, ...current];
    });
    setSelected(updated);
    setForm(periodToForm(updated));
    setNewBaseline(periodToForm(updated));
    setEditorOpen(true);
    if (updated.lifecycleStatus === 'ARCHIVED') setArchivedAvailable(true);
  };

  const recoverLatest = async () => {
    if(!selected||pendingWrite.current||selecting)return;
    const requestId=++selectionRequest.current;
    const requestedScope=contextSearch;
    setSelecting(true);setSelectionError(null);
    try {
      const detail=await getEvaluationPeriod(selected.id);
      if(requestId!==selectionRequest.current||requestedScope!==contextScope.current)return;
      if(context.semesterId&&detail.semesterId!==context.semesterId)throw new ApiError('The evaluation period context changed. Return to Periods & deadlines and reload.',409);
      if(draftDirty)setRecoveryPeriod(detail);
      else {replacePeriod(detail);setSavedReadBlocked(false);setConflictBlocked(false);setFormFeedback(null);setActionError(null);}
    } catch(readError) {
      if(requestId===selectionRequest.current)setSelectionError(marksMutationErrorMessage(readError));
    } finally {if(requestId===selectionRequest.current)setSelecting(false);}
  };

  const savePeriod = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pendingWrite.current || saving || selecting || loading || contextBlocked || savedReadBlocked || conflictBlocked || (selected && selected.lifecycleStatus !== 'DRAFT')) return;
    const requestedScope=contextSearch;
    const targetingError = validatePeriodTargeting(form);
    if (targetingError) { const key=!form.programmeScope?'programmeScope':form.programmeScope==='SELECTED'&&!form.programmes.length?'programmes':'evaluatorRoles';report({message:'Correct the highlighted fields, then save again.',fields:{[key]:targetingError}});return; }
    invalidatePreview();
    pendingWrite.current=true;
    setSaving(true);
    setFormFeedback(null);setActionError(null);
    let committed=false;
    try {
      const payload = {
        name: form.name.trim(),
        semesterId: Number(form.semesterId),
        rubricId: Number(form.rubricId),
        opensAt: form.opensAt ? malaysiaDeadline(form.opensAt) : null,
        closesAt: form.closesAt ? malaysiaDeadline(form.closesAt) : null,
        programmeScope: form.programmeScope as 'ALL' | 'SELECTED',
        programmes: form.programmeScope === 'SELECTED' ? form.programmes : [],
        evaluatorRoles: form.evaluatorRoles,
      };
      const updated = selected
        ? await updateEvaluationPeriod(
            selected.id,
            payload,
          )
        : await createEvaluationPeriod(payload);
      if(requestedScope!==contextScope.current)return;
      replacePeriod(updated);
      committed=true;
      setSavedReadBlocked(true);
      setConflictBlocked(false);
      const detail=await getEvaluationPeriod(updated.id);
      if(requestedScope!==contextScope.current)return;
      replacePeriod(detail);
      setSavedReadBlocked(false);
      notify(selected ? 'Period changes saved.' : 'Draft period created.','success');
    } catch (saveError) {
      if(requestedScope===contextScope.current){
        if(committed)notify('Period saved. The latest record could not be loaded. Reload it before another action.','warning');
        else {if(saveError instanceof ApiError&&(saveError.status===403||saveError.status===409))setConflictBlocked(true);report(readFormFeedback(saveError,marksMutationErrorMessage(saveError),PERIOD_FIELD_MAP));}
      }
    } finally {
      pendingWrite.current=false;
      setSaving(false);
    }
  };

  const runTransition = async (
    action: 'publish' | 'close' | 'archive',
    approval?: ClosureApproval,
  ) => {
    if (!selected || pendingWrite.current || saving || selecting || savedReadBlocked || conflictBlocked) return;
    const requestedScope=contextSearch;
    if (action === 'publish' && !canPublish) return;
    const reviewedPreview=preview;
    invalidatePreview();
    pendingWrite.current=true;
    setSaving(true);
    setActionError(null);
    let committed=false;
    try {
      if(action==='publish'){
        const latest=await getEvaluationPeriod(selected.id);
        if(requestedScope!==contextScope.current)return;
        if(!reviewedPreview||JSON.stringify(latest)!==reviewedPreview.periodSnapshot){
          replacePeriod(latest);
          setActionError('The saved period changed. Review its current configuration and recipient preview before publishing.');
          return;
        }
      }
      const updated = action === 'publish'
        ? await publishEvaluationPeriod(selected.id)
        : action === 'close'
          ? await closeEvaluationPeriod(selected.id, reason, approval)
          : await archiveEvaluationPeriod(selected.id, reason);
      if(requestedScope!==contextScope.current)return;
      replacePeriod(updated);committed=true;setClosureContext(null);setDiscardClosure(false);setSavedReadBlocked(true);setConflictBlocked(false);setReason('');setAcknowledged(false);
      const detail=await getEvaluationPeriod(updated.id);
      if(requestedScope!==contextScope.current)return;
      replacePeriod(detail);
      setSavedReadBlocked(false);
      notify(
        action === 'publish'
          ? 'Period published.'
          : action === 'close'
            ? 'Period closed.'
            : 'Period archived.','success',
      );
      if (action === 'archive' && !includeArchived) {
        setPeriods((current) => current.filter((period) => period.id !== updated.id));
        setSelected(null);
        setEditorOpen(false);
        setForm({...EMPTY_FORM,semesterId:context.semesterId?String(context.semesterId):''});
      }
    } catch (transitionError) {
      if(requestedScope===contextScope.current){
        if(committed)notify('Period changed. The latest record could not be loaded. Reload it before another action.','warning');
        else {if(transitionError instanceof ApiError&&(transitionError.status===403||transitionError.status===409))setConflictBlocked(true);if(!approval)setActionError(marksMutationErrorMessage(transitionError));}
      }
      if (approval&&!committed) throw transitionError;
    } finally {
      pendingWrite.current=false;
      setSaving(false);
    }
  };

  const draftEditable = (!selected || selected.lifecycleStatus === 'DRAFT')&&(!contextSemester||['DRAFT','ACTIVE'].includes(contextSemester.lifecycleStatus));
  const published = selected?.lifecycleStatus === 'PUBLISHED';
  const closed = selected?.lifecycleStatus === 'CLOSED';
  const closureOpen = !!published && closureContext?.periodId === selected?.id && closureContext?.search === contextSearch;
  const closeClosure = () => { setClosureContext(null); setReason(''); setAcknowledged(false); setDiscardClosure(false); };
  const requestCloseClosure = () => { if (saving) return; if (reason.trim() || acknowledged) setDiscardClosure(true); else closeClosure(); };
  const formSnapshot = JSON.stringify(form);
  const savedFormSnapshot = JSON.stringify(selected ? periodToForm(selected) : newBaseline);
  const hasUnsavedChanges = formSnapshot !== savedFormSnapshot;
  const draftDirty=editorOpen&&(hasUnsavedChanges||!!reason.trim()||acknowledged);
  const canPublish = !saving && !selecting && !previewLoading && !conflictBlocked && !savedReadBlocked && canPublishPeriodPreview(selected, formSnapshot, savedFormSnapshot, preview);
  const selectableProgrammes = [...new Set([...programmeOptions, ...form.programmes])].sort();

  const loadRecipientPreview = async () => {
    if (!selected || hasUnsavedChanges || saving || selecting || savedReadBlocked) return;
    const requestId = ++previewRequest.current;
    setPreview(null);
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      // Refresh the saved configuration first, so another office edit cannot be
      // silently approved using this screen's previous draft values.
      const detail = await getEvaluationPeriod(selected.id);
      if (requestId !== previewRequest.current) return;
      if (JSON.stringify(detail) !== JSON.stringify(selected)) {
        replacePeriod(detail);
        setActionError('The saved period changed. Review its current configuration and recipient preview before publishing.');
        return;
      }
      const result = await getEvaluationRecipientPreview(selected.id);
      if (requestId !== previewRequest.current) return;
      setPreview({ ...result, formSnapshot, periodSnapshot: JSON.stringify(detail) });
    } catch (previewError) {
      if (requestId === previewRequest.current) setPreviewError(marksMutationErrorMessage(previewError));
    } finally {
      if (requestId === previewRequest.current) setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!editorOpen || selected?.lifecycleStatus !== 'DRAFT' || hasUnsavedChanges || saving || selecting || loading) return;
    void loadRecipientPreview();
    return () => { previewRequest.current += 1; };
  }, [editorOpen, selected, formSnapshot, hasUnsavedChanges, saving, selecting, loading, includeArchived]);

  const emptyList = !editorOpen && !loading && !error && !contextBlocked && periods.length === 0;
  const newPeriodDisabled = saving || loading || contextBlocked || savedReadBlocked || conflictBlocked || !!contextSemester && !['DRAFT', 'ACTIVE'].includes(contextSemester.lifecycleStatus);

  const leaveTo=(action:()=>void)=>{
    if(pendingWrite.current||saving||selecting)return;
    if(draftDirty){setReplacement(()=>action);return;}
    action();
  };
  const discardAndRun=()=>{
    const next=replacement;
    flushSync(()=>{setReplacement(null);setForm(selected?periodToForm(selected):newBaseline);setReason('');setAcknowledged(false);});
    next?.();
  };
  const openFinalReview=(action:'publish'|'archive')=>{
    if(!selected||pendingWrite.current)return;
    finalReviewIdentity.current={contextSearch,periodId:selected.id};
    setFinalReview(action);
  };
  const finalReviewCurrent=finalReview!==null&&finalReviewIdentity.current?.contextSearch===contextSearch&&finalReviewIdentity.current?.periodId===selected?.id&&(finalReview!=='publish'||!!preview);

  return (
    <div id="mark-entry-period-configuration" className="marks-workspace space-y-7 animate-fade-in">
      <DraftNavigationGuard dirty={draftDirty} busy={saving||selecting} />
      <PortalConfirmModal isOpen={replacement!==null} title="Discard unsaved period changes?" message="Leave this period and discard the unsaved changes?" confirmLabel="Discard changes" cancelLabel="Stay on this page" onCancel={()=>setReplacement(null)} onConfirm={discardAndRun}/>
      <PortalConfirmModal isOpen={recoveryPeriod!==null} title="Review latest period" message="The latest saved period is available. Replace the visible unsaved changes with it?" confirmLabel="Discard changes" cancelLabel="Stay on this page" onCancel={()=>setRecoveryPeriod(null)} onConfirm={()=>{if(!recoveryPeriod)return;replacePeriod(recoveryPeriod);setRecoveryPeriod(null);setSavedReadBlocked(false);setConflictBlocked(false);setFormFeedback(null);setActionError(null);setReason('');setAcknowledged(false);}}/>
      <PortalModal isOpen={previewOpen && !!preview && canPublish} onClose={() => setPreviewOpen(false)} labelledBy="period-recipient-preview-title" className="max-w-6xl p-0">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div><h2 id="period-recipient-preview-title" className="text-base font-bold text-slate-900">Recipient preview</h2><p className="card-description mt-1">{selected?.name}</p></div>
          <PortalButton icon={X} aria-label="Close recipient preview" onClick={() => setPreviewOpen(false)} />
        </div>
        <div className="px-6 py-6">{preview ? <MarkEntryRecipientPreview preview={preview} /> : null}</div>
        <div className="flex justify-end border-t border-slate-200 px-6 py-4"><PortalButton variant="primary" onClick={() => setPreviewOpen(false)}>Done</PortalButton></div>
      </PortalModal>
      <PortalConfirmModal
        isOpen={finalReviewCurrent && finalReview === 'publish'}
        title={finalReview === 'publish' ? 'Publish evaluation period?' : 'Archive evaluation period'}
        tone={finalReview === 'publish' ? 'info' : 'danger'}
        icon={finalReview === 'publish' ? CheckCircle2 : Archive}
        message={finalReview === 'publish' ? <div className="space-y-4">
          <div><p className="text-sm font-semibold text-slate-900">{selected?.name}</p><p className="mt-1">{selected?.semester}</p></div>
          <dl className="space-y-3 border-y border-slate-200 py-4">
            <div><dt className="text-xs text-slate-500">Programmes</dt><dd className="mt-1 text-slate-800">{selected?.programmeScope === 'SELECTED' ? selected.programmes?.join(', ') : 'All programmes'}</dd></div>
            <div><dt className="text-xs text-slate-500">Evaluators</dt><dd className="mt-1 text-slate-800">{(selected?.evaluatorRoles || ['SUPERVISOR', 'PANEL']).map(role => role === 'SUPERVISOR' ? 'Supervisor' : 'Panel').join(' and ')}</dd></div>
          </dl>
          {preview?.totals.total === 0 ? <p>No recipients matched this preview. Publishing may create no tasks now; later eligible appointments may add tasks automatically.</p> : <p className="text-sm font-semibold text-slate-900">{preview?.totals.total ?? 0} {(preview?.totals.total ?? 0) === 1 ? 'task' : 'tasks'} for {preview?.totals.students ?? 0} {(preview?.totals.students ?? 0) === 1 ? 'student' : 'students'}</p>}
          <div className="space-y-1 text-xs text-slate-500"><p>Estimate as of {preview?.generatedAt ? displayDateTime(preview.generatedAt) : 'the last available preview'}.</p><p>Recipients may change before publication.</p></div>
        </div> : <>Archive {selected?.name} for {selected?.semester}? Reason: {reason}</>}
        confirmLabel={finalReview === 'publish' ? 'Publish period' : 'Archive period'}
        cancelLabel="Cancel" isLoading={saving} onCancel={() => setFinalReview(null)}
        onConfirm={() => { const action = finalReview; if (!action || !finalReviewCurrent) return; setFinalReview(null); void runTransition(action); }}
      />
      <PortalModal isOpen={finalReviewCurrent && finalReview === 'archive'} onClose={() => { if (!saving) setFinalReview(null); }} busy={saving} labelledBy="period-archive-title" className="max-w-2xl p-0">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div><h2 id="period-archive-title" className="text-base font-bold text-slate-900">Archive evaluation period</h2><p className="card-description mt-1">{selected?.name}</p></div>
          <PortalButton icon={X} aria-label="Close archive dialog" disabled={saving} onClick={() => setFinalReview(null)} />
        </div>
        <div className="px-6 py-6">
          <label htmlFor="marks-period-archive-reason" className="form-label block">Reason for archiving</label>
          <textarea id="marks-period-archive-reason" required value={reason} onChange={event => setReason(event.target.value)} rows={4} placeholder="Enter a reason for archiving this period" className="mt-3 w-full rounded-lg border border-slate-200 p-3 text-sm leading-6" disabled={saving} />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
          <PortalButton disabled={saving} onClick={() => setFinalReview(null)}>Cancel</PortalButton>
          <PortalButton variant="dangerSolid" icon={Archive} isLoading={saving} disabled={!reason.trim() || conflictBlocked || savedReadBlocked} onClick={() => { if (!finalReviewCurrent) return; setFinalReview(null); void runTransition('archive'); }}>Archive period</PortalButton>
        </div>
      </PortalModal>
      <PortalModal isOpen={closureOpen} onClose={requestCloseClosure} busy={saving} labelledBy="period-closure-title" className="max-w-5xl p-0">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div><h2 id="period-closure-title" className="text-base font-bold text-slate-900">Close mark entry period</h2><p className="card-description mt-1">{selected?.name}</p></div>
          <PortalButton icon={X} aria-label="Close period closure review" disabled={saving} onClick={requestCloseClosure} />
        </div>
        <div className="space-y-5 px-6 py-6">
          {closureOpen && selected ? <ClosureReview key={`${selected.id}-${contextSearch}`} kind="period" id={selected.id} confirmLabel="Close period" disabled={saving || selecting || conflictBlocked || savedReadBlocked || !reason.trim() || hasUnsavedChanges} onAcknowledgementChange={setAcknowledged} onBlocked={()=>setConflictBlocked(true)} onConfirm={approval => runTransition('close', approval)}>
            <label className="form-label block">Reason for closure
              <textarea id="marks-period-reason" value={reason} onChange={event => setReason(event.target.value)} disabled={saving} rows={3} className="form-control mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm" />
            </label>
          </ClosureReview> : null}
        </div>
        <div className="flex justify-end border-t border-slate-200 px-6 py-4"><PortalButton disabled={saving} onClick={requestCloseClosure}>Cancel</PortalButton></div>
      </PortalModal>
      <PortalConfirmModal isOpen={closureOpen && discardClosure} title="Discard closure details?" message="Discard the reason and acknowledgement entered for this closure?" confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={() => setDiscardClosure(false)} onConfirm={closeClosure} />
      <PageHeader
        title={editorOpen ? selected?.name || 'New mark entry period' : 'Mark Entry Periods'}
        subtitle="Set evaluation dates, rubrics and recipients."
        backLabel={editorOpen ? "Back to Mark Entry Periods" : "Back to Marks overview"}
        onBack={()=>editorOpen ? returnToList() : leaveTo(onBack)}
        actions={!editorOpen ? <PortalButton icon={Plus} variant="primary" onClick={()=>beginNew()} disabled={newPeriodDisabled}>New period</PortalButton> : undefined}
      />

      {error ? <ErrorState compact title={contextBlocked?'Evaluation context needs review':'Couldn’t load evaluation configuration'} message={error} onRetry={loadWorkspace} /> : null}

      {contextSemester?<div className="rounded-lg border border-slate-200 bg-white p-4"><p className="card-value">{contextSemester.label}</p><p className="card-description mt-1">Opened from Periods &amp; deadlines. Evaluation periods below are limited to this semester.</p></div>:null}

      {loading ? (
        <LoadingState message="Loading evaluation periods..." />
      ) : contextBlocked||error?null:(
        <div>
          {!editorOpen ? <section ref={listRegion} tabIndex={-1} className="space-y-3" aria-label="Configured evaluation periods">
            {selecting ? <p role="status" className="card-description">Opening period…</p> : null}
            {selectionError?<ErrorState compact title="Couldn’t open the selected period" message={selectionError} onRetry={selectionTarget?()=>void selectPeriod(selectionTarget):undefined}/>:null}
            {emptyList && !archivedAvailable && !listFilters.search && listFilters.status === 'current' ? <PortalCard data-period-empty padding="lg">
              <EmptyState icon={CalendarClock} title="No evaluation periods yet" description={newPeriodDisabled ? 'No periods are configured. This semester is read-only.' : 'Create your first period to prepare marks entry.'} />
            </PortalCard> : <MarkEntryPeriodList periods={periods} filters={listFilters} busy={saving || selecting} onManage={period => void selectPeriod(period)} onFiltersChange={next => {setListFilters(next);setIncludeArchived(next.status !== 'current');}} />}

          </section> : (

          <div className="period-config-workspace">
          <PortalCard padding="lg" className="period-config-editor min-w-0 rounded-2xl">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div ref={editorHeading} tabIndex={-1}>
                <MarksHeading icon={CalendarClock}>{selected ? 'Period configuration' : 'New draft period'}</MarksHeading>
                <p className="card-description mt-1">
                  {selected && !draftEditable ? 'Published periods lock their dates, recipients and rubric. Manage extensions in Periods & deadlines.' : 'Saving a draft does not open marks entry.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
              {selected ? (
                <StatusBadge tone={getStatusBadgeTone(selected.effectiveStatus)}>
                  {formatPeriodStatus(selected.effectiveStatus)}
                </StatusBadge>
              ) : null}
              </div>
            </div>

            {savedReadBlocked?<AlertMessage type="warning" title="Changes saved; refresh required" message="The saved period could not be refreshed. Reload its current configuration before another change." actions={selected?<PortalButton disabled={selecting} onClick={()=>void recoverLatest()}>Reload saved period</PortalButton>:undefined}/>:null}
            {conflictBlocked?<AlertMessage type="warning" title="Review latest period" message="The saved period changed or access was denied. Review its latest record before trying another write." actions={selected?<PortalButton disabled={selecting} onClick={()=>void recoverLatest()}>Review latest period</PortalButton>:undefined}/>:null}
            {selectionError?<AlertMessage type="error" title="Couldn’t reload period" message={selectionError}/>:null}
            <form onSubmit={savePeriod} className="feedback-fields space-y-4">
              <fieldset disabled={saving || selecting || savedReadBlocked || conflictBlocked} className="period-config-sections">
              <section aria-labelledby="period-details-heading" className="period-config-section"><h3 id="period-details-heading" className="section-label mb-5">Period details</h3><div className="period-config-identity">
              <label className="form-label block">
                Period name
                <input
                  required
                  ref={periodNameInput}
                  {...fieldProps('name')}
                  disabled={!draftEditable}
                  value={form.name}
                  onChange={(event) => updateForm((current) => ({ ...current, name: event.target.value }))}
                  className="form-control form-control-md mt-2 w-full disabled:bg-slate-100"
                />
                {fieldError('name')}
              </label>
              <label className="form-label block">
                Academic semester
                <PortalSelect
                  {...fieldProps('semesterId')}
                  disabled={!!context.semesterId||!draftEditable}
                  required
                  value={form.semesterId}
                  onChange={(event) => updateForm((current) => ({ ...current, semesterId: event.target.value }))}
                  className="form-control form-control-md mt-2 w-full disabled:bg-slate-100"
                >
                  <option value="" disabled hidden={!!form.semesterId}>Select a semester</option>
                  {contextSemester&&!semesters.some(row=>row.id===contextSemester.id)?<option value={contextSemester.id}>{contextSemester.label}</option>:null}
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.label}
                    </option>
                  ))}
                </PortalSelect>
                {fieldError('semesterId')}
              </label>
              <label className="form-label block period-config-rubric">
                Rubric version
                <PortalSelect
                  required
                  {...fieldProps('rubricId')}
                  disabled={!draftEditable}
                  value={form.rubricId}
                  onChange={(event) => updateForm((current) => ({ ...current, rubricId: event.target.value }))}
                  className="form-control form-control-md mt-2 w-full disabled:bg-slate-100"
                >
                  <option value="" disabled hidden={!!form.rubricId}>Select a ready rubric</option>
                  {selected && !readyRubrics.some(rubric => String(rubric.id) === form.rubricId) ? rubrics.filter(rubric => String(rubric.id) === form.rubricId).map(rubric => <option key={rubric.id} value={rubric.id} disabled>{rubric.name} · v{rubric.version} · Existing assignment</option>) : null}
                  {readyRubrics.map((rubric) => (
                    <option key={rubric.id} value={rubric.id}>
                      {rubric.name} · v{rubric.version} · {rubric.targetMark} marks
                    </option>
                  ))}
                </PortalSelect>
                {fieldError('rubricId')}
                {draftEditable && readyRubrics.length === 0 ? <span className="card-description mt-2 block">No ready rubric available. <Link to={APP_ROUTES.marksRubrics} className="font-semibold text-blue-700 hover:underline">Configure a rubric</Link> before creating this period.</span> : null}
              </label>
              </div>
              </section>
              <section aria-labelledby="period-recipients-heading" className="period-config-section"><h3 id="period-recipients-heading" className="section-label mb-5">Recipients</h3><div className="period-config-targets">
              <fieldset {...fieldProps('programmeScope')} tabIndex={-1} disabled={!draftEditable} className="space-y-3 rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-700">Programme scope</legend>
                {(['ALL', 'SELECTED'] as const).map((scope) => <label key={scope} className="card-description flex items-center gap-2">
                  <input type="radio" name="programmeScope" value={scope} required checked={form.programmeScope === scope} onChange={() => updateForm((current) => ({ ...current, programmeScope: scope }))} />
                  {scope === 'ALL' ? 'All programmes (including future programmes)' : 'Selected programmes'}
                </label>)}
                {fieldError('programmeScope')}
                {form.programmeScope === 'SELECTED' ? <div {...fieldProps('programmes')} tabIndex={-1} className="max-h-48 space-y-2 overflow-auto border-t border-slate-100 pt-3">
                  {selectableProgrammes.map((programme) => <label key={programme} className="card-description flex items-center gap-2">
                    <input type="checkbox" checked={form.programmes.includes(programme)} onChange={(event) => updateForm((current) => ({ ...current, programmes: event.target.checked ? [...current.programmes, programme] : current.programmes.filter((value) => value !== programme) }))} />
                    {programme}
                  </label>)}
                  {!selectableProgrammes.length ? <p className="card-description">No programmes are available. Add programme data to student records first.</p> : null}
                  {form.programmes.length === 0 ? <p className="card-description">Choose at least one programme.</p> : null}
                  {fieldError('programmes')}
                </div> : null}
              </fieldset>
              <fieldset {...fieldProps('evaluatorRoles')} tabIndex={-1} disabled={!draftEditable} className="space-y-3 rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-700">Evaluator roles</legend>
                {(['SUPERVISOR', 'PANEL'] as const).map((role) => <label key={role} className="card-description flex items-center gap-2">
                  <input type="checkbox" checked={form.evaluatorRoles.includes(role)} onChange={(event) => updateForm((current) => ({ ...current, evaluatorRoles: event.target.checked ? [...current.evaluatorRoles, role] : current.evaluatorRoles.filter((value) => value !== role) }))} />
                  {role === 'SUPERVISOR' ? 'Supervisor' : 'Panel'}
                </label>)}
                <p className="card-description">Selected roles share this rubric.</p>
                {fieldError('evaluatorRoles')}
              </fieldset>
              </div>
              </section>
              <section aria-labelledby="period-schedule-heading" className="period-config-section"><h3 id="period-schedule-heading" className="section-label mb-2">Schedule</h3><p className="card-description mb-5">Malaysia time (UTC+08:00).</p><div className="period-config-dates">
                <label className="form-label block">
                  Opens at (Malaysia, UTC+08:00)
                  <input
                    required
                    {...fieldProps('opensAt')}
                    type="datetime-local"
                    disabled={!draftEditable}
                    value={form.opensAt}
                    onChange={(event) => updateForm((current) => ({ ...current, opensAt: event.target.value }))}
                    className="form-control form-control-md mt-2 w-full disabled:bg-slate-100"
                  />
                  {fieldError('opensAt')}
                </label>
                <MarksPeriodDeadlineControls error={formFeedback?.fields.closesAt} value={form.closesAt} editable={draftEditable} onChange={value=>updateForm(current=>({...current,closesAt:value}))} onManageTimeline={onManageTimeline?()=>onManageTimeline(selected??undefined):undefined}/>
              </div>

              </section>

              {selected?.lifecycleStatus === 'DRAFT' && (hasUnsavedChanges || previewLoading || previewError) ? <div className="space-y-3">
                {hasUnsavedChanges ? <p role="status" className="card-value text-amber-800">Save your unsaved changes before reviewing recipients.</p> : null}
                {previewLoading ? <p role="status" className="card-description">Loading recipient preview…</p> : null}
                {previewError ? <ErrorState compact title="Couldn’t verify recipients" message={previewError} onRetry={() => void loadRecipientPreview()} /> : null}
              </div> : null}

              <FormFeedback id="marks-period-save-feedback" feedback={formFeedback} fields={PERIOD_FIELDS}/>
              {actionError?<AlertMessage type="error" title="Period wasn’t changed" message={actionError}/>:null}
              <div className="period-config-footer">
                <div>{selected?.lifecycleStatus === 'DRAFT' && preview && canPublish ? <PortalButton icon={Users} onClick={() => setPreviewOpen(true)}>Preview recipients</PortalButton> : null}</div>
                <div className="period-config-write-actions">
                {draftEditable ? (
                  <PortalButton
                    type="submit"
                    icon={Save}
                    variant="primary"
                    isLoading={saving}
                    disabled={!form.rubricId||conflictBlocked||savedReadBlocked}
                  >
                    {selected ? 'Save changes' : 'Create draft'}
                  </PortalButton>
                ) : null}
                {selected?.lifecycleStatus === 'DRAFT' ? (
                  <PortalButton
                    icon={CheckCircle2}
                    variant="success"
                    isLoading={saving}
                    disabled={!canPublish}
                    onClick={() => openFinalReview('publish')}
                  >
                    Confirm and publish
                  </PortalButton>
                ) : null}
                {published && selected && onManageTimeline ? <PortalButton icon={CalendarClock} disabled={saving || selecting} onClick={() => leaveTo(() => onManageTimeline(selected))}>Manage periods &amp; deadlines</PortalButton> : null}
                {published ? <PortalButton variant="danger" icon={XCircle} disabled={saving || selecting || conflictBlocked || savedReadBlocked || hasUnsavedChanges} onClick={() => { if (selected) { setReason(''); setAcknowledged(false); setClosureContext({periodId:selected.id,search:contextSearch}); } }}>Close period early</PortalButton> : null}
                {closed ? (
                  <PortalButton
                    icon={Archive}
                    variant="danger"
                    isLoading={saving}
                    disabled={conflictBlocked||savedReadBlocked}
                    onClick={() => { setReason(''); openFinalReview('archive'); }}
                  >
                    Archive
                  </PortalButton>
                ) : null}
                </div>
              </div>
              </fieldset>
            </form>

          </PortalCard>
          {selected?.auditEvents?.length ? <PortalCard padding="lg" className="period-config-history rounded-2xl">
            <details>
              <summary className="cursor-pointer"><span className="inline-flex items-center gap-3 align-middle"><History size={18} aria-hidden="true" className="text-blue-600" /><span className="section-label">Configuration history</span><span className="card-description">{selected.auditEvents.length} {selected.auditEvents.length === 1 ? 'change' : 'changes'}</span></span></summary>
              <ol className="period-config-history-list">
                {[...selected.auditEvents].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(event => <li key={event.id} className="period-config-history-entry">
                  <div className="period-config-history-heading">
                    <p className="card-value">{({CREATE: 'Period created', UPDATE: 'Configuration updated', PUBLISH: 'Period published', CLOSE: 'Period closed', ARCHIVE: 'Period archived', EXTEND: 'Deadline extended'} as Record<string, string>)[event.action] || event.action.replaceAll('_', ' ').toLowerCase().replace(/^./, letter => letter.toUpperCase())}</p>
                    <time dateTime={event.createdAt} className="card-description">{displayDateTime(event.createdAt)}</time>
                  </div>
                  <p className="card-description mt-1">{event.actorName || 'System'}</p>
                  {event.reason ? <p className="period-config-history-reason">{event.reason}</p> : null}
                </li>)}
              </ol>
            </details>
          </PortalCard> : null}
          </div>
          )}
        </div>
      )}

    </div>
  );
};

export const MarkEntryPeriodConfig: React.FC<MarkEntryPeriodConfigProps> = props =>
  <DecisionFeedbackProvider scopeKey="marks-period-configuration"><MarkEntryPeriodContent {...props}/></DecisionFeedbackProvider>;
