/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// What people see about portal maintenance: a banner while it is planned (and,
// for the office, while it is on), the page everyone else gets while it is on,
// and a notice on the sign-in page.

import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarClock, LogOut, Wrench } from 'lucide-react';
import type { OfficeMaintenance, PortalMaintenance } from '../types';
import { endMaintenance } from '../services/maintenanceApi';
import { APP_ROUTES } from '../constants/routes';
import { LETTERHEAD } from '../utils/letterDocument';
import { expectedBackLine, maintenanceStatus, maintenanceWindow } from '../utils/maintenance';
import { AuthLayout } from './AuthLayout';
import { PortalButton, PortalConfirmModal } from './PortalPrimitives';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const [OFFICE_PHONE, OFFICE_EMAIL] = LETTERHEAD.addressLines[2].split('|').map((part) => part.trim());

export const ENDED_MESSAGE = 'Maintenance ended. Everyone can use the portal again.';
export const CANCELLED_MESSAGE = 'Planned maintenance cancelled.';

/** Ask before ending maintenance that is on, or cancelling maintenance that is planned. */
export const EndMaintenanceConfirm: React.FC<{
  isOpen: boolean;
  planned: boolean;
  onClose: () => void;
  onEnded: (updated: OfficeMaintenance) => void;
}> = ({ isOpen, planned, onClose, onEnded }) => {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setProblem(null);
    try {
      onEnded(await endMaintenance());
    } catch (err) {
      setProblem(errorText(err, 'Could not end the maintenance.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalConfirmModal
      isOpen={isOpen}
      tone="info"
      icon={Wrench}
      title={planned ? 'Cancel the planned maintenance?' : 'End maintenance?'}
      message={
        <>
          <p>{planned ? 'Nobody will be stopped from using the portal.' : 'Everyone can sign in and use the portal again.'}</p>
          {problem && <p role="alert" className="mt-2 font-semibold text-rose-700">{problem}</p>}
        </>
      }
      confirmLabel={planned ? 'Cancel maintenance' : 'End maintenance'}
      cancelLabel={planned ? 'Keep it planned' : 'Keep it on'}
      isLoading={busy}
      onConfirm={() => void confirm()}
      onCancel={() => {
        setProblem(null);
        onClose();
      }}
    />
  );
};

/** Shown above every page: planned maintenance to everyone, and maintenance that is on to the office. */
export const MaintenanceBanner: React.FC<{
  maintenance: PortalMaintenance | null;
  isOffice: boolean;
  onChanged: (message: string) => void;
}> = ({ maintenance, isOffice, onChanged }) => {
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);
  const status = maintenanceStatus(maintenance);
  if (!maintenance || status === 'off' || (status === 'on' && !isOffice)) return null;
  const on = status === 'on';
  const Icon = on ? Wrench : CalendarClock;

  return (
    <div
      role="status"
      className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[13.5px] ${on ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
    >
      <p className="flex min-w-0 flex-1 basis-72 items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {on ? (
          <span><strong>Maintenance is on.</strong> Only PG office staff can use the portal. {expectedBackLine(maintenance)}</span>
        ) : (
          <span>
            <strong>Planned maintenance: {maintenanceWindow(maintenance)}.</strong>{' '}
            {isOffice ? 'Students, lecturers and coordinators cannot use the portal then.' : 'The portal will be unavailable then, so save your work before it starts.'}
          </span>
        )}
      </p>
      {isOffice && (
        <span className="flex shrink-0 flex-wrap gap-2">
          <PortalButton size="sm" onClick={() => navigate(APP_ROUTES.settings)}>Manage</PortalButton>
          {on && <PortalButton size="sm" variant="primary" onClick={() => setEnding(true)}>End maintenance</PortalButton>}
        </span>
      )}
      {isOffice && on && (
        <EndMaintenanceConfirm
          isOpen={ending}
          planned={false}
          onClose={() => setEnding(false)}
          onEnded={() => {
            setEnding(false);
            onChanged(ENDED_MESSAGE);
          }}
        />
      )}
    </div>
  );
};

/** The whole page for everyone but the office while maintenance is on. They stay signed in. */
export const MaintenanceScreen: React.FC<{ maintenance: PortalMaintenance; onSignOut: () => void }> = ({ maintenance, onSignOut }) => (
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
        <p className="mt-1 text-[12px] text-slate-500">This page checks every minute and takes you back as soon as the portal is open. You stay signed in.</p>
        <PortalButton variant="ghost" icon={LogOut} className="mt-6" onClick={onSignOut}>Sign out</PortalButton>
      </section>
    </AuthLayout>
  </div>
);

/** Above the sign-in form while maintenance is planned or on. */
export const SignInMaintenanceNotice: React.FC<{ maintenance: PortalMaintenance | null }> = ({ maintenance }) => {
  const status = maintenanceStatus(maintenance);
  if (!maintenance || status === 'off') return null;
  const on = status === 'on';
  return (
    <div
      role="status"
      className={`mb-12 w-full max-w-[490px] rounded-2xl border px-5 py-4 text-left ${on ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
    >
      <p className="text-[14px] font-extrabold">{on ? 'The portal is under maintenance' : `Planned maintenance: ${maintenanceWindow(maintenance)}`}</p>
      <p className="mt-1 text-[13px] leading-relaxed [overflow-wrap:anywhere]">
        {on ? `${maintenance.message} Only PG office staff can sign in until it ends. ${expectedBackLine(maintenance)}` : 'The portal will be unavailable then.'}
      </p>
    </div>
  );
};
