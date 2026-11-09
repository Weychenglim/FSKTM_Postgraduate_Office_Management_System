/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { RetentionPage } from '../services/registrySemestersApi';
import { getRetention } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { studentCount } from '../utils/registrySemesters';
import { StatusBadge } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { PersonRow } from './RegistryPersonRow';
import { ErrorState, LoadingState } from './StateViews';

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const DataRetention: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<RetentionPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getRetention()
      .then(found => { if (!cancelled) setData(found); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this page.'); });
    return () => { cancelled = true; };
  }, [reload]);

  const page = (children: React.ReactNode) => (
    <RecordPage title="Data retention" backLabel="Back to Student Registry" onBack={() => navigate(APP_ROUTES.registry)}>{children}</RecordPage>
  );

  if (error) return page(<ErrorState message={error} onRetry={() => setReload(value => value + 1)} />);
  if (!data) return page(<LoadingState message="Loading..." />);

  return page(
    <div className="space-y-5">
      <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] font-semibold text-amber-900">
        Removal is locked until UM confirms its record disposal schedule.
      </p>
      <section aria-label="Due for removal" className="app-card space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="text-[15.5px] font-extrabold text-brand-navy">Past {data.years} years</h3>
          {data.soon > 0 && <p className="text-[13px] text-slate-500">{studentCount(data.soon)} within the next year.</p>}
        </div>
        {data.due.length ? (
          <ul className="divide-y divide-slate-100">
            {data.due.map(row => (
              <PersonRow key={row.matric} person={row} detail={<p className="mt-0.5 text-[12.5px] text-slate-500">Ended {day(row.endedOn)}. Due {day(row.dueOn)}.</p>} action={<StatusBadge tone="neutral">{row.status}</StatusBadge>} />
            ))}
          </ul>
        ) : <p className="text-[13px] font-semibold text-slate-400">Nobody yet.</p>}
      </section>
    </div>,
  );
};
