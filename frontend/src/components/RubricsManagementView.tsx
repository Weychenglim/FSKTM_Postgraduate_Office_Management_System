import {PortalSelect} from './PortalSelect';
import {RubricFamilyList, RubricVersionHistory} from './RubricFamilyList';
import { MarksHeading } from './MarksPrimitives';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {flushSync} from 'react-dom';
import {
  Archive,
  RotateCcw,
  CheckCircle2,
  Copy,
  Edit3,
  Layers3,
  Plus,
  Save,
  XCircle,
  X,
} from 'lucide-react';

import {
  cloneRubricVersion,
  setRubricFamilyArchived,
  createRubricComponent,
  createRubricVersion,
  getRubricVersion,
  getRubricVersions,
  updateRubricComponent,
  updateRubricVersion,
} from '../services';
import type { RubricComponent, RubricVersion } from '../types';
import {AlertMessage} from './AlertMessage';
import {FieldError, FormFeedback} from './FormFeedback';
import {clearFeedbackFields, focusFeedback, readFormFeedback, type FormFeedbackState} from '../utils/formFeedback';
import { marksMutationErrorMessage } from '../utils/marksProductionManagement';
import {
  PageHeader,
  PortalButton,
  PortalCard,
  StatusBadge,
} from './PortalPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import {DraftNavigationGuard} from './DraftNavigationGuard';
import {DecisionFeedbackProvider, useDecisionFeedback} from './DecisionFeedback';
import {DecisionDialog} from './DecisionDialog';
import {PortalModal, useModalTitle} from './PortalModal';
import {PortalConfirmModal} from './PortalPrimitives';
import {decisionFailure} from '../utils/decisionSubmission';

interface RubricsManagementViewProps {
  onBack: () => void;
}

type RubricForm = {
  allowedEvaluatorRoles: Array<'SUPERVISOR' | 'PANEL'>;
  familyCode: string;
  name: string;
  description: string;
  targetMark: string;
};

type ComponentForm = {
  id: number | null;
  code: string;
  name: string;
  description: string;
  maxMarks: string;
  required: boolean;
  isActive: boolean;
  displayOrder: string;
};

const RUBRIC_FIELDS = {
  allowedEvaluatorRoles: {id:'rubric-allowed-roles',label:'Rubric for'},
  familyCode: {id: 'rubric-family-code', label: 'Family code'},
  name: {id: 'rubric-name', label: 'Name'},
  description: {id: 'rubric-description', label: 'Description'},
  targetMark: {id: 'rubric-target-mark', label: 'Target mark'},
};
const COMPONENT_FIELDS = {
  code: {id: 'component-code', label: 'Code'},
  name: {id: 'component-name', label: 'Component name'},
  description: {id: 'component-description', label: 'Description'},
  maxMarks: {id: 'component-maximum', label: 'Maximum mark'},
  displayOrder: {id: 'component-order', label: 'Display order'},
};
const RUBRIC_FIELD_MAP = {allowed_evaluator_roles:'allowedEvaluatorRoles',allowedEvaluatorRoles:'allowedEvaluatorRoles',family_code:'familyCode', familyCode:'familyCode', name:'name', description:'description', target_mark:'targetMark', targetMark:'targetMark'};
const COMPONENT_FIELD_MAP = {code:'code', name:'name', description:'description', max_marks:'maxMarks', maxMarks:'maxMarks', display_order:'displayOrder', displayOrder:'displayOrder'};

const EMPTY_RUBRIC: RubricForm = {
  allowedEvaluatorRoles: [],
  familyCode: '',
  name: '',
  description: '',
  targetMark: '100.00',
};

const EMPTY_COMPONENT: ComponentForm = {
  id: null,
  code: '',
  name: '',
  description: '',
  maxMarks: '',
  required: true,
  isActive: true,
  displayOrder: '1',
};
const metadataOf = (rubric: RubricVersion): RubricForm => ({allowedEvaluatorRoles:rubric.allowedEvaluatorRoles ?? [],familyCode: rubric.familyCode, name: rubric.name, description: rubric.description, targetMark: rubric.targetMark});
const componentOf = (component: RubricComponent): ComponentForm => ({id: Number(component.id), code: component.code || '', name: component.name, description: component.description, maxMarks: String(component.maxMarks), required: component.required, isActive: component.isActive ?? component.status === 'ACTIVE', displayOrder: String(component.displayOrder ?? 0)});
const emptyComponentFor = (rubric: RubricVersion | null): ComponentForm => ({...EMPTY_COMPONENT, displayOrder: String((rubric?.components.length ?? 0) + 1)});
const sameForm = (a: RubricForm | ComponentForm, b: RubricForm | ComponentForm) => JSON.stringify(a) === JSON.stringify(b);

const RubricsManagementContent: React.FC<RubricsManagementViewProps> = ({
  onBack,
}) => {
  const [familyFilters, setFamilyFilters] = useState({search: '', status: 'available', page: 1});
  const [versionConfirm, setVersionConfirm] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<RubricVersion | null>(null);
  const [rubrics, setRubrics] = useState<RubricVersion[]>([]);
  const [selected, setSelected] = useState<RubricVersion | null>(null);
  const [rubricForm, setRubricForm] = useState<RubricForm>(EMPTY_RUBRIC);
  const [componentForm, setComponentForm] = useState<ComponentForm>(EMPTY_COMPONENT);
  const [creatingFamily, setCreatingFamily] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [componentOpen, setComponentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<{rubric: RubricVersion; message: string} | null>(null);
  const [rubricFeedback, setRubricFeedback] = useState<FormFeedbackState | null>(null);
  const [componentFeedback, setComponentFeedback] = useState<FormFeedbackState | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [componentActionError, setComponentActionError] = useState<string | null>(null);
  const [savedReadBlocked,setSavedReadBlocked]=useState(false);
  const [mutationBlock, setMutationBlock] = useState<'metadata' | 'component' | 'clone' | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const feedback = useDecisionFeedback();
  const [rubricBaseline, setRubricBaseline] = useState<RubricForm>(EMPTY_RUBRIC);
  const [componentBaseline, setComponentBaseline] = useState<ComponentForm>(EMPTY_COMPONENT);
  const [replacement, setReplacement] = useState<{scope: 'all' | 'metadata' | 'component'; run: () => void} | null>(null);
  const [backConfirm, setBackConfirm] = useState(false);
  const [deactivation, setDeactivation] = useState<RubricComponent | null>(null);
  const familyTitleId = useModalTitle();
  const componentTitleId = useModalTitle();
  const previousSelection = useRef<RubricVersion | null>(null);
  const busyRef = useRef(false);
  const readGeneration = useRef(0);
  const metadataDirty = !sameForm(rubricForm, rubricBaseline);
  const componentDirty = !sameForm(componentForm, componentBaseline);
  const dirty = metadataDirty || componentDirty;
  const busy = saving || selectionBusy || busyRef.current;

  const showToast = (message: string) => {
    feedback?.(message, 'success');
  };

  const startWrite = () => {if (busyRef.current || savedReadBlocked || mutationBlock) return false; busyRef.current = true; setSaving(true); return true;};
  const finishWrite = () => {busyRef.current = false; setSaving(false);};
  const replaceAfter = (scope: 'all' | 'metadata' | 'component', run: () => void) => {
    if (busyRef.current) return;
    if (scope === 'all' ? dirty : scope === 'metadata' ? metadataDirty : componentDirty) setReplacement({scope, run}); else run();
  };

  const loadRubrics = useCallback(async () => {
    const generation = readGeneration.current;
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await getRubricVersions();
      if (generation !== readGeneration.current) return;
      setRubrics(rows);

    } catch (loadError) {
      if (generation !== readGeneration.current) return;
      setLoadError(loadError instanceof Error ? loadError.message : 'Rubric versions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [selected, creatingFamily]);

  useEffect(() => {
    void loadRubrics();
  }, []);

  useEffect(() => {
    if (creatingFamily) document.getElementById(RUBRIC_FIELDS.familyCode.id)?.focus();
  }, [creatingFamily]);

  const selectRubric = async (rubric: RubricVersion, preserveMetadata = false, preserveComponent = false, throwOnFailure = false) => {
    if (busyRef.current || selectionBusy) return;
    const generation = ++readGeneration.current;
    setSelectionBusy(true);
    setSelectionError(null);
    try {
      const detail = await getRubricVersion(rubric.id);
      if (generation !== readGeneration.current) return;
      setSelected(detail);
      setRubrics(current => current.map(row => row.id === detail.id ? detail : row));
      setSavedReadBlocked(false);
      setMutationBlock(null);
      setRecoveryError(null);
      if (!preserveMetadata) setRubricForm(metadataOf(detail));
      setRubricBaseline(metadataOf(detail));
      if (!preserveComponent) {const empty = emptyComponentFor(detail); setComponentForm(empty); setComponentBaseline(empty);}
      setCreatingFamily(false);
      setEditingMetadata(false); setComponentOpen(false);
      if (!preserveMetadata) setRubricFeedback(null);
      if (!preserveComponent) setComponentFeedback(null);
      setCloneError(null);
      setComponentActionError(null);
    } catch (loadError) {
      if (generation !== readGeneration.current) return;
      setSelectionError({rubric, message: loadError instanceof Error ? loadError.message : 'This rubric version could not be loaded.'});
      if (throwOnFailure) throw loadError;
    } finally {
      if (generation === readGeneration.current) setSelectionBusy(false);
    }
  };

  const recoverNewFamily = async () => {
    if (busyRef.current || selectionBusy) return;
    setSelectionBusy(true); setRecoveryError(null);
    try {
      const rows = await getRubricVersions();
      setRubrics(rows);
      const first = rows[0] ?? null;
      setSelected(first); setCreatingFamily(!first); setEditingMetadata(false); setComponentOpen(false);
      const metadata = first ? metadataOf(first) : EMPTY_RUBRIC;
      const component = emptyComponentFor(first);
      setRubricForm(metadata); setRubricBaseline(metadata);
      setComponentForm(component); setComponentBaseline(component);
      setMutationBlock(null);
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : 'The latest rubric families could not be loaded.');
    } finally {setSelectionBusy(false);}
  };

  const replaceRubric = (updated: RubricVersion, preserveMetadata = false) => {
    setRubrics((current) => {
      const exists = current.some((rubric) => rubric.id === updated.id);
      return exists
        ? current.map((rubric) => rubric.id === updated.id ? updated : rubric)
        : [updated, ...current];
    });
    setSelected(updated);
    if (!preserveMetadata) setRubricForm(metadataOf(updated));
    setRubricBaseline(metadataOf(updated));
  };

  const beginFamily = () => {
    if (selectionBusy || busyRef.current) return;
    ++readGeneration.current;
    previousSelection.current = selected;
    setCreatingFamily(true);
    setEditingMetadata(false); setComponentOpen(false);
    setSelected(null);
    setRubricForm(EMPTY_RUBRIC);
    setRubricBaseline(EMPTY_RUBRIC);
    setComponentForm(EMPTY_COMPONENT);
    setComponentBaseline(EMPTY_COMPONENT);
    setRubricFeedback(null);
    setComponentFeedback(null);
    setSelectionError(null);
    setCloneError(null);
    setComponentActionError(null);
  };

  const closeFamily = () => {
    if (busyRef.current || selectionBusy) return;
    replaceAfter('all', () => {
      const prior = previousSelection.current;
      setSelected(prior);
      const metadata = prior ? metadataOf(prior) : EMPTY_RUBRIC;
      const component = emptyComponentFor(prior);
      setRubricForm(metadata); setRubricBaseline(metadata);
      setComponentForm(component); setComponentBaseline(component);
      setRubricFeedback(null); setMutationBlock(null); setRecoveryError(null);
      setCreatingFamily(false);
    });
  };

  const closeMetadata = () => {
    if (busyRef.current || selectionBusy) return;
    if (creatingFamily) {closeFamily(); return;}
    replaceAfter('metadata', () => {
      setRubricForm(rubricBaseline); setRubricFeedback(null);
      setEditingMetadata(false);
    });
  };

  const closeComponent = () => {
    if (busyRef.current || selectionBusy) return;
    replaceAfter('component', () => {
      const empty = emptyComponentFor(selected);
      setComponentForm(empty); setComponentBaseline(empty); setComponentFeedback(null);
      setComponentOpen(false);
    });
  };

  const saveRubric = async (event: React.FormEvent) => {
    event.preventDefault();
    if(!rubricForm.allowedEvaluatorRoles.length){const feedback={message:'Choose who this rubric is for before saving.',fields:{allowedEvaluatorRoles:'Select Supervisor only, Panel only or Both.'}};setRubricFeedback(feedback);focusFeedback(feedback,{allowedEvaluatorRoles:'rubric-allowed-roles'},'rubric-save-feedback');return;}
    if(!startWrite())return;
    setRubricFeedback(null);
    try {
      const updated = creatingFamily
        ? await createRubricVersion(rubricForm)
        : await updateRubricVersion(selected!.id, {
            allowedEvaluatorRoles: rubricForm.allowedEvaluatorRoles,
            name: rubricForm.name,
            description: rubricForm.description,
            targetMark: rubricForm.targetMark,
          });
      replaceRubric(updated);
      setCreatingFamily(false); setEditingMetadata(false);
      showToast(creatingFamily ? 'Rubric family created.' : 'Rubric version updated.');
    } catch (saveError) {
      if (decisionFailure(saveError).blocked) setMutationBlock('metadata');
      const feedback = readFormFeedback(saveError, marksMutationErrorMessage(saveError), RUBRIC_FIELD_MAP);
      setRubricFeedback(feedback);
      focusFeedback(feedback, Object.fromEntries(Object.entries(RUBRIC_FIELDS).map(([key, field]) => [key, field.id])), 'rubric-save-feedback');
    } finally {
      finishWrite();
    }
  };

  const cloneSelected = async () => {
    if (!selected||!startWrite()) return;
    setCloneError(null);
    try {
      const cloned = await cloneRubricVersion(selected.id);
      setRubrics((current) => [
        cloned,
        ...current.map((rubric) => (
          rubric.familyCode === cloned.familyCode
            ? { ...rubric, isActive: rubric.id === cloned.id }
            : rubric
        )),
      ]);
      replaceRubric(cloned);
      const empty = emptyComponentFor(cloned); setComponentForm(empty); setComponentBaseline(empty);
      showToast(`Rubric version ${cloned.version} created.`);
    } catch (cloneError) {
      if (decisionFailure(cloneError).blocked) setMutationBlock('clone');
      setCloneError(marksMutationErrorMessage(cloneError));
    } finally {
      finishWrite();
    }
  };

  const editComponent = (component: RubricComponent) => {
    setComponentFeedback(null); setComponentOpen(true);
    setComponentForm(componentOf(component)); setComponentBaseline(componentOf(component));
  };

  const saveComponent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected||!startWrite()) return;
    setComponentFeedback(null);
    const payload = {
      code: componentForm.code,
      name: componentForm.name,
      description: componentForm.description,
      maxMarks: componentForm.maxMarks,
      required: componentForm.required,
      isActive: componentForm.isActive,
      displayOrder: Number(componentForm.displayOrder),
    };
    let committed=false;
    try {
      if (componentForm.id) {
        await updateRubricComponent(selected.id, componentForm.id, payload);
      } else {
        await createRubricComponent(selected.id, payload);
      }
      committed=true; setComponentOpen(false);
      const empty = {...EMPTY_COMPONENT, displayOrder: String(selected.components.length + (componentForm.id ? 1 : 2))};
      setComponentForm(empty); setComponentBaseline(empty);
      const refreshed = await getRubricVersion(selected.id);
      replaceRubric(refreshed, true);
      const freshEmpty = emptyComponentFor(refreshed); setComponentForm(freshEmpty); setComponentBaseline(freshEmpty);
      showToast(componentForm.id ? 'Rubric component updated.' : 'Rubric component added.');
    } catch (componentError) {
      if(committed){setSavedReadBlocked(true);feedback?.(`${componentForm.id ? 'Rubric component updated.' : 'Rubric component added.'} The latest rubric could not be loaded. Reload it before another change.`, 'warning');return;}
      if (decisionFailure(componentError).blocked) setMutationBlock('component');
      const fieldFeedback = readFormFeedback(componentError, marksMutationErrorMessage(componentError), COMPONENT_FIELD_MAP);
      setComponentFeedback(fieldFeedback);
      focusFeedback(fieldFeedback, Object.fromEntries(Object.entries(COMPONENT_FIELDS).map(([key, field]) => [key, field.id])), 'component-save-feedback');
    } finally {
      finishWrite();
    }
  };

  const deactivateComponent = async (component: RubricComponent) => {
    if (!selected||!startWrite()) return false;
    setComponentActionError(null);
    let committed=false;
    try {
      await updateRubricComponent(
        selected.id,
        Number(component.id),
        { isActive: !(component.isActive ?? component.status === 'ACTIVE') },
      );
      committed=true;
      const refreshed = await getRubricVersion(selected.id);
      replaceRubric(refreshed, true);
      return;
    } catch (componentError) {
      if(committed){setSavedReadBlocked(true);return {refreshFailed: true};}
      setComponentActionError(marksMutationErrorMessage(componentError));
      throw componentError;
    } finally {
      finishWrite();
    }
  };

  const familyGroups = useMemo(() => {
    const groups = new Map<string, RubricVersion[]>();
    for (const rubric of rubrics) {
      groups.set(rubric.familyCode, [
        ...(groups.get(rubric.familyCode) || []),
        rubric,
      ]);
    }
    return [...groups.entries()];
  }, [rubrics]);

  const archiveFamily = async (): Promise<void | false> => {
    if (!archiveTarget || !startWrite()) return false;
    try {
      const updated = await setRubricFamilyArchived(archiveTarget.id, !archiveTarget.isArchived);
      setRubrics(current => current.map(row => row.familyCode === updated.familyCode ? {...row, isArchived: updated.isArchived} : row));
      if (selected?.familyCode === updated.familyCode) setSelected(current => current ? {...current, isArchived: updated.isArchived} : current);
    } finally {finishWrite();}
  };
  const leaveFamily = () => replaceAfter('all', () => {
    ++readGeneration.current; setSelected(null); setSelectionError(null);
    setRubricForm(EMPTY_RUBRIC); setRubricBaseline(EMPTY_RUBRIC);
    setComponentForm(EMPTY_COMPONENT); setComponentBaseline(EMPTY_COMPONENT);
  });

  const recoveryNotice = (mutationBlock ? <AlertMessage type="warning" title="Review latest rubric" message={recoveryError ?? 'This change was not saved. Load the latest rubric and review your access before trying again.'} actions={<PortalButton disabled={busy} onClick={() => replaceAfter(mutationBlock === 'component' ? 'component' : mutationBlock === 'metadata' ? 'metadata' : 'all', () => {if (selected) void selectRubric(selected, mutationBlock === 'component', mutationBlock === 'metadata'); else void recoverNewFamily();})}>Review latest rubric</PortalButton>}/> : null);

  const componentEditor = (
    <form onSubmit={saveComponent} className="feedback-fields px-6 py-6">
      <fieldset disabled={busy || Boolean(mutationBlock) || savedReadBlocked} className="min-w-0"><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        <div><label htmlFor={COMPONENT_FIELDS.code.id} className="form-label mb-2 block">Code</label><input
          required
          placeholder="Code"
          id={COMPONENT_FIELDS.code.id}
        aria-invalid={componentFeedback?.fields.code ? true : undefined}
        aria-describedby={componentFeedback?.fields.code ? `${COMPONENT_FIELDS.code.id}-error` : undefined}
        value={componentForm.code}
          onChange={(event) => {setComponentFeedback(current => clearFeedbackFields(current, ['code'])); setComponentForm((current) => ({ ...current, code: event.target.value }));}}
          className="form-control form-control-md"
        />
        <FieldError id={`${COMPONENT_FIELDS.code.id}-error`} message={componentFeedback?.fields.code}/></div>
        <div><label htmlFor={COMPONENT_FIELDS.name.id} className="form-label mb-2 block">Component name</label><input
          required
          placeholder="Component name"
          id={COMPONENT_FIELDS.name.id}
        aria-invalid={componentFeedback?.fields.name ? true : undefined}
        aria-describedby={componentFeedback?.fields.name ? `${COMPONENT_FIELDS.name.id}-error` : undefined}
        value={componentForm.name}
          onChange={(event) => {setComponentFeedback(current => clearFeedbackFields(current, ['name'])); setComponentForm((current) => ({ ...current, name: event.target.value }));}}
          className="form-control form-control-md"
        />
        <FieldError id={`${COMPONENT_FIELDS.name.id}-error`} message={componentFeedback?.fields.name}/></div>
        <div><label htmlFor={COMPONENT_FIELDS.maxMarks.id} className="form-label mb-2 block">Maximum mark</label><input
          required
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Maximum mark"
          id={COMPONENT_FIELDS.maxMarks.id}
        aria-invalid={componentFeedback?.fields.maxMarks ? true : undefined}
        aria-describedby={componentFeedback?.fields.maxMarks ? `${COMPONENT_FIELDS.maxMarks.id}-error` : undefined}
        value={componentForm.maxMarks}
          onChange={(event) => {setComponentFeedback(current => clearFeedbackFields(current, ['maxMarks'])); setComponentForm((current) => ({ ...current, maxMarks: event.target.value }));}}
          className="form-control form-control-md"
        />
        <FieldError id={`${COMPONENT_FIELDS.maxMarks.id}-error`} message={componentFeedback?.fields.maxMarks}/></div>
        <div><label htmlFor={COMPONENT_FIELDS.displayOrder.id} className="form-label mb-2 block">Display order</label><input
          required
          type="number"
          min="0"
          placeholder="Display order"
          id={COMPONENT_FIELDS.displayOrder.id}
        aria-invalid={componentFeedback?.fields.displayOrder ? true : undefined}
        aria-describedby={componentFeedback?.fields.displayOrder ? `${COMPONENT_FIELDS.displayOrder.id}-error` : undefined}
        value={componentForm.displayOrder}
          onChange={(event) => {setComponentFeedback(current => clearFeedbackFields(current, ['displayOrder'])); setComponentForm((current) => ({ ...current, displayOrder: event.target.value }));}}
          className="form-control form-control-md"
        />
        <FieldError id={`${COMPONENT_FIELDS.displayOrder.id}-error`} message={componentFeedback?.fields.displayOrder}/></div>
        <div className="sm:col-span-2"><label htmlFor={COMPONENT_FIELDS.description.id} className="form-label mb-2 block">Description</label><textarea
          rows={3}
          placeholder="Description"
          id={COMPONENT_FIELDS.description.id}
        aria-invalid={componentFeedback?.fields.description ? true : undefined}
        aria-describedby={componentFeedback?.fields.description ? `${COMPONENT_FIELDS.description.id}-error` : undefined}
        value={componentForm.description}
          onChange={(event) => {setComponentFeedback(current => clearFeedbackFields(current, ['description'])); setComponentForm((current) => ({ ...current, description: event.target.value }));}}
          className="form-control form-control-md"
        />
        <FieldError id={`${COMPONENT_FIELDS.description.id}-error`} message={componentFeedback?.fields.description}/></div>
        <label className="card-description flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={componentForm.required}
            onChange={(event) => setComponentForm((current) => ({ ...current, required: event.target.checked }))}
            className="h-4 w-4 accent-brand-navy"
          />
          Required
        </label>
      </div>
      <div className="mt-4"><FormFeedback id="component-save-feedback" title="Component wasn’t saved" feedback={componentFeedback} fields={COMPONENT_FIELDS}/></div>
      </fieldset>
      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
        <PortalButton onClick={closeComponent} disabled={busy}>Cancel</PortalButton>
        <PortalButton type="submit" icon={Save} variant="primary" isLoading={saving} disabled={busy || Boolean(mutationBlock) || savedReadBlocked}>
          {componentForm.id ? 'Save component' : 'Add component'}
        </PortalButton>

      </div>
    </form>
  );

  const metadataEditor = (
    <div className="px-6 py-6">
      {(creatingFamily || selected) ? (
        <form onSubmit={saveRubric} className="feedback-fields grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="form-label">
            Family code
            <input
              required
              disabled={!creatingFamily || busy || Boolean(mutationBlock)}
              id={RUBRIC_FIELDS.familyCode.id}
              aria-invalid={rubricFeedback?.fields.familyCode ? true : undefined}
              aria-describedby={rubricFeedback?.fields.familyCode ? `${RUBRIC_FIELDS.familyCode.id}-error` : undefined}
              value={rubricForm.familyCode}
              onChange={(event) => {setRubricFeedback(current => clearFeedbackFields(current, ['familyCode'])); setRubricForm((current) => ({ ...current, familyCode: event.target.value }));}}
              className="form-control form-control-md mt-2 disabled:bg-slate-100"
            />
              <FieldError id={`${RUBRIC_FIELDS.familyCode.id}-error`} message={rubricFeedback?.fields.familyCode}/>
          </label>
          <label className="form-label">
            Target mark
            <input
              required
              type="number"
              min="1"
              step="0.01"
              disabled={Boolean(selected?.isLocked) || busy || Boolean(mutationBlock)}
              id={RUBRIC_FIELDS.targetMark.id}
              aria-invalid={rubricFeedback?.fields.targetMark ? true : undefined}
              aria-describedby={rubricFeedback?.fields.targetMark ? `${RUBRIC_FIELDS.targetMark.id}-error` : undefined}
              value={rubricForm.targetMark}
              onChange={(event) => {setRubricFeedback(current => clearFeedbackFields(current, ['targetMark'])); setRubricForm((current) => ({ ...current, targetMark: event.target.value }));}}
              className="form-control form-control-md mt-2 disabled:bg-slate-100"
            />
              <FieldError id={`${RUBRIC_FIELDS.targetMark.id}-error`} message={rubricFeedback?.fields.targetMark}/>
          </label>
          <label className="form-label sm:col-span-2">
            Name
            <input
              required
              disabled={Boolean(selected?.isLocked) || busy || Boolean(mutationBlock)}
              id={RUBRIC_FIELDS.name.id}
              aria-invalid={rubricFeedback?.fields.name ? true : undefined}
              aria-describedby={rubricFeedback?.fields.name ? `${RUBRIC_FIELDS.name.id}-error` : undefined}
              value={rubricForm.name}
              onChange={(event) => {setRubricFeedback(current => clearFeedbackFields(current, ['name'])); setRubricForm((current) => ({ ...current, name: event.target.value }));}}
              className="form-control form-control-md mt-2 disabled:bg-slate-100"
            />
              <FieldError id={`${RUBRIC_FIELDS.name.id}-error`} message={rubricFeedback?.fields.name}/>
          </label>
          <label className="form-label sm:col-span-2">
            Description
            <textarea
              rows={3}
              disabled={Boolean(selected?.isLocked) || busy || Boolean(mutationBlock)}
              id={RUBRIC_FIELDS.description.id}
              aria-invalid={rubricFeedback?.fields.description ? true : undefined}
              aria-describedby={rubricFeedback?.fields.description ? `${RUBRIC_FIELDS.description.id}-error` : undefined}
              value={rubricForm.description}
              onChange={(event) => {setRubricFeedback(current => clearFeedbackFields(current, ['description'])); setRubricForm((current) => ({ ...current, description: event.target.value }));}}
              className="form-control form-control-md mt-2 disabled:bg-slate-100"
            />
              <FieldError id={`${RUBRIC_FIELDS.description.id}-error`} message={rubricFeedback?.fields.description}/>
          </label>
          <label className="form-label sm:col-span-2">Rubric for
            <PortalSelect id="rubric-allowed-roles" required disabled={Boolean(selected?.isLocked)||busy||Boolean(mutationBlock)} value={rubricForm.allowedEvaluatorRoles.length===2?'BOTH':rubricForm.allowedEvaluatorRoles[0]??''} onChange={event=>{const value=event.target.value;setRubricForm(current=>({...current,allowedEvaluatorRoles:value==='BOTH'?['SUPERVISOR','PANEL']:value?[value as 'SUPERVISOR'|'PANEL']:[]}));setRubricFeedback(current=>clearFeedbackFields(current,['allowedEvaluatorRoles']));}} className="form-control form-control-md mt-2 w-full"><option value="" disabled hidden>Select a role</option><option value="SUPERVISOR">Supervisor only</option><option value="PANEL">Panel only</option><option value="BOTH">Both</option></PortalSelect>
            <FieldError id="rubric-allowed-roles-error" message={rubricFeedback?.fields.allowedEvaluatorRoles}/>
          </label>
          <div className="sm:col-span-2"><FormFeedback id="rubric-save-feedback" title="Rubric wasn’t saved" feedback={rubricFeedback} fields={RUBRIC_FIELDS}/></div>
          {cloneError ? <div className="sm:col-span-2"><AlertMessage type="error" title="New version wasn’t created" message={cloneError}/></div> : null}
          <div className="sm:col-span-2 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
            <PortalButton onClick={closeMetadata} disabled={busy}>Cancel</PortalButton>
            {(creatingFamily || !selected?.isLocked) ? (
              <PortalButton type="submit" icon={Save} variant="primary" isLoading={saving} disabled={Boolean(mutationBlock)}>
                {creatingFamily ? 'Create family' : 'Save version'}
              </PortalButton>
            ) : null}
            {selected?.isLocked ? (
              <PortalButton icon={Copy} variant="soft" isLoading={saving} onClick={() => replaceAfter('all', () => void cloneSelected())}>
                Clone new version
              </PortalButton>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );

  return (
    <div id="rubric-version-management" className="marks-workspace space-y-7 animate-fade-in">
      <DraftNavigationGuard dirty={dirty} busy={busy} />
      <PortalConfirmModal isOpen={backConfirm} title="Discard unsaved rubric changes?" message="Leave this page and discard the unsaved rubric changes?" confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={() => setBackConfirm(false)} onConfirm={() => {flushSync(() => {setBackConfirm(false);setRubricBaseline(rubricForm);setComponentBaseline(componentForm);}); onBack();}} />
      <PortalConfirmModal isOpen={replacement !== null} title="Discard unsaved rubric changes?" message="Replace the current unsaved changes?" confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={() => setReplacement(null)} onConfirm={() => {const next=replacement; setReplacement(null); next?.run();}} />
      <PortalConfirmModal isOpen={versionConfirm} title="Create a new rubric version?" message={`Copy Version ${selected?.version} into the next version for this family. The new version becomes current for new evaluations; existing evaluations keep their assigned version.`} confirmLabel="Create version" cancelLabel="Cancel" onCancel={() => setVersionConfirm(false)} onConfirm={() => {setVersionConfirm(false); void cloneSelected();}} />
      <DecisionDialog isOpen={archiveTarget !== null} decisionKey={archiveTarget?.id ?? 'archive'} title={archiveTarget?.isArchived ? 'Restore rubric family' : 'Archive rubric family'} message={archiveTarget?.isArchived ? 'Restore this family for new evaluation setup. Existing criteria and marks stay unchanged.' : 'Remove this family from new evaluation setup? Existing evaluation periods, tasks and marks will keep their rubric versions.'} confirmLabel={archiveTarget?.isArchived ? 'Restore family' : 'Archive family'} tone={archiveTarget?.isArchived ? 'info' : 'danger'} successMessage={archiveTarget?.isArchived ? 'Rubric family restored.' : 'Rubric family archived.'} onClose={() => setArchiveTarget(null)} onConfirm={archiveFamily} />
      <DecisionDialog isOpen={deactivation !== null} decisionKey={deactivation?.id ?? 'none'} title={(deactivation?.isActive ?? deactivation?.status === 'ACTIVE') ? "Deactivate rubric component" : "Reactivate rubric component"} message={(deactivation?.isActive ?? deactivation?.status === 'ACTIVE') ? `Deactivate ${deactivation?.name ?? 'this component'}? Its marks configuration will no longer be active.` : `Reactivate ${deactivation?.name ?? 'this component'}? Its marks will count towards the rubric total again.`} confirmLabel={(deactivation?.isActive ?? deactivation?.status === 'ACTIVE') ? "Deactivate component" : "Reactivate component"} tone={(deactivation?.isActive ?? deactivation?.status === 'ACTIVE') ? "danger" : "info"} successMessage={(deactivation?.isActive ?? deactivation?.status === 'ACTIVE') ? "Rubric component deactivated." : "Rubric component reactivated."} onClose={() => setDeactivation(null)} onConfirm={async () => deactivation ? deactivateComponent(deactivation) : false} onReload={selected ? () => selectRubric(selected, true, false, true) : undefined} />
      <PortalModal isOpen={creatingFamily || editingMetadata} onClose={closeMetadata} busy={busy} labelledBy={familyTitleId} className="marks-workspace max-w-2xl p-0">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <h2 id={familyTitleId} className="section-heading">{creatingFamily ? 'New rubric family' : 'Edit rubric details'}</h2>
          <button type="button" className="icon-button h-9 w-9 shrink-0" aria-label="Close rubric details" disabled={busy} onClick={closeMetadata}><X className="h-4 w-4" aria-hidden="true" /></button>
        </header>
        {mutationBlock ? <div className="px-6 pt-5">{recoveryNotice}</div> : null}
        {metadataEditor}
      </PortalModal>
      <PortalModal isOpen={componentOpen} onClose={closeComponent} busy={busy} labelledBy={componentTitleId} className="marks-workspace max-w-2xl p-0">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div><h2 id={componentTitleId} className="section-heading">{componentForm.id ? 'Edit component' : 'Add component'}</h2>
          <p className="card-description mt-1">{selected?.familyCode} · Version {selected?.version}</p></div>
          <button type="button" className="icon-button h-9 w-9 shrink-0" aria-label="Close component" disabled={busy} onClick={closeComponent}><X className="h-4 w-4" aria-hidden="true" /></button>
        </header>
        {mutationBlock ? <div className="px-6 pt-5">{recoveryNotice}</div> : null}
        {componentEditor}
      </PortalModal>
      <PageHeader
        title={selected ? selected.name : "Rubric families"}
        subtitle={selected ? selected.familyCode : "Manage marking criteria and the versions used by evaluation periods."}
        backLabel={selected ? "Back to rubric families" : "Back to Marks overview"}
        onBack={() => {if (busyRef.current || selectionBusy) return; ++readGeneration.current; if (selected) leaveFamily(); else if (dirty) setBackConfirm(true); else onBack();}}
        actions={!selected ? (
          <PortalButton icon={Plus} variant="primary" disabled={busy||savedReadBlocked} onClick={() => replaceAfter('all', beginFamily)}>
            New rubric family
          </PortalButton>
        ) : !selected.isArchived ? <PortalButton icon={Copy} variant="primary" disabled={busy || savedReadBlocked || Boolean(mutationBlock)} onClick={() => replaceAfter('all', () => setVersionConfirm(true))}>New version</PortalButton> : undefined}
      />

      {loadError ? <ErrorState compact title="Rubric versions could not be loaded" message={loadError} onRetry={loadRubrics} /> : null}
      {savedReadBlocked?<AlertMessage type="warning" title="Component saved; refresh required" message="The change was saved, but the latest rubric could not be loaded. Reload it before another change." actions={selected?<PortalButton disabled={saving} onClick={()=>void selectRubric(selected, true)}>Reload rubric</PortalButton>:undefined}/>:null}
      {!creatingFamily && !editingMetadata && !componentOpen ? recoveryNotice : null}

      {loading ? (
        <LoadingState message="Loading rubric versions..." />
      ) : loadError?null:familyGroups.length === 0 ? (
        <PortalCard data-rubric-empty padding="lg">
          <EmptyState
            icon={Layers3}
            title="No rubric families yet"
            description="Create your first rubric family, then add its assessment components and marks."
          />
        </PortalCard>
      ) : !selected ? <>
        {selectionError ? <ErrorState compact title="Rubric version could not be loaded" message={selectionError.message} onRetry={() => void selectRubric(selectionError.rubric)} /> : null}
        <RubricFamilyList rubrics={rubrics} filters={familyFilters} onFiltersChange={setFamilyFilters} busy={busy} onManage={row => void selectRubric(row)} />
      </> : (
        <fieldset disabled={savedReadBlocked||busy||Boolean(mutationBlock)} className="feedback-fields min-w-0 space-y-6">
          {selected ? <section data-rubric-summary className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-3"><h2 className="section-heading break-words">Version {selected.version}</h2><StatusBadge tone={selected.isArchived ? 'neutral' : selected.isActive ? 'info' : 'neutral'}>{selected.isArchived ? 'Archived family' : selected.isActive ? 'Current' : 'Previous'}</StatusBadge></div>
                <p className="card-description">Rubric for: {selected.allowedEvaluatorRoles?.length ? selected.allowedEvaluatorRoles.map(role=>role==='SUPERVISOR'?'Supervisor':'Panel').join(' and ') : 'Unconfigured'}</p>
                {selected.description ? <p className="card-description max-w-2xl whitespace-pre-wrap break-words">{selected.description}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {!selected.isArchived && !selected.isLocked ? <PortalButton icon={Edit3} onClick={() => setEditingMetadata(true)}>Edit details</PortalButton> : null}
                <PortalButton icon={selected.isArchived ? RotateCcw : Archive} variant={selected.isArchived ? 'secondary' : 'danger'} onClick={() => setArchiveTarget(selected)}>{selected.isArchived ? 'Restore family' : 'Archive family'}</PortalButton>
              </div>
            </div>
            {selected.isLocked ? <AlertMessage className="mt-5" type="info" title="This version is locked" message="This rubric is in use. Select New version to create an editable copy." /> : null}
            <details className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Used by {selected.usage?.length ?? 0} evaluation {(selected.usage?.length ?? 0) === 1 ? 'period' : 'periods'}</summary>
              {selected.usage?.length ? <ul className="mt-4 max-h-72 overflow-auto divide-y divide-slate-100">{selected.usage.map(period => <li key={period.id} className="flex flex-wrap justify-between gap-3 py-3"><div><p className="card-value">{period.name}</p><p className="card-description mt-1">{period.semester}</p></div><StatusBadge tone="neutral">{period.status}</StatusBadge></li>)}</ul> : <p className="card-description mt-3">This version has not been assigned to an evaluation period.</p>}
            </details>
          </section> : null}
          {selectionError ? <ErrorState compact title="Rubric version could not be loaded" message={selectionError.message} onRetry={() => replaceAfter('all', () => void selectRubric(selectionError.rubric))} /> : null}
          {cloneError ? <AlertMessage type="error" title="New version wasn’t created" message={cloneError} /> : null}
            {selected ? (
              <PortalCard data-assessment-components padding="none" className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-6">
                  <div>
                    <MarksHeading icon={Edit3}>Assessment components</MarksHeading>
                    <div className="ml-12 mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <p className="text-sm tabular-nums text-slate-600">{Number(selected.componentTotal)} / {Number(selected.targetMark)} marks configured</p>
                      <StatusBadge tone={selected.isReady ? 'success' : Number(selected.componentTotal) > Number(selected.targetMark) ? 'danger' : 'warning'}>{selected.isReady ? 'Ready' : Number(selected.componentTotal) > Number(selected.targetMark) ? 'Over target' : selected.components.length === 0 ? 'Not configured' : Number(selected.componentTotal) < Number(selected.targetMark) ? 'Below target' : 'Needs review'}</StatusBadge>
                      {selected.isLocked ? <StatusBadge tone="neutral">Locked</StatusBadge> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {!selected.isLocked && !selected.isArchived ? <PortalButton icon={Plus} variant="primary" onClick={() => {
                      const empty = emptyComponentFor(selected);
                      setComponentForm(empty); setComponentBaseline(empty); setComponentFeedback(null); setComponentOpen(true);
                    }}>Add component</PortalButton> : null}
                  </div>
                </div>
                {componentActionError ? <div className="px-5 pt-4"><AlertMessage type="error" title="Component wasn’t changed" message={componentActionError}/></div> : null}
                {selected.components.length === 0 ? <div className="px-6"><EmptyState icon={Layers3} title="No assessment components yet" description="Add the criteria used to assess this rubric." /></div> : <div role="region" aria-label="Assessment components" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600">
                  <table className="data-table table-fixed min-w-[960px] [&_th]:px-6 [&_th]:py-4 [&_td]:px-6 [&_td]:py-5">
                    <caption className="sr-only">Assessment components and maximum marks for this rubric version</caption>
                    <colgroup>
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '24%' }} />
                    </colgroup>
                    <thead>
                      <tr className="data-thead">
                        <th scope="col" className="data-th">Order</th>
                        <th scope="col" className="data-th">Component</th>
                        <th scope="col" className="data-th">Maximum</th>
                        <th scope="col" className="data-th">Required</th>
                        <th scope="col" className="data-th">Status</th>
                        <th scope="col" className="data-th">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.components.map((component) => (
                        <tr key={component.id}>
                          <td className="data-td">{component.displayOrder}</td>
                          <td className="data-td">
                            <span className="card-value block break-words">{component.name}</span>
                            <span className="mt-1 block text-xs text-slate-500">{component.code}</span>
                          </td>
                          <td className="data-td-strong">{component.maxMarks}</td>
                          <td className="data-td">{component.required ? 'Yes' : 'No'}</td>
                          <td className="data-td">
                            <StatusBadge tone={(component.isActive ?? component.status === 'ACTIVE') ? 'success' : 'neutral'}>
                              {(component.isActive ?? component.status === 'ACTIVE') ? 'Active' : 'Inactive'}
                            </StatusBadge>
                          </td>
                          <td className="data-td">
                            <div className="flex items-center gap-2">
                              <PortalButton
                                size="sm"
                                variant="secondary"
                                icon={Edit3}
                                title="Edit component"
                                disabled={selected.isLocked || selected.isArchived}
                                onClick={() => replaceAfter('component', () => editComponent(component))}
                              >Edit</PortalButton>
                              {(component.isActive ?? component.status === 'ACTIVE') ? (
                                <PortalButton
                                  size="sm"
                                  variant="danger"
                                  icon={XCircle}
                                  title="Deactivate component"
                                  disabled={selected.isLocked || selected.isArchived}
                                  onClick={() => replaceAfter('component', () => {const empty=emptyComponentFor(selected);setComponentForm(empty);setComponentBaseline(empty);setDeactivation(component);})}
                                >Deactivate</PortalButton>
                              ) : <PortalButton size="sm" variant="secondary" icon={CheckCircle2} title="Reactivate component" disabled={selected.isLocked || selected.isArchived} onClick={() => replaceAfter('component', () => {const empty=emptyComponentFor(selected);setComponentForm(empty);setComponentBaseline(empty);setDeactivation(component);})}>Reactivate</PortalButton>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}

              </PortalCard>
            ) : null}
          <RubricVersionHistory selected={selected} versions={[...(familyGroups.find(([code]) => code === selected.familyCode)?.[1] ?? [])].sort((a, b) => b.version - a.version)} onSelect={row => replaceAfter('all', () => void selectRubric(row))} />
        </fieldset>
      )}
    </div>
  );
};

export const RubricsManagementView: React.FC<RubricsManagementViewProps> = props =>
  <DecisionFeedbackProvider scopeKey="rubrics-management"><RubricsManagementContent {...props}/></DecisionFeedbackProvider>;
