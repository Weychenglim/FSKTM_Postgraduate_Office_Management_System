import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarRange, CircleAlert, ClipboardList, FileCheck2 } from 'lucide-react';
import { APP_ROUTES } from '../constants/routes';
import { getEvaluationPeriods, getRubricVersions } from '../services/marksApi';
import { getAcademicSemesters } from '../services/academicSemestersApi';
import type { AcademicSemester } from '../types/academicSemester';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import type { EvaluationPeriodOption, RubricVersion } from '../types';
import { buildMarksSetupChecklist } from '../utils/marksProductionManagement';
import type { MarkRecordStatusTab } from '../utils/markRecords';
import { AlertListCard } from './AlertListCard';
import { ChecklistCard } from './ChecklistCard';
import { MarkSubmissionMonitoring } from './MarkSubmissionMonitoring';
import { MarksHeading, MarksSummaryCard } from './MarksPrimitives';
import { PortalSelect } from './PortalSelect';
import { semesterPeriods, semesterMarkTotals } from '../utils/marksOverview';
import { PageHeader, PortalButton } from './PortalPrimitives';
import { ErrorState, LoadingState } from './StateViews';

export function MarksOverview({ onViewRecords }: { onViewRecords: (status?: MarkRecordStatusTab, periodId?: number, semester?: string) => void }) {
  const navigate = useNavigate();
  const [semester, setSemester] = useState('');
  const [academicSemesters, setAcademicSemesters] = useState<AcademicSemester[]>([]);
  const [data, setData] = useState<{ periods: EvaluationPeriodOption[]; rubrics: RubricVersion[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    getAcademicSemesters().then(items => { if (!cancelled) setAcademicSemesters(items); }).catch(() => { if (!cancelled) setAcademicSemesters([]); });
    Promise.all([getEvaluationPeriods(), getRubricVersions()])
      .then(([periods, rubrics]) => { if (!cancelled) setData({ periods, rubrics }); })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Marks overview could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  const semesters = [...new Set(data?.periods.filter(period => period.lifecycleStatus !== 'ARCHIVED').map(period => period.semester) ?? [])];
  const selectedSemester = semester || data?.periods.find(period => period.effectiveStatus === 'OPEN')?.semester
    || data?.periods.find(period => period.effectiveStatus === 'SCHEDULED')?.semester || semesters[0] || '';
  const periods = semesterPeriods(data?.periods ?? [], selectedSemester);
  const academicSemester = academicSemesters.find(item => item.id === periods[0]?.semesterId || item.label === selectedSemester);
  const totals = semesterMarkTotals(periods);
  const openRecords = (status?: MarkRecordStatusTab, periodId?: number) => onViewRecords(status, periodId, selectedSemester);

  return <div id="marks-entry-workspace" className="marks-workspace space-y-6">
    <PageHeader title="Marks & Evaluation Management" subtitle="Prepare evaluations and track mark submissions." />
    {loading ? <LoadingState message="Loading marks overview…" /> : error ? <ErrorState title="Marks overview could not be loaded" message={error} onRetry={() => setAttempt(value => value + 1)} /> : null}
    {!loading && error ? <PortalButton onClick={() => onViewRecords()}>View mark records</PortalButton> : null}
    {!loading && !error && data ? <>
      <section aria-label="Evaluation summary" className="space-y-6">
        <div>
        <label className="form-label block max-w-sm">Academic semester
          <PortalSelect aria-describedby={academicSemester ? 'marks-semester-dates' : undefined} className="form-control form-control-md mt-2" value={selectedSemester} disabled={!semesters.length} onChange={event => setSemester(event.target.value)}>
            {!semesters.length && <option value="">No evaluation periods configured</option>}
            {semesters.map(value => <option key={value} value={value}>{value}</option>)}
          </PortalSelect>
        </label>
        {academicSemester && <p id="marks-semester-dates" className="mt-2 text-[13px] leading-5 text-slate-600">{formatMalaysiaDate(academicSemester.startsOn)} – {formatMalaysiaDate(academicSemester.endsOn)}</p>}
        </div>
        <div id="summary-cards-grid" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MarksSummaryCard title="Open periods" icon={CalendarRange} value={periods.filter(period => period.effectiveStatus === 'OPEN').length} />
          <MarksSummaryCard title="Evaluation tasks" icon={ClipboardList} value={totals.total} onClick={() => openRecords()} />
          <MarksSummaryCard title="Submitted" icon={FileCheck2} value={totals.submitted} onClick={() => openRecords('Submitted')} />
          <MarksSummaryCard title="Overdue" icon={CircleAlert} value={totals.overdue} onClick={() => openRecords('Overdue')} />
        </div>
      </section>
    </> : null}
    <div id="core-layout-grid" className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <ChecklistCard unavailable={loading || !!error} items={buildMarksSetupChecklist(data?.periods ?? [], data?.rubrics ?? [])} onItemAction={item => navigate(item.id === 'period' ? APP_ROUTES.marksConfig : item.id === 'rubric' ? APP_ROUTES.marksRubrics : APP_ROUTES.marksTasks)} />
      {!loading && !error && data ? <AlertListCard periods={data.periods} rubrics={data.rubrics} onViewRecords={onViewRecords} onManageRubrics={() => navigate(APP_ROUTES.marksRubrics)} /> : <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><MarksHeading icon={CircleAlert}>Evaluation checks</MarksHeading><p className="card-description mt-2">{loading ? 'Loading evaluation checks…' : 'Evaluation checks could not be loaded. Setup pages and submission monitoring remain available.'}</p></aside>}
    </div>
    {!loading && !error && data ? <MarkSubmissionMonitoring key={selectedSemester} periods={periods} onViewRecords={openRecords} onGenerateTasks={periodId => navigate(`${APP_ROUTES.marksTasks}?period=${periodId}`)} /> : null}
  </div>;
}
