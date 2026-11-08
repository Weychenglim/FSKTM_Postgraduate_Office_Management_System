/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Office side of letter requests (UC23): the queue of requests from students,
// and the review page where staff fill in what the student's record cannot
// supply, check the letter on A4 pages, then approve it or reject it with a
// reason. Approval issues the reference number; either way the student is told.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Download, Eye, MessageSquareText, Printer, Send, XCircle } from 'lucide-react';
import { PortalButton, PortalConfirmModal, StatusBadge } from './PortalPrimitives';
import { AppointmentIcon } from './AppointmentPrimitives';
import { PortalSelect } from './PortalSelect';
import { WORKSPACE_PAGE_SIZE, WorkspaceFilterCard, WorkspacePagination, WorkspaceSectionHeader, workspacePageSize } from './RequestWorkspacePrimitives';
import { RecordPage } from './RecordPage';
import { LoadingState, ErrorState } from './StateViews';
import { LetterPages } from './LetterPages';
import { LetterStatusBadge, LetterView, shortDate, useLetterOutput } from './IssuedLetters';
import { GeneratedLetter, GeneratedLetterStatus, LetterRequestCounts, LetterRequestField, LetterTemplate } from '../types';
import {
  approvalFieldErrors,
  approveLetterRequest,
  fieldErrors,
  getLetterRequest,
  getLetterRequests,
  rejectLetterRequest,
} from '../services';
import { PENDING_REFERENCE, fillLetterTags, formatLetterDate, isAppointmentLetter, letterClosing, renderLetterBodyHtml } from '../utils/letterDocument';
import { letterOrigin, recipientsLine } from '../utils/appointmentLetters';
import { RECIPIENT_PURPOSE_LABELS, chosenDetailLabels, recipientAddressLines } from '../utils/letterRecipients';

type QueueFilter = GeneratedLetterStatus | 'All';

const QUEUE_FILTERS: readonly QueueFilter[] = ['Pending', 'Issued', 'Rejected', 'Withdrawn', 'All'];
const FILTER_LABEL: Record<QueueFilter, string> = {
  Pending: 'Pending',
  Issued: 'Approved',
  Rejected: 'Rejected',
  Withdrawn: 'Withdrawn',
  Revoked: 'Revoked',
  All: 'All',
};
const MAX_REASON_LENGTH = 500;
const MAX_VALUE_LENGTH = 300;

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

interface OfficeLetterRequestsProps {
  /** The request open for review, from the route; none shows the queue. */
  requestId?: string | null;
  onOpenRequest: (id: string) => void;
  onCloseRequest: () => void;
  counts: LetterRequestCounts | null;
  /** Ask the parent to reload the counts after a decision. */
  onCountsStale: () => void;
  onMessage: (message: string) => void;
  /** The letter types, for filtering the queue by letter. */
  templates?: LetterTemplate[];
}

export const OfficeLetterRequests: React.FC<OfficeLetterRequestsProps> = ({
  requestId,
  onOpenRequest,
  onCloseRequest,
  counts,
  onCountsStale,
  onMessage,
  templates = [],
}) => {
  if (requestId) {
    return (
      <LetterRequestReview
        key={requestId}
        requestId={requestId}
        onClose={onCloseRequest}
        onDecided={(nextId) => {
          onCountsStale();
          if (nextId) onOpenRequest(nextId);
          else onCloseRequest();
        }}
        onMessage={onMessage}
        waiting={counts?.Pending ?? 0}
      />
    );
  }
  return <LetterRequestQueue counts={counts} templates={templates} onOpenRequest={onOpenRequest} onMessage={onMessage} />;
};

// ---------------- The queue ----------------

const SUMMARY: ReadonlyArray<{ status: GeneratedLetterStatus; title: string; description: string; icon: typeof Clock; tone: 'warning' | 'success' | 'danger' }> = [
  { status: 'Pending', title: 'Waiting for a decision', description: 'To check and decide.', icon: Clock, tone: 'warning' },
  { status: 'Issued', title: 'Approved', description: 'Ready for the student.', icon: CheckCircle2, tone: 'success' },
  { status: 'Rejected', title: 'Not approved', description: 'Turned down.', icon: XCircle, tone: 'danger' },
];

const LetterRequestQueue: React.FC<{
  counts: LetterRequestCounts | null;
  templates: LetterTemplate[];
  onOpenRequest: (id: string) => void;
  onMessage: (message: string) => void;
}> = ({ counts, templates, onOpenRequest, onMessage }) => {
  const [filter, setFilter] = useState<QueueFilter>('Pending');
  const [search, setSearch] = useState('');
  const [letter, setLetter] = useState('');
  const [rows, setRows] = useState<GeneratedLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<GeneratedLetter | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(WORKSPACE_PAGE_SIZE);
  const latestLoad = useRef(0);

  const load = useCallback(() => {
    const loadId = ++latestLoad.current;
    setLoading(true);
    setError(null);
    getLetterRequests({ search, status: filter === 'All' ? '' : filter })
      .then((data) => {
        if (loadId === latestLoad.current) setRows(data);
      })
      .catch((err) => {
        if (loadId === latestLoad.current) setError(errorText(err, 'Failed to load letter requests.'));
      })
      .finally(() => {
        if (loadId === latestLoad.current) setLoading(false);
      });
  }, [search, filter]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const viewLetter = async (row: GeneratedLetter) => {
    setOpening(row.id);
    try {
      setViewing(await getLetterRequest(row.id));
    } catch (err) {
      onMessage(errorText(err, 'Could not open this letter.'));
    } finally {
      setOpening(null);
    }
  };

  const shown = letter ? rows.filter((row) => row.templateId === letter) : rows;
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const total = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : null;
  const choose = (next: QueueFilter) => {
    setFilter(next);
    setPage(1);
  };
  const columns = ['Student', 'Letter', 'For', 'Requested', 'Status', 'Action'];

  return (
    <div id="letter-requests-queue" className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {SUMMARY.map((card) => {
          const selected = filter === card.status;
          return (
            <button
              key={card.status}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(selected ? 'All' : card.status)}
              className={`group space-y-3 rounded-2xl border bg-white p-5 text-left shadow-sm transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${selected ? 'border-brand-navy bg-slate-50/70' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <AppointmentIcon icon={card.icon} tone={card.tone === 'warning' ? 'warning' : card.tone === 'success' ? 'success' : 'danger'} />
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
              </div>
              <h2 className="card-value text-slate-800">{card.title}</h2>
              <p className="flex items-baseline gap-1.5"><span className="card-metric">{counts ? counts[card.status] : '-'}</span><span className="card-caption">requests</span></p>
              <p className="card-description">{card.description}</p>
            </button>
          );
        })}
      </div>

      <section aria-label="Letter requests" className="app-card appointment-workspace-card">
        <WorkspaceSectionHeader
          title={filter === 'All' ? 'All requests' : filter === 'Pending' ? 'Waiting for a decision' : `${FILTER_LABEL[filter]} requests`}
          description={filter === 'Pending' ? 'Newest first. Open one to check it and approve or reject it.' : 'Open one to see the letter or the reason given.'}
        />
        <WorkspaceFilterCard
          fieldsClassName="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4"
          onReset={() => {
            setSearch('');
            setLetter('');
            choose('Pending');
          }}
        >
          <label className="form-label xl:col-span-2">
            Find a request
            <input type="search" className="form-control form-control-sm mt-1" value={search} placeholder="Student name, matric number, letter or reference" onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </label>
          <label className="form-label">
            Letter
            <PortalSelect className="form-control form-control-sm mt-1" value={letter} onChange={(event) => { setLetter(event.target.value); setPage(1); }}>
              <option value="">All letters</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </PortalSelect>
          </label>
          <label className="form-label">
            Status
            <PortalSelect className="form-control form-control-sm mt-1" value={filter} onChange={(event) => choose(event.target.value as QueueFilter)}>
              {QUEUE_FILTERS.map((option) => (
                <option key={option} value={option}>{option === 'All' ? `All statuses${total !== null ? ` (${total})` : ''}` : `${FILTER_LABEL[option]}${counts ? ` (${counts[option]})` : ''}`}</option>
              ))}
            </PortalSelect>
          </label>
        </WorkspaceFilterCard>

        {loading && rows.length === 0 ? (
          <LoadingState message="Loading letter requests…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : shown.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 card-description">
            {search || letter ? 'No requests match these filters.' : filter === 'Pending' ? 'No requests are waiting. New requests from students appear here.' : 'Nothing here yet.'}
          </p>
        ) : (
          <>
            <table aria-label="Letter requests" className="data-table block table-fixed lg:table">
              <colgroup className="hidden lg:table-column-group">
                {[22, 22, 18, 12, 14, 12].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
              </colgroup>
              <thead className="hidden lg:table-header-group">
                <tr className="data-thead bg-slate-50">{columns.map((column) => <th key={column} scope="col" className="data-th">{column}</th>)}</tr>
              </thead>
              <tbody className="block space-y-3 lg:table-row-group lg:space-y-0">
                {pageRows.map((row) => (
                  <tr key={row.id} className="data-row grid grid-cols-2 rounded-xl border border-slate-200 py-2 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:py-0">
                    <td className="data-td-strong col-span-2 block min-w-0 px-3 py-2 align-middle [overflow-wrap:anywhere] lg:table-cell lg:px-5 lg:py-4">
                      <p>{row.studentName || 'Unknown student'}</p>
                      <p className="card-caption mt-1">{row.matricNumber}</p>
                    </td>
                    <td className="data-td block min-w-0 px-3 py-2 align-middle [overflow-wrap:anywhere] lg:table-cell lg:px-5 lg:py-4">
                      <span className="card-label mb-1 block lg:hidden">Letter</span>
                      <p>{row.templateName}</p>
                      <p className="card-caption mt-1">{letterOrigin(row)}</p>
                      {row.note && (
                        <p className="mt-1 inline-flex items-start gap-1 card-caption text-slate-600">
                          <MessageSquareText aria-hidden="true" className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                          <span className="line-clamp-2">{row.note}</span>
                        </p>
                      )}
                    </td>
                    <td className="data-td block min-w-0 px-3 py-2 align-middle [overflow-wrap:anywhere] lg:table-cell lg:px-5 lg:py-4">
                      <span className="card-label mb-1 block lg:hidden">For</span>
                      {row.requestDetails?.organisation ? row.requestDetails.organisation : <span className="text-slate-400">Not asked</span>}
                    </td>
                    <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                      <span className="card-label mb-1 block lg:hidden">Requested</span>
                      {shortDate(row.requestedAt)}
                    </td>
                    <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                      <span className="card-label mb-1 block lg:hidden">Status</span>
                      <LetterStatusBadge status={row.status} replaced={Boolean(row.replacedById)} />
                      {row.status === 'Issued' && <p className="card-caption mt-1 font-mono">{row.referenceNumber}</p>}
                      {row.status === 'Rejected' && row.rejectReason && <p className="card-caption mt-1 text-rose-700 line-clamp-2">{row.rejectReason}</p>}
                    </td>
                    <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                      {row.status === 'Pending' ? (
                        <PortalButton variant="primary" size="sm" className="whitespace-nowrap" aria-label={`Review the ${row.templateName} request from ${row.studentName}`} onClick={() => onOpenRequest(row.id)}>
                          Review
                        </PortalButton>
                      ) : row.status === 'Issued' || row.status === 'Revoked' ? (
                        <PortalButton size="sm" icon={Eye} className="whitespace-nowrap" isLoading={opening === row.id} aria-label={`View ${row.referenceNumber}`} onClick={() => void viewLetter(row)}>
                          View
                        </PortalButton>
                      ) : (
                        <PortalButton size="sm" className="whitespace-nowrap" aria-label={`Open the ${row.templateName} request from ${row.studentName}`} onClick={() => onOpenRequest(row.id)}>
                          Details
                        </PortalButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <WorkspacePagination
              page={currentPage}
              pageCount={pageCount}
              total={shown.length}
              noun="requests"
              onPage={setPage}
              pageSize={pageSize}
              onPageSize={(size) => {
                setPageSize(workspacePageSize(size));
                setPage(1);
              }}
            />
          </>
        )}
      </section>

      {viewing && <LetterView letter={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

// ---------------- Reviewing one request ----------------

const LetterRequestReview: React.FC<{
  requestId: string;
  onClose: () => void;
  /** After a decision: the next waiting request to open, if the office asked for it. */
  onDecided: (nextId?: string) => void;
  onMessage: (message: string) => void;
  /** How many requests are waiting, this one included. */
  waiting: number;
}> = ({ requestId, onClose, onDecided, onMessage, waiting }) => {
  const [request, setRequest] = useState<GeneratedLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [approving, setApproving] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [rejectSaving, setRejectSaving] = useState(false);
  const decided = useRef(false);
  const openNext = useRef(false);
  const output = useLetterOutput(onMessage);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLetterRequest(requestId)
      .then((data) => {
        setRequest(data);
        setValues({});
        setErrors({});
      })
      .catch((err) => setError(errorText(err, 'Could not open this request.')))
      .finally(() => setLoading(false));
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  const fields = useMemo(() => request?.fields ?? [], [request]);
  const needed = fields.filter((field) => field.needed);
  const officeNames = useMemo(() => fields.filter((field) => field.source === 'office').map((field) => field.name), [fields]);
  const missingCount = needed.filter((field) => !values[field.name]?.trim()).length;
  const dirty = Object.values(values).some((value) => value.trim()) || reason.trim() !== '';
  const busy = approving || rejectSaving;
  const today = useMemo(() => formatLetterDate(), []);

  // The letter as it will read: record values, what has been typed so far, and
  // the reference and dates the approval will fill in. The Malay page uses the
  // Malay form of values such as dates and the mode of study.
  const [previewHtml, previewMsHtml] = useMemo(() => {
    if (!request?.templateContent) return ['', ''];
    const filled: Record<string, string> = {
      REFERENCE_NUMBER: PENDING_REFERENCE,
      CURRENT_DATE: today,
      VALID_UNTIL: request.previewValidUntil ?? '',
    };
    for (const field of fields) filled[field.name] = field.needed ? values[field.name] ?? '' : field.value;
    const render = (content: string, own: Record<string, string>) =>
      renderLetterBodyHtml(fillLetterTags(content, own), { highlightPlaceholders: true, officeFields: officeNames });
    const typed = Object.fromEntries(
      fields
        .filter((field) => field.needed)
        .map((field) => {
          const value = values[field.name] ?? '';
          return [field.name, field.name.startsWith('BALANCE_SEMESTERS') ? value.replace('SEMESTER(S)', 'SEMESTER') : value];
        }),
    );
    const malay = { ...filled, ...request.malayValues, ...typed, REFERENCE_NUMBER: PENDING_REFERENCE };
    return [render(request.templateContent, filled), request.templateContentMs?.trim() ? render(request.templateContentMs, malay) : ''];
  }, [request, fields, values, today, officeNames]);

  const setValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: '' } : current));
  };

  const checkValues = () => {
    const problems: Record<string, string> = {};
    for (const field of needed) {
      const value = values[field.name]?.trim() ?? '';
      if (!value) problems[field.name] = 'Fill this in before approving.';
      else if (value.length > MAX_VALUE_LENGTH) problems[field.name] = `Keep it under ${MAX_VALUE_LENGTH} characters.`;
    }
    setErrors(problems);
    return Object.keys(problems).length === 0;
  };

  const startApprove = (andNext = false) => {
    openNext.current = andNext;
    if (checkValues()) setConfirmApprove(true);
  };

  const approve = async () => {
    if (!request) return;
    setApproving(true);
    try {
      const typed = Object.fromEntries(needed.map((field) => [field.name, values[field.name]?.trim() ?? '']));
      const issued = await approveLetterRequest(request.id, typed);
      decided.current = true;
      setConfirmApprove(false);
      onMessage(
        isAppointmentLetter(issued.purpose)
          ? `Issued ${issued.referenceNumber}. Everyone on the letter has been notified.`
          : `Approved. ${issued.referenceNumber} was issued to ${issued.studentName}, who has been notified.`,
      );
      if (openNext.current) {
        const next = await getLetterRequests({ status: 'Pending' }).then((rows) => rows.find((row) => row.id !== request.id)).catch(() => undefined);
        if (!next) onMessage('That was the last request waiting.');
        onDecided(next?.id);
      } else {
        onDecided();
      }
    } catch (err) {
      setConfirmApprove(false);
      const problems = approvalFieldErrors(err);
      if (problems) {
        setErrors(problems);
        onMessage('Some values need attention before this letter can be approved.');
      } else {
        onMessage(errorText(err, 'Could not approve this request.'));
        load();
      }
    } finally {
      setApproving(false);
    }
  };

  const reject = async () => {
    if (!request) return;
    const text = reason.trim();
    if (!text) {
      setReasonError('Give the reason, so the student knows what to do.');
      return;
    }
    setRejectSaving(true);
    try {
      await rejectLetterRequest(request.id, text);
      decided.current = true;
      setRejecting(false);
      onMessage(`Rejected. ${request.studentName} has been told why.`);
      onDecided();
    } catch (err) {
      const problem = fieldErrors(err).reason;
      if (problem) setReasonError(problem);
      else {
        setRejecting(false);
        onMessage(errorText(err, 'Could not reject this request.'));
        load();
      }
    } finally {
      setRejectSaving(false);
    }
  };

  const automatic = isAppointmentLetter(request?.purpose);
  const sentTo = recipientsLine(request?.recipients);
  const title = request ? `Review: ${request.templateName}` : 'Review Letter Request';
  const subtitle = request
    ? automatic
      ? `Made automatically for ${request.studentName || 'Unknown student'} (${request.matricNumber}) on ${shortDate(request.requestedAt)}, when the appointment was approved.`
      : `${request.studentName || 'Unknown student'} (${request.matricNumber}) asked for this on ${shortDate(request.requestedAt)}.`
    : undefined;

  return (
    <RecordPage
      title={title}
      subtitle={subtitle}
      backLabel="Back to Requests"
      onBack={onClose}
      pageKey={`letter-request:${requestId}`}
      dirty={dirty && !decided.current}
      busy={busy}
      navigationComplete={decided}
    >
      {loading ? (
        <LoadingState message="Opening the request…" />
      ) : error || !request ? (
        <ErrorState message={error ?? 'Could not open this request.'} onRetry={load} />
      ) : request.status !== 'Pending' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-5 space-y-6">
            <RequestSummary request={request} automatic={automatic} sentTo={sentTo} />
            <DecisionSummary
              request={request}
              printing={output.isBusy(request, 'print')}
              downloading={output.isBusy(request, 'pdf')}
              onPrint={() => void output.printLetter(request)}
              onDownload={() => void output.downloadPdf(request)}
            />
          </div>

          <section aria-labelledby="request-letter-heading" className="xl:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs space-y-4">
            <h2 id="request-letter-heading" className="section-label">{request.content ? 'The letter as issued' : 'The letter'}</h2>
            {request.content ? (
              <div className="rounded-xl bg-slate-100/70 border border-slate-200 p-3 sm:p-4">
                <LetterPages
                  reference={request.referenceNumber}
                  referenceText={request.referenceNumber}
                  date={request.date}
                  bodyHtml={renderLetterBodyHtml(request.content)}
                  malayBodyHtml={request.contentMs?.trim() ? renderLetterBodyHtml(request.contentMs) : undefined}
                  closing={letterClosing(request)}
                />
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
                No letter was made, because the request was {request.status === 'Withdrawn' ? 'withdrawn by the student' : 'rejected'}.
              </p>
            )}
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-5 space-y-6">
            <RequestSummary request={request} automatic={automatic} sentTo={sentTo} />

            <section aria-labelledby="request-values-heading" className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs space-y-4">
              <div>
                <h2 id="request-values-heading" className="section-label">Values in This Letter</h2>
                <p className="card-description mt-1">
                  {needed.length === 0
                    ? `Everything comes from the ${automatic ? 'appointment and the ' : ''}student record. Check the preview, then approve.`
                    : `Type in the ${needed.length} value${needed.length === 1 ? '' : 's'} the portal does not hold. Record values come from the ${automatic ? 'appointment and the ' : ''}student registry.`}
                </p>
              </div>

              {!request.problem && request.replaces && request.replaces.length > 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-900 flex items-start gap-2">
                  <AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />
                  {`Approving replaces the student's current ${request.templateName} (${request.replaces
                    .map((old) => `${old.referenceNumber}${old.issuedAt ? `, approved ${shortDate(old.issuedAt)}` : ''}`)
                    .join('; ')}). That copy will no longer be valid.`}
                </p>
              )}

              {request.problem && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700 flex items-start gap-2">
                  <AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />
                  {request.problem}
                </p>
              )}

              <div className="space-y-3">
                {fields.length === 0 && <p className="text-[12px] font-semibold text-slate-400">This letter uses no student details.</p>}
                {fields.map((field) => (
                  <FieldRow key={field.name} field={field} value={values[field.name] ?? ''} error={errors[field.name]} disabled={busy} onChange={setValue} />
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                {!automatic && (
                  <PortalButton variant="danger" icon={XCircle} disabled={busy} onClick={() => { setReasonError(null); setRejecting(true); }}>
                    Reject
                  </PortalButton>
                )}
                {waiting > 1 && (
                  <PortalButton icon={Send} disabled={busy || Boolean(request.problem)} onClick={() => startApprove(true)}>
                    {automatic ? 'Issue and open next' : 'Approve and open next'}
                  </PortalButton>
                )}
                <PortalButton variant="primary" icon={Send} disabled={busy || Boolean(request.problem)} onClick={() => startApprove()}>
                  {automatic ? 'Issue letter' : 'Approve and issue'}
                </PortalButton>
              </div>
              {missingCount > 0 && !request.problem && (
                <p className="text-[11px] font-semibold text-slate-400 text-right">
                  {missingCount} value{missingCount === 1 ? '' : 's'} still to fill in.
                </p>
              )}
            </section>
          </div>

          <section aria-labelledby="request-preview-heading" className="xl:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="request-preview-heading" className="section-label">Letter Preview</h2>
              <span className="text-[10.5px] font-semibold text-slate-400 inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-300" /> still to fill in
              </span>
            </div>
            <div className="rounded-xl bg-slate-100/70 border border-slate-200 p-3 sm:p-4">
              <LetterPages
                reference={<span className="text-slate-400 italic font-sans">{PENDING_REFERENCE}</span>}
                referenceText={PENDING_REFERENCE}
                date={today}
                bodyHtml={previewHtml}
                malayBodyHtml={previewMsHtml || undefined}
                closing={letterClosing(request)}
              />
            </div>
          </section>
        </div>
      )}

      <PortalConfirmModal
        isOpen={confirmApprove}
        title={automatic ? 'Issue this letter?' : 'Approve and issue this letter?'}
        message={
          request
            ? automatic
              ? `${request.templateName} for ${request.studentName} gets the next reference number and today's date. ${sentTo ? `It goes to ${sentTo}, who are notified.` : 'Everyone on it is notified.'}`
              : `${request.templateName} for ${request.studentName} gets the next reference number and today's date. The student is notified and can print it straight away.`
            : ''
        }
        confirmLabel={automatic ? 'Issue letter' : 'Approve and issue'}
        tone="info"
        icon={CheckCircle2}
        isLoading={approving}
        onConfirm={() => void approve()}
        onCancel={() => setConfirmApprove(false)}
      />

      <PortalConfirmModal
        isOpen={rejecting}
        title="Reject this request?"
        message={
          <div className="space-y-3 text-left">
            <p>{request ? `${request.studentName} is told the reason and can request the letter again.` : ''}</p>
            <label className="block">
              <span className="form-label block">Reason (shown to the student)</span>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError(null);
                }}
                maxLength={MAX_REASON_LENGTH}
                rows={3}
                placeholder="For example: your attendance this semester is below 80%. Please see the office."
                className={`form-control form-control-sm resize-none ${reasonError ? 'form-control-error' : ''}`}
              />
            </label>
            {reasonError && <p role="alert" className="text-[11px] font-semibold text-rose-600">{reasonError}</p>}
          </div>
        }
        confirmLabel="Reject request"
        tone="danger"
        isLoading={rejectSaving}
        onConfirm={() => void reject()}
        onCancel={() => setRejecting(false)}
      />
    </RecordPage>
  );
};

const RequestSummary: React.FC<{ request: GeneratedLetter; automatic: boolean; sentTo: string }> = ({ request, automatic, sentTo }) => (
  <section aria-labelledby="request-details-heading" className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs space-y-4">
    <h2 id="request-details-heading" className="section-label">Request</h2>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12px]">
      <dt className="font-semibold text-slate-400">Student</dt>
      <dd className="font-bold text-slate-800">{request.studentName} <span className="font-mono text-slate-500">({request.matricNumber})</span></dd>
      <dt className="font-semibold text-slate-400">Programme</dt>
      <dd className="font-semibold text-slate-700">{request.programName || '-'}</dd>
      <dt className="font-semibold text-slate-400">Letter</dt>
      <dd className="font-semibold text-slate-700">{request.templateName} <span className="text-slate-400">({request.letterType})</span></dd>
      <dt className="font-semibold text-slate-400">{automatic ? 'Made' : 'Requested'}</dt>
      <dd className="font-semibold text-slate-700">{shortDate(request.requestedAt)}</dd>
      {request.requestDetails?.organisation && (
        <>
          <dt className="font-semibold text-slate-400">For</dt>
          <dd className="font-semibold text-slate-700">
            <span className="block font-bold text-slate-800">{request.requestDetails.organisation}</span>
            {recipientAddressLines(request.requestDetails).map((line) => (
              <span key={line} className="block">{line}</span>
            ))}
            <span className="mt-0.5 block text-[11px] text-slate-400">
              {request.requestDetails.purposeLabel ?? RECIPIENT_PURPOSE_LABELS[request.requestDetails.purpose ?? ''] ?? request.requestDetails.purpose}
              {request.requestDetails.typedIn ? ', typed in by the student' : ''}
            </span>
          </dd>
          <dt className="font-semibold text-slate-400">Also show</dt>
          <dd className="font-semibold text-slate-700">{chosenDetailLabels(request.requestDetails).join(', ') || 'Nothing extra'}</dd>
        </>
      )}
      {Object.entries(request.requestDetails?.answers ?? {}).map(([name, answer]) => (
        <React.Fragment key={name}>
          <dt className="font-semibold text-slate-400">{answer.label}</dt>
          <dd className="font-semibold text-slate-700 [overflow-wrap:anywhere]">{answer.value || 'Not answered'}</dd>
        </React.Fragment>
      ))}
      {sentTo && (
        <>
          <dt className="font-semibold text-slate-400">Goes to</dt>
          <dd className="font-semibold text-slate-700">{sentTo}</dd>
        </>
      )}
    </dl>
    {request.templateStatus && request.templateStatus !== 'Active' && (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
        This template is now {request.templateStatus}. Approving still uses its current wording.
      </p>
    )}
    {!automatic && (
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">Note from the student</p>
        {request.note ? (
          <blockquote className="rounded-xl border-l-4 border-indigo-300 bg-indigo-50/50 px-4 py-3 text-[12px] font-semibold text-slate-700 whitespace-pre-line">
            {request.note}
          </blockquote>
        ) : (
          <p className="text-[12px] font-semibold text-slate-400">No note.</p>
        )}
      </div>
    )}
  </section>
);

const OUTCOME_VERB: Record<string, string> = { Issued: 'Approved', Rejected: 'Rejected', Withdrawn: 'Withdrawn', Revoked: 'Approved' };

// Who decided, when, and what came of it, for a request that is no longer waiting.
const DecisionSummary: React.FC<{
  request: GeneratedLetter;
  printing: boolean;
  downloading: boolean;
  onPrint: () => void;
  onDownload: () => void;
}> = ({ request, printing, downloading, onPrint, onDownload }) => {
  const automatic = isAppointmentLetter(request.purpose);
  const verb = automatic && OUTCOME_VERB[request.status] === 'Approved' ? 'Issued' : OUTCOME_VERB[request.status] ?? request.status;
  const decidedOn = request.status === 'Withdrawn' ? request.withdrawnAt : request.decidedAt;
  const typed = Object.entries(request.officeValues ?? {}).filter(([, value]) => value);
  return (
    <section aria-labelledby="request-outcome-heading" className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="request-outcome-heading" className="section-label">Outcome</h2>
        <LetterStatusBadge status={request.status} replaced={Boolean(request.replacedById)} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12px]">
        <dt className="font-semibold text-slate-400">{verb}</dt>
        <dd className="font-semibold text-slate-700">
          {decidedOn ? shortDate(decidedOn) : '-'}
          {request.status !== 'Withdrawn' && request.decidedBy ? ` by ${request.decidedBy}` : ''}
        </dd>
        {request.referenceNumber && (
          <>
            <dt className="font-semibold text-slate-400">Reference</dt>
            <dd className="font-mono font-bold text-slate-800">{request.referenceNumber}</dd>
          </>
        )}
        {request.status === 'Revoked' && (
          <>
            <dt className="font-semibold text-slate-400">{request.replacedById ? 'Replaced' : 'Revoked'}</dt>
            <dd className="font-semibold text-slate-700">{shortDate(request.revokedAt)}</dd>
          </>
        )}
        {typed.map(([name, value]) => (
          <React.Fragment key={name}>
            <dt className="font-semibold text-slate-400">{name.charAt(0) + name.slice(1).toLowerCase().replace(/_/g, ' ')}</dt>
            <dd className="font-semibold text-slate-700">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {request.status === 'Rejected' && request.rejectReason && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">Reason given to the student: {request.rejectReason}</p>
      )}
      {request.status === 'Revoked' && request.revokeReason && (
        <p className={`rounded-xl border px-4 py-3 text-[12px] font-semibold ${request.replacedById ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {request.replacedById ? request.revokeReason : `Reason: ${request.revokeReason}`} It is no longer valid.
        </p>
      )}
      {request.status === 'Issued' && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <PortalButton variant="secondary" size="sm" icon={Printer} isLoading={printing} onClick={onPrint}>Print</PortalButton>
          <PortalButton variant="secondary" size="sm" icon={Download} isLoading={downloading} onClick={onDownload}>Download PDF</PortalButton>
        </div>
      )}
    </section>
  );
};

const FieldRow: React.FC<{
  field: LetterRequestField;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (name: string, value: string) => void;
}> = ({ field, value, error, disabled, onChange }) => {
  const id = `letter-value-${field.name}`;
  const fromOffice = field.source === 'office';
  const fromStudent = field.source === 'student';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={field.needed ? id : undefined} className="text-[11.5px] font-extrabold text-slate-700">
          {field.label}
        </label>
        <StatusBadge tone={fromOffice ? 'warning' : field.needed ? 'danger' : fromStudent ? 'info' : 'neutral'} className="px-2 py-0.5 text-[8.5px]">
          {fromOffice ? 'Office fills in' : field.needed ? 'Missing from record' : fromStudent ? 'Student answered' : 'From record'}
        </StatusBadge>
      </div>
      {field.needed ? (
        <>
          <input
            id={id}
            type="text"
            value={value}
            maxLength={MAX_VALUE_LENGTH}
            disabled={disabled}
            onChange={(e) => onChange(field.name, e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint`}
            className={`form-control form-control-sm ${error ? 'form-control-error' : ''}`}
          />
          <p id={`${id}-hint`} className={`text-[10.5px] font-semibold ${error ? 'text-rose-600' : 'text-slate-400'}`}>
            {error || (fromOffice ? field.hint : "Not on the student's record. Used on this letter only.")}
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-700 whitespace-pre-line">
          {field.value || <span className="font-medium text-slate-400">Not answered</span>}
        </p>
      )}
    </div>
  );
};
