/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Staff upload one file: about students or for staff, what it is, and the file.
// Students send theirs from their Documents list instead.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import type { DocumentDetail, DocumentKind, DocumentOptions, StaffAudience, TaggableStudent } from '../types';
import { addDocumentVersion, getDocumentOptions, searchTaggableStudents, uploadConflict, uploadDocument } from '../services/filesApi';
import { ApiError, fieldErrors } from '../services/apiClient';
import { formatFileSize } from '../utils/documentDisplay';
import { defaultSharing, STAFF_AUDIENCES, staffReach, staffTypeChoices } from '../utils/documentSharing';
import { suggestTypeForFile } from '../utils/documentTags';
import { acceptAttribute, acceptedKinds, fileProblem, kindForName, kindsSentence, nameAsTitle, titleFromFileName, typeForName } from '../utils/documentUpload';
import { PortalButton, PortalConfirmModal } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';
import { KindBadge, StudentPicker } from './DocumentParts';

interface UploadNewDocumentProps {
  onBack: () => void;
  onUploadSuccess: (document: DocumentDetail) => void;
  role?: string;
  initialStudent?: string;
  initialType?: string;
  initialFile?: File | null;
  onOpenExisting?: (documentId: number) => void;
}

type Audience = 'students' | 'staff';

const Field: React.FC<{ label: string; htmlFor?: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div className="space-y-2.5">
    {htmlFor ? (
      <label htmlFor={htmlFor} className="block text-[14px] font-bold text-brand-navy">{label}</label>
    ) : (
      <p className="text-[14px] font-bold text-brand-navy">{label}</p>
    )}
    {children}
  </div>
);

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p role="alert" className="text-[13px] font-semibold text-rose-700">{message}</p> : null;

const Choice: React.FC<{ selected: boolean; onSelect: () => void; children: React.ReactNode }> = ({ selected, onSelect, children }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    className={`min-h-11 rounded-xl border px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${selected ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
  >
    {children}
  </button>
);

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const UploadNewDocument: React.FC<UploadNewDocumentProps> = ({
  onBack,
  onUploadSuccess,
  role = '',
  initialStudent = '',
  initialType = '',
  initialFile = null,
  onOpenExisting,
}) => {
  const [options, setOptions] = useState<DocumentOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [file, setFile] = useState<File | null>(initialFile);
  const [dragging, setDragging] = useState(false);
  const [what, setWhat] = useState('');
  const [students, setStudents] = useState<TaggableStudent[]>([]);
  const [staffFile, setStaffFile] = useState(false);
  const [audience, setAudience] = useState<StaffAudience>('ACADEMIC');
  const [programme, setProgramme] = useState('');
  const [semester, setSemester] = useState('');
  const [description, setDescription] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [existing, setExisting] = useState<{ detail: string; id?: number } | null>(null);
  const [duplicate, setDuplicate] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const done = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getDocumentOptions()
      .then(found => {
        if (cancelled) return;
        setOptions(found);
        setSemester(found.currentSemester ? String(found.currentSemester.id) : 'none');
      })
      .catch(err => !cancelled && setLoadError(errorText(err, 'Could not load the upload form.')));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!initialStudent) return;
    let cancelled = false;
    searchTaggableStudents(initialStudent)
      .then(found => {
        const match = found.find(student => student.matric.toLowerCase() === initialStudent.toLowerCase());
        if (!cancelled && match) setStudents(current => (current.length ? current : [match]));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialStudent]);

  const types = useMemo(
    () => (options ? staffTypeChoices(options.types, { isOffice: options.isOffice, role, staffFile, students }) : []),
    [options, role, staffFile, students],
  );
  const type = typeForName(what, types);
  const nameFor = (chosen: File) => {
    const guess = suggestTypeForFile(chosen.name, types.filter(item => item.group !== 'SUPPORTING' && item.group !== 'STAFF'));
    return guess?.label ?? titleFromFileName(chosen.name);
  };

  // A type asked for in the address names the file first; otherwise a file that
  // arrived with the page names it.
  const preset = useRef(false);
  useEffect(() => {
    if (preset.current || !types.length) return;
    preset.current = true;
    const asked = types.find(item => item.code === initialType);
    if (asked) setWhat(asked.label);
    else if (initialFile) setWhat(nameFor(initialFile));
  }, [types, initialType, initialFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseFile = (chosen: File | null) => {
    setFile(chosen);
    setExisting(null);
    setErrors(current => ({ ...current, file: '' }));
    if (chosen && !what.trim()) setWhat(nameFor(chosen));
  };

  const chooseAudience = (next: Audience) => {
    setStaffFile(next === 'staff');
    setErrors(current => ({ ...current, students: '', what: '' }));
  };

  const maxBytes = options?.maxBytes ?? 10 * 1024 * 1024;
  const clientProblem = file ? fileProblem(file, type, true, maxBytes) : null;
  const dirty = Boolean(file || what.trim() || students.length || description.trim());

  const submit = async (acknowledgeWarnings = false) => {
    const found: Record<string, string> = {};
    const problem = fileProblem(file, type, true, maxBytes);
    if (!types.length) found.what = 'You cannot upload a file for these students.';
    else if (!what.trim()) found.what = 'Say what this file is.';
    else if (!type) found.what = `Choose one of: ${types.map(item => item.label).join(', ')}.`;
    if (problem) found.file = problem;
    if (!staffFile && !students.length) found.students = 'Add at least one student.';
    setErrors(found);
    setBanner(null);
    if (Object.keys(found).length || !file || !type) return;
    setSubmitting(true);
    try {
      const document = await uploadDocument({
        file,
        type: type.code,
        title: nameAsTitle(what, type),
        description,
        semester,
        students: staffFile ? [] : students.map(student => student.matric),
        audience: staffFile ? audience : undefined,
        programmes: staffFile && programme ? [programme] : [],
        acknowledgeWarnings,
      });
      done.current = true;
      onUploadSuccess(document);
    } catch (err) {
      const conflict = uploadConflict(err);
      if (conflict?.code === 'already_have_one') {
        setExisting({ detail: conflict.detail, id: conflict.existingDocumentId });
      } else if (conflict) {
        setDuplicate(conflict.warnings.length ? conflict.warnings : [conflict.detail]);
      } else if (err instanceof ApiError && err.status === 400) {
        setErrors(fieldErrors(err));
      } else {
        setBanner(errorText(err, 'Could not upload the file. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const addAsVersion = async (documentId: number) => {
    if (!file) return;
    setSubmitting(true);
    try {
      const document = await addDocumentVersion(documentId, file, description);
      done.current = true;
      onUploadSuccess(document);
    } catch (err) {
      setBanner(errorText(err, 'Could not add the new version.'));
    } finally {
      setSubmitting(false);
    }
  };

  const kinds = acceptedKinds(type, true);
  const fallbackKinds: DocumentKind[] = ['PDF', 'DOCX', 'IMAGE', 'XLSX', 'PPTX'];
  const reach = !type
    ? []
    : staffFile
      ? ['The PG office', ...(audience === 'OFFICE' ? [] : [`${STAFF_AUDIENCES.find(item => item.value === audience)?.label ?? ''}${programme ? ` in ${programme}` : ''}`])]
      : students.length
        ? staffReach(defaultSharing(type), students).filter(line => !line.startsWith('No '))
        : [];

  return (
    <RecordPage
      title="Upload a file"
      backLabel="Back to Files"
      onBack={onBack}
      dirty={dirty}
      busy={submitting}
      navigationComplete={done}
    >
      {loadError ? (
        <ErrorState message={loadError} onRetry={() => setReload(value => value + 1)} />
      ) : !options ? (
        <LoadingState message="Loading the upload form..." />
      ) : (
        <form
          className="max-w-3xl"
          noValidate
          onSubmit={event => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="app-card overflow-hidden">
            {banner && (
              <div role="alert" className="flex items-start gap-3 bg-rose-50 px-6 py-4 text-[14px] font-semibold text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {banner}
              </div>
            )}

            <div className="space-y-7 px-5 py-6 sm:px-7">
              <div role="radiogroup" aria-label="What kind of file" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-grid">
                {([['students', 'About students'], ['staff', 'Staff file']] as const).map(([value, label]) => {
                  const selected = (value === 'staff') === staffFile;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => chooseAudience(value)}
                      className={`min-h-10 rounded-lg px-5 text-[13.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${selected ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-brand-navy'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {staffFile ? (
                <Field label="Who can see it">
                  <div role="radiogroup" aria-label="Who can see it" className="flex flex-wrap gap-2">
                    {STAFF_AUDIENCES.map(item => (
                      <Choice key={item.value} selected={audience === item.value} onSelect={() => setAudience(item.value)}>{item.label}</Choice>
                    ))}
                  </div>
                  {audience !== 'OFFICE' && (
                    <SelectMenu<string>
                      aria-label="Programme"
                      variant="filter"
                      prefix="Programme"
                      value={programme}
                      options={[{ value: '', label: 'All programmes', triggerLabel: 'All' }, ...(options.programmes ?? []).map(item => ({ value: item, label: item }))]}
                      onChange={setProgramme}
                    />
                  )}
                </Field>
              ) : (
                <Field label="Students" htmlFor="document-students">
                  <StudentPicker inputId="document-students" picked={students} onChange={setStudents} />
                  <FieldError message={errors.students} />
                </Field>
              )}

              {types.length ? (
                <Field label="What is it?" htmlFor="document-what">
                  <input
                    id="document-what"
                    list={types.length > 1 ? 'document-kinds' : undefined}
                    autoComplete="off"
                    className="form-control form-control-md text-[14px]"
                    maxLength={200}
                    value={what}
                    onChange={event => {
                      setWhat(event.target.value);
                      setExisting(null);
                      setErrors(current => ({ ...current, what: '', title: '', type: '', file: '' }));
                    }}
                  />
                  {types.length > 1 && (
                    <datalist id="document-kinds">
                      {types.map(item => <option key={item.code} value={item.label} />)}
                    </datalist>
                  )}
                  <FieldError message={errors.what || errors.title || errors.type} />
                </Field>
              ) : (
                <p className="text-[13.5px] font-semibold text-rose-700">You cannot upload a file for these students.</p>
              )}

              <Field label="File">
                <input
                  ref={fileInput}
                  id="document-file"
                  type="file"
                  className="sr-only"
                  accept={acceptAttribute(kinds.length ? kinds : fallbackKinds)}
                  onChange={event => chooseFile(event.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <KindBadge kind={kindForName(file.name)} />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-brand-navy">{file.name}</p>
                        <p className="text-[12px] text-slate-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <PortalButton size="sm" type="button" onClick={() => fileInput.current?.click()}>Change</PortalButton>
                  </div>
                ) : (
                  <div
                    onDragOver={event => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={event => {
                      event.preventDefault();
                      setDragging(false);
                      chooseFile(event.dataTransfer.files?.[0] ?? null);
                    }}
                    className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors sm:flex-row ${dragging ? 'border-brand-navy bg-indigo-50' : 'border-slate-300 bg-slate-50'}`}
                  >
                    <Upload className="h-6 w-6 text-slate-400" aria-hidden="true" />
                    <span className="text-[14px] font-semibold text-slate-700">Drag a file here or</span>
                    <PortalButton size="sm" type="button" onClick={() => fileInput.current?.click()}>Browse</PortalButton>
                  </div>
                )}
                <p className="text-[12.5px] text-slate-500">{type ? `${kindsSentence(kinds)}, up to ${formatFileSize(maxBytes)}` : `PDF, Word, a photo, Excel or PowerPoint, up to ${formatFileSize(maxBytes)}`}</p>
                <FieldError message={errors.file || clientProblem || undefined} />
              </Field>

              {existing && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900">
                  <span>{existing.detail}</span>
                  <span className="flex flex-wrap gap-2">
                    {existing.id && onOpenExisting && <PortalButton size="sm" type="button" onClick={() => onOpenExisting(existing.id!)}>Open it</PortalButton>}
                    {existing.id && file && <PortalButton size="sm" type="button" variant="primary" isLoading={submitting} onClick={() => void addAsVersion(existing.id!)}>Add as a new version</PortalButton>}
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <button type="button" aria-expanded={moreOpen} className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-blue-700 hover:text-blue-900" onClick={() => setMoreOpen(open => !open)}>
                  {moreOpen ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                  Semester or a note
                </button>
                {moreOpen && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <span className="block text-[13px] font-bold text-slate-700">Semester</span>
                      <SelectMenu<string>
                        aria-label="Semester"
                        value={semester}
                        options={[...(options.semesters ?? []).map(item => ({ value: String(item.id), label: item.label })), { value: 'none', label: 'Not linked to a semester' }]}
                        onChange={setSemester}
                      />
                      <FieldError message={errors.semester} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="document-note" className="block text-[13px] font-bold text-slate-700">Note</label>
                      <textarea id="document-note" className="form-control min-h-24 px-3.5 py-3 text-[14px]" maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} />
                      <FieldError message={errors.description} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="min-w-0 text-[12.5px] text-slate-500">{reach.length ? `Seen by ${reach.join(', ')}` : ''}</p>
              <div className="flex shrink-0 gap-2">
                <PortalButton type="button" variant="ghost" onClick={onBack} disabled={submitting}>Cancel</PortalButton>
                <PortalButton type="submit" variant="primary" icon={Upload} isLoading={submitting}>Upload</PortalButton>
              </div>
            </div>
          </div>
        </form>
      )}
      <PortalConfirmModal
        isOpen={duplicate !== null}
        title="Upload this file again?"
        message={<div className="space-y-2">{(duplicate ?? []).map(line => <p key={line}>{line}</p>)}<p>Upload it anyway?</p></div>}
        confirmLabel="Upload anyway"
        cancelLabel="Cancel"
        isLoading={submitting}
        onConfirm={() => {
          setDuplicate(null);
          void submit(true);
        }}
        onCancel={() => setDuplicate(null)}
      />
    </RecordPage>
  );
};
