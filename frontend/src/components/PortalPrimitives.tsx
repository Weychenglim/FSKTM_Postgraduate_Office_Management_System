/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, Info, Loader2, LucideIcon, X } from 'lucide-react';
import { PortalModal, useModalTitle } from './PortalModal';

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'dangerSolid' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface PortalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  isLoading?: boolean;
}

export const PortalButton: React.FC<PortalButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const variantClass: Record<ButtonVariant, string> = {
    primary: 'bg-brand-navy text-white border border-brand-navy hover:bg-brand-navy-hover shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-brand-navy shadow-3xs',
    soft: 'bg-blue-50 text-blue-700 border border-blue-150 hover:bg-blue-100 shadow-3xs',
    danger: 'bg-rose-50 text-rose-700 border border-rose-150 hover:bg-rose-100 shadow-3xs',
    dangerSolid: 'bg-rose-600 text-white border border-rose-600 hover:bg-rose-700 shadow-sm',
    ghost: 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-brand-navy',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-150 hover:bg-emerald-100 shadow-3xs'
  };

  const sizeClass: Record<ButtonSize, string> = {
    sm: 'px-3 py-2 text-[10px] rounded-lg',
    md: 'px-4 py-2.5 text-[11px] rounded-xl',
    lg: 'px-5 py-3 text-xs rounded-xl',
    icon: 'w-10 h-10 text-[0px] rounded-xl'
  };

  const iconNode = isLoading ? (
    <Loader2 className="w-4 h-4 animate-spin" />
  ) : Icon ? (
    <Icon className={joinClasses(size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4', 'shrink-0')} />
  ) : null;

  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={joinClasses(
        'inline-flex items-center justify-center gap-2 font-extrabold uppercase tracking-wider transition-all duration-200 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
        variantClass[variant],
        sizeClass[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {iconPosition === 'left' && iconNode}
      {children && <span>{children}</span>}
      {iconPosition === 'right' && iconNode}
    </button>
  );
};

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface PortalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  hover?: boolean;
}

export const PortalCard: React.FC<PortalCardProps> = ({
  children,
  padding = 'md',
  hover = false,
  className = '',
  ...props
}) => {
  const paddingClass: Record<CardPadding, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-5 md:p-6',
    lg: 'p-6 md:p-8'
  };

  return (
    <div
      className={joinClasses(
        'bg-white rounded-2xl border border-slate-200/80 shadow-3xs text-left',
        paddingClass[padding],
        hover && 'hover:border-slate-300 hover:shadow-sm transition-all',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

interface PageHeaderProps {
  title: string;
  titleAside?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  backLabel?: string;
  backDisabled?: boolean;
  onBack?: () => void;
  className?: string;
  subtitleClassName?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  titleAside,
  subtitle,
  actions,
  backLabel,
  backDisabled = false,
  onBack,
  className = '',
  subtitleClassName = ''
}) => (
  <div className={joinClasses('flex flex-col md:flex-row md:items-start md:justify-between gap-4 text-left', className)}>
    <div>
      {onBack && backLabel && (
        <button type="button" onClick={onBack} disabled={backDisabled} className="back-link group mb-3 disabled:opacity-50">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>{backLabel}</span>
        </button>
      )}
      {titleAside ? <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="page-title focus:outline-none" tabIndex={-1}>{title}</h1>
        {titleAside}
      </div> : <h1 className="page-title focus:outline-none" tabIndex={-1}>{title}</h1>}
      {subtitle && <p className={joinClasses('page-subtitle', subtitleClassName)}>{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
  </div>
);

export type BadgeTone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  icon?: LucideIcon;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  children,
  tone = 'neutral',
  icon: Icon,
  dot = false,
  pulse = false,
  className = ''
}) => {
  const toneClass: Record<BadgeTone, { wrapper: string; dot: string }> = {
    brand: { wrapper: 'bg-indigo-50 text-brand-navy border-indigo-100', dot: 'bg-indigo-500' },
    info: { wrapper: 'bg-blue-50 text-blue-700 border-blue-150', dot: 'bg-blue-500' },
    success: { wrapper: 'bg-emerald-50 text-emerald-700 border-emerald-150', dot: 'bg-emerald-500' },
    warning: { wrapper: 'bg-amber-50 text-amber-800 border-amber-150', dot: 'bg-amber-500' },
    danger: { wrapper: 'bg-rose-50 text-rose-700 border-rose-150', dot: 'bg-rose-500' },
    neutral: { wrapper: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
  };

  return (
    <span className={joinClasses(
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider select-none',
      toneClass[tone].wrapper,
      className
    )}>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {dot && <span className={joinClasses('w-1.5 h-1.5 rounded-full shrink-0', toneClass[tone].dot, pulse && 'animate-pulse')} />}
      <span>{children}</span>
    </span>
  );
};

export const getStatusBadgeTone = (status: string): BadgeTone => {
  const normalized = status.trim().toLowerCase();
  if (['approved', 'active', 'available', 'submitted', 'completed', 'done', 'ready', 'published', 'open'].includes(normalized)) {
    return 'success';
  }
  if (['pending', 'pending review', 'pending approval', 'draft', 'draft saved', 'near limit', 'returned'].includes(normalized)) {
    return 'warning';
  }
  if (['no supervisor', 'no panel', 'rejected', 'overdue', 'urgent', 'critical', 'full load', 'full', 'suspended'].includes(normalized)) {
    return 'danger';
  }
  if (['info', 'generated', 'scheduled', 'upcoming', 'recommendation', 'workload alert', 'in progress'].includes(normalized)) {
    return 'info';
  }
  return 'neutral';
};

interface StatusDotProps {
  tone?: BadgeTone;
  pulse?: boolean;
  className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({ tone = 'neutral', pulse = false, className = '' }) => {
  const dotClass: Record<BadgeTone, string> = {
    brand: 'bg-indigo-500',
    info: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    neutral: 'bg-slate-400'
  };

  return (
    <span
      className={joinClasses('inline-block w-1.5 h-1.5 rounded-full shrink-0', dotClass[tone], pulse && 'animate-pulse', className)}
      aria-hidden="true"
    />
  );
};

interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: BadgeTone;
  className?: string;
  trackClassName?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  tone = 'brand',
  className = '',
  trackClassName = ''
}) => {
  const fillClass: Record<BadgeTone, string> = {
    brand: 'bg-brand-navy',
    info: 'bg-blue-600',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    neutral: 'bg-slate-500'
  };
  const percentage = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));

  return (
    <div className={joinClasses('w-full h-1.5 rounded-full overflow-hidden bg-slate-200', trackClassName)}>
      <div
        className={joinClasses('h-full rounded-full transition-all duration-300', fillClass[tone], className)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

interface SegmentedControlProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  className?: string;
  /** 'tabs' is the page-level look used by Supervisor Appointments. */
  variant?: 'segmented' | 'tabs';
}

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  labels = {},
  className = '',
  variant = 'segmented'
}: SegmentedControlProps<T>) => variant === 'tabs' ? (
  <div className={joinClasses('flex flex-wrap gap-2 border-b border-slate-200 pb-3', className)} role="tablist">
    {options.map((option) => {
      const selected = value === option;
      return (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={joinClasses(
            'card-value rounded-lg px-4 py-2.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy',
            selected ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-white'
          )}
          role="tab"
          aria-selected={selected}
        >
          {labels[option] ?? option}
        </button>
      );
    })}
  </div>
) : (
  <div className={joinClasses('bg-slate-100 p-1 rounded-xl flex items-center border border-slate-100', className)} role="tablist">
    {options.map((option) => {
      const selected = value === option;
      return (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={joinClasses(
            'px-4 py-1.5 rounded-lg text-[10px] font-extrabold tracking-wider uppercase transition-all cursor-pointer',
            selected ? 'bg-brand-navy text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
          )}
          role="tab"
          aria-selected={selected}
        >
          {labels[option] ?? option}
        </button>
      );
    })}
  </div>
);

interface RemovableTagProps {
  children: React.ReactNode;
  onRemove: () => void;
  tone?: BadgeTone;
  className?: string;
  removeLabel?: string;
}

export const RemovableTag: React.FC<RemovableTagProps> = ({
  children,
  onRemove,
  tone = 'brand',
  className = '',
  removeLabel = 'Remove tag'
}) => {
  const toneClass: Record<BadgeTone, string> = {
    brand: 'bg-brand-navy text-white border-brand-navy',
    info: 'bg-blue-50 text-blue-700 border-blue-150',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-150',
    warning: 'bg-amber-50 text-amber-800 border-amber-150',
    danger: 'bg-rose-50 text-rose-700 border-rose-150',
    neutral: 'bg-slate-50 text-slate-600 border-slate-200'
  };

  return (
    <span className={joinClasses('inline-flex items-center gap-1.5 border text-[10px] font-bold px-2.5 py-1.5 rounded-lg select-none', toneClass[tone], className)}>
      <span>{children}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-0.5 text-current opacity-75 transition hover:bg-white/20 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/30"
        aria-label={removeLabel}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
};

type ConfirmTone = 'danger' | 'warning' | 'info';

interface PortalConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: LucideIcon;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PortalConfirmModal: React.FC<PortalConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const titleId = useModalTitle();
  const messageId = useModalTitle();
  if (!isOpen) return null;

  const toneClass: Record<ConfirmTone, {
    iconWrap: string;
    icon: string;
    eyebrow: string;
    confirmVariant: ButtonVariant;
  }> = {
    danger: {
      iconWrap: 'bg-rose-50 border-rose-100',
      icon: 'text-rose-600',
      eyebrow: 'text-rose-600',
      confirmVariant: 'dangerSolid',
    },
    warning: {
      iconWrap: 'bg-amber-50 border-amber-100',
      icon: 'text-amber-600',
      eyebrow: 'text-amber-700',
      confirmVariant: 'primary',
    },
    info: {
      iconWrap: 'bg-blue-50 border-blue-100',
      icon: 'text-blue-600',
      eyebrow: 'text-blue-700',
      confirmVariant: 'primary',
    },
  };

  const toneConfig = toneClass[tone];
  const Icon = icon || AlertTriangle;

  return (
    <PortalModal isOpen={isOpen} onClose={onCancel} busy={isLoading} labelledBy={titleId} describedBy={messageId} className="max-w-md p-6">
      <div
        className="text-left"
      >
        <div className="flex items-start gap-4">
          <div className={joinClasses('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border', toneConfig.iconWrap)}>
            <Icon className={joinClasses('h-5 w-5 stroke-[2.4]', toneConfig.icon)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={joinClasses('text-[10px] font-black uppercase tracking-[0.2em]', toneConfig.eyebrow)}>
              Confirmation Required
            </p>
            <h2 id={titleId} className="section-heading mt-1 leading-tight">
              {title}
            </h2>
            <div id={messageId} className="card-description mt-3 text-slate-600">
              {message}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <PortalButton
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </PortalButton>
          <PortalButton
            variant={toneConfig.confirmVariant}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </PortalButton>
        </div>
      </div>
    </PortalModal>
  );
};

type ToastTone = 'info' | 'success' | 'warning' | 'danger';

interface PortalToastProps {
  message: string | null;
  tone?: ToastTone;
  className?: string;
  onClose?: () => void;
  /** Identifies a new delivery even when its message is unchanged. */
  eventId?: string | number;
  /** Explicit opt-in; legacy standalone feedback keeps its current lifetime. */
  durationMs?: number;
}

const PortalToastNotification: React.FC<PortalToastProps & { message: string }> = ({ message, tone = 'info', className = '', onClose, durationMs }) => {
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(durationMs);
  const close = useRef(onClose); close.current = onClose;

  useEffect(() => { remaining.current = durationMs; }, [durationMs]);
  useEffect(() => {
    if (dismissed || hovered || focused || remaining.current === undefined) return;
    const started = performance.now();
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setDismissed(true);
      close.current?.();
    }, remaining.current);
    return () => {
      active = false;
      window.clearTimeout(timer);
      remaining.current = Math.max(0, (remaining.current ?? 0) - (performance.now() - started));
    };
  }, [durationMs, dismissed, hovered, focused]);

  if (dismissed) return null;

  const toneConfig: Record<ToastTone, {
    border: string;
    iconBg: string;
    iconColor: string;
    icon: LucideIcon;
  }> = {
    info: {
      border: 'border-slate-200',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      icon: Info,
    },
    success: {
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      icon: CheckCircle2,
    },
    warning: {
      border: 'border-amber-200',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      icon: AlertTriangle,
    },
    danger: {
      border: 'border-rose-200',
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      icon: AlertCircle,
    }
  };

  const currentTone = toneConfig[tone] ?? toneConfig.info;
  const Icon = currentTone.icon;

  const handleDismiss = () => {
    setDismissed(true);
    onClose?.();
  };

  // Rendered through a portal into <body> so it is always anchored to the
  // viewport (never trapped by a transformed/clipping ancestor) and is placed
  // top-right below the sticky header while staying above every app layer.
  const node = (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-atomic="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
      className={joinClasses(
        'fixed top-20 right-4 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.10)] flex items-start gap-3 font-sans',
        currentTone.border,
        className
      )}
    >
      <div aria-hidden="true" className={joinClasses('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', currentTone.iconBg, currentTone.iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 py-1.5 text-left">
        <p className="card-description text-slate-800 [overflow-wrap:anywhere]">{message}</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
};

// Explicit event identity lets repeated text start a new dismissal/timer lifecycle.
export const PortalToast: React.FC<PortalToastProps> = (props) => props.message ? (
  <PortalToastNotification key={props.eventId ?? `${props.tone ?? 'info'}:${props.message}`} {...props} message={props.message} />
) : null;
