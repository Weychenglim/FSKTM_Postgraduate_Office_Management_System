import { PortalModal, useModalTitle } from './PortalModal';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Lock,
  User,
  Server,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { FormInput } from './FormInput';
import { PasswordInput } from './PasswordInput';
import { ActionButton } from './ActionButton';
import { AlertMessage } from './AlertMessage';
import { DEMO_LOGIN_CONFIG, type DemoRoleKey } from '../config/demoLogin';
import type { DemoUser } from '../types';
import { authApi, ApiError } from '../services';
import { authenticationErrorMessage } from '../utils/authErrorMessage';
import { LETTERHEAD } from '../utils/letterDocument';

interface LoginCardProps {
  onForgotPasswordClick?: () => void;
  onLoginSuccess?: (user: DemoUser) => void;
  notice?: string | null;
}

export const LoginCard: React.FC<LoginCardProps> = ({ onForgotPasswordClick, onLoginSuccess, notice }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  // Off by default, so a shared computer does not stay signed in.
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ id?: string; pass?: string }>({});
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(
    notice ? { type: 'info', message: notice } : null,
  );

  const helpTitle = useModalTitle();
  const [activeModal, setActiveModal] = useState<'forgot' | 'helpdesk' | 'manual' | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);

    const currentErrors: { id?: string; pass?: string } = {};
    if (!identifier.trim()) {
      currentErrors.id = 'Please enter your Email or Student/Staff ID.';
    }
    if (!password) {
      currentErrors.pass = 'Password cannot be blank.';
    }
    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      setAlert({ type: 'error', message: 'Credentials verification failed. Please correct the fields.' });
      return;
    }

    setIsLoading(true);
    try {
      const { user } = await authApi.login(identifier.trim(), password, rememberMe);
      setAlert({ type: 'success', message: `Authorization approved. Welcome, ${user.fullName}.` });
      onLoginSuccess?.(user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAlert({ type: 'error', message: 'Invalid credentials. Please check your Email / Staff / Student ID and password.' });
      } else {
        setAlert({
          type: 'error',
          message: authenticationErrorMessage(
            err,
            'Cannot reach the server. Please check your connection and try again.',
          ),
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoPrefill = (roleKey: DemoRoleKey) => {
    const creds = DEMO_LOGIN_CONFIG?.[roleKey];
    if (!creds) return;

    setIdentifier(creds.email);
    setPassword(creds.password);
    setErrors({});
    setAlert({
      type: 'info',
      message: `Loaded credentials for "${creds.user.role}". Click Sign In to continue.`,
    });
  };

  return (
    <div id="login-layout-card-container" className="w-full max-w-[490px] flex flex-col gap-6 items-center">

      {/* Elevated white Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        id="login-main-card"
        className="w-full bg-white rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.08)] border border-slate-100 px-5 pt-8 pb-7 sm:p-8 md:p-10 text-center relative flex flex-col items-center"
      >
        {/* Padlock badge */}
        <div
          id="padlock-badge"
          className="w-14 h-14 bg-[#0c1424] rounded-2xl flex items-center justify-center shadow-lg shadow-[#0c1424]/20 -mt-[64px] mb-6 border border-white/10 group hover:scale-105 transition-transform duration-200"
        >
          <Lock id="badge-lock-icon" className="w-5 h-5 text-indigo-300" />
        </div>

        <div className="w-full flex flex-col">
          <h2 id="sign-in-header" className="page-title font-sans">
            Sign In
          </h2>
          <p id="sign-in-subtext" className="page-subtitle mt-1 mb-6">
            Authenticate to access your workspace.
          </p>

          {alert && (
            <div className="mb-5">
              <AlertMessage
                type={alert.type}
                message={alert.message}
                onClose={() => setAlert(null)}
              />
            </div>
          )}

          <form id="submission-form" onSubmit={handleLoginSubmit} className="w-full flex flex-col">
            <FormInput
              id="email-or-username"
              label="Email or Staff / Student ID"
              icon={User}
              placeholder="Student/staff ID or UM email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              error={errors.id}
              autoComplete="username"
              required
            />

            <PasswordInput
              id="user-password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onForgotPasswordClick={onForgotPasswordClick || (() => setActiveModal('forgot'))}
              error={errors.pass}
              autoComplete="current-password"
              required
            />

            <label htmlFor="remember-me" className="flex items-center gap-3 w-fit py-2 mb-4 -mt-2 cursor-pointer select-none group">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-5 h-5 shrink-0 accent-blue-600 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                Remember me on this device
              </span>
            </label>

            <ActionButton id="login-action-btn" type="submit" isLoading={isLoading} className="mt-1">
              Sign In
            </ActionButton>
          </form>

          <div id="card-divider" className="relative flex items-center justify-center my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <span className="relative px-3 bg-white text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase select-none">
              Need Help?
            </span>
          </div>

          <p id="helpdesk-block" className="card-description px-2">
            For technical assistance, please contact the{' '}
            <button
              type="button"
              onClick={() => setActiveModal('helpdesk')}
              className="text-blue-600 font-bold hover:underline cursor-pointer py-2 -my-2"
            >
              IT Helpdesk
            </button>{' '}
            or consult the{' '}
            <button
              type="button"
              onClick={() => setActiveModal('manual')}
              className="text-blue-600 font-bold hover:underline cursor-pointer py-2 -my-2"
            >
              Student Manual
            </button>.
          </p>
        </div>

        {/* Absolute modal overlays */}
        <PortalModal isOpen={activeModal !== null} onClose={() => setActiveModal(null)} labelledBy={helpTitle} className="max-w-md p-8">
              {activeModal === 'forgot' && (
                <div className="w-full flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6 text-orange-500" />
                  </div>
                  <h4 id={helpTitle} className="section-heading">Password Recovery</h4>
                  <p className="card-description mt-2">
                    To maintain FSKTM administration guidelines, please contact the postgraduate office desk with your registered Staff ID / Student Matric card to request password resets.
                  </p>
                  <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-left w-full card-description">
                    <span className="card-label text-slate-400 block">Office Email:</span>
                    <span className="card-value text-slate-800 block mb-1.5">postgrad.fsktm@edu.my</span>
                    <span className="card-label text-slate-400 block">Support Line:</span>
                    <span className="card-value text-slate-800 block">+603-7967 6316</span>
                  </div>
                </div>
              )}

              {activeModal === 'helpdesk' && (
                <div className="w-full flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#e0f2fe] flex items-center justify-center mb-4">
                    <Server className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 id={helpTitle} className="section-heading">IT Helpdesk Contact</h4>
                  <p className="card-description mt-2">
                    The FSKTM Tech Support is cataloged to assist with student and staff account provisioning, single sign-on issues, and database interruptions.
                  </p>
                  <div className="mt-5 text-left w-full space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-[11px]">
                    <div className="flex justify-between"><span className="card-label">Operation:</span><span className="card-value">Mon to Fri (8AM to 5PM)</span></div>
                    <div className="flex justify-between"><span className="card-label">Service Counter:</span><span className="card-value">Block A, Level 2 Lab Office</span></div>
                    <div className="flex justify-between"><span className="card-label">IP Ext:</span><span className="card-value font-mono text-blue-600">ext-4902</span></div>
                  </div>
                </div>
              )}

              {activeModal === 'manual' && (
                <div className="w-full flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                    <Calendar className="w-6 h-6 text-indigo-500" />
                  </div>
                  <h4 id={helpTitle} className="section-heading">Student Manual</h4>
                  <p className="card-description mt-2">
                    The postgraduate manual covers procedures, thesis defence requirements, registration steps and grading. It is not published in the portal yet; ask the PG Office for the current copy.
                  </p>
                  <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-left w-full text-[11px]">
                    <span className="text-slate-400 font-medium block">PG Office:</span>
                    <span className="text-slate-800 font-bold block">{LETTERHEAD.addressLines[2]}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="mt-6 text-xs text-slate-500 font-bold hover:text-slate-800 transition cursor-pointer"
              >
                Close Guidance Window
              </button>
        </PortalModal>
      </motion.div>

      {/* Interactive demo prefiller console */}
      {DEMO_LOGIN_CONFIG && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          id="dev-demo-console"
          className="w-full bg-[#0c1424]/90 border border-[#1a2c54]/30 p-5 rounded-2xl text-left shadow-lg backdrop-blur-sm"
        >
        <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest block mb-2.5">
          🔑 Portal Testing Console (Interactive prefiller)
        </span>
        <p className="card-description text-slate-400 mb-3">
          Select a role to instantly populate the correct institutional credentials:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleDemoPrefill('student')}
            className={`px-3 py-2 text-left rounded-lg transition-all border text-xs cursor-pointer ${
              identifier === DEMO_LOGIN_CONFIG.student.email
                ? 'bg-indigo-950 text-indigo-200 border-indigo-500 ring-1 ring-indigo-500'
                : 'bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]'
            }`}
          >
            <span className="font-bold block text-[10px] text-indigo-300">1. Student</span>
            <span className="text-[9px] text-slate-400 block font-mono">
              {DEMO_LOGIN_CONFIG.student.displayIdentifier}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleDemoPrefill('lecturer')}
            className={`px-3 py-2 text-left rounded-lg transition-all border text-xs cursor-pointer ${
              identifier === DEMO_LOGIN_CONFIG.lecturer.email
                ? 'bg-indigo-950 text-indigo-200 border-indigo-500 ring-1 ring-indigo-500'
                : 'bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]'
            }`}
          >
            <span className="font-bold block text-[10px] text-indigo-300">2. Lecturer</span>
            <span className="text-[9px] text-slate-400 block font-mono">
              {DEMO_LOGIN_CONFIG.lecturer.displayIdentifier}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleDemoPrefill('admin')}
            className={`px-3 py-2 text-left rounded-lg transition-all border text-xs cursor-pointer ${
              identifier === DEMO_LOGIN_CONFIG.admin.email
                ? 'bg-indigo-950 text-indigo-200 border-indigo-500 ring-1 ring-indigo-500'
                : 'bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]'
            }`}
          >
            <span className="font-bold block text-[10px] text-indigo-300">3. Office Staff</span>
            <span className="text-[9px] text-slate-400 block font-mono">
              {DEMO_LOGIN_CONFIG.admin.displayIdentifier}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleDemoPrefill('coordinator')}
            className={`px-3 py-2 text-left rounded-lg transition-all border text-xs cursor-pointer ${
              identifier === DEMO_LOGIN_CONFIG.coordinator.email
                ? 'bg-indigo-950 text-indigo-200 border-indigo-500 ring-1 ring-indigo-500'
                : 'bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]'
            }`}
          >
            <span className="font-bold block text-[10px] text-indigo-300">4. Coordinator</span>
            <span className="text-[9px] text-slate-400 block font-mono">
              {DEMO_LOGIN_CONFIG.coordinator.displayIdentifier}
            </span>
          </button>
        </div>
        </motion.div>
      )}
    </div>
  );
};
