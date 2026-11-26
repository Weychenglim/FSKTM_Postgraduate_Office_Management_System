/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ChevronRight, UserPlus } from 'lucide-react';
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

      <section aria-label="Staff accounts" className="app-card portal-table space-y-4 p-4 sm:p-5">
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
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table aria-label="Staff accounts" className="data-table">
                <thead>
                  <tr className="data-thead bg-slate-50">
                    <th scope="col" className="data-th">Name</th>
                    <th scope="col" className="data-th hidden md:table-cell">Role</th>
                    <th scope="col" className="data-th table-fit">Status</th>
                    <th scope="col" className="data-th table-fit hidden whitespace-nowrap lg:table-cell">Last signed in</th>
                    <th scope="col" className="data-th table-open"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(account => (
                    <tr
                      key={account.id}
                      className="data-row cursor-pointer last:border-b-0"
                      onClick={() => {
                        if (!window.getSelection()?.toString()) navigate(routeForStaffAccount(account.id));
                      }}
                    >
                      <td className="data-td">
                        <span className="flex items-center gap-3">
                          <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 sm:flex items-center justify-center rounded-xl bg-slate-100 text-[12px] font-extrabold text-slate-700">
                            {initials(account.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="table-primary">{account.name}{account.isYou ? ' (you)' : ''}</span>
                            <span className="table-note md:[overflow-wrap:break-word]">{account.email}</span>
                            <span className="table-note md:hidden">{ROLE_LABEL[account.role]}</span>
                          </span>
                        </span>
                      </td>
                      <td className="data-td hidden md:table-cell [overflow-wrap:anywhere]">
                        <span className="table-primary">{ROLE_LABEL[account.role]}</span>
                        <span className="table-note">{roleLine(account)}</span>
                      </td>
                      <td className="data-td table-fit">
                        {account.status === 'ACTIVE' ? (
                          'Active'
                        ) : (
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ${STATUS_CHIP[account.status]}`}>
                            {STATUS_LABEL[account.status]}
                          </span>
                        )}
                      </td>
                      <td className="data-td table-fit hidden whitespace-nowrap lg:table-cell">
                        {account.lastSignedIn ? historyTime(account.lastSignedIn) : 'Never'}
                      </td>
                      <td className="data-td table-open">
                        <Link
                          to={routeForStaffAccount(account.id)}
                          aria-label={`Open ${account.name}`}
                          onClick={event => event.stopPropagation()}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-navy"
                        >
                          <ChevronRight aria-hidden="true" className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
