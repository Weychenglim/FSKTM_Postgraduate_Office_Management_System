/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Student "My Profile" (UC06): the profile plus every record linked to it.
// Supervisor, Panel and Marks come from the progress dossier, letters from
// the issued-letter register, announcements from the notification feed, files
// from File Management.

import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, FolderOpen, MailOpen, Megaphone, Users } from 'lucide-react';
import { PageHeader, PortalToast, SegmentedControl, StatusBadge } from './PortalPrimitives';
import { StatCard } from './StatCard';
import { LoadingState, ErrorState } from './StateViews';
import { StudentLetterRequests } from './IssuedLetters';
import { DemoUser, GeneratedLetter, PortalDocument, StudentProgressDossier } from '../types';
import { getMyLetterRequests, getStudentProgressDossier, inactiveStudentReason } from '../services';
import { getDocuments } from '../services/filesApi';
import { useNotifications } from '../context/NotificationsContext';
import { APP_ROUTES, routeForDocument } from '../constants/routes';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import type { OpenNotificationState } from '../utils/notificationLinks';
import {
  RECORD_CATEGORIES,
  RecordCategory,
  announcementItems,
  appointmentRows,
  marksRows,
  recordCounts,
} from '../utils/myRecords';

interface StudentMyRecordsProps {
  currentUser: DemoUser;
  onNavigate: (route: string, state?: OpenNotificationState) => void;
}

const TAB_LABELS: Record<RecordCategory, string> = {
  appointments: 'Supervisor & Panel',
  marks: 'Marks',
  letters: 'Letters',
  announcements: 'Announcements',
  files: 'Files',
};

const shownDate = (value: string | null) => (value ? formatMalaysiaDate(value) : '-');

const NoRecords: React.FC<{ colSpan: number; text?: string }> = ({ colSpan, text = 'No records found.' }) => (
  <tr>
    <td colSpan={colSpan} className="px-5 py-12 text-center text-slate-400 font-semibold">{text}</td>
  </tr>
);

const ProfileField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0">
    <span className="form-label block">{label}</span>
    <span className="block text-xs font-bold text-slate-800 break-words">{value || '-'}</span>
  </div>
);

export const StudentMyRecords: React.FC<StudentMyRecordsProps> = ({ currentUser, onNavigate }) => {
  const { items: notifications } = useNotifications();
  const [tab, setTab] = useState<RecordCategory>('appointments');
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const [dossier, setDossier] = useState<StudentProgressDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(true);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [letters, setLetters] = useState<GeneratedLetter[]>([]);
  const [lettersLoading, setLettersLoading] = useState(true);
  const [lettersError, setLettersError] = useState<string | null>(null);
  const [files, setFiles] = useState<PortalDocument[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);

  const loadDossier = useCallback(() => {
    if (!currentUser.studentId) {
      setDossierError('Your student record is not set up yet. Please contact the postgraduate office.');
      setDossierLoading(false);
      return;
    }
    setDossierLoading(true);
    setDossierError(null);
    getStudentProgressDossier(currentUser.studentId)
      .then(setDossier)
      .catch((err) => setDossierError(err instanceof Error ? err.message : 'Failed to load your records.'))
      .finally(() => setDossierLoading(false));
  }, [currentUser.studentId]);

  const loadLetters = useCallback(() => {
    setLettersLoading(true);
    setLettersError(null);
    getMyLetterRequests()
      .then(setLetters)
      .catch((err) => setLettersError(inactiveStudentReason(err) ?? (err instanceof Error ? err.message : 'Failed to load your letters.')))
      .finally(() => setLettersLoading(false));
  }, []);

  const loadFiles = useCallback(() => {
    setFilesLoading(true);
    setFilesError(null);
    getDocuments({ view: 'all' }, 0, 100)
      .then((page) => setFiles(page.results))
      .catch((err) => setFilesError(err instanceof Error ? err.message : 'Failed to load your files.'))
      .finally(() => setFilesLoading(false));
  }, []);

  useEffect(() => {
    loadDossier();
    loadLetters();
    loadFiles();
  }, [loadDossier, loadLetters, loadFiles]);

  const counts = recordCounts({ dossier, letters, notifications });
  const appointments = appointmentRows(dossier);
  const marks = marksRows(dossier);
  const announcements = announcementItems(notifications);
  const profile = dossier?.student;

  return (
    <div id="student-my-records" className="space-y-8 animate-fade-in text-left font-sans text-xs pb-16">
      <PortalToast message={toast} />
      <PageHeader
        title="My Profile"
        subtitle="Your profile and every record linked to it, in one place."
        backLabel="Back to Dashboard"
        onBack={() => onNavigate(APP_ROUTES.dashboard)}
      />

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-label">Profile</h2>
          {profile?.status && <StatusBadge tone={profile.status === 'Active' ? 'success' : 'warning'}>{profile.status}</StatusBadge>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <ProfileField label="Full Name" value={currentUser.fullName} />
          <ProfileField label="Matric Number" value={currentUser.studentId} />
          <ProfileField label="Email" value={currentUser.email} />
          <ProfileField
            label="Phone"
            value={(
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>{currentUser.phone || 'Not set'}</span>
                <button type="button" onClick={() => onNavigate(APP_ROUTES.settings)} className="back-link">
                  Change in Settings
                </button>
              </span>
            )}
          />
          <ProfileField label="Programme" value={profile?.programme || currentUser.department} />
          <ProfileField label="Intake" value={profile?.intakeSemester} />
          <ProfileField label="Research Title" value={profile?.research?.title} />
          <ProfileField label="Supervisor" value={profile?.research?.supervisor} />
        </div>
        <p className="text-[11px] font-semibold text-slate-400">
          Only your phone number can be changed here. For anything else, contact the postgraduate office.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Supervisor & Panel" value={counts.appointments} caption="Applications and appointments" icon={Users} tone="blue" />
        <StatCard label="Marks" value={counts.marks} caption="Evaluation tasks" icon={ClipboardCheck} tone="green" />
        <StatCard label="Letters" value={counts.letters} caption="Issued to you" icon={MailOpen} tone="purple" />
        <StatCard label="Announcements" value={counts.announcements} caption="Received" icon={Megaphone} tone="amber" />
        <StatCard label="Files" value={filesLoading || filesError ? '-' : files.length} caption="Uploaded by you" icon={FolderOpen} tone="slate" />
      </div>

      <SegmentedControl<RecordCategory>
        variant="tabs"
        options={RECORD_CATEGORIES}
        value={tab}
        onChange={setTab}
        labels={TAB_LABELS}
      />

      {tab === 'letters' ? (
        <StudentLetterRequests
          letters={letters}
          loading={lettersLoading}
          error={lettersError}
          onRetry={loadLetters}
          onMessage={showToast}
          onLetterChange={(changed) => setLetters((rows) => rows.map((row) => (row.id === changed.id ? changed : row)))}
        />
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-3xs overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'files' ? (
              filesLoading ? (
                <LoadingState message="Loading your files…" />
              ) : filesError ? (
                <ErrorState message={filesError} onRetry={loadFiles} />
              ) : (
                <table className="data-table text-xs">
                  <thead>
                    <tr className="data-thead bg-[#f8fafc]">
                      <th className="data-th">File</th>
                      <th className="data-th">Type</th>
                      <th className="data-th">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {files.length === 0 ? (
                      <NoRecords colSpan={3} text="You have not uploaded any files yet." />
                    ) : (
                      files.map((file) => (
                        <tr key={file.id} className="hover:bg-slate-50/50 transition">
                          <td className="data-td">
                            <button
                              type="button"
                              onClick={() => onNavigate(routeForDocument(file.id))}
                              className="font-bold text-slate-800 hover:text-blue-700 text-left cursor-pointer"
                            >
                              {file.title}
                            </button>
                          </td>
                          <td className="data-td">{file.type.label}</td>
                          <td className="data-td whitespace-nowrap">{shownDate(file.uploadedAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )
            ) : tab === 'announcements' ? (
              <table className="data-table text-xs">
                <thead>
                  <tr className="data-thead bg-[#f8fafc]">
                    <th className="data-th">Announcement</th>
                    <th className="data-th">From</th>
                    <th className="data-th">Received</th>
                    <th className="data-th text-right">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {announcements.length === 0 ? (
                    <NoRecords colSpan={4} />
                  ) : (
                    announcements.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition">
                        <td className="data-td">
                          <button
                            type="button"
                            onClick={() => onNavigate(APP_ROUTES.notifications, { openNotificationId: item.id })}
                            className="font-bold text-slate-800 hover:text-blue-700 text-left cursor-pointer"
                          >
                            {item.title}
                          </button>
                        </td>
                        <td className="data-td">{item.service}</td>
                        <td className="data-td whitespace-nowrap">{item.timeAgo}</td>
                        <td className="data-td text-right">
                          <StatusBadge tone={item.isUnread ? 'info' : 'neutral'}>{item.isUnread ? 'Unread' : 'Read'}</StatusBadge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : dossierLoading ? (
              <LoadingState message="Loading your records…" />
            ) : dossierError ? (
              <ErrorState message={dossierError} onRetry={loadDossier} />
            ) : tab === 'appointments' ? (
              <table className="data-table text-xs">
                <thead>
                  <tr className="data-thead bg-[#f8fafc]">
                    <th className="data-th">Type</th>
                    <th className="data-th">Supervisor / Panel Member</th>
                    <th className="data-th">Status</th>
                    <th className="data-th">Date</th>
                    <th className="data-th text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.length === 0 ? (
                    <NoRecords colSpan={5} />
                  ) : (
                    appointments.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/50 transition">
                        <td className="data-td-strong">{row.kind}</td>
                        <td className="data-td">{row.person}</td>
                        <td className="data-td">{row.status}</td>
                        <td className="data-td whitespace-nowrap">{shownDate(row.date)}</td>
                        <td className="data-td text-right">
                          <button
                            type="button"
                            onClick={() => onNavigate(row.kind === 'Supervisor' ? APP_ROUTES.supervisorAppointments : APP_ROUTES.panelAppointments)}
                            className="back-link"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="data-table text-xs">
                <thead>
                  <tr className="data-thead bg-[#f8fafc]">
                    <th className="data-th">Evaluation Period</th>
                    <th className="data-th">Semester</th>
                    <th className="data-th">Evaluator</th>
                    <th className="data-th">Status</th>
                    <th className="data-th">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {marks.length === 0 ? (
                    <NoRecords colSpan={5} />
                  ) : (
                    marks.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/50 transition">
                        <td className="data-td-strong">{row.period}</td>
                        <td className="data-td">{row.semester}</td>
                        <td className="data-td">{row.role}</td>
                        <td className="data-td">{row.status}</td>
                        <td className="data-td whitespace-nowrap">{shownDate(row.dueAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
