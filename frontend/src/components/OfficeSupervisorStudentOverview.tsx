import React, { useEffect, useState } from 'react';
import type { SupervisoryWorkspace } from '../types/coSupervision';
import { officeSupervisorApi } from '../services/staffSupervisorWorkspaceApi';
import { useReturnToFocusReload } from '../utils/returnToFocus';
import { AppointmentAttentionOverview } from './AppointmentAttentionOverview';
import { RecordPage } from './RecordPage';
import { LoadingState, ErrorState } from './StateViews';

export function OfficeSupervisorStudentOverviewContent({ workspace, identity, onOpenRequest, onOpenStudent, onOpenAppointment }: {
  workspace: SupervisoryWorkspace; identity: string; onOpenRequest?: (id: number) => void;
  onOpenStudent?: (id: string) => void; onOpenAppointment?: (id: string) => void;
}) {
  const team = workspace.teams.find(row => row.matricNo === identity);
  if (!team) return <p role="status" className="card-description">Student overview unavailable.</p>;
  const request = workspace.primaryApplication?.studentId === identity ? workspace.primaryApplication : null;
  const pending = request && ['SUBMITTED_TO_SUPERVISOR', 'PENDING_COORDINATOR'].includes(request.status) ? request : null;
  return <AppointmentAttentionOverview module="Supervisor" studentName={team.studentName} studentId={team.matricNo} programme={team.programme}
    projectStage={team.projectStage} projectSemester={team.projectSemester}
    active={!!team.primaryAppointmentId} supervisor={team.primarySupervisor?.name} research={team.research} onOpenStudent={onOpenStudent}
    onOpenAppointment={team.primaryAppointmentId && onOpenAppointment ? () => onOpenAppointment(team.matricNo) : undefined}
    pendingRequest={pending ? { status: pending.status, candidate: pending.proposedSupervisor, onOpen: onOpenRequest ? () => onOpenRequest(pending.id) : undefined } : undefined} />;
}

export function OfficeSupervisorStudentOverview({ identity, onBack, backLabel, ...actions }: {
  identity: string; onBack: () => void; backLabel: string;
  onOpenRequest?: (id: number) => void; onOpenStudent?: (id: string) => void; onOpenAppointment?: (id: string) => void;
}) {
  const [result, setResult] = useState<{ identity: string; workspace: SupervisoryWorkspace } | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let current = true;
    setResult(null); setError('');
    officeSupervisorApi.team(identity).then(workspace => { if (current) setResult({ identity, workspace }); })
      .catch(reason => { if (current) setError(reason instanceof Error ? reason.message : 'Student overview could not be loaded.'); });
    return () => { current = false; };
  }, [identity, version]);
  useReturnToFocusReload(() => setVersion(value => value + 1), result?.identity === identity && !error);
  return <RecordPage pageKey={`office-supervisor-student-${identity}`} title="Supervisor appointment overview" backLabel={backLabel} onBack={onBack}>
    {error ? <ErrorState message={error} onRetry={() => setVersion(value => value + 1)} /> : result?.identity === identity ? <OfficeSupervisorStudentOverviewContent workspace={result.workspace} identity={identity} {...actions} /> : <LoadingState message="Loading student appointment overview…" />}
  </RecordPage>;
}
