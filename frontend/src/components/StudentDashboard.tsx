import {DashboardHeader} from './DashboardHeader';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Files } from 'lucide-react';
import { DashboardTimeline } from './DashboardTimeline';
import { MonitoringTasksCard } from './MonitoringTasksCard';
import { PortalButton, PortalToast } from './PortalPrimitives';
import type { DashboardTask } from '../types';
import { routeForStudentProgress, sidebarItemForPath } from '../constants/routes';
import { resolveDashboardTaskRoute } from '../utils/workflowAgeing';
import { ActiveSemesterContext } from './ActiveSemesterContext';
import { StudentAppointmentStatusCards } from './StudentAppointmentStatusCards';
import { ProjectStageQuestion } from './ProjectStageQuestion';
import { getMyProjectStage, type StudentProject, type StudentProjectStatus } from '../services/registrySemestersApi';
import { stageCard } from '../utils/projectStages';

const projectStatusLabel: Record<StudentProjectStatus['state'], string> = {
  ON_PROJECT: 'In progress',
  NOT_STARTED: 'Not started',
  COMPLETED: 'Completed',
  NOT_STUDYING: 'Not studying this semester',
  NOT_CONFIRMED: 'Stage unconfirmed',
};

interface StudentDashboardProps {
  studentName: string;
  studentId?: string;
  programme?: string;
  lifecycleStatus?: string | null;
  onNavigateToTab: (tabName: string) => void;
  onNavigateToRoute?: (route: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  studentId,
  lifecycleStatus,
  onNavigateToTab,
  onNavigateToRoute,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [project, setProject] = useState<StudentProject | null>(null);
  const [projectLoadFailed, setProjectLoadFailed] = useState(false);
  const [projectAttempt, setProjectAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getMyProjectStage()
      .then(data => { if (active) setProject(data); })
      .catch(() => { if (active) setProjectLoadFailed(true); });
    return () => { active = false; };
  }, [projectAttempt]);

  const projectStatus = project?.projectStatus;
  const projectStage = projectStatus?.stage;
  const projectStageTone = projectStage ? 'border-blue-200 bg-blue-50 text-blue-800'
    : projectStatus?.state === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-slate-200 bg-white text-slate-700';

  const retryProject = () => {
    setProjectLoadFailed(false);
    setProjectAttempt(attempt => attempt + 1);
  };
  const question = project?.question ?? null;
  const stageAsking = question ? stageCard(question).asking : false;
  const stageCardNode = <ProjectStageQuestion question={question} onUpdate={setProject} />;

  const triggerToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  const navigateToAction = (task: DashboardTask) => {
    const route = resolveDashboardTaskRoute(task);
    if (onNavigateToRoute) {
      onNavigateToRoute(route);
      return;
    }
    onNavigateToTab(sidebarItemForPath(route));
  };

  return (
    <div id="student-dashboard-container" className="space-y-8 animate-fade-in text-left font-sans text-xs pb-16">
      <PortalToast message={toastMessage} />

      <DashboardHeader context={
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <ActiveSemesterContext />
          {projectStatus && (
            <div role="group" aria-label="Project stage" className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[15px] font-semibold leading-5 text-slate-800">Project stage</span>
              <span className={`rounded-full border px-3 py-1 text-[15px] font-bold leading-5 ${projectStageTone}`}>
                {projectStage ? (projectStage === 'P1' ? 'RP1' : 'RP2') : projectStatusLabel[projectStatus.state]}
              </span>
            </div>
          )}
        </div>
      }
          actions={studentId && onNavigateToRoute ? (
            <PortalButton
              variant="primary"
              icon={Files}
              onClick={() => onNavigateToRoute(routeForStudentProgress())}
            >
              View My Academic Record
            </PortalButton>
          ) : undefined}
      />

      {lifecycleStatus && lifecycleStatus !== 'ACTIVE' && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <strong className="card-value block text-amber-900">Academic status: {lifecycleStatus.charAt(0) + lifecycleStatus.slice(1).toLowerCase()}</strong>
            <p className="card-description mt-1 text-amber-900">Your historical records remain available, but new workflow submissions and academic decisions are currently read-only.</p>
          </div>
        </div>
      )}

      {projectLoadFailed && (
        <div className="app-card flex flex-wrap items-center justify-between gap-3 p-4">
          <p role="alert" className="text-sm text-slate-700">Research project status could not be loaded.</p>
          <PortalButton size="sm" onClick={retryProject}>Retry</PortalButton>
        </div>
      )}
      {stageAsking && stageCardNode}

      <DashboardTimeline
        showManageTimeline={false}
        onTimelineUpdate={triggerToast}
        visibleRoles={['STUDENT']}
        studentProject={projectStatus}
      />

      {question && !stageAsking && stageCardNode}

      <StudentAppointmentStatusCards onNavigateToTab={onNavigateToTab} />

      <MonitoringTasksCard
        title="Student Action Centre"
        onTaskClick={navigateToAction}
        projectStage={projectStage ?? null}
      />
    </div>
  );
};
