import {StaffSupervisorBrowseContext} from './StaffSupervisorBrowseContext';
import React, { useState } from 'react';
import {useSearchParams} from 'react-router';
import { BookOpen } from 'lucide-react';
import { ResearchAmendments } from './ResearchAmendments';
import { PageHeader, PortalButton } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { LecturerResearchWorkspace } from './LecturerResearchWorkspace';
import { SupervisorWorkspaceNavigation } from './SupervisorWorkspaceNavigation';
import { supervisorResearchLabel } from '../utils/supervisorWorkspace';

export function StaffResearchWorkspace(props: React.ComponentProps<typeof ResearchAmendments>&{backLabel?:string}) {
  const [busy, setBusy] = useState(false);
  const [metadata, setMetadata] = useState<React.ReactNode>(null);
  const [detailTitle, setDetailTitle] = useState<string | null>(null);
  const [params] = useSearchParams();
  const view = props.routeView ?? 'list';
  const role = props.role === 'Programme Coordinator' ? 'Programme Coordinator' : 'Office Staff/Admin';
  const workspaceLabel = supervisorResearchLabel(role);
  const creationTitle=params.get('changeType')==='CORRECTION' ? 'Correct research text' : params.get('changeType')==='TRANSFER' ? 'Request programme transfer' : 'Manage research record';
  const title = view === 'detail' ? detailTitle ?? 'Request details' : view === 'profile' ? Number(params.get('profileStudent') ?? params.get('student')) > 0 ? 'Research profile' : 'Research profiles' : view === 'new' ? creationTitle : workspaceLabel;
  const content = <LecturerResearchWorkspace {...props} role={role} routeView={view} hideHeader={view !== 'list'} showRefresh={false} refreshVersion={props.refreshVersion ?? 0} onBusyChange={setBusy} onDetailMetadata={setMetadata} onDetailTitle={setDetailTitle} />;
  const profileAction = view === 'list' && role === 'Office Staff/Admin' && props.onNavigateToProfile ? (
    <PortalButton variant="primary" icon={BookOpen} className="min-h-11 normal-case! text-sm! font-semibold! tracking-normal! focus-visible:ring-offset-2" disabled={busy} onClick={() => props.onNavigateToProfile?.()}>
      Research profiles
    </PortalButton>
  ) : undefined;
  return <StaffSupervisorBrowseContext.Provider value={role}>{view === 'list' && role === 'Programme Coordinator' ? <div className="space-y-6"><PageHeader title="Supervisor Appointments" subtitle="Review programme transfers and follow their recorded progress and outcomes." /><SupervisorWorkspaceNavigation role={role} />{content}</div>
    : <RecordPage title={title} metadata={view==='detail'?metadata:undefined} backLabel={props.backLabel??(view==='list'?'Back to Supervisor Appointments':`Back to ${workspaceLabel}`)} onBack={props.onNavigateToList ?? (() => {})} busy={busy} actions={profileAction} headerClassName={profileAction ? 'md:items-end!' : undefined}>{content}</RecordPage>}</StaffSupervisorBrowseContext.Provider>;
}
