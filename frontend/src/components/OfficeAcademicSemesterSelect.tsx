import React from 'react';
import type {AcademicSemester} from '../types/academicSemester';
import {formatSemesterLifecycle} from '../utils/academicSemesters';
import {formatMalaysiaDate} from '../utils/malaysiaDateTime';
import {PortalSelect} from './PortalSelect';
import {StatusBadge, getStatusBadgeTone} from './PortalPrimitives';

/** One presentation for Office working-semester controls; callers own eligibility. */
export function OfficeAcademicSemesterSelect({id, semesters, selectedId, disabled=false, onChange, label='Semester context', dateId=`${id}-dates`}: {
  id: string; semesters: AcademicSemester[]; selectedId: number | null; disabled?: boolean;
  onChange: (id: number) => void; label?: string; dateId?: string;
}) {
  const selected = semesters.find(semester => semester.id === selectedId);
  const status = selected?.effectiveStatus ?? selected?.lifecycleStatus;
  return <section className="capacity-semester-selection" aria-label={label}>
    <div className="capacity-semester-control">
      <label htmlFor={id} className="capacity-field-label">Academic semester</label>
      <PortalSelect id={id} className="form-control form-control-md" value={selected?.id ?? ''}
        aria-describedby={selected ? dateId : undefined} disabled={disabled || !semesters.length}
        onChange={event => onChange(Number(event.target.value))}>
        <option value="" disabled hidden={!!selected}>{semesters.length ? 'Select semester' : 'No available semesters'}</option>
        {semesters.map(semester => <option key={semester.id} value={semester.id}>{semester.label}</option>)}
      </PortalSelect>
      {selected && <p id={dateId} className="capacity-semester-dates">{formatMalaysiaDate(selected.startsOn)} – {formatMalaysiaDate(selected.endsOn)}</p>}
    </div>
    {status && <div className="capacity-semester-status" aria-label="Semester status"><StatusBadge tone={getStatusBadgeTone(status)}>{formatSemesterLifecycle(status)}</StatusBadge></div>}
  </section>;
}
