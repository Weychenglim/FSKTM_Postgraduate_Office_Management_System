/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ExistingAccount, StaffDuty, StaffOptions, StaffRole } from '../types';
import { ApiError, fieldErrors } from '../services/apiClient';
import { createStaffAccount, getStaffOptions } from '../services/staffAccountsApi';
import { APP_ROUTES, routeForStaffAccount } from '../constants/routes';
import { DUTY_LABEL, existingAccountPath, existingAccountText, programmeName } from '../utils/staffAccounts';
import { PortalButton } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { SelectMenu } from './SelectMenu';

const ROLES: { value: StaffRole; label: string }[] = [
  { value: 'Office Staff/Admin', label: 'Office staff' },
  { value: 'Lecturer', label: 'Lecturer' },
  { value: 'Programme Coordinator', label: 'Programme coordinator' },
];

const DUTIES: { value: StaffDuty }[] = [
  { value: 'Supervisor' },
  { value: 'Panel' },
];

type Details = { name: string; title: string; email: string; staffId: string; department: string; phone: string; researchArea: string; position: string };
const EMPTY: Details = { name: '', title: '', email: '', staffId: '', department: '', phone: '', researchArea: '', position: '' };

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const Field: React.FC<{
  id: string;
  label: string;
  hint?: string;
  problem?: string;
  existing?: ExistingAccount;
  className?: string;
  children: React.ReactNode;
}> = ({ id, label, hint, problem, existing, className = '', children }) => {
  const holder = existingAccountPath(existing, APP_ROUTES.registryStaff);
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-[13px] font-bold text-slate-700">{label}</label>
      {children}
      {hint && !problem && <p id={`${id}-hint`} className="text-[12px] text-slate-500">{hint}</p>}
      {problem && (
        <p id={`${id}-problem`} role="alert" className="text-[12px] font-semibold text-rose-700">
          {problem}{existing ? ` ${existingAccountText(existing)}` : ''}
          {holder && <> <Link to={holder} className="underline">Open their account</Link></>}
        </p>
      )}
    </div>
  );
};

export const inputClass = (problem?: string) => `form-control form-control-md text-[14px]${problem ? ' form-control-error' : ''}`;

export const StaffAccountForm: React.FC = () => {
  const navigate = useNavigate();
  const ids = useId();
  const done = useRef(false);
  const [role, setRole] = useState<StaffRole | ''>('');
  const [details, setDetails] = useState<Details>(EMPTY);
  const [duties, setDuties] = useState<StaffDuty[]>([]);
  const [programme, setProgramme] = useState('');
  const [sendNow, setSendNow] = useState(true);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, ExistingAccount>>({});
  const [options, setOptions] = useState<StaffOptions | null>(null);
  const [saving, setSaving] = useState(false);
  const lecturerLike = role === 'Lecturer' || role === 'Programme Coordinator';
  const dirty = role !== '' || Object.values(details).some(value => value.trim() !== '') || duties.length > 0 || programme !== '';

  useEffect(() => {
    getStaffOptions().then(setOptions).catch(() => setOptions({ departments: [], programmes: [] }));
  }, []);

  const set = (field: keyof Details) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setDetails(current => ({ ...current, [field]: event.target.value }));
    setProblems(current => ({ ...current, [field]: '' }));
  };

  const check = (): Record<string, string> => {
    const found: Record<string, string> = {};
    if (!role) found.role = 'Choose a role.';
    if (!details.name.trim()) found.name = 'Enter the full name.';
    if (!details.email.trim()) found.email = 'Enter the email they will sign in with.';
    if (!details.staffId.trim()) found.staffId = 'Enter the Staff ID.';
    if (lecturerLike && !details.department.trim()) found.department = 'Enter the department.';
    if (role === 'Programme Coordinator' && !programme) found.programme = 'Choose the programme this coordinator manages.';
    return found;
  };

  const create = async () => {
    const found = check();
    setProblems(found);
    setExisting({});
    if (Object.keys(found).length || !role) return;
    setSaving(true);
    try {
      const { account, activation } = await createStaffAccount({
        role,
        name: details.name.trim(),
        email: details.email.trim(),
        staffId: details.staffId.trim(),
        phone: details.phone.trim(),
        department: details.department.trim(),
        ...(lecturerLike ? { title: details.title.trim() } : {}),
        ...(role === 'Lecturer' ? { researchArea: details.researchArea.trim(), duties } : {}),
        ...(role === 'Office Staff/Admin' ? { position: details.position.trim() } : {}),
        ...(role === 'Programme Coordinator' ? { programme } : {}),
        sendActivation: sendNow,
      });
      done.current = true;
      navigate(routeForStaffAccount(account.id), { replace: true, state: { created: activation } });
    } catch (err) {
      const fields = fieldErrors(err);
      const body = err instanceof ApiError && err.body && typeof err.body === 'object' ? (err.body as { existing?: Record<string, ExistingAccount> }) : {};
      if (Object.keys(fields).length) {
        setProblems(fields);
        setExisting(body.existing ?? {});
      } else {
        setProblems({ form: errorText(err, 'Could not create the account.') });
      }
    } finally {
      setSaving(false);
    }
  };

  const id = (name: string) => `${ids}-${name}`;
  const describedBy = (name: string) => (problems[name] ? `${id(name)}-problem` : undefined);

  return (
    <RecordPage
      title="Add account"
      backLabel="Back to Staff & Lecturers"
      onBack={() => navigate(APP_ROUTES.registryStaff)}
      pageKey="staff-account:new"
      dirty={dirty && !done.current}
      busy={saving}
      navigationComplete={done}
    >
      {requestBack => (
        <form
          noValidate
          className="space-y-5"
          onSubmit={event => {
            event.preventDefault();
            void create();
          }}
        >
          <fieldset className="app-card space-y-3 p-5">
            <legend className="sr-only">Role</legend>
            <h2 className="section-label" aria-hidden="true">Role</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {ROLES.map(option => {
                const chosen = role === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${chosen ? 'border-brand-navy bg-slate-50 ring-1 ring-brand-navy' : 'border-slate-200 hover:bg-slate-50/60'}`}
                  >
                    <input
                      type="radio"
                      name="staff-account-role"
                      value={option.value}
                      checked={chosen}
                      onChange={() => {
                        setRole(option.value);
                        setProblems({});
                        setExisting({});
                      }}
                      className="mt-1 h-4 w-4 accent-[#0c1424]"
                    />
                    <span>
                      <span className="block text-[14px] font-extrabold text-slate-800">{option.label}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-[12px] text-slate-500">Can't be changed later.</p>
            {problems.role && <p role="alert" className="text-[12px] font-semibold text-rose-700">{problems.role}</p>}
          </fieldset>

          {role && (
            <>
              <section aria-labelledby={id('details-heading')} className="app-card space-y-4 p-5">
                <h2 id={id('details-heading')} className="section-label">Details</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={id('name')} label="Full name" problem={problems.name}>
                    <input id={id('name')} className={inputClass(problems.name)} value={details.name} onChange={set('name')} maxLength={255} autoComplete="off" aria-describedby={describedBy('name')} />
                  </Field>
                  {lecturerLike ? (
                    <Field id={id('title')} label="Title (optional)" problem={problems.title}>
                      <input id={id('title')} className={inputClass(problems.title)} value={details.title} onChange={set('title')} maxLength={64} placeholder="Dr." />
                    </Field>
                  ) : (
                    <Field id={id('position')} label="Position (optional)" problem={problems.position}>
                      <input id={id('position')} className={inputClass(problems.position)} value={details.position} onChange={set('position')} maxLength={128} placeholder="Assistant Registrar" />
                    </Field>
                  )}
                  <Field id={id('email')} label="Email (used to sign in)" problem={problems.email} existing={existing.email}>
                    <input id={id('email')} type="email" className={inputClass(problems.email)} value={details.email} onChange={set('email')} maxLength={254} autoComplete="off" aria-describedby={describedBy('email')} />
                  </Field>
                  <Field id={id('staffId')} label="Staff ID" problem={problems.staffId} existing={existing.staffId}>
                    <input id={id('staffId')} className={inputClass(problems.staffId)} value={details.staffId} onChange={set('staffId')} maxLength={64} autoComplete="off" aria-describedby={describedBy('staffId')} />
                  </Field>
                  <Field id={id('department')} label={lecturerLike ? 'Department' : 'Department (optional)'} problem={problems.department}>
                    <input id={id('department')} list={id('departments')} className={inputClass(problems.department)} value={details.department} onChange={set('department')} maxLength={255} aria-describedby={describedBy('department')} />
                    <datalist id={id('departments')}>
                      {options?.departments.map(name => <option key={name} value={name} />)}
                    </datalist>
                  </Field>
                  <Field id={id('phone')} label="Phone (optional)" problem={problems.phone}>
                    <input id={id('phone')} type="tel" className={inputClass(problems.phone)} value={details.phone} onChange={set('phone')} maxLength={32} aria-describedby={describedBy('phone')} />
                  </Field>
                  {role === 'Lecturer' && (
                    <Field id={id('researchArea')} label="Research area (optional)" problem={problems.researchArea} className="sm:col-span-2">
                      <input id={id('researchArea')} className={inputClass(problems.researchArea)} value={details.researchArea} onChange={set('researchArea')} maxLength={255} />
                    </Field>
                  )}
                </div>
              </section>

              {role === 'Lecturer' && (
                <fieldset className="app-card space-y-3 p-5">
                  <legend className="sr-only">Duties</legend>
                  <h2 className="section-label" aria-hidden="true">Duties</h2>
                  <div className="divide-y divide-slate-100">
                    {DUTIES.map(duty => (
                      <label key={duty.value} className="flex cursor-pointer items-start gap-3 py-3">
                        <input
                          type="checkbox"
                          checked={duties.includes(duty.value)}
                          onChange={event => setDuties(current => (event.target.checked ? [...current, duty.value] : current.filter(item => item !== duty.value)))}
                          className="mt-0.5 h-4 w-4 accent-[#0c1424]"
                        />
                        <span>
                          <span className="block text-[14px] font-bold text-slate-800">{DUTY_LABEL[duty.value]}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {duties.length > 0 && (
                    <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] font-semibold text-blue-900">
                      Students can pick this lecturer only after the office sets their limits in{' '}
                      <Link to={APP_ROUTES.dashboardLecturerCapacity} className="underline">Lecturer capacity</Link>.
                    </p>
                  )}
                </fieldset>
              )}

              {role === 'Programme Coordinator' && (
                <section aria-labelledby={id('programme-heading')} className="app-card space-y-3 p-5">
                  <h2 id={id('programme-heading')} className="section-label">Programme</h2>
                  <Field id={id('programme')} label="Programme they manage" problem={problems.programme} existing={existing.programme}>
                    <SelectMenu
                      id={id('programme')}
                      value={programme}
                      placeholder="Choose a programme"
                      options={(options?.programmes ?? []).map(row => ({
                        value: row.programme,
                        label: programmeName(row.programme),
                        description: row.coordinator ? `Coordinated by ${row.coordinator.name}` : undefined,
                        disabled: Boolean(row.coordinator),
                      }))}
                      onChange={value => {
                        setProgramme(value);
                        setProblems(current => ({ ...current, programme: '' }));
                      }}
                    />
                  </Field>
                  <p className="text-[12px] text-slate-500">A programme has one coordinator.</p>
                </section>
              )}

              <section className="app-card p-5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={sendNow} onChange={event => setSendNow(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0c1424]" />
                  <span>
                    <span className="block text-[14px] font-bold text-slate-800">Send the activation email now</span>
                  </span>
                </label>
              </section>
            </>
          )}

          {problems.form && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problems.form}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <PortalButton onClick={requestBack} disabled={saving}>Cancel</PortalButton>
            <PortalButton type="submit" variant="primary" isLoading={saving} disabled={!role}>Create account</PortalButton>
          </div>
        </form>
      )}
    </RecordPage>
  );
};
