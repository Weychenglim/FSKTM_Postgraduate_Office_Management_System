/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { AlertMessage } from './AlertMessage';
import { AuthCard } from './ForgotPasswordFlow';
import { PasswordChangeForm } from './PasswordChangeForm';

interface ForcedPasswordChangeProps {
  userName: string;
  onChanged: () => void;
  onLogout: () => void;
}

export const ForcedPasswordChange: React.FC<ForcedPasswordChangeProps> = ({
  userName,
  onChanged,
  onLogout,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <div className="w-full max-w-[490px]">
      <AuthCard
        id="forced-password-change"
        badgeIcon={KeyRound}
        title="Change Your Password"
        subtitle={`${userName}, your account needs a new password before you can continue.`}
      >
        {error && (
          <div className="mb-5 text-left">
            <AlertMessage type="error" message={error} onClose={() => setError(null)} />
          </div>
        )}

        <PasswordChangeForm
          idPrefix="forced"
          submitLabel="Set New Password"
          onChanged={onChanged}
          onError={setError}
          onSavingChange={setSaving}
        />

        {/* Signing out mid-save would let the save's response sign the user back in. */}
        <button
          type="button"
          onClick={onLogout}
          disabled={saving}
          className="mt-3 py-2 self-center text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Sign out instead
        </button>
      </AuthCard>
    </div>
  );
};
