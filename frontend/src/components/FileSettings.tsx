/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import type { DocumentTypeInput, DocumentTypeKind, DocumentTypeSettings } from '../types';
import { addDocumentType, getDocumentTypeSettings, updateDocumentType } from '../services/filesApi';
import { ApiError, fieldErrors } from '../services/apiClient';
import { titleCase } from '../utils/programmeLabel';
import {
  draftFromType,
  NEW_TYPE,
  saveNotices,
  savedMessage,
  toggled,
  typeChanges,
  typeProblem,
  typeSummary,
  UPLOADER_LABELS,
} from '../utils/documentTypeSettings';
import { PortalButton, PortalConfirmModal, PortalToast } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';
import { ToggleSwitch } from './ToggleSwitch';

type Toast = { message: string; tone: 'success' | 'danger' } | null;

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const SHARE_TICKS = [
  { key: 'shareSupervisors', label: 'Supervisors' },
  { key: 'sharePanel', label: 'Panel member' },
  { key: 'shareCoordinator', label: 'Programme coordinator' },
] as const;

const KIND_CHOICES: Array<{ value: DocumentTypeKind; label: string; hint: string }> = [
  { value: 'STUDENT', label: 'Files about students', hint: 'Forms, theses, letters and so on' },
  { value: 'STAFF', label: 'Staff files', hint: 'Not about any student, for example a rubric or meeting notes' },
];

const Pill: React.FC<{ checked: boolean; disabled?: boolean; onChange: () => void; children: React.ReactNode }> = ({ checked, disabled = false, onChange, children }) => (
  <label className={`inline-flex min-h-11 items-center gap-2.5 rounded-xl border px-3.5 text-[14px] font-semibold transition ${disabled ? 'cursor-default opacity-70' : 'cursor-pointer'} ${checked ? 'border-brand-navy bg-slate-50 text-brand-navy' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
    <input type="checkbox" className="h-[18px] w-[18px] accent-brand-navy" checked={checked} disabled={disabled} onChange={onChange} />
    {children}
  </label>
);

const SwitchRow: React.FC<{ id: string; title: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ id, title, hint, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4">
    <div>
      <p id={`${id}-title`} className="text-[15px] font-extrabold text-brand-navy">{title}</p>
      <p id={`${id}-hint`} className="text-[13px] text-slate-500">{hint}</p>
    </div>
    <ToggleSwitch id={id} checked={checked} onChange={onChange} labelledBy={`${id}-title`} describedBy={`${id}-hint`} />
  </div>
);

const Section: React.FC<{ title?: string; id?: string; children: React.ReactNode }> = ({ title, id, children }) => (
  <div className="space-y-3 border-t border-slate-100 px-5 py-5 sm:px-6">
    {title && <h3 id={id} className="text-[15px] font-extrabold text-brand-navy">{title}</h3>}
    {children}
  </div>
);

export const FileSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [settings, setSettings] = useState<DocumentTypeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<DocumentTypeInput>(NEW_TYPE);
  const [showEditor, setShowEditor] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<Toast>(null);
  const started = useRef(false);

  const types = settings?.types ?? [];
  const current = typeof selected === 'number' ? types.find(type => type.id === selected) ?? null : null;
  const original = current ? draftFromType(current) : NEW_TYPE;
  const changes = typeChanges(original, draft);
  const dirty = selected !== null && Object.keys(changes).length > 0;
  const problem = selected === null ? null : typeProblem(draft, types, typeof selected === 'number' ? selected : null);
  const notices = saveNotices(current, draft);
  const isNew = selected === 'new';
  const staffKind = draft.kind === 'STAFF';
  const uploaderChoices = settings?.kindUploaders[draft.kind] ?? [];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDocumentTypeSettings()
      .then(found => {
        if (cancelled) return;
        setSettings(found);
        if (!started.current && found.types.length) {
          started.current = true;
          setSelected(found.types[0].id);
          setDraft(draftFromType(found.types[0]));
        }
      })
      .catch(err => !cancelled && setError(errorText(err, 'Could not load the document types.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const guard = (action: () => void) => (dirty ? setPending(() => action) : action());

  const open = (id: number | 'new', show = true) => {
    const type = id === 'new' ? null : types.find(item => item.id === id) ?? null;
    setSelected(id);
    setDraft(type ? draftFromType(type) : { ...NEW_TYPE, uploaders: [...NEW_TYPE.uploaders] });
    setErrors({});
    setShowEditor(show);
  };

  const discard = (show: boolean) => {
    if (!isNew && selected !== null) open(selected, show);
    else if (types.length) open(types[0].id, show);
    else setSelected(null);
  };

  const change = (values: Partial<DocumentTypeInput>) => setDraft(currentDraft => ({ ...currentDraft, ...values }));

  const chooseKind = (kind: DocumentTypeKind) => change(kind === 'STAFF'
    ? { kind, uploaders: ['LECTURER', 'COORDINATOR'], shareSupervisors: false, sharePanel: false, shareCoordinator: false, onePerStudent: false }
    : { kind, uploaders: ['STUDENT'], shareSupervisors: true });

  const save = async () => {
    if (!dirty || problem || selected === null) return;
    setSaving(true);
    setErrors({});
    try {
      const saved = isNew ? await addDocumentType(draft) : await updateDocumentType(selected as number, changes);
      setSettings(found => found && {
        ...found,
        types: isNew ? [...found.types, saved] : found.types.map(type => (type.id === saved.id ? saved : type)),
      });
      setSelected(saved.id);
      setDraft(draftFromType(saved));
      setToast({ message: savedMessage(saved, isNew), tone: 'success' });
    } catch (err) {
      const fields = err instanceof ApiError && err.status === 400 ? fieldErrors(err) : {};
      if (Object.keys(fields).length) setErrors(fields);
      else setToast({ message: errorText(err, 'Could not save this type.'), tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const editor = selected !== null && (
    <section aria-labelledby="type-editor-title" className={`app-card ${showEditor ? '' : 'hidden lg:block'}`}>
      <div className="space-y-2 px-5 pb-5 pt-5 sm:px-6">
        <button type="button" className="back-link lg:hidden" onClick={() => guard(() => discard(false))}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All types
        </button>
        <h2 id="type-editor-title" className="sr-only">{isNew ? 'New type' : `Edit ${current?.label ?? 'type'}`}</h2>
        <label htmlFor="type-name" className="block text-[15px] font-extrabold text-brand-navy">Name</label>
        <input id="type-name" className="form-control form-control-md text-[14px]" maxLength={120} value={draft.label} placeholder="For example: AI Use Declaration" onChange={event => change({ label: event.target.value })} />
        {errors.label && <p className="text-[13px] font-semibold text-rose-700">{errors.label}</p>}
        {!isNew && <p className="text-[12px] text-slate-500">For {draft.kind === 'STAFF' ? 'staff files' : draft.kind === 'BOTH' ? 'files about students, or staff files' : 'files about students'}.</p>}
        <div className="space-y-1.5 pt-3">
          <span id="type-group-label" className="block text-[15px] font-extrabold text-brand-navy">Category</span>
          <SelectMenu<string>
            aria-label="Category"
            value={draft.group}
            options={(settings?.groups ?? []).map(group => ({ value: group.value, label: group.label }))}
            onChange={group => change({ group })}
          />
          <p className="text-[12px] text-slate-500">Every file of this type is tagged with its category, so people can find them together.</p>
        </div>
      </div>

      {isNew && (
        <Section title="What is it for?">
          <fieldset className="space-y-1">
            <legend className="sr-only">What is it for?</legend>
            {KIND_CHOICES.map(choice => (
              <label key={choice.value} className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2">
                <input type="radio" name="type-kind" className="mt-0.5 h-5 w-5 accent-brand-navy" checked={draft.kind === choice.value} onChange={() => chooseKind(choice.value)} />
                <span>
                  <span className="block text-[14px] font-bold text-slate-800">{choice.label}</span>
                  <span className="block text-[12px] text-slate-500">{choice.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Section>
      )}

      <Section title="Who can upload it?" id="type-uploaders">
        <div role="group" aria-labelledby="type-uploaders" className="flex flex-wrap gap-2">
          {uploaderChoices.map(role => (
            <Pill key={role} checked={draft.uploaders.includes(role)} onChange={() => change({ uploaders: toggled(draft.uploaders, role, uploaderChoices) })}>
              {UPLOADER_LABELS[role]}
            </Pill>
          ))}
        </div>
        <p className="text-[12px] text-slate-500">
          {staffKind ? 'The PG office can always upload.' : 'Staff upload for their own students only. The PG office can always upload.'}
        </p>
        {errors.uploaders && <p className="text-[13px] font-semibold text-rose-700">{errors.uploaders}</p>}
      </Section>

      <Section title="Who can see it?" id="type-viewers">
        {staffKind ? (
          <p className="text-[13px] text-slate-700">The uploader chooses when uploading: all lecturers and coordinators, coordinators only, or the PG office only.</p>
        ) : (
          <>
            <div role="group" aria-labelledby="type-viewers" className="flex flex-wrap gap-2">
              {SHARE_TICKS.map(tick => {
                const locked = tick.key === 'shareCoordinator' && draft.needsCheck;
                return (
                  <Pill key={tick.key} checked={draft[tick.key] || locked} disabled={locked} onChange={() => change({ [tick.key]: !draft[tick.key] })}>{tick.label}</Pill>
                );
              })}
            </div>
            <p className="text-[12px] text-slate-500">
              Of the students the file is about. The PG office sees everything, and students see their own uploads. Staff can change this when they upload.
              {draft.needsCheck ? ' The programme coordinator checks this type, so they always see it.' : ''}
            </p>
          </>
        )}
      </Section>

      {!staffKind && (
        <Section>
          <SwitchRow id="type-check" title="The programme coordinator checks it" hint={'Uploads wait in "To check" until the student\'s programme coordinator accepts or returns them.'} checked={draft.needsCheck} onChange={needsCheck => change(needsCheck ? { needsCheck, shareCoordinator: true } : { needsCheck })} />
        </Section>
      )}

      {!staffKind && (
        <Section>
          <SwitchRow id="type-required" title="Every student must hand it in" hint="It shows on each student's to do list and in Required documents." checked={draft.required} onChange={required => change({ required })} />
          {draft.required && (
            <div className="space-y-4 pt-2">
              <label className="block space-y-1.5">
                <span className="text-[13px] font-bold text-slate-700">Due note (optional)</span>
                <input className="form-control form-control-md text-[14px]" maxLength={120} value={draft.requiredDueNote} placeholder="For example: Due before Week 6" onChange={event => change({ requiredDueNote: event.target.value })} />
              </label>
              <div className="space-y-2">
                <p id="type-required-programmes" className="text-[13px] font-bold text-slate-700">Which programmes?</p>
                <div role="group" aria-labelledby="type-required-programmes" className="flex flex-wrap gap-2">
                  {(settings?.programmes ?? []).map(programme => (
                    <Pill key={programme} checked={draft.requiredProgrammes.includes(programme)} onChange={() => change({ requiredProgrammes: toggled(draft.requiredProgrammes, programme, settings?.programmes ?? []) })}>
                      {titleCase(programme)}
                    </Pill>
                  ))}
                </div>
                <p className="text-[12px] text-slate-500">Leave them all unticked for every programme. Only Active students have to hand it in.</p>
              </div>
            </div>
          )}
          {(errors.required || errors.requiredProgrammes || errors.requiredDueNote) && (
            <p className="text-[13px] font-semibold text-rose-700">{errors.required || errors.requiredProgrammes || errors.requiredDueNote}</p>
          )}
        </Section>
      )}

      <details className="group border-t border-slate-100">
        <summary className="cursor-pointer list-none px-5 py-4 text-[14px] font-bold text-blue-700 hover:text-blue-900 sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <ChevronRight className="h-4 w-4 transition group-open:rotate-90" aria-hidden="true" />
            More options
          </span>
        </summary>
        <div className="space-y-5 px-5 pb-5 sm:px-6">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-bold text-slate-700">Description</span>
            <input className="form-control form-control-md text-[14px]" maxLength={300} value={draft.description} placeholder="Shown under the name when choosing a type" onChange={event => change({ description: event.target.value })} />
            {errors.description && <span className="block text-[13px] font-semibold text-rose-700">{errors.description}</span>}
          </label>
          {!staffKind && draft.uploaders.includes('STUDENT') && (
            <SwitchRow id="type-one" title="One file per student" hint="A student's next upload becomes a new version of their file." checked={draft.onePerStudent} onChange={onePerStudent => change({ onePerStudent })} />
          )}
          <SwitchRow id="type-active" title="Can be chosen when uploading" hint="Switch it off to stop new uploads. Files already uploaded stay." checked={draft.isActive} onChange={isActive => change({ isActive })} />
        </div>
      </details>

      {notices.length > 0 && (
        <div className="space-y-1 border-t border-slate-100 bg-amber-50 px-5 py-3 text-[13px] font-semibold text-amber-900 sm:px-6">
          {notices.map(notice => <p key={notice}>{notice}</p>)}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
        {problem && draft.label.trim() && <p role="alert" className="mr-auto text-[13px] font-semibold text-rose-700">{problem}</p>}
        {dirty && <PortalButton disabled={saving} onClick={() => discard(!isNew)}>{isNew ? 'Cancel' : 'Undo changes'}</PortalButton>}
        <PortalButton variant="primary" isLoading={saving} disabled={!dirty || Boolean(problem)} onClick={() => void save()}>{isNew ? 'Add type' : 'Save'}</PortalButton>
      </div>
    </section>
  );

  return (
    <RecordPage
      title="File settings"
      subtitle="Who can upload and see each type of file, and which ones every student must hand in. Files are tagged automatically from each type's category."
      backLabel="Back to Files"
      onBack={onBack}
      dirty={dirty}
      busy={saving}
      actions={settings ? <PortalButton variant="primary" icon={Plus} onClick={() => open('new')}>Add a type</PortalButton> : undefined}
    >
      {loading && !settings ? (
        <LoadingState message="Loading document types..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section aria-label="Document types" className={`app-card overflow-hidden ${showEditor ? 'hidden lg:block' : ''}`}>
            {types.map(type => {
              const on = selected === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => (on ? setShowEditor(true) : guard(() => open(type.id)))}
                  className={`flex w-full items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 text-left first:border-t-0 ${on ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-bold text-brand-navy">{type.label}</span>
                      {!type.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">Switched off</span>}
                    </span>
                    <span className="block text-[12px] text-slate-500">{typeSummary(type)}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              );
            })}
            {isNew && (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-indigo-50 px-5 py-3.5">
                <span className="text-[14px] font-bold text-brand-navy">{draft.label.trim() || 'New type'}</span>
              </div>
            )}
          </section>
          {editor}
        </div>
      )}

      <PortalConfirmModal
        isOpen={pending !== null}
        title="Discard your changes?"
        message="Your changes to this type have not been saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => {
          const action = pending;
          setPending(null);
          action?.();
        }}
        onCancel={() => setPending(null)}
      />
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </RecordPage>
  );
};
