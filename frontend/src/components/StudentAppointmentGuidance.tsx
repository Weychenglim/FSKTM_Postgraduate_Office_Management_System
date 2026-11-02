import React, { useEffect, useState } from 'react';
import { getActiveSupervisorDocumentRequirements, getSupervisorDocumentSetup } from '../services/appointmentsApi';
import type { SupervisorDocumentRequirement } from '../types';
import { formatSupervisorDocumentSize, SUPERVISOR_DOCUMENT_MAX_FILES, SUPERVISOR_DOCUMENT_MAX_TOTAL_BYTES } from '../utils/supervisorDocuments';
import { PortalButton } from './PortalPrimitives';
import type { AppointmentGuidanceCard } from './StudentAppointmentPrimitives';
import { StudentAppointmentNextStep } from './StudentAppointmentLayout';

type GuidanceProps = { hasSupervisor: boolean; hasPendingRequest?: boolean; onShowFAQChatbot?: () => void };

export function SupervisorAppointmentGuidanceView({ requirements, noDocumentsRequired = false, loading, error, onRetry, hasSupervisor, hasPendingRequest = false, onShowFAQChatbot }: GuidanceProps & {
  requirements: SupervisorDocumentRequirement[]; noDocumentsRequired?: boolean; loading: boolean; error: string | null; onRetry: () => void;
}) {
  const active = requirements.filter(row => row.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
  const cards: AppointmentGuidanceCard[] = hasSupervisor ? [{ title: 'Changing your supervisor', content: <p>Contact the Postgraduate Office if exceptional circumstances require a supervisor change.</p> }] : hasPendingRequest ? [{title: 'Follow your application', content: <p>Open your current request to see its approval progress and any decision notes.</p>}] : [{ title: 'Documents for a new application', content: loading ? <p role="status">Loading document requirements…</p> : error ? <><p role="alert">{error}</p><PortalButton size="sm" onClick={onRetry}>Retry requirements</PortalButton></> : active.length ? <>
    <ul className="space-y-1">{active.map(row => <li key={row.id}>{row.label} <span className="card-label">({row.isRequired ? 'Required' : 'Optional'})</span></li>)}</ul>
    <p>PDF or DOCX. Up to {SUPERVISOR_DOCUMENT_MAX_FILES} files, {formatSupervisorDocumentSize(SUPERVISOR_DOCUMENT_MAX_TOTAL_BYTES)} combined.</p>
  </> : noDocumentsRequired ? <p>No supporting documents required.</p> : <p>Document requirements are not configured. Contact the Postgraduate Office before applying.</p> }];
  return <StudentAppointmentNextStep cards={cards} onShowFAQChatbot={onShowFAQChatbot} />;
}

export function SupervisorAppointmentGuidance(props: GuidanceProps) {
  const [noDocumentsRequired, setNoDocumentsRequired] = useState(false);
  const [requirements, setRequirements] = useState<SupervisorDocumentRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    if (props.hasSupervisor || props.hasPendingRequest) { setLoading(false); return; }
    setLoading(true); setError(null);
    Promise.all([getActiveSupervisorDocumentRequirements(), getSupervisorDocumentSetup()]).then(([rows, setup]) => { if (current) { setRequirements(rows); setNoDocumentsRequired(setup.noDocumentsRequired); } })
      .catch(failure => { if (current) { setRequirements([]); setError(failure instanceof Error ? failure.message : 'Document requirements could not be loaded.'); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [attempt, props.hasSupervisor, props.hasPendingRequest]);
  return <SupervisorAppointmentGuidanceView {...props} requirements={requirements} noDocumentsRequired={noDocumentsRequired} loading={loading} error={error} onRetry={() => setAttempt(value => value + 1)} />;
}
