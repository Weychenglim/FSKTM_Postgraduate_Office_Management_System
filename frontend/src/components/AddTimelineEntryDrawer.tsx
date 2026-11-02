import { PortalSelect } from './PortalSelect';
import { RecordPage } from './RecordPage';
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
  Check,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PortalButton } from './PortalPrimitives';

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

interface AddTimelineEntryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newEntry: Omit<TimelineEntry, 'id'>) => Promise<boolean> | boolean | void;
  timelineLabel: string;
  busy?: boolean;
  error?: string | null;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

export const AddTimelineEntryDrawer: React.FC<AddTimelineEntryDrawerProps> = ({
  isOpen,
  onClose,
  onSave,
  timelineLabel,
  busy = false,
  error,
  embedded = false,
  onDirtyChange,
}) => {
  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState<TimelineEntry['category']>('Research Project (P1)');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetRole, setTargetRole] = useState<TimelineEntry['targetRole']>(['STUDENT']);
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('Student');

  // Reset fields on open
  useEffect(() => {
    if (isOpen) {
      setEventName('');
      setCategory('Research Project (P1)');
      setStartDate('');
      setEndDate('');
      setTargetRole(['STUDENT']);
      setDescription('');
      setAction('Student');
    }
  }, [isOpen]);

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
    if (busy || !eventName.trim() || !action.trim() || targetRole.length === 0) return;

    onSave({
      event: eventName,
      category,
      startDate: formatToDisplayDate(startDate),
      endDate: formatToDisplayDate(endDate),
      targetRole,
      description,
      action: action.trim(),
    });
  };

  const toggleRole = (role: TimelineEntry['targetRole'][number]) => {
    if (targetRole.includes(role)) {
      setTargetRole(prev => prev.filter(r => r !== role));
    } else {
      setTargetRole(prev => [...prev, role]);
    }
  };

  const dirty = action !== 'Student' || !!eventName || !!startDate || !!endDate || !!description || category !== 'Research Project (P1)' || targetRole.join() !== 'STUDENT';
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  if (!isOpen) return null;
  const renderForm = (requestBack: () => void) => <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <fieldset disabled={busy} className="contents">
              <div 
                id="add-drawer-body" 
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
                    placeholder="e.g. Panel Recommendation Period"
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

                {/* Field 3: Date Inputs grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="form-label block">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
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
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="form-control form-control-sm cursor-text"
                    />
                  </div>
                </div>

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
                  <label className="form-label block" htmlFor="timeline-responsible-create">Responsible parties</label>
                  <input id="timeline-responsible-create" type="text" required maxLength={255} value={action} onChange={event => setAction(event.target.value)} placeholder="e.g. Student / Supervisor / Panel / Office Staff" className="form-control form-control-sm" />
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
                    placeholder="Enter specific event instruction notes..."
                    className="form-control form-control-sm resize-none leading-relaxed"
                  />
                </div>

              </div>

              {/* Action Buttons Footer section */}
              {error && <div className="px-5"><AlertMessage type="error" title="Unable to add timeline entry" message={error} /></div>}
              <div 
                id="add-drawer-footer"
                className="flex justify-end gap-3 border-t border-slate-200 pt-4"
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
                  disabled={busy || !eventName.trim() || !action.trim() || targetRole.length === 0}
                  isLoading={busy}
                  variant="primary"
                  size="md"
                  icon={Plus}
                >
                  Create event
                </PortalButton>
              </div>
              </fieldset>
            </form>;
  return embedded ? renderForm(onClose) : <RecordPage title="Add Timeline Entry" backLabel="Back to Timeline Management" onBack={onClose} pageKey="timeline-add" dirty={dirty} busy={busy}>{renderForm}</RecordPage>;
};
