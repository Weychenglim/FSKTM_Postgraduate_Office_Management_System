import { RecordPage } from './RecordPage';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Search, Send, CheckCircle, FileText, Check, Save, ChevronDown, Clock3, RotateCcw, Trash2, X } from 'lucide-react';
import { StudentSupervisorApplication, SupervisorCandidate, SupervisorDocumentRequirement } from '../types';
import {
  createSupervisorApplication,
  getActiveSupervisorDocumentRequirements,
  getSupervisorDocumentSetup,
  getSupervisorCandidates,
  toStudentSupervisorApplication,
} from '../services';
import {
  buildSupervisorApplicationFormData,
  formatSupervisorDocumentSize,
  SUPERVISOR_DOCUMENT_MAX_TOTAL_BYTES,
  validateSupervisorDocumentFile,
  validateSupervisorDocumentSelection,
} from '../utils/supervisorDocuments';
import { ApiError, fieldErrors } from '../services/apiClient';
import { CandidateCapacity } from './CandidateCapacity';
import { appointmentDetailTypography as typography } from './AppointmentPrimitives';
import { PortalButton, PortalToast, PortalConfirmModal, StatusBadge } from './PortalPrimitives';
import { ErrorState, LoadingState } from './StateViews';
import { OperationalIntakeFeedback, useOperationalIntake } from './OperationalIntakeFeedback';
import { getSupervisorApplicationPrefill } from '../services/supervisorSectionAApi';
import type { SupervisorApplicationPrefill, SupervisorCourseResult, SupervisorTitleOrigin } from '../types/supervisorSectionA';
import { buildSupervisorSectionAInput, validateSupervisorSectionA } from '../utils/supervisorSectionA';
import { SupervisorApplicationContactEditor } from './SupervisorApplicationContactEditor';
import { useDecisionFeedback } from './DecisionFeedback';
import { serializeProjectCourseCodes, validateProjectCourseCodes } from '../utils/projectCourseCodes';
import { ApplicationRequiredMark, ApplicationFieldError, CoursesTakenSection, ProjectCourseCodeEntries, ResearchTitleOriginFields, SupervisorApplicationReviewSection, SupervisorStudentParticulars } from './SupervisorSectionAFormSections';
import type { SupervisorApplicationDraftInput, SupervisorApplicationDraftResponse, SupervisorApplicationStep } from '../types/supervisorResearchIntent';
import { RESEARCH_INTENT_FIELDS, emptySupervisorResearchIntent, cleanSupervisorResearchIntent, validateSupervisorResearchIntent, supervisorApplicationDraftFingerprint as draftFingerprint } from '../utils/supervisorResearchIntent';
import { getSupervisorApplicationDraft, saveSupervisorApplicationDraft, deleteSupervisorApplicationDraft } from '../services/supervisorResearchIntentApi';
import { SupervisorResearchIntentEditor, SupervisorResearchIntentText } from './SupervisorResearchIntent';
import { formatMalaysiaDateTime } from '../utils/malaysiaDateTime';

const applicationSteps = ['Your details', 'Research intent', 'Supervisor and documents', 'Review and submit'] as const;
const targetStep = (target: string): SupervisorApplicationStep => ['student-particulars', 'courses-taken'].includes(target) ? 1 : ['project-details', 'research-intent-fields'].includes(target) ? 2 : ['supervisor-selection', 'supporting-documents'].includes(target) ? 3 : 4;

export function SupervisorCandidateOption({ candidate, selected, onToggle, busy = false }: {
  candidate: SupervisorCandidate; selected: boolean; onToggle: () => void; busy?: boolean;
}) {
  const selectable = candidate.selectable ?? candidate.filled < candidate.total;
  return <button type="button" aria-pressed={selected} onClick={onToggle} disabled={busy || !selectable}
    className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${selected ? 'border-indigo-500 bg-indigo-50' : selectable ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">{candidate.initials}</span>
      <span className="min-w-0"><span className={`${typography.name} block break-words`}>{candidate.name}</span><span className={`${typography.body} mt-1 block break-words`}>{candidate.domain}</span></span>
    </span>
    <span className="flex flex-wrap items-center gap-2">
      {selected ? <span className="card-value flex items-center gap-1.5 text-indigo-700"><CheckCircle aria-hidden="true" className="h-4 w-4" />Selected</span> : null}
      <CandidateCapacity role="Supervisor" {...candidate} selectable={selectable} limit={candidate.total} load={candidate.workloadCount ?? candidate.filled + (candidate.reservedLoad ?? 0)}/>
    </span>
  </button>;
}

export function SupervisorSelectionSummary({ candidate, onClear, busy = false }: {
  candidate: SupervisorCandidate | null; onClear: () => void; busy?: boolean;
}) {
  const activeLoad = candidate ? candidate.activeLoad ?? candidate.filled : 0;
  return <aside aria-label="Selected supervisor" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h4 className="card-label">Selected supervisor</h4>
    {candidate ? <>
      <div className="mt-3 space-y-2">
        <p className={`${typography.name} break-words`}>{candidate.name}</p>
        <p className="card-description">{candidate.domain}</p>
      </div>
      <div className="mt-4 space-y-1">
        <p className="card-description">{activeLoad === 0 ? 'No active supervisees' : `${activeLoad} active ${activeLoad === 1 ? 'supervisee' : 'supervisees'}`}</p>
        {(candidate.reservedLoad ?? 0) > 0 ? <p className="card-description">{`${candidate.reservedLoad} ${candidate.reservedLoad === 1 ? 'place held' : 'places held'} pending approval`}</p> : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <CandidateCapacity role="Supervisor" {...candidate} limit={candidate.total} load={candidate.workloadCount ?? candidate.filled + (candidate.reservedLoad ?? 0)}/>
        <PortalButton size="sm" variant="secondary" icon={X} disabled={busy} onClick={onClear}>Clear selection</PortalButton>
      </div>
    </> : <p className="card-description mt-3">No supervisor selected.</p>}
  </aside>;
}

interface SupervisorAppointmentApplicationPageProps {
  onBack: () => void;
  onSuccess: (newApplication: StudentSupervisorApplication) => void;
}

export const SupervisorAppointmentApplicationPage: React.FC<SupervisorAppointmentApplicationPageProps> = ({
  onBack,
  onSuccess,
}) => {
  const intake = useOperationalIntake('SUPERVISOR_APPLICATION');
  // Form Fields
  const [researchTitle, setResearchTitle] = useState('');
  const [step, setStep] = useState<SupervisorApplicationStep>(1);
  const pendingStepNavigation = useRef(false);
  useLayoutEffect(() => {
    if (!pendingStepNavigation.current) return;
    pendingStepNavigation.current = false;
    const heading = document.getElementById('application-step-title');
    heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
    heading?.focus({ preventScroll: true });
  }, [step]);
  const [researchIntent, setResearchIntent] = useState(emptySupervisorResearchIntent);
  const [intentError, setIntentError] = useState<ReturnType<typeof validateSupervisorResearchIntent>>(null);
  const [savedDraft, setSavedDraft] = useState<SupervisorApplicationDraftResponse | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftMessage, setDraftMessage] = useState<{ text: string; inDetails?: boolean } | null>(null);
  const [confirmDraftAction, setConfirmDraftAction] = useState<'resume' | 'discard' | null>(null);
  const [courseResetKey, setCourseResetKey] = useState(0);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const draftDetails = useRef<HTMLDetailsElement>(null);
  const draftRequest = useRef(0);
  const draftInFlight = useRef(false);
  useEffect(() => {
    const closeDraftDetails = (event: PointerEvent) => {
      if (draftDetails.current?.open && !draftDetails.current.contains(event.target as Node)) draftDetails.current.open = false;
    };
    document.addEventListener('pointerdown', closeDraftDetails);
    return () => document.removeEventListener('pointerdown', closeDraftDetails);
  }, []);
  const [projectCodeEntries, setProjectCodeEntries] = useState(['']);
  const projectCourseCodes = serializeProjectCourseCodes(projectCodeEntries);
  const [editingContact, setEditingContact] = useState(false);
  const [submissionError, setSubmissionError] = useState<{ target: string; field?: string; message: string } | null>(null);
  const [completedSteps, setCompletedSteps] = useState<SupervisorApplicationStep[]>([]);
  const [documentErrors, setDocumentErrors] = useState<Record<string, string>>({});
  const [researchArea, setResearchArea] = useState('');
  const [researchAbstract, setResearchAbstract] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [noDocumentsRequired, setNoDocumentsRequired] = useState(false);
  const [requirements, setRequirements] = useState<SupervisorDocumentRequirement[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Map<string, File>>(new Map());
  const [prefill, setPrefill] = useState<SupervisorApplicationPrefill | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(true);
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const [titleOrigin, setTitleOrigin] = useState<SupervisorTitleOrigin | ''>('');
  const [courseResults, setCourseResults] = useState<SupervisorCourseResult[]>([]);
  const [noCoursesTaken, setNoCoursesTaken] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const prefillRequest = useRef(0);
  const [requirementsLoading, setRequirementsLoading] = useState(true);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'info' | 'success' | 'warning' | 'danger'>('danger');
  const publishFeedback = useDecisionFeedback();
  const [toastEvent, setToastEvent] = useState(0);
  const clearToast = () => setToastMessage(null);

  const showToast = (message: string, tone: 'info' | 'success' | 'warning' | 'danger' = 'danger') => {
    if (publishFeedback) { publishFeedback(message, tone); return; }
    setToastMessage(message);
    setToastTone(tone);
    setToastEvent(value => value + 1);
  };

  const [supervisors, setSupervisors] = useState<SupervisorCandidate[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(true);
  const [supervisorsError, setSupervisorsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlight = useRef(false);
  const navigationComplete = useRef(false);
  const busy = submitting || draftBusy;
  const currentDraft: SupervisorApplicationDraftInput = { version: 1, step, researchTitle, projectCodeEntries, researchArea, researchAbstract, titleOrigin, courseResults, noCoursesTaken, proposedSupervisorId: selectedSupervisorId, researchIntent };
  const fingerprint = draftFingerprint(currentDraft);
  const initialFingerprint = useRef(fingerprint);
  const textDirty = fingerprint !== (savedFingerprint ?? initialFingerprint.current);
  const dirty = textDirty || selectedFiles.size > 0 || declarationAccepted;

  const goToStep = (next: SupervisorApplicationStep) => {
    if (submitInFlight.current || draftInFlight.current) return;
    pendingStepNavigation.current = true;
    setStep(next);
    setSubmissionError(null);
  };

  const loadDraft = useCallback(() => {
    const requestId = ++draftRequest.current;
    setDraftLoading(true); setDraftError(null);
    getSupervisorApplicationDraft().then(result => {
      if (requestId === draftRequest.current) setSavedDraft(result);
    }).catch(reason => {
      if (requestId === draftRequest.current) setDraftError(reason instanceof Error ? reason.message : 'Your saved draft could not be loaded.');
    }).finally(() => { if (requestId === draftRequest.current) setDraftLoading(false); });
  }, []);
  useEffect(() => { loadDraft(); return () => { draftRequest.current += 1; }; }, [loadDraft]);

  const saveDraft = async () => {
    if (draftInFlight.current || submitInFlight.current || draftLoading || draftError || editingContact) return;
    if (draftDetails.current) draftDetails.current.open = false;
    draftInFlight.current = true; setDraftBusy(true); setDraftMessage(null);
    const snapshot = currentDraft;
    const snapshotFingerprint = fingerprint;
    try {
      const response = await saveSupervisorApplicationDraft(snapshot);
      setSavedDraft(response); setSavedFingerprint(snapshotFingerprint);
      showToast('Draft saved.', 'success');
    } catch (reason) {
      setDraftMessage({ text: reason instanceof Error ? `Draft save could not be confirmed: ${reason.message}` : 'Draft save could not be confirmed. Your writing is still here; try again.' });
    } finally { draftInFlight.current = false; setDraftBusy(false); }
  };

  // A confirmation applies to the reviewed draft; editing it requires a fresh acknowledgement.
  useEffect(() => {
    setDeclarationAccepted(false);
  }, [researchTitle, projectCourseCodes, researchArea, researchAbstract, researchIntent, titleOrigin, courseResults, noCoursesTaken, selectedSupervisorId, selectedFiles, prefill?.studentParticulars]);

  const loadPrefill = useCallback(() => {
    const requestId = ++prefillRequest.current;
    setPrefillLoading(true);
    setPrefillError(null);
    setPrefill(null);
    setDeclarationAccepted(false);
    getSupervisorApplicationPrefill()
      .then(result => { if (requestId === prefillRequest.current) setPrefill(result); })
      .catch(reason => {
        if (requestId === prefillRequest.current) setPrefillError(reason instanceof Error ? reason.message : 'Student particulars could not be loaded.');
      })
      .finally(() => { if (requestId === prefillRequest.current) setPrefillLoading(false); });
  }, []);

  useEffect(() => {
    loadPrefill();
    return () => { prefillRequest.current += 1; };
  }, [loadPrefill]);

  const supervisorRequest = useRef(0);
  const loadSupervisors = useCallback(() => {
    const requestId = ++supervisorRequest.current;
    setLoadingSupervisors(true);
    setSupervisorsError(null);
    getSupervisorCandidates()
      .then(result => { if (requestId === supervisorRequest.current) setSupervisors(result); })
      .catch((reason) => {
        if (requestId !== supervisorRequest.current) return;
        setSupervisorsError(
          reason instanceof Error
            ? reason.message
            : 'Failed to load supervisor candidates.',
        );
      })
      .finally(() => { if (requestId === supervisorRequest.current) setLoadingSupervisors(false); });
  }, []);

  useEffect(() => {
    loadSupervisors();
    return () => { supervisorRequest.current += 1; };
  }, [loadSupervisors]);

  const requirementsRequest = useRef(0);
  const loadRequirements = useCallback(() => {
    const requestId = ++requirementsRequest.current;
    setRequirementsLoading(true);
    setRequirementsError(null);
    Promise.all([getActiveSupervisorDocumentRequirements(), getSupervisorDocumentSetup()])
      .then(([result, setup]) => { if (requestId === requirementsRequest.current) { setRequirements(result); setNoDocumentsRequired(setup.noDocumentsRequired); } })
      .catch((reason) => { if (requestId === requirementsRequest.current) setRequirementsError(
        reason instanceof Error ? reason.message : 'Document requirements could not be loaded.',
      ); })
      .finally(() => { if (requestId === requirementsRequest.current) setRequirementsLoading(false); });
  }, []);

  useEffect(() => { loadRequirements(); return () => { requirementsRequest.current += 1; }; }, [loadRequirements]);

  const resumeDraft = (automatic = false) => {
    if (draftDetails.current) draftDetails.current.open = false;
    const draft = savedDraft?.draft;
    if (!draft || draftInFlight.current || submitInFlight.current || editingContact) return;
    setResearchTitle(draft.researchTitle); setProjectCodeEntries(draft.projectCodeEntries.length ? draft.projectCodeEntries : ['']);
    setResearchArea(draft.researchArea); setResearchAbstract(draft.researchAbstract); setTitleOrigin(draft.titleOrigin);
    setCourseResults(draft.courseResults); setNoCoursesTaken(draft.noCoursesTaken); setCourseResetKey(value => value + 1);
    setSelectedSupervisorId(draft.proposedSupervisorId); setResearchIntent(draft.researchIntent);
    setSelectedFiles(new Map()); setDocumentErrors({}); setDeclarationAccepted(false); setIntentError(null);
    // Saved progress cannot bypass incomplete answers or a fresh document/availability check.
    const resumeStep = ([1, 2] as const).find(previous => previous < draft.step && !validateStep(previous, draft, true))
      ?? (Math.min(draft.step, 3) as SupervisorApplicationStep);
    setCompletedSteps(([1, 2] as const).filter(previous => previous < resumeStep && validateStep(previous, draft, true)));
    setSavedFingerprint(draftFingerprint({ ...draft, projectCodeEntries: draft.projectCodeEntries.length ? draft.projectCodeEntries : [''] }));
    setConfirmDraftAction(null); setDraftMessage({ text: `${automatic ? 'Draft restored.' : 'Draft resumed.'} Reselect any files and review your supervisor before submitting.`, inDetails: true });
    if (automatic) {
      // Keep the page heading and progress visible on opening.
      setStep(resumeStep); setSubmissionError(null);
    } else {
      goToStep(resumeStep); loadSupervisors(); loadRequirements();
    }
  };
  const discardSavedDraft = async () => {
    if (draftDetails.current) draftDetails.current.open = false;
    if (draftInFlight.current || submitInFlight.current) return;
    draftInFlight.current = true; setDraftBusy(true); setDraftMessage(null);
    try {
      await deleteSupervisorApplicationDraft();
      setSavedDraft({ draft: null, updatedAt: null }); setSavedFingerprint(null);
      setDraftMessage({ text: 'Saved draft discarded. Any writing on this page is still here.' }); setConfirmDraftAction(null);
    } catch (reason) {
      setDraftMessage({ text: reason instanceof Error ? `Saved draft could not be discarded: ${reason.message}` : 'Saved draft could not be discarded. Try again.' });
      setConfirmDraftAction(null);
    } finally { draftInFlight.current = false; setDraftBusy(false); }
  };

  // Filtering based on search query
  const filteredSupervisors = supervisors.filter(sv => 
    sv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sv.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const reportError = (message: string, target: string, field?: string) => {
    setStep(targetStep(target));
    setSubmissionError({ message, target, field });
    requestAnimationFrame(() => {
      const section = document.getElementById(target);
      const control = field ? document.getElementById(field) : null;
      (control ?? section)?.scrollIntoView({ block: 'center', behavior: 'instant' });
      (control ?? section?.querySelector<HTMLElement>('h3') ?? section)?.focus({ preventScroll: true });
    });
  };
  const sectionError = (target: string) => submissionError?.target === target && !submissionError.field
    ? <p id={`${target}-error`} role="alert" className="text-xs text-rose-700">{submissionError.message}</p> : null;
  const errorFor = (field: string) => submissionError?.field === field ? submissionError.message : undefined;
  const clearSectionError = (target: string) => setSubmissionError(current => current?.target === target ? null : current);
  const clearChangedFieldError = (event: React.FormEvent<HTMLFormElement>) => {
    const input = event.target as HTMLInputElement;
    const id = input.id;
    setSubmissionError(current => {
      if (!current?.field) return current;
      const sameGroup = (prefix: string) => current.field!.startsWith(prefix) && id.startsWith(prefix);
      return current.field === id || sameGroup('completed-courses-') || sameGroup('research-title-origin-') || sameGroup('project-course-code') ? null : current;
    });
    setIntentError(current => current?.field && id === `research-intent-${current.field}` ? null : current);
    setDraftMessage(null);
  };

  const setRequirementFile = (code: string, file: File | null) => {
    if (!draftInitialized || submitInFlight.current || draftInFlight.current) return;
    if (file) {
      const fileError = validateSupervisorDocumentFile(file);
      if (fileError) {
        setDocumentErrors(current => ({ ...current, [code]: fileError }));
        return;
      }
      const prospectiveFiles = new Map(selectedFiles);
      prospectiveFiles.set(code, file);
      const totalBytes = [...prospectiveFiles.values()].reduce((total, item) => total + item.size, 0);
      if (totalBytes > SUPERVISOR_DOCUMENT_MAX_TOTAL_BYTES) {
        setDocumentErrors(current => ({ ...current, [code]: 'Documents must not exceed 10 MB combined.' }));
        return;
      }
    }
    setDocumentErrors(current => { const next = { ...current }; delete next[code]; return next; });
    setSubmissionError(current => current?.field === `supervisor-document-${code}` ? null : current);
    setSelectedFiles((current) => {
      const next = new Map(current);
      if (file) next.set(code, file);
      else next.delete(code);
      return next;
    });
  };

  const validateStep = (checkedStep: SupervisorApplicationStep, draft: SupervisorApplicationDraftInput = currentDraft, silent = false): boolean => {
    const { noCoursesTaken, courseResults, projectCodeEntries, researchArea, researchTitle, titleOrigin, researchIntent, researchAbstract, proposedSupervisorId: selectedSupervisorId } = draft;
    const invalid = (message: string, target: string, field?: string) => { if (!silent) reportError(message, target, field); return false; };
    if (checkedStep === 1) {
      if (editingContact) return invalid('Save or cancel your contact changes before continuing.', 'student-particulars', 'application-phone');
      if (prefillLoading || prefillError || !prefill || !prefill.declarationText.trim()) return invalid('Load your student particulars and declaration before continuing.', 'student-particulars');
      // Check only course rules here; title source, uploads and declaration belong to later steps.
      const coursesError = validateSupervisorSectionA({ titleOrigin: 'SUPERVISOR', noCoursesTaken, courseResults, declarationAccepted: true });
      if (coursesError) {
        const field = courseResults.findIndex(row => Object.values(row).some(value => !value.trim()));
        const missing = field >= 0 ? Object.entries(courseResults[field]).find(([, value]) => !value.trim())?.[0] : null;
        return invalid(coursesError, 'courses-taken', field >= 0 && missing ? `course-${field}-${missing}` : !courseResults.length && !noCoursesTaken ? 'completed-courses-yes' : undefined);
      }
    }
    if (checkedStep === 2) {
      const codesError = validateProjectCourseCodes(projectCodeEntries);
      if (codesError) return invalid(codesError, 'project-details', 'project-course-codes-input');
      if (!researchArea.trim() || researchArea.trim().length > 255) return invalid('Provide your research area (up to 255 characters).', 'project-details', 'research-area-input');
      if (!researchTitle.trim() || researchTitle.trim().length > 500) return invalid('Provide your proposed research title (up to 500 characters).', 'project-details', 'research-title-input');
      if (!titleOrigin) return invalid('Choose who proposed the research title.', 'project-details', 'research-title-origin-STUDENT');
      const error = validateSupervisorResearchIntent(researchIntent); if (!silent) setIntentError(error);
      if (error) return invalid(error.message, 'research-intent-fields', error.field ? `research-intent-${error.field}` : undefined);
      if (!researchAbstract.trim() || researchAbstract.trim().length > 10000) return invalid('Provide a short research abstract (up to 10,000 characters).', 'project-details', 'research-abstract-input');
    }
    if (checkedStep === 3) {
      if (requirementsLoading || requirementsError || loadingSupervisors || supervisorsError) return invalid('Load current supervisor candidates and document requirements before continuing.', loadingSupervisors || supervisorsError ? 'supervisor-selection' : 'supporting-documents');
      const candidate = supervisors.find(item => item.id === selectedSupervisorId);
      if (!candidate || !(candidate.selectable ?? candidate.filled < candidate.total)) return invalid('Choose a currently available research supervisor. Your saved selection may no longer be available.', 'supervisor-selection');
      const documentError = validateSupervisorDocumentSelection(requirements, selectedFiles, noDocumentsRequired);
      if (documentError) return invalid(documentError, 'supporting-documents', requirements.find(item => item.isRequired && !selectedFiles.has(item.code)) ? `supervisor-document-${requirements.find(item => item.isRequired && !selectedFiles.has(item.code))!.code}` : undefined);
    }
    if (checkedStep === 4 && !declarationAccepted) return invalid('Accept the declaration after reviewing your application.', 'review-declaration', 'supervisor-declaration');
    return true;
  };

  // Initialize once per opening. After a failed load, retries must leave new writing
  // alone; the existing explicit restore action still protects replacement with confirmation.
  useEffect(() => {
    if (draftInitialized || draftLoading) return;
    if (!draftError && savedDraft?.draft && prefillLoading) return;
    setDraftInitialized(true);
    if (!draftError && savedDraft?.draft && !dirty && !editingContact) resumeDraft(true);
  }, [draftInitialized, draftLoading, draftError, savedDraft, prefillLoading, dirty, editingContact, resumeDraft]);

  const continueStep = () => {
    if (draftInitialized && !busy && validateStep(step) && step < 4) {
      setCompletedSteps(current => current.includes(step) ? current : [...current, step]);
      goToStep((step + 1) as SupervisorApplicationStep);
    }
  };
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftInitialized) return;
    // Enter in earlier steps advances only; only the explicit final step can create an application.
    if (step !== 4) { continueStep(); return; }
    if (submitInFlight.current || draftInFlight.current || intake.loading || intake.blocked) return;
    for (const checkedStep of [1, 2, 3, 4] as const) if (!validateStep(checkedStep)) return;
    submitInFlight.current = true;
    setSubmitting(true);
    try {
      // Recheck the selected candidate immediately before submission; the server revalidates capacity atomically.
      const latest = await getSupervisorCandidates();
      supervisorRequest.current += 1; setSupervisors(latest);
      const candidate = latest.find(item => item.id === selectedSupervisorId);
      if (!candidate || !(candidate.selectable ?? candidate.filled < candidate.total)) {
        reportError('Your selected supervisor is no longer available. Choose a currently available supervisor.', 'supervisor-selection');
        return;
      }
      const body = buildSupervisorApplicationFormData({
        proposedSupervisorId: selectedSupervisorId!,
        researchTitle: researchTitle.trim(),
        projectCourseCodes: projectCourseCodes.trim(),
        researchArea: researchArea.trim(),
        researchAbstract: researchAbstract.trim(),
        sectionA: buildSupervisorSectionAInput({ titleOrigin, noCoursesTaken, courseResults, declarationAccepted }),
        researchIntent: cleanSupervisorResearchIntent(researchIntent),
      }, selectedFiles);
      const record = await createSupervisorApplication(body);
      // A late initial GET must not reintroduce the draft the server just deleted atomically.
      draftRequest.current += 1;
      setSavedDraft({ draft: null, updatedAt: null }); setDraftLoading(false);
      showToast('Supervisor application submitted successfully!', 'success');
      navigationComplete.current = true;
      onSuccess(toStudentSupervisorApplication(record));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Supervisor application could not be submitted.';
      const errors = fieldErrors(reason);
      // DRF reports strict intent field errors as nested objects; do not lose their destination.
      const responseBody = reason instanceof ApiError && reason.body && typeof reason.body === 'object' && !Array.isArray(reason.body) ? reason.body as Record<string, unknown> : null;
      if (responseBody && 'researchIntent' in responseBody) {
        const nested = responseBody.researchIntent;
        const field = nested && typeof nested === 'object' && !Array.isArray(nested) ? RESEARCH_INTENT_FIELDS.find(item => item.key in nested) : null;
        setIntentError({ field: field?.key, message });
        reportError(message, 'research-intent-fields', field ? `research-intent-${field.key}` : undefined);
        return;
      }
      if (responseBody && 'sectionA' in responseBody) {
        const target = /course/i.test(message) ? 'courses-taken' : /proposal|upload/i.test(message) ? 'supporting-documents' : /origin|title/i.test(message) ? 'project-details' : 'review-declaration';
        reportError(message, target); return;
      }
      const target = errors.researchIntent ? 'research-intent-fields' : errors.researchTitle || errors.researchArea || errors.researchAbstract || errors.projectCourseCodes ? 'project-details' : errors.proposedSupervisorId ? 'supervisor-selection' : errors.documents || errors.requirementCodes ? 'supporting-documents' : errors.sectionA ? 'review-declaration' : 'submission-feedback';
      const field = errors.researchTitle ? 'research-title-input' : errors.researchArea ? 'research-area-input' : errors.researchAbstract ? 'research-abstract-input' : errors.projectCourseCodes ? 'project-course-codes-input' : undefined;
      reportError(message, target, field);
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <RecordPage navigationComplete={navigationComplete} title="Supervisor Appointment Application" subtitle="Complete your details, research intent and supervisor selection in four steps." backLabel="Back to Applications" onBack={onBack} dirty={dirty} busy={busy}><form id="submission-supervisor-form" noValidate onChangeCapture={clearChangedFieldError} onSubmit={handleSubmitRequest} className="supervisor-application-form space-y-6 text-left font-sans pb-6">
      <PortalToast eventId={toastEvent} message={toastMessage} tone={toastTone} onClose={clearToast}
        durationMs={toastTone === 'info' || toastTone === 'success' ? 4000 : undefined} />
      <PortalConfirmModal isOpen={confirmDraftAction !== null} title={confirmDraftAction === 'resume' ? 'Resume saved draft?' : 'Discard saved draft?'}
        message={confirmDraftAction === 'resume' ? 'This replaces your current writing with the saved text and choices. Any selected files will be cleared and must be reselected. The declaration must be confirmed again.' : 'This deletes the saved server draft. Any writing currently on this page will remain.'}
        confirmLabel={confirmDraftAction === 'resume' ? 'Resume saved draft' : 'Discard saved draft'} cancelLabel="Keep editing" isLoading={draftBusy}
        onCancel={() => { if (!draftBusy) setConfirmDraftAction(null); }} onConfirm={() => { if (confirmDraftAction === 'resume') resumeDraft(); else void discardSavedDraft(); }} />
      <fieldset disabled={busy || !draftInitialized} aria-busy={!draftInitialized} className="min-w-0 space-y-6">
      {!intake.availability?.canSubmit ? <OperationalIntakeFeedback {...intake} onRetry={() => void intake.refresh()} /> : null}
      <p className="card-description"><span className="text-rose-600" aria-hidden="true">*</span> Required field</p>
      <nav aria-label="Application steps" className="py-2">
        <div className="space-y-3 sm:hidden">
          <p className="text-sm font-semibold text-brand-navy">Step {step} of 4 · {applicationSteps[step - 1]}</p>
          <div className="flex gap-1.5" aria-hidden="true">{applicationSteps.map((label, index) => <span key={label} className={`h-1.5 flex-1 rounded-full ${index + 1 <= step ? 'bg-brand-navy' : 'bg-slate-200'}`} />)}</div>
        </div>
        <ol aria-label="Application progress" className="hidden w-full sm:grid sm:grid-cols-[repeat(3,minmax(0,1fr))_2rem]">{applicationSteps.map((label, index) => {
          const number = (index + 1) as SupervisorApplicationStep;
          const current = step === number;
          const completed = completedSteps.includes(number);
          const labelClass = index === 3 ? 'w-max max-w-32 self-end text-right' : index > 0 ? 'relative left-4 w-max max-w-[calc(100%-1rem)] -translate-x-1/2 text-center' : '';
          const marker = <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${current ? 'border-brand-navy bg-brand-navy text-white ring-4 ring-slate-200/70' : completed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-400'}`}>{completed && !current ? <Check aria-hidden="true" className="h-4 w-4" /> : number}</span>;
          return <li key={label} aria-current={current ? 'step' : undefined} className="relative min-w-0">
            {index < 3 ? <span aria-hidden="true" className={`absolute left-10 right-2 top-4 h-px ${completed ? 'bg-emerald-200' : 'bg-slate-200'}`} /> : null}
            {completed && number < step ? <button type="button" disabled={busy || editingContact} onClick={() => goToStep(number)} className="relative flex w-full min-w-0 flex-col items-start gap-3 rounded text-left text-xs font-medium text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50">{marker}<span className={labelClass}>{label}<span className="sr-only">, completed</span></span></button> : <div className={`relative flex w-full min-w-0 flex-col items-start gap-3 text-xs ${current ? 'font-semibold text-brand-navy' : 'text-slate-500'}`}>{marker}<span className={labelClass}>{label}</span></div>}
          </li>;
        })}</ol>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="application-step-title" tabIndex={-1} className="scroll-mt-24 w-fit rounded text-lg font-semibold text-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500">{step}. {applicationSteps[step - 1]}</h2>
      <aside aria-label="Application draft" className="relative w-full min-w-0 max-w-full sm:ml-auto sm:w-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            <span role="status" className={`${!draftInitialized ? '' : 'hidden lg:block'} text-xs text-slate-500`}>{!draftInitialized ? 'Loading your application…' : draftLoading ? 'Checking saved draft…' : textDirty ? 'Unsaved changes' : savedFingerprint && savedDraft?.updatedAt ? null : savedDraft?.draft ? 'Saved draft available' : 'No saved draft'}</span>
            <details ref={draftDetails} className="text-xs text-slate-500" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">{savedDraft?.draft && !savedFingerprint ? 'Saved draft' : 'Draft details'} <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /></summary>
              <div className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-4rem))] space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-left leading-5 shadow-lg">
                <p>Your saved draft reopens automatically. Select Save draft to keep your latest changes.</p>
                <p>Files must be reattached before submitting.</p>
                {draftLoading || textDirty || !savedDraft?.draft ? <p role="status">{draftLoading ? 'Checking draft…' : textDirty ? 'Unsaved changes' : 'No saved draft.'}</p> : null}
                {savedDraft?.updatedAt ? <div className="flex items-start gap-2.5">
                  <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0"><p className="font-medium text-slate-500">Last saved</p><time dateTime={savedDraft.updatedAt} className="mt-1 block font-semibold text-slate-800">{formatMalaysiaDateTime(savedDraft.updatedAt)}</time></div>
                </div> : null}
                {!draftLoading && !draftError && savedDraft?.draft ? <div className="grid gap-2 border-t border-slate-100 pt-3">
                  <PortalButton size="sm" variant="primary" icon={RotateCcw} fullWidth disabled={busy || editingContact} onClick={() => { if (dirty) setConfirmDraftAction('resume'); else resumeDraft(); }}>Resume saved draft</PortalButton>
                  <PortalButton size="sm" variant="danger" icon={Trash2} fullWidth disabled={busy} onClick={() => setConfirmDraftAction('discard')}>Discard saved draft</PortalButton>
                </div> : null}
              </div>
            </details>
            <PortalButton icon={Save} disabled={busy || !draftInitialized || draftLoading || Boolean(draftError) || editingContact} onClick={() => void saveDraft()}>{draftBusy ? 'Saving…' : 'Save draft'}</PortalButton>
          </div>
        </div>
        {draftError ? <ErrorState message={draftError} onRetry={loadDraft} className="py-2" /> : null}
      </aside>
      </div>
      {draftMessage ? <p role="status" className={draftMessage.inDetails ? 'sr-only' : 'text-xs leading-5 text-slate-600'}>{draftMessage.text}</p> : null}

      <div data-application-step="1" hidden={step !== 1} inert={step !== 1 ? true : undefined} className="space-y-6">
      <section id="student-particulars" aria-labelledby="student-particulars-title" className="application-section scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5">
        <h3 id="student-particulars-title" tabIndex={-1} className={typography.heading}>Student particulars</h3>
        {sectionError('student-particulars')}
        {prefillLoading ? <LoadingState message="Loading student particulars..." /> : prefillError ? <ErrorState message={prefillError} onRetry={loadPrefill} /> : prefill ? <>
          <SupervisorStudentParticulars particulars={prefill.studentParticulars} correctionGuidance />
          <SupervisorApplicationContactEditor particulars={prefill.studentParticulars} disabled={submitting} onEditingChange={setEditingContact}
            onSaved={studentParticulars => { setPrefill(current => current ? { ...current, studentParticulars } : current); setDeclarationAccepted(false); }} />
          {!prefill.declarationText.trim() ? <ErrorState message="The student declaration is not configured. Contact the Postgraduate Office." onRetry={loadPrefill} /> : null}
        </> : null}
      </section>
      <CoursesTakenSection key={courseResetKey} rows={courseResults} noCoursesTaken={noCoursesTaken} onRowsChange={rows => { setCourseResults(rows); if (rows.length < courseResults.length) clearSectionError('courses-taken'); }} onNoCoursesTakenChange={value => { setNoCoursesTaken(value); if (value) clearSectionError('courses-taken'); }} disabled={busy} error={submissionError?.target === 'courses-taken' ? submissionError : null} />
      </div>

      <div data-application-step="2" hidden={step !== 2} inert={step !== 2 ? true : undefined} className="space-y-6">
        <section id="project-details" aria-labelledby="project-details-title" className="application-section scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5">
          <h3 id="project-details-title" tabIndex={-1} className={typography.heading}>Project details</h3>
          <ProjectCourseCodeEntries entries={projectCodeEntries} onChange={setProjectCodeEntries} disabled={busy} serverError={errorFor('project-course-codes-input')} />
          <div className="space-y-2">
            <label htmlFor="research-area-input" className="card-label block">Research area <ApplicationRequiredMark /></label>
            <input id="research-area-input" type="text" value={researchArea} onChange={event => setResearchArea(event.target.value)} placeholder="For example, Cyber Security" maxLength={255} required className="form-control form-control-md" aria-invalid={Boolean(errorFor('research-area-input'))} aria-describedby={errorFor('research-area-input') ? 'research-area-input-error' : undefined} />
            <ApplicationFieldError id="research-area-input-error" message={errorFor('research-area-input')} />
          </div>
          <div className="space-y-2">
            <label htmlFor="research-title-input" className="card-label block">Research title <ApplicationRequiredMark /></label>
            <input id="research-title-input" type="text" value={researchTitle} onChange={event => setResearchTitle(event.target.value)} placeholder="Enter the full working title of your research" maxLength={500} required className="form-control form-control-md" aria-invalid={Boolean(errorFor('research-title-input'))} aria-describedby={errorFor('research-title-input') ? 'research-title-input-error' : undefined} />
            <ApplicationFieldError id="research-title-input-error" message={errorFor('research-title-input')} />
          </div>
          <ResearchTitleOriginFields value={titleOrigin} onChange={setTitleOrigin} disabled={busy || prefillLoading || Boolean(prefillError)} error={errorFor('research-title-origin-STUDENT')} />
          {sectionError('project-details')}
        </section>
        <SupervisorResearchIntentEditor value={researchIntent} onChange={setResearchIntent} disabled={busy} error={intentError} />
        <section id="research-summary" aria-labelledby="research-summary-title" className="application-section scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5">
          <h3 id="research-summary-title" tabIndex={-1} className={typography.heading}>Research summary</h3>
          <div className="space-y-2">
            <label htmlFor="research-abstract-input" className="card-label block">Short research abstract <ApplicationRequiredMark /></label>
            <p id="research-abstract-help" className="card-description">Summarise the research plan you have written above, including its objectives, approach and expected outcomes.</p>
            <textarea id="research-abstract-input" rows={5} maxLength={10000} value={researchAbstract} onChange={event => setResearchAbstract(event.target.value)} placeholder="Give a brief overview of your research" required className="form-control form-control-md" aria-invalid={Boolean(errorFor('research-abstract-input'))} aria-describedby={`research-abstract-help${errorFor('research-abstract-input') ? ' research-abstract-input-error' : ''}`} />
            <ApplicationFieldError id="research-abstract-input-error" message={errorFor('research-abstract-input')} />
            <p className="text-right text-xs text-slate-500">{researchAbstract.trim() ? researchAbstract.trim().split(/\s+/).length : 0} words</p>
          </div>
        </section>
      </div>

      <div data-application-step="3" hidden={step !== 3} inert={step !== 3 ? true : undefined} className="space-y-6">
      <div id="supervisor-selection" className="scroll-mt-24 bg-white border border-[#e2e8f0]/80 application-section rounded-2xl p-5 sm:p-7 space-y-5 text-left">
        <h3 tabIndex={-1} className={typography.heading}>
          Supervisor selection
        </h3>
        <p className="card-description">Submitting a request does not reserve a place. A place is reserved when the Supervisor accepts, pending Coordinator approval.</p>

        <div role="group" aria-label="Choose a supervisor" aria-describedby={submissionError?.target === 'supervisor-selection' ? 'supervisor-selection-error' : undefined} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: Search filter + selection list (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <span className="card-label block">
              Choose a supervisor <ApplicationRequiredMark />
            </span>

            {/* Search filter input bar wrapper */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-navy transition-all" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or expertise..."
                className="form-control form-control-md !pl-10" aria-label="Search supervisors"
              />
            </div>

            {/* Render matched supervisors lists */}
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {loadingSupervisors ? (
                <LoadingState message="Loading eligible supervisors..." />
              ) : supervisorsError ? (
                <ErrorState
                  message={supervisorsError}
                  onRetry={loadSupervisors}
                />
              ) : filteredSupervisors.length > 0 ? (
                filteredSupervisors.map(sv => <SupervisorCandidateOption key={sv.id} candidate={sv} selected={selectedSupervisorId === sv.id} busy={submitting}
                  onToggle={() => { setSelectedSupervisorId(current => current === sv.id ? null : sv.id); clearSectionError('supervisor-selection'); }} />)
              ) : (
                <div className="card-description p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No matching supervisors found
                </div>
              )}
            </div>
          </div>

          {/* Right panel matching rule descriptor (5 cols) */}
          <div className="lg:col-span-5 h-full">
            <SupervisorSelectionSummary candidate={supervisors.find(sv => sv.id === selectedSupervisorId) ?? null} onClear={() => { setSelectedSupervisorId(null); clearSectionError('supervisor-selection'); }} busy={submitting} />
          </div>

        </div>
        {sectionError('supervisor-selection')}
      </div>

      <div id="supporting-documents" className="scroll-mt-24 bg-white border border-[#e2e8f0]/80 application-section rounded-2xl p-5 sm:p-7 space-y-5 text-left">
        <h3 tabIndex={-1} className={typography.heading}>
          Supporting documents
        </h3>

        {requirementsLoading ? (
          <LoadingState message="Loading document requirements..." />
        ) : requirementsError ? (
          <ErrorState message={requirementsError} onRetry={loadRequirements} />
        ) : noDocumentsRequired && requirements.length === 0 ? (
          <div className="space-y-3">
            <p className="card-description">No supporting documents required.</p>
            {selectedFiles.size > 0 && <PortalButton size="sm" onClick={() => setSelectedFiles(new Map())}>Clear selected files</PortalButton>}
          </div>
        ) : requirements.length === 0 ? (
          <div className="card-description rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            Document requirements are not configured. Contact the Postgraduate Office before submitting.
          </div>
        ) : (
          <div className="space-y-3">
            {requirements.map((requirement) => {
              const file = selectedFiles.get(requirement.code);
              return (
                <div
                  key={requirement.code}
                  data-requirement-dropzone={requirement.code}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    setRequirementFile(requirement.code, event.dataTransfer.files?.[0] ?? null);
                  }}
                  className="grid gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-4 transition-colors hover:border-blue-400 md:grid-cols-[1fr_220px] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="card-value text-slate-800">{requirement.label}{requirement.isRequired ? <> <ApplicationRequiredMark /></> : null}</p>
                      {!requirement.isRequired ? <StatusBadge tone="neutral">Optional</StatusBadge> : null}
                    </div>
                    <p className="card-description mt-1">
                      {requirement.description}
                    </p>
                    {file && (
                      <div className="card-value mt-3 flex items-center gap-2 text-emerald-700">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="max-w-xs truncate">{file.name}</span>
                        <span className="font-mono text-slate-400">{formatSupervisorDocumentSize(file.size)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-brand-navy hover:bg-slate-50 focus-within:ring-2 focus-within:ring-indigo-500">
                      {file ? 'Replace file' : 'Choose or drop file'}
                      <input
                        id={`supervisor-document-${requirement.code}`}
                        type="file"
                        accept=".pdf,.docx"
                        className="sr-only"
                        aria-label={`Upload ${requirement.label}`}
                        disabled={submitting}
                        aria-invalid={Boolean(documentErrors[requirement.code] || errorFor(`supervisor-document-${requirement.code}`))}
                        aria-describedby={documentErrors[requirement.code] || errorFor(`supervisor-document-${requirement.code}`) ? `upload-error-${requirement.code}` : undefined}
                        onChange={(event) => {
                          setRequirementFile(requirement.code, event.target.files?.[0] ?? null);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {file && (
                      <PortalButton type="button" variant="ghost" size="sm" onClick={() => setRequirementFile(requirement.code, null)}>
                        Remove
                      </PortalButton>
                    )}
                  </div>
                  {documentErrors[requirement.code] || errorFor(`supervisor-document-${requirement.code}`) ? <div className="md:col-span-2"><ApplicationFieldError id={`upload-error-${requirement.code}`} message={documentErrors[requirement.code] || errorFor(`supervisor-document-${requirement.code}`)} /></div> : null}
                </div>
              );
            })}
            <div className="card-caption flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-slate-400">
              <span>PDF or DOCX; one file per requirement; 10 MB combined</span>
              <span>
                {requirements.filter((item) => item.isRequired && selectedFiles.has(item.code)).length}
                {' / '}
                {requirements.filter((item) => item.isRequired).length} required complete;{' '}
                {formatSupervisorDocumentSize([...selectedFiles.values()].reduce((total, item) => total + item.size, 0))} selected
              </span>
            </div>
          </div>
        )}
        {sectionError('supporting-documents')}
      </div>
      </div>

      <div data-application-step="4" hidden={step !== 4} inert={step !== 4 ? true : undefined} className="space-y-6">
      <section aria-labelledby="review-intent-title" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5">
        <h3 id="review-intent-title" className={typography.heading}>Review your Research Intent</h3>
        <SupervisorResearchIntentText record={researchIntent} />
        <PortalButton aria-label="Edit Research Intent" onClick={() => goToStep(2)}>Edit Research Intent</PortalButton>
      </section>
      <SupervisorApplicationReviewSection researchTitle={researchTitle} projectCourseCodes={projectCourseCodes} researchArea={researchArea} researchAbstract={researchAbstract}
        supervisorName={supervisors.find(candidate => candidate.id === selectedSupervisorId)?.name ?? ''} titleOrigin={titleOrigin}
        rows={courseResults} noCoursesTaken={noCoursesTaken} filenames={[...selectedFiles.values()].map(file => file.name)} noDocumentsRequired={noDocumentsRequired}
        particulars={prefill?.studentParticulars} declarationError={submissionError?.target === 'review-declaration' ? submissionError.message : undefined} onEdit={target => { if (busy) return; goToStep(targetStep(target)); requestAnimationFrame(() => { const section = document.getElementById(target); section?.scrollIntoView({ block: 'start', behavior: 'instant' }); section?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true }); }); }}
        declarationText={prefill?.declarationText ?? ''} declarationAccepted={declarationAccepted} onDeclarationAcceptedChange={setDeclarationAccepted} disabled={busy || prefillLoading || Boolean(prefillError)} />
      </div>

      <div id="submission-feedback" tabIndex={-1}>{sectionError('submission-feedback')}</div>
      <div id="application-navigation" className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
        {step > 1 ? <PortalButton disabled={busy} onClick={() => goToStep((step - 1) as SupervisorApplicationStep)}>Back</PortalButton> : <span />}
        <div className="ml-auto flex gap-2.5">
          {step < 4 ? <PortalButton key="continue" type="button" disabled={busy || editingContact} variant="primary" size="lg" className="flex-1 sm:flex-initial" onClick={event => { event.preventDefault(); continueStep(); }}>Continue</PortalButton> : <PortalButton
            key="submit"
            type="submit"
            disabled={busy || intake.loading || intake.blocked}
            variant="primary"
            size="lg"
            icon={Send}
            className="flex-1 sm:flex-initial"
          >
            {submitting ? 'Submitting…' : 'Submit application'}
          </PortalButton>}
        </div>
      </div>

      </fieldset>

    </form></RecordPage>
  );
};
