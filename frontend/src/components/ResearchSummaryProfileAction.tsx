import React, {useEffect, useState} from 'react';
import {BookOpen} from 'lucide-react';
import {useInRouterContext, useLocation, useNavigate} from 'react-router';
import {APP_ROUTES} from '../constants/routes';
import {getResearchProfileLink} from '../services/researchAmendmentsApi';
import {PortalButton} from './PortalPrimitives';

function ScopedProfileAction({matricNo, returnLabel}: {matricNo: string; returnLabel: string}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [target, setTarget] = useState<{matricNo: string; studentId: number} | null>(null);
  useEffect(() => {
    let current = true;
    getResearchProfileLink(matricNo).then(({studentId}) => {
      if (current) setTarget(studentId ? {matricNo, studentId} : null);
    }).catch(() => {
      if (current) setTarget(null);
    });
    return () => { current = false; };
  }, [matricNo]);
  if (!target || target.matricNo !== matricNo) return null;
  return <PortalButton size="sm" variant="primary" icon={BookOpen} onClick={() => {
    const params = new URLSearchParams({profileStudent: String(target.studentId)});
    navigate(`${APP_ROUTES.supervisorResearchProfile}?${params}`, {state: {researchProfileReturn: {
      path: location.pathname + location.search, label: returnLabel, historyIndex: window.history.state?.idx,
    }}});
  }}>View research profile</PortalButton>;
}

export function ResearchSummaryProfileAction({matricNo, returnLabel}: {matricNo?: string; returnLabel: string}) {
  const routed = useInRouterContext();
  return routed && matricNo ? <ScopedProfileAction key={matricNo} matricNo={matricNo} returnLabel={returnLabel} /> : null;
}
