import React from 'react';
import {ClipboardList} from 'lucide-react';
import type {PanelRecommendationDraft, PanelRecommendationSupervisee} from '../types';
import type {PanelPresentation} from '../utils/panelPresentation';
import {PanelBrowse} from './PanelBrowse';
import {PanelSuperviseeRoster} from './PanelSuperviseeRoster';
import {PortalButton} from './PortalPrimitives';
import {RecordPage} from './RecordPage';
import {LoadingState,ErrorState} from './StateViews';

export function PanelSuperviseesWorkspace({students, recommendations, onOpenStudent, onOpenRecords}: {
  students: PanelRecommendationSupervisee[];
  recommendations: PanelRecommendationDraft[];
  onOpenStudent: (studentId: string) => void;
  onOpenRecords: () => void;
}) {
  return <section aria-label="Panels for my supervisees" className="appointment-workspace-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <h2 className="section-label leading-6">My supervisees</h2>
      <PortalButton size="sm" icon={ClipboardList} className="shrink-0" onClick={onOpenRecords}>Nomination records</PortalButton>
    </header>
    <PanelSuperviseeRoster embedded students={students} recommendations={recommendations} onOpen={onOpenStudent}/>
  </section>;
}

export function PanelNominationRecords({recommendations, onBack, onOpenRequest, loading = false, error, onRetry}: {
  recommendations: PanelRecommendationDraft[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onBack: () => void;
  onOpenRequest: (request: PanelPresentation) => void;
}) {
  return <RecordPage title="Nomination records" subtitle="Track your nominations, including those for former supervisees." backLabel="Back to My supervisees" onBack={onBack}>
    {loading ? <LoadingState message="Loading nomination records…"/> : error ? <ErrorState message={error} onRetry={onRetry}/> : <PanelBrowse scope="supervisor-nominations" title="Your nominations" records={recommendations} onOpen={onOpenRequest}/>}
  </RecordPage>;
}
