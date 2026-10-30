/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The PG office's switch for portal maintenance, in Settings.

import React, { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import type { MaintenanceStatus, OfficeMaintenance } from '../types';
import { fieldErrors } from '../services/apiClient';
import { getOfficeMaintenance, saveMaintenance } from '../services/maintenanceApi';
import { useMaintenance } from '../context/MaintenanceContext';
import { historyTime } from '../utils/documentDisplay';
import { malaysiaDeadline, toMalaysiaDateTimeLocalValue } from '../utils/malaysiaDateTime';
import { expectedBackLine, maintenanceMoment, maintenanceStatus, maintenanceWindow, savedMaintenanceMessage } from '../utils/maintenance';
import { IconHeading } from './IconHeading';
import { CANCELLED_MESSAGE, ENDED_MESSAGE, EndMaintenanceConfirm } from './MaintenanceNotices';
import { PortalModal, useModalTitle } from './PortalModal';
import { PortalButton, PortalCard, PortalToast, StatusBadge } from './PortalPrimitives';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const BADGES: Record<MaintenanceStatus, { tone: 'neutral' | 'warning' | 'danger'; label: string }> = {
  off: { tone: 'neutral', label: 'Off' },
  planned: { tone: 'warning', label: 'Planned' },
  on: { tone: 'danger', label: 'On' },
};

export const PortalMaintenanceCard: React.FC = () => {
  const { maintenance: live, refresh } = useMaintenance();
  const [data, setData] = useState<OfficeMaintenance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getOfficeMaintenance()
      .then((found) => !cancelled && setData(found))
      .catch((err) => !cancelled && setError(errorText(err, 'Could not load portal maintenance.')));
    return () => {
      cancelled = true;
    };
  }, [reload, live?.status]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const status = maintenanceStatus(data);
  const finished = (updated: OfficeMaintenance, message: string) => {
    setData(updated);
    setEditing(false);
    setEnding(false);
    setToast(message);
    refresh();
  };

  return (
    <PortalCard id="portal-maintenance">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <IconHeading
          as="h3"
          title="Portal maintenance"
          description="Stop everyone except the PG office from using the portal while work is done on it."
          icon={
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50">
              <Wrench className="h-4.5 w-4.5 text-brand-navy" />
            </span>
          }
        />
        {data && <StatusBadge tone={BADGES[status].tone} dot>{BADGES[status].label}</StatusBadge>}
      </div>

      {error ? (
        <div role="alert" className="mt-4 card-description text-red-700">
          {error} <PortalButton size="sm" onClick={() => setReload((value) => value + 1)}>Retry</PortalButton>
        </div>
      ) : !data ? (
        <p role="status" className="mt-4 card-description">Loading portal maintenance…</p>
      ) : (
        <>
          <div className="mt-4 space-y-1 text-[14px] text-slate-700">
            {status === 'off' && <p>Everyone can use the portal.</p>}
            {status === 'planned' && <p><span className="font-bold text-slate-900">Planned: {maintenanceWindow(data)}.</span> Set by {data.setBy}.</p>}
            {status === 'on' && (
              <>
                <p><span className="font-bold text-slate-900">Only PG office staff can use the portal.</span> {expectedBackLine(data)}</p>
                <p className="text-[13px] text-slate-500">On since {maintenanceMoment(data.startsAt)}, set by {data.setBy}.</p>
              </>
            )}
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {status === 'off' ? (
              <PortalButton variant="primary" onClick={() => setEditing(true)}>Plan maintenance</PortalButton>
            ) : (
              <>
                <PortalButton onClick={() => setEditing(true)}>Change</PortalButton>
                <PortalButton variant={status === 'on' ? 'primary' : 'danger'} onClick={() => setEnding(true)}>
                  {status === 'on' ? 'End maintenance' : 'Cancel maintenance'}
                </PortalButton>
              </>
            )}
          </div>
          {data.history.length > 0 && (
            <details className="mt-4 border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-[13px] font-bold text-blue-700 hover:text-blue-900">Recent changes</summary>
              <ol className="mt-2 space-y-1.5">
                {data.history.map((entry) => (
                  <li key={entry.id} className="text-[13px] text-slate-700">
                    <span className="font-semibold">{entry.actionLabel}</span>
                    <span className="text-slate-500">, {entry.by}, {historyTime(entry.at)}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
          <MaintenanceDialog
            isOpen={editing}
            current={data}
            status={status}
            onClose={() => setEditing(false)}
            onSaved={(updated) => finished(updated, savedMaintenanceMessage(status, updated))}
          />
          <EndMaintenanceConfirm
            isOpen={ending}
            planned={status === 'planned'}
            onClose={() => setEnding(false)}
            onEnded={(updated) => finished(updated, status === 'planned' ? CANCELLED_MESSAGE : ENDED_MESSAGE)}
          />
        </>
      )}
      <PortalToast message={toast} tone="success" onClose={() => setToast(null)} />
    </PortalCard>
  );
};

const MaintenanceDialog: React.FC<{
  isOpen: boolean;
  current: OfficeMaintenance;
  status: MaintenanceStatus;
  onClose: () => void;
  onSaved: (updated: OfficeMaintenance) => void;
}> = ({ isOpen, current, status, onClose, onSaved }) => {
  const titleId = useModalTitle();
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [startsAt, setStartsAt] = useState('');
  const [expectedEnd, setExpectedEnd] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const on = status === 'on';
  const startsNow = !on && when === 'now';

  useEffect(() => {
    if (!isOpen) return;
    setWhen(status === 'planned' ? 'later' : 'now');
    setStartsAt(status === 'planned' ? toMalaysiaDateTimeLocalValue(current.startsAt) : '');
    setExpectedEnd(toMalaysiaDateTimeLocalValue(current.expectedEnd));
    setMessage(status === 'off' ? current.defaultMessage : current.message);
    setErrors({});
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const found: Record<string, string> = {};
    let start: string | null = null;
    let end: string | null = null;
    if (!startsNow && !on) {
      try {
        start = malaysiaDeadline(startsAt);
      } catch {
        found.startsAt = 'Choose the date and time it starts.';
      }
    }
    if (expectedEnd) {
      try {
        end = malaysiaDeadline(expectedEnd);
      } catch {
        found.expectedEnd = 'Enter a valid date and time.';
      }
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      onSaved(await saveMaintenance({ startsAt: start, expectedEnd: end, message: message.trim() }));
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(Object.keys(fields).length ? fields : { form: errorText(err, 'Could not save the maintenance.') });
    } finally {
      setBusy(false);
    }
  };

  const title = on ? 'Change the maintenance' : status === 'planned' ? 'Change the planned maintenance' : 'Plan maintenance';
  const saveLabel = startsNow ? 'Start maintenance now' : status === 'off' ? 'Plan maintenance' : 'Save changes';
  const earliest = toMalaysiaDateTimeLocalValue(new Date().toISOString());

  return (
    <PortalModal isOpen={isOpen} onClose={onClose} busy={busy} labelledBy={titleId} className="max-w-lg p-6">
      <h2 id={titleId} className="section-heading">{title}</h2>
      <div className="mt-5 space-y-5">
        {on ? (
          <p className="text-[14px] text-slate-700">Started {maintenanceMoment(current.startsAt)}.</p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="text-[14px] font-bold text-slate-800">When does it start?</legend>
            {(['now', 'later'] as const).map((choice) => (
              <label key={choice} className="flex cursor-pointer items-center gap-3 py-1 text-[14px] font-semibold text-slate-700">
                <input type="radio" name="maintenance-when" className="h-5 w-5 accent-brand-navy" checked={when === choice} onChange={() => setWhen(choice)} />
                {choice === 'now' ? 'Now' : 'At a set time'}
              </label>
            ))}
            {when === 'later' && (
              <label className="block space-y-1.5 pl-8">
                <span className="text-[13px] font-bold text-slate-700">Starts at (Malaysia time)</span>
                <input type="datetime-local" min={earliest} className="form-control form-control-md text-[14px]" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
                {errors.startsAt && <span role="alert" className="block text-[13px] font-semibold text-rose-700">{errors.startsAt}</span>}
              </label>
            )}
          </fieldset>
        )}
        {on && errors.startsAt && <p role="alert" className="text-[13px] font-semibold text-rose-700">{errors.startsAt}</p>}

        <label className="block space-y-1.5">
          <span className="text-[14px] font-bold text-slate-800">Expected back by (optional, Malaysia time)</span>
          <input type="datetime-local" min={earliest} className="form-control form-control-md text-[14px]" value={expectedEnd} onChange={(event) => setExpectedEnd(event.target.value)} />
          <span className="block text-[12px] text-slate-500">Shown to everyone. Maintenance only ends when the office ends it.</span>
          {errors.expectedEnd && <span role="alert" className="block text-[13px] font-semibold text-rose-700">{errors.expectedEnd}</span>}
        </label>

        <label className="block space-y-1.5">
          <span className="text-[14px] font-bold text-slate-800">Message to everyone</span>
          <textarea className="form-control min-h-24 px-3.5 py-3 text-[14px]" maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} />
          {errors.message && <span role="alert" className="block text-[13px] font-semibold text-rose-700">{errors.message}</span>}
        </label>

        {startsNow && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900">
            Students, lecturers and coordinators are stopped at their next click, and only PG office staff can sign in until you end it.
          </p>
        )}
        {errors.form && <p role="alert" className="text-[13px] font-semibold text-rose-700">{errors.form}</p>}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <PortalButton onClick={onClose} disabled={busy}>Cancel</PortalButton>
        <PortalButton variant="primary" isLoading={busy} onClick={() => void save()}>{saveLabel}</PortalButton>
      </div>
    </PortalModal>
  );
};
