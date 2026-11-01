/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface AlertMessageProps {
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  id?: string;
  onClose?: () => void;
}

export const AlertMessage: React.FC<AlertMessageProps> = ({
  type,
  message,
  onClose, title, children, actions, className='', id
}) => {
  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div id={id}
      role={isError ? 'alert' : 'status'}
      className={`p-4 rounded-lg flex min-w-0 items-start gap-3 border ${
        isSuccess
          ? 'bg-emerald-50/90 text-emerald-800 border-emerald-100'
          : isError
          ? 'bg-rose-50/90 text-rose-800 border-rose-100'
          : type==='warning' ? 'bg-amber-50 text-amber-900 border-amber-200'
          : 'bg-blue-50 text-blue-900 border-blue-200'
      } ${className}`}
    >
      <div className="shrink-0 mt-0.5">
        {isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        ) : isError ? (
          <AlertCircle className="w-5 h-5 text-rose-500" />
        ) : type==='warning' ? <AlertTriangle aria-hidden="true" className="w-5 h-5 text-amber-700"/> : <Info aria-hidden="true" className="w-5 h-5 text-blue-700"/>}
      </div>
      <div className="min-w-0 flex-1 space-y-2 text-left text-sm leading-relaxed [overflow-wrap:anywhere]">
        {title?<p className="font-semibold leading-snug">{title}</p>:null}
        {typeof message==='string'?<p>{message}</p>:<div>{message}</div>}
        {children}
        {actions?<div className="flex flex-wrap items-center gap-3 pt-1">{actions}</div>:null}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss message"
          className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors -m-1.5 p-2 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
