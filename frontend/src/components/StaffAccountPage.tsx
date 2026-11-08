/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { CheckCircle2, Mail, Pencil } from 'lucide-react';
import type { ActivationOutcome, StaffAccountChange, StaffAccountPage as AccountPage, StaffDuty } from '../types';
import { ApiError } from '../services/apiClient';
import { copyStaffActivationLink, getStaffAccount, getStaffHistory, sendStaffLink, setStaffDuties } from '../services/staffAccountsApi';
import { APP_ROUTES } from '../constants/routes';
import {
  DUTY_LABEL,
  ROLE_LABEL,
  STATUS_LABEL,
  capacityLine,
  capacityNeedsLimit,
  dutyHasWork,
  dutyWorkLine,
  historyLine,
  leftoverLimits,
  programmeName,
  workLabel,
} from '../utils/staffAccounts';
import { historyTime } from '../utils/documentDisplay';
import { PortalButton, PortalToast } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { ErrorState, LoadingState } from './StateViews';
import { OverflowMenu, type MenuAction } from './DocumentParts';
import { LecturerStatusCards } from './ParticipantStatusCards';
import { ActivationLinkDialog, DeleteDialog, EditDetailsDialog, ProgrammeDialog, SignInDialog } from './StaffAccountDialogs';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const DUTIES: StaffDuty[] = ['Supervisor', 'Panel'];

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[12px] text-slate-500">{label}</dt>
    <dd className="mt-0.5 break-words text-[14px] font-semibold text-slate-800">{children || <span className="font-normal text-slate-400">Not given</span>}</dd>
  </div>
);

type Toast = { message: string; tone: 'success' | 'danger' };
type Dialog = 'edit' | 'programme' | 'signIn' | 'delete' | null;

export const StaffAccountPage: React.FC<{ accountId: string }> = ({ accountId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState<AccountPage | null>(null);
  const [history, setHistory] = useState<StaffAccountChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [created, setCreated] = useState<ActivationOutcome | null>(() => location.state?.created ?? null);

  useEffect(() => {
    if (location.state?.created) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getStaffAccount(accountId), getStaffHistory(accountId)])
      .then(([found, changes]) => {
        if (cancelled) return;
        setAccount(found);
        setHistory(changes);
      })
      .catch(err => !cancelled && setError(errorText(err, 'Could not open this account.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accountId, reload]);

  const refreshHistory = useCallback(() => {
    getStaffHistory(accountId).then(setHistory).catch(() => undefined);
  }, [accountId]);

  const finished = (updated: AccountPage, message: string) => {
    setAccount(updated);
    setDialog(null);
    setToast({ message, tone: 'success' });
    refreshHistory();
  };

  const sendLink = async () => {
    if (!account) return;
    setBusy('link');
    try {
      const { kind, sent } = await sendStaffLink(account.id);
      const what = kind === 'activation' ? 'Activation email' : 'Password reset link';
      setToast(
        sent
          ? { message: `${what} sent to ${account.email}.`, tone: 'success' }
          : { message: `The ${what.toLowerCase()} could not be sent. Try again later${kind === 'activation' ? ', or copy the link and send it yourself' : ''}.`, tone: 'danger' },
      );
      if (sent) setCreated(null);
      refreshHistory();
    } catch (err) {
      setToast({ message: errorText(err, 'Could not send the link.'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    if (!account) return;
    setBusy('copy');
    try {
      setLink((await copyStaffActivationLink(account.id)).link);
      refreshHistory();
    } catch (err) {
      setToast({ message: errorText(err, 'Could not get the link.'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const toggleDuty = async (duty: StaffDuty, on: boolean) => {
    if (!account) return;
    const next = on ? [...account.duties, duty] : account.duties.filter(item => item !== duty);
    setBusy(`duty:${duty}`);
    try {
      finished(await setStaffDuties(account.id, DUTIES.filter(item => next.includes(item))), on ? `${DUTY_LABEL[duty]} duty added.` : `${DUTY_LABEL[duty]} duty removed.`);
    } catch (err) {
      const blockers = err instanceof ApiError && err.body && typeof err.body === 'object' ? (err.body as { blockers?: { key: string; count: number }[] }).blockers ?? [] : [];
      const detail = blockers.length ? ` ${blockers.map(workLabel).join(', ')}.` : '';
      setToast({ message: `${errorText(err, 'Could not change the duties.')}${detail}`, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const back = () => navigate(APP_ROUTES.registryStaff);
  const lecturerLike = account?.role === 'Lecturer' || account?.role === 'Programme Coordinator';
  const left = account?.lifecycle === 'RETIRED' || account?.lifecycle === 'RESIGNED';
  const canAddDuty = account?.status !== 'SIGN_IN_OFF' && account?.lifecycle === 'ACTIVE';

  const menu: MenuAction[] = account && !account.isYou ? [
    ...(account.status !== 'SIGN_IN_OFF' ? [{ label: 'Turn off sign-in', onSelect: () => setDialog('signIn') }] : []),
    { label: 'Delete account', danger: true, onSelect: () => setDialog('delete') },
  ] : [];

  const subtitle = account
    ? [ROLE_LABEL[account.role], account.role === 'Programme Coordinator' ? programmeName(account.programme) : account.department, account.staffId].filter(Boolean).join(' · ')
    : undefined;

  return (
    <RecordPage
      title={account ? `${account.name}${account.isYou ? ' (you)' : ''}` : 'Staff account'}
      subtitle={subtitle}
      backLabel="Back to Staff & Lecturers"
      onBack={back}
      pageKey={`staff-account:${accountId}`}
      actions={account ? (
        <div className="flex items-center gap-2">
          <PortalButton icon={Pencil} onClick={() => setDialog('edit')}>Edit details</PortalButton>
          <OverflowMenu label="More account actions" actions={menu} />
        </div>
      ) : undefined}
    >
      {loading ? (
        <LoadingState message="Opening the account..." />
      ) : error || !account ? (
        <ErrorState message={error ?? 'This account is not available.'} onRetry={() => setReload(value => value + 1)} />
      ) : (
        <div className="space-y-5">
          {created === 'sent' && (
            <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-[14px] font-semibold text-emerald-900">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              Account created. The activation email was sent to {account.email}.
            </div>
          )}
          {created === 'held' && (
            <div role="status" className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-[14px] font-semibold text-blue-900">
              Account created. Send the activation email when you are ready.
            </div>
          )}
          {created === 'failed' && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-[14px] font-semibold text-amber-900">Account created, but the activation email could not be sent.</p>
              <div className="flex flex-wrap gap-2">
                <PortalButton isLoading={busy === 'copy'} onClick={() => void copyLink()}>Copy the link</PortalButton>
                <PortalButton variant="primary" isLoading={busy === 'link'} onClick={() => void sendLink()}>Try again</PortalButton>
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="space-y-5">
              <section aria-label="Details" className="app-card space-y-4 p-5">
                <h2 className="section-label">Details</h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Fact label="Email">{account.email}</Fact>
                  <Fact label="Phone">{account.phone}</Fact>
                  <Fact label="Staff ID">{account.staffId}</Fact>
                  <Fact label="Department">{account.department}</Fact>
                  {lecturerLike && <Fact label="Title">{account.title}</Fact>}
                  {account.role === 'Lecturer' && <Fact label="Research area">{account.researchArea}</Fact>}
                  {account.role === 'Office Staff/Admin' && <Fact label="Position">{account.position}</Fact>}
                </dl>
                {account.role === 'Programme Coordinator' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-[12px] text-slate-500">Programme they coordinate</p>
                      <p className="text-[14px] font-semibold text-slate-800">{programmeName(account.programme) || 'No programme'}</p>
                    </div>
                    <PortalButton size="sm" onClick={() => setDialog('programme')}>Change programme</PortalButton>
                  </div>
                )}
              </section>

              {account.role === 'Lecturer' && (
                <section aria-label="Duties" className="app-card space-y-2 p-5">
                  <h2 className="section-label">Duties</h2>
                  <div className="divide-y divide-slate-100">
                    {DUTIES.map(duty => {
                      const on = account.duties.includes(duty);
                      const saving = busy === `duty:${duty}`;
                      const locked = on ? dutyHasWork(duty, account.activeWork) : !canAddDuty;
                      return (
                        <label key={duty} className={`flex items-start gap-3 py-3 ${locked ? '' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={saving ? !on : on}
                            aria-busy={saving || undefined}
                            disabled={locked || busy !== null}
                            onChange={event => void toggleDuty(duty, event.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-[#0c1424]"
                          />
                          <span>
                            <span className="block text-[14px] font-bold text-slate-800">{DUTY_LABEL[duty]}</span>
                            <span className="block text-[13px] text-slate-500">
                              {on ? dutyWorkLine(duty, account.activeWork) : canAddDuty ? 'Not given' : 'Can be added while they are active and can sign in.'}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-slate-500">A duty can't be removed while it still has open work.</p>
                  {account.capacity?.semester && (
                    <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-[13px]">
                      {capacityLine(account.capacity) && (
                        <p><span className="text-slate-500">Capacity, {account.capacity.semester}:</span> <strong>{capacityLine(account.capacity)}</strong></p>
                      )}
                      {capacityNeedsLimit(account.capacity) && (
                        <p className="font-semibold text-amber-800">Until the office sets a limit in Lecturer capacity, students can't pick {account.name} for a duty marked "no limit set yet".</p>
                      )}
                      {leftoverLimits(account.capacity).map(duty => (
                        <p key={duty} className="font-semibold text-amber-800">Lecturer capacity still has a {DUTY_LABEL[duty]} limit for {account.name}. Clear it there.</p>
                      ))}
                      <Link to={APP_ROUTES.dashboardLecturerCapacity} className="inline-block font-bold text-blue-700 hover:text-blue-900">Change limits in Lecturer capacity</Link>
                    </div>
                  )}
                </section>
              )}

              <section aria-label="History" className="app-card space-y-3 p-5">
                <h2 className="section-label">History</h2>
                {history.length === 0 ? (
                  <p className="text-[13px] text-slate-500">No changes recorded yet.</p>
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {history.map(change => {
                      const line = historyLine(change);
                      return (
                        <li key={change.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 text-[13px]">
                          <span className="text-slate-800">
                            <strong>{line.title}</strong>
                            {line.detail && <span className="text-slate-600"> {line.detail}</span>}
                          </span>
                          <span className="text-slate-500">{change.actor || 'System'}, {historyTime(change.at)}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>

            <aside aria-label="Access" className="order-first space-y-5 lg:order-none">
              <section className="app-card space-y-4 p-5">
                <h2 className="section-label">Access</h2>
                <dl className="space-y-2 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Status</dt>
                    <dd className="font-bold text-slate-800">{STATUS_LABEL[account.status]}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Last signed in</dt>
                    <dd className="font-bold text-slate-800">{account.lastSignedIn ? historyTime(account.lastSignedIn) : 'Never'}</dd>
                  </div>
                </dl>
                {account.status === 'NOT_ACTIVATED' && (
                  <>
                    <PortalButton variant="primary" icon={Mail} fullWidth isLoading={busy === 'link'} onClick={() => void sendLink()}>
                      Send activation email
                    </PortalButton>
                    <p className="text-[12px] leading-relaxed text-slate-500">
                      The link has no time limit and stops working once they set a password. If emails keep failing,{' '}
                      <button type="button" className="font-bold text-blue-700 hover:text-blue-900" disabled={busy !== null} onClick={() => void copyLink()}>copy the link</button>{' '}
                      and send it yourself.
                    </p>
                  </>
                )}
                {account.status === 'ACTIVE' && (
                  <>
                    <PortalButton variant="primary" icon={Mail} fullWidth isLoading={busy === 'link'} onClick={() => void sendLink()}>
                      Send password reset link
                    </PortalButton>
                    <p className="text-[12px] leading-relaxed text-slate-500">The link lasts 30 minutes.</p>
                  </>
                )}
                {account.status === 'SIGN_IN_OFF' && (
                  <>
                    <p className="text-[13px] text-slate-700">
                      {left ? `${account.name} has left, so sign-in stays off.` : `${account.name} can't sign in.`}
                    </p>
                    {!left && (
                      <PortalButton variant="primary" fullWidth onClick={() => setDialog('signIn')}>Turn sign-in back on</PortalButton>
                    )}
                  </>
                )}
              </section>
              {lecturerLike && account.lifecycle && (
                <LecturerStatusCards
                  staffId={account.staffId}
                  name={account.name}
                  onChanged={message => {
                    setToast({ message, tone: 'success' });
                    setReload(value => value + 1);
                  }}
                />
              )}
            </aside>
          </div>
        </div>
      )}
      {account && (
        <>
          <EditDetailsDialog account={account} isOpen={dialog === 'edit'} onClose={() => setDialog(null)} onDone={finished} />
          <ProgrammeDialog account={account} isOpen={dialog === 'programme'} onClose={() => setDialog(null)} onDone={finished} />
          <SignInDialog account={account} isOpen={dialog === 'signIn'} onClose={() => setDialog(null)} onDone={finished} />
          <DeleteDialog
            account={account}
            isOpen={dialog === 'delete'}
            onClose={() => setDialog(null)}
            onTurnOff={() => setDialog('signIn')}
            onDeleted={() => navigate(APP_ROUTES.registryStaff, { replace: true, state: { message: `Deleted ${account.name}.` } })}
          />
          <ActivationLinkDialog name={account.name} link={link} onClose={() => setLink(null)} />
        </>
      )}
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </RecordPage>
  );
};
