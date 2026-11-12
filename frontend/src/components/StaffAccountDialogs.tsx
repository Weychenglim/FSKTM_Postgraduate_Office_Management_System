/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import type { ExistingAccount, ProgrammeMoveCheck, StaffAccountPage, StaffDetailsChange, StaffOptions, StaffWorkItem } from '../types';
import { ApiError, fieldErrors } from '../services/apiClient';
import {
  changeStaffProgramme,
  checkProgrammeMove,
  deleteStaffAccount,
  getStaffOptions,
  setStaffSignIn,
  updateStaffAccount,
} from '../services/staffAccountsApi';
import { programmeName, waitingLine, workLabel } from '../utils/staffAccounts';
import { PROGRAMME_OPTIONS } from '../constants/programmes';
import { PortalButton } from './PortalPrimitives';
import { DialogShell } from './DocumentDialogs';
import { SelectMenu } from './SelectMenu';
import { Field, inputClass } from './StaffAccountForm';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const errorBody = (err: unknown): { existing?: Record<string, ExistingAccount>; blockers?: StaffWorkItem[] } =>
  err instanceof ApiError && err.body && typeof err.body === 'object' ? (err.body as never) : {};

interface DialogProps {
  account: StaffAccountPage;
  isOpen: boolean;
  onClose: () => void;
  onDone: (updated: StaffAccountPage, message: string) => void;
}

type Editable = Required<StaffDetailsChange>;

const editable = (account: StaffAccountPage): Editable => ({
  name: account.name,
  email: account.email,
  phone: account.phone,
  staffId: account.staffId,
  department: account.department,
  title: account.title,
  researchArea: account.researchArea,
  position: account.position,
});

export const EditDetailsDialog: React.FC<DialogProps> = ({ account, isOpen, onClose, onDone }) => {
  const titleId = useId();
  const ids = useId();
  const [values, setValues] = useState<Editable>(() => editable(account));
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, ExistingAccount>>({});
  const [busy, setBusy] = useState(false);
  const office = account.role === 'Office Staff/Admin';

  useEffect(() => {
    if (isOpen) {
      setValues(editable(account));
      setProblems({});
      setExisting({});
    }
  }, [isOpen, account]);

  const set = (field: keyof Editable) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues(current => ({ ...current, [field]: event.target.value }));

  const save = async () => {
    const before = editable(account);
    const changes: StaffDetailsChange = {};
    (Object.keys(values) as (keyof Editable)[]).forEach(field => {
      const value = values[field].trim();
      if (value !== before[field]) changes[field] = value;
    });
    if (!Object.keys(changes).length) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const { account: updated, oldAddressTold } = await updateStaffAccount(account.id, changes);
      const message = !changes.email
        ? 'Details saved.'
        : oldAddressTold === null
          ? 'Saved. The earlier activation link no longer works, so send the activation email to the new address.'
          : oldAddressTold
            ? 'Saved. The old address was told about the change.'
            : 'Saved, but the email to the old address could not be sent.';
      onDone(updated, message);
    } catch (err) {
      const fields = fieldErrors(err);
      setProblems(Object.keys(fields).length ? fields : { form: errorText(err, 'Could not save the details.') });
      setExisting(errorBody(err).existing ?? {});
    } finally {
      setBusy(false);
    }
  };

  const field = (name: keyof Editable, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <Field id={`${ids}-${name}`} label={label} hint={hint} problem={problems[name]} existing={existing[name]}>
      <input id={`${ids}-${name}`} className={inputClass(problems[name])} value={values[name]} onChange={set(name)} {...props} />
    </Field>
  );

  return (
    <DialogShell
      title="Edit details"
      titleId={titleId}
      isOpen={isOpen}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>Cancel</PortalButton>
        <PortalButton variant="primary" isLoading={busy} onClick={() => void save()}>Save</PortalButton>
      </>}
    >
      {field('name', 'Full name', { maxLength: 255 })}
      {field('email', 'Email (used to sign in)', { type: 'email', maxLength: 254 }, account.status === 'ACTIVE' ? 'If you change it, the old address is told.' : undefined)}
      {field('staffId', 'Staff ID', { maxLength: 64 })}
      {office ? field('position', 'Position (optional)', { maxLength: 128 }) : field('title', 'Title (optional)', { maxLength: 64 })}
      {field('department', office ? 'Department (optional)' : 'Department', { maxLength: 255 })}
      {field('phone', 'Phone (optional)', { type: 'tel', maxLength: 32 })}
      {account.role === 'Lecturer' && field('researchArea', 'Research area (optional)', { maxLength: 255 })}
      {problems.form && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problems.form}</p>}
    </DialogShell>
  );
};

const NONE = 'NONE';

export const ProgrammeDialog: React.FC<DialogProps> = ({ account, isOpen, onClose, onDone }) => {
  const titleId = useId();
  const selectId = useId();
  const [choice, setChoice] = useState('');
  const [options, setOptions] = useState<StaffOptions | null>(null);
  const [preview, setPreview] = useState<ProgrammeMoveCheck | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const coordinator = account.role === 'Programme Coordinator';

  useEffect(() => {
    if (!isOpen) return;
    setChoice('');
    setPreview(null);
    setProblem(null);
    setOptions(null);
    getStaffOptions().then(setOptions).catch(() => setOptions({ departments: [], programmes: [] }));
  }, [isOpen]);

  const holderOf = (programme: string) => options?.programmes.find(row => row.programme === programme)?.coordinator;

  const pick = async (value: string) => {
    setChoice(value);
    setPreview(null);
    setProblem(null);
    if (!coordinator) return;
    setBusy(true);
    try {
      setPreview(await checkProgrammeMove(account.id, value === NONE ? '' : value));
    } catch (err) {
      setProblem(errorText(err, 'Could not check this programme.'));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const updated = await changeStaffProgramme(account.id, choice === NONE ? '' : choice);
      const message = coordinator
        ? choice === NONE ? `${account.name} no longer coordinates a programme.` : `${account.name} now coordinates ${programmeName(choice)}.`
        : choice === NONE ? `${account.name} no longer has a programme.` : `${account.name} is now in ${programmeName(choice)}.`;
      onDone(updated, message);
    } catch (err) {
      setProblem(errorText(err, 'Could not change the programme.'));
    } finally {
      setBusy(false);
    }
  };

  const choices = [
    ...PROGRAMME_OPTIONS.filter(programme => programme !== account.programme).map(programme => {
      const holder = coordinator ? holderOf(programme) : undefined;
      const taken = Boolean(holder && holder.id !== account.id);
      return {
        value: programme as string,
        label: programmeName(programme),
        description: taken ? `Coordinated by ${holder?.name}` : undefined,
        disabled: taken,
      };
    }),
    ...(account.programme ? [{ value: NONE, label: 'No programme', description: coordinator ? 'Needed before their sign-in can be turned off.' : undefined }] : []),
  ];

  return (
    <DialogShell
      title="Change programme"
      titleId={titleId}
      isOpen={isOpen}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>Cancel</PortalButton>
        <PortalButton
          variant="primary"
          isLoading={busy && (Boolean(preview) || !coordinator)}
          disabled={(coordinator ? !preview : !choice) || busy}
          onClick={() => void save()}
        >
          Change programme
        </PortalButton>
      </>}
    >
      <p className="text-[13px] text-slate-600">
        Now: <strong>{programmeName(account.programme) || 'No programme'}</strong>
      </p>
      <div className="space-y-1.5">
        <label htmlFor={selectId} className="block text-[13px] font-bold text-slate-700">Move to</label>
        <SelectMenu id={selectId} value={choice} placeholder={options ? 'Choose a programme' : 'Loading...'} disabled={!options} options={choices} onChange={value => void pick(value)} />
      </div>
      {preview && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-[13px] text-slate-700">
          {preview.from.programme && (
            <p>
              Waiting in {programmeName(preview.from.programme)}: <strong>{waitingLine(preview.from.waiting)}</strong>.
              {preview.from.waiting.total > 0 && ' These will wait for that programme\'s next coordinator.'}
            </p>
          )}
          {preview.to.programme && (
            <p>
              Waiting in {programmeName(preview.to.programme)}: <strong>{waitingLine(preview.to.waiting)}</strong>.
              {preview.to.waiting.total > 0 && ` These will come to ${account.name}.`}
            </p>
          )}
        </div>
      )}
      {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
    </DialogShell>
  );
};

const WorkList: React.FC<{ items: StaffWorkItem[] }> = ({ items }) => (
  <ul className="list-disc space-y-1 pl-5 text-[13px] text-amber-900">
    {items.map(item => <li key={item.key}>{workLabel(item)}</li>)}
  </ul>
);

export const SignInDialog: React.FC<DialogProps> = ({ account, isOpen, onClose, onDone }) => {
  const titleId = useId();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<StaffWorkItem[]>([]);
  const [busy, setBusy] = useState(false);
  const turningOn = account.status === 'SIGN_IN_OFF';
  const work = blockers.length ? blockers : turningOn ? [] : account.activeWork;

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setProblem(null);
      setBlockers([]);
    }
  }, [isOpen]);

  const save = async () => {
    if (!turningOn && !reason.trim()) {
      setProblem('Give a reason. It is kept in the account history.');
      return;
    }
    setBusy(true);
    try {
      const updated = await setStaffSignIn(account.id, turningOn, reason.trim());
      onDone(updated, turningOn ? `${account.name} can sign in again.` : `Sign-in turned off. ${account.name} was signed out everywhere.`);
    } catch (err) {
      setBlockers(errorBody(err).blockers ?? []);
      setProblem(errorText(err, 'Could not change sign-in.'));
    } finally {
      setBusy(false);
    }
  };

  if (!turningOn && work.length) {
    return (
      <DialogShell
        title="Sign-in can't be turned off yet"
        titleId={titleId}
        isOpen={isOpen}
        busy={false}
        onClose={onClose}
        footer={<PortalButton variant="primary" onClick={onClose}>Close</PortalButton>}
      >
        <p className="text-[13px] text-slate-700">{account.name} still has open work:</p>
        <WorkList items={work} />
        <p className="text-[13px] text-slate-700">
          {account.role === 'Programme Coordinator' && work.some(item => item.key === 'managedProgrammes')
            ? 'Move them to "No programme" with Change programme first. '
            : ''}
          Hand the rest over first, or use Employment on this page.
        </p>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      title={turningOn ? 'Turn sign-in back on?' : 'Turn off sign-in?'}
      titleId={titleId}
      isOpen={isOpen}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>Cancel</PortalButton>
        <PortalButton variant={turningOn ? 'primary' : 'dangerSolid'} isLoading={busy} onClick={() => void save()}>
          {turningOn ? 'Turn sign-in back on' : 'Turn off sign-in'}
        </PortalButton>
      </>}
    >
      <p className="text-[13px] text-slate-700">
        {turningOn
          ? `${account.name} can sign in again with their own password.`
          : `${account.name} is signed out everywhere and can't sign in until it is turned back on. Their records stay as they are.`}
      </p>
      {!turningOn && (
        <div className="space-y-1.5">
          <label htmlFor={reasonId} className="block text-[13px] font-bold text-slate-700">Reason</label>
          <textarea
            id={reasonId}
            className="form-control min-h-20 px-3.5 py-3 text-[14px]"
            maxLength={500}
            value={reason}
            onChange={event => {
              setReason(event.target.value);
              setProblem(null);
            }}
            placeholder="For example: on study leave until March."
          />
        </div>
      )}
      {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
    </DialogShell>
  );
};

export const DeleteDialog: React.FC<Omit<DialogProps, 'onDone'> & { onDeleted: () => void; onTurnOff: () => void }> = ({
  account, isOpen, onClose, onDeleted, onTurnOff,
}) => {
  const titleId = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const blocked = reasons.length ? reasons : account.deletion.allowed ? [] : account.deletion.reasons;

  useEffect(() => {
    if (isOpen) {
      setProblem(null);
      setReasons([]);
    }
  }, [isOpen]);

  const remove = async () => {
    setBusy(true);
    try {
      await deleteStaffAccount(account.id);
      onDeleted();
    } catch (err) {
      const found = (errorBody(err).blockers as unknown as { text?: string }[] | undefined) ?? [];
      setReasons(found.map(item => item.text ?? '').filter(Boolean));
      setProblem(errorText(err, 'Could not delete this account.'));
    } finally {
      setBusy(false);
    }
  };

  if (blocked.length) {
    return (
      <DialogShell
        title="This account can't be deleted"
        titleId={titleId}
        isOpen={isOpen}
        busy={false}
        onClose={onClose}
        footer={<>
          <PortalButton onClick={onClose}>Close</PortalButton>
          {account.status !== 'SIGN_IN_OFF' && !account.isYou && (
            <PortalButton variant="primary" onClick={onTurnOff}>Turn off sign-in instead</PortalButton>
          )}
        </>}
      >
        <p className="text-[13px] text-slate-700">Only an account added by mistake, never used and linked to nothing, can be deleted.</p>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-slate-700">
          {blocked.map(reason => <li key={reason}>{reason}</li>)}
        </ul>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      title={`Delete ${account.name}?`}
      titleId={titleId}
      isOpen={isOpen}
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>Keep it</PortalButton>
        <PortalButton variant="dangerSolid" isLoading={busy} onClick={() => void remove()}>Delete account</PortalButton>
      </>}
    >
      <p className="text-[13px] text-slate-700">
        This can't be undone.
      </p>
      {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
    </DialogShell>
  );
};

export const ActivationLinkDialog: React.FC<{ name: string; link: string | null; onClose: () => void }> = ({ name, link, onClose }) => {
  const titleId = useId();
  const inputId = useId();
  const [copied, setCopied] = useState<boolean | null>(null);

  useEffect(() => {
    if (!link) return;
    setCopied(null);
    navigator.clipboard?.writeText(link).then(() => setCopied(true), () => setCopied(false));
  }, [link]);

  return (
    <DialogShell
      title="Activation link"
      titleId={titleId}
      isOpen={Boolean(link)}
      busy={false}
      onClose={onClose}
      footer={<PortalButton variant="primary" onClick={onClose}>Done</PortalButton>}
    >
      <p className="text-[13px] text-slate-700">
        {copied ? 'Copied. ' : ''}Send it to {name} yourself, for example by WhatsApp. It works until they set a password. Anyone with it can set the password, so send it only to them.
      </p>
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-[13px] font-bold text-slate-700">Link</label>
        <input id={inputId} readOnly value={link ?? ''} onFocus={event => event.target.select()} className="form-control form-control-md text-[13px]" />
      </div>
      {copied === false && <p className="text-[12px] text-slate-500">Select the link and copy it.</p>}
    </DialogShell>
  );
};
