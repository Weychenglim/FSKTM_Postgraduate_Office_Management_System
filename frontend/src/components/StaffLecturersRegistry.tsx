/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { UserPlus } from 'lucide-react';
import type { StaffAccountList, StaffRoleFilter, StaffStatusFilter } from '../types';
import { getStaffAccounts } from '../services/staffAccountsApi';
import { APP_ROUTES, routeForStaffAccount } from '../constants/routes';
import { ROLE_LABEL, STATUS_LABEL, initials, roleLine } from '../utils/staffAccounts';
import { historyTime } from '../utils/documentDisplay';
import { PageHeader, PortalButton, PortalToast } from './PortalPrimitives';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';
import { ListSearch, ListToolbar, ListToolbarRow } from './ListToolbar';
import { ErrorState, LoadingState } from './StateViews';
import { useListState } from './ListState';
import { RegistryModuleTabs } from './RegistryModuleTabs';
import { StaffAccountForm } from './StaffAccountForm';
import { StaffAccountPage } from './StaffAccountPage';
import { toastDuration } from '../utils/toastDuration';

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

      <section aria-label="Staff accounts" className="app-card readable-list space-y-4 p-4 sm:p-5">
        <ListToolbar>
          <ListToolbarRow>
            <ListSearch
              label="Search staff accounts"
              placeholder="Search name, email, Staff ID or department"
              value={search}
              onChange={value => {
                setSearch(value);
                setPage(1);
              }}
            />
            <SelectMenu<StaffRoleFilter> variant="filter" prefix="Role" aria-label="Filter by role" value={role} options={ROLE_OPTIONS} onChange={value => { setRole(value); setPage(1); }} />
            <SelectMenu<StaffStatusFilter> variant="filter" prefix="Status" aria-label="Filter by status" value={status} options={STATUS_OPTIONS} onChange={value => { setStatus(value); setPage(1); }} />
          </ListToolbarRow>
        </ListToolbar>

        {loading && !data ? (
          <LoadingState message="Loading staff accounts..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 card-description">
            {filtered ? 'No accounts match this search.' : 'No staff accounts yet.'}
          </p>
        ) : (
          <>
            <table aria-label="Staff accounts" className="data-table block table-fixed lg:table">
              <colgroup className="hidden lg:table-column-group">
                {[36, 26, 13, 15, 10].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
              </colgroup>
              <thead className="hidden lg:table-header-group">
                <tr className="data-thead bg-slate-50">
                  <th scope="col" className="data-th">Name</th>
                  <th scope="col" className="data-th">Role</th>
                  <th scope="col" className="data-th">Status</th>
                  <th scope="col" className="data-th">Last signed in</th>
                  <th scope="col" className="data-th"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="block space-y-3 lg:table-row-group lg:space-y-0">
                {rows.map(account => (
                  <tr key={account.id} className="data-row grid grid-cols-2 rounded-xl border border-slate-200 py-2 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:py-0">
                    <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                      <span className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[12px] font-extrabold text-slate-700">
                          {initials(account.name)}
                        </span>
                        <span className="min-w-0">
                          <Link to={routeForStaffAccount(account.id)} className="block font-bold text-slate-800 hover:underline [overflow-wrap:anywhere]">
                            {account.name}{account.isYou ? ' (you)' : ''}
                          </Link>
                          <span className="card-caption block break-all">{account.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle [overflow-wrap:anywhere] lg:col-span-1 lg:table-cell lg:px-5 lg:py-4">
                      <span className="card-label mb-1 block lg:hidden">Role</span>
                      <span className="block font-bold text-slate-800">{ROLE_LABEL[account.role]}</span>
                      <span className="card-caption block">{roleLine(account)}</span>
                    </td>
                    <td className="data-td block min-w-0 px-3 py-2 align-middle lg:table-cell lg:px-5 lg:py-4">
                      <span className="card-label mb-1 block lg:hidden">Status</span>
                      {account.status === 'ACTIVE' ? (
                        <span className="text-slate-600">Active</span>
                      ) : (
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ${STATUS_CHIP[account.status]}`}>
                          {STATUS_LABEL[account.status]}
                        </span>
                      )}
                    </td>
                    <td className="data-td block min-w-0 px-3 py-2 align-middle text-slate-600 lg:table-cell lg:px-5 lg:py-4">
                      <span className="card-label mb-1 block lg:hidden">Last signed in</span>
                      {account.lastSignedIn ? historyTime(account.lastSignedIn) : 'Never'}
                    </td>
                    <td className="data-td col-span-2 block min-w-0 px-3 py-2 align-middle lg:col-span-1 lg:table-cell lg:px-5 lg:py-4">
                      <Link to={routeForStaffAccount(account.id)} className={OPEN_LINK} aria-label={`Open ${account.name}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && data.count > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="card-description">
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
          </>
        )}
      </section>
      <PortalToast message={toast} tone="success" durationMs={toastDuration()} onClose={() => setToast(null)} />
    </div>
  );
};

/** Registry > Staff & Lecturers: the list, Add account, or one account. */
export const StaffLecturersRegistry: React.FC<{ view: 'list' | 'new' | 'account'; accountId?: string }> = ({ view, accountId }) => {
  if (view === 'new') return <StaffAccountForm />;
  if (view === 'account' && accountId) return <StaffAccountPage key={accountId} accountId={accountId} />;
  return <StaffAccountList />;
};
