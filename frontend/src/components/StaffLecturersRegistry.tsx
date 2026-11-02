/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Search, UserPlus } from 'lucide-react';
import type { StaffAccountList, StaffRoleFilter, StaffStatusFilter } from '../types';
import { getStaffAccounts } from '../services/staffAccountsApi';
import { APP_ROUTES, routeForStaffAccount } from '../constants/routes';
import { ROLE_LABEL, STATUS_LABEL, initials, roleLine } from '../utils/staffAccounts';
import { historyTime } from '../utils/documentDisplay';
import { PageHeader, PortalButton, PortalToast } from './PortalPrimitives';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';
import { useListState } from './ListState';
import { RegistryModuleTabs } from './RegistryModuleTabs';
import { StaffAccountForm } from './StaffAccountForm';
import { StaffAccountPage } from './StaffAccountPage';

export { RegistryModuleTabs, type RegistryModuleTab } from './RegistryModuleTabs';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const ROLE_OPTIONS: SelectMenuOption<StaffRoleFilter>[] = [
  { value: '', label: 'All roles', triggerLabel: 'All' },
  { value: 'OFFICE', label: 'Office staff' },
  { value: 'LECTURER', label: 'Lecturer' },
  { value: 'COORDINATOR', label: 'Programme coordinator' },
];

const STATUS_OPTIONS: SelectMenuOption<StaffStatusFilter>[] = [
  { value: '', label: 'All statuses', triggerLabel: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'NOT_ACTIVATED', label: 'Not activated yet' },
  { value: 'SIGN_IN_OFF', label: 'Sign-in off' },
];

const OPEN_LINK =
  'inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-700 shadow-3xs transition hover:bg-slate-50 hover:text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20';

const STATUS_CHIP: Record<string, string> = {
  NOT_ACTIVATED: 'bg-amber-50 text-amber-800',
  SIGN_IN_OFF: 'bg-slate-100 text-slate-700',
};

const StaffAccountList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useListState('StaffAccounts', 'search', '');
  const [role, setRole] = useListState<StaffRoleFilter>('StaffAccounts', 'role', '');
  const [status, setStatus] = useListState<StaffStatusFilter>('StaffAccounts', 'status', '');
  const [page, setPage] = useListState('StaffAccounts', 'page', 1);
  const [data, setData] = useState<StaffAccountList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(typeof location.state?.message === 'string' ? location.state.message : null);
  const latest = useRef(0);

  const load = useCallback(() => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    getStaffAccounts({ search, role, status, page })
      .then(result => {
        if (id === latest.current) setData(result);
      })
      .catch(err => {
        if (id === latest.current) setError(errorText(err, 'Could not load the staff accounts.'));
      })
      .finally(() => {
        if (id === latest.current) setLoading(false);
      });
  }, [search, role, status, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const filtered = Boolean(search.trim() || role || status);
  const rows = data?.results ?? [];
  const first = data && data.count ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.count) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;

  return (
    <div id="staff-accounts" className="space-y-6">
      <PageHeader
        title="Staff & Lecturers"
        actions={
          <PortalButton variant="primary" icon={UserPlus} onClick={() => navigate(APP_ROUTES.registryStaffNew)}>
            Add account
          </PortalButton>
        }
      />
      <RegistryModuleTabs active="staff_lecturers" />

      <div className="grid grid-cols-1 items-end gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-3xs md:grid-cols-12">
        <label className="block md:col-span-6">
          <span className="form-label block">Search</span>
          <span className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <input
              type="search"
              value={search}
              onChange={event => { setSearch(event.target.value); setPage(1); }}
              placeholder="Name, email, Staff ID or department"
              className="form-control form-control-sm pl-9"
            />
          </span>
        </label>
        <div className="md:col-span-3">
          <span className="form-label block">Role</span>
          <SelectMenu<StaffRoleFilter> size="sm" aria-label="Role" value={role} options={ROLE_OPTIONS} onChange={value => { setRole(value); setPage(1); }} />
        </div>
        <div className="md:col-span-3">
          <span className="form-label block">Status</span>
          <SelectMenu<StaffStatusFilter> size="sm" aria-label="Status" value={status} options={STATUS_OPTIONS} onChange={value => { setStatus(value); setPage(1); }} />
        </div>
      </div>

      <section aria-label="Staff accounts" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-3xs">
        <div className="relative overflow-x-auto">
          <table className="data-table min-w-[720px] text-xs">
            <thead>
              <tr className="data-thead bg-[#f8fafc]">
                <th className="data-th min-w-[15rem]">Name</th>
                <th className="data-th">Role</th>
                <th className="data-th">Status</th>
                <th className="data-th">Last signed in</th>
                <th className="data-th text-right"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data ? (
                <tr><td colSpan={5} className="p-0"><LoadingState message="Loading staff accounts..." /></td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="p-0"><ErrorState message={error} onRetry={load} /></td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[13px] font-semibold text-slate-500">
                    {filtered ? 'No accounts match these filters.' : 'No staff accounts yet. Add the first one.'}
                  </td>
                </tr>
              ) : (
                rows.map(account => (
                  <tr key={account.id} className="transition hover:bg-slate-50/50">
                    <td className="data-td">
                      <span className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-extrabold text-slate-700">
                          {initials(account.name)}
                        </span>
                        <span className="min-w-0">
                          <Link to={routeForStaffAccount(account.id)} className="block font-bold text-slate-800 hover:underline">
                            {account.name}{account.isYou ? ' (you)' : ''}
                          </Link>
                          <span className="block break-all text-[11px] text-slate-500">{account.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="data-td">
                      <span className="block font-bold text-slate-800">{ROLE_LABEL[account.role]}</span>
                      <span className="block text-[11px] text-slate-500">{roleLine(account)}</span>
                    </td>
                    <td className="data-td whitespace-nowrap">
                      {account.status === 'ACTIVE' ? (
                        <span className="text-slate-600">Active</span>
                      ) : (
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_CHIP[account.status]}`}>
                          {STATUS_LABEL[account.status]}
                        </span>
                      )}
                    </td>
                    <td className="data-td whitespace-nowrap text-slate-600">
                      {account.lastSignedIn ? historyTime(account.lastSignedIn) : 'Never'}
                    </td>
                    <td className="data-td text-right">
                      <Link to={routeForStaffAccount(account.id)} className={OPEN_LINK} aria-label={`Open ${account.name}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && data.count > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <span className="text-[12px] font-semibold text-slate-500">
              Showing {first} to {last} of {data.count} account{data.count === 1 ? '' : 's'}
            </span>
            {pages > 1 && (
              <span className="flex gap-2">
                <PortalButton size="sm" disabled={data.page <= 1 || loading} onClick={() => setPage(data.page - 1)}>Previous</PortalButton>
                <PortalButton size="sm" disabled={data.page >= pages || loading} onClick={() => setPage(data.page + 1)}>Next</PortalButton>
              </span>
            )}
          </div>
        )}
      </section>
      <PortalToast message={toast} tone="success" onClose={() => setToast(null)} />
    </div>
  );
};

/** Registry > Staff & Lecturers: the list, Add account, or one account. */
export const StaffLecturersRegistry: React.FC<{ view: 'list' | 'new' | 'account'; accountId?: string }> = ({ view, accountId }) => {
  if (view === 'new') return <StaffAccountForm />;
  if (view === 'account' && accountId) return <StaffAccountPage key={accountId} accountId={accountId} />;
  return <StaffAccountList />;
};
