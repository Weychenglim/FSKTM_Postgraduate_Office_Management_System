/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Letter requests and issued letters (UC23): the student's "My Requests" list
// and the office register of issued letters. Both show a letter from its saved
// copy, so it always carries the original reference number and date.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, BellRing, Eye, FileDown, Printer, RotateCcw, Search, Undo2, X } from 'lucide-react';
import { PortalButton, PortalConfirmModal, StatusBadge, type BadgeTone } from './PortalPrimitives';
import { PortalModal, useModalTitle } from './PortalModal';
import { LoadingState, ErrorState } from './StateViews';
import { AlertMessage } from './AlertMessage';
import { ApprovalProcess } from './ApprovalProcess';
import type { ApprovalStep } from '../utils/approvalProcess';
import { LetterPages } from './LetterPages';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';
import { MissingAppointmentLetters } from './MissingAppointmentLetters';
import { GeneratedLetter, GeneratedLetterStatus, LetterRequestFilters } from '../types';
import {
  downloadLetterPdf,
  fieldErrors,
  getLetterRequest,
  getLetterRequests,
  reissueAppointmentLetter,
  resendLetterNotification,
  revokeLetter,
  withdrawLetterRequest,
} from '../services';
import { isAppointmentLetter, letterClosing, letterDataFromIssued, openLetterWindow, printLetterInWindow, renderLetterBodyHtml } from '../utils/letterDocument';
import { canReissue, letterOrigin, recipientsLine } from '../utils/appointmentLetters';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import { THIN_SCROLLBAR } from '../utils/scrollbar';

type OutputAction = 'view' | 'print' | 'pdf';

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** "Issued" reads as "Approved" to people; the API keeps its own word. */
export const LETTER_STATUS_LABEL: Record<GeneratedLetterStatus, string> = {
  Pending: 'Pending',
  Issued: 'Approved',
  Rejected: 'Rejected',
  Withdrawn: 'Withdrawn',
  Revoked: 'Revoked',
};

const STATUS_TONE: Record<GeneratedLetterStatus, BadgeTone> = {
  Pending: 'warning',
  Issued: 'success',
  Rejected: 'danger',
  Withdrawn: 'neutral',
  Revoked: 'danger',
};

export const LetterStatusBadge: React.FC<{ status: GeneratedLetterStatus; replaced?: boolean }> = ({ status, replaced = false }) => (
  <StatusBadge tone={replaced ? 'neutral' : STATUS_TONE[status] ?? 'neutral'} className="px-2 py-0.5 text-[9px] rounded-md">
    {replaced ? 'Replaced' : LETTER_STATUS_LABEL[status] ?? status}
  </StatusBadge>
);

export const shortDate = (value: string | null | undefined) => (value ? formatMalaysiaDate(value) : '');

/** Who a letter is for and how long it is valid, e.g. "For Maybank · valid until 23 Jan 2027"; blank when neither applies. */
export function letterForLine(letter: Pick<GeneratedLetter, 'requestDetails' | 'validUntil' | 'status'>): string {
  const organisation = letter.requestDetails?.organisation;
  const validUntil = letter.status === 'Issued' && letter.validUntil ? `valid until ${shortDate(letter.validUntil)}` : '';
  return [organisation ? `For ${organisation}` : '', validUntil].filter(Boolean).join(' · ');
}

/** View, print and PDF for issued letters, with a per-row busy flag. */
export function useLetterOutput(onMessage: (message: string) => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<GeneratedLetter | null>(null);

  // Lists carry no wording, so the full letter is fetched first.
  const withWording = async (letter: GeneratedLetter) =>
    letter.content === undefined ? getLetterRequest(letter.id) : letter;

  const viewLetter = async (letter: GeneratedLetter) => {
    setBusy(`${letter.id}:view`);
    try {
      setViewing(await withWording(letter));
    } catch (err) {
      onMessage(errorText(err, 'Could not open this letter.'));
    } finally {
      setBusy(null);
    }
  };

  const printLetter = async (letter: GeneratedLetter) => {
    // Opened during the click so pop-up blockers allow it; filled once loaded.
    const win = openLetterWindow();
    if (!win) {
      onMessage('Please allow pop-ups for this site to print the letter.');
      return;
    }
    setBusy(`${letter.id}:print`);
    try {
      printLetterInWindow(win, letterDataFromIssued(await withWording(letter)));
    } catch (err) {
      win.close();
      onMessage(errorText(err, 'Could not open this letter.'));
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async (letter: GeneratedLetter) => {
    setBusy(`${letter.id}:pdf`);
    try {
      await downloadLetterPdf(letter);
    } catch (err) {
      onMessage(errorText(err, 'Could not download the PDF.'));
    } finally {
      setBusy(null);
    }
  };

  const isBusy = (letter: GeneratedLetter, action: OutputAction) => busy === `${letter.id}:${action}`;
  const closeView = () => setViewing(null);
  return { viewLetter, printLetter, downloadPdf, isBusy, viewing, closeView };
}

/** The letter as it was issued, on A4 pages like the printed copy. Read only,
 *  except for any `actions` the caller adds to the footer. */
export const LetterView: React.FC<{ letter: GeneratedLetter; onClose: () => void; actions?: React.ReactNode }> = ({
  letter,
  onClose,
  actions,
}) => {
  const titleId = useModalTitle();
  const sentTo = recipientsLine(letter.recipients);
  return (
    <PortalModal isOpen onClose={onClose} labelledBy={titleId} className="max-w-4xl p-0 open:flex open:flex-col">
      <div className="drawer-header shrink-0">
        <div className="min-w-0">
          <h2 id={titleId} className="section-label truncate">{letter.templateName}</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500 truncate">
            <span className="font-mono">{letter.referenceNumber}</span>
            {' · '}
            {letter.studentName || 'Unknown student'}
            {letter.matricNumber ? ` (${letter.matricNumber})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <LetterStatusBadge status={letter.status} replaced={Boolean(letter.replacedById)} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-brand-navy transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-100/70 p-4 sm:p-6 space-y-4 ${THIN_SCROLLBAR}`}>
        {letter.status === 'Revoked' && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-semibold text-rose-700">
            {letter.replacedById
              ? `${letter.revokeReason || 'This letter was replaced by a newer one.'} It is no longer valid.`
              : `This letter was revoked${letter.revokeReason ? `: ${letter.revokeReason}` : '.'} It is no longer valid.`}
          </p>
        )}
        {sentTo && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11.5px] font-semibold text-slate-600">
            Sent to {sentTo}.
          </p>
        )}
        <LetterPages
          reference={letter.referenceNumber}
          referenceText={letter.referenceNumber}
          date={letter.date}
          bodyHtml={renderLetterBodyHtml(letter.content ?? '')}
          malayBodyHtml={letter.contentMs?.trim() ? renderLetterBodyHtml(letter.contentMs) : undefined}
          closing={letterClosing(letter)}
        />
      </div>

      <div className="drawer-footer shrink-0 flex-wrap">
        {actions}
        <PortalButton variant="secondary" onClick={onClose}>Close</PortalButton>
      </div>
    </PortalModal>
  );
};

const TableMessage: React.FC<{ colSpan: number; children: React.ReactNode }> = ({ colSpan, children }) => (
  <tr>
    <td colSpan={colSpan} className="px-5 py-12 text-center text-slate-400 font-semibold">
      {children}
    </td>
  </tr>
);

const DAY = 24 * 60 * 60 * 1000;
const OFFICE = 'Postgraduate office';
const EXPIRY_WARNING_DAYS = 30;

/** Days until a letter's last valid day, counted in Malaysia; negative once it has passed. */
export function daysLeft(validUntil: string | null | undefined, today: Date = new Date()): number | null {
  if (!validUntil) return null;
  const end = Date.parse(`${validUntil}T23:59:59+08:00`);
  return Number.isFinite(end) ? Math.ceil((end - today.getTime()) / DAY) - 1 : null;
}

/** Where a request stands, as steps from sending it to the letter being ready. */
export function requestSteps(letter: GeneratedLetter, readyInDays?: number | null): ApprovalStep[] {
  if (isAppointmentLetter(letter.purpose)) {
    return [{ id: 'issued', label: 'Issued after your appointment was approved', state: 'completed', actorName: OFFICE, occurredAt: letter.decidedAt ?? undefined, description: `Reference ${letter.referenceNumber}.` }];
  }
  const sent: ApprovalStep = { id: 'submitted', label: 'Sent to the office', state: 'completed', actorName: 'You', occurredAt: letter.requestedAt, description: letter.note ? `Your note: ${letter.note}` : undefined };
  const wait = readyInDays ? `Usually ready in ${readyInDays} working day${readyInDays === 1 ? '' : 's'}. You are notified when it is decided.` : 'You are notified when it is decided.';
  if (letter.status === 'Pending') {
    return [sent, { id: 'office', label: 'With the office', state: 'current', description: wait }, { id: 'ready', label: 'Ready to download', state: 'upcoming' }];
  }
  if (letter.status === 'Withdrawn') {
    return [sent, { id: 'office', label: 'You withdrew it', state: 'cancelled', actorName: 'You', occurredAt: letter.withdrawnAt ?? undefined }, { id: 'ready', label: 'Ready to download', state: 'not_reached' }];
  }
  if (letter.status === 'Rejected') {
    return [
      sent,
      { id: 'office', label: 'Not approved', state: 'rejected', occurredAt: letter.decidedAt ?? undefined, actorName: letter.decidedBy || OFFICE, reason: letter.rejectReason || undefined },
      { id: 'ready', label: 'Ready to download', state: 'not_reached' },
    ];
  }
  const approved: ApprovalStep = { id: 'office', label: 'Approved', state: 'completed', occurredAt: letter.decidedAt ?? undefined, actorName: letter.decidedBy || OFFICE };
  if (letter.status === 'Revoked') {
    return [
      sent,
      approved,
      letter.replacedById
        ? { id: 'ready', label: 'Replaced by a newer copy', state: 'cancelled', actorName: OFFICE, occurredAt: letter.revokedAt ?? undefined, description: `${letter.revokeReason || 'A newer copy replaced it.'} It is no longer valid.` }
        : { id: 'ready', label: 'Revoked by the office', state: 'rejected', actorName: OFFICE, occurredAt: letter.revokedAt ?? undefined, reason: letter.revokeReason || undefined },
    ];
  }
  return [sent, approved, { id: 'ready', label: 'Ready to view and download', state: 'completed', showRecordedDetails: false, description: `Reference ${letter.referenceNumber}.` }];
}

/** Requests still in play (waiting, or a letter that is valid) come first; the rest are history. */
export const isCurrentRequest = (letter: GeneratedLetter) => letter.status === 'Pending' || letter.status === 'Issued';

interface StudentLetterRequestsProps {
  letters: GeneratedLetter[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onMessage: (message: string) => void;
  /** A request changed, e.g. withdrawn. */
  onLetterChange?: (letter: GeneratedLetter) => void;
  /** Ask for the same letter again, starting from this request's answers. */
  onRequestAgain?: (letter: GeneratedLetter) => void;
  /** How many working days each letter type usually takes, by template id. */
  readyInDays?: Record<string, number | null | undefined>;
}

/** The signed-in student's letter requests: where each one stands, and the letter once approved. */
export const StudentLetterRequests: React.FC<StudentLetterRequestsProps> = ({
  letters,
  loading,
  error,
  onRetry,
  onMessage,
  onLetterChange,
  onRequestAgain,
  readyInDays = {},
}) => {
  const { viewLetter, printLetter, downloadPdf, isBusy, viewing, closeView } = useLetterOutput(onMessage);
  const [withdrawing, setWithdrawing] = useState<GeneratedLetter | null>(null);
  const [withdrawSaving, setWithdrawSaving] = useState(false);
  const [view, setView] = useState<'current' | 'history'>('current');

  const confirmWithdraw = async () => {
    if (!withdrawing) return;
    setWithdrawSaving(true);
    try {
      const updated = await withdrawLetterRequest(withdrawing.id);
      onLetterChange?.(updated);
      onMessage(`Your request for a ${updated.templateName} was withdrawn.`);
      setWithdrawing(null);
    } catch (err) {
      onMessage(errorText(err, 'Could not withdraw the request.'));
    } finally {
      setWithdrawSaving(false);
    }
  };

  const current = letters.filter(isCurrentRequest);
  const history = letters.filter((letter) => !isCurrentRequest(letter));
  const shown = view === 'current' ? current : history;
  const switchButton = (value: 'current' | 'history', label: string, count: number) => (
    <button
      key={value}
      type="button"
      aria-pressed={view === value}
      onClick={() => setView(value)}
      className={`card-value rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy cursor-pointer ${view === value ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
    >
      {label} ({count})
    </button>
  );

  return (
    <section id="student-letter-history" aria-label="My requests" className="app-card appointment-workspace-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 basis-64 flex-1">
          <h2 className="section-label">My requests</h2>
        </div>
        <div role="group" aria-label="Request views" className="flex w-fit flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {switchButton('current', 'Current', current.length)}
          {switchButton('history', 'History', history.length)}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading your requests…" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : shown.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 card-description">
          {view === 'current'
            ? letters.length
              ? 'Nothing waiting or valid right now. Past requests are under History.'
              : 'You have not asked for any letters yet. Choose one under Request a letter.'
            : 'No past requests yet.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {shown.map((letter) => {
            const left = letter.status === 'Issued' ? daysLeft(letter.validUntil) : null;
            const automatic = isAppointmentLetter(letter.purpose);
            return (
              <li key={letter.id}>
                <article aria-label={`${letter.templateName}${letter.requestDetails?.organisation ? ` for ${letter.requestDetails.organisation}` : ''}`} className="rounded-xl border border-slate-200 p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-brand-navy">{letter.templateName}</h3>
                      <p className="card-description mt-0.5">
                        {[letter.requestDetails?.organisation ? `For ${letter.requestDetails.organisation}` : '', automatic ? letterOrigin(letter) : `Requested ${shortDate(letter.requestedAt)}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <LetterStatusBadge status={letter.status} replaced={Boolean(letter.replacedById)} />
                  </div>
                  <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
                    <ApprovalProcess steps={requestSteps(letter, letter.templateId ? readyInDays[letter.templateId] : null)} title="Progress" />
                    <div className="space-y-3">
                      {letter.referenceNumber && (
                        <dl className="space-y-1">
                          <dt className="card-label">Reference</dt>
                          <dd className="font-mono text-[12.5px] font-semibold text-slate-800">{letter.referenceNumber}</dd>
                        </dl>
                      )}
                      {letter.status === 'Issued' && letter.validUntil && (
                        <dl className="space-y-1">
                          <dt className="card-label">Valid until</dt>
                          <dd className="text-[12.5px] font-semibold text-slate-800">{shortDate(letter.validUntil)}</dd>
                        </dl>
                      )}
                      {left !== null && left < 0 && (
                        <AlertMessage type="warning" message="This letter is no longer valid. Request a new one if you still need it." />
                      )}
                      {left !== null && left >= 0 && left <= EXPIRY_WARNING_DAYS && (
                        <AlertMessage type="warning" message={`It stops being valid ${left === 0 ? 'today' : `in ${left} day${left === 1 ? '' : 's'}`}. Request again to renew it.`} />
                      )}
                      <div className="flex flex-wrap gap-2">
                        {letter.status === 'Pending' && (
                          <PortalButton size="sm" icon={Undo2} onClick={() => setWithdrawing(letter)}>Withdraw</PortalButton>
                        )}
                        {letter.status === 'Issued' && (
                          <>
                            <PortalButton size="sm" icon={Eye} isLoading={isBusy(letter, 'view')} onClick={() => void viewLetter(letter)}>View</PortalButton>
                            <PortalButton size="sm" icon={Printer} isLoading={isBusy(letter, 'print')} onClick={() => void printLetter(letter)}>Print</PortalButton>
                            <PortalButton size="sm" icon={FileDown} isLoading={isBusy(letter, 'pdf')} onClick={() => void downloadPdf(letter)}>PDF</PortalButton>
                          </>
                        )}
                        {!automatic && letter.status !== 'Pending' && onRequestAgain && (
                          <PortalButton size="sm" variant={left !== null && left <= EXPIRY_WARNING_DAYS ? 'primary' : 'secondary'} icon={RotateCcw} onClick={() => onRequestAgain(letter)}>
                            Request again
                          </PortalButton>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {viewing && <LetterView letter={viewing} onClose={closeView} />}

      <PortalConfirmModal
        isOpen={withdrawing !== null}
        title="Withdraw this request?"
        message={withdrawing ? `The office will not process your request for a ${withdrawing.templateName}. You can request it again later.` : ''}
        confirmLabel="Withdraw"
        cancelLabel="Keep request"
        tone="warning"
        isLoading={withdrawSaving}
        onConfirm={() => void confirmWithdraw()}
        onCancel={() => setWithdrawing(null)}
      />
    </section>
  );
};

type RegisterStatus = 'Issued,Revoked' | 'Issued' | 'Revoked';

const REGISTER_STATUS_OPTIONS: SelectMenuOption<RegisterStatus>[] = [
  { value: 'Issued,Revoked', label: 'All issued letters', triggerLabel: 'All' },
  { value: 'Issued', label: 'Approved' },
  { value: 'Revoked', label: 'Revoked' },
];

type MadeBy = NonNullable<LetterRequestFilters['madeBy']>;

const MADE_BY_OPTIONS: SelectMenuOption<MadeBy>[] = [
  { value: '', label: 'All letters', triggerLabel: 'All' },
  { value: 'request', label: 'Student requests' },
  { value: 'automatic', label: 'Sent automatically' },
];

interface IssuedLettersRegisterProps {
  onMessage: (message: string) => void;
  /** Opens the Templates tab, to set up a missing appointment template. */
  onOpenTemplates?: () => void;
}

/** Office register of every issued letter: search, filter and view each one. */
export const IssuedLettersRegister: React.FC<IssuedLettersRegisterProps> = ({ onMessage, onOpenTemplates }) => {
  const [letters, setLetters] = useState<GeneratedLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<RegisterStatus>('Issued,Revoked');
  const [madeBy, setMadeBy] = useState<MadeBy>('');
  const [reissuing, setReissuing] = useState<GeneratedLetter | null>(null);
  const [reissueSaving, setReissueSaving] = useState(false);
  const [revoking, setRevoking] = useState<GeneratedLetter | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokeSaving, setRevokeSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const latestLoad = useRef(0);
  const { viewLetter, isBusy, viewing, closeView } = useLetterOutput(onMessage);

  const load = useCallback(() => {
    const loadId = ++latestLoad.current;
    setLoading(true);
    setError(null);
    getLetterRequests({ search, from, to, status: statusFilter, madeBy })
      .then((rows) => {
        if (loadId === latestLoad.current) setLetters(rows);
      })
      .catch((err) => {
        if (loadId === latestLoad.current) setError(errorText(err, 'Failed to load issued letters.'));
      })
      .finally(() => {
        if (loadId === latestLoad.current) setLoading(false);
      });
  }, [search, from, to, statusFilter, madeBy]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const filtersActive = Boolean(search || from || to || statusFilter !== 'Issued,Revoked' || madeBy);

  const reissue = async () => {
    if (!reissuing) return;
    setReissueSaving(true);
    try {
      const fresh = await reissueAppointmentLetter(reissuing.id);
      onMessage(`Reissued as ${fresh.referenceNumber}. ${reissuing.referenceNumber} is revoked as replaced, and everyone on the letter has been told.`);
      setReissuing(null);
      closeView();
      load();
    } catch (err) {
      setReissuing(null);
      onMessage(errorText(err, 'Could not reissue this letter.'));
    } finally {
      setReissueSaving(false);
    }
  };

  // Revoking and resending are rare, so they sit in the letter view, not on each row.
  const openRevoke = (letter: GeneratedLetter) => {
    setRevokeReason('');
    setRevokeError(null);
    setRevoking(letter);
  };

  const revoke = async () => {
    if (!revoking) return;
    const reason = revokeReason.trim();
    if (!reason) {
      setRevokeError('Give the reason, so the student knows why the letter is no longer valid.');
      return;
    }
    setRevokeSaving(true);
    try {
      const revoked = await revokeLetter(revoking.id, reason);
      onMessage(`Revoked ${revoked.referenceNumber}. ${revoked.studentName || 'The student'} has been told why.`);
      setRevoking(null);
      closeView();
      load();
    } catch (err) {
      const problem = fieldErrors(err).reason;
      if (problem) setRevokeError(problem);
      else {
        setRevoking(null);
        onMessage(errorText(err, 'Could not revoke this letter.'));
      }
    } finally {
      setRevokeSaving(false);
    }
  };

  const resend = async (letter: GeneratedLetter) => {
    setResending(true);
    try {
      onMessage((await resendLetterNotification(letter.id)).detail);
    } catch (err) {
      onMessage(errorText(err, 'Could not send the notification again.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div id="issued-letters-register" className="space-y-6">
      <MissingAppointmentLetters onMessage={onMessage} onMade={load} onOpenTemplates={onOpenTemplates} />

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <label className="md:col-span-3 block">
          <span className="form-label block">Search</span>
          <span className="relative block">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Student name, matric number, letter or reference"
              className="form-control form-control-sm pl-9"
            />
          </span>
        </label>
        <label className="md:col-span-2 block">
          <span className="form-label block">Issued from</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="form-control form-control-sm" />
        </label>
        <label className="md:col-span-2 block">
          <span className="form-label block">Issued to</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="form-control form-control-sm" />
        </label>
        <div className="md:col-span-2 block">
          <span className="form-label block">Status</span>
          <SelectMenu<RegisterStatus>
            size="sm"
            aria-label="Status"
            value={statusFilter}
            options={REGISTER_STATUS_OPTIONS}
            onChange={setStatusFilter}
          />
        </div>
        <div className="md:col-span-2 block">
          <span className="form-label block">Made by</span>
          <SelectMenu<MadeBy>
            size="sm"
            aria-label="Made by"
            value={madeBy}
            options={MADE_BY_OPTIONS}
            onChange={setMadeBy}
          />
        </div>
        <div className="md:col-span-1">
          <PortalButton
            variant="ghost"
            size="md"
            disabled={!filtersActive}
            onClick={() => { setSearch(''); setFrom(''); setTo(''); setStatusFilter('Issued,Revoked'); setMadeBy(''); }}
            className="w-full"
          >
            Reset
          </PortalButton>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-3xs overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <h2 className="section-label">Issued Letters</h2>
          <span className="text-[11px] font-semibold text-slate-400">
            {letters.length} letter{letters.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr className="data-thead bg-[#f8fafc]">
                <th className="data-th">Reference</th>
                <th className="data-th">Student</th>
                <th className="data-th">Letter</th>
                <th className="data-th">Issued</th>
                <th className="data-th">Status</th>
                <th className="data-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && letters.length === 0 ? (
                <tr><td colSpan={6} className="p-0"><LoadingState message="Loading issued letters…" /></td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="p-0"><ErrorState message={error} onRetry={load} /></td></tr>
              ) : letters.length === 0 ? (
                <TableMessage colSpan={6}>
                  {filtersActive ? 'No letters match these filters.' : 'No letters have been issued yet.'}
                </TableMessage>
              ) : (
                letters.map((letter) => (
                  <tr key={letter.id} className="hover:bg-slate-50/50 transition">
                    <td className="data-td-strong font-mono whitespace-nowrap">{letter.referenceNumber}</td>
                    <td className="data-td">
                      <span className="block font-bold text-slate-800">{letter.studentName || 'Unknown student'}</span>
                      <span className="block text-[10px] text-slate-400">{letter.matricNumber}</span>
                    </td>
                    <td className="data-td">
                      <span className="block font-bold text-slate-800">{letter.templateName}</span>
                      {letterForLine(letter) && <span className="block text-[10.5px] font-semibold text-slate-500">{letterForLine(letter)}</span>}
                      <span className="block text-[10px] text-slate-400">{letterOrigin(letter)}</span>
                    </td>
                    <td className="data-td whitespace-nowrap">
                      {letter.date}
                      {letter.decidedBy && <span className="block text-[10px] text-slate-400">by {letter.decidedBy}</span>}
                    </td>
                    <td className="data-td">
                      <LetterStatusBadge status={letter.status} replaced={Boolean(letter.replacedById)} />
                      {letter.status === 'Revoked' && letter.revokeReason && (
                        <p className={`mt-1 text-[10px] font-semibold leading-snug max-w-[220px] ${letter.replacedById ? 'text-slate-500' : 'text-rose-600'}`}>
                          {letter.replacedById ? letter.revokeReason : `Reason: ${letter.revokeReason}`}
                        </p>
                      )}
                    </td>
                    <td className="data-td text-right">
                      <PortalButton
                        variant="secondary"
                        size="sm"
                        icon={Eye}
                        isLoading={isBusy(letter, 'view')}
                        aria-label={`View ${letter.referenceNumber}`}
                        onClick={() => void viewLetter(letter)}
                      >
                        View
                      </PortalButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <LetterView
          letter={viewing}
          onClose={closeView}
          actions={
            viewing.status === 'Issued' ? (
              <>
                <PortalButton variant="danger" icon={Ban} onClick={() => openRevoke(viewing)}>
                  Revoke
                </PortalButton>
                <PortalButton variant="secondary" icon={BellRing} isLoading={resending} onClick={() => void resend(viewing)}>
                  Resend notification
                </PortalButton>
                {canReissue(viewing) && (
                  <PortalButton variant="secondary" icon={RotateCcw} onClick={() => setReissuing(viewing)}>
                    Reissue with current details
                  </PortalButton>
                )}
              </>
            ) : undefined
          }
        />
      )}

      <PortalConfirmModal
        isOpen={revoking !== null}
        title="Revoke this letter?"
        message={
          <div className="space-y-3 text-left">
            <p>
              {revoking
                ? `${revoking.referenceNumber} will no longer be valid. ${revoking.studentName || 'The student'} is told the reason and can no longer print or download it.`
                : ''}
            </p>
            <label className="block">
              <span className="form-label block">Reason (shown to the student)</span>
              <textarea
                value={revokeReason}
                onChange={(e) => {
                  setRevokeReason(e.target.value);
                  setRevokeError(null);
                }}
                maxLength={500}
                rows={3}
                placeholder="For example: issued with the wrong programme. A corrected letter will follow."
                className={`form-control form-control-sm resize-none ${revokeError ? 'form-control-error' : ''}`}
              />
            </label>
            {revokeError && <p role="alert" className="text-[11px] font-semibold text-rose-600">{revokeError}</p>}
          </div>
        }
        confirmLabel="Revoke letter"
        tone="danger"
        isLoading={revokeSaving}
        onConfirm={() => void revoke()}
        onCancel={() => setRevoking(null)}
      />

      <PortalConfirmModal
        isOpen={reissuing !== null}
        title="Reissue this letter?"
        message={
          reissuing
            ? `A new ${reissuing.templateName} is issued with the current details and a new reference number. ${reissuing.referenceNumber} is revoked as replaced, and everyone on the letter is told.`
            : ''
        }
        confirmLabel="Reissue letter"
        tone="warning"
        isLoading={reissueSaving}
        onConfirm={() => void reissue()}
        onCancel={() => setReissuing(null)}
      />
    </div>
  );
};
