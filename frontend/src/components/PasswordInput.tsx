/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  onForgotPasswordClick?: () => void;
  error?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  label,
  onForgotPasswordClick,
  error,
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const toggleVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div id={`wrapper-${id}`} className="w-full flex flex-col text-left mb-5">
      <div className="flex justify-between items-start">
        <label id={`label-${id}`} htmlFor={id} className="form-label block">
          {label}
        </label>
        {onForgotPasswordClick && (
          <button
            type="button"
            onClick={onForgotPasswordClick}
            className="back-link transition-colors py-2 -my-2"
          >
            Forgot Password?
          </button>
        )}
      </div>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
          <KeyRound className="w-4 h-4" />
        </div>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          className={`form-control form-control-md ${error ? 'form-control-error' : ''} pl-11 pr-11 ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={toggleVisibility}
          className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title={showPassword ? "Hide password" : "Show password"}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && (
        <span id={`err-msg-${id}`} className="card-description text-red-500 mt-1.5 flex items-center gap-1">
          {error}
        </span>
      )}
    </div>
  );
};
