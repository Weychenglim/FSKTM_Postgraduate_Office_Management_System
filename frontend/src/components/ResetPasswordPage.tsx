/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, KeyRound, Link2Off, Lock } from 'lucide-react';
import { authApi } from '../services';
import { authenticationErrorMessage } from '../utils/authErrorMessage';
import { PASSWORD_LINK_COPY, type PasswordLinkKind } from '../utils/passwordLinkCopy';
import { AuthCard, AuthScreen, BackLink, InfoMessage } from './ForgotPasswordFlow';
import { PasswordInput } from './PasswordInput';
import { PortalButton } from './PortalPrimitives';

interface ResetPasswordPageProps {
  /** From the email link: `?uid=...&token=...`. */
  uid: string;
  token: string;
  /** Which email the link came from. The backend's check of the link has the final say. */
  kind?: PasswordLinkKind;
  onBackToLogin: () => void;
  onRequestNewLink?: () => void;
}

type LinkState = 'checking' | 'ready' | 'invalid';

/**
 * The page an activation or password reset email opens. The link is checked
 * first, so a used or expired link is explained before anyone types a
 * password. Submits the uid + token + new password to the backend.
 */
export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  uid,
  token,
  kind: linkKind = 'reset',
  onBackToLogin,
  onRequestNewLink,
}) => {
  const [kind, setKind] = useState<PasswordLinkKind>(linkKind);
  const [linkState, setLinkState] = useState<LinkState>(uid && token ? 'checking' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [isDone, setIsDone] = useState(false);
  const copy = PASSWORD_LINK_COPY[kind];

  useEffect(() => {
    if (!uid || !token) {
      setLinkState('invalid');
      return;
    }
    let cancelled = false;
    setLinkState('checking');
    authApi
      .checkPasswordLink(uid, token)
      .then((checked) => {
        if (cancelled) return;
        setKind(checked);
        setLinkState('ready');
      })
      .catch((err) => {
        // Only a definite "no longer valid" closes the form. If the check
        // itself fails, the form still works and the submit reports problems.
        if (!cancelled) setLinkState(authApi.isInvalidPasswordLink(err) ? 'invalid' : 'ready');
      });
    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    if (password.length < 8) {
      setErrorText('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorText('The two passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.confirmPasswordReset(uid, token, password);
      setIsDone(true);
    } catch (err) {
      if (authApi.isInvalidPasswordLink(err)) {
        setLinkState('invalid');
      } else {
        setErrorText(authenticationErrorMessage(
          err,
          'Cannot reach the server. Please try again shortly.',
        ));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const requestNewLink = kind === 'reset' && onRequestNewLink ? onRequestNewLink : onBackToLogin;

  return (
    <AuthScreen>
      <BackLink onClick={onBackToLogin} />

      <div className="mt-10">
        {linkState === 'checking' ? (
          <div
            id="password-link-checking"
            role="status"
            className="flex flex-col items-center gap-3 py-16 text-slate-500"
          >
            <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-[#0c1424] animate-spin" />
            <p className="text-xs font-bold tracking-wide">Checking your link…</p>
          </div>
        ) : linkState === 'invalid' ? (
          <AuthCard
            id="password-link-invalid-card"
            badgeIcon={Link2Off}
            title={copy.invalidTitle}
            subtitle={copy.invalidSubtitle}
          >
            <PortalButton
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              icon={ArrowRight}
              iconPosition="right"
              onClick={requestNewLink}
            >
              {copy.invalidAction}
            </PortalButton>
            {kind === 'activation' && onRequestNewLink && (
              <PortalButton
                type="button"
                variant="secondary"
                size="lg"
                fullWidth
                className="mt-3"
                onClick={onRequestNewLink}
              >
                Forgot Password?
              </PortalButton>
            )}
            {copy.invalidNote && <InfoMessage message={copy.invalidNote} />}
          </AuthCard>
        ) : !isDone ? (
          <AuthCard
            id="reset-password-card"
            badgeIcon={kind === 'activation' ? KeyRound : Lock}
            title={copy.formTitle}
            subtitle={copy.formSubtitle}
          >
            <form onSubmit={handleSubmit} className="w-full text-left">
              <PasswordInput
                id="new-password"
                label={copy.passwordLabel}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errorText || undefined}
                autoComplete="new-password"
                required
              />
              <PasswordInput
                id="confirm-password"
                label={copy.confirmLabel}
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />

              <PortalButton
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                icon={ArrowRight}
                iconPosition="right"
                className="mt-1"
              >
                {copy.submitLabel}
              </PortalButton>
            </form>

            <InfoMessage message={copy.note} />
          </AuthCard>
        ) : (
          <AuthCard
            id="reset-success-card"
            badgeIcon={Check}
            badgeCircle
            title={copy.doneTitle}
            subtitle={copy.doneSubtitle}
          >
            <PortalButton
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              icon={ArrowRight}
              iconPosition="right"
              onClick={onBackToLogin}
            >
              {copy.doneAction}
            </PortalButton>
          </AuthCard>
        )}
      </div>
    </AuthScreen>
  );
};
