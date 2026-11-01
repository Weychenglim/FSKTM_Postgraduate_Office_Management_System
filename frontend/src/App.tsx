import {appointmentMarkingRoute} from './utils/appointmentMarking';
import {recordPathWithSearch} from './utils/recordNavigation';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Navigate, matchPath, useLocation, useNavigate } from 'react-router';
import { AuthLayout } from './components/AuthLayout';
import { LoginCard } from './components/LoginCard';
import { ForgotPasswordFlow } from './components/ForgotPasswordFlow';
import { AppLayout } from './components/AppLayout';
import { MarksOverview } from './components/MarksOverview';
import { PortalToast } from './components/PortalPrimitives';
import { OfficeDashboardLayout, isOfficeDashboardPresentation } from './components/OfficeDashboardLayout';
import {ModuleFeedbackScope} from './components/ModuleFeedbackScope';
import {OfficeMonitoringProvider} from './components/OfficeMonitoringContext';
import { officeWorkloadNavigationState, officeMarksDeadlineRoute } from './utils/officeDashboard';
import { Briefcase } from 'lucide-react';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { ForcedPasswordChange } from './components/ForcedPasswordChange';
import type { DemoUser, NotificationItem } from './types';
import { SIDEBAR_ITEMS } from './constants/navigation';
import { supervisorResearchLabel } from './utils/supervisorWorkspace';
import {
  APP_ROUTES,
  isKnownAppPath,
  routeForDashboardTimeline,
  routeForDocument,
  routeForLetterApplication,
  routeForLetterRequest,
  routeForMarkRecord,
  routeForNotificationTarget,
  routeForPanelAssignment,
  routeForPanelRecord,
  routeForPanelRecommendation,
  routeForPanelRecommendationStart,
  routeForPanelReviewedRequests,
  routeForPanelSubmittedRecommendations,
  routeForPanelWorkload,
  routeForStudentProgress,
  routeForSupervisorApplication,
  routeForSupportingSupervisorRequest,
  routeForSupervisorHistory,
  routeForSupervisorNewApplication,
  routeForSupervisorRequirements,
  routeForSupervisorSupervisee,
  routeForSupervisorWorkload,
  routeForSupervisorResearchRequest,
  routeForSidebarItem,
  sidebarItemForPath,
} from './constants/routes';
import {
  canAccessMarksAdministration,
  canAccessModule,
} from './auth/permissions';
import * as authApi from './services/authApi';
import {
  PASSWORD_CHANGE_REQUIRED_EVENT,
  SESSION_EXPIRED_EVENT,
  clearAuthToken,
} from './services/apiClient';
import { NotificationsProvider } from './context/NotificationsContext';
import { defaultLandingPageForUser } from './utils/landingPage';
import { returnPathAfterSignIn, type SignInReturnState } from './utils/signInReturn';
import { MarkRecordStatusTab } from './utils/markRecords';
import { recordBackSteps, recordReturn, recordSourceLabel, studentSupervisorRequestReturn } from './utils/recordNavigation';


const lazyNamed = (
  exportName: string,
  loadModule: () => Promise<Record<string, unknown>>,
) => React.lazy(async () => {
  const module = await loadModule();
  return { default: module[exportName] as React.ComponentType<any> };
});

const MarkEntryPeriodConfig = lazyNamed('MarkEntryPeriodConfig', () => import('./components/MarkEntryPeriodConfig'));
const RubricsManagementView = lazyNamed('RubricsManagementView', () => import('./components/RubricsManagementView'));
const EvaluationTaskAssignment = lazyNamed('EvaluationTaskAssignment', () => import('./components/EvaluationTaskAssignment'));
const MarkEntryRecords = lazyNamed('MarkEntryRecords', () => import('./components/MarkEntryRecords'));
const MarkEntryRecordDetail = lazyNamed('MarkEntryRecordDetail', () => import('./components/MarkEntryRecordDetail'));
const PanelAppointmentManagement = lazyNamed('PanelAppointmentManagement', () => import('./components/PanelAppointmentManagement'));
const OfficeSupervisorWorkspace = lazyNamed('OfficeSupervisorWorkspace', () => import('./components/OfficeSupervisorWorkspace'));
const SupervisorDocumentRequirements = lazyNamed('SupervisorDocumentRequirements', () => import('./components/SupervisorDocumentRequirements'));
const LecturerMarksEntry = lazyNamed('LecturerMarksEntry', () => import('./components/LecturerMarksEntry'));
const LecturerPanelAppointments = lazyNamed('LecturerPanelAppointments', () => import('./components/LecturerPanelAppointments'));
const LecturerSupervisorAppointments = lazyNamed('LecturerSupervisorAppointments', () => import('./components/LecturerSupervisorAppointments'));
const AdministrationDashboard = lazyNamed('AdministrationDashboard', () => import('./components/AdministrationDashboard'));
const OfficeAttentionPage = lazyNamed('OfficeAttentionPage', () => import('./components/OfficeAttentionPage'));
const TimelineManagement = lazyNamed('TimelineManagement', () => import('./components/TimelineManagement'));
const OfficePeriodsManagement = lazyNamed('OfficePeriodsManagement', () => import('./components/OfficePeriodsManagement'));
const AcademicSemesterManagement = lazyNamed('AcademicSemesterManagement', () => import('./components/AcademicSemesterManagement'));
const ParticipantLifecycleManagement = lazyNamed('ParticipantLifecycleManagement', () => import('./components/ParticipantLifecycleManagement'));
const WorkflowReconciliationCentre = lazyNamed('WorkflowReconciliationCentre', () => import('./components/WorkflowReconciliationCentre'));
const LecturerCapacityManagement = lazyNamed('LecturerCapacityManagement', () => import('./components/LecturerCapacityManagement'));
const FileRepository = lazyNamed('FileRepository', () => import('./components/FileRepository'));
const StudentFileSubmission = lazyNamed('StudentFileSubmission', () => import('./components/StudentFileSubmission'));
const UploadNewDocument = lazyNamed('UploadNewDocument', () => import('./components/UploadNewDocument'));
const DocumentPage = lazyNamed('DocumentPage', () => import('./components/DocumentPage'));
const AppointmentLetterPage = lazyNamed('AppointmentLetterPage', () => import('./components/AppointmentLetterPage'));
const FileSettings = lazyNamed('FileSettings', () => import('./components/FileSettings'));
const NotificationsAnnouncements = lazyNamed('NotificationsAnnouncements', () => import('./components/NotificationsAnnouncements'));
const AnnouncementManagement = lazyNamed('AnnouncementManagement', () => import('./components/AnnouncementManagement'));
const AcademicFAQEditor = lazyNamed('AcademicFAQEditor', () => import('./components/AcademicFAQEditor'));
const StudentFAQChatbot = lazyNamed('StudentFAQChatbot', () => import('./components/StudentFAQChatbot'));
const LetterTemplateManagement = lazyNamed('LetterTemplateManagement', () => import('./components/LetterTemplateManagement'));
const StudentLetterGeneration = lazyNamed('StudentLetterGeneration', () => import('./components/StudentLetterGeneration'));
const StudentMyRecords = lazyNamed('StudentMyRecords', () => import('./components/StudentMyRecords'));
const StudentRegistry = lazyNamed('StudentRegistry', () => import('./components/StudentRegistry'));
const StaffLecturersRegistry = lazyNamed('StaffLecturersRegistry', () => import('./components/StaffLecturersRegistry'));
const StudentDashboard = lazyNamed('StudentDashboard', () => import('./components/StudentDashboard'));
const LecturerDashboard = lazyNamed('LecturerDashboard', () => import('./components/LecturerDashboard'));
const LecturerAvailabilityPage = lazyNamed('LecturerAvailabilityPage', () => import('./components/LecturerAvailabilityPage'));
const CoordinatorDashboard = lazyNamed('CoordinatorDashboard', () => import('./components/CoordinatorDashboard'));
const WorkflowReports = lazyNamed('WorkflowReports', () => import('./components/WorkflowReports'));
const StudentProgressDossier = lazyNamed('StudentProgressDossier', () => import('./components/StudentProgressDossier'));
const StaffResearchWorkspace = lazyNamed('StaffResearchWorkspace', () => import('./components/StaffResearchWorkspace'));
const CoordinatorSupervisorWorkspace = lazyNamed('CoordinatorSupervisorWorkspace', () => import('./components/CoordinatorSupervisorWorkspace'));
const StudentSupervisorAppointment = lazyNamed('StudentSupervisorAppointment', () => import('./components/StudentSupervisorAppointment'));
const StudentPanelAppointment = lazyNamed('StudentPanelAppointment', () => import('./components/StudentPanelAppointment'));
const SettingsView = lazyNamed('SettingsView', () => import('./components/SettingsView'));

const ModuleLoadingFallback = () => (
  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
    Loading workspace...
  </div>
);

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  // Authentication session tracking
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);

  // True while we restore an existing session from the refresh cookie on first load.
  // Prevents the login page from flashing on refresh before /auth/me/ resolves.
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const resetParams = (() => {
    const params = new URLSearchParams(location.search);
    const uid = params.get('uid');
    const token = params.get('token');
    return uid && token ? { uid, token } : null;
  })();

  // On first load, exchange the HttpOnly refresh cookie for an in-memory access
  // token before loading the current user.
  useEffect(() => {
    if (pathname === APP_ROUTES.resetPassword || pathname === APP_ROUTES.activateAccount) {
      clearAuthToken();
      setIsRestoringSession(false);
      return;
    }

    let cancelled = false;
    authApi
      .restoreSession()
      .then((user) => {
        if (!cancelled && user) setCurrentUser(user);
      })
      .catch(() => {
        // Token is missing/expired/invalid: drop it and show login.
        clearAuthToken();
      })
      .finally(() => {
        if (!cancelled) setIsRestoringSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  // The API client clears the token and fires this when the backend rejects it
  // mid-session. Without a listener the user stays in an authenticated shell
  // while every request fails, until they happen to reload. The event can carry
  // the server's reason (e.g. the account became a technical account).
  useEffect(() => {
    const handleExpiry = (event: Event) => {
      const reason = (event as CustomEvent<{ message?: string } | null>).detail?.message;
      setSessionNotice(reason || 'Your session has expired. Please sign in again.');
      setCurrentUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiry);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiry);
  }, []);

  useEffect(() => {
    const handlePasswordChangeRequired = () =>
      setCurrentUser((user) => (user ? { ...user, mustChangePassword: true } : user));
    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, handlePasswordChangeRequired);
    return () =>
      window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, handlePasswordChangeRequired);
  }, []);

  const [marksRecordStatusTab, setMarksRecordStatusTab] = useState<MarkRecordStatusTab>('All Records');

  // Trigger states for modals in the main dashboard workspace
  const [activePortalModal, setActivePortalModal] = useState<'help' | null>(null);
  const [appToastMessage, setAppToastMessage] = useState<string | null>(null);
  const isLecturerWorkspace = currentUser?.role === 'Lecturer';
  const isCoordinatorWorkspace = currentUser?.role === 'Programme Coordinator';
  const isStudentWorkspace = currentUser?.role === 'Student';
  const activeSidebarItem = sidebarItemForPath(pathname);
  const markRecordMatch = matchPath(`${APP_ROUTES.marksRecords}/:recordId`, pathname);
  const letterRequestMatch = matchPath(`${APP_ROUTES.lettersRequests}/:requestId`, pathname);
  const letterApplicationMatch = matchPath(`${APP_ROUTES.lettersApply}/:templateId`, pathname);
  const documentMatch = matchPath(`${APP_ROUTES.filesDocuments}/:documentId`, pathname);
  const fileLetterMatch = matchPath(`${APP_ROUTES.filesLetters}/:letterId`, pathname);
  const faqEntryMatch = pathname === APP_ROUTES.faqEntryNew ? null : matchPath(`${APP_ROUTES.faqEntries}/:entryId`, pathname);
  const faqView = pathname === APP_ROUTES.faqEntryNew ? 'new'
    : faqEntryMatch ? 'entry'
    : pathname === APP_ROUTES.faqQuestions ? 'questions'
    : pathname === APP_ROUTES.faqDocuments ? 'documents'
    : pathname === APP_ROUTES.faqSettings ? 'settings'
    : pathname === APP_ROUTES.faqTest ? 'test'
    : 'entries';
  const isStaffRoute = pathname === APP_ROUTES.registryStaff || pathname.startsWith(`${APP_ROUTES.registryStaff}/`);
  const staffAccountMatch = pathname === APP_ROUTES.registryStaffNew ? null : matchPath(`${APP_ROUTES.registryStaff}/:accountId`, pathname);
  const isSupervisorWorkloadRoute = pathname === APP_ROUTES.supervisorAppointmentWorkload;
  const isSupervisorRequestsRoute = pathname === APP_ROUTES.supervisorAppointmentRequests;
  const isSupervisorNewRoute = pathname === APP_ROUTES.supervisorAppointmentNew;
  const isSupervisorHistoryRoute = pathname === APP_ROUTES.supervisorAppointmentHistory;
  const isSupervisorRequirementsRoute = pathname === APP_ROUTES.supervisorAppointmentRequirements;
  const isSupervisorApplicationsRoute = pathname === APP_ROUTES.supervisorAppointmentApplications;
  const isSupervisorSuperviseesRoute = pathname === APP_ROUTES.supervisorAppointmentSupervisees;
  const supervisorResearchMatch = matchPath(`${APP_ROUTES.supervisorResearchChanges}/:requestId`, pathname);
  const isSupervisorResearchRoute = pathname === APP_ROUTES.supervisorResearchChanges || Boolean(supervisorResearchMatch);
  const supervisorResearchView = pathname === APP_ROUTES.supervisorResearchNew ? 'new' : pathname === APP_ROUTES.supervisorResearchProfile ? 'profile' : supervisorResearchMatch ? 'detail' : 'list';
  const supervisorResearchRequestId = supervisorResearchView === 'detail' ? supervisorResearchMatch?.params.requestId : undefined;
  const supervisorSuperviseeMatch = matchPath(`${APP_ROUTES.supervisorAppointmentSupervisees}/:studentId`, pathname);
  const supervisorSuperviseeStudentId = supervisorSuperviseeMatch?.params.studentId;
  const supportingRequestMatch = matchPath(`${APP_ROUTES.supervisorAppointments}/supporting-requests/:nominationId`, pathname);
  const supportingRequestId = supportingRequestMatch?.params.nominationId;
  const isSupervisorFixedRoute = (
    isSupervisorWorkloadRoute
    || isSupervisorRequestsRoute
    || isSupervisorNewRoute
    || isSupervisorHistoryRoute
    || isSupervisorRequirementsRoute
    || isSupervisorApplicationsRoute
    || isSupervisorSuperviseesRoute
    || isSupervisorResearchRoute
    || Boolean(supervisorSuperviseeStudentId)
    || Boolean(supportingRequestId)
  );
  const supervisorApplicationMatch = isSupervisorFixedRoute
    ? null
    : matchPath(`${APP_ROUTES.supervisorAppointments}/:applicationId`, pathname);
  const panelRecommendationMatch = matchPath(`${APP_ROUTES.panelAppointments}/recommendations/:recommendationId`, pathname);
  const panelRecordMatch = matchPath(`${APP_ROUTES.panelAppointmentRecords}/:recordId`, pathname);
  const panelAssignmentMatch = matchPath(`${APP_ROUTES.panelAppointmentAssignments}/:studentId`, pathname);
  const markRecordId = markRecordMatch?.params.recordId;
  const supervisorApplicationId = supervisorApplicationMatch?.params.applicationId;
  const panelRecommendationId = panelRecommendationMatch?.params.recommendationId;
  const panelRecordId = panelRecordMatch?.params.recordId;
  const panelAssignmentStudentId = panelAssignmentMatch?.params.studentId;
  const panelRecommendationStudentId = new URLSearchParams(location.search).get('student') ?? undefined;
  const isMarksConfigRoute = pathname === APP_ROUTES.marksConfig;
  const isMarksRubricsRoute = pathname === APP_ROUTES.marksRubrics;
  const isMarksTasksRoute = pathname === APP_ROUTES.marksTasks;
  const isMarksRecordsRoute = pathname === APP_ROUTES.marksRecords;
  const isMarksAdministrationRoute = (
    isMarksConfigRoute
    || isMarksRubricsRoute
    || isMarksTasksRoute
    || isMarksRecordsRoute
    || Boolean(markRecordId)
  );
  const isDashboardTimelineRoute = pathname === APP_ROUTES.dashboardTimeline;
  const isDashboardPeriodsRoute = pathname === APP_ROUTES.dashboardPeriods;
  const isDashboardSemestersRoute = pathname === APP_ROUTES.dashboardSemesters;
  const isDashboardReportsRoute = pathname === APP_ROUTES.dashboardReports;
  const isDashboardAttentionRoute = pathname === APP_ROUTES.dashboardAttention;
  const isDashboardParticipantLifecycleRoute = pathname === APP_ROUTES.dashboardParticipantLifecycle;
  const isDashboardWorkflowReconciliationRoute = pathname === APP_ROUTES.dashboardWorkflowReconciliation;
  const isDashboardLecturerCapacityRoute = pathname === APP_ROUTES.dashboardLecturerCapacity;
  const isDashboardMyAvailabilityRoute = pathname === APP_ROUTES.dashboardMyAvailability;
  const dashboardProgressMatch = matchPath(`${APP_ROUTES.dashboardProgress}/:studentId`, pathname);
  const isDashboardProgressRoute = pathname === APP_ROUTES.dashboardProgress || Boolean(dashboardProgressMatch);
  const isStudentOtherDossierRoute = Boolean(
    isStudentWorkspace
    && dashboardProgressMatch?.params.studentId
    && dashboardProgressMatch.params.studentId !== currentUser?.studentId,
  );
  const dossierStudentId = isStudentWorkspace
    ? currentUser?.studentId
    : dashboardProgressMatch?.params.studentId;
  const isStudentUnsupportedSupervisorRoute =
    isStudentWorkspace && (isSupervisorRequestsRoute || isSupervisorWorkloadRoute || isSupervisorHistoryRoute || isSupervisorRequirementsRoute || isSupervisorSuperviseesRoute || Boolean(supervisorSuperviseeStudentId) || Boolean(supportingRequestId));
  const isLecturerUnsupportedSupervisorRoute =
    isLecturerWorkspace && (isSupervisorRequestsRoute || isSupervisorWorkloadRoute || isSupervisorNewRoute || isSupervisorRequirementsRoute || isSupervisorApplicationsRoute || pathname === APP_ROUTES.supervisorResearchNew);
  const isCoordinatorUnsupportedSupervisorRoute =
    isCoordinatorWorkspace && isSupervisorFixedRoute && !isSupervisorSuperviseesRoute && !supervisorSuperviseeStudentId && !supportingRequestId;
  const isOfficeUnsupportedSupervisorRoute =
    currentUser?.role === 'Office Staff/Admin'
    && (isSupervisorNewRoute || isSupervisorHistoryRoute || isSupervisorApplicationsRoute || isSupervisorResearchRoute);

  const attentionSource = currentUser?.role==='Office Staff/Admin' && typeof location.state?.recordReturn?.path==='string' && location.state.recordReturn.path.split('?')[0]===APP_ROUTES.dashboardAttention
    ? recordReturn(location.state.recordReturn,{path:APP_ROUTES.dashboardAttention,label:'Needs attention'},APP_ROUTES.dashboardAttention) : null;
  const returnToOfficeAttention = () => { if(attentionSource){const steps=recordBackSteps(window.history.state?.idx,attentionSource);if(steps)navigate(-steps);else navigate(attentionSource.path,{replace:true});}else navigate(APP_ROUTES.dashboard); };
  const supervisorReturn = (parent: string, label: string) => attentionSource ?? recordReturn(location.state?.recordReturn, { path: parent + location.search, label }, APP_ROUTES.supervisorAppointments);
  const studentSupervisorSource = studentSupervisorRequestReturn(pathname, location.search, location.state?.recordReturn, window.history.state?.idx);
  const officeSupervisorParent = isSupervisorSuperviseesRoute ? APP_ROUTES.supervisorAppointmentSupervisees : isSupervisorRequestsRoute ? APP_ROUTES.supervisorAppointmentRequests : APP_ROUTES.supervisorAppointments;
  const officeSupervisorLabel = isSupervisorSuperviseesRoute ? 'Supervisory teams' : isSupervisorRequestsRoute ? 'Appointment requests' : 'Needs attention';
  const openSupervisorRecord = (target: string, parent: string, label: string) => {
    const source = pathname === parent || (parent === APP_ROUTES.supervisorAppointments && isSupervisorHistoryRoute)
      ? { path: pathname + location.search, label, historyIndex: window.history.state?.idx }
      : supervisorReturn(parent, label);
    navigate(target + location.search, { state: { recordReturn: source } });
  };
  const dashboardWorkloadOrigin = currentUser?.role==='Office Staff/Admin' && location.state?.officeDashboardOrigin===true && (isSupervisorWorkloadRoute || pathname===APP_ROUTES.panelAppointmentWorkload);
  const navigateOfficeRoute = (route:string) => navigate(route, {state:officeWorkloadNavigationState(route)});
  const returnToSupervisorList = (parent: string, label: string) => {
    if (dashboardWorkloadOrigin) { navigate(APP_ROUTES.dashboard); return; }
    const source = supervisorReturn(parent, label);
    const steps = recordBackSteps(window.history.state?.idx, source);
    if (steps) navigate(-steps); else navigate(source.path, { replace: true });
  };
  const dossierReturn = recordReturn(location.state?.dossierReturn, { path: APP_ROUTES.dashboard, label: 'Dashboard' }, '');
  const openDossier = (studentId: string) => navigate(routeForStudentProgress(studentId), { state: {
    dossierReturn: { path: pathname + location.search, label: currentUser?.role==='Office Staff/Admin'&&pathname===APP_ROUTES.dashboardReports?'Reports':currentUser?.role==='Office Staff/Admin'&&pathname===APP_ROUTES.supervisorAppointments?'Needs attention':recordSourceLabel(pathname), historyIndex: window.history.state?.idx },
    recordReturn: location.state?.recordReturn,
  } });
  const returnFromDossier = () => {
    const steps = recordBackSteps(window.history.state?.idx, dossierReturn);
    if (steps) navigate(-steps); else navigate(dossierReturn.path, { replace: true, state: {recordReturn: location.state?.recordReturn} });
  };
  const panelSourcePath = location.state?.recordReturn?.path;
  const panelReturnTarget = attentionSource ?? recordReturn(location.state?.recordReturn, {path: APP_ROUTES.panelAppointments + location.search, label: 'Panel Appointments'}, typeof panelSourcePath === 'string' && panelSourcePath.startsWith(APP_ROUTES.supervisorAppointmentSupervisees + '/') ? APP_ROUTES.supervisorAppointmentSupervisees : APP_ROUTES.panelAppointments);
  const returnToPanelList = () => {
    if (dashboardWorkloadOrigin) { navigate(APP_ROUTES.dashboard); return; }
    const source = panelReturnTarget;
    const steps = recordBackSteps(window.history.state?.idx, source);
    if (steps) navigate(-steps); else navigate(source.path, {replace: true});
  };
  const openPanelRecord = (path: string) => navigate(recordPathWithSearch(path, location.search), { state: {
    recordReturn: { path: pathname + location.search, label: recordSourceLabel(pathname, location.search), historyIndex: window.history.state?.idx },
  } });
  const isUnauthorizedSupervisorRequirementsRoute = Boolean(
    isSupervisorRequirementsRoute
    && currentUser
    && currentUser.role !== 'Office Staff/Admin'
  );
  const isPanelNestedRoute = pathname !== APP_ROUTES.panelAppointments && activeSidebarItem === SIDEBAR_ITEMS.PANEL_APPOINTMENTS;
  const isCoordinatorUnsupportedPanelRoute =
    isCoordinatorWorkspace &&
    (
      pathname === APP_ROUTES.panelAppointmentSubmitted ||
      pathname === APP_ROUTES.panelAppointmentReviewed ||
      Boolean(panelAssignmentStudentId)
    );

  const openMarkRecords = (statusTab: MarkRecordStatusTab = 'All Records') => {
    setMarksRecordStatusTab(statusTab);
    navigate(APP_ROUTES.marksRecords);
  };

  const handleSuccessfulLogin = (user: DemoUser) => {
    signedOutOnPurpose.current = false;
    setSessionNotice(null);
    setCurrentUser(user);
    // A page opened while signed out (an email link, or one a session ended
    // on) opens after sign-in; the route guards still apply to it. The
    // redirect off the sign-in page below makes the same choice.
    navigate(returnPathAfterSignIn(location.state) ?? routeForSidebarItem(defaultLandingPageForUser(user)), { replace: true });
  };

  const showAppToast = (message: string) => {
    setAppToastMessage(message);
    window.setTimeout(() => setAppToastMessage(null), 3500);
  };

  // Set when the person signs out themselves, so the next sign-in on this
  // computer starts on its own landing page, not on the page left behind.
  const signedOutOnPurpose = useRef(false);

  const handleLogout = () => {
    signedOutOnPurpose.current = true;
    void authApi.logout();
    setSessionNotice(null);
    setCurrentUser(null);
    navigate(APP_ROUTES.login, { replace: true });
  };

  // Leave the reset view and clean the reset params out of the URL bar.
  const handleBackToLogin = () => {
    navigate(APP_ROUTES.login, { replace: true });
  };

  // While restoring a session from the refresh cookie, hold a neutral loading screen
  // instead of flashing the login page (skip it for the reset-password link flow).
  const isPasswordLinkPage =
    pathname === APP_ROUTES.resetPassword || pathname === APP_ROUTES.activateAccount;

  if (isRestoringSession && !isPasswordLinkPage) {
    return (
      <div
        id="session-restore-loading"
        className="min-h-screen bg-[#f1f5f9] flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-[#0c1424] animate-spin" />
          <p className="text-xs font-bold tracking-wide">Restoring your session…</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    if (isPasswordLinkPage && resetParams) {
      return (
        <div id="application-entry" className="min-h-screen bg-[#f1f5f9]">
          <ResetPasswordPage
            uid={resetParams.uid}
            token={resetParams.token}
            kind={pathname === APP_ROUTES.activateAccount ? 'activation' : 'reset'}
            onBackToLogin={handleBackToLogin}
            onRequestNewLink={() => navigate(APP_ROUTES.forgotPassword)}
          />
        </div>
      );
    }

    if (pathname === APP_ROUTES.forgotPassword) {
      return (
        <div id="application-entry" className="min-h-screen bg-[#f1f5f9]">
          <ForgotPasswordFlow onBackToLogin={() => navigate(APP_ROUTES.login)} />
        </div>
      );
    }

    if (pathname !== APP_ROUTES.login) {
      const returnState: SignInReturnState | null = signedOutOnPurpose.current ? null : { from: `${pathname}${location.search}` };
      return <Navigate to={APP_ROUTES.login} replace state={returnState} />;
    }

    return (
      <div id="application-entry" className="min-h-screen bg-[#f1f5f9]">
        <AuthLayout>
          <div className="w-full flex justify-center items-center">
            <div className="w-full flex justify-center flex-col items-center">
              <LoginCard
                onForgotPasswordClick={() => navigate(APP_ROUTES.forgotPassword)}
                onLoginSuccess={handleSuccessfulLogin}
                notice={sessionNotice}
              />
              {appToastMessage && <p role="status" className="mt-4 text-sm text-slate-700">{appToastMessage}</p>}
            </div>
          </div>
        </AuthLayout>
      </div>
    );
  }

  if (currentUser.mustChangePassword) {
    return (
      <div id="application-entry" className="min-h-screen bg-[#f1f5f9]">
        <AuthLayout>
          <div className="w-full flex justify-center items-center">
            <ForcedPasswordChange
              userName={currentUser.fullName}
              onChanged={() => setCurrentUser((user) => (user ? { ...user, mustChangePassword: false } : user))}
              onLogout={handleLogout}
            />
          </div>
        </AuthLayout>
      </div>
    );
  }

  const defaultAuthenticatedRoute = routeForSidebarItem(defaultLandingPageForUser(currentUser));
  if (
    pathname === APP_ROUTES.root
    || pathname === APP_ROUTES.login
    || pathname === APP_ROUTES.forgotPassword
    || isPasswordLinkPage
    || !isKnownAppPath(pathname)
  ) {
    // Just signed in on the sign-in page: open the page that was asked for.
    const requested = pathname === APP_ROUTES.login ? returnPathAfterSignIn(location.state) : null;
    return <Navigate to={requested ?? defaultAuthenticatedRoute} replace />;
  }

  if (!canAccessModule(currentUser.role, activeSidebarItem)) {
    return <Navigate to={defaultAuthenticatedRoute} replace />;
  }
  if (
    isMarksAdministrationRoute
    && !canAccessMarksAdministration(currentUser.role)
  ) {
    return <Navigate to={defaultAuthenticatedRoute} replace />;
  }

  return (
    <div id="application-entry" className="min-h-screen bg-[#f1f5f9]">
      {/* ==================== FRONTEND: PORTAL DASHBOARD WORKSPACE ==================== */}
      <NotificationsProvider>
        <PortalToast message={appToastMessage} />
        <AppLayout
          activeItem={activeSidebarItem}
          onNavigate={(target) => {
            setMarksRecordStatusTab('All Records');
            navigate(routeForSidebarItem(target));
          }}
          onLogout={handleLogout}
          onNotificationsTrigger={() => {
            navigate(APP_ROUTES.notifications);
          }}
          userName={currentUser.fullName}
          userRole={currentUser.role}
          activeModal={activePortalModal}
          setActiveModal={setActivePortalModal}
        >
          <React.Suspense fallback={<ModuleLoadingFallback />}>
            <OfficeDashboardLayout enabled={isOfficeDashboardPresentation(pathname, currentUser.role)}>
            <ModuleFeedbackScope pathname={pathname}>
            <OfficeMonitoringProvider enabled={currentUser.role === 'Office Staff/Admin'}>
            {activeSidebarItem === SIDEBAR_ITEMS.MARKS_ENTRY ? (
              isLecturerWorkspace ? (
                <LecturerMarksEntry key={location.search} contextSearch={location.search}
                  onBackToDashboard={() => navigate(APP_ROUTES.dashboard)}
                  onNavigateToDossier={openDossier}
                  onNavigateToRequirements={() => openSupervisorRecord(routeForSupervisorRequirements(),isSupervisorSuperviseesRoute?APP_ROUTES.supervisorAppointmentSupervisees:APP_ROUTES.supervisorAppointments,'Records administration')}
                />
              ) : isMarksConfigRoute ? (
                <MarkEntryPeriodConfig
                  contextSearch={location.search}
                  onBack={() => navigate(APP_ROUTES.marks)}
                  onManageSemesters={() => navigate(APP_ROUTES.dashboardSemesters)}
                  onManageTimeline={(period) => navigate(officeMarksDeadlineRoute(period))}
                />
              ) : isMarksRubricsRoute ? (
                <RubricsManagementView onBack={() => navigate(APP_ROUTES.marks)} />
              ) : isMarksTasksRoute ? (
                <EvaluationTaskAssignment onBack={() => navigate(APP_ROUTES.marks)} onManageTimeline={(period) => navigate(officeMarksDeadlineRoute(period))} />
              ) : isMarksRecordsRoute ? (
                <MarkEntryRecords 
                  onBack={()=>attentionSource?returnToOfficeAttention():navigate(APP_ROUTES.marks)}
                  backLabel={attentionSource?'Back to Needs attention':undefined}
                  initialStatusTab={marksRecordStatusTab}
                  onViewRecordDetail={(recordId) => navigate(routeForMarkRecord(recordId), { state: { recordReturn: { path: pathname + location.search, label: 'Mark Entry Records', historyIndex: window.history.state?.idx } } })}
                  onNavigateToDossier={openDossier}
                />
              ) : markRecordId ? (
                <MarkEntryRecordDetail
                  backLabel={attentionSource?'Back to Needs attention':undefined}
                  onBack={() => { const source = attentionSource ?? recordReturn(location.state?.recordReturn, { path: APP_ROUTES.marksRecords, label: 'Mark Entry Records' }, APP_ROUTES.marks); const steps = recordBackSteps(window.history.state?.idx, source); if (steps) navigate(-steps); else navigate(source.path, { replace: true }); }}
                  recordId={markRecordId}
                />
              ) : (
                <MarksOverview onViewRecords={openMarkRecords} />
              )
            ) : activeSidebarItem === SIDEBAR_ITEMS.PANEL_APPOINTMENTS ? (
              isStudentWorkspace && isPanelNestedRoute ? (
                <Navigate to={APP_ROUTES.panelAppointments} replace />
              ) : isStudentWorkspace ? (
                <StudentPanelAppointment onShowFAQChatbot={() => navigate(APP_ROUTES.faq)} />
              ) : isCoordinatorUnsupportedPanelRoute ? (
                <Navigate to={APP_ROUTES.panelAppointments} replace />
              ) : isLecturerWorkspace || isCoordinatorWorkspace ? (
                <LecturerPanelAppointments
                  detailBackLabel={`Back to ${panelReturnTarget.label}`}
                  currentUser={currentUser}
                  initialRecommendationId={panelRecommendationId}
                  initialSuperviseeId={panelRecommendationStudentId}
                  routeView={
                    pathname === APP_ROUTES.panelAppointmentSubmitted
                      ? 'submitted'
                      : pathname === APP_ROUTES.panelAppointmentReviewed
                      ? 'reviewed'
                      : panelAssignmentStudentId
                      ? 'assignmentDetail'
                      : 'list'
                  }
                  routeAssignmentStudentId={panelAssignmentStudentId}
                  onNavigateToList={returnToPanelList}
                  onNavigateToSubmitted={() => navigate(routeForPanelSubmittedRecommendations())}
                  onNavigateToReviewed={() => navigate(routeForPanelReviewedRequests())}
                  onNavigateToAssignment={(studentId,appointmentId) => openPanelRecord(`${routeForPanelAssignment(studentId)}${appointmentId?`?appointment=${appointmentId}`:""}`)}
                  onNavigateToMarks={target=>navigate(target?appointmentMarkingRoute(target):APP_ROUTES.marks)}
                  onNavigateToDossier={openDossier}
                />
              ) : (
                <PanelAppointmentManagement
                  workloadBackLabel={dashboardWorkloadOrigin ? 'Back to Dashboard' : undefined}
                  detailBackLabel={`Back to ${panelReturnTarget.label}`}
                  routeView={
                    pathname === APP_ROUTES.panelAppointmentWorkload
                      ? 'workload'
                      : panelRecordId
                      ? 'detail'
                      : 'list'
                  }
                  routeRecordId={panelRecordId}
                  onNavigateToList={returnToPanelList}
                  onNavigateToWorkload={(lecturerId)=>navigate(`${routeForPanelWorkload()}${lecturerId?`?lecturer=${encodeURIComponent(lecturerId)}`:""}`)}
                  onNavigateToRecord={(recordId) => openPanelRecord(routeForPanelRecord(recordId))}
                  onNavigateToDossier={openDossier}
                  onOpenCapacity={() => navigate(APP_ROUTES.dashboardLecturerCapacity)}
                />
              )
            ) : activeSidebarItem === SIDEBAR_ITEMS.SUPERVISOR_APPOINTMENTS ? (
              isUnauthorizedSupervisorRequirementsRoute ? (
                <Navigate to={APP_ROUTES.supervisorAppointments} replace />
              ) : isSupervisorRequirementsRoute ? (
                <SupervisorDocumentRequirements
                  backLabel={`Back to ${supervisorReturn(APP_ROUTES.supervisorAppointments,'Appointment requests').label}`}
                  onBack={() => returnToSupervisorList(APP_ROUTES.supervisorAppointments,'Appointment requests')}
                />
              ) : isSupervisorResearchRoute && (isCoordinatorWorkspace || currentUser.role === 'Office Staff/Admin') ? (
                <StaffResearchWorkspace role={currentUser.role} routeView={supervisorResearchView} routeRequestId={supervisorResearchRequestId}
                  backLabel={`Back to ${supervisorReturn(APP_ROUTES.supervisorResearchChanges,supervisorResearchLabel(currentUser.role)).label}`}
                  onNavigateToList={() => { if (supervisorResearchView === 'list') returnToSupervisorList(APP_ROUTES.supervisorAppointments, 'Supervisor Appointments'); else returnToSupervisorList(APP_ROUTES.supervisorResearchChanges, supervisorResearchLabel(currentUser.role)); }}
                  onNavigateToRequest={(id) => openSupervisorRecord(routeForSupervisorResearchRequest(id), APP_ROUTES.supervisorResearchChanges, supervisorResearchLabel(currentUser.role))}
                  onNavigateToProfile={() => openSupervisorRecord(APP_ROUTES.supervisorResearchProfile, APP_ROUTES.supervisorResearchChanges, supervisorResearchLabel(currentUser.role))}
                  onNavigateToNew={() => openSupervisorRecord(APP_ROUTES.supervisorResearchNew, APP_ROUTES.supervisorResearchChanges, supervisorResearchLabel(currentUser.role))}
                />
              ) : isStudentUnsupportedSupervisorRoute ? (
                <Navigate to={APP_ROUTES.supervisorAppointments} replace />
              ) : isStudentWorkspace ? (
                <StudentSupervisorAppointment
                  lifecycleStatus={currentUser.participantLifecycleStatus}
                  onShowFAQChatbot={() => navigate(APP_ROUTES.faq)}
                  initialApplicationId={supervisorApplicationId}
                  backLabel={`Back to ${studentSupervisorSource.label}`}
                  routeView={isSupervisorNewRoute ? 'newApplication' : isSupervisorResearchRoute ? 'research' : isSupervisorApplicationsRoute || supervisorApplicationId ? 'applications' : 'overview'}
                  onNavigateToList={() => returnToSupervisorList(APP_ROUTES.supervisorAppointmentApplications, 'Applications')}
                  onNavigateToNewApplication={() => openSupervisorRecord(routeForSupervisorNewApplication(), APP_ROUTES.supervisorAppointmentApplications, 'Applications')}
                  onNavigateToApplication={(applicationId) => navigate(routeForSupervisorApplication(applicationId) + location.search, { state: { recordReturn: studentSupervisorSource } })}
                  researchView={supervisorResearchView}
                  researchRequestId={supervisorResearchRequestId}
                  onNavigateToResearchList={() => returnToSupervisorList(APP_ROUTES.supervisorResearchChanges, 'Research changes')}
                  onNavigateToResearchProfile={() => openSupervisorRecord(APP_ROUTES.supervisorResearchProfile, APP_ROUTES.supervisorResearchChanges, 'Research changes')}
                  onNavigateToResearchNew={() => openSupervisorRecord(APP_ROUTES.supervisorResearchNew, APP_ROUTES.supervisorResearchChanges, 'Research changes')}
                  onNavigateToResearchRequest={(id) => openSupervisorRecord(routeForSupervisorResearchRequest(id), APP_ROUTES.supervisorResearchChanges, 'Research changes')}
                />
              ) : isCoordinatorUnsupportedSupervisorRoute ? (
                <Navigate to={APP_ROUTES.supervisorAppointments} replace />
              ) : isCoordinatorWorkspace ? (
                <CoordinatorSupervisorWorkspace
                  onNavigateToList={() => returnToSupervisorList(supervisorSuperviseeStudentId ? APP_ROUTES.supervisorAppointmentSupervisees : APP_ROUTES.supervisorAppointments, supervisorSuperviseeStudentId ? 'Supervisory teams' : 'Appointment requests')}
                  onNavigateToApplication={(id) => openSupervisorRecord(routeForSupervisorApplication(id), supervisorSuperviseeStudentId ? pathname : isSupervisorSuperviseesRoute ? APP_ROUTES.supervisorAppointmentSupervisees : APP_ROUTES.supervisorAppointments, supervisorSuperviseeStudentId ? 'Supervision details' : isSupervisorSuperviseesRoute ? 'Supervisory teams' : 'Appointment requests')}
                  backLabel={`Back to ${supervisorReturn(APP_ROUTES.supervisorAppointments, 'Appointment requests').label}`}
                  initialSupportingId={supportingRequestId}
                  onNavigateToSupportingRequest={(id) => openSupervisorRecord(routeForSupportingSupervisorRequest(id), APP_ROUTES.supervisorAppointments, 'Appointment requests')}
                  workspaceView={isSupervisorSuperviseesRoute || supervisorSuperviseeStudentId ? 'teams' : 'requests'}
                  routeTeamStudentId={supervisorSuperviseeStudentId}
                  onNavigateToTeam={(id) => openSupervisorRecord(routeForSupervisorSupervisee(id), APP_ROUTES.supervisorAppointmentSupervisees, 'Supervisory teams')}
                  initialApplicationId={supervisorApplicationId}
                  onNavigateToDossier={openDossier}
                  onNavigateToPanelRequest={(id) => openPanelRecord(routeForPanelRecommendation(id))}
                />
              ) : isLecturerUnsupportedSupervisorRoute ? (
                <Navigate to={APP_ROUTES.supervisorAppointments} replace />
              ) : isLecturerWorkspace ? (
                <LecturerSupervisorAppointments onNavigateToMarks={target=>navigate(target?appointmentMarkingRoute(target):APP_ROUTES.marks)}
                  lecturerId={currentUser.id}
                  requestBackLabel={`Back to ${supervisorReturn(APP_ROUTES.supervisorAppointments, 'Appointment requests').label}`}
                  initialApplicationId={supervisorApplicationId}
                  initialSupportingId={supportingRequestId}
                  onNavigateToRequest={(id, kind) => openSupervisorRecord(kind === 'supporting' ? routeForSupportingSupervisorRequest(id) : routeForSupervisorApplication(id), supervisorSuperviseeStudentId ? pathname : APP_ROUTES.supervisorAppointments, supervisorSuperviseeStudentId ? 'Supervision details' : 'Appointment requests')}
                  routeView={
                    isSupervisorHistoryRoute
                      ? 'history'
                      : isSupervisorResearchRoute
                      ? 'research'
                      : isSupervisorSuperviseesRoute
                      ? 'supervisees'
                      : supervisorSuperviseeStudentId
                      ? 'superviseeDetail'
                      : 'list'
                  }
                  routeSuperviseeStudentId={supervisorSuperviseeStudentId}
                  onNavigateToList={() => returnToSupervisorList(APP_ROUTES.supervisorAppointments, 'Appointment requests')}
                  onNavigateToHistory={() => navigate(routeForSupervisorHistory())}
                  onNavigateToSupervisee={(studentId) => openSupervisorRecord(routeForSupervisorSupervisee(studentId), APP_ROUTES.supervisorAppointmentSupervisees, 'My supervisees')}
                  onNavigateToSupervisees={() => returnToSupervisorList(APP_ROUTES.supervisorAppointmentSupervisees, 'My supervisees')}
                  researchView={supervisorResearchView}
                  researchRequestId={supervisorResearchRequestId}
                  onNavigateToResearchList={() => returnToSupervisorList(APP_ROUTES.supervisorResearchChanges, 'Research changes')}
                  onNavigateToResearchProfile={() => openSupervisorRecord(APP_ROUTES.supervisorResearchProfile, APP_ROUTES.supervisorResearchChanges, 'Research changes')}
                  onNavigateToResearchRequest={(id) => openSupervisorRecord(routeForSupervisorResearchRequest(id), APP_ROUTES.supervisorResearchChanges, 'Research changes')}
                  onNavigateToDossier={openDossier}
                  onNavigateToPanelRecommendation={(studentId) => navigate(routeForPanelRecommendationStart(studentId), {state:{recordReturn:{path:pathname+location.search,label:'Supervision details',historyIndex:window.history.state?.idx}}})}
                  onNavigateToPanelRequest={(id) => openPanelRecord(routeForPanelRecommendation(id))}
                />
              ) : isOfficeUnsupportedSupervisorRoute ? (
                <Navigate to={APP_ROUTES.supervisorAppointments} replace />
              ) : (
                <OfficeSupervisorWorkspace
                  requestsView={isSupervisorRequestsRoute}
                  routeView={
                    isSupervisorWorkloadRoute
                      ? 'workload'
                      : supervisorSuperviseeStudentId ? 'teamDetail'
                      : isSupervisorSuperviseesRoute ? 'teams'
                      : supervisorApplicationId
                      ? 'detail'
                      : 'list'
                  }
                  onNavigateToPastRecord={(id)=>openSupervisorRecord(routeForSupervisorApplication(id),APP_ROUTES.supervisorAppointmentSupervisees,'Past appointments')}
                  supportingRequestId={supportingRequestId}
                  onNavigateToSupporting={(id)=>openSupervisorRecord(routeForSupportingSupervisorRequest(id),officeSupervisorParent,officeSupervisorLabel)}
                  backLabel={dashboardWorkloadOrigin ? 'Back to Dashboard' : `Back to ${supervisorReturn(APP_ROUTES.supervisorAppointments,'Needs attention').label}`}
                  routeRecordId={supervisorApplicationId}
                  routeTeamStudentId={supervisorSuperviseeStudentId}
                  onNavigateToPanelRequest={(id,key) => openPanelRecord(routeForPanelRecord(key ?? `recommendation-${id}`))}
                  onNavigateToTeam={(id) => openSupervisorRecord(routeForSupervisorSupervisee(id), APP_ROUTES.supervisorAppointmentSupervisees, 'Supervisory teams')}
                  onNavigateToTeams={() => returnToSupervisorList(APP_ROUTES.supervisorAppointmentSupervisees, 'Supervisory teams')}
                  onNavigateToRequirements={() => openSupervisorRecord(routeForSupervisorRequirements(),officeSupervisorParent,officeSupervisorLabel)}
                  onNavigateToList={() => returnToSupervisorList(officeSupervisorParent,officeSupervisorLabel)}
                  onNavigateToWorkload={() => openSupervisorRecord(routeForSupervisorWorkload(),officeSupervisorParent,officeSupervisorLabel)}
                  onNavigateToRecord={(recordId) => openSupervisorRecord(routeForSupervisorApplication(recordId),supervisorSuperviseeStudentId?pathname:officeSupervisorParent,supervisorSuperviseeStudentId?'Supervision details':officeSupervisorLabel)}
                  onNavigateToDossier={openDossier}
                  onOpenCapacity={() => navigate(APP_ROUTES.dashboardLecturerCapacity)}
                />
              )
            ) : activeSidebarItem === SIDEBAR_ITEMS.REGISTRY && isStaffRoute && currentUser.role !== 'Office Staff/Admin' ? (
              <Navigate to={APP_ROUTES.registry} replace />
            ) : activeSidebarItem === SIDEBAR_ITEMS.REGISTRY && isStaffRoute ? (
              <StaffLecturersRegistry
                view={pathname === APP_ROUTES.registryStaffNew ? 'new' : staffAccountMatch ? 'account' : 'list'}
                accountId={staffAccountMatch?.params.accountId}
              />
            ) : activeSidebarItem === SIDEBAR_ITEMS.REGISTRY ? (
              <StudentRegistry
                readOnly={currentUser.role !== 'Office Staff/Admin'}
                onOpenParticipantLifecycle={() => navigate(APP_ROUTES.dashboardParticipantLifecycle)}
              />
            ) : activeSidebarItem === SIDEBAR_ITEMS.DASHBOARD ? (
              pathname === APP_ROUTES.myProfile && !isStudentWorkspace ? (
                <Navigate to={APP_ROUTES.dashboard} replace />
              ) : pathname === APP_ROUTES.myProfile ? (
                <StudentMyRecords
                  currentUser={currentUser}
                  onNavigate={(route, state) => navigate(route, state ? { state } : undefined)}
                />
              ) : isDashboardMyAvailabilityRoute && !isLecturerWorkspace ? (
                <Navigate to={APP_ROUTES.dashboard} replace />
              ) : isDashboardMyAvailabilityRoute ? (
                <LecturerAvailabilityPage onBack={()=>navigate(APP_ROUTES.dashboard)}/>
              ) : isDashboardAttentionRoute && currentUser.role !== 'Office Staff/Admin' ? (
                <Navigate to={APP_ROUTES.dashboard} replace />
              ) : isDashboardAttentionRoute ? (
                <OfficeAttentionPage onBack={()=>navigate(APP_ROUTES.dashboard)} onOpen={route=>navigate(route,{state:{recordReturn:{path:pathname+location.search,label:'Needs attention',historyIndex:window.history.state?.idx}}})}/>
              ) : isDashboardPeriodsRoute && currentUser.role !== 'Office Staff/Admin' ? (
                <Navigate to={APP_ROUTES.dashboard} replace />
              ) : isDashboardPeriodsRoute ? (
                <OfficePeriodsManagement onBack={() => navigate(APP_ROUTES.dashboard)} onManageSemesters={() => navigate(APP_ROUTES.dashboardSemesters)} />
              ) : isDashboardTimelineRoute && /^#(?:operational-period|marks-period)-\d+$/.test(location.hash) && currentUser.role === 'Office Staff/Admin' ? (
                <Navigate to={`${APP_ROUTES.dashboardPeriods}${location.search}${location.hash}`} replace />
              ) : isDashboardLecturerCapacityRoute && currentUser.role !== 'Office Staff/Admin' ? (
                <Navigate to={APP_ROUTES.dashboard} replace />
              ) : isDashboardLecturerCapacityRoute ? (
                <LecturerCapacityManagement onBack={returnToOfficeAttention} backLabel={attentionSource?'Back to Needs attention':undefined} />
              ) : isDashboardWorkflowReconciliationRoute && currentUser.role !== 'Office Staff/Admin' ? (
                <Navigate to={APP_ROUTES.dashboard} replace />
              ) : isDashboardWorkflowReconciliationRoute ? (
                <WorkflowReconciliationCentre
                  onBack={returnToOfficeAttention}
                  backLabel={attentionSource?'Back to Needs attention':undefined}
                  onNavigateToRoute={navigate}
                  onOpenCapacity={() => navigate(APP_ROUTES.dashboardLecturerCapacity)}
                />
              ) : isDashboardParticipantLifecycleRoute && currentUser.role !== 'Office Staff/Admin' ? (
                <Navigate to={APP_ROUTES.dashboard} replace />
              ) : isDashboardParticipantLifecycleRoute ? (
                <ParticipantLifecycleManagement
                  onBack={() => navigate(APP_ROUTES.dashboard)}
                  onOpenReconciliation={() => navigate(APP_ROUTES.dashboardWorkflowReconciliation)}
                />
              ) : isStudentOtherDossierRoute ? (
                <Navigate to={APP_ROUTES.dashboardProgress} replace />
              ) : isDashboardProgressRoute && !dossierStudentId ? (
                <Navigate to={APP_ROUTES.dashboard} replace />
              ) : isDashboardProgressRoute ? (
                <StudentProgressDossier
                  studentId={dossierStudentId}
                  currentUserRole={currentUser.role}
                  onBack={returnFromDossier}
                  backLabel={`Back to ${dossierReturn.label}`}
                  onNavigateToRoute={navigate}
                />
              ) : isDashboardReportsRoute && isStudentWorkspace ? (
                <Navigate to={APP_ROUTES.dashboard} replace />
              ) : isDashboardReportsRoute ? (
                <WorkflowReports
                  currentUserRole={currentUser.role}
                  onOpenDossier={openDossier}
                  onBack={() => navigate(APP_ROUTES.dashboard)}
                  onNavigateToRoute={navigate}
                  onOpenReconciliation={() => navigate(APP_ROUTES.dashboardWorkflowReconciliation)}
                />
              ) : (isDashboardTimelineRoute || isDashboardSemestersRoute) && currentUser.role !== 'Office Staff/Admin' ? (
                <Navigate to={APP_ROUTES.dashboard} replace />
              ) : isStudentWorkspace ? (
                <StudentDashboard
                  studentName={currentUser.fullName}
                  studentId={currentUser.studentId}
                  programme={currentUser.department}
                  lifecycleStatus={currentUser.participantLifecycleStatus}
                  onNavigateToTab={(tab) => navigate(routeForSidebarItem(tab))}
                  onNavigateToRoute={navigate}
                />
              ) : isCoordinatorWorkspace ? (
                <CoordinatorDashboard
                  onNavigateToTab={(tab) => navigate(routeForSidebarItem(tab))}
                  onNavigateToRoute={navigate}
                />
              ) : isLecturerWorkspace ? (
                <LecturerDashboard
                  lifecycleStatus={currentUser.participantLifecycleStatus}
                  onNavigateToTab={(tab) => navigate(routeForSidebarItem(tab))}
                  onNavigateToRoute={navigate}
                />
              ) : isDashboardSemestersRoute ? (
                <AcademicSemesterManagement
                  onBack={() => navigate(APP_ROUTES.dashboard)}
                  onManageParticipants={() => navigate(APP_ROUTES.dashboardParticipantLifecycle)}
                  onOpenReconciliation={() => navigate(APP_ROUTES.dashboardWorkflowReconciliation)}
                  onOpenCapacity={(semesterId) => navigate(`${APP_ROUTES.dashboardLecturerCapacity}${semesterId ? `?semester=${semesterId}` : ''}`)}
                />
              ) : isDashboardTimelineRoute ? (
                <TimelineManagement
                  onBack={returnToOfficeAttention}
                  backLabel={attentionSource?'Back to Needs attention':undefined}
                  onManageSemesters={() => navigate(APP_ROUTES.dashboardSemesters)}
                />
              ) : (
                <AdministrationDashboard 
                  onNavigateToTab={(tab) => {
                    navigate(routeForSidebarItem(tab));
                  }}
                  onNavigateToRoute={navigateOfficeRoute}
                  onNavigateToMarksRecords={openMarkRecords}
                  onNavigateToTimeline={() => navigate(routeForDashboardTimeline())}
                />
              )
            ) : activeSidebarItem === SIDEBAR_ITEMS.FILE_MANAGEMENT ? (
              pathname === APP_ROUTES.filesUpload ? (
                <UploadNewDocument
                  isStudent={isStudentWorkspace}
                  role={currentUser.role}
                  initialStudent={new URLSearchParams(location.search).get('student') ?? ''}
                  initialType={new URLSearchParams(location.search).get('type') ?? ''}
                  initialFile={location.state?.droppedFile instanceof File ? location.state.droppedFile : null}
                  onBack={() => navigate(APP_ROUTES.files)}
                  onUploadSuccess={(document) => navigate(routeForDocument(document.id), { replace: true, state: { uploadedReference: document.reference } })}
                  onOpenExisting={(documentId) => navigate(routeForDocument(documentId))}
                />
              ) : pathname === APP_ROUTES.filesSettings && currentUser.role === 'Office Staff/Admin' ? (
                <FileSettings onBack={() => navigate(APP_ROUTES.files)} />
              ) : documentMatch ? (
                <DocumentPage
                  key={documentMatch.params.documentId}
                  documentId={documentMatch.params.documentId ?? ''}
                  isStudent={isStudentWorkspace}
                  onBack={() => navigate(APP_ROUTES.files)}
                />
              ) : fileLetterMatch ? (
                <AppointmentLetterPage
                  key={fileLetterMatch.params.letterId}
                  letterId={fileLetterMatch.params.letterId ?? ''}
                  isStudent={isStudentWorkspace}
                  onBack={(matric) => navigate(matric && !isStudentWorkspace ? `${APP_ROUTES.files}?student=${encodeURIComponent(matric)}` : APP_ROUTES.files)}
                />
              ) : isStudentWorkspace ? (
                <StudentFileSubmission />
              ) : (
                <FileRepository />
              )
            ) : activeSidebarItem === SIDEBAR_ITEMS.FAQ_CHATBOT ? (
              isStudentWorkspace || currentUser.role === 'Programme Coordinator' ? (
                <StudentFAQChatbot />
              ) : (
                <AcademicFAQEditor view={faqView} entryId={faqEntryMatch?.params.entryId} />
              )
            ) : activeSidebarItem === SIDEBAR_ITEMS.LETTER_GENERATION ? (
              isStudentWorkspace ? (
                <StudentLetterGeneration
                  studentName={currentUser.fullName}
                  studentId={currentUser.studentId}
                  programme={currentUser.department}
                  view={pathname === APP_ROUTES.lettersMine ? 'history' : 'new'}
                  onViewChange={(view) => navigate(view === 'history' ? APP_ROUTES.lettersMine : APP_ROUTES.letters)}
                  requestTemplateId={letterApplicationMatch?.params.templateId ?? null}
                  onOpenRequestForm={(templateId) => navigate(routeForLetterApplication(templateId))}
                  onCloseRequestForm={() => navigate(APP_ROUTES.letters)}
                />
              ) : (
                <LetterTemplateManagement
                  canViewIssuedLetters={currentUser.role === 'Office Staff/Admin'}
                  view={
                    pathname === APP_ROUTES.lettersIssued
                      ? 'issued'
                      : pathname === APP_ROUTES.lettersLists
                        ? 'lists'
                        : pathname === APP_ROUTES.lettersTypes || currentUser.role !== 'Office Staff/Admin'
                          ? 'templates'
                          : 'requests'
                  }
                  onViewChange={(view) => navigate(
                    view === 'issued'
                      ? APP_ROUTES.lettersIssued
                      : view === 'lists'
                        ? APP_ROUTES.lettersLists
                        : view === 'templates'
                          ? APP_ROUTES.lettersTypes
                          : APP_ROUTES.lettersRequests,
                  )}
                  requestId={letterRequestMatch?.params.requestId ?? null}
                  onOpenRequest={(id) => navigate(routeForLetterRequest(id))}
                  onCloseRequest={() => navigate(APP_ROUTES.lettersRequests)}
                />
              )
            ) : activeSidebarItem === SIDEBAR_ITEMS.ANNOUNCEMENTS ? (
              <AnnouncementManagement />
            ) : activeSidebarItem === SIDEBAR_ITEMS.NOTIFICATIONS ? (
              <NotificationsAnnouncements
                onBack={() => navigate(APP_ROUTES.dashboard)}
                onOpenWorkflowRecord={(notification: NotificationItem) => {
                  navigate(routeForNotificationTarget(notification));
                }}
              />
            ) : activeSidebarItem === SIDEBAR_ITEMS.SETTINGS ? (
              <SettingsView currentUser={currentUser} onLogout={handleLogout} onUserUpdated={(updated) => setCurrentUser((existing) => existing?.id === updated.id ? updated : existing)} onPasswordChanged={() => {
                signedOutOnPurpose.current = true;
                setCurrentUser(null);
                navigate(APP_ROUTES.login, { replace: true });
                showAppToast('Password updated. Please sign in again.');
              }} />
            ) : (
              /* Placeholder message for other sidebar routes */
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center max-w-xl mx-auto my-12 shadow-sm">
                <div className="w-16 h-16 bg-[#eff6ff] text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  {activeSidebarItem} Overview Desk
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  You have routed to the <strong>{activeSidebarItem}</strong> workflow module inside the FSKTM administrative center. To fulfill layout reference checks, please toggle back to the <strong>Marks Entry</strong> tab.
                </p>
                <button
                  onClick={() => navigate(APP_ROUTES.marks)}
                  className="mt-6 px-5 py-2.5 bg-brand-navy text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-850 transition"
                >
                  Return to Marks Entry
                </button>
              </div>
            )}
            </OfficeMonitoringProvider></ModuleFeedbackScope></OfficeDashboardLayout>
          </React.Suspense>
        </AppLayout>
      </NotificationsProvider>
    </div>
  );
}
