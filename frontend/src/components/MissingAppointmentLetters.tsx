/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Approved supervisor, panel and supporting supervisor appointments that have no letter yet (UC22),
// for example because no template was active when they were approved. Shown
// only when there are some, with one button to make the letters.

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PortalButton } from './PortalPrimitives';
import { MissingAppointmentLetter } from '../types';
import { getMissingAppointmentLetters, makeMissingAppointmentLetters } from '../services';
import { APPOINTMENT_ROLE, missingLettersSummary } from '../utils/appointmentLetters';

interface MissingAppointmentLettersProps {
  onMessage: (message: string) => void;
  /** Letters were made, so lists showing them are out of date. */
  onMade: () => void;
  onOpenTemplates?: () => void;
}

export const MissingAppointmentLetters: React.FC<MissingAppointmentLettersProps> = ({ onMessage, onMade, onOpenTemplates }) => {
  const [rows, setRows] = useState<MissingAppointmentLetter[]>([]);
  const [making, setMaking] = useState(false);

  const load = useCallback(() => {
    getMissingAppointmentLetters().then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = missingLettersSummary(rows);
  if (!summary) return null;

  const make = async () => {
    setMaking(true);
    try {
      const result = await makeMissingAppointmentLetters();
      onMessage(
        result.made === 0
          ? 'No letters could be made yet.'
          : `Made ${result.made} appointment letter${result.made === 1 ? '' : 's'}. Everyone on them has been notified.`,
      );
      onMade();
      load();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Could not make the letters.');
    } finally {
      setMaking(false);
    }
  };

  return (
    <section
      role="status"
      aria-label="Appointments without a letter"
      className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 flex flex-col md:flex-row md:items-center gap-4"
    >
      <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0 text-amber-800" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-[13px] font-extrabold text-amber-950">{summary.title}</p>
        <p className="text-[12px] font-semibold text-amber-900 leading-relaxed">{summary.detail}</p>
        <details className="text-[12px] font-semibold text-amber-900">
          <summary className="cursor-pointer w-fit underline underline-offset-2">See which appointments</summary>
          <ul className="mt-2 space-y-1">
            {rows.map((row) => (
              <li key={`${row.kind}-${row.appointmentId}`}>
                {row.studentName} ({row.matricNumber}), {APPOINTMENT_ROLE[row.kind]} {row.lecturerName}
                {row.problem ? `: ${row.problem}` : ''}
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {summary.blocked > 0 && onOpenTemplates && (
          <PortalButton variant="secondary" size="md" onClick={onOpenTemplates}>
            Set up template
          </PortalButton>
        )}
        {summary.ready > 0 && (
          <PortalButton variant="primary" size="md" isLoading={making} onClick={() => void make()}>
            {`Create ${summary.ready} letter${summary.ready === 1 ? '' : 's'}`}
          </PortalButton>
        )}
      </div>
    </section>
  );
};
