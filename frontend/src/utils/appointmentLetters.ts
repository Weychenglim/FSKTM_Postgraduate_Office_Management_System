/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Wording for appointment letters (UC22): letters made by themselves when a
// coordinator approves a supervisor, panel or supporting supervisor appointment.

import type { AppointmentLetterKind, GeneratedLetter, LetterRecipient, MissingAppointmentLetter } from '../types';
import { isAppointmentLetter } from './letterDocument';

/** The banner above the issued letters, or null when nothing is missing. */
export function missingLettersSummary(rows: readonly MissingAppointmentLetter[]) {
  if (!rows.length) return null;
  const ready = rows.filter((row) => !row.problem).length;
  const blocked = rows.length - ready;
  const reasons = [...new Set(rows.map((row) => row.problem).filter((problem): problem is string => Boolean(problem)))];
  const title = `${rows.length} approved appointment${rows.length === 1 ? ' has' : 's have'} no letter yet`;
  const detail =
    blocked === 0
      ? 'The templates are ready. Create the letters to send them to the students and lecturers.'
      : ready === 0
        ? reasons.join(' ')
        : `${ready} can be made now. ${blocked} cannot yet: ${reasons.join(' ')}`;
  return { title, detail, ready, blocked };
}

export const APPOINTMENT_ROLE: Record<AppointmentLetterKind, string> = {
  supervisor: 'supervisor',
  panel: 'panel member',
  supporting: 'supporting supervisor',
};

/** "Made automatically" for appointment letters; the letter type otherwise. */
export function letterOrigin(letter: Pick<GeneratedLetter, 'purpose' | 'letterType'>): string {
  if (letter.purpose === 'SUPERVISOR_APPOINTMENT') return 'Sent automatically on supervisor approval';
  if (letter.purpose === 'PANEL_APPOINTMENT') return 'Sent automatically on panel approval';
  if (letter.purpose === 'CO_SUPERVISOR_APPOINTMENT') return 'Sent automatically on supporting supervisor approval';
  return letter.letterType;
}

/** "Ali Hassan (student), Dr Supervisor (supervisor)". */
export function recipientsLine(recipients: readonly LetterRecipient[] | undefined): string {
  return (recipients ?? []).map((person) => `${person.name} (${person.relation.toLowerCase()})`).join(', ');
}

/** Only an issued appointment letter can be issued again with current details. */
export const canReissue = (letter: Pick<GeneratedLetter, 'purpose' | 'status'>) =>
  isAppointmentLetter(letter.purpose) && letter.status === 'Issued';
