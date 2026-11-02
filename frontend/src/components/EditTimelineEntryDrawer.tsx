import { Link } from 'react-router';
import { PortalSelect } from './PortalSelect';
import { PortalModal, useModalTitle } from './PortalModal';
import { DraftNavigationGuard } from './DraftNavigationGuard';
import { AlertMessage } from './AlertMessage';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar,
  Layers,
  Save,
  Check
} from 'lucide-react';
import { PortalButton, PortalConfirmModal } from './PortalPrimitives';

interface TimelineEntry {
  id: string;
  event: string;
  category: 'Supervisor Appointment' | 'Panel Appointment' | 'Document Submission' | 'Announcements' | 'Marks & Evaluation' | 'Research Project (P1)' | 'Research Project (P2)';
  startDate: string;
  endDate: string;
  targetRole: ('STUDENT' | 'LECTURER' | 'OFFICE_STAFF')[];
  description?: string;
  action?: string;
}

interface EditTimelineEntryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entry: TimelineEntry | null;
  onSave: (updatedEntry: TimelineEntry & { extensionReason?: string; expectedDeadlineEnd?: string }) => void;
  timelineLabel: string;
  busy?: boolean;
  error?: string | null;
  managePeriodUrl?: string;
}

export const EditTimelineEntryDrawer: React.FC<EditTimelineEntryDrawerProps> = ({
  isOpen,
  onClose,
  entry,
  onSave,
  timelineLabel,
  busy = false,
  error,
  managePeriodUrl,
}) => {
  const titleId = useModalTitle();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState<TimelineEntry['category']>('Research Project (P1)');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetRole, setTargetRole] = useState<TimelineEntry['targetRole']>([]);
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('Student');
  const [extensionReason, setExtensionReason] = useState('');

  // Synchronize when the entry is passed into the drawer
  useEffect(() => {
    setConfirmDiscard(false);
    setExtensionReason('');
    if (entry) {
      setEventName(entry.event || '');
      setCategory(entry.category || 'Research Project (P1)');
      
      // Map display format dates like "01 Oct 2025" into "2025-10-01" to match HTML input types
      setStartDate(convertToInputDate(entry.startDate));
      setEndDate(convertToInputDate(entry.endDate));
      
      setTargetRole(entry.targetRole || []);
      setDescription(entry.description || '');
      setAction(entry.action ?? entry.targetRole.join(' / '));
    }
  }, [entry, isOpen]);

  // Helper code to map visual text format dates into HTML date fields
  const convertToInputDate = (dateText: string): string => {
    if (!dateText) return '';
    const parts = dateText.split(' ');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const monthStr = parts[1].toLowerCase();
      const year = parts[2];
      
      const months: { [key: string]: string } = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };
      
      const month = months[monthStr.slice(0, 3)] || '10';
      return `${year}-${month}-${day}`;
    }
    return dateText; // Fallback
  };

  // Helper code to map HTML values back into aesthetic user presentation dates
  const formatToDisplayDate = (inputDate: string): string => {
    if (!inputDate) return '';
    const date = new Date(inputDate);
    if (isNaN(date.getTime())) return inputDate;
    
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !eventName.trim() || !action.trim() || (isExtension && !extensionReason.trim())) return;

    if (entry) {
      onSave({
        ...entry,
        event: eventName,
        category,
        startDate: formatToDisplayDate(startDate),
        endDate: formatToDisplayDate(endDate),
        targetRole,
        description,
        action: action.trim(),
        ...(isExtension ? { extensionReason: extensionReason.trim(), expectedDeadlineEnd: convertToInputDate(entry.endDate) } : {}),
      });
    }
  };

  const toggleRole = (role: TimelineEntry['targetRole'][number]) => {
    if (targetRole.includes(role)) {
      setTargetRole(prev => prev.filter(r => r !== role));
    } else {
      setTargetRole(prev => [...prev, role]);
    }
  };

  const isExtension = !!entry && !managePeriodUrl && endDate > convertToInputDate(entry.endDate);
  const dirty = !!entry && (action !== (entry.action ?? entry.targetRole.join(' / ')) || eventName !== entry.event || category !== entry.category || startDate !== convertToInputDate(entry.startDate) || endDate !== convertToInputDate(entry.endDate) || description !== (entry.description ?? '') || targetRole.join() !== entry.targetRole.join() || !!extensionReason.trim());
  const requestBack = () => {
    if (busy) return;
    if (dirty) setConfirmDiscard(true); else onClose();
  };
  return <>
    <DraftNavigationGuard dirty={isOpen && dirty} busy={isOpen && busy} onDiscard={onClose}/>
    <PortalModal isOpen={isOpen && !!entry} onClose={requestBack} busy={busy} labelledBy={titleId} className="max-w-3xl p-0">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div><h2 id={titleId} className="section-heading">Edit event</h2><p className="card-description mt-1">{timelineLabel}</p></div>
        <PortalButton variant="ghost" icon={X} aria-label="Close edit event" disabled={busy} onClick={requestBack} />
      </header>
      <form
              onSubmit={handleSubmit}
              className="space-y-5 p-5 sm:p-6"
            >
              <fieldset disabled={busy} className="contents">
              <div 
                id="edit-drawer-body" 
                className="space-y-5"
              >
                {/* Field 1: Event title */}
                <div className="space-y-1.5">
                  <label className="form-label block">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Enter explicit milestone title"
                    className="form-control form-control-sm"
                  />
                </div>

                {/* Field 2: Category Classification Selection */}
                <div className="space-y-1.5">
                  <label className="form-label block">
                    Category classification
                  </label>
                  <div className="relative">
                    <PortalSelect
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="form-control form-control-sm appearance-none pr-9 cursor-pointer"
                    >
                      <option value="Research Project (P1)">Research Project (P1)</option>
                      <option value="Research Project (P2)">Research Project (P2)</option>
                    </PortalSelect>
                    <Layers className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* Linked dates are managed by their owning submission window. */}
                <section aria-label={managePeriodUrl ? 'Linked submission window' : 'Event dates'} className={managePeriodUrl ? 'space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4' : ''}>
                {managePeriodUrl && <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="section-heading">Linked submission window</h3>
                    <p id="linked-event-dates-help" className="card-description">These dates are read-only. Use Manage period to change them.</p>
                  </div>
                  <Link aria-describedby="linked-event-dates-help" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-brand-navy bg-brand-navy px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm hover:bg-brand-navy-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/20" to={managePeriodUrl}><Calendar aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>Manage period</Link>
                </div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="form-label block">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      readOnly={!!managePeriodUrl}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="form-control form-control-sm cursor-text"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="form-label block">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      readOnly={!!managePeriodUrl}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="form-control form-control-sm cursor-text"
                    />
                  </div>
                </div>

                </section>
                {isExtension && <label className="form-label block">Reason for extension
                  <textarea required maxLength={2000} rows={3} className="form-control form-control-sm mt-2" value={extensionReason} onChange={event => setExtensionReason(event.target.value)} />
                </label>}

                {/* Field 4: Target Roles multi checkboxes */}
                <div className="space-y-2 pt-1">
                  <label className="form-label block">
                    Target Roles
                  </label>
                  <div className="flex items-center gap-4 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleRole('STUDENT')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-wider transition ${
                        targetRole.includes('STUDENT')
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all ${
                        targetRole.includes('STUDENT') ? 'bg-indigo-650 border-indigo-700 text-white' : 'bg-transparent border-slate-300'
                      }`}>
                        {targetRole.includes('STUDENT') && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span>Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleRole('LECTURER')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-wider transition ${
                        targetRole.includes('LECTURER')
                          ? 'bg-slate-100 border-slate-300 text-slate-800'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all ${
                        targetRole.includes('LECTURER') ? 'bg-slate-700 border-slate-800 text-white' : 'bg-transparent border-slate-300'
                      }`}>
                        {targetRole.includes('LECTURER') && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span>Lecturer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleRole('OFFICE_STAFF')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-wider transition ${
                        targetRole.includes('OFFICE_STAFF')
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all ${
                        targetRole.includes('OFFICE_STAFF') ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-transparent border-slate-300'
                      }`}>
                        {targetRole.includes('OFFICE_STAFF') && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span>Office Staff</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="form-label block" htmlFor="timeline-responsible-edit">Responsible parties</label>
                  <input id="timeline-responsible-edit" type="text" required maxLength={255} value={action} onChange={event => setAction(event.target.value)} placeholder="e.g. Student / Supervisor / Panel / Office Staff" className="form-control form-control-sm" />
                  <p className="card-description">Who carries out the event. Target roles controls who can see it.</p>
                </div>

                {/* Field 6: Description or notes field */}
                <div className="space-y-1.5">
                  <label className="form-label block">
                    Detail / Description
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter specific event instruction notes, requirements or descriptions..."
                    className="form-control form-control-sm resize-none leading-relaxed"
                  />
                </div>

              </div>

              {/* Action Buttons Footer section */}
              {error && <div className="px-5"><AlertMessage type="error" title="Unable to save timeline entry" message={error} /></div>}
              <div 
                id="edit-drawer-footer"
                className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4"
              >
                <PortalButton
                  type="button"
                  onClick={requestBack}
                  variant="secondary"
                  size="md"
                >
                  Cancel
                </PortalButton>
                
                <PortalButton
                  type="submit"
                  disabled={busy || !eventName.trim() || !action.trim() || targetRole.length === 0 || (isExtension && !extensionReason.trim())}
                  isLoading={busy}
                  variant="primary"
                  size="md"
                  icon={Save}
                >
                  Save Changes
                </PortalButton>
              </div>
              </fieldset>
            </form>
    </PortalModal>
    <PortalConfirmModal isOpen={confirmDiscard} title="Discard unsaved changes?" message="Your event changes have not been saved. Close the editor and discard them?" confirmLabel="Discard changes" cancelLabel="Keep editing" onConfirm={onClose} onCancel={() => setConfirmDiscard(false)} />
  </>;
};
