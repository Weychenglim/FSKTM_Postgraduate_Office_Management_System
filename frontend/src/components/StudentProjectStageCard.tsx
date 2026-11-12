/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectStagesPage, StageChangeResult } from '../services/registrySemestersApi';
import { getProjectStages } from '../services/registrySemestersApi';
import { changeSummary, STAGE_LABEL, STAGE_TONE } from '../utils/projectStages';
import { shortSemester } from '../utils/registrySemesters';
import { PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { ProjectStageChangeDialog } from './ProjectStageChangeDialog';
import { StageNote } from './ProjectStages';

type Toast = { message: string; tone: 'success' | 'danger' };

/** This semester's RP registration on a coordinator's Student Record, with the same Change as the RP Registration page. */
export const StudentProjectStageCard: React.FC<{ matric: string }> = ({ matric }) => {
  const [data, setData] = useState<ProjectStagesPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [changing, setChanging] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    getProjectStages(null, matric)
      .then(found => { if (!cancelled) setData(found); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [matric, reload]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const row = rows[0];

  if (failed) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-[13px] font-semibold text-slate-500">
        Could not load the RP registration.{' '}
        <button type="button" className="font-bold text-blue-700 hover:text-blue-900 cursor-pointer" onClick={() => setReload(value => value + 1)}>Try again</button>
      </p>
    );
  }
  if (!data?.semester || !row) return null;

  const saved = (result: StageChangeResult, kept: boolean) => {
    setChanging(false);
    setToast(result.leftOut.length
      ? { message: `Not changed: ${result.leftOut[0].why}`, tone: 'danger' }
      : { message: changeSummary(result, kept), tone: 'success' });
    setReload(value => value + 1);
  };

  return (
    <section aria-label="RP Registration" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="section-label">RP Registration</h4>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
        <div className="min-w-0">
          <p className="card-label">{shortSemester(data.semester.label)}</p>
          <div className="mt-1">
            <StatusBadge tone={STAGE_TONE[row.shown]}>{STAGE_LABEL[row.shown]}</StatusBadge>
          </div>
          <StageNote row={row} />
        </div>
        {data.canChange && <PortalButton size="sm" onClick={() => setChanging(true)}>Change</PortalButton>}
      </div>
      <ProjectStageChangeDialog
        semesterId={data.semester.id}
        rows={rows}
        reasons={data.reasons}
        isOpen={changing}
        onClose={() => setChanging(false)}
        onSaved={saved}
      />
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </section>
  );
};
