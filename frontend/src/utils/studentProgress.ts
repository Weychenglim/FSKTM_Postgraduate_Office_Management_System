import type {
  StudentProgressDossier,
  StudentProgressSection,
  StudentProgressTab,
  StudentProgressTarget,
  StudentProgressVisibility,
} from '../types';
import {
  APP_ROUTES,
  routeForPanelRecommendation,
  routeForSupervisorApplication,
  routeForSupervisorResearchRequest,
} from '../constants/routes';

export const formatProgressStatus = (
  status: string | null | undefined,
): string => {
  if (!status) return '-';
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const visibleProgressTabs = (
  sections: StudentProgressDossier['visibleSections'],
  visibility: StudentProgressVisibility = 'INTERNAL',
): StudentProgressTab[] => visibility === 'INTERNAL'
  ? sections
  : sections.filter((section) => section !== 'MARKS');

export const hasProgressSection = (
  sections: StudentProgressSection[],
  section: StudentProgressSection,
): boolean => sections.includes(section);

export const resolveStudentProgressRecordRoute = (
  target: StudentProgressTarget,
): string => {
  if (
    target.targetModule === 'SUPERVISOR_APPOINTMENTS'
    && target.recordType === 'SUPERVISOR_APPLICATION'
    && target.recordId
  ) {
    return routeForSupervisorApplication(target.recordId);
  }
  if (
    target.targetModule === 'PANEL_APPOINTMENTS'
    && target.recordType === 'PANEL_RECOMMENDATION'
    && target.recordId
  ) {
    return routeForPanelRecommendation(target.recordId);
  }
  if (target.targetModule === 'SUPERVISOR_APPOINTMENTS') {
    if (target.recordType === 'RESEARCH_AMENDMENT' && target.recordId) return routeForSupervisorResearchRequest(target.recordId);
    return APP_ROUTES.supervisorAppointments;
  }
  if (target.targetModule === 'PANEL_APPOINTMENTS') {
    return APP_ROUTES.panelAppointments;
  }
  if (target.targetModule === 'MARKS') {
    return APP_ROUTES.marks;
  }
  return APP_ROUTES.dashboard;
};
