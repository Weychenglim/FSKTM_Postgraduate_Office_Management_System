import { PortalModal } from './PortalModal';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bell, 
  ChevronLeft,
  Search, 
  Mail, 
  MailOpen, 
  Calendar, 
  CheckCircle, 
  X, 
  ChevronDown,
  Info,
  Lock,
  Clock,
  ArrowUpRight,
  FileText,
  Download,
  Megaphone,
  BellOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, PortalButton, PortalToast, SegmentedControl, StatusDot } from './PortalPrimitives';

type FeedTab = 'announcements' | 'notifications';
const FEED_TABS: readonly FeedTab[] = ['announcements', 'notifications'];
import { LoadingState, ErrorState } from './StateViews';
import { NotificationItem } from '../types';
import { downloadAnnouncementAttachment } from '../services';
import { useLocation } from 'react-router';
import { useNotifications } from '../context/NotificationsContext';
import { THIN_SCROLLBAR } from '../utils/scrollbar';
import { notificationRecordRoute, type OpenNotificationState } from '../utils/notificationLinks';

// ==================== DEDICATED ATOMIC UI PATTERNS ====================

interface PriorityBadgeProps {
  level: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ level }) => {
  const lower = level.toLowerCase();
  const tone = lower.includes('high')
    ? 'bg-rose-50 text-rose-600 border-rose-100'
    : lower.includes('medium')
    ? 'bg-blue-50 text-blue-600 border-blue-100'
    : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-3.5 py-1.5 ${tone} border rounded-full text-[10px] font-black uppercase tracking-wider select-none`}>
      {level}
    </span>
  );
};

interface ModuleBadgeProps {
  label: string;
}

export const ModuleBadge: React.FC<ModuleBadgeProps> = ({ label }) => {
  return (
    <span className="inline-flex items-center px-4 py-1.5 bg-blue-50/80 text-blue-600 border border-blue-100 rounded-full text-[10px] font-black uppercase tracking-wider select-none">
      {label}
    </span>
  );
};

interface AttachmentCardProps {
  name: string;
  meta: string;
  disabled?: boolean;
}

export const AttachmentCard: React.FC<AttachmentCardProps> = ({ name, meta, disabled = true }) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/85 rounded-xl gap-4 text-left transition hover:bg-slate-50/90 shadow-3xs">
      <div className="flex items-center gap-3">
        {/* PDF Block Icon */}
        <div className="w-10 h-12 bg-rose-100/60 rounded-lg flex flex-col items-center justify-center text-[10px] font-black text-rose-600 border border-rose-200 select-none relative overflow-hidden shrink-0">
          <span className="text-[7.5px] text-rose-500 uppercase font-black tracking-wider leading-none mt-1">DOC</span>
          <FileText className="w-4.5 h-4.5 text-rose-600 mt-0.5" />
          <div className="absolute bottom-0 inset-x-0 bg-rose-600 text-[8px] text-white text-center font-bold py-0.5 leading-none">
            PDF
          </div>
        </div>
        
        <div>
          <h4 className="card-value text-slate-800 leading-snug">
            {name}
          </h4>
          <p className="card-caption text-slate-450 mt-0.5">
            {meta}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 self-stretch sm:self-auto justify-center min-w-[130px]">
        <button
          type="button"
          disabled={disabled}
          className="w-full px-4 py-2 bg-slate-105 border border-slate-200 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-not-allowed select-none transition"
        >
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Open Letter</span>
        </button>
        <span className="card-caption text-slate-400 tracking-wide uppercase italic leading-none">
          Available after approval
        </span>
      </div>
    </div>
  );
};

interface InfoNoteProps {
  text: string;
}

export const InfoNote: React.FC<InfoNoteProps> = ({ text }) => {
  return (
    <div className="card-caption flex items-start md:items-center gap-2 text-slate-450 select-none justify-start px-1">
      <Info className="w-4 h-4 text-slate-400 shrink-0" />
      <p className="leading-snug text-left">{text}</p>
    </div>
  );
};

interface MetadataGridProps {
  from: string;
  to: string;
  reference: string;
}

export const MetadataGrid: React.FC<MetadataGridProps> = ({ from, to, reference }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 border-y border-slate-100 my-5 text-left">
      <div className="space-y-1">
        <span className="card-label block uppercase text-slate-400 tracking-wider">From</span>
        <h4 className="card-value text-slate-800">{from}</h4>
      </div>
      <div className="space-y-1">
        <span className="card-label block uppercase text-slate-400 tracking-wider">To</span>
        <h4 className="card-value text-slate-800">{to}</h4>
      </div>
      <div className="space-y-1">
        <span className="card-label block uppercase text-slate-400 tracking-wider">Reference</span>
        <h4 className="card-value text-slate-800 tracking-wider font-mono bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 inline-block">
          {reference}
        </h4>
      </div>
    </div>
  );
};

interface TabEmptyStateProps {
  tab: 'announcements' | 'notifications';
  searching: boolean;
}

export const TabEmptyState: React.FC<TabEmptyStateProps> = ({ tab, searching }) => {
  const isNotifications = tab === 'notifications';
  const Icon = searching ? Search : isNotifications ? BellOff : Megaphone;
  const title = searching
    ? 'No matches found'
    : isNotifications
    ? 'No notifications yet'
    : 'No announcements yet';
  const message = searching
    ? 'Try a different search term.'
    : isNotifications
    ? 'Updates about your supervisor and panel appointments, approvals and other workflow steps will appear here.'
    : 'Published announcements addressed to you will show up here.';
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-16 px-6 flex flex-col items-center text-center select-none">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-150 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="section-label">{title}</h3>
      <p className="card-description mt-1.5 max-w-sm">{message}</p>
    </div>
  );
};

// ==================== NOTIFICATION CORE DATA ====================

// NotificationItem now lives in src/types.

interface NotificationsAnnouncementsProps {
  onBack: () => void;
  onOpenWorkflowRecord?: (notification: NotificationItem) => void;
}

export const NotificationsAnnouncements: React.FC<NotificationsAnnouncementsProps> = ({
  onBack,
  onOpenWorkflowRecord,
}) => {
  // 1. Notifications come from the shared store so reading here updates the
  //    header bell badge instantly (and vice versa).
  const { items, loading, error, reload, markRead, markAllRead } = useNotifications();

  // Interactive dialog visibility states
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Bell view is split into two tabs. Announcements are the broadcast feed
  // (already built); Notifications are personal system events (supervisor
  // appointment updates, confirmation letters, …) and stay empty until those
  // modules publish non-announcement notifications.
  const [activeTab, setActiveTab] = useState<'announcements' | 'notifications'>('announcements');

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const priorityLabel = (priority: string) =>
    priority === 'high' ? 'High Priority' : priority === 'medium' ? 'Medium Priority' : 'General';

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      triggerToast('All notifications marked as read.');
    } catch (err) {
      triggerToast(`Error: ${err instanceof Error ? err.message : 'Failed to update.'}`);
    }
  };

  const handleToggleReadState = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Stop row click trigger
    const target = items.find(it => it.id === id);
    if (!target) return;
    const nextUnread = !target.isUnread;
    try {
      await markRead(id, !nextUnread);
      triggerToast(`Marked notification as ${nextUnread ? 'unread' : 'read'}.`);
    } catch (err) {
      triggerToast(`Error: ${err instanceof Error ? err.message : 'Failed to update.'}`);
    }
  };

  const handleDownloadAttachment = async (notif: NotificationItem) => {
    if (!notif.announcementId || !notif.attachmentName) return;
    try {
      await downloadAnnouncementAttachment(notif.announcementId, notif.attachmentName);
      triggerToast(`Downloading ${notif.attachmentName}…`);
    } catch (err) {
      triggerToast(`Error: ${err instanceof Error ? err.message : 'Download failed.'}`);
    }
  };

  // Split the shared feed into the two tabs by the backend `isAnnouncement` flag.
  const announcementFeed = items.filter((it) => it.isAnnouncement);
  const notificationFeed = items.filter((it) => !it.isAnnouncement);
  const activeFeed = activeTab === 'announcements' ? announcementFeed : notificationFeed;

  // Filtered computed list matches (scoped to the active tab).
  const filteredNotifications = activeFeed.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const noun = activeTab === 'announcements' ? 'announcements' : 'notifications';

  // The detail dialog closes on Escape and starts with focus on its close button.
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!selectedNotification) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedNotification(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNotification]);

  const openNotification = async (notification: NotificationItem) => {
    if (notification.isUnread) {
      // A retracted announcement's rows are deleted server-side, so an already
      // loaded feed can hold an id that now 404s. Opening it must still work.
      await markRead(notification.id, true).catch(() => undefined);
    }
    if (notificationRecordRoute(notification) && onOpenWorkflowRecord) {
      onOpenWorkflowRecord(notification);
      return;
    }
    setSelectedNotification(notification);
  };

  // The bell dropdown sends announcements here to be read in the detail view.
  const location = useLocation();
  const requestedId = (location.state as OpenNotificationState | null)?.openNotificationId;
  const openedRequest = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedId || openedRequest.current === requestedId) return;
    const requested = items.find((item) => item.id === requestedId);
    if (!requested) return;
    openedRequest.current = requestedId;
    setActiveTab(requested.isAnnouncement ? 'announcements' : 'notifications');
    setSelectedNotification(requested);
  }, [requestedId, items]);

  return (
    <div id="notifications-announcements-root" className="space-y-8 text-left font-sans text-brand-navy text-xs pb-16 animate-fade-in relative">
      
      <PortalToast message={toast} />

      <PageHeader
        title="Notifications & Announcements"
        subtitle="Broadcast announcements and your personal system notifications."
        backLabel="Back to Dashboard"
        onBack={onBack}
        actions={(
          <PortalButton variant="primary" size="md" icon={CheckCircle} onClick={handleMarkAllRead}>
            Mark All as Read
          </PortalButton>
        )}
      />

      <SegmentedControl
        variant="tabs"
        options={FEED_TABS}
        value={activeTab}
        onChange={(tab) => { setActiveTab(tab); setSearchQuery(''); }}
        labels={{
          announcements: `Announcements (${announcementFeed.length})`,
          notifications: `Notifications (${notificationFeed.length})`,
        }}
      />

      {/* FILTER SEARCH WRAPPER CARD */}
      <div className="space-y-4">

        {/* Dynamic Search row */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-3xs select-none">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder={`Search ${noun}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control form-control-sm pl-10 pr-4"
            />
          </div>

          <div className="card-caption text-slate-400 shrink-0">
            Total {filteredNotifications.length} {noun}
          </div>
        </div>

        {/* LIST FEED PORTLET OF ITEMS */}
        <div className="space-y-3.5" role="list">
          {loading ? (
            <LoadingState message={`Loading ${noun}…`} />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : filteredNotifications.length === 0 ? (
            <TabEmptyState tab={activeTab} searching={searchQuery.trim().length > 0} />
          ) : filteredNotifications.map((it) => {
            const isHigh = it.priority === 'high';
            const isAnn = it.isAnnouncement;
            // The row opens the item; the read toggle is a separate button
            // beside it (a button inside a button is invalid and unreachable
            // for keyboard and screen-reader users).
            return (
              <div
                key={it.id}
                role="listitem"
                className={`w-full text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 hover:shadow-2xs transition duration-150 flex items-start justify-between gap-4 relative ${
                  it.isUnread ? 'ring-1 ring-blue-500/10 bg-slate-50/20' : ''
                }`}
              >
                {/* Left Indicator Strip color */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 rounded-l-xl ${
                  isHigh ? 'bg-rose-500' : isAnn ? 'bg-indigo-500' : 'bg-slate-350'
                }`} />

                <button
                  type="button"
                  onClick={() => void openNotification(it)}
                  className="flex-1 min-w-0 text-left space-y-1 pl-2 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  <div className="flex items-center gap-2">
                    {it.isUnread && (
                      <StatusDot tone="info" className="w-2 h-2" />
                    )}
                    <h3 className="section-label hover:text-blue-600 transition-colors">
                      {it.title}
                    </h3>
                  </div>

                  <span className="card-caption block uppercase text-slate-400 tracking-wider">
                    {it.service}
                  </span>

                  <p className="card-description line-clamp-2">
                    {it.description}
                  </p>
                </button>

                {/* Right stamp column */}
                <div className="card-caption flex items-center gap-4 text-right text-slate-400 shrink-0 select-none">
                  <span className="hidden sm:inline-block truncate max-w-[120px]">{it.timeAgo.split(', ')[0]}</span>
                  <button
                    type="button"
                    onClick={(e) => handleToggleReadState(it.id, e)}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition cursor-pointer shrink-0"
                    title={it.isUnread ? 'Mark as Read' : 'Mark as Unread'}
                    aria-label={it.isUnread ? `Mark "${it.title}" as read` : `Mark "${it.title}" as unread`}
                  >
                    {it.isUnread ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================== SCREEN COMPONENT: DIALOG WINDOW CONTEXT ==================== */}
      
      {/* A column while open, so the message scrolls and Close stays in view on a phone. */}
      {selectedNotification ? <PortalModal isOpen onClose={() => setSelectedNotification(null)} labelledBy="notification-dialog-title" className="max-w-2xl p-0 open:flex open:flex-col">

              <div id="modal-header-panel" className="drawer-header">
                <div className="flex items-center gap-2.5 min-w-0">
                  {selectedNotification.isAnnouncement
                    ? <Megaphone className="w-5 h-5 text-indigo-500 shrink-0" />
                    : <Bell className="w-5 h-5 text-indigo-500 shrink-0" />}
                  <h2 id="notification-dialog-title" className="font-black text-brand-navy text-[15px] tracking-tight truncate">
                    {selectedNotification.title}
                  </h2>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-transparent text-slate-600 hover:bg-slate-100 hover:text-brand-navy transition cursor-pointer shrink-0"
                  title="Close"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body Scroll container */}
              <div className={`flex-1 min-h-0 overflow-y-auto p-6 md:p-8 space-y-5 mr-1 ${THIN_SCROLLBAR}`}>
                
                {/* Priority, Timestamp and Module Badge Row Segment */}
                <div className="flex flex-wrap items-center gap-3.5 select-none">
                  {/* Priority Badge */}
                  <PriorityBadge level={priorityLabel(selectedNotification.priority)} />

                  {/* Timestamp Calendar Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-full text-[10px] font-black text-slate-505 select-none leading-none">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedNotification.timeAgo}</span>
                  </div>

                  {/* Module Badge */}
                  <ModuleBadge label={selectedNotification.moduleLabel || 'Notification'} />
                </div>

                {/* Metadata Grid (FROM, TO, REFERENCE) */}
                <MetadataGrid 
                  from={selectedNotification.service}
                  to={selectedNotification.recipient}
                  reference={selectedNotification.reference}
                />

                {/* Message text body content paragraphs */}
                <div className="space-y-4">
                  <span className="card-label uppercase tracking-wider text-slate-400 block mb-1">
                    Message
                  </span>
                  
                  <div className="card-description text-slate-700 leading-relaxed space-y-3 prose pr-2">
                    {(selectedNotification.detailedMessage || selectedNotification.description)
                      .split('\n')
                      .filter((line) => line.trim().length > 0)
                      .map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                  </div>
                </div>

                {/* Document Attachments Panel: only when the announcement carries a file */}
                {selectedNotification.attachmentName && (
                  <div className="space-y-2.5">
                    <span className="card-label uppercase tracking-wider text-slate-400 block">
                      Attached Documents
                    </span>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/85 rounded-xl gap-4 text-left shadow-3xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-12 bg-blue-100/60 rounded-lg flex flex-col items-center justify-center border border-blue-200 select-none shrink-0">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="card-value text-slate-800 leading-snug break-all">
                            {selectedNotification.attachmentName}
                          </h4>
                          <p className="card-caption text-slate-450 mt-0.5">
                            Attached by {selectedNotification.service}
                          </p>
                        </div>
                      </div>

                      <PortalButton
                        variant="primary"
                        size="sm"
                        icon={Download}
                        onClick={() => handleDownloadAttachment(selectedNotification)}
                        className="w-full sm:w-auto shrink-0"
                      >
                        Download
                      </PortalButton>
                    </div>
                  </div>
                )}

                {/* Automatic Notice Info Stamp Footer Note */}
                <div className="pt-2 border-t border-slate-100">
                  <InfoNote text="This notification was generated automatically by the system. No reply is required." />
                </div>

              </div>

              {/* Footer CTA dismiss bar action buttons properly layout */}
              <div className="drawer-footer select-none">
                {/* Opening an item already marks it read, so Close is all that is needed. */}
                <PortalButton variant="secondary" size="md" onClick={() => setSelectedNotification(null)}>
                  Close
                </PortalButton>
              </div>

            </PortalModal> : null}

    </div>
  );
};
