/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Lock,
  Megaphone,
  Minus,
  Paperclip,
  Pencil,
  Plus,
  Radio,
  Search,
  SearchX,
  Send,
  Trash2,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader, PortalButton, PortalConfirmModal, PortalToast, SegmentedControl, StatusBadge, StatusDot, getStatusBadgeTone, type BadgeTone } from './PortalPrimitives';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';
import { RecordPage } from './RecordPage';
import { LoadingState, ErrorState } from './StateViews';
import { AnnouncementAudienceOptions, AnnouncementItem } from '../types';
import {
  fieldErrors,
  getAnnouncements,
  getAnnouncementAudienceOptions,
  getAnnouncementRecipientCount,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../services';
import { formatScheduleMoment, isScheduledFor, scheduleTime } from '../utils/announcementSchedule';
import { toMalaysiaDateTimeLocalValue } from '../utils/malaysiaDateTime';
import { describeProgramme } from '../utils/programmeLabel';
import { pageWindow } from '../utils/pageWindow';

// AnnouncementItem now lives in src/types.

// Target-audience chip options. "All" reaches everyone; "Students" is students-only.
type AudienceOption = 'All' | 'Students' | 'Lecturers' | 'Staff' | 'Coordinators';
const AUDIENCE_OPTIONS: AudienceOption[] = ['All', 'Students', 'Lecturers', 'Staff', 'Coordinators'];

// Map the chip choice to the backend target value, and back again when editing.
const targetForAudience = (a: AudienceOption): AnnouncementItem['target'] =>
  a === 'Students' ? 'All Students' : a;
const audienceFromTarget = (target: string): AudienceOption =>
  target === 'All Students'
    ? 'Students'
    : (['All', 'Lecturers', 'Staff', 'Coordinators'].includes(target) ? (target as AudienceOption) : 'All');

const toggled = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

// Multi-select chips for programme and intake targeting; none selected means all.
const ChipToggleGroup: React.FC<{
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyText: string;
  labelFor?: (value: string) => string;
}> = ({ label, options, selected, onToggle, emptyText, labelFor = (value) => value }) => (
  <div className="space-y-1.5">
    <span className="form-label block">{label}</span>
    {options.length === 0 ? (
      <p className="text-[10px] text-slate-400 font-semibold">{emptyText}</p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option)}
              title={option}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                on ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {labelFor(option)}
            </button>
          );
        })}
      </div>
    )}
  </div>
);

const programmeName = (programme: string) => describeProgramme(programme).field;

// Who a targeted student announcement is narrowed to, e.g. "Data Science, Semester 1 2025/2026".
const targetingSummary = (item: AnnouncementItem) =>
  [...(item.targetProgrammes ?? []).map(programmeName), ...(item.targetIntakes ?? [])].join(', ');

// List filters; 'any' turns a filter off.
type StatusFilter = Exclude<AnnouncementItem['status'], 'Expired'> | 'any';
type AudienceFilter = AnnouncementItem['target'] | 'any';
type PriorityFilter = AnnouncementItem['priority'] | 'any';

// How each status reads in the list. Recipients can see Active ones, so they show as Live.
const STATUS_LOOK: Record<AnnouncementItem['status'], { label: string; tone: BadgeTone }> = {
  Active: { label: 'Live', tone: 'success' },
  Scheduled: { label: 'Scheduled', tone: 'info' },
  Draft: { label: 'Draft', tone: 'warning' },
  Expired: { label: 'Expired', tone: 'neutral' },
};

// The coloured edge on each row, as in the recipients' feed.
const PRIORITY_EDGE: Record<AnnouncementItem['priority'], string> = {
  Urgent: 'bg-rose-500',
  Info: 'bg-blue-500',
  General: 'bg-slate-300',
};

const AUDIENCE_LABEL: Record<AnnouncementItem['target'], string> = {
  All: 'Everyone',
  'All Students': 'All students',
  Lecturers: 'Lecturers',
  Staff: 'Staff',
  Coordinators: 'Coordinators',
};

const LIST_HEADING: Record<StatusFilter, string> = {
  any: 'All announcements',
  Active: 'Live announcements',
  Scheduled: 'Scheduled announcements',
  Draft: 'Drafts',
};

const STATUS_FILTER_OPTIONS: SelectMenuOption<StatusFilter>[] = [
  { value: 'any', label: 'All statuses', triggerLabel: 'All' },
  ...(['Active', 'Scheduled', 'Draft'] as const).map((status) => ({
    value: status,
    label: STATUS_LOOK[status].label,
    leading: <StatusDot tone={STATUS_LOOK[status].tone} className="w-2 h-2" />,
  })),
];

const AUDIENCE_FILTER_OPTIONS: SelectMenuOption<AudienceFilter>[] = [
  { value: 'any', label: 'All audiences', triggerLabel: 'All' },
  ...(['All', 'All Students', 'Lecturers', 'Staff', 'Coordinators'] as const).map((target) => ({
    value: target,
    label: AUDIENCE_LABEL[target],
  })),
];

const PRIORITY_FILTER_OPTIONS: SelectMenuOption<PriorityFilter>[] = [
  { value: 'any', label: 'All priorities', triggerLabel: 'All' },
  ...(['Urgent', 'Info', 'General'] as const).map((priority) => ({
    value: priority,
    label: priority,
    leading: <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_EDGE[priority]}`} />,
  })),
];

// "Everyone", "Lecturers", or "Students: Data Science, Semester 1 2025/2026" when narrowed.
const audienceLine = (item: AnnouncementItem) => {
  const narrowed = targetingSummary(item);
  if (!narrowed) return AUDIENCE_LABEL[item.target] ?? item.target;
  return `${item.target === 'All Students' ? 'Students' : AUDIENCE_LABEL[item.target] ?? item.target}: ${narrowed}`;
};

// When it went out, or goes out for a scheduled one.
const timingLine = (item: AnnouncementItem) => {
  if (item.status === 'Draft') return `Created ${item.dateCreated}`;
  if (item.status === 'Scheduled') return `Publishes ${formatScheduleMoment(item.publishAt) || 'at its set time'}`;
  return `Published ${formatScheduleMoment(item.publishAt) || item.dateCreated}`;
};

// A summary count that also filters the list; pressing it again shows everything.
const StatusTile: React.FC<{
  label: string;
  count: number;
  caption: string;
  icon: LucideIcon;
  iconClass: string;
  selected: boolean;
  onClick: () => void;
}> = ({ label, count, caption, icon: Icon, iconClass, selected, onClick }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={`relative w-full bg-white border rounded-2xl p-4 sm:p-5 text-left shadow-3xs select-none transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30 ${
      selected ? 'bg-slate-50 border-brand-navy ring-1 ring-brand-navy' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
    }`}
  >
    <span className={`absolute top-5 right-5 w-10 h-10 rounded-xl border hidden sm:flex items-center justify-center ${iconClass}`}>
      <Icon aria-hidden="true" className="w-5 h-5" />
    </span>
    <span className={`block sm:pr-12 text-[10px] font-extrabold uppercase tracking-wider ${selected ? 'text-brand-navy' : 'text-slate-400'}`}>
      {label}
    </span>
    <span className="block mt-2 text-2xl font-extrabold text-brand-navy tracking-tight leading-none tabular-nums">{count}</span>
    <span className="hidden sm:block mt-2 pr-1 text-[11px] font-semibold text-slate-400 truncate">{caption}</span>
  </button>
);

// Headline, audience, priority, content, publish time, programmes, intakes
// and the attachment removal, in that order.
const formSnapshot = (values: unknown[]) => JSON.stringify(values);
const EMPTY_FORM = formSnapshot(['', 'All', 'Info', '', '', [], [], false]);

export const AnnouncementManagement: React.FC = () => {
  // --- 1. Notification Toast and State Manager ---
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- View state: 'create' (draft form) vs 'history' (broadcast records) ---
  const [view, setView] = useState<'create' | 'history'>('history');

  // --- 2. Live Broadcast History Data store (loaded from announcementsApi) ---
  const [historyItems, setHistoryItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnnouncements = useCallback(() => {
    setLoading(true);
    setError(null);
    getAnnouncements()
      .then(setHistoryItems)
      .catch((e) => {
        // A stale list would keep offering Publish/Delete on items that may
        // already have changed, so clear it and show the error instead.
        setHistoryItems([]);
        setError(e instanceof Error ? e.message : 'Failed to load announcements.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  // --- 3. Draft Form States ---
  const [headline, setHeadline] = useState('');
  const [targetAudience, setTargetAudience] = useState<AudienceOption>('All');
  const [priorityLevel, setPriorityLevel] = useState<'Urgent' | 'Info' | 'General'>('Info');
  const [contentBody, setContentBody] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // What the form held when it was opened, so leaving it asks before
  // discarding changes.
  const initialDraft = useRef(EMPTY_FORM);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // When set, the form edits an existing announcement (PATCH) instead of creating one.
  const [editingId, setEditingId] = useState<string | null>(null);
  // A published announcement stays published when saved; a draft stays a draft.
  const [editingStatus, setEditingStatus] = useState<AnnouncementItem['status']>('Draft');
  // Publish time (datetime-local, Malaysia time; empty = publish when saved)
  // and registry targeting for student announcements.
  const [publishAtInput, setPublishAtInput] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [targetProgrammes, setTargetProgrammes] = useState<string[]>([]);
  const [targetIntakes, setTargetIntakes] = useState<string[]>([]);
  const [audienceOptions, setAudienceOptions] = useState<AnnouncementAudienceOptions | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [existingAttachmentName, setExistingAttachmentName] = useState<string | null>(null);
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AnnouncementItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- 4. Search, filters and pagination for the list ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('any');
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('any');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('any');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    getAnnouncementAudienceOptions().then(setAudienceOptions).catch(() => setAudienceOptions(null));
  }, []);

  // Live "who will get this" preview, refreshed as the audience changes.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getAnnouncementRecipientCount({
        target: targetForAudience(targetAudience),
        priority: priorityLevel,
        targetProgrammes,
        targetIntakes,
      })
        .then((count) => { if (!cancelled) setRecipientCount(count); })
        .catch(() => { if (!cancelled) setRecipientCount(null); });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [targetAudience, priorityLevel, targetProgrammes, targetIntakes]);

  // --- 5. Handlers ---
  const handleAudienceClick = (audience: AudienceOption) => {
    setTargetAudience(audience);
    if (audience !== 'Students') {
      // Programme and intake targeting only applies to student announcements.
      setTargetProgrammes([]);
      setTargetIntakes([]);
    }
  };

  const handlePriorityClick = (priority: 'Urgent' | 'Info' | 'General') => {
    setPriorityLevel(priority);
  };

  // Open the OS file picker (the hidden <input> below does the real work).
  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      setAttachedFile(file);
      showToast(`Attached file: ${file.name}`);
    }
  };

  const handleRemoveAttachment = () => {
    if (attachedFile) {
      setAttachedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast('Attachment removed.');
      return;
    }
    setRemoveExistingAttachment(true);
    showToast('The current attachment will be removed when you save.');
  };

  // Shared submit: creates a new announcement, or updates the draft being edited.
  // Publishing (status Active) makes the backend fan it out to the target audience.
  const submitAnnouncement = async (status: 'Active' | 'Draft') => {
    let publishAt: string | null;
    try {
      publishAt = scheduleTime(publishAtInput);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Enter a valid Malaysia date and time.');
      return;
    }
    setScheduleError(null);
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const forStudents = targetAudience === 'Students';
      const payload = {
        title: headline.trim(),
        content: contentBody,
        target: targetForAudience(targetAudience),
        priority: priorityLevel,
        status,
        attachment: attachedFile,
        removeAttachment: removeExistingAttachment,
        publishAt,
        // Announcements no longer expire; saving clears an end time set before.
        expiresAt: null,
        targetProgrammes: forStudents ? targetProgrammes : [],
        targetIntakes: forStudents ? targetIntakes : [],
      };
      const wasPublished = editingId !== null && editingStatus === 'Active';
      const saved = editingId
        ? await updateAnnouncement(editingId, payload)
        : await createAnnouncement(payload);
      const reach = saved.deliveredTo ?? 0;
      if (saved.status === 'Scheduled') {
        const when = formatScheduleMoment(saved.publishAt);
        showToast(
          wasPublished
            ? `Rescheduled for ${when}. Recipients no longer see it until then.`
            : `Scheduled for ${when}. It will be delivered then.`,
        );
      } else if (status === 'Active') {
        showToast(
          wasPublished
            ? `Changes saved. ${reach} recipient${reach === 1 ? '' : 's'} see the updated announcement.`
            : `Success: Announcement published and delivered to ${reach} recipient${reach === 1 ? '' : 's'}.`,
        );
      } else {
        showToast(editingId ? 'Draft updated and saved.' : 'Announcement saved as a draft.');
      }
      resetForm();
      setView('history');
      loadAnnouncements();
    } catch (err) {
      const fields = fieldErrors(err);
      setScheduleError(fields.publishAt ?? null);
      showToast(`Error: ${err instanceof Error ? err.message : 'Failed to save announcement.'}`);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Load a draft, or a published announcement, back into the form for editing.
  const handleEditDraft = (draft: AnnouncementItem) => {
    setView('create');
    setEditingId(draft.id);
    setEditingStatus(draft.status);
    setHeadline(draft.title);
    setContentBody(draft.content ?? draft.summary ?? '');
    setTargetAudience(audienceFromTarget(draft.target));
    setPriorityLevel(draft.priority);
    setPublishAtInput(toMalaysiaDateTimeLocalValue(draft.publishAt));
    setTargetProgrammes(draft.targetProgrammes ?? []);
    setTargetIntakes(draft.targetIntakes ?? []);
    setScheduleError(null);
    setExistingAttachmentName(draft.attachmentName ?? null);
    setRemoveExistingAttachment(false);
    setAttachedFile(null);
    initialDraft.current = formSnapshot([
      draft.title,
      audienceFromTarget(draft.target),
      draft.priority,
      draft.content ?? draft.summary ?? '',
      toMalaysiaDateTimeLocalValue(draft.publishAt),
      draft.targetProgrammes ?? [],
      draft.targetIntakes ?? [],
      false,
    ]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(
      draft.status === 'Active'
        ? `Editing published announcement: "${draft.title}"`
        : draft.status === 'Scheduled'
          ? `Editing scheduled announcement: "${draft.title}"`
          : `Editing draft: "${draft.title}"`,
    );
  };

  // Publish a draft straight from the list (no need to open it first).
  const handlePublishDraft = async (draft: AnnouncementItem) => {
    try {
      const saved = await updateAnnouncement(draft.id, {
        title: draft.title,
        content: draft.content ?? draft.summary ?? '',
        target: draft.target,
        priority: draft.priority,
        status: 'Active',
        attachment: null,
        expiresAt: null,
      });
      const reach = saved.deliveredTo ?? 0;
      showToast(
        saved.status === 'Scheduled'
          ? `Draft scheduled for ${formatScheduleMoment(saved.publishAt)}. It will be delivered then.`
          : `Draft published and delivered to ${reach} recipient${reach === 1 ? '' : 's'}.`,
      );
      if (editingId === draft.id) resetForm();
      loadAnnouncements();
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Failed to publish draft.'}`);
    }
  };

  const handleCancelEdit = () => {
    resetForm();
    showToast('Edit cancelled.');
  };

  // Submit flow: Publish Now
  const handlePublishNow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) {
      showToast('Error: Please enter a descriptive headline title.');
      return;
    }
    if (!contentBody.trim()) {
      showToast('Error: Please provide descriptive Content Body details.');
      return;
    }
    void submitAnnouncement('Active');
  };

  // Submit flow: Save Draft
  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) {
      showToast('Error: Please enter at least a headline before saving as draft.');
      return;
    }
    void submitAnnouncement('Draft');
  };

  const resetForm = () => {
    setHeadline('');
    setTargetAudience('All');
    setPriorityLevel('Info');
    setContentBody('');
    setAttachedFile(null);
    setEditingId(null);
    setEditingStatus('Draft');
    setPublishAtInput('');
    setScheduleError(null);
    setTargetProgrammes([]);
    setTargetIntakes([]);
    setExistingAttachmentName(null);
    setRemoveExistingAttachment(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    initialDraft.current = EMPTY_FORM;
  };

  const formDirty =
    !!attachedFile ||
    formSnapshot([
      headline,
      targetAudience,
      priorityLevel,
      contentBody,
      publishAtInput,
      targetProgrammes,
      targetIntakes,
      removeExistingAttachment,
    ]) !== initialDraft.current;

  // Deleting is permanent and also removes every recipient's copy, so it is
  // always confirmed first.
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id, title } = pendingDelete;
    setDeleting(true);
    try {
      await deleteAnnouncement(id);
      setHistoryItems(prev => prev.filter(item => item.id !== id));
      if (editingId === id) resetForm();
      showToast(`Removed announcement: "${title}"`);
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Failed to remove announcement.'}`);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  // The main button follows the publish time: a future time schedules instead.
  const willSchedule = isScheduledFor(publishAtInput);
  const publishLabel = !editingId
    ? (willSchedule ? 'Schedule' : 'Publish Now')
    : editingStatus === 'Active'
      ? (willSchedule ? 'Reschedule' : 'Save & Keep Published')
      : editingStatus === 'Scheduled'
        ? (willSchedule ? 'Save Schedule' : 'Publish Now')
        : (willSchedule ? 'Schedule Draft' : 'Publish Draft');

  // --- 6. The list holds every announcement, drafts included ---
  // Drafts also keep their own section under the composer.
  const drafts = historyItems.filter(item => item.status === 'Draft');

  // Counts on the status tiles, over everything loaded whatever the filters.
  const countOf = (status: AnnouncementItem['status']) =>
    historyItems.filter(item => item.status === status).length;
  const activeCount = countOf('Active');
  const urgentCount = historyItems.filter(
    item => item.status === 'Active' && item.priority === 'Urgent',
  ).length;
  const scheduledCount = countOf('Scheduled');
  const draftCount = drafts.length;

  const term = searchQuery.trim().toLowerCase();
  const filteredAnnouncements = historyItems.filter(item =>
    (statusFilter === 'any' || item.status === statusFilter) &&
    (audienceFilter === 'any' || item.target === audienceFilter) &&
    (priorityFilter === 'any' || item.priority === priorityFilter) &&
    (!term || [
      item.title,
      item.content || item.summary || '',
      audienceLine(item),
      item.priority,
      item.createdBy || '',
      STATUS_LOOK[item.status]?.label ?? item.status,
    ].some(text => text.toLowerCase().includes(term))),
  );
  const filtersOn =
    term !== '' || statusFilter !== 'any' || audienceFilter !== 'any' || priorityFilter !== 'any';

  const toggleStatus = (status: Exclude<StatusFilter, 'any'>) => {
    setStatusFilter(current => (current === status ? 'any' : status));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('any');
    setAudienceFilter('any');
    setPriorityFilter('any');
    setCurrentPage(1);
  };

  const openComposer = () => {
    resetForm();
    setView('create');
  };

  // Pagination bounds (a shrinking result never leaves an empty page)
  const totalPages = Math.ceil(filteredAnnouncements.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const displayedAnnouncements = filteredAnnouncements.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div id="announcement-module" className="text-left font-sans text-brand-navy text-xs pb-16 animate-fade-in">

      <PortalToast message={toast} />

      {view === 'create' ? (
      /* ==================== CREATE ANNOUNCEMENT VIEW ==================== */
      <RecordPage
        title={
            editingId
              ? editingStatus === 'Active'
                ? 'Edit Published Announcement'
                : editingStatus === 'Scheduled' ? 'Edit Scheduled Announcement' : 'Edit Draft Announcement'
              : 'Draft New Announcement'
          }
        subtitle={
            editingId
              ? editingStatus === 'Active'
                ? 'Changes reach recipients as soon as you save.'
                : editingStatus === 'Scheduled'
                  ? 'It publishes at the time below. Clear the time to publish it now.'
                  : 'Update the draft below, then save it or publish it.'
              : 'Craft your message for the FSKTM community.'
          }
        backLabel="Back to Announcements"
        onBack={() => { resetForm(); setView('history'); }}
        pageKey={`announcement:${editingId ?? 'new'}`}
        dirty={formDirty}
        busy={submitting}
      >
      <fieldset disabled={submitting} className="space-y-8">

        {/* Draft form. Enter must not trigger a native submit, which reloaded
            the page and lost the draft; the buttons below do the saving. */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 space-y-5 text-left shadow-3xs"
        >

            {/* Field A: Headline */}
            <div className="space-y-1.5">
              <label htmlFor="announcement-headline" className="form-label block">
                Headline
              </label>
              <input
                id="announcement-headline" 
                type="text"
                placeholder="Enter a descriptive title..."
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="form-control form-control-md"
              />
            </div>

            {/* Field B: Target Audience Chips Row */}
            <div className="space-y-2">
              <label className="form-label block">
                Target Audience
              </label>
              <SegmentedControl
                options={AUDIENCE_OPTIONS}
                value={targetAudience}
                onChange={handleAudienceClick}
                className="inline-flex flex-wrap"
              />
              <p className="text-[10px] text-slate-400 font-semibold">
                {targetAudience === 'All'
                  ? 'Reaches everyone (students, lecturers, staff, coordinators).'
                  : `Reaches ${targetAudience} only.`}
              </p>
            </div>

            {/* Field B2: Registry targeting, for student announcements only */}
            {targetAudience === 'Students' && (
              <div className="space-y-3 bg-slate-50/70 border border-slate-100 rounded-xl p-4">
                <ChipToggleGroup
                  label="Programmes"
                  options={audienceOptions?.programmes ?? []}
                  selected={targetProgrammes}
                  onToggle={(value) => setTargetProgrammes((current) => toggled(current, value))}
                  emptyText="Programme list unavailable."
                  labelFor={programmeName}
                />
                <ChipToggleGroup
                  label="Intakes"
                  options={audienceOptions?.intakes ?? []}
                  selected={targetIntakes}
                  onToggle={(value) => setTargetIntakes((current) => toggled(current, value))}
                  emptyText="No intakes are recorded in the registry yet."
                />
                <p className="text-[10px] text-slate-400 font-semibold">
                  Leave empty for everyone.
                </p>
              </div>
            )}

            {/* Field C: Priority Selector boxes */}
            <div className="space-y-2">
              <label className="form-label block">
                Priority Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {/* Urgent */}
                <button
                  type="button"
                  aria-pressed={priorityLevel === 'Urgent'}
                  onClick={() => handlePriorityClick('Urgent')}
                  className={`border rounded-xl p-3 flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer ${
                    priorityLevel === 'Urgent'
                      ? 'border-red-400 bg-red-50/50 ring-1 ring-red-500'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className={`w-4 h-4 ${priorityLevel === 'Urgent' ? 'text-red-500' : 'text-slate-400'}`} />
                  <span className={`text-[9px] uppercase font-black tracking-widest ${priorityLevel === 'Urgent' ? 'text-red-700' : 'text-slate-500'}`}>
                    Urgent
                  </span>
                </button>

                {/* Info */}
                <button
                  type="button"
                  aria-pressed={priorityLevel === 'Info'}
                  onClick={() => handlePriorityClick('Info')}
                  className={`border rounded-xl p-3 flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer ${
                    priorityLevel === 'Info'
                      ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Info className={`w-4 h-4 ${priorityLevel === 'Info' ? 'text-blue-500' : 'text-slate-400'}`} />
                  <span className={`text-[9px] uppercase font-black tracking-widest ${priorityLevel === 'Info' ? 'text-blue-700' : 'text-slate-500'}`}>
                    Info
                  </span>
                </button>

                {/* General */}
                <button
                  type="button"
                  aria-pressed={priorityLevel === 'General'}
                  onClick={() => handlePriorityClick('General')}
                  className={`border rounded-xl p-3 flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer ${
                    priorityLevel === 'General'
                      ? 'border-slate-450 bg-slate-100 ring-1 ring-slate-800'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Minus className={`w-4 h-4 ${priorityLevel === 'General' ? 'text-slate-700' : 'text-slate-400'}`} />
                  <span className={`text-[9px] uppercase font-black tracking-widest ${priorityLevel === 'General' ? 'text-slate-800' : 'text-slate-500'}`}>
                    General
                  </span>
                </button>
              </div>
            </div>

            {/* Field D: Content Body Textarea with dynamic attach button */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="announcement-content" className="form-label block">
                  Content Body
                </label>
                <button
                  type="button"
                  onClick={handleAttachFile}
                  className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-slate-600 hover:text-blue-600 transition"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Attach File</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelected}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
                />
              </div>

              <div className="space-y-2">
                <textarea
                  id="announcement-content"
                  rows={6}
                  placeholder="Write your announcement content here..."
                  value={contentBody}
                  onChange={(e) => setContentBody(e.target.value)}
                  className="form-control form-control-md resize-none"
                />

                {/* Below the message, not over it, so it never hides text. */}
                {(attachedFile || existingAttachmentName) && (
                  <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2 text-[10px] shadow-2xs">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className={`font-bold truncate max-w-[200px] ${removeExistingAttachment && !attachedFile ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {attachedFile ? attachedFile.name : existingAttachmentName}
                      </span>
                      {!attachedFile && existingAttachmentName && (
                        <span className="text-slate-400 font-semibold italic">
                          {removeExistingAttachment ? '(will be removed when saved)' : '(current; upload a file to replace it)'}
                        </span>
                      )}
                    </div>
                    {!(removeExistingAttachment && !attachedFile) && (
                      <button
                        type="button"
                        aria-label="Remove attachment"
                        onClick={handleRemoveAttachment}
                        className="text-slate-400 hover:text-red-500 p-0.5 rounded transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Field E: Schedule (Malaysia time) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="announcement-publish-at" className="form-label block">
                  Publish At (optional)
                </label>
                <input
                  id="announcement-publish-at"
                  type="datetime-local"
                  value={publishAtInput}
                  onChange={(e) => { setPublishAtInput(e.target.value); setScheduleError(null); }}
                  className={`form-control form-control-md ${scheduleError ? 'form-control-error' : ''}`}
                />
                <p className="text-[10px] text-slate-400 font-semibold">Leave empty to publish now.</p>
              </div>
              {scheduleError && (
                <p role="alert" className="md:col-span-2 text-[11px] font-semibold text-rose-600">{scheduleError}</p>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <p className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {recipientCount === null
                  ? 'Recipient count unavailable.'
                  : `${willSchedule ? 'Would reach' : 'Reaches'} ${recipientCount} ${recipientCount === 1 ? 'person' : 'people'} right now${
                      priorityLevel === 'Urgent' ? '.' : ', skipping anyone who turned alerts off.'
                    }`}
              </p>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                {(!editingId || editingStatus === 'Draft') && (
                  <PortalButton
                    type="button"
                    onClick={handleSaveDraft}
                    variant="secondary"
                    size="md"
                    disabled={submitting}
                  >
                    {editingId ? 'Update Draft' : 'Save Draft'}
                  </PortalButton>
                )}

                <PortalButton
                  type="button"
                  onClick={handlePublishNow}
                  variant="primary"
                  size="md"
                  icon={willSchedule ? CalendarClock : Send}
                  disabled={submitting}
                >
                  {submitting ? 'Saving…' : publishLabel}
                </PortalButton>
              </div>
            </div>

        </form>

        {loading && <LoadingState message="Loading your announcements…" />}
        {!loading && error && <ErrorState message={error} onRetry={loadAnnouncements} />}

        {/* ==================== SAVED DRAFTS (below the form, not in history) ==================== */}
        {drafts.length > 0 && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 space-y-4 text-left shadow-3xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="section-label">Saved Drafts</h3>
              </div>
              <StatusBadge tone="warning" className="rounded-lg px-2.5 py-1 text-[9px] shrink-0">
                {drafts.length} draft{drafts.length === 1 ? '' : 's'}
              </StatusBadge>
            </div>

            <div className="divide-y divide-slate-100">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className={`py-3.5 flex flex-col md:flex-row md:items-start md:justify-between gap-3 ${
                    editingId === draft.id ? 'bg-blue-50/40 -mx-2 px-2 rounded-lg' : ''
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-800 text-[12px] leading-snug">
                        {draft.title || 'Untitled draft'}
                      </span>
                      <StatusBadge tone={getStatusBadgeTone(draft.priority)} className="rounded-md px-1.5 py-0.5 text-[8px]">
                        {draft.priority}
                      </StatusBadge>
                      <StatusBadge tone="neutral" className="rounded-md px-1.5 py-0.5 text-[8px]">
                        {draft.target}
                      </StatusBadge>
                      {editingId === draft.id && (
                        <StatusBadge tone="info" className="rounded-md px-1.5 py-0.5 text-[8px]">
                          Editing
                        </StatusBadge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed line-clamp-2">
                      {draft.summary || 'No content yet.'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold">By {draft.createdBy || 'Postgraduate Office'}</p>
                    {draft.attachmentName && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                        <Paperclip className="w-3 h-3" />
                        {draft.attachmentName}
                      </span>
                    )}
                  </div>

                  {draft.canManage !== false && (
                  <div className="flex items-center gap-2 shrink-0">
                    <PortalButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Pencil}
                      onClick={() => handleEditDraft(draft)}
                    >
                      Edit
                    </PortalButton>
                    <PortalButton
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={Send}
                      onClick={() => handlePublishDraft(draft)}
                    >
                      Publish
                    </PortalButton>
                    <PortalButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setPendingDelete(draft)}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      Delete
                    </PortalButton>
                  </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </fieldset>
      </RecordPage>
      ) : (
      /* ==================== ANNOUNCEMENTS LIST VIEW ==================== */
      <div id="announcements-history-view" className="space-y-6">

        <PageHeader
          title="Announcements"
          actions={(
            <PortalButton variant="primary" icon={Plus} onClick={openComposer}>
              New announcement
            </PortalButton>
          )}
        />

        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <StatusTile
            label="Live"
            count={activeCount}
            caption={urgentCount > 0 ? `${urgentCount} urgent` : 'Visible to recipients'}
            icon={Radio}
            iconClass="bg-emerald-50 text-emerald-600 border-emerald-100"
            selected={statusFilter === 'Active'}
            onClick={() => toggleStatus('Active')}
          />
          <StatusTile
            label="Scheduled"
            count={scheduledCount}
            caption="Waiting to publish"
            icon={CalendarClock}
            iconClass="bg-blue-50 text-blue-600 border-blue-100"
            selected={statusFilter === 'Scheduled'}
            onClick={() => toggleStatus('Scheduled')}
          />
          <StatusTile
            label="Drafts"
            count={draftCount}
            caption="Not published yet"
            icon={Pencil}
            iconClass="bg-amber-50 text-amber-600 border-amber-100"
            selected={statusFilter === 'Draft'}
            onClick={() => toggleStatus('Draft')}
          />
        </div>

        <section
          aria-labelledby="announcement-list-heading"
          className="bg-white border border-slate-200/80 rounded-2xl shadow-3xs overflow-hidden"
        >

          {/* Search and filters */}
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                aria-label="Search announcements"
                placeholder="Search title, message, audience or author..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="form-control form-control-sm pl-10 pr-4 shadow-3xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SelectMenu
                variant="filter"
                prefix="Status"
                aria-label="Filter by status"
                value={statusFilter}
                options={STATUS_FILTER_OPTIONS}
                onChange={(status) => { setStatusFilter(status); setCurrentPage(1); }}
              />
              <SelectMenu
                variant="filter"
                prefix="Audience"
                aria-label="Filter by audience"
                value={audienceFilter}
                options={AUDIENCE_FILTER_OPTIONS}
                onChange={(audience) => { setAudienceFilter(audience); setCurrentPage(1); }}
              />
              <SelectMenu
                variant="filter"
                prefix="Priority"
                aria-label="Filter by priority"
                value={priorityFilter}
                options={PRIORITY_FILTER_OPTIONS}
                onChange={(priority) => { setPriorityFilter(priority); setCurrentPage(1); }}
              />
              {filtersOn && (
                <PortalButton variant="ghost" icon={X} onClick={clearFilters}>
                  Clear
                </PortalButton>
              )}
            </div>
          </div>

          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
            <h2 id="announcement-list-heading" className="section-label">
              {LIST_HEADING[statusFilter]}
            </h2>
            {!loading && !error && (
              <span className="card-caption text-slate-400 text-right">
                {filteredAnnouncements.length} {filteredAnnouncements.length === 1 ? 'announcement' : 'announcements'}, newest first
              </span>
            )}
          </div>

          {loading ? (
            <LoadingState message="Loading announcements…" />
          ) : error ? (
            <ErrorState message={error} onRetry={loadAnnouncements} />
          ) : displayedAnnouncements.length === 0 ? (
            <div className="px-6 py-14 flex flex-col items-center text-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                {filtersOn ? <SearchX className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
              </span>
              <div className="space-y-1">
                <p className="section-label">
                  {filtersOn ? 'No announcements match' : 'No announcements yet'}
                </p>
                <p className="card-description">
                  {filtersOn
                    ? 'Try a different search, or clear the filters to see everything.'
                    : 'Announcements you create will appear here.'}
                </p>
              </div>
              {filtersOn && (
                <PortalButton size="sm" icon={X} onClick={clearFilters}>
                  Clear filters
                </PortalButton>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {displayedAnnouncements.map((item) => {
                const look = STATUS_LOOK[item.status] ?? { label: item.status, tone: 'neutral' as BadgeTone };
                const name = item.title || 'Untitled draft';
                const preview = (item.content || item.summary || '').replace(/\s+/g, ' ').trim();
                return (
                  <li
                    key={item.id}
                    className="relative pl-6 pr-5 py-4 flex flex-col md:flex-row md:items-start gap-3 md:gap-6 hover:bg-slate-50/60 transition-colors"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 inset-y-0 w-1 ${PRIORITY_EDGE[item.priority] ?? 'bg-slate-300'}`}
                    />

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="section-label leading-snug [overflow-wrap:anywhere]">{name}</h3>
                        <StatusBadge
                          tone={look.tone}
                          dot={item.status === 'Active'}
                          pulse={item.status === 'Active'}
                          className="px-2 py-0.5 text-[9px]"
                        >
                          {look.label}
                        </StatusBadge>
                        <StatusBadge tone={getStatusBadgeTone(item.priority)} className="px-2 py-0.5 text-[9px]">
                          {item.priority}
                        </StatusBadge>
                      </div>

                      <p className="card-description line-clamp-2 [overflow-wrap:anywhere]">
                        {preview || 'No message yet.'}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 card-caption text-slate-500">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <Users aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="sr-only">Audience:</span>
                          <span className="[overflow-wrap:anywhere]">{audienceLine(item)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          {item.status === 'Scheduled' ? (
                            <CalendarClock aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ) : (
                            <Calendar aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          {timingLine(item)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          By {item.createdBy || 'Postgraduate Office'}
                        </span>
                        {item.attachmentName && (
                          <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                            <Paperclip aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="sr-only">Attachment:</span>
                            <span className="truncate">{item.attachmentName}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {item.canManage !== false ? (
                      <div className="flex items-center gap-2 shrink-0 md:w-32 md:justify-end">
                        {item.status !== 'Expired' && (
                          <PortalButton
                            size="sm"
                            icon={Pencil}
                            aria-label={`Edit "${name}"`}
                            onClick={() => handleEditDraft(item)}
                          >
                            Edit
                          </PortalButton>
                        )}
                        <button
                          type="button"
                          aria-label={`Remove "${name}"`}
                          title="Remove"
                          onClick={() => setPendingDelete(item)}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="card-caption inline-flex items-center gap-1.5 text-slate-400 shrink-0 md:w-32 md:justify-end md:pt-2">
                        <Lock aria-hidden="true" className="w-3.5 h-3.5" />
                        View only
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && !error && filteredAnnouncements.length > 0 && (
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
              <p className="card-caption text-slate-500">
                Showing <strong className="font-bold text-slate-700">{startIndex + 1}</strong> to{' '}
                <strong className="font-bold text-slate-700">
                  {Math.min(startIndex + itemsPerPage, filteredAnnouncements.length)}
                </strong>{' '}
                of <strong className="font-bold text-slate-700">{filteredAnnouncements.length}</strong>
              </p>

              {totalPages > 1 && (
                <nav aria-label="Announcement pages" className="flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={safePage === 1}
                    onClick={() => setCurrentPage(Math.max(safePage - 1, 1))}
                    className="w-8 h-8 flex items-center justify-center border border-slate-200 bg-white text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {pageWindow(safePage, totalPages).map((pageNum, index) =>
                    pageNum === null ? (
                      <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-[11px] font-black text-slate-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        type="button"
                        aria-label={`Page ${pageNum}`}
                        aria-current={pageNum === safePage ? 'page' : undefined}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 text-[11px] font-black rounded-lg transition flex items-center justify-center cursor-pointer ${
                          pageNum === safePage
                            ? 'border border-blue-600 bg-blue-50 text-blue-600'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={safePage === totalPages}
                    onClick={() => setCurrentPage(Math.min(safePage + 1, totalPages))}
                    className="w-8 h-8 flex items-center justify-center border border-slate-200 bg-white text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </nav>
              )}
            </div>
          )}

        </section>

      </div>

      )}

      <PortalConfirmModal
        isOpen={pendingDelete !== null}
        title="Remove this announcement?"
        message={
          pendingDelete
            ? `"${pendingDelete.title}" will be deleted permanently${
                pendingDelete.status === 'Active' ? ' and removed from every recipient\'s notifications' : ''
              }.`
            : ''
        }
        confirmLabel="Remove"
        tone="danger"
        isLoading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

    </div>
  );
};
