/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Upload one file. Students pick what it is from cards (the documents the office
// asked for first); staff pick the type and the students it is about. A summary
// beside the form says who will see the file and how the system will file it,
// before anything is sent. Nobody types tags.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Sparkles, Upload } from 'lucide-react';
import type { DocumentDetail, DocumentKind, DocumentOptions, DocumentSharing, MyRequiredDocument, StaffAudience, TaggableStudent } from '../types';
import { addDocumentVersion, getDocumentOptions, getMyRequiredDocuments, searchTaggableStudents, uploadConflict, uploadDocument } from '../services/filesApi';
import { ApiError, fieldErrors } from '../services/apiClient';
import { formatFileSize, requiredBadge } from '../utils/documentDisplay';
import { defaultSharing, STAFF_AUDIENCES, staffReach, staffTypeChoices, studentReach } from '../utils/documentSharing';
import { suggestTypeForFile, uploadTags } from '../utils/documentTags';
import { acceptAttribute, acceptedKinds, fileProblem, kindForName, kindsSentence, titleFromFileName } from '../utils/documentUpload';
import { PortalButton, PortalConfirmModal, StatusBadge } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { SelectMenu, SelectMenuOption } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';
import { AutoTagChips, KindBadge, StudentPicker } from './DocumentParts';

interface UploadNewDocumentProps {
  onBack: () => void;
  onUploadSuccess: (document: DocumentDetail) => void;
  isStudent?: boolean;
  role?: string;
  initialStudent?: string;
  initialType?: string;
  initialFile?: File | null;
  onOpenExisting?: (documentId: number) => void;
}

const Section: React.FC<{ title?: string; htmlFor?: string; children: React.ReactNode }> = ({ title, htmlFor, children }) => (
  <div className="space-y-3 px-5 py-5 sm:px-6">
    {title && (htmlFor ? <label htmlFor={htmlFor} className="block text-[15px] font-extrabold text-brand-navy">{title}</label> : <h2 className="text-[15px] font-extrabold text-brand-navy">{title}</h2>)}
    {children}
  </div>
);

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p role="alert" className="text-[13px] font-semibold text-rose-700">{message}</p> : null;

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const UploadNewDocument: React.FC<UploadNewDocumentProps> = ({
  onBack,
  onUploadSuccess,
  isStudent = false,
  role = '',
  initialStudent = '',
  initialType = '',
  initialFile = null,
  onOpenExisting,
}) => {
  const [options, setOptions] = useState<DocumentOptions | null>(null);
  const [owed, setOwed] = useState<MyRequiredDocument[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [file, setFile] = useState<File | null>(initialFile);
  const [dragging, setDragging] = useState(false);
  const [typeCode, setTypeCode] = useState('');
  const [suggested, setSuggested] = useState(false);
  const [students, setStudents] = useState<TaggableStudent[]>([]);
  const [staffFile, setStaffFile] = useState(false);
  const [share, setShare] = useState<DocumentSharing>({ supervisors: false, panel: false, coordinator: false });
  const [changingShare, setChangingShare] = useState(false);
  const [audience, setAudience] = useState<StaffAudience>('ACADEMIC');
  const [programme, setProgramme] = useState('');
  const [title, setTitle] = useState(initialFile ? titleFromFileName(initialFile.name) : '');
  const [titleEdited, setTitleEdited] = useState(false);
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
    Promise.all([getDocumentOptions(), isStudent ? getMyRequiredDocuments().catch(() => [] as MyRequiredDocument[]) : Promise.resolve([])])
      .then(([found, required]) => {
        if (cancelled) return;
        setOptions(found);
        setOwed(required);
        setSemester(found.currentSemester ? String(found.currentSemester.id) : 'none');
      })
      .catch(err => !cancelled && setLoadError(errorText(err, 'Could not load the upload form.')));
    return () => {
      cancelled = true;
    };
  }, [reload, isStudent]);

  useEffect(() => {
    if (isStudent || !initialStudent) return;
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
  }, [initialStudent, isStudent]);

  const types = useMemo(() => {
    if (!options) return [];
    if (isStudent) return options.types;
    return staffTypeChoices(options.types, { isOffice: options.isOffice, role, staffFile, students });
  }, [options, isStudent, role, staffFile, students]);
  const type = types.find(item => item.code === typeCode) ?? null;

  useEffect(() => {
    if (typeCode && !types.some(item => item.code === typeCode)) setTypeCode('');
  }, [types, typeCode]);

  const chooseType = (code: string, bySuggestion = false) => {
    setTypeCode(code);
    setSuggested(bySuggestion);
    setShare(defaultSharing(types.find(item => item.code === code)));
    setChangingShare(false);
    setErrors(current => ({ ...current, type: '', file: '' }));
    setExisting(null);
  };

  // A type asked for in the address (a To do item or a reminder) is chosen first;
  // otherwise a file that arrived with the page can suggest one.
  const preset = useRef(false);
  useEffect(() => {
    if (preset.current || !types.length) return;
    preset.current = true;
    if (initialType && types.some(item => item.code === initialType)) chooseType(initialType);
    else if (initialFile) {
      const guess = suggestTypeForFile(initialFile.name, types);
      if (guess) chooseType(guess.code, true);
    }
  }, [types, initialType, initialFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseFile = (chosen: File | null) => {
    setFile(chosen);
    setExisting(null);
    setErrors(current => ({ ...current, file: '' }));
    if (chosen && !titleEdited) setTitle(titleFromFileName(chosen.name));
    if (chosen && !typeCode) {
      const guess = suggestTypeForFile(chosen.name, types);
      if (guess) chooseType(guess.code, true);
    }
  };

  const staff = !isStudent;
  const maxBytes = options?.maxBytes ?? 10 * 1024 * 1024;
  const clientProblem = file ? fileProblem(file, type, staff, maxBytes) : null;
  const dirty = Boolean(file || typeCode || students.length || description.trim() || titleEdited);

  const submit = async (acknowledgeWarnings = false) => {
    const found: Record<string, string> = {};
    const problem = fileProblem(file, type, staff, maxBytes);
    if (!type) found.type = isStudent ? 'Choose what you are uploading.' : 'Choose what this file is.';
    if (problem) found.file = problem;
    if (staff && !staffFile && !students.length) found.students = 'Add at least one student, or upload it as a staff file.';
    setErrors(found);
    setBanner(null);
    if (Object.keys(found).length || !file || !type) return;
    setSubmitting(true);
    try {
      const document = await uploadDocument({
        file,
        type: type.code,
        title,
        description,
        semester: isStudent ? '' : semester,
        students: staffFile || isStudent ? [] : students.map(student => student.matric),
        share: staff && !staffFile ? share : undefined,
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

  const kinds = acceptedKinds(type, staff);
  const fallbackKinds: DocumentKind[] = staff ? ['PDF', 'DOCX', 'IMAGE', 'XLSX', 'PPTX'] : ['PDF', 'DOCX', 'IMAGE'];
  const owedCodes = new Map(owed.map(item => [item.code, item]));
  const askedFor = types.filter(item => owedCodes.has(item.code));
  const others = types.filter(item => !owedCodes.has(item.code));
  const semesterLabel = isStudent
    ? options?.currentSemester?.label ?? null
    : semester === 'none' ? null : options?.semesters?.find(item => String(item.id) === semester)?.label ?? null;
  const filedUnder = uploadTags({
    type,
    semester: semesterLabel,
    role: isStudent ? 'Student' : role,
    programmes: isStudent ? [options?.me?.programme ?? ''] : staffFile ? [programme] : students.map(student => student.programme),
    intakes: isStudent ? [options?.me?.intake ?? ''] : staffFile ? [] : students.map(student => student.intake ?? ''),
  });
  const reach = !type
    ? []
    : isStudent
      ? studentReach(type, options?.me)
      : staffFile
        ? audience === 'OFFICE'
          ? ['The PG office']
          : ['The PG office', `${STAFF_AUDIENCES.find(item => item.value === audience)?.label ?? ''}${programme ? ` in ${programme}` : ''}`]
        : staffReach(share, students);

  const typeCard = (item: (typeof types)[number]) => {
    const asked = owedCodes.get(item.code);
    const chosen = item.code === typeCode;
    return (
      <label
        key={item.code}
        className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-navy ${chosen ? 'border-brand-navy bg-slate-50 ring-1 ring-brand-navy' : 'border-slate-200 bg-white hover:border-slate-300'}`}
      >
        <input type="radio" name="document-type" value={item.code} checked={chosen} onChange={() => chooseType(item.code)} className="sr-only" />
        <span className="flex items-start justify-between gap-2">
          <span className="text-[13.5px] font-bold text-brand-navy">{item.label}</span>
          {asked && <StatusBadge tone={requiredBadge(asked.state).tone} dot className="shrink-0">{requiredBadge(asked.state).label}</StatusBadge>}
        </span>
        <span className="text-[12px] leading-snug text-slate-500">{asked?.dueNote || item.description || item.groupLabel}</span>
      </label>
    );
  };

  return (
    <RecordPage
      title="Upload a file"
      subtitle={isStudent ? 'Send a document to the PG office.' : 'Add an official document about your students, or a file for staff.'}
      backLabel={isStudent ? 'Back to File Submission' : 'Back to Files'}
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
          className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]"
          noValidate
          onSubmit={event => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="app-card divide-y divide-slate-100">
            {banner && (
              <div role="alert" className="flex items-start gap-3 bg-rose-50 px-6 py-4 text-[14px] font-semibold text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {banner}
              </div>
            )}

            {isStudent ? (
              <Section>
                <fieldset className="space-y-4">
                  <legend className="text-[15px] font-extrabold text-brand-navy">1. What are you uploading?</legend>
                  {!types.length && <p className="text-[13px] text-slate-600">There is nothing you can upload here right now. Contact the PG office.</p>}
                  {askedFor.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Asked for by the office</p>
                      <div className="grid gap-2.5 sm:grid-cols-2">{askedFor.map(typeCard)}</div>
                    </div>
                  )}
                  {others.length > 0 && (
                    <div className="space-y-2">
                      {askedFor.length > 0 && <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Other documents</p>}
                      <div className="grid gap-2.5 sm:grid-cols-2">{others.map(typeCard)}</div>
                    </div>
                  )}
                </fieldset>
                {suggested && type && (
                  <p className="flex items-center gap-2 text-[12.5px] font-semibold text-blue-800">
                    <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Picked "{type.label}" from the file name. Choose another card if that is wrong.
                  </p>
                )}
                <FieldError message={errors.type} />
              </Section>
            ) : (
              <Section title="What is it?">
                <SelectMenu<string>
                  aria-label="What is it?"
                  value={typeCode}
                  options={types.map((item): SelectMenuOption<string> => ({ value: item.code, label: item.label, description: item.description || item.groupLabel, triggerLabel: item.label }))}
                  placeholder={types.length ? 'Choose one' : 'No types you can upload here'}
                  onChange={code => chooseType(code)}
                  disabled={!types.length}
                />
                {suggested && type && (
                  <p className="flex items-center gap-2 text-[12.5px] font-semibold text-blue-800">
                    <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Picked from the file name. Change it if that is wrong.
                  </p>
                )}
                <FieldError message={errors.type} />
              </Section>
            )}

            {existing && (
              <div role="alert" className="mx-5 my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900 sm:mx-6">
                <span>{existing.detail}</span>
                <span className="flex flex-wrap gap-2">
                  {existing.id && onOpenExisting && <PortalButton size="sm" type="button" onClick={() => onOpenExisting(existing.id!)}>Open it</PortalButton>}
                  {existing.id && file && <PortalButton size="sm" type="button" variant="primary" isLoading={submitting} onClick={() => void addAsVersion(existing.id!)}>Add as a new version</PortalButton>}
                </span>
              </div>
            )}

            <Section title={isStudent ? '2. Add the file' : 'The file'}>
              <input
                ref={fileInput}
                id="document-file"
                type="file"
                className="sr-only"
                accept={acceptAttribute(kinds.length ? kinds : fallbackKinds)}
                onChange={event => chooseFile(event.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <KindBadge kind={kindForName(file.name)} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-brand-navy">{file.name}</p>
                      <p className="text-[12px] text-slate-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <PortalButton size="sm" type="button" onClick={() => fileInput.current?.click()}>Change file</PortalButton>
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
                  className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${dragging ? 'border-brand-navy bg-indigo-50' : 'border-slate-300 bg-slate-50'}`}
                >
                  <Upload className="h-7 w-7 text-slate-400" aria-hidden="true" />
                  <p className="text-[14px] font-bold text-brand-navy">Drag your file here</p>
                  <PortalButton size="sm" type="button" onClick={() => fileInput.current?.click()}>Browse</PortalButton>
                  <p className="text-[12px] text-slate-500">
                    {type ? `${type.label}: ${kindsSentence(kinds)}, up to ${formatFileSize(maxBytes)}` : `PDF, Word or a photo${staff ? ', Excel or PowerPoint' : ''}, up to ${formatFileSize(maxBytes)}`}
                  </p>
                </div>
              )}
              <FieldError message={errors.file || clientProblem || undefined} />
            </Section>

            {staff && (
              staffFile ? (
                <Section title="Who can see it?">
                  <p className="text-[13px] text-slate-600">A staff file is not about any student. Students never see it; to send a file to students, use an announcement.</p>
                  <fieldset className="space-y-1">
                    <legend className="sr-only">Who can see it</legend>
                    {STAFF_AUDIENCES.map(item => (
                      <label key={item.value} className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2.5">
                        <input type="radio" name="audience" className="mt-0.5 h-5 w-5 accent-brand-navy" checked={audience === item.value} onChange={() => setAudience(item.value)} />
                        <span>
                          <span className="block text-[14px] font-bold text-slate-800">{item.label}</span>
                          <span className="block text-[12px] text-slate-500">{item.hint}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
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
                  <button type="button" className="text-[13px] font-bold text-blue-700 hover:text-blue-900" onClick={() => setStaffFile(false)}>
                    It is about a student after all
                  </button>
                </Section>
              ) : (
                <Section title="Which students is it about?" htmlFor="document-students">
                  <StudentPicker inputId="document-students" picked={students} onChange={setStudents} />
                  <FieldError message={errors.students} />
                  <button type="button" className="text-[13px] font-bold text-blue-700 hover:text-blue-900" onClick={() => setStaffFile(true)}>
                    Not about a student? Upload it as a staff file
                  </button>
                </Section>
              )
            )}

            <Section>
              <button type="button" aria-expanded={moreOpen} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-blue-700 hover:text-blue-900" onClick={() => setMoreOpen(open => !open)}>
                {moreOpen ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                {moreOpen ? 'Fewer options' : staff ? 'Title, semester or a note' : 'Change the title, or add a note for the office'}
              </button>
              {moreOpen && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="document-title" className="block text-[13px] font-bold text-slate-700">Title</label>
                    <input id="document-title" className="form-control form-control-md text-[14px]" value={title} maxLength={200} placeholder="Filled in from the file name" onChange={event => {
                      setTitle(event.target.value);
                      setTitleEdited(true);
                    }} />
                    <FieldError message={errors.title} />
                  </div>
                  {staff && (
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
                  )}
                  <div className="space-y-1.5">
                    <label htmlFor="document-note" className="block text-[13px] font-bold text-slate-700">{staff ? 'Note' : 'Note for the office'}</label>
                    <textarea id="document-note" className="form-control min-h-24 px-3.5 py-3 text-[14px]" maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Anything people should know about this file" />
                    <FieldError message={errors.description} />
                  </div>
                </div>
              )}
            </Section>
          </div>

          <aside aria-label="Before you upload" className="app-card space-y-4 p-5 lg:sticky lg:top-24">
            <h2 className="section-label">Before you upload</h2>
            {!type ? (
              <p className="text-[13px] text-slate-500">{isStudent ? 'Choose what you are uploading to see who will see it and how it is filed.' : 'Choose what the file is to see who will see it and how it is filed.'}</p>
            ) : (
              <dl className="space-y-4 text-[13px]">
                <div className="space-y-1">
                  <dt className="font-bold text-slate-800">Who will see it</dt>
                  <dd>
                    <ul className="space-y-0.5 text-slate-600">{reach.map(line => <li key={line}>{line}</li>)}</ul>
                    {staff && !staffFile && (
                      <button type="button" aria-expanded={changingShare} className="mt-1.5 text-[12.5px] font-bold text-blue-700 hover:text-blue-900" onClick={() => setChangingShare(open => !open)}>
                        {changingShare ? 'Done' : 'Change'}
                      </button>
                    )}
                    {staff && !staffFile && changingShare && (
                      <fieldset className="mt-2 space-y-1 rounded-xl bg-slate-50 p-3">
                        <legend className="sr-only">Share with</legend>
                        {([
                          ['supervisors', 'Supervisors'],
                          ['panel', 'Panel member'],
                          ['coordinator', 'Programme coordinator'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px] font-semibold text-slate-700">
                            <input type="checkbox" className="h-4 w-4 accent-brand-navy" checked={share[key]} onChange={() => setShare(current => ({ ...current, [key]: !current[key] }))} />
                            {label}
                          </label>
                        ))}
                        <p className="pt-1 text-[11.5px] text-slate-500">The PG office always sees uploads. Students never see staff uploads.</p>
                      </fieldset>
                    )}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="font-bold text-slate-800">What happens next</dt>
                  <dd className="text-slate-600">
                    {type.needsCheck && !options.isOffice
                      ? isStudent ? 'The office checks it and tells you when it is accepted, or what to fix.' : 'The office checks it before it counts as handed in.'
                      : 'It is filed straight away.'}
                  </dd>
                </div>
                <div className="space-y-1.5">
                  <dt className="font-bold text-slate-800">Filed under</dt>
                  <dd><AutoTagChips tags={filedUnder} /></dd>
                </div>
              </dl>
            )}
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
              <PortalButton type="submit" variant="primary" icon={Upload} isLoading={submitting}>Upload</PortalButton>
              <PortalButton type="button" variant="ghost" onClick={onBack} disabled={submitting}>Cancel</PortalButton>
            </div>
          </aside>
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
