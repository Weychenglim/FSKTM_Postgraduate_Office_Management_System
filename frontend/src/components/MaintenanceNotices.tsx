/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// What people see about portal maintenance: a banner while it is planned, and,
// while it is on, one page for everyone in place of the whole portal, sign-in
// included. The technical administrator switches it in Django admin.

import React from 'react';
import { CalendarClock, LogOut, Wrench } from 'lucide-react';
import type { PortalMaintenance } from '../types';
import { LETTERHEAD } from '../utils/letterDocument';
import { expectedBackLine, maintenanceStatus, maintenanceWindow } from '../utils/maintenance';
import { AuthLayout } from './AuthLayout';
import { PortalButton } from './PortalPrimitives';

const [OFFICE_PHONE, OFFICE_EMAIL] = LETTERHEAD.addressLines[2].split('|').map((part) => part.trim());

/** Above every page while maintenance is planned. */
export const MaintenanceBanner: React.FC<{ maintenance: PortalMaintenance | null }> = ({ maintenance }) => {
  if (!maintenance || maintenanceStatus(maintenance) !== 'planned') return null;
  return (
    <div role="status" className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900">
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0">
        <strong>Planned maintenance: {maintenanceWindow(maintenance)}.</strong> The portal will be unavailable then, so save your work before it starts.
      </p>
    </div>
  );
};

/** The only page anyone sees while maintenance is on. Someone signed in stays signed in. */
export const MaintenanceScreen: React.FC<{ maintenance: PortalMaintenance; onSignOut?: () => void }> = ({ maintenance, onSignOut }) => (
  <div id="application-entry" className="min-h-screen bg-[#f1f5f9]">
    <AuthLayout>
      <section
        aria-labelledby="maintenance-title"
        className="w-full max-w-[490px] rounded-3xl border border-slate-100 bg-white px-6 py-9 text-center shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:px-10"
      >
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0c1424] shadow-lg">
          <Wrench className="h-6 w-6 text-indigo-300" aria-hidden="true" />
        </span>
        <h1 id="maintenance-title" className="page-title">The portal is under maintenance</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700 [overflow-wrap:anywhere]">{maintenance.message}</p>
        <p className="mt-3 text-[14px] font-bold text-slate-800">{expectedBackLine(maintenance)}</p>
        <p className="mt-6 card-description">Questions? Email the PG office at {OFFICE_EMAIL} or call {OFFICE_PHONE}.</p>
        <p className="mt-1 text-[12px] text-slate-500">
          {onSignOut
            ? 'This page checks every minute and takes you back as soon as the portal is open. You stay signed in.'
            : 'This page checks every minute and opens the portal as soon as it is back.'}
        </p>
        {onSignOut && <PortalButton variant="ghost" icon={LogOut} className="mt-6" onClick={onSignOut}>Sign out</PortalButton>}
      </section>
    </AuthLayout>
  </div>
);

/** Above the sign-in form while maintenance is planned. */
export const SignInMaintenanceNotice: React.FC<{ maintenance: PortalMaintenance | null }> = ({ maintenance }) => {
  if (!maintenance || maintenanceStatus(maintenance) !== 'planned') return null;
  return (
    <div role="status" className="mb-12 w-full max-w-[490px] rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left text-amber-900">
      <p className="text-[14px] font-extrabold">Planned maintenance: {maintenanceWindow(maintenance)}</p>
      <p className="mt-1 text-[13px] leading-relaxed">The portal will be unavailable then.</p>
    </div>
  );
};
