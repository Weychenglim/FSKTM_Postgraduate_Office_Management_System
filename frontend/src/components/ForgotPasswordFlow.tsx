/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, ChevronLeft, Info, Lock, Mail, RotateCw, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authApi } from '../services';
import { authenticationErrorMessage } from '../utils/authErrorMessage';
import { AuthLayout } from './AuthLayout';
import { FormInput } from './FormInput';
import { PortalButton } from './PortalPrimitives';

// ==================== SHARED ACCOUNT-SCREEN PIECES ====================
// The forgot and reset screens use the sign-in screen's layout, card, fields
// and buttons, so every account screen looks the same.

/** The sign-in layout with a column for the back link and the card. */
export const AuthScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthLayout>
    <div className="w-full max-w-[490px] flex flex-col">{children}</div>
  </AuthLayout>
);

interface BackLinkProps {
  onClick: () => void;
  label?: string;
}

export const BackLink: React.FC<BackLinkProps> = ({ onClick, label = 'Back to Sign In' }) => (
  <button type="button" onClick={onClick} className="back-link group self-start py-2 -my-2">
    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
    <span>{label}</span>
  </button>
);

interface AuthCardProps {
  id?: string;
  badgeIcon?: React.ComponentType<{ className?: string }>;
  /** A round green badge for a finished step, instead of the navy badge. */
  badgeCircle?: boolean;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

/** The same white card, badge and heading as the sign-in card. */
export const AuthCard: React.FC<AuthCardProps> = ({
  id = 'auth-card',
  badgeIcon: BadgeIcon,
  badgeCircle = false,
  title,
  subtitle,
  children,
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.97 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.45 }}
    id={id}
    className={`w-full bg-white rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.08)] border border-slate-100 px-5 pt-8 pb-7 sm:p-8 md:p-10 text-center relative flex flex-col items-center ${BadgeIcon && !badgeCircle ? 'mt-8' : ''}`}
  >
    {BadgeIcon && (
      <div
        className={
          badgeCircle
            ? 'w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-6'
            : 'w-14 h-14 bg-[#0c1424] rounded-2xl flex items-center justify-center shadow-lg shadow-[#0c1424]/20 -mt-[64px] mb-6 border border-white/10'
        }
      >
        <BadgeIcon className={badgeCircle ? 'w-6 h-6' : 'w-5 h-5 text-indigo-300'} />
      </div>
    )}
    <div className="w-full flex flex-col">
      <h2 className="text-2xl sm:text-[28px] font-extrabold text-[#0c1424] tracking-tight">{title}</h2>
      {subtitle && <div className="text-slate-500 text-sm mt-1 mb-6 font-medium leading-relaxed">{subtitle}</div>}
      {children}
    </div>
  </motion.div>
);

export const InfoMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="w-full text-left p-4 bg-slate-50 border border-slate-100 rounded-xl flex gap-3 items-start mt-6">
    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">{message}</p>
  </div>
);

// ==================== FORGOT PASSWORD ====================

interface ForgotPasswordFlowProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordFlow: React.FC<ForgotPasswordFlowProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [resendStatus, setResendStatus] = useState('');

  const handlePostRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    if (!email) {
      setErrorText('Please enter your institutional email address.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setErrorText('Please enter a valid official email format (e.g. name@um.edu.my).');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      setIsSubmitted(true);
    } catch (err) {
      setErrorText(authenticationErrorMessage(
        err,
        'Cannot reach the server. Please try again shortly.',
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    setErrorText('');
    setResendStatus('');
    try {
      await authApi.requestPasswordReset(email.trim());
      setResendStatus('If that address is registered, a new reset link has been sent.');
    } catch (err) {
      setErrorText(authenticationErrorMessage(
        err,
        'Cannot reach the server. Please try again shortly.',
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const openMailClient = () => {
    window.location.href = `mailto:${email}`;
  };

  return (
    <AuthScreen>
      <BackLink onClick={onBackToLogin} />

      <div className="mt-10">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="forgot-password"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <AuthCard
                id="forgot-password-card"
                badgeIcon={Lock}
                title="Forgot Password"
                subtitle="Enter your registered email address and we will send you a password reset link."
              >
                <form onSubmit={handlePostRequest} className="w-full text-left">
                  <FormInput
                    id="forgot-email"
                    label="Email Address"
                    type="email"
                    icon={Mail}
                    placeholder="your.email@um.edu.my"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={errorText || undefined}
                    autoComplete="email"
                    required
                  />

                  <PortalButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    isLoading={isLoading}
                    icon={Send}
                    iconPosition="right"
                    className="mt-1"
                  >
                    Send Reset Link
                  </PortalButton>
                </form>

                <InfoMessage message="If you do not receive an email within 5 minutes, please check your spam folder or contact your Office Staff directly." />
              </AuthCard>
            </motion.div>
          ) : (
            <motion.div
              key="reset-email-sent"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <AuthCard
                id="success-state-card"
                badgeIcon={Check}
                badgeCircle
                title="Check Your Email"
                subtitle={
                  <>
                    If{' '}
                    <strong className="text-slate-900 font-extrabold break-all">{email || 'your.email@um.edu.my'}</strong>{' '}
                    is registered, a password reset link has been sent to it. The link expires in 30 minutes.
                  </>
                }
              >
                <div className="w-full flex flex-col gap-3">
                  <PortalButton type="button" variant="primary" size="lg" fullWidth icon={Mail} onClick={openMailClient}>
                    Open Email App
                  </PortalButton>
                  <PortalButton
                    type="button"
                    variant="secondary"
                    size="lg"
                    fullWidth
                    icon={RotateCw}
                    isLoading={isLoading}
                    onClick={handleResend}
                  >
                    Resend Reset Link
                  </PortalButton>
                </div>

                {(errorText || resendStatus) && (
                  <p
                    role={errorText ? 'alert' : 'status'}
                    className={`mt-4 text-xs font-semibold leading-relaxed ${errorText ? 'text-rose-600' : 'text-emerald-700'}`}
                  >
                    {errorText || resendStatus}
                  </p>
                )}

                <InfoMessage message="Didn't receive the email? Check your spam folder or try resending after a few minutes." />
              </AuthCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthScreen>
  );
};
