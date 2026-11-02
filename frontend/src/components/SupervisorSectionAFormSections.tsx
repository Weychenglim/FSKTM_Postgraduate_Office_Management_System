import React, { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { SupervisorCourseResult, SupervisorStudentParticularsData, SupervisorTitleOrigin } from '../types/supervisorSectionA';
import { appointmentDetailTypography as typography } from './AppointmentPrimitives';
import { PortalButton } from './PortalPrimitives';
import { serializeProjectCourseCodes, validateProjectCourseCodes } from '../utils/projectCourseCodes';

const sectionClass = 'application-section scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5';
export type ApplicationControlError = { field?: string; message: string } | null;

export function ApplicationRequiredMark() {
  return <><span className="text-rose-600" aria-hidden="true">*</span><span className="sr-only"> (required)</span></>;
}

export function ApplicationFieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="mt-2 text-xs text-rose-700">{message}</p> : null;
}

export function SupervisorStudentParticulars({ particulars, correctionGuidance = false }: {
  particulars: SupervisorStudentParticularsData; correctionGuidance?: boolean;
}) {
  const fields = [
    ['Name', particulars.name], ['Student ID', particulars.studentId], ['Programme', particulars.programme],
    ['Application semester/session', particulars.semester], ['Identity type', particulars.identityType],
    ['NRIC/passport number', particulars.identityNumber], ['Email', particulars.email],
    ['Phone', particulars.phone], ['Address', particulars.address],
  ];
  return <div className="space-y-4" data-student-particulars>
    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([label, value]) => <div key={label} className={label === 'Address' ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <dt className={typography.label}>{label}</dt>
      <dd className={`${typography.body} mt-1 whitespace-pre-wrap break-words`}>{value?.trim() || 'Not recorded'}</dd>
    </div>)}</dl>
    {correctionGuidance ? <p className="text-xs text-slate-500">Academic or identity details incorrect? Contact the Postgraduate Office.</p> : null}
  </div>;
}

export function ProjectCourseCodeEntries({ entries, onChange, disabled = false, serverError }: {
  entries: string[]; onChange: (entries: string[]) => void; disabled?: boolean; serverError?: string;
}) {
  const [touched, setTouched] = useState(false);
  const value = serializeProjectCourseCodes(entries);
  const error = serverError || (touched || value ? validateProjectCourseCodes(entries) : null);
  return <div className="max-w-xl space-y-2">
    <label className="card-label block" htmlFor="project-course-codes-input">Project course code <ApplicationRequiredMark /></label>
    <input id="project-course-codes-input" type="text" maxLength={255} required disabled={disabled}
      className="form-control form-control-md" value={value} placeholder="e.g. WQD7002"
      aria-invalid={Boolean(error)} aria-describedby={error ? 'project-course-codes-error' : undefined}
      onBlur={() => setTouched(true)}
      onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
      onChange={event => onChange([event.target.value])} />
    {error ? <p id="project-course-codes-error" role="alert" className="text-xs text-rose-700">{error}</p> : null}
  </div>;
}

export function ResearchTitleOriginFields({ value, onChange, disabled = false, error }: {
  value: SupervisorTitleOrigin | ''; onChange: (value: SupervisorTitleOrigin) => void; disabled?: boolean; error?: string;
}) {
  return <fieldset className="space-y-2" disabled={disabled}>
    <legend className="card-label block mb-2">Title proposed by <ApplicationRequiredMark /></legend>
    <div className="flex flex-wrap gap-x-6 gap-y-2">{(['STUDENT', 'SUPERVISOR'] as const).map(origin => <label key={origin} className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-slate-800">
      <input id={`research-title-origin-${origin}`} type="radio" name="research-title-origin" value={origin} checked={value === origin} onChange={() => onChange(origin)} required aria-invalid={Boolean(error)} aria-describedby={error ? 'research-title-origin-error' : undefined} className="h-4 w-4 accent-indigo-600" />
      {origin === 'STUDENT' ? 'Me' : 'My supervisor'}
    </label>)}</div>
    <ApplicationFieldError id="research-title-origin-error" message={error} />
  </fieldset>;
}

export function CoursesTakenSection({ rows, noCoursesTaken, onRowsChange, onNoCoursesTakenChange, disabled = false, error }: {
  rows: SupervisorCourseResult[]; noCoursesTaken: boolean; onRowsChange: (rows: SupervisorCourseResult[]) => void;
  onNoCoursesTakenChange: (value: boolean) => void; disabled?: boolean; error?: ApplicationControlError;
}) {
  // Hidden rows remain a local draft until the student restores or explicitly discards them.
  const [answer, setAnswer] = useState<'yes' | 'no' | ''>(noCoursesTaken ? 'no' : rows.length ? 'yes' : '');
  const [savedRows, setSavedRows] = useState<SupervisorCourseResult[]>([]);
  const focusAdded = useRef(false);
  const choose = (next: 'yes' | 'no') => {
    setAnswer(next);
    if (next === 'no') {
      setSavedRows(rows); onRowsChange([]); onNoCoursesTakenChange(true);
    } else {
      onNoCoursesTakenChange(false);
      if (!rows.length) onRowsChange(savedRows.length ? savedRows : [{ courseName: '', courseCode: '', semesterSession: '', grade: '' }]);
      setSavedRows([]);
    }
  };
  return <section id="courses-taken" className={sectionClass} aria-labelledby="courses-taken-title">
    <h3 id="courses-taken-title" tabIndex={-1} className={typography.heading}>Courses taken</h3>
    <fieldset disabled={disabled}>
      <legend className="card-label block mb-2">Have you completed any courses? <ApplicationRequiredMark /></legend>
      <div className="flex gap-6">{(['yes', 'no'] as const).map(choice => <label key={choice} className="flex min-h-11 cursor-pointer items-center gap-2 text-xs">
        <input id={`completed-courses-${choice}`} type="radio" name="completed-courses" value={choice} required checked={answer === choice} onChange={() => choose(choice)} aria-invalid={Boolean(error && (!error.field || error.field.startsWith('completed-courses-')))} aria-describedby={error && (!error.field || error.field.startsWith('completed-courses-')) ? 'completed-courses-error' : undefined} className="h-4 w-4 accent-indigo-600" />{choice === 'yes' ? 'Yes' : 'No'}
      </label>)}</div>
      <ApplicationFieldError id="completed-courses-error" message={error && (!error.field || error.field.startsWith('completed-courses-')) ? error.message : undefined} />
    </fieldset>
    {answer === 'no' ? <div className="space-y-2 text-xs text-slate-500">
      <p>No completed courses to declare.</p>
      {savedRows.length ? <div className="flex flex-wrap items-center gap-3" role="status"><span>Your course entries are kept until you leave or submit.</span><PortalButton disabled={disabled} onClick={() => choose('yes')}>Restore entries</PortalButton><PortalButton disabled={disabled} variant="danger" onClick={() => setSavedRows([])}>Discard entries</PortalButton></div> : null}
    </div> : null}
    {answer === 'yes' ? <>
      <p className="text-xs text-slate-500">Enter grades as shown on your results statement.</p>
      <div className="divide-y divide-slate-200">{rows.map((row, index) => <fieldset key={index} disabled={disabled} className="space-y-3 py-5 first:pt-0">
        <legend className="sr-only">Course {index + 1}</legend>
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-800">Course {index + 1}</p>
          <PortalButton variant="danger" icon={Trash2} aria-label={`Remove course ${index + 1}`} onClick={() => onRowsChange(rows.filter((_, itemIndex) => itemIndex !== index))}>Remove</PortalButton>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1.3fr_0.8fr]">{([
          ['courseName', 'Course name', 255, 'e.g. Research methods'], ['courseCode', 'Course code', 64, 'e.g. WQD7001'],
          ['semesterSession', 'Semester/session', 64, 'e.g. S1 2026/2027'], ['grade', 'Grade', 32, 'e.g. A'],
        ] as const).map(([field, label, maxLength, placeholder]) => <div key={field} className="min-w-0 space-y-2">
          <label className="card-label block" htmlFor={`course-${index}-${field}`}>{label} <ApplicationRequiredMark /></label>
          <input id={`course-${index}-${field}`} className="form-control form-control-md" type="text" required maxLength={maxLength} placeholder={placeholder} value={row[field]}
            aria-invalid={error?.field === `course-${index}-${field}`} aria-describedby={error?.field === `course-${index}-${field}` ? `course-${index}-${field}-error` : undefined}
            ref={node => { if (node && field === 'courseName' && focusAdded.current && index === rows.length - 1) { node.focus(); focusAdded.current = false; } }}
            onChange={event => onRowsChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: event.target.value } : item))} />
          <ApplicationFieldError id={`course-${index}-${field}-error`} message={error?.field === `course-${index}-${field}` ? error.message : undefined} />
        </div>)}</div>
      </fieldset>)}</div>
      <PortalButton icon={Plus} disabled={disabled || rows.length >= 50} onClick={() => { focusAdded.current = true; onRowsChange([...rows, { courseName: '', courseCode: '', semesterSession: '', grade: '' }]); }}>Add another course</PortalButton>
      {rows.length >= 50 ? <p className="text-xs text-slate-500">Maximum 50 courses.</p> : null}
    </> : null}
  </section>;
}

export function SupervisorApplicationReviewSection({ researchTitle, projectCourseCodes, researchArea, researchAbstract, supervisorName, titleOrigin, rows, noCoursesTaken, filenames, noDocumentsRequired = false, declarationText, declarationAccepted, onDeclarationAcceptedChange, disabled = false, particulars, onEdit, declarationError }: {
  researchTitle: string; projectCourseCodes: string; researchArea: string; researchAbstract: string; supervisorName: string;
  titleOrigin: SupervisorTitleOrigin | ''; rows: SupervisorCourseResult[]; noCoursesTaken: boolean; filenames: string[]; noDocumentsRequired?: boolean;
  declarationText: string; declarationAccepted: boolean; onDeclarationAcceptedChange: (value: boolean) => void; disabled?: boolean;
  particulars?: SupervisorStudentParticularsData; onEdit?: (target: string) => void;
  declarationError?: string;
}) {
  const summaries = [
    ['Student details', particulars?.name || 'Check your details above', 'student-particulars'],
    ['Research', researchTitle.trim() || 'Research title missing', 'project-details'],
    ['Courses', noCoursesTaken ? 'No completed courses' : rows.length ? `${rows.length} completed course${rows.length === 1 ? '' : 's'}` : 'Choose Yes or No above', 'courses-taken'],
    ['Supervisor', supervisorName || 'Choose a supervisor', 'supervisor-selection'],
    ['Documents', filenames.length ? filenames.join(', ') : noDocumentsRequired ? 'No supporting documents required' : 'No files selected', 'supporting-documents'],
  ];
  return <section id="review-declaration" className={sectionClass} aria-labelledby="review-declaration-title">
    <h3 id="review-declaration-title" tabIndex={-1} className={typography.heading}>Review and declaration</h3>
    <dl className="divide-y divide-slate-100">{summaries.map(([label, value, target]) => <div key={target} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3 first:pt-0 sm:grid-cols-[8rem_1fr_auto]">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="col-start-1 min-w-0 break-words text-xs text-slate-800 sm:col-start-auto">{value}
        {target === 'project-details' ? <span className="mt-1 block text-slate-500">{[researchArea, projectCourseCodes, titleOrigin === 'STUDENT' ? 'Proposed by me' : titleOrigin === 'SUPERVISOR' ? 'Proposed by my supervisor' : 'Title source missing', researchAbstract.trim() ? 'Abstract added' : 'Abstract missing'].filter(Boolean).join(' · ')}</span> : null}
      </dd>
      <dd className="col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto"><a href={`#${target}`} onClick={onEdit ? event => { event.preventDefault(); onEdit(target); } : undefined} aria-label={`Edit ${label.toLowerCase()}`} className="inline-block rounded px-1 text-xs font-medium text-indigo-700 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-500">Edit</a></dd>
    </div>)}</dl>
    {particulars ? <SupervisorStudentParticulars particulars={particulars} /> : null}
    <dl className="space-y-2"><dt className={typography.label}>Research abstract</dt><dd className={`${typography.body} whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>{researchAbstract || 'Not recorded'}</dd></dl>
    {rows.length ? <div className="space-y-4" aria-label="Course results for review">{rows.map((course, index) => <dl key={index} className="grid min-w-0 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">{([
      ['Course name', course.courseName], ['Course code', course.courseCode], ['Semester/session', course.semesterSession], ['Grade', course.grade],
    ]).map(([label, value]) => <div key={label} className="min-w-0"><dt className={typography.label}>{label}</dt><dd className={`${typography.body} break-words`}>{value}</dd></div>)}</dl>)}</div> : null}
    <fieldset disabled={disabled || !declarationText} className="border-t border-slate-200 pt-5">
      <legend className="sr-only">Student declaration</legend>
      <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-800">
        <input id="supervisor-declaration" type="checkbox" required checked={declarationAccepted} onChange={event => onDeclarationAcceptedChange(event.target.checked)} aria-invalid={Boolean(declarationError)} aria-describedby={declarationError ? 'supervisor-declaration-error' : undefined} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600" />
        <span id="supervisor-declaration-text">{declarationText || 'Load student particulars to view the declaration.'} <ApplicationRequiredMark /></span>
      </label>
      <ApplicationFieldError id="supervisor-declaration-error" message={declarationError} />
    </fieldset>
  </section>;
}
