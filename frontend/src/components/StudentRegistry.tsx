import { IconHeading } from './IconHeading';
import { useListState } from './ListState';
import { RecordPage } from './RecordPage';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Download, 
  UserPlus, 
  Search, 
  SlidersHorizontal, 
  Eye, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  UserSquare, 
  UserCheck, 
  GraduationCap, 
  ShieldAlert, 
  ChevronDown,
  Mail,
  Calendar,
  CalendarClock,
  Layers,
  FileSpreadsheet,
  UploadCloud,
  FileText,
  AlertTriangle,
  AlertCircle,
  Edit,
  Trash2,
  CheckCircle,
  MoreVertical,
  Info,
  RefreshCw,
  HelpCircle,
  FileDown,
  ArrowRightLeft,
  Lock
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, PortalButton, PortalConfirmModal, PortalToast, SegmentedControl, StatusBadge, StatusDot } from './PortalPrimitives';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';
import { RegistryImportResult } from './RegistryImportResult';
import { ImportSteps, RegistryImportMatch } from './RegistryImportMatch';
import { NOT_CHOSEN, RegistryImportProgrammes } from './RegistryImportProgrammes';
import { StatCard } from './StatCard';
import { describeProgramme } from '../utils/programmeLabel';
import { THIN_SCROLLBAR } from '../utils/scrollbar';
import { historyTime } from '../utils/documentDisplay';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { APP_ROUTES, routeForNewProgrammeTransfer, routeForProgrammeTransfer } from '../constants/routes';
import { getStudentTransfer, type StudentTransferSummary } from '../services/programmeTransfersApi';
import { getSemesterMoveSummary, type MoveSummary } from '../services/registrySemestersApi';
import { semesterMoveWaiting, shortSemester, studentCount } from '../utils/registrySemesters';
import { LoadingState, ErrorState } from './StateViews';
import { RegistryModuleTabs } from './RegistryModuleTabs';
import { StudentSemestersCard } from './StudentSemestersCard';
import {
  ImportCommitResponse,
  ImportDefaults,
  ImportInspectResponse,
  ImportMapping,
  ImportOptions,
  ImportPreviewResponse,
  ImportPreviewRow,
  ImportProgrammeValue,
  RegistryImportBatch,
  StudentAcademicStatus,
  StudentAccountStatus,
  StudentRecord,
} from '../types';
import type { StudentRecordUpdate } from '../services';
import {
  ApiError,
  commitStudentImport,
  createStudent,
  downloadImportTemplate,
  fieldErrors,
  getParticipant,
  getRecentImports,
  getStudentById,
  getStudents,
  inspectStudentImport,
  previewStudentImport,
  sendAccessLink,
  sendBatchInvitations,
  updateStudent,
} from '../services';
import {
  describeBlockers,
  distinctValues,
  studentStatusOptions,
  summariseRegistry,
} from '../utils/registryStatus';

const NO_SUPERVISOR = '__none__';
const ACADEMIC_STATUSES: StudentAcademicStatus[] = ['Active', 'Deferred', 'Graduated', 'Withdrawn'];
import { PROGRAMME_OPTIONS, normaliseProgramme } from '../constants/programmes';
import { CSV_HEADERS, reviewedFileName, rowsToCsv } from '../utils/csvImport';
import { downloadCsv } from '../utils/csvExport';
import { pageWindow } from '../utils/pageWindow';
import {
  BATCH_PROBLEM_COLUMNS,
  IMPORT_REPORT_COLUMNS,
  IMPORT_ROW_FILTERS,
  STUDENT_ID_RULE,
  type ImportRowFilter,
  batchSummary,
  differenceWarning,
  filterImportRows,
  rowExplanation,
  rowsAfterHeldSend,
  rowsForReview,
  skipNotice,
  summariseImportRows,
  withSuggestedProgrammes,
} from '../utils/registryImport';

const IMPORT_COLUMN_RULES: Record<typeof CSV_HEADERS[number], { rule: string; required: boolean }> = {
  student_id: { rule: 'Student ID (matric number), unique', required: true },
  full_name: { rule: "Student's full name", required: true },
  programme: { rule: 'One of the approved programmes', required: true },
  email: { rule: "Unique. Left blank, the student's SiswaMail address is used", required: false },
  phone: { rule: 'Contact number', required: false },
  intake: { rule: 'e.g. 2026/2027 Semester I', required: false },
  current_semester: { rule: 'e.g. Semester I, 2026/2027 Session', required: false },
};

// ==================== COMPONENT PATTERNS TYPES ====================

const REGISTER_TABS = ['bulk', 'single'] as const;
type RegisterTab = (typeof REGISTER_TABS)[number];

// Reusable Status Chip for Academic Status
interface StatusChipProps {
  status: StudentAcademicStatus;
}

const ACADEMIC_TONE = {
  Active: 'success',
  Graduated: 'info',
  Withdrawn: 'danger',
  Deferred: 'warning',
} as const;

export const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const tone = ACADEMIC_TONE[status] ?? 'neutral';
  return <StatusBadge tone={tone} dot pulse={status === 'Active'}>{status}</StatusBadge>;
};

// Reusable Programme Chip
interface ProgrammeChipProps {
  label: string;
}

// Each programme keeps its own colour wherever it appears.
const PROGRAMME_TONES: Array<[RegExp, string]> = [
  [/data science/i, 'bg-amber-50 text-amber-600 border-amber-100'],
  [/cyber/i, 'bg-emerald-50 text-emerald-600 border-emerald-100'],
  [/artificial intelligence/i, 'bg-violet-50 text-violet-600 border-violet-100'],
  [/computer science/i, 'bg-blue-50 text-blue-600 border-blue-100'],
  [/software/i, 'bg-indigo-50 text-indigo-600 border-indigo-100'],
  [/information systems?/i, 'bg-purple-50 text-purple-600 border-purple-100'],
];

const programmeTone = (label: string) =>
  PROGRAMME_TONES.find(([pattern]) => pattern.test(label))?.[1] ?? 'bg-slate-50 text-slate-500 border-slate-200';

const ProgrammeIcon: React.FC<{ label: string; small?: boolean }> = ({ label, small = false }) => (
  <span
    className={`${small ? 'w-6 h-6 rounded-md' : 'w-8 h-8 rounded-lg'} border flex items-center justify-center shrink-0 ${programmeTone(label)}`}
  >
    <GraduationCap className={small ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
  </span>
);

// Dropdown entries read "Data Science / Master · Coursework" instead of the
// upper-case official name, the same way the table shows programmes.
const programmeOption = (programme: string, note?: string): SelectMenuOption => {
  const { field, detail } = describeProgramme(programme);
  return {
    value: programme,
    label: field,
    description: [detail, note].filter(Boolean).join(' · '),
    leading: <ProgrammeIcon label={programme} small />,
  };
};

const statusOption = (status: StudentAcademicStatus): SelectMenuOption<StudentAcademicStatus> => ({
  value: status,
  label: status,
  leading: <StatusDot tone={ACADEMIC_TONE[status]} className="w-2 h-2" />,
});

export const ProgrammeChip: React.FC<ProgrammeChipProps> = ({ label }) => {
  const { field, detail } = describeProgramme(label);

  return (
    <div className="flex items-center gap-2.5 text-left select-none" title={label}>
      <ProgrammeIcon label={label} />
      <div className="min-w-0">
        <p className="text-[12px] font-extrabold text-brand-navy leading-snug">{field}</p>
        {detail && <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
};

// Reusable Account Status Indicator
interface AccountStatusIndicatorProps {
  status: StudentAccountStatus;
}

export const AccountStatusIndicator: React.FC<AccountStatusIndicatorProps> = ({ status }) => {
  const dotTone = {
    Verified: 'success',
    Suspended: 'danger',
  } as const;

  return (
    <div className="flex items-center gap-2 select-none">
      <StatusDot tone={dotTone[status]} pulse className="w-2 h-2" />
      <span className="card-value">
        {status}
      </span>
    </div>
  );
};

// Reusable Action Button
interface ActionButtonProps {
  onClick: () => void;
  icon: LucideIcon;
  title: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({ onClick, icon: Icon, title }) => {
  return (
    <PortalButton
      onClick={onClick}
      icon={Icon}
      size="icon"
      variant="ghost"
      title={title}
      aria-label={title}
    />
  );
};

interface StudentRegistryProps {
  readOnly?: boolean;
  /** Office staff and programme coordinators follow programme transfers. */
  canSeeTransfers?: boolean;
  onOpenParticipantLifecycle?: () => void;
}

export const StudentRegistry: React.FC<StudentRegistryProps> = ({
  readOnly = false,
  canSeeTransfers = false,
  onOpenParticipantLifecycle,
}) => {
  // Master Student Registry State: loaded from studentsApi (mock-backed today).
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True while a write is in flight, so buttons cannot be double-submitted.
  const [saving, setSaving] = useState(false);

  const loadStudents = useCallback(() => {
    setLoading(true);
    setError(null);
    getStudents()
      .then(setStudents)
      .catch((e) => {
        // Drop the previous list so the summary cards and Export never present
        // stale numbers as current.
        setStudents([]);
        setError(e instanceof Error ? e.message : 'Failed to load students.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Current Screen and View Controls Mode
  // Note: defaulted to 'register' and 'single' as requested so the exact single student entry screen is rendered immediately!
  const [currentView, setCurrentView] = useState<'list' | 'register'>('list');
  const [registerActiveTab, setRegisterActiveTab] = useState<'bulk' | 'single'>('single');

  // Lists Filters States
  const [searchQuery, setSearchQuery] = useListState('StudentRegistry', 'searchQuery', '');
  const [selectedProgramme, setSelectedProgramme] = useListState<string>('StudentRegistry', 'selectedProgramme', 'All');
  const [selectedSemester, setSelectedSemester] = useListState<string>('StudentRegistry', 'selectedSemester', 'All');
  const [selectedAcademicStatus, setSelectedAcademicStatus] = useListState<string>('StudentRegistry', 'selectedAcademicStatus', 'All');
  const [selectedSupervisor, setSelectedSupervisor] = useListState<string>('StudentRegistry', 'selectedSupervisor', 'All');
  
  // Modals Dialog States
  const [viewingStudent, setViewingStudent] = useState<StudentRecord | null>(null);
  const [moveSummary, setMoveSummary] = useState<MoveSummary | null>(null);

  useEffect(() => {
    if (readOnly) return undefined;
    let cancelled = false;
    getSemesterMoveSummary().then((found) => { if (!cancelled) setMoveSummary(found); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [readOnly]);
  const [transfer, setTransfer] = useState<StudentTransferSummary | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const openStudent = searchParams.get('student');

  // ?student=<matric> opens that Student Record, for example on the way back from a transfer.
  useEffect(() => {
    if (!openStudent || viewingStudent || loading) return;
    const found = students.find((row) => row.id.toLowerCase() === openStudent.toLowerCase());
    if (found) {
      setViewingStudent(found);
      return;
    }
    let cancelled = false;
    getStudentById(openStudent).then((row) => {
      if (!cancelled && row) setViewingStudent(row);
    });
    return () => {
      cancelled = true;
    };
  }, [openStudent, students, loading]);

  useEffect(() => {
    setTransfer(null);
    if (!viewingStudent) return;
    let cancelled = false;
    getStudentTransfer(viewingStudent.id)
      .then((found) => !cancelled && setTransfer(found))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [viewingStudent?.id]);

  const closeRecord = () => {
    setViewingStudent(null);
    if (searchParams.has('student')) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('student');
        return next;
      }, { replace: true });
    }
  };
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useListState('StudentRegistry', 'currentPage', 1);
  const itemsPerPage = 10;

  // Single Student Registration Manual fields with updated layout fields from mockup
  const [manualFormData, setManualFormData] = useState({
    name: '',
    id: '',
    email: '',
    phone: '',
    programme: '',
    intakeBatch: '',
    semester: '',
    sendCredentialsImmediately: true
  });

  // Bulk CSV Import Session States
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [rowsEdited, setRowsEdited] = useState(false);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [showRequiredColumns, setShowRequiredColumns] = useState(false);

  // Dynamic CSV preview records
  // Populated only by the server's check of an uploaded file, never pre-seeded,
  // so nothing can be committed that did not come from the office's own file.
  const [csvPreviewRecords, setCsvPreviewRecords] = useState<ImportPreviewRow[]>([]);
  const [csvFatalError, setCsvFatalError] = useState<string | null>(null);
  const [importFilter, setImportFilter] = useState<ImportRowFilter>('all');
  // What the last import did, kept on screen so skipped students are seen.
  const [importResult, setImportResult] = useState<ImportCommitResponse | null>(null);
  // Upload, then (unless the file is our own template) Match columns, then Check rows.
  const [importStep, setImportStep] = useState<'upload' | 'match' | 'check'>('upload');
  const [importLayout, setImportLayout] = useState<ImportInspectResponse | null>(null);
  const [importMapping, setImportMapping] = useState<ImportMapping | null>(null);
  const [importSheet, setImportSheet] = useState<string | null>(null);
  const [importHeaderRow, setImportHeaderRow] = useState<number | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  // Programme, intake and semester for every row, and whether activation
  // emails go out now or are held to send later.
  const [importDefaults, setImportDefaults] = useState<ImportDefaults>({});
  const [sendInvitesNow, setSendInvitesNow] = useState(true);
  const [heldBatchToSend, setHeldBatchToSend] = useState<RegistryImportBatch | null>(null);
  const [sendingHeld, setSendingHeld] = useState(false);
  // Programme names in the file that are not approved programmes, and the
  // office's choice for each: an approved programme, or skip its rows.
  const [programmeValues, setProgrammeValues] = useState<ImportProgrammeValue[]>([]);
  const [programmeValueCount, setProgrammeValueCount] = useState(0);
  const [programmeChoices, setProgrammeChoices] = useState<Record<string, string>>({});
  // False once the office sets aside the matches saved from an earlier import.
  const [keepSavedMatches, setKeepSavedMatches] = useState(true);
  // A missing email becomes the student's SiswaMail address, and Student IDs
  // like 23004955/1 can lose their programme number.
  const [fillEmail, setFillEmail] = useState(true);
  const [dropIdSuffix, setDropIdSuffix] = useState(false);
  // False when every row is a student, with no row of column names.
  const [importHasHeader, setImportHasHeader] = useState(true);

  const [recentImports, setRecentImports] = useState<RegistryImportBatch[]>([]);
  const [recentImportsError, setRecentImportsError] = useState<string | null>(null);
  const [showAllImports, setShowAllImports] = useState(false);

  // Record being edited inside CSV preview list, identified by its file line
  const [editingCsvLine, setEditingCsvLine] = useState<number | null>(null);
  const [editRowFields, setEditRowFields] = useState({
    name: '',
    programme: '',
    email: '',
    id: '',
    phone: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Actions trigger helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const [statusTarget, setStatusTarget] = useState<StudentAcademicStatus | ''>('');
  const [statusReason, setStatusReason] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusBlockers, setStatusBlockers] = useState<string[]>([]);

  const [detailsDraft, setDetailsDraft] = useState({ name: '', email: '', phone: '', programme: '', intakeDate: '' });
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  // An edit clears the last save problem, so a fixed field no longer shows it.
  const editDetails = (change: Partial<typeof detailsDraft>) => {
    setDetailsDraft((draft) => ({ ...draft, ...change }));
    setDetailsError(null);
  };
  // Sign-in changes are confirmed first; this holds the pending one.
  const [accessChange, setAccessChange] = useState<StudentAccountStatus | null>(null);

  useEffect(() => {
    setStatusTarget('');
    setStatusReason('');
    setStatusError(null);
    setStatusBlockers([]);
    setDetailsError(null);
    setDetailsDraft({
      name: viewingStudent?.name ?? '',
      email: viewingStudent?.email ?? '',
      phone: viewingStudent?.phone ?? '',
      programme: viewingStudent?.programme ?? '',
      intakeDate: viewingStudent?.intakeDate ?? '',
    });
  }, [viewingStudent?.id]);

  // Semesters decide the current semester, so the record is read again after a change.
  const refreshViewingStudent = () => {
    if (!viewingStudent) return;
    const matric = viewingStudent.id;
    getStudentById(matric)
      .then((updated) => setViewingStudent((current) => (current?.id === matric ? updated : current)))
      .catch(() => undefined);
    loadStudents();
  };

  const handleStatusChange = async () => {
    if (!viewingStudent || !statusTarget || !statusReason.trim()) return;
    const student = viewingStudent;
    setStatusSaving(true);
    setStatusError(null);
    setStatusBlockers([]);
    try {
      const updated = await updateStudent(student.id, {
        academicStatus: statusTarget,
        statusReason: statusReason.trim(),
      });
      setViewingStudent(updated);
      setStatusTarget('');
      setStatusReason('');
      loadStudents();
      triggerToast(`${student.name} is now ${updated.academicStatus}.`);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not change the academic status.');
      if (err instanceof ApiError && err.status === 409) {
        try {
          const record = await getParticipant('STUDENT', student.id);
          setStatusBlockers(describeBlockers({ ...record.blockers }));
        } catch {
          setStatusBlockers([]);
        }
      }
    } finally {
      setStatusSaving(false);
    }
  };

  // Only fields that actually changed are sent, so an untouched value (for
  // example a semester shown from the intake) is never written back.
  const handleSaveDetails = async () => {
    if (!viewingStudent) return;
    const student = viewingStudent;
    const changes: StudentRecordUpdate = {};
    if (detailsDraft.name.trim() !== student.name) changes.name = detailsDraft.name.trim();
    if (detailsDraft.email.trim().toLowerCase() !== student.email.toLowerCase()) changes.email = detailsDraft.email.trim();
    if (detailsDraft.phone.trim() !== student.phone) changes.phone = detailsDraft.phone.trim();
    if (detailsDraft.programme !== student.programme) changes.programme = detailsDraft.programme;
    if (detailsDraft.intakeDate.trim() !== student.intakeDate) changes.intakeDate = detailsDraft.intakeDate.trim();
    if (Object.keys(changes).length === 0) {
      setDetailsError('Nothing has changed yet.');
      return;
    }
    setDetailsSaving(true);
    setDetailsError(null);
    try {
      const { oldAddressTold, ...updated } = await updateStudent(student.id, changes);
      setViewingStudent(updated);
      loadStudents();
      triggerToast(
        !changes.email
          ? `Saved ${updated.name}'s details.`
          : oldAddressTold === null
            ? 'Saved. The earlier activation link no longer works, so send the activation link to the new address.'
            : oldAddressTold
              ? 'Saved. The old address was told about the change.'
              : 'Saved, but the email to the old address could not be sent.',
      );
    } catch (err) {
      const fields = fieldErrors(err);
      setDetailsError(fields.name ?? fields.email ?? fields.phone ?? (err instanceof Error ? err.message : 'Could not save the details.'));
    } finally {
      setDetailsSaving(false);
    }
  };

  const handleAccessChange = async () => {
    if (!viewingStudent || !accessChange) return;
    const student = viewingStudent;
    const target = accessChange;
    setSaving(true);
    try {
      const updated = await updateStudent(student.id, { accountStatus: target });
      setViewingStudent(updated);
      loadStudents();
      triggerToast(
        target === 'Suspended'
          ? `${student.name} can no longer sign in, and their open sessions were ended.`
          : `${student.name} can sign in again.`,
      );
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Could not update this account.');
    } finally {
      setSaving(false);
      setAccessChange(null);
    }
  };

  const [sendingAccessLink, setSendingAccessLink] = useState(false);

  const handleSendAccessLink = async () => {
    if (!viewingStudent) return;
    const student = viewingStudent;
    setSendingAccessLink(true);
    try {
      const result = await sendAccessLink(student.id);
      const link = result.kind === 'activation' ? 'Activation link' : 'Password reset link';
      triggerToast(
        result.sent
          ? `${link} emailed to ${student.email}.`
          : `${link} could not be sent. Check the mail settings and try again.`,
      );
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Could not send the access link.');
    } finally {
      setSendingAccessLink(false);
    }
  };

  // Exports exactly what the filters show. Cells go through downloadCsv, which
  // quotes them and neutralises spreadsheet formulas typed into free-text
  // fields such as a student's phone number.
  const handleExportCSV = () => {
    downloadCsv('FSKTM_Student_Registry_Export.csv', filteredStudents, [
      { header: 'Student ID', value: (s) => s.id },
      { header: 'Full Name', value: (s) => s.name },
      { header: 'Programme', value: (s) => s.programme },
      { header: 'Academic Status', value: (s) => s.academicStatus },
      { header: 'Account Status', value: (s) => s.accountStatus },
      { header: 'Current Semester', value: (s) => s.semester },
      { header: 'Intake', value: (s) => s.intakeDate },
      { header: 'Email', value: (s) => s.email },
      { header: 'Phone', value: (s) => s.phone },
      { header: 'Supervisor', value: (s) => s.supervisor },
      { header: 'Supervisor Staff No', value: (s) => s.supervisorStaffNo },
      { header: 'Activated', value: (s) => (s.activated === false ? 'No' : 'Yes') },
      { header: 'Last Sign-in', value: (s) => s.lastLogin ?? '' },
    ]);
    triggerToast(`Exported ${filteredStudents.length} student record${filteredStudents.length === 1 ? '' : 's'}.`);
  };

  // Single Manual Registration Submit handler with robust validation and normalization
  const handleRegisterManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFormData.name || !manualFormData.id || !manualFormData.email) {
      triggerToast('Please fill in all required fields (Name, Student ID, and Email).');
      return;
    }

    // Previously an untouched dropdown silently fell through to a hardcoded
    // default, registering the student on a programme nobody chose.
    const programme = normaliseProgramme(manualFormData.programme);
    if (!programme) {
      triggerToast('Please select the student’s programme.');
      return;
    }

    setSaving(true);
    let invitationSent: boolean | undefined;
    try {
      const created = await createStudent({
        id: manualFormData.id,
        name: manualFormData.name,
        email: manualFormData.email,
        programme,
        phone: manualFormData.phone,
        semester: manualFormData.semester.trim(),
        intakeDate: manualFormData.intakeBatch,
        academicStatus: 'Active',
        sendInvite: manualFormData.sendCredentialsImmediately,
      });
      invitationSent = created.invitationSent;
    } catch (err) {
      setSaving(false);
      // Duplicate matric / duplicate email arrive here with the backend's wording.
      triggerToast(err instanceof Error ? err.message : 'Could not register the student.');
      return;
    }
    setSaving(false);

    loadStudents();
    setCurrentView('list');
    if (!manualFormData.sendCredentialsImmediately) {
      triggerToast(`Registered "${manualFormData.name}". No activation email was sent; send it from their profile when ready.`);
    } else if (invitationSent === false) {
      triggerToast(`Registered "${manualFormData.name}", but the activation email could not be sent. Use Send Activation Link in their profile.`);
    } else {
      triggerToast(`Registered "${manualFormData.name}" and emailed their activation link.`);
    }

    // Reset manualFormData
    setManualFormData({
      name: '',
      id: '',
      email: '',
      phone: '',
      programme: '',
      intakeBatch: '',
      semester: '',
      sendCredentialsImmediately: true
    });
  };

  // CSV Drag and Drop helper actions
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      void previewImportFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      void previewImportFile(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const loadRecentImports = useCallback((limit: number) => {
    setRecentImportsError(null);
    getRecentImports(limit)
      .then(setRecentImports)
      .catch((err) => setRecentImportsError(err instanceof Error ? err.message : 'Could not load recent imports.'));
  }, []);

  useEffect(() => {
    if (currentView === 'register' && registerActiveTab === 'bulk') {
      loadRecentImports(showAllImports ? 50 : 5);
    }
  }, [currentView, registerActiveTab, showAllImports, loadRecentImports]);

  const clearImport = () => {
    setUploadedFile(null);
    setSourceFile(null);
    setRowsEdited(false);
    setCsvPreviewRecords([]);
    setCsvFatalError(null);
    setEditingCsvLine(null);
    setImportFilter('all');
    setImportStep('upload');
    setImportLayout(null);
    setImportMapping(null);
    setImportSheet(null);
    setImportHeaderRow(null);
    setMatchError(null);
    setImportDefaults({});
    setSendInvitesNow(true);
    setProgrammeValues([]);
    setProgrammeValueCount(0);
    setProgrammeChoices({});
    setKeepSavedMatches(true);
    setFillEmail(true);
    setDropIdSuffix(false);
    setImportHasHeader(true);
  };

  // The confirmed reading of the uploaded file: which sheet, which row has the
  // column names, and which column holds each detail.
  const importOptions = (): ImportOptions => ({
    sheet: importSheet,
    headerRow: importHeaderRow,
    hasHeader: importHasHeader,
    mapping: importMapping,
    defaults: importDefaults,
    programmeMap: programmeChoices,
    fillEmail,
    idRule: dropIdSuffix ? STUDENT_ID_RULE : null,
    sendInvites: sendInvitesNow,
  });

  // Edited rows are sent back in our own layout, so the server finds the
  // columns by name.
  const reviewedOptions = (): ImportOptions => ({
    defaults: importDefaults,
    programmeMap: programmeChoices,
    fillEmail,
    idRule: dropIdSuffix ? STUDENT_ID_RULE : null,
    sendInvites: sendInvitesNow,
  });

  const reviewedFile = (rows: ImportPreviewRow[]) =>
    new File([rowsToCsv(rowsForReview(rows))], reviewedFileName(uploadedFile?.name), { type: 'text/csv' });

  const applyLayout = (layout: ImportInspectResponse) => {
    setImportLayout(layout);
    setImportMapping(layout.mapping);
    setImportSheet(layout.sheet);
    setImportHeaderRow(layout.headerRow);
  };

  const showCheckedRows = (response: ImportPreviewResponse) => {
    setCsvPreviewRecords(response.rows);
    setProgrammeValues(response.programmeValues ?? []);
    setProgrammeValueCount(response.programmeValueCount ?? 0);
  };

  // Suggested programme choices (the office's earlier choice, or the same
  // name spelt differently) are filled in and the rows checked again with
  // them, so every choice and its effect are on screen before any import.
  const previewWithChoices = async (file: File, options: ImportOptions) => {
    const chosen = options.programmeMap ?? {};
    const response = await previewStudentImport(file, options);
    const choices = withSuggestedProgrammes(response.programmeValues ?? [], chosen);
    setProgrammeChoices(choices);
    if (Object.keys(choices).length === Object.keys(chosen).length) return response;
    return previewStudentImport(file, { ...options, programmeMap: choices });
  };

  // The server checks every row with the confirmed columns; nothing is
  // created until the reviewer commits.
  const checkImportRows = async (file: File, options: ImportOptions) => {
    const response = await previewWithChoices(file, options);
    showCheckedRows(response);
    setImportFilter('all');
    setImportStep('check');
    const checked = summariseImportRows(response.rows);
    triggerToast(
      `Checked ${checked.total} rows: ${checked.ready} ready, ${checked.skipped} will be skipped, ${checked.fix} need fixing.`,
    );
  };

  // A new file is described first (sheets, column names, suggested matches).
  // Our own template goes straight to checking rows; any other layout stops at
  // Match columns so the office confirms which column is which.
  const previewImportFile = async (file: File, first?: ImportOptions) => {
    setIsProcessingCsv(true);
    setCsvFatalError(null);
    setEditingCsvLine(null);
    setImportResult(null);
    setMatchError(null);
    try {
      const layout = await inspectStudentImport(file, first);
      setUploadedFile({ name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` });
      setSourceFile(file);
      setRowsEdited(false);
      setCsvPreviewRecords([]);
      setProgrammeValues([]);
      setProgrammeValueCount(0);
      setProgrammeChoices({});
      setKeepSavedMatches(true);
      setFillEmail(true);
      setDropIdSuffix(false);
      setImportHasHeader(first?.hasHeader ?? true);
      applyLayout(layout);
      if (layout.layoutRecognised) {
        await checkImportRows(file, { sheet: layout.sheet, headerRow: layout.headerRow, mapping: layout.mapping });
      } else {
        setImportStep('match');
        triggerToast(`Found ${layout.rowCount} student rows. Check which column holds each detail.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That file could not be read.';
      clearImport();
      setCsvFatalError(message);
      triggerToast(message);
    } finally {
      setIsProcessingCsv(false);
    }
  };

  // Choosing another sheet or column-name row describes the file again, with
  // fresh suggestions for that layout.
  const reinspectImport = async (options: ImportOptions) => {
    if (!sourceFile) return;
    setIsProcessingCsv(true);
    setMatchError(null);
    try {
      applyLayout(
        await inspectStudentImport(sourceFile, { useProfile: keepSavedMatches, hasHeader: importHasHeader, ...options }),
      );
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : 'That part of the file could not be read.');
    } finally {
      setIsProcessingCsv(false);
    }
  };

  // The matches saved from an earlier import are set aside for this file, and
  // the column-name suggestions come back.
  const switchToSuggestedMatches = () => {
    setKeepSavedMatches(false);
    void reinspectImport({ sheet: importSheet, headerRow: importHeaderRow, useProfile: false });
  };

  // The matches confirmed for the file's own layout go with the import, so
  // the next file with the same columns opens matched the same way. They are
  // sent even when edited rows go back in our own layout.
  const layoutToRemember = (): ImportOptions['rememberLayout'] =>
    importLayout?.layoutToken && importMapping
      ? { token: importLayout.layoutToken, mapping: importMapping, sheet: importSheet, headerRow: importHeaderRow }
      : undefined;

  const continueFromMatch = async () => {
    if (!sourceFile) return;
    setIsProcessingCsv(true);
    setMatchError(null);
    try {
      await checkImportRows(sourceFile, importOptions());
      setRowsEdited(false);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : 'The rows could not be checked.');
    } finally {
      setIsProcessingCsv(false);
    }
  };

  // One choice covers every row with that programme name; the rows are
  // checked again straight away.
  const chooseProgramme = async (key: string, choice: string) => {
    const choices = { ...programmeChoices };
    if (choice === NOT_CHOSEN) delete choices[key];
    else choices[key] = choice;
    setProgrammeChoices(choices);
    setIsProcessingCsv(true);
    try {
      const response =
        !rowsEdited && sourceFile
          ? await previewStudentImport(sourceFile, { ...importOptions(), programmeMap: choices })
          : await previewStudentImport(reviewedFile(csvPreviewRecords), { ...reviewedOptions(), programmeMap: choices });
      showCheckedRows(response);
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'The rows could not be checked again.');
    } finally {
      setIsProcessingCsv(false);
    }
  };

  // Multi edit save handler inside CSV validation table
  const handleStartEditingRow = (item: ImportPreviewRow) => {
    setEditingCsvLine(item.line);
    setEditRowFields({
      name: item.name,
      programme: item.programme,
      email: item.email,
      id: item.id,
      phone: item.phone
    });
  };

  const handleSaveEditedRow = async () => {
    if (!editRowFields.name.trim() || !editRowFields.id.trim()) {
      triggerToast('Name and ID are required.');
      return;
    }

    const id = editRowFields.id.trim();
    const programme = editRowFields.programme.trim();
    const email = editRowFields.email.trim();
    const edited = csvPreviewRecords.map(rec => (
      rec.line !== editingCsvLine
        ? rec
        : {
            ...rec,
            id,
            name: editRowFields.name.trim(),
            programme,
            email,
            phone: editRowFields.phone.trim(),
            // What the office's choices filled in keeps following those
            // choices, unless it was typed over here.
            idInFile: id === rec.id ? rec.idInFile : undefined,
            programmeInFile: programme === rec.programme ? rec.programmeInFile : undefined,
            emailFilled: email === rec.email ? rec.emailFilled : undefined,
          }
    ));

    // The server re-checks the whole edited set, so an edit can never mark a
    // still-invalid row as Ready.
    setIsProcessingCsv(true);
    try {
      showCheckedRows(await previewWithChoices(reviewedFile(edited), reviewedOptions()));
      setRowsEdited(true);
      setEditingCsvLine(null);
      triggerToast('Row updated and checked again.');
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Could not check the edited rows.');
    } finally {
      setIsProcessingCsv(false);
    }
  };

  // Creates every Ready row; duplicates are skipped and other problem rows are
  // left out. The server records the run for Recent Imports.
  const handleCommitVerifiedCsv = async () => {
    if (csvPreviewRecords.length === 0) return;
    const editedSet = rowsEdited || !sourceFile;
    const file = editedSet
      ? reviewedFile(csvPreviewRecords)
      : sourceFile;

    setSaving(true);
    setCsvFatalError(null);
    try {
      const result = await commitStudentImport(file, {
        ...(editedSet ? reviewedOptions() : importOptions()),
        rememberLayout: layoutToRemember(),
      });
      const { batch, rows } = result;
      loadStudents();
      loadRecentImports(showAllImports ? 50 : 5);

      // The result panel lists every skipped and failed row. Only the rows that
      // were not imported stay in the preview, so they can be fixed and sent
      // again; skipped students need nothing more.
      setImportResult(result);
      const notImported = rows.filter(r => r.result === 'failed');
      if (notImported.length === 0) {
        clearImport();
      } else {
        setCsvPreviewRecords(notImported);
        setRowsEdited(true);
        setImportFilter('all');
      }
      triggerToast(`Import finished: ${batchSummary(batch)}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The import could not be completed.';
      setCsvFatalError(message);
      triggerToast(message);
    } finally {
      setSaving(false);
    }
  };

  // Activation emails an import held back go only to students from that
  // import who are still active and have not set a password.
  const handleSendHeld = async () => {
    if (!heldBatchToSend) return;
    setSendingHeld(true);
    try {
      const result = await sendBatchInvitations(heldBatchToSend.id);
      const notes = [
        result.failed ? `${result.failed} could not be sent.` : '',
        result.alreadyActivated ? `${result.alreadyActivated} had already set a password.` : '',
        result.suspended ? `${result.suspended} have sign-in suspended.` : '',
      ].filter(Boolean);
      triggerToast(
        [`Sent ${result.sent} activation email${result.sent === 1 ? '' : 's'}.`, ...notes].join(' '),
      );
      setImportResult((current) =>
        current && current.batch.id === result.batch.id
          ? { batch: result.batch, rows: rowsAfterHeldSend(current.rows, result.students) }
          : current,
      );
      loadRecentImports(showAllImports ? 50 : 5);
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'The activation emails could not be sent.');
    } finally {
      setSendingHeld(false);
      setHeldBatchToSend(null);
    }
  };

  const downloadImportProblems = (batch: RegistryImportBatch) => {
    downloadCsv(
      reviewedFileName(batch.fileName).replace('-reviewed.csv', '-skipped-and-not-imported.csv'),
      batch.problems,
      BATCH_PROBLEM_COLUMNS,
    );
  };

  const downloadImportReport = () => {
    if (!importResult) return;
    downloadCsv(
      reviewedFileName(importResult.batch.fileName).replace('-reviewed.csv', '-import-report.csv'),
      importResult.rows,
      IMPORT_REPORT_COLUMNS,
    );
  };

  // The Excel template keeps leading zeros and offers the programmes as a
  // dropdown, so a typed list has fewer mistakes than a CSV.
  const downloadExcelTemplate = async () => {
    try {
      const url = window.URL.createObjectURL(await downloadImportTemplate());
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'FSKTM_Student_Registry_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      triggerToast('Downloaded the Excel template.');
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'The Excel template could not be downloaded.');
    }
  };

  // Filtration logic for main Student Listing
  const filteredStudents = students.filter(student => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = student.name.toLowerCase().includes(searchLower) ||
                          student.id.toLowerCase().includes(searchLower) ||
                          student.email.toLowerCase().includes(searchLower);

    const matchesProgramme = selectedProgramme === 'All' || student.programme === selectedProgramme;
    const matchesSemester = selectedSemester === 'All' || student.semester === selectedSemester;
    const matchesAcademic = selectedAcademicStatus === 'All' || student.academicStatus === selectedAcademicStatus;
    const matchesSupervisor = selectedSupervisor === 'All'
      || (selectedSupervisor === NO_SUPERVISOR ? !student.supervisor : student.supervisor === selectedSupervisor);

    return matchesSearch && matchesProgramme && matchesSemester && matchesAcademic && matchesSupervisor;
  });

  const summary = summariseRegistry(students);
  const semesterOptions = distinctValues(students.map(s => s.semester));
  const supervisorOptions = distinctValues(students.map(s => s.supervisor));
  const columnCount = 6;

  // Paginated students records
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);

  // After a reload or a status change the list can shrink below the page the
  // office was on; move back to the last real page instead of an empty one.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const displayedStudents = filteredStudents.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  // Render variables for Bulk Indicators
  const importSummary = summariseImportRows(csvPreviewRecords);
  const readyCsvCount = importSummary.ready;
  const visibleImportRows = filterImportRows(csvPreviewRecords, importFilter);
  const skipText = skipNotice(importSummary);
  const filledEmailCount = csvPreviewRecords.filter((row) => row.emailFilled).length;
  const heldCount = heldBatchToSend?.created ?? 0;

  // Unsaved edits on an open record, so leaving it asks before they are lost.
  const recordDirty = viewingStudent !== null && !readOnly && (
    detailsDraft.name.trim() !== viewingStudent.name
    || detailsDraft.email.trim().toLowerCase() !== viewingStudent.email.toLowerCase()
    || detailsDraft.phone.trim() !== viewingStudent.phone
    || detailsDraft.programme !== viewingStudent.programme
    || detailsDraft.intakeDate.trim() !== viewingStudent.intakeDate
    || statusTarget !== ''
    || statusReason.trim() !== ''
  );

  return (
    <div id="student-registry-workspace" className="font-sans text-brand-navy text-xs pb-16 animate-fade-in relative">
      
      <PortalToast message={toastMessage} />

      <PortalConfirmModal
        isOpen={heldBatchToSend !== null}
        title={`Send activation emails to ${heldCount} student${heldCount === 1 ? '' : 's'}?`}
        message={`Only students from ${heldBatchToSend?.fileName ?? 'this import'} who have not set a password yet are emailed.`}
        confirmLabel="Send Emails"
        tone="info"
        icon={Mail}
        isLoading={sendingHeld}
        onConfirm={() => void handleSendHeld()}
        onCancel={() => setHeldBatchToSend(null)}
      />

      <>
          {/* ========================================================== */}
          {/* SCREEN A: PRIMARY REGISTRY STUDENT DIRECTORY LIST VIEW */}
          {/* ========================================================== */}
          {currentView === 'list' && (
        <div id="student-registry-directory-list" className="space-y-8">
          <PageHeader
            title="Student Registry"
            subtitle={readOnly ? 'Read-only view of the students in your scope.' : 'Manage student records, registrations and sign-in access.'}
            actions={
              <div className="flex items-center gap-3 select-none">
                <PortalButton onClick={handleExportCSV} variant="secondary" size="md" icon={Download}>
                  Export CSV
                </PortalButton>
                {!readOnly && (
                  <PortalButton
                    onClick={() => {
                      setCurrentView('register');
                      setRegisterActiveTab('bulk');
                    }}
                    variant="primary"
                    size="md"
                    icon={UserPlus}
                  >
                    Register New Students
                  </PortalButton>
                )}
              </div>
            }
          />

          {(!readOnly || canSeeTransfers) && (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <RegistryModuleTabs active="students" office={!readOnly} />
              {!readOnly && (
                <div className="flex flex-wrap items-center gap-2">
                  <PortalButton size="sm" icon={CalendarClock} onClick={() => navigate(APP_ROUTES.registryMoveStudents)}>Move students</PortalButton>
                  <PortalButton size="sm" icon={GraduationCap} onClick={() => navigate(APP_ROUTES.registryGraduate)}>Graduate students</PortalButton>
                </div>
              )}
            </div>
          )}

          {!readOnly && moveSummary?.semester && semesterMoveWaiting(moveSummary) && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3.5 text-[13.5px] font-semibold text-blue-900">
              <span>
                {moveSummary.semester.isSpecial
                  ? `The ${shortSemester(moveSummary.semester.label)} has started. Move the students taking it.`
                  : `${shortSemester(moveSummary.semester.label)} has started. ${studentCount(moveSummary.waiting)} still ${moveSummary.waiting === 1 ? 'needs' : 'need'} to move.`}
              </span>
              <PortalButton size="sm" variant="primary" onClick={() => navigate(APP_ROUTES.registryMoveStudents)}>Move students</PortalButton>
            </div>
          )}

          {/* ==================== SUMMARY CARDS STATEMENTS GRID ==================== */}
          <div id="student-summary-cards" className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <StatCard label="Total Students" value={summary.total.toLocaleString()} caption={readOnly ? 'In your scope' : 'In the registry'} icon={GraduationCap} tone="blue" />
            <StatCard label="Active" value={summary.active.toLocaleString()} caption="Currently studying" icon={UserCheck} tone="green" />
            <StatCard label="Deferred" value={summary.deferred.toLocaleString()} caption="On approved deferment" icon={Calendar} tone="amber" />
            <StatCard label="Graduated / Withdrawn" value={summary.exited.toLocaleString()} caption="No longer studying" icon={UserSquare} tone="slate" />
            <StatCard label="Awaiting Activation" value={summary.awaitingActivation.toLocaleString()} caption="Password not set yet" icon={ShieldAlert} tone="purple" />
          </div>

          {/* ==================== CENTRAL DATATABLE AND FILTERS ==================== */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-3xs">
            
            {/* Filtering Box Controls */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col gap-3 select-none">

              {/* Real-time Search Box */}
              <div className="relative w-full">
                <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="Search by name, student ID, or contact email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); 
                  }}
                  className="w-full bg-white border border-slate-200 text-slate-700 pl-10 pr-4 py-2.5 rounded-xl placeholder:text-slate-450 outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-3xs font-sans not-italic normal-case tracking-normal text-xs font-bold"
                />
              </div>

              {/* Dynamic Droplist selectors */}
              <div className="flex flex-wrap items-center gap-2">
                
                <SelectMenu
                  variant="filter"
                  prefix="Programme"
                  aria-label="Filter by programme"
                  value={selectedProgramme}
                  options={[
                    { value: 'All', label: 'All programmes', triggerLabel: 'All' },
                    ...PROGRAMME_OPTIONS.map((programme) => programmeOption(programme)),
                  ]}
                  onChange={(programme) => {
                    setSelectedProgramme(programme);
                    setCurrentPage(1);
                  }}
                />

                <SelectMenu
                  variant="filter"
                  prefix="Semester"
                  aria-label="Filter by semester"
                  value={selectedSemester}
                  options={[
                    { value: 'All', label: 'All semesters', triggerLabel: 'All' },
                    ...semesterOptions.map((semester) => ({ value: semester, label: semester })),
                  ]}
                  onChange={(semester) => {
                    setSelectedSemester(semester);
                    setCurrentPage(1);
                  }}
                />

                <SelectMenu
                  variant="filter"
                  prefix="Status"
                  aria-label="Filter by academic status"
                  value={selectedAcademicStatus}
                  options={[
                    { value: 'All', label: 'All statuses', triggerLabel: 'All' },
                    ...ACADEMIC_STATUSES.map(statusOption),
                  ]}
                  onChange={(academicStatus) => {
                    setSelectedAcademicStatus(academicStatus);
                    setCurrentPage(1);
                  }}
                />

                <SelectMenu
                  variant="filter"
                  prefix="Supervisor"
                  aria-label="Filter by supervisor"
                  value={selectedSupervisor}
                  options={[
                    { value: 'All', label: 'All supervisors', triggerLabel: 'All' },
                    { value: NO_SUPERVISOR, label: 'No supervisor yet' },
                    ...supervisorOptions.map((supervisor) => ({ value: supervisor, label: supervisor })),
                  ]}
                  onChange={(supervisor) => {
                    setSelectedSupervisor(supervisor);
                    setCurrentPage(1);
                  }}
                />

                <PortalButton
                  variant="secondary"
                  size="md"
                  icon={SlidersHorizontal}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedProgramme('All');
                    setSelectedSemester('All');
                    setSelectedAcademicStatus('All');
                    setSelectedSupervisor('All');
                    setCurrentPage(1);
                    triggerToast('All filters reset.');
                  }}
                >
                  Reset Filters
                </PortalButton>
              </div>
            </div>

            {/* DATATABLE LIST VIEW */}
            <div className="overflow-x-auto">
              <table className="data-table min-w-[860px]">
                <thead>
                  <tr className="data-thead bg-slate-50 select-none">
                    <th className="data-th">
                      Student Candidate
                    </th>
                    <th className="data-th">
                      Programme
                    </th>
                    <th className="data-th">
                      Supervisor
                    </th>
                    <th className="data-th text-center">
                      Academic Status
                    </th>
                    <th className="data-th">
                      Account Status
                    </th>
                    <th className="data-th text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={columnCount} className="p-0 text-xs font-semibold">
                        <LoadingState message="Loading students…" />
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={columnCount} className="p-0 text-xs font-semibold">
                        <ErrorState message={error} onRetry={loadStudents} />
                      </td>
                    </tr>
                  ) : displayedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="py-12 text-center text-slate-400 select-none text-xs font-bold">
                        No matching students found. Adjust the search or filters and try again.
                      </td>
                    </tr>
                  ) : (
                    displayedStudents.map((student) => {
                      return (
                        <tr key={student.id} className="data-row">
                          {/* Student identity details */}
                          <td className="data-td">
                            <div className="flex items-center gap-3 text-left">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 select-none border border-black/5 shadow-3xs ${student.avatarBg}`}>
                                {student.avatarText}
                              </div>
                              <div>
                                <h4 className="section-label">
                                  {student.name}
                                </h4>
                                <p className="text-[10px] text-slate-550 font-semibold tracking-wide font-mono mt-0.5">
                                  {student.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Programme column */}
                          <td className="data-td">
                            <ProgrammeChip label={student.programme} />
                          </td>

                          <td className="data-td">
                            {student.supervisor ? (
                              <div className="text-left">
                                <span className="text-[11.5px] font-extrabold text-slate-800 block">{student.supervisor}</span>
                                {student.supervisorStaffNo && (
                                  <span className="text-[10px] font-mono font-semibold text-slate-500">{student.supervisorStaffNo}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-400">Not assigned</span>
                            )}
                          </td>

                          {/* Academic status column */}
                          <td className="data-td text-center">
                            <StatusChip status={student.academicStatus} />
                          </td>

                          {/* Account status column */}
                          <td className="data-td">
                            <AccountStatusIndicator status={student.accountStatus} />
                          </td>

                          {/* Action column */}
                          <td className="data-td text-center">
                            <div className="flex items-center justify-center gap-1">
                              <PortalButton variant="secondary" size="sm" icon={Eye} onClick={() => setViewingStudent(student)}>
                                Inspect
                              </PortalButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* LOWER PORTAL PAGINATION FOOTER */}
            <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-[#e2e8f0] flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
              
              <div className="card-value text-left">
                Showing <strong className="card-value">{filteredStudents.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to{' '}
                <strong className="card-value">
                  {Math.min(currentPage * itemsPerPage, filteredStudents.length)}
                </strong>{' '}
                of <strong className="card-value">{filteredStudents.length}</strong> entries{' '}
                <span className="card-description">
                  (Total {summary.total.toLocaleString()} overall)
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1.5">

                {/* Pagination previous trigger */}
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage(Math.max(safePage - 1, 1))}
                  className="p-2 border border-slate-200 bg-white text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Number labels mapping */}
                {pageWindow(safePage, totalPages).map((pNum, index) => {
                  if (pNum === null) {
                    return (
                      <span key={`gap-${index}`} className="px-1 text-[11px] font-black text-slate-400" aria-hidden="true">
                        …
                      </span>
                    );
                  }
                  const matchesCurrent = safePage === pNum;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      aria-label={`Page ${pNum}`}
                      aria-current={matchesCurrent ? 'page' : undefined}
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-8.5 h-8.5 text-[11px] font-black rounded-lg transition flex items-center justify-center cursor-pointer ${
                        matchesCurrent
                          ? 'border border-blue-600 bg-blue-50 text-blue-600 font-extrabold'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                {/* Pagination next trigger */}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage(Math.min(safePage + 1, totalPages))}
                  className="p-2 border border-slate-200 bg-white text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

              </div>

            </div>

          </div>

        </div>
      )}


      {/* ========================================================== */}
      {/* SCREEN B: REGISTER NEW STUDENTS (CSV IMPORT & MANUAL FORM) */}
      {/* ========================================================== */}
      {currentView === 'register' && !readOnly && (
        <RecordPage
          title="Register New Students"
          subtitle="Import students from a CSV or Excel file, or add one student at a time."
          backLabel="Back to Student Registry"
          onBack={() => setCurrentView('list')}
          pageKey="registry-student-registration"
          dirty={
            !!manualFormData.name || !!manualFormData.id || !!manualFormData.email || !!manualFormData.phone
            || !!manualFormData.programme || !!manualFormData.intakeBatch || !!manualFormData.semester
            || !manualFormData.sendCredentialsImmediately || uploadedFile !== null
          }
          busy={isProcessingCsv || saving}
        >{requestBack => <div id="student-registry-register-view" className="space-y-8 text-left select-none animate-fade-in">

          <SegmentedControl<RegisterTab>
            variant="tabs"
            options={REGISTER_TABS}
            value={registerActiveTab}
            onChange={setRegisterActiveTab}
            labels={{ bulk: 'Bulk Import (Excel or CSV)', single: 'Single Student Entry' }}
          />

          {/* CONTENT COLUMNS GRID VIEW */}
          <div className={registerActiveTab === 'bulk' ? "grid grid-cols-1 lg:grid-cols-5 gap-6 items-start animate-fade-in" : "w-full animate-fade-in"}>
            
            {/* LEFT ACTIONS AREA FRAME */}
            <div className={registerActiveTab === 'bulk' ? "lg:col-span-3 space-y-6" : "w-full space-y-6"}>

              {/* TAB 1: BULK IMPORT ACTIVE VIEW */}
              {registerActiveTab === 'bulk' && (
                <div className="space-y-6">

                  {importResult && (
                    <RegistryImportResult
                      result={importResult}
                      onDownloadReport={downloadImportReport}
                      onClose={() => setImportResult(null)}
                      onSendHeld={() => setHeldBatchToSend(importResult.batch)}
                      sendingHeld={sendingHeld}
                    />
                  )}

                  {/* CSV FILE UPLOAD CARD */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs">
                    <div className="flex items-center justify-between gap-3 mb-4 select-none">
                      <div>
                        <h3 className="section-label">File Upload</h3>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          Drag and drop your student registry CSV or XLSX file below.
                        </p>
                      </div>
                      
                      {/* Live excel icon placeholder */}
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      </div>
                    </div>

                    {/* INTERACTIVE DRAG-DROP REGENCY DASHED */}
                    <div 
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={triggerFileSelect}
                      role={uploadedFile ? undefined : 'button'}
                      tabIndex={uploadedFile ? undefined : 0}
                      aria-label={uploadedFile ? undefined : 'Choose a CSV or Excel file to import'}
                      onKeyDown={(e) => {
                        if (!uploadedFile && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          triggerFileSelect();
                        }
                      }}
                      className={`border-2 border-dashed rounded-2xl p-8 py-9 transition-all text-center cursor-pointer flex flex-col items-center justify-center relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                        dragActive 
                          ? 'border-indigo-500 bg-indigo-50/30' 
                          : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <input 
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx"
                        className="hidden"
                        onChange={(e) => {
                          handleFileChange(e);
                          e.target.value = '';
                        }}
                      />

                      {/* Display files status or drag guidelines */}
                      {isProcessingCsv ? (
                        <div className="space-y-2 py-4">
                          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                          <span className="text-[11px] font-black tracking-wide text-indigo-650 block">Checking the file…</span>
                        </div>
                      ) : uploadedFile ? (
                        <div className="space-y-3 py-2">
                          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 relative shadow-sm">
                            <CheckCircle className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="text-[12px] font-black text-slate-800 block select-all">{uploadedFile.name}</span>
                            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">{uploadedFile.size} • {csvPreviewRecords.length} rows</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearImport();
                              triggerToast('Current file cleared.');
                            }}
                            className="px-3 py-1.5 bg-[#f8fafc] border border-slate-205 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-[9.5px] font-extrabold uppercase tracking-wide transition-colors"
                          >
                            Upload Different File
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3 py-2 select-none">
                          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-450 group-hover:scale-105 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition duration-200 flex items-center justify-center mx-auto border border-slate-150">
                            <UploadCloud className="w-5.5 h-5.5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-800 block group-hover:text-indigo-600 transition">Click to upload or drag and drop</span>
                            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">CSV or XLSX, up to 2 MB and 1,000 students</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* TEMPLATE DOWNLOAD & COLUMN GUIDE */}
                    <div className="border-t border-slate-100 mt-5 pt-4 select-none">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <button
                          type="button"
                          aria-expanded={showRequiredColumns}
                          aria-controls="import-column-guide"
                          onClick={() => setShowRequiredColumns(!showRequiredColumns)}
                          className="self-start sm:self-center text-slate-500 hover:text-slate-800 text-[10.5px] font-black flex items-center gap-1 cursor-pointer transition uppercase tracking-wide"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showRequiredColumns ? 'rotate-180' : ''}`} />
                          <span>Required Columns</span>
                        </button>

                        <PortalButton
                          variant="primary"
                          size="sm"
                          icon={FileSpreadsheet}
                          onClick={() => void downloadExcelTemplate()}
                          className="self-start sm:self-center"
                        >
                          Download Excel Template
                        </PortalButton>
                      </div>

                      <AnimatePresence initial={false}>
                        {showRequiredColumns && (
                          <motion.div
                            id="import-column-guide"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 border border-slate-200/80 rounded-xl overflow-hidden">
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-slate-50 text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400">
                                  <tr>
                                    <th className="px-3 py-2 font-extrabold">Column</th>
                                    <th className="hidden sm:table-cell px-3 py-2 font-extrabold">Needed</th>
                                    <th className="px-3 py-2 font-extrabold">What to enter</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {CSV_HEADERS.map((header) => (
                                    <tr key={header} className="align-top">
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <code className="font-mono text-[10.5px] font-semibold text-indigo-600">{header}</code>
                                        {/* Phones show the tag under the name instead of in its own column. */}
                                        <span className={`sm:hidden block mt-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${
                                          IMPORT_COLUMN_RULES[header].required ? 'text-brand-navy' : 'text-slate-400'
                                        }`}>
                                          {IMPORT_COLUMN_RULES[header].required ? 'Required' : 'Optional'}
                                        </span>
                                      </td>
                                      <td className="hidden sm:table-cell px-3 py-2 whitespace-nowrap">
                                        {IMPORT_COLUMN_RULES[header].required ? (
                                          <StatusBadge tone="brand" className="px-2 py-0.5 text-[9px]">Required</StatusBadge>
                                        ) : (
                                          <StatusBadge tone="neutral" className="px-2 py-0.5 text-[9px]">Optional</StatusBadge>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 font-semibold text-slate-600 leading-snug">{IMPORT_COLUMN_RULES[header].rule}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="mt-2 text-[10px] font-semibold text-slate-400">
                              Your own spreadsheet can use other column names; you match them in the next step.
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>

                </div>
              )}

              {/* TAB 2: MANUAL SINGLE CANDIDATE ENTRY FORM MATCHING MOCKUP */}
              {registerActiveTab === 'single' && (
                <div id="single-candidate-register-container" className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-3xs space-y-6">
                  <IconHeading title="New Student Registration" description="Enter the student's personal and academic details."
                    descriptionClassName="text-[11px] text-slate-500 font-semibold mt-0.5"
                    icon={<span className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0"><UserPlus className="w-5 h-5 text-brand-navy" /></span>}
                  />

                  <form onSubmit={handleRegisterManualSubmit} className="space-y-6">
                    
                    {/* PERSONAL INFORMATION SECTION */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                          Personal Information
                        </span>
                        <div className="flex-1 h-[1px] bg-slate-100" />
                      </div>

                      {/* Full Name */}
                      <div className="flex flex-col text-left">
                        <label htmlFor="full-name" className="form-label block">
                          Full Name
                        </label>
                        <input
                          id="full-name"
                          type="text"
                          required
                          placeholder="Enter student's legal full name"
                          value={manualFormData.name}
                          onChange={(e) => setManualFormData({ ...manualFormData, name: e.target.value })}
                          className="form-control form-control-md"
                        />
                      </div>

                      {/* Student ID (Matric No.) & Official Email on a row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Student ID */}
                        <div className="flex flex-col text-left">
                          <label htmlFor="student-id" className="form-label block">
                            Student ID (Matric No.)
                          </label>
                          <input
                            id="student-id"
                            type="text"
                            required
                            placeholder="e.g. WAA21001"
                            value={manualFormData.id}
                            onChange={(e) => setManualFormData({ ...manualFormData, id: e.target.value })}
                            className="form-control form-control-md"
                          />
                        </div>

                        {/* Official Email */}
                        <div className="flex flex-col text-left">
                          <label htmlFor="official-email" className="form-label block">
                            Official Email
                          </label>
                          <input
                            id="official-email"
                            type="email"
                            required
                            placeholder="student@siswa.um.edu.my"
                            value={manualFormData.email}
                            onChange={(e) => setManualFormData({ ...manualFormData, email: e.target.value })}
                            className="form-control form-control-md"
                          />
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="flex flex-col text-left">
                        <label htmlFor="phone-number" className="form-label block">
                          Phone Number
                        </label>
                        <input
                          id="phone-number"
                          type="tel"
                          placeholder="+60 1X-XXXXXXX"
                          value={manualFormData.phone}
                          onChange={(e) => setManualFormData({ ...manualFormData, phone: e.target.value })}
                          className="form-control form-control-md"
                        />
                      </div>
                    </div>

                    {/* ACADEMIC INFORMATION SECTION */}
                    <div className="space-y-4 pt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                          Academic Information
                        </span>
                        <div className="flex-1 h-[1px] bg-slate-100" />
                      </div>

                      {/* Programme Select */}
                      <div className="flex flex-col text-left">
                        <label htmlFor="programme-selection" className="form-label block">
                          Programme
                        </label>
                        <SelectMenu
                          id="programme-selection"
                          value={manualFormData.programme}
                          options={PROGRAMME_OPTIONS.map((programme) => programmeOption(programme))}
                          onChange={(programme) => setManualFormData({ ...manualFormData, programme })}
                          placeholder="Select registered programme"
                        />
                      </div>

                      {/* Intake Batch & Current Semester */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Intake Batch */}
                        <div className="flex flex-col text-left">
                          <label htmlFor="intake-batch" className="form-label block">
                            Intake Batch
                          </label>
                          <input
                            id="intake-batch"
                            type="text"
                            placeholder="e.g. 2023/2024"
                            value={manualFormData.intakeBatch}
                            onChange={(e) => setManualFormData({ ...manualFormData, intakeBatch: e.target.value })}
                            className="form-control form-control-md"
                          />
                        </div>

                        {/* Current Semester */}
                        <div className="flex flex-col text-left">
                          <label htmlFor="current-semester" className="form-label block">
                            Current Semester
                          </label>
                          <input
                            id="current-semester"
                            type="text"
                            list="registry-semester-options"
                            placeholder="e.g. Semester I, 2026/2027 Session"
                            value={manualFormData.semester}
                            onChange={(e) => setManualFormData({ ...manualFormData, semester: e.target.value })}
                            className="form-control form-control-md"
                          />
                          <datalist id="registry-semester-options">
                            {semesterOptions.map((semester) => (
                              <option key={semester} value={semester} />
                            ))}
                          </datalist>
                        </div>
                      </div>

                      <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                        Research title and supervisor are recorded later, through the supervisor
                        application and appointment workflow.
                      </p>
                    </div>

                    {/* ACCOUNT SETTINGS SECTION */}
                    <div className="space-y-4 pt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                          Account Settings
                        </span>
                        <div className="flex-1 h-[1px] bg-slate-100" />
                      </div>

                      {/* Info Box */}
                      <div id="notice-box-credentials" className="bg-[#f0f5ff] border border-[#d0e0ff] text-[#1e3a8a] rounded-2xl p-4 flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <p className="card-description text-left">
                          No password is created. The student receives an activation link and
                          chooses their own password, so no credential is ever sent by email.
                        </p>
                      </div>

                      {/* Send activation link now or later */}
                      <label
                        htmlFor="send-credentials-toggle"
                        className="border border-slate-200 rounded-2xl p-5 flex items-start gap-4 bg-white shadow-3xs cursor-pointer"
                      >
                        <input
                          id="send-credentials-toggle"
                          type="checkbox"
                          checked={manualFormData.sendCredentialsImmediately}
                          onChange={(e) => setManualFormData({
                            ...manualFormData,
                            sendCredentialsImmediately: e.target.checked
                          })}
                          className="mt-0.5 w-4.5 h-4.5 shrink-0 accent-blue-600 cursor-pointer"
                        />
                        <span className="text-left space-y-1">
                          <span className="block text-xs font-extrabold text-slate-900">
                            Send activation link immediately
                          </span>
                          <span className="block text-[11px] text-slate-500 font-medium leading-normal">
                            Email the student a link to set their password. Untick to register
                            the account now and send the link later from their profile.
                          </span>
                        </span>
                      </label>
                    </div>

                    {/* BOTTOM ACTIONS BAR */}
                    <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3 select-none">
                      <PortalButton variant="secondary" size="md" onClick={requestBack}>
                        Cancel
                      </PortalButton>
                      <PortalButton type="submit" variant="primary" size="md" icon={UserPlus} disabled={saving}>
                        {saving ? 'Registering…' : 'Register Student'}
                      </PortalButton>
                    </div>

                  </form>

                </div>
              )}

            </div>

            {/* RIGHT CONTEXTUAL INFO CARDS (40% WIDTH, ONLY FOR BULK TAB) */}
            {registerActiveTab === 'bulk' && (
              <div className="lg:col-span-2 lg:self-stretch flex flex-col">

              {/* CARD 1: IMPORT GUIDELINES LIST, as tall as the upload card */}
              <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs text-left">
                <div className="flex items-center gap-3 mb-4 select-none">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                    <Info className="w-5 h-5" />
                  </div>
                  <h3 className="section-label">Import Guidelines</h3>
                </div>

                <div className="space-y-4 text-xs">
                  {[
                    <>Upload the office&apos;s <strong className="text-slate-800 font-bold">own spreadsheet as it is</strong>: you confirm which column holds each detail. For a typed list, use the Excel template.</>,
                    <>Programme must be one of the <strong className="text-slate-800 font-bold">approved programmes</strong>; any other name is chosen once, or its rows skipped.</>,
                    <>Matric numbers and emails must be <strong className="text-slate-800 font-bold">unique</strong> in the file and not already registered. Duplicates are skipped and listed.</>,
                    <>Every new student receives an <strong className="text-slate-800 font-bold">activation email</strong> to choose their own password, now or later.</>,
                    <>CSV or XLSX, up to <strong className="text-slate-800 font-bold">2 MB and 1,000 students</strong> per import.</>,
                  ].map((guideline, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 select-none font-sans">✓</div>
                      <p className="text-slate-650 font-medium leading-relaxed">{guideline}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
            )}

            {/* The preview gets the full width: it is where the office works. */}
            {registerActiveTab === 'bulk' && (
              <div className="lg:col-span-5">
                {importStep === 'match' && importLayout && importMapping ? (
                  <RegistryImportMatch
                    layout={importLayout}
                    mapping={importMapping}
                    error={matchError}
                    busy={isProcessingCsv}
                    onMappingChange={setImportMapping}
                    defaults={importDefaults}
                    semesterSuggestions={semesterOptions}
                    onDefaultsChange={setImportDefaults}
                    onSheetChange={(sheet) => void reinspectImport({ sheet })}
                    onHeaderRowChange={(row) => {
                      setImportHasHeader(row !== null);
                      void reinspectImport({ sheet: importSheet, headerRow: row, hasHeader: row !== null });
                    }}
                    onUseSuggestions={switchToSuggestedMatches}
                    fillEmail={fillEmail}
                    onFillEmailChange={setFillEmail}
                    dropIdSuffix={dropIdSuffix}
                    onDropIdSuffixChange={setDropIdSuffix}
                    onContinue={() => void continueFromMatch()}
                    onCancel={() => {
                      clearImport();
                      triggerToast('Current file cleared.');
                    }}
                  />
                ) : (
                  <>
                    {/* IMPORT PREVIEW & VALIDATION SYSTEM LIST CONTAINER */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs">

                      {/* Upper title and verification counters */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 select-none">
                        <div>
                          <h3 className="section-label">Import Preview & Validation</h3>
                          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            Check each row before the accounts are created.
                          </p>
                          {uploadedFile && (
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                              <ImportSteps current={importStep === 'check' ? 2 : 0} />
                              {importStep === 'check' && importLayout && !rowsEdited && (
                                <button
                                  type="button"
                                  onClick={() => setImportStep('match')}
                                  className="text-[11px] font-black text-blue-600 hover:underline cursor-pointer"
                                >
                                  Change column matches
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* VALIDATION OUTPUT PILLS */}
                        <div className="flex flex-wrap items-center gap-1.5">

                          {/* Ready indicator */}
                          <div className="px-2.5 py-1 bg-emerald-50 text-[#00a15c] border border-[#bef5db] font-black text-[10px] uppercase rounded-full tracking-wide flex items-center gap-1 select-none">
                            <CheckCircle className="w-3 h-3" />
                            <span>{readyCsvCount} Ready</span>
                          </div>

                          {/* Already in the registry: skipped, and listed so the office sees who */}
                          <div className={`px-2.5 py-1 font-black text-[10px] uppercase rounded-full tracking-wide flex items-center gap-1 select-none border transition ${
                            importSummary.alreadyRegistered > 0
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-slate-50 text-slate-400 border-slate-150'
                          }`}>
                            <UserCheck className="w-3 h-3" />
                            <span>{importSummary.alreadyRegistered} Already Registered</span>
                          </div>

                          {importSummary.repeated > 0 && (
                            <div className="px-2.5 py-1 font-black text-[10px] uppercase rounded-full tracking-wide flex items-center gap-1 select-none border bg-slate-100 text-slate-600 border-slate-200">
                              <AlertCircle className="w-3 h-3" />
                              <span>{importSummary.repeated} Repeated</span>
                            </div>
                          )}

                          {filledEmailCount > 0 && (
                            <div className="px-2.5 py-1 font-black text-[10px] uppercase rounded-full tracking-wide flex items-center gap-1 select-none border bg-indigo-50 text-indigo-700 border-indigo-200">
                              <Mail className="w-3 h-3" />
                              <span>{filledEmailCount} Email{filledEmailCount === 1 ? '' : 's'} Filled</span>
                            </div>
                          )}

                          {importSummary.programmeSkipped > 0 && (
                            <div className="px-2.5 py-1 font-black text-[10px] uppercase rounded-full tracking-wide flex items-center gap-1 select-none border bg-slate-100 text-slate-600 border-slate-200">
                              <GraduationCap className="w-3 h-3" />
                              <span>{importSummary.programmeSkipped} Programme Skipped</span>
                            </div>
                          )}

                          {/* Rows that need correcting before they can be imported */}
                          <div className={`px-2.5 py-1 font-black text-[10px] uppercase rounded-full tracking-wide flex items-center gap-1 select-none border transition ${
                            importSummary.fix > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-400 border-slate-150'
                          }`}>
                            <AlertTriangle className="w-3 h-3" />
                            <span>{importSummary.fix} To Fix</span>
                          </div>

                        </div>
                      </div>

                      {programmeValues.length > 0 && (
                        <RegistryImportProgrammes
                          values={programmeValues}
                          total={programmeValueCount}
                          choices={programmeChoices}
                          busy={isProcessingCsv || saving}
                          onChoose={(key, choice) => void chooseProgramme(key, choice)}
                        />
                      )}

                      {csvPreviewRecords.length > 0 && (
                        <SegmentedControl<ImportRowFilter>
                          options={IMPORT_ROW_FILTERS}
                          value={importFilter}
                          onChange={setImportFilter}
                          labels={{
                            all: `All (${importSummary.total})`,
                            ready: `Ready (${importSummary.ready})`,
                            skipped: `Skipped (${importSummary.skipped})`,
                            fix: `Need Fixing (${importSummary.fix})`,
                          }}
                          className="w-fit max-w-full overflow-x-auto mb-3"
                        />
                      )}

                      {/* Parse failures and per-row commit failures */}
                      {csvFatalError && (
                        <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left">
                          <p className="text-[11px] font-black uppercase tracking-wide text-rose-700 mb-1">
                            Import problems
                          </p>
                          <pre className="whitespace-pre-wrap break-words text-[11px] font-semibold text-rose-800">
                            {csvFatalError}
                          </pre>
                        </div>
                      )}

                      {/* PREVIEW DATATABLE MAP */}
                      <div className={`border border-slate-150 rounded-xl overflow-x-auto mt-2 ${THIN_SCROLLBAR}`}>
                        <table className="data-table">
                          <thead>
                            <tr className="data-thead bg-slate-50 select-none">
                              <th className="data-th">Student ID</th>
                              <th className="data-th">Student</th>
                              <th className="data-th">Programme</th>
                              <th className="data-th text-center">Validation Status</th>
                              <th className="data-th text-center">Edit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 text-xs">
                            {csvPreviewRecords.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-slate-400 font-extrabold">
                                  {isProcessingCsv ? 'Checking the file…' : 'Upload a file to see its rows here.'}
                                </td>
                              </tr>
                            )}
                            {csvPreviewRecords.length > 0 && visibleImportRows.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-slate-400 font-extrabold">
                                  No rows in this group.
                                </td>
                              </tr>
                            )}
                            {visibleImportRows.map((item) => {
                              const isBeingEdited = editingCsvLine === item.line;

                              if (isBeingEdited) {
                                return (
                                  <tr key={item.line} className="bg-amber-50/60 font-medium">
                                    <td className="data-td">
                                      <input
                                        type="text"
                                        value={editRowFields.id}
                                        onChange={(e) => setEditRowFields({ ...editRowFields, id: e.target.value })}
                                        className="w-20 bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-mono font-bold outline-none text-slate-800"
                                      />
                                    </td>
                                    <td className="data-td">
                                      <input
                                        type="text"
                                        value={editRowFields.name}
                                        onChange={(e) => setEditRowFields({ ...editRowFields, name: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-bold outline-none text-slate-800"
                                      />
                                    </td>
                                    <td className="data-td">
                                      <input
                                        type="text"
                                        value={editRowFields.programme}
                                        onChange={(e) => setEditRowFields({ ...editRowFields, programme: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-bold outline-none text-slate-800"
                                      />
                                    </td>
                                    <td className="data-td">
                                      <div className="flex flex-col gap-1.5">
                                        <input
                                          type="text"
                                          aria-label="Email"
                                          placeholder="Email"
                                          value={editRowFields.email}
                                          onChange={(e) => setEditRowFields({ ...editRowFields, email: e.target.value })}
                                          className="w-40 bg-white border border-slate-300 rounded px-1.5 py-1 text-[10.5px] outline-none text-slate-800"
                                        />
                                        <input
                                          type="text"
                                          aria-label="Phone"
                                          placeholder="Phone (optional)"
                                          value={editRowFields.phone}
                                          onChange={(e) => setEditRowFields({ ...editRowFields, phone: e.target.value })}
                                          className="w-40 bg-white border border-slate-300 rounded px-1.5 py-1 text-[10.5px] outline-none text-slate-800"
                                        />
                                      </div>
                                    </td>
                                    <td className="data-td text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={handleSaveEditedRow}
                                          disabled={isProcessingCsv}
                                          className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] uppercase font-bold cursor-pointer disabled:opacity-50"
                                          title="Confirm Changes"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingCsvLine(null)}
                                          className="p-1 bg-slate-300 hover:bg-slate-400 text-slate-800 rounded text-[10px] uppercase font-bold cursor-pointer"
                                          title="Discard Changes"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={item.line} className="hover:bg-slate-50/50 transition">
                                  <td className="data-td font-bold font-mono text-slate-600 whitespace-nowrap">
                                    {item.id}
                                    {item.idInFile && (
                                      <span className="block font-sans text-[10px] font-bold text-indigo-600">In the file: {item.idInFile}</span>
                                    )}
                                  </td>
                                  <td className="data-td min-w-[12rem]">
                                    <span className="block font-extrabold text-slate-850">{item.name}</span>
                                    {rowExplanation(item) && (
                                      <span className="block mt-0.5 max-w-[22rem] text-[10.5px] font-semibold text-slate-500">
                                        {rowExplanation(item)}
                                      </span>
                                    )}
                                    {differenceWarning(item) && (
                                      <span className="mt-1 flex max-w-[22rem] items-start gap-1 text-[10.5px] font-bold text-amber-700">
                                        <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                                        <span>{differenceWarning(item)}</span>
                                      </span>
                                    )}
                                    {item.emailFilled && (
                                      <span className="block mt-0.5 max-w-[22rem] truncate text-[10.5px] font-bold text-indigo-600" title={item.email}>
                                        Email from Student ID: {item.email}
                                      </span>
                                    )}
                                  </td>
                                  <td className="data-td text-left" title={item.programme}>
                                    <span className="block text-[11px] font-bold text-slate-600">{describeProgramme(item.programme).field}</span>
                                    {describeProgramme(item.programme).detail && (
                                      <span className="block text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                                        {describeProgramme(item.programme).detail}
                                      </span>
                                    )}
                                    {item.programmeInFile && (
                                      <span className="block max-w-[14rem] truncate text-[10px] font-bold text-indigo-600">
                                        In the file: {item.programmeInFile}
                                      </span>
                                    )}
                                  </td>

                                  {/* Status Outcome render badge */}
                                  <td className="data-td text-center">
                                    {item.status === 'Ready' && (
                                      <span className="inline-flex items-center gap-1 text-[#00a15c] bg-[#e6fbf2] border border-[#bef5db] text-[9.5px] font-black rounded-full px-2.5 py-0.5 tracking-wide uppercase select-none">
                                        <Check className="w-3 h-3 stroke-[2.5]" />
                                        <span>Ready</span>
                                      </span>
                                    )}
                                    {item.status === 'Missing Email' && (
                                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 text-[9.5px] font-black rounded-full px-2.5 py-0.5 tracking-wide uppercase select-none">
                                        <AlertTriangle className="w-3 h-3 animate-bounce" />
                                        <span>Missing Email</span>
                                      </span>
                                    )}
                                    {item.status === 'Already Registered' && (
                                      <span className="inline-flex items-center gap-1 text-sky-700 bg-sky-50 border border-sky-200 text-[9.5px] font-black rounded-full px-2.5 py-0.5 tracking-wide uppercase select-none whitespace-nowrap">
                                        <UserCheck className="w-3 h-3" />
                                        <span>Already Registered</span>
                                      </span>
                                    )}
                                    {item.status === 'Duplicate In File' && (
                                      <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-200 text-[9.5px] font-black rounded-full px-2.5 py-0.5 tracking-wide uppercase select-none">
                                        <AlertCircle className="w-3 h-3" />
                                        <span>Repeated</span>
                                      </span>
                                    )}
                                    {item.status === 'Programme Skipped' && (
                                      <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-200 text-[9.5px] font-black rounded-full px-2.5 py-0.5 tracking-wide uppercase select-none whitespace-nowrap">
                                        <GraduationCap className="w-3 h-3" />
                                        <span>Skipped</span>
                                      </span>
                                    )}
                                    {!['Ready', 'Missing Email', 'Already Registered', 'Duplicate In File', 'Programme Skipped'].includes(item.status) && (
                                      <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-250 text-[9.5px] font-black rounded-full px-2.5 py-0.5 tracking-wide uppercase select-none">
                                        <AlertCircle className="w-3 h-3" />
                                        <span>{item.status}</span>
                                      </span>
                                    )}
                                  </td>

                                  {/* Actions pencil trigger */}
                                  <td className="data-td text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditingRow(item)}
                                      className="p-1 px-1.5 hover:bg-slate-100 rounded border border-transparent hover:border-slate-205 text-slate-450 hover:text-slate-900 transition-all cursor-pointer"
                                      title="Edit Row"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* BOTTON FORM ACTION CONTROLS */}
                      <div className="flex flex-col-reverse gap-4 mt-6 select-none md:flex-row md:items-center md:justify-between">

                        <PortalButton variant="secondary" size="md" onClick={requestBack} className="self-start md:self-auto">
                          Cancel
                        </PortalButton>

                        {/* Primary actions on right */}
                        <div className="flex flex-wrap items-center justify-end gap-3">

                          {/* Rows with problems are corrected individually via the
                              Edit action on each row. Auto-filling an email or a
                              matric number would attach a real account to the
                              wrong person. */}

                          {(skipText || importSummary.fix > 0) && (
                            <div className="text-[10px] font-semibold text-slate-500 max-w-[260px] text-right space-y-0.5">
                              {skipText && (
                                <p>
                                  {skipText}{' '}
                                  <button
                                    type="button"
                                    onClick={() => setImportFilter('skipped')}
                                    className="font-black text-blue-600 hover:underline cursor-pointer"
                                  >
                                    View
                                  </button>
                                </p>
                              )}
                              {importSummary.fix > 0 && (
                                <p>
                                  {importSummary.fix === 1 ? '1 row needs' : `${importSummary.fix} rows need`} fixing and will be left out.
                                </p>
                              )}
                            </div>
                          )}

                          <div role="group" aria-labelledby="registry-import-email-choice" className="flex flex-col items-end gap-1">
                            <span id="registry-import-email-choice" className="text-[9.5px] uppercase font-black tracking-wider text-slate-400">
                              Activation emails
                            </span>
                            <SegmentedControl<'now' | 'later'>
                              options={['now', 'later'] as const}
                              value={sendInvitesNow ? 'now' : 'later'}
                              onChange={(choice) => setSendInvitesNow(choice === 'now')}
                              labels={{ now: 'Send now', later: 'Send later' }}
                            />
                            {!sendInvitesNow && (
                              <span className="text-[10px] font-semibold text-slate-500">Send them from Recent Imports when ready.</span>
                            )}
                          </div>

                          <PortalButton
                            variant="primary"
                            size="md"
                            icon={UserCheck}
                            onClick={handleCommitVerifiedCsv}
                            disabled={saving || isProcessingCsv || readyCsvCount === 0}
                          >
                            {saving ? 'Creating accounts…' : `Create ${readyCsvCount} Ready Account${readyCsvCount === 1 ? '' : 's'}`}
                          </PortalButton>

                        </div>

                      </div>

                    </div>
                  </>
                )}
              </div>
            )}

            {registerActiveTab === 'bulk' && (
              <div className="lg:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* CARD 2: CURRENT SEMESTER OVERVIEW CLOCK */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs text-left">
                  <div className="flex items-center gap-3 mb-4 select-none">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 border border-pink-100 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h3 className="section-label">Registry Snapshot</h3>
                  </div>

                  {/* Sub bento items */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                  
                    {/* Item 1: Total count */}
                    <div className="bg-blue-50/50 border border-blue-100/75 rounded-2xl p-4 text-left select-none relative overflow-hidden group">
                      <span className="card-label block">Total Registered</span>
                      <h3 className="card-metric text-blue-700 mt-1">{students.length.toLocaleString()}</h3>
                      <div className="absolute right-3 bottom-2 animate-pulse text-blue-500/10">
                        <GraduationCap className="w-8 h-8" />
                      </div>
                    </div>

                    {/* Item 2: Pending count */}
                    <div className="bg-amber-50/50 border border-amber-150/75 rounded-2xl p-4 text-left select-none relative overflow-hidden group">
                      <span className="card-label block">Awaiting Activation</span>
                      <h3 className="card-metric text-amber-700 mt-1">
                        {students.filter(s => s.activated === false).length.toLocaleString()}
                      </h3>
                      <div className="absolute right-3 bottom-2 text-amber-600/15">
                        <ShieldAlert className="w-8 h-8" />
                      </div>
                    </div>

                  </div>
                </div>

                {/* CARD 3: RECENT IMPORTS METADATA HISTORIES */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs text-left">
                  <div className="flex items-center justify-between gap-3 mb-4 select-none">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <h3 className="section-label">Recent Imports</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllImports(!showAllImports)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-bold cursor-pointer"
                    >
                      {showAllImports ? 'Show Recent' : 'View All'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {recentImportsError && (
                      <p className="text-[10.5px] font-semibold text-rose-600">{recentImportsError}</p>
                    )}
                    {!recentImportsError && recentImports.length === 0 && (
                      <p className="text-[10.5px] font-semibold text-slate-400">No imports yet.</p>
                    )}
                    {recentImports.map((batch) => (
                      <div
                        key={batch.id}
                        className="p-3 bg-[#f8fafc] border border-slate-200/50 rounded-xl flex items-center justify-between gap-3 text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-brand-navy text-[11px] block truncate select-all" title={batch.fileName}>
                              {batch.fileName}
                            </span>
                            <span className="text-[9.5px] text-slate-400 font-bold block mt-0.5">
                              {new Date(batch.createdAt).toLocaleDateString()} • {batchSummary(batch)}
                            </span>
                            {batch.uploadedBy && (
                              <span className="text-[9.5px] text-slate-400 font-semibold block">by {batch.uploadedBy}</span>
                            )}
                            {batch.invitationsHeld && (
                              <span className="mt-1 inline-flex items-center gap-1.5">
                                <span className="text-[9.5px] font-black uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                  Emails on hold
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setHeldBatchToSend(batch)}
                                  className="text-[10px] font-black text-blue-600 hover:underline cursor-pointer"
                                >
                                  Send now
                                </button>
                              </span>
                            )}
                          </div>
                        </div>

                        {batch.problems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => downloadImportProblems(batch)}
                            className="p-1 px-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-brand-navy transition cursor-pointer shrink-0"
                            title="Download the rows that were skipped or not imported"
                            aria-label={`Download the rows from ${batch.fileName} that were skipped or not imported`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>}</RecordPage>
      )}
        </>

      {/* ========================================================== */}
      {/* MODAL DETAILED OVERLAY: VIEW PROFILE DETAILS (EYE TRIGGER) */}
      {/* ========================================================== */}
      {viewingStudent ? <RecordPage title="Student Record" subtitle="Registry details, edits and sign-in access." backLabel="Back to Student Registry" onBack={closeRecord} pageKey={`registry-student:${viewingStudent.id}`} dirty={recordDirty} busy={statusSaving || saving || detailsSaving}>{requestBack => <section className="space-y-5 rounded-2xl border border-slate-200 bg-white text-left">

              {/* Core student details body; only this part scrolls */}
              <div className={`flex-1 min-h-0 overflow-y-auto p-6 md:p-8 space-y-6 mr-1 mb-3 ${THIN_SCROLLBAR}`}>
                
                {/* Header Profile element with initials */}
                <div className="flex items-center gap-4 py-3 border-b border-slate-100">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-extrabold shadow-3xs select-none ${viewingStudent.avatarBg}`}>
                    {viewingStudent.avatarText}
                  </div>
                  <div className="text-left">
                    <h3 className="section-label">{viewingStudent.name}</h3>
                    <p className="text-[10.5px] text-slate-500 font-mono mt-0.5">{viewingStudent.id}</p>
                  </div>
                  <Link to={`${APP_ROUTES.files}?student=${encodeURIComponent(viewingStudent.id)}`} className="back-link ml-auto">
                    View files
                  </Link>
                </div>

                {/* Information Attributes Grid */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs font-sans font-bold">
                  
                  {/* Programe Mapped */}
                  <div>
                    <span className="card-label block mb-1">
                      Programme Mapped
                    </span>
                    <ProgrammeChip label={viewingStudent.programme} />
                    {transfer?.pending ? (
                      <div className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] font-semibold text-amber-900">
                        <p>
                          Transfer to {transfer.pending.destination} waiting for{' '}
                          {transfer.pending.waitingFor.length ? transfer.pending.waitingFor.join(' or ') : 'a programme coordinator'}.
                        </p>
                        {canSeeTransfers && (
                          <button
                            type="button"
                            className="font-bold text-blue-700 hover:text-blue-900"
                            onClick={() => navigate(routeForProgrammeTransfer(transfer.pending!.id), { state: { recordReturn: { path: `${APP_ROUTES.registry}?student=${encodeURIComponent(viewingStudent.id)}`, label: 'Student Record' } } })}
                          >
                            View transfer
                          </button>
                        )}
                      </div>
                    ) : !readOnly && transfer?.hasResearchProfile ? (
                      <PortalButton
                        size="sm"
                        icon={ArrowRightLeft}
                        className="mt-2"
                        onClick={() => navigate(routeForNewProgrammeTransfer(viewingStudent.id), { state: { recordReturn: { path: `${APP_ROUTES.registry}?student=${encodeURIComponent(viewingStudent.id)}`, label: 'Student Record' } } })}
                      >
                        Request programme transfer
                      </PortalButton>
                    ) : null}
                  </div>

                  {/* Academic Status checks */}
                  <div>
                    <span className="card-label block mb-1">
                      Academic Status
                    </span>
                    <StatusChip status={viewingStudent.academicStatus} />
                  </div>

                  {/* Semester details */}
                  <div>
                    <span className="card-label block mb-1">
                      Current Semester
                    </span>
                    <span className="text-slate-800 font-bold flex items-center gap-1.5 pt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="card-description">{viewingStudent.semester}</span>
                    </span>
                  </div>

                  <div>
                    <span className="card-label block mb-1">
                      Intake
                    </span>
                    <span className="text-slate-800 font-bold block pt-0.5">{viewingStudent.intakeDate || '-'}</span>
                  </div>

                  {/* Academic supervisorassigned */}
                  <div>
                    <span className="card-label block mb-1">
                      Academic Supervisor
                    </span>
                    <span className="card-value block pt-0.5">
                      {viewingStudent.supervisor || 'Not assigned'}
                      {viewingStudent.supervisorStaffNo && (
                        <span className="font-mono font-semibold text-slate-500 text-[10px] ml-1.5">{viewingStudent.supervisorStaffNo}</span>
                      )}
                    </span>
                  </div>

                  {/* Contact Email */}
                  <div>
                    <span className="card-label block mb-1">
                      Administrative Email
                    </span>
                    <span className="text-blue-600 font-bold hover:underline select-all flex items-center gap-1.5 break-all pt-0.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="card-description text-blue-600">{viewingStudent.email}</span>
                    </span>
                  </div>

                  {/* Mobile phone Contact */}
                  <div>
                    <span className="card-label block mb-1">
                      Direct Mobile Contact
                    </span>
                    <span className="text-slate-700 font-mono font-bold select-all block pt-0.5">{viewingStudent.phone || '-'}</span>
                  </div>

                </div>

                <StudentSemestersCard
                  matric={viewingStudent.id}
                  readOnly={readOnly}
                  onChanged={refreshViewingStudent}
                />

                {!readOnly && (
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-450 block">
                    Edit Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 form-label">
                      Full Name
                      <input
                        type="text"
                        value={detailsDraft.name}
                        onChange={(e) => editDetails({ name: e.target.value })}
                        disabled={detailsSaving}
                        maxLength={255}
                        className="form-control form-control-sm normal-case tracking-normal"
                      />
                    </label>
                    <label className="flex flex-col gap-1 form-label">
                      Email (used to sign in)
                      <input
                        type="email"
                        value={detailsDraft.email}
                        onChange={(e) => editDetails({ email: e.target.value })}
                        disabled={detailsSaving}
                        maxLength={254}
                        className="form-control form-control-sm normal-case tracking-normal"
                      />
                    </label>
                    <label className="flex flex-col gap-1 form-label">
                      Phone
                      <input
                        type="tel"
                        value={detailsDraft.phone}
                        onChange={(e) => editDetails({ phone: e.target.value })}
                        disabled={detailsSaving}
                        maxLength={32}
                        placeholder="e.g. 012-3456789"
                        className="form-control form-control-sm normal-case tracking-normal"
                      />
                    </label>
                    {transfer?.hasResearchProfile ? (
                      <div className="flex flex-col gap-1 form-label">
                        Programme
                        <span className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700">
                          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                          {viewingStudent.programme}
                        </span>
                        <span className="text-[10.5px] font-semibold normal-case tracking-normal text-slate-500">
                          Has a research profile, so the programme changes through Request programme transfer.
                        </span>
                      </div>
                    ) : (
                    <label className="flex flex-col gap-1 form-label">
                      Programme
                      <SelectMenu
                        size="sm"
                        value={detailsDraft.programme}
                        options={[
                          // A record can still hold a programme from before the approved list.
                          ...((PROGRAMME_OPTIONS as readonly string[]).includes(detailsDraft.programme)
                            ? []
                            : [programmeOption(detailsDraft.programme, detailsDraft.programme ? 'Not on the approved list' : undefined)]),
                          ...PROGRAMME_OPTIONS.map((programme) => programmeOption(programme)),
                        ]}
                        onChange={(programme) => editDetails({ programme })}
                        disabled={detailsSaving}
                      />
                    </label>
                    )}
                    <label className="flex flex-col gap-1 form-label">
                      Intake
                      <input
                        type="text"
                        value={detailsDraft.intakeDate}
                        onChange={(e) => editDetails({ intakeDate: e.target.value })}
                        disabled={detailsSaving}
                        maxLength={32}
                        placeholder="e.g. 2026/2027 Semester I"
                        className="form-control form-control-sm normal-case tracking-normal"
                      />
                    </label>
                  </div>
                  {detailsError && (
                    <p role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-[10.5px] text-rose-700 font-bold">
                      {detailsError}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveDetails}
                      disabled={detailsSaving}
                      className="px-4 py-2 bg-slate-900 shadow-3xs text-white uppercase text-[10px] font-black tracking-wide rounded-xl hover:bg-slate-800 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {detailsSaving ? 'Saving…' : 'Save Details'}
                    </button>
                  </div>
                </div>
                )}

                {!readOnly && (
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-450 block">
                    Change Academic Status
                  </h4>
                  {studentStatusOptions(viewingStudent.academicStatus).length === 0 ? (
                    <p className="text-[10.5px] text-slate-500 font-bold">
                      {viewingStudent.academicStatus} is a final status. No further changes are available.
                    </p>
                  ) : (
                    <>
                      <SelectMenu<StudentAcademicStatus>
                        size="sm"
                        aria-label="New academic status"
                        placeholder="Select new status"
                        value={statusTarget}
                        options={studentStatusOptions(viewingStudent.academicStatus).map(statusOption)}
                        onChange={setStatusTarget}
                        disabled={statusSaving}
                      />
                      <textarea
                        value={statusReason}
                        onChange={(e) => setStatusReason(e.target.value)}
                        disabled={statusSaving}
                        rows={2}
                        maxLength={1000}
                        placeholder="Reason for the change (required)"
                        className="form-control form-control-sm resize-none"
                      />
                      {statusError && (
                        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-[10.5px] text-rose-700 font-bold space-y-1.5">
                          <p>{statusError}</p>
                          {statusBlockers.length > 0 && (
                            <ul className="list-disc pl-4 font-semibold">
                              {statusBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                            </ul>
                          )}
                          {statusBlockers.length > 0 && onOpenParticipantLifecycle && (
                            <button
                              type="button"
                              onClick={onOpenParticipantLifecycle}
                              className="underline font-black text-rose-800 cursor-pointer"
                            >
                              Resolve in Participant Lifecycle
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleStatusChange}
                          disabled={statusSaving || !statusTarget || !statusReason.trim()}
                          className="px-4 py-2 bg-slate-900 shadow-3xs text-white uppercase text-[10px] font-black tracking-wide rounded-xl hover:bg-slate-800 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {statusSaving ? 'Saving…' : 'Apply Status Change'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                )}

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3">
                  <h4 className="section-label block">
                    Account
                  </h4>

                  <div className="space-y-2 text-[10.5px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        viewingStudent.activated === false ? 'bg-amber-100 text-[#ea580c]' : 'bg-emerald-100 text-[#00a15c]'
                      }`}>
                        {viewingStudent.activated === false ? '!' : '✓'}
                      </div>
                      <span className="text-slate-700 font-bold">
                        {viewingStudent.activated === false
                          ? 'Not activated: the student has not set a password yet'
                          : 'Activated'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        viewingStudent.accountStatus === 'Verified' ? 'bg-emerald-100 text-[#00a15c]' : 'bg-amber-100 text-[#ea580c]'
                      }`}>
                        {viewingStudent.accountStatus === 'Verified' ? '✓' : '!'}
                      </div>
                      <span className="text-slate-700 font-bold">
                        {viewingStudent.accountStatus === 'Verified' ? 'Sign-in allowed' : 'Suspended: sign-in blocked'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-4.5 h-4.5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">•</div>
                      <span className="text-slate-500 font-semibold">
                        Last sign-in: {viewingStudent.lastLogin ? historyTime(viewingStudent.lastLogin) : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* footer buttons modal (sign-in state is shown in the Account box above) */}
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-wrap items-center justify-end gap-2 shrink-0 select-none">
                <div className="flex flex-wrap justify-end gap-2">

                  {!readOnly && viewingStudent.accountStatus === 'Verified' && (
                    <PortalButton
                      variant="secondary"
                      size="sm"
                      icon={Mail}
                      disabled={sendingAccessLink}
                      onClick={handleSendAccessLink}
                      className="whitespace-nowrap"
                    >
                      {sendingAccessLink
                        ? 'Sending…'
                        : viewingStudent.activated === false
                          ? 'Send Activation Link'
                          : 'Send Reset Link'}
                    </PortalButton>
                  )}

                  {/* Suspend or reinstate sign-in, always confirmed first */}
                  {!readOnly && viewingStudent.accountStatus === 'Verified' && (
                    <PortalButton
                      variant="danger"
                      size="sm"
                      disabled={saving}
                      onClick={() => setAccessChange('Suspended')}
                      className="whitespace-nowrap"
                    >
                      Suspend Sign-in
                    </PortalButton>
                  )}
                  {!readOnly && viewingStudent.accountStatus === 'Suspended' && (
                    <PortalButton
                      variant="primary"
                      size="sm"
                      disabled={saving}
                      onClick={() => setAccessChange('Verified')}
                      className="whitespace-nowrap"
                    >
                      Reinstate Sign-in
                    </PortalButton>
                  )}

                  <PortalButton variant="secondary" size="sm" onClick={requestBack} className="whitespace-nowrap">
                    Back
                  </PortalButton>

                </div>
              </div>

              <PortalConfirmModal
                isOpen={accessChange !== null}
                title={accessChange === 'Suspended' ? 'Suspend sign-in?' : 'Reinstate sign-in?'}
                message={
                  accessChange === 'Suspended'
                    ? `${viewingStudent.name} will be signed out everywhere and cannot sign in until reinstated.`
                    : `${viewingStudent.name} will be able to sign in again.`
                }
                confirmLabel={accessChange === 'Suspended' ? 'Suspend' : 'Reinstate'}
                tone={accessChange === 'Suspended' ? 'danger' : 'info'}
                isLoading={saving}
                onConfirm={handleAccessChange}
                onCancel={() => setAccessChange(null)}
              />

            </section>}</RecordPage> : null}

    </div>
  );
};
