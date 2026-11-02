/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// An appointment letter (UC22) on its own page in Files, where the student and
// the lecturers it was sent to open it from their notice.

import React, { useCallback, useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { RecordPage } from './RecordPage';
import { LetterPages } from './LetterPages';
import { PortalButton, PortalToast } from './PortalPrimitives';
import { LoadingState, ErrorState } from './StateViews';
import { GeneratedLetter } from '../types';
import { downloadLetterPdf, getLetterRequest, inactiveStudentReason } from '../services';
import { ApiError } from '../services/apiClient';
import { letterClosing, renderLetterBodyHtml } from '../utils/letterDocument';
import { recipientsLine } from '../utils/appointmentLetters';

interface AppointmentLetterPageProps {
  letterId: string;
  isStudent: boolean;
  /** Back to Files; staff go back to the student's files when known. */
  onBack: (studentMatric?: string) => void;
}

const loadProblem = (err: unknown) =>
  inactiveStudentReason(err) ??
  (err instanceof ApiError && err.status === 404 ? "This letter isn't available to you." : err instanceof Error ? err.message : 'Could not open this letter.');

export const AppointmentLetterPage: React.FC<AppointmentLetterPageProps> = ({ letterId, isStudent, onBack }) => {
  const [letter, setLetter] = useState<GeneratedLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLetterRequest(letterId)
      .then(setLetter)
      .catch((err) => setError(loadProblem(err)))
      .finally(() => setLoading(false));
  }, [letterId]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async () => {
    if (!letter) return;
    setDownloading(true);
    try {
      await downloadLetterPdf(letter);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Could not download the PDF.');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDownloading(false);
    }
  };

  const backLabel = isStudent
    ? 'Back to File Submission'
    : letter?.studentName
      ? `Back to ${letter.studentName}'s files`
      : 'Back to Files';
  const sentTo = recipientsLine(letter?.recipients);

  return (
    <RecordPage
      title={letter?.templateName ?? 'Letter'}
      subtitle={letter ? `${letter.studentName}${letter.matricNumber ? ` (${letter.matricNumber})` : ''}` : undefined}
      backLabel={backLabel}
      onBack={() => onBack(letter?.matricNumber || undefined)}
      pageKey={`file-letter:${letterId}`}
      actions={
        letter?.status === 'Issued' ? (
          <PortalButton variant="primary" icon={FileDown} isLoading={downloading} onClick={() => void download()}>
            Download PDF
          </PortalButton>
        ) : undefined
      }
    >
      <PortalToast message={toast} />
      {loading ? (
        <LoadingState message="Opening the letter…" />
      ) : error || !letter ? (
        <ErrorState message={error ?? 'Could not open this letter.'} onRetry={load} />
      ) : (
        <div className="space-y-5">
          {letter.status === 'Revoked' && (
            <p role="status" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">
              This letter was revoked{letter.revokeReason ? `: ${letter.revokeReason}` : '.'} It is no longer valid.
            </p>
          )}
          <section aria-label="About this letter" className="app-card p-5">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Reference</dt>
                <dd className="font-mono font-bold text-slate-800">{letter.referenceNumber || '-'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Issued</dt>
                <dd className="font-bold text-slate-800">{letter.date || '-'}</dd>
              </div>
              {sentTo && (
                <div>
                  <dt className="text-slate-500">Sent to</dt>
                  <dd className="font-bold text-slate-800">{sentTo}</dd>
                </div>
              )}
            </dl>
          </section>
          {letter.content !== undefined && (
            <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-3 sm:p-4">
              <LetterPages
                reference={letter.referenceNumber}
                referenceText={letter.referenceNumber}
                date={letter.date}
                bodyHtml={renderLetterBodyHtml(letter.content)}
                closing={letterClosing(letter)}
              />
            </div>
          )}
        </div>
      )}
    </RecordPage>
  );
};
