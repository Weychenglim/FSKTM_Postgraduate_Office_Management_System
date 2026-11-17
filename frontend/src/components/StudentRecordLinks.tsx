import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { APP_ROUTES, routeForLetterRequest } from '../constants/routes';
import { getStudentLinks, type StudentLinks } from '../services/studentsApi';
import { shortDocumentDate } from '../utils/documentDisplay';

const Row: React.FC<{ label: string; children: React.ReactNode; to?: string; linkLabel?: string }> = ({ label, children, to, linkLabel }) => (
  <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
    <div className="min-w-0 flex-[1_1_14rem]">
      <p className="card-label">{label}</p>
      <div className="mt-0.5 text-[13px] font-semibold text-slate-800 [overflow-wrap:anywhere]">{children}</div>
    </div>
    {to && <Link to={to} className="back-link shrink-0">{linkLabel ?? 'Open'}</Link>}
  </li>
);

const names = (people: Array<{ name: string }>) => (people.length ? people.map(person => person.name).join(', ') : 'None');

/** What the record links to besides its supervisor: panel, marks, files, letters and announcements (FR-12). */
export const StudentRecordLinks: React.FC<{ matric: string }> = ({ matric }) => {
  const [links, setLinks] = useState<StudentLinks | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setLinks(null);
    setFailed(false);
    getStudentLinks(matric)
      .then(found => { if (live) setLinks(found); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [matric]);

  if (failed) return <p className="text-[12.5px] font-semibold text-rose-700">Linked records could not be loaded.</p>;
  if (!links) return null;

  const submittedMarks = links.marks?.filter(row => row.status === 'Submitted').length ?? 0;
  return (
    <section aria-labelledby="record-links-heading" className="border-t border-slate-100 pt-4">
      <h4 id="record-links-heading" className="section-label">Linked records</h4>
      <ul className="divide-y divide-slate-100">
        <Row label="Panel" to={APP_ROUTES.panelAppointmentRecords} linkLabel="Panel records">{names(links.panel)}</Row>
        {links.marks && (
          <Row label="Marks" to={APP_ROUTES.marksRecords} linkLabel="Mark records">
            {links.marks.length ? `${submittedMarks} of ${links.marks.length} evaluations submitted` : 'No evaluations yet'}
            {links.marks.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[12.5px] font-medium text-slate-600">
                {links.marks.map((row, index) => <li key={index}>{row.period} · {row.evaluator} ({row.role}) · {row.status}</li>)}
              </ul>
            )}
          </Row>
        )}
        <Row label="Files" to={`${APP_ROUTES.files}?student=${encodeURIComponent(matric)}`} linkLabel="View files">
          {links.files === 1 ? '1 file' : `${links.files} files`}
        </Row>
        {links.letters && (
          <Row label="Letters">
            {links.letters.total ? `${links.letters.total} in total` : 'None'}
            {links.letters.latest.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[12.5px] font-medium">
                {links.letters.latest.map(letter => (
                  <li key={letter.id}>
                    <Link to={routeForLetterRequest(String(letter.id))} className="text-blue-700 hover:text-blue-900">{letter.name}</Link>
                    <span className="text-slate-600"> · {letter.status}{letter.date ? ` · ${shortDocumentDate(letter.date)}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </Row>
        )}
        <Row label="Announcements">
          {links.announcements.total ? `${links.announcements.total} received` : 'None'}
          {links.announcements.latest.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[12.5px] font-medium text-slate-600">
              {links.announcements.latest.map((row, index) => <li key={index}>{row.title}{row.date ? ` · ${shortDocumentDate(row.date)}` : ''}</li>)}
            </ul>
          )}
        </Row>
      </ul>
    </section>
  );
};
