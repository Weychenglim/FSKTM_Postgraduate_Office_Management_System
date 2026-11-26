/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { fieldErrors } from '../services';
import * as authApi from '../services/authApi';
import { authenticationErrorMessage } from '../utils/authErrorMessage';
import { PasswordInput } from './PasswordInput';
import { PortalButton } from './PortalPrimitives';

interface PasswordChangeFormProps {
  idPrefix: string;
  submitLabel?: string;
  onChanged: () => void;
  /** Errors that belong to no single field (throttling, network, server). */
  onError?: (message: string | null) => void;
  onSavingChange?: (saving: boolean) => void;
}

export const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
  idPrefix,
  submitLabel = 'Update Password',
  onChanged,
  onError,
  onSavingChange,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof pwErrors = {};
    if (!currentPassword) errors.current = 'Enter your current password.';
    if (newPassword.length < 8) errors.next = 'Use at least 8 characters.';
    if (confirmPassword !== newPassword) errors.confirm = 'Passwords do not match.';
    setPwErrors(errors);
    onError?.(null);
    if (Object.keys(errors).length > 0) return;

    setSavingPassword(true);
    onSavingChange?.(true);
    try {
      const applied = await authApi.changePassword(currentPassword, newPassword);
      if (!applied) return;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onChanged();
    } catch (err) {
      // Field problems show under their field; anything else is form-wide.
      const byField = fieldErrors(err);
      if (byField.current_password || byField.new_password) {
        setPwErrors({ current: byField.current_password, next: byField.new_password });
      } else {
        const message = authenticationErrorMessage(err, 'Could not reach the server. Please try again.');
        if (onError) onError(message);
        else setPwErrors({ next: message });
      }
    } finally {
      setSavingPassword(false);
      onSavingChange?.(false);
    }
  };

  return (
    <form onSubmit={handleSavePassword} className="w-full text-left">
      <PasswordInput
        id={`${idPrefix}-current-pw`}
        label="Current password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        error={pwErrors.current}
        autoComplete="current-password"
        aria-invalid={pwErrors.current ? true : undefined}
      />
      <PasswordInput
        id={`${idPrefix}-new-pw`}
        label="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={pwErrors.next}
        autoComplete="new-password"
        aria-invalid={pwErrors.next ? true : undefined}
      />
      <PasswordInput
        id={`${idPrefix}-confirm-pw`}
        label="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={pwErrors.confirm}
        autoComplete="new-password"
        aria-invalid={pwErrors.confirm ? true : undefined}
      />
      <PortalButton
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        icon={ArrowRight}
        iconPosition="right"
        isLoading={savingPassword}
        className="mt-1"
      >
        {submitLabel}
      </PortalButton>
    </form>
  );
};
