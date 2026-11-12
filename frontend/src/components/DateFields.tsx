/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  addDays,
  addMonths,
  clampDate,
  dateLabel,
  inRange,
  isoDate,
  longDateLabel,
  monthGrid,
  monthTitle,
  parseDate,
  parseTime,
  timeOptions,
  todayInMalaysia,
  WEEKDAYS,
  weekBounds,
} from '../utils/dateFields';
import { SelectMenu } from './SelectMenu';

const GAP = 6;
const MARGIN = 8;
const PANEL_WIDTH = 304;
const PANEL_HEIGHT = 380;

type AriaProps = {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
};

interface DateFieldProps extends AriaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  /** Adds a Clear button, for optional dates and filters. */
  clearable?: boolean;
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * A date picker in the portal's own style, in place of the browser's date
 * input. Same "YYYY-MM-DD" value. The calendar is portalled like SelectMenu's
 * list so scrolling dialogs cannot clip it.
 */
export const DateField: React.FC<DateFieldProps> = ({
  id,
  value,
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  clearable = false,
  placeholder = 'Choose a date',
  size = 'md',
  className = '',
  ...aria
}) => {
  const reducedMotion = useReducedMotion();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState('');
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [openUp, setOpenUp] = useState(false);
  const today = todayInMalaysia();
  const chosen = parseDate(value) ? value : '';

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight || PANEL_HEIGHT;
    const below = window.innerHeight - rect.bottom - GAP - MARGIN;
    const above = rect.top - GAP - MARGIN;
    const up = below < height && above > below;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - MARGIN * 2);
    const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - MARGIN - width));
    setOpenUp(up);
    setStyle({ left, width, ...(up ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const update = (event: Event) => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      place();
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    panelRef.current?.querySelector<HTMLElement>(`[data-day="${focused}"]`)?.focus({ preventScroll: true });
  }, [open, focused]);

  const openPanel = () => {
    setFocused(chosen || clampDate(today, min, max));
    moveFocus.current = true;
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (day: string) => {
    if (!inRange(day, min, max)) return;
    close();
    if (day !== value) onChange(day);
  };

  const onGridKey = (event: React.KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => weekBounds(focused)[0],
      End: () => weekBounds(focused)[1],
      PageUp: () => addMonths(focused, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, event.shiftKey ? 12 : 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveFocus.current = true;
    setFocused(move());
  };

  const onPanelKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // The portalled calendar stays inside a surrounding dialog in React's event tree.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      const stops = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []).filter(element => element.tabIndex >= 0);
      if (!stops.length) return;
      event.preventDefault();
      const index = stops.indexOf(document.activeElement as HTMLElement);
      stops[(index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
    }
  };

  const shown = parseDate(focused);
  const firstOfMonth = shown ? isoDate(shown.year, shown.month, 1) : '';
  const canGoBack = !min || !firstOfMonth || addDays(firstOfMonth, -1) >= min;
  const canGoOn = !max || !firstOfMonth || addMonths(firstOfMonth, 1) <= max;
  const todayAllowed = inRange(today, min, max);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        aria-describedby={aria['aria-describedby']}
        aria-invalid={aria['aria-invalid']}
        disabled={disabled}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            openPanel();
          }
        }}
        className={`form-control ${size === 'sm' ? 'form-control-sm' : 'form-control-md'} flex items-center justify-between gap-3 text-left normal-case tracking-normal cursor-pointer outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${open ? 'ring-1 ring-brand-navy border-brand-navy' : ''} ${className}`}
      >
        {chosen
          ? <span className="truncate font-bold text-slate-800">{dateLabel(chosen)}</span>
          : <span className="truncate font-semibold text-slate-400">{placeholder}</span>}
        <CalendarDays aria-hidden="true" className={`h-4 w-4 shrink-0 ${open ? 'text-brand-navy' : 'text-slate-400'}`} />
      </button>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={chosen}
          onChange={() => undefined}
          onFocus={() => triggerRef.current?.focus()}
          className="sr-only"
        />
      )}

      {open && createPortal(
        <motion.div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Choose a date"
          initial={{ opacity: 0, y: openUp ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.12 }}
          style={style}
          onKeyDown={onPanelKey}
          className="portal-select-menu fixed z-[10020] rounded-xl border border-slate-200/90 bg-white p-3 font-sans text-left normal-case tracking-normal shadow-[0_8px_28px_-6px_rgba(15,23,42,0.18),0_2px_6px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canGoBack}
              onClick={() => setFocused(current => clampDate(addMonths(current, -1), min, max))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <p aria-live="polite" className="text-[13px] font-extrabold text-brand-navy">{monthTitle(focused)}</p>
            <button
              type="button"
              aria-label="Next month"
              disabled={!canGoOn}
              onClick={() => setFocused(current => clampDate(addMonths(current, 1), min, max))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 pb-1">
            {WEEKDAYS.map(day => (
              <span key={day} aria-hidden="true" className="py-1 text-center text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{day}</span>
            ))}
          </div>
          <div role="group" aria-label={monthTitle(focused)} onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
            {monthGrid(focused).map(cell => {
              const selected = cell.iso === chosen;
              const allowed = inRange(cell.iso, min, max);
              const isToday = cell.iso === today;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  data-day={cell.iso}
                  tabIndex={cell.iso === focused ? 0 : -1}
                  aria-label={`${longDateLabel(cell.iso)}${isToday ? ', today' : ''}`}
                  aria-pressed={selected}
                  aria-disabled={!allowed || undefined}
                  onClick={() => choose(cell.iso)}
                  className={`h-9 rounded-lg text-[12.5px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                    selected
                      ? 'bg-brand-navy font-extrabold text-white cursor-pointer'
                      : !allowed
                        ? 'cursor-not-allowed text-slate-300'
                        : `cursor-pointer hover:bg-slate-100 ${isToday ? 'font-extrabold text-indigo-700 ring-1 ring-inset ring-indigo-200' : cell.inMonth ? 'font-semibold text-slate-700' : 'font-medium text-slate-400'}`
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          {(todayAllowed || (clearable && chosen)) && (
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              {todayAllowed ? (
                <button type="button" onClick={() => choose(today)} className="rounded-lg px-2 py-1.5 text-[12px] font-bold text-blue-700 transition hover:bg-blue-50 cursor-pointer">Today</button>
              ) : <span />}
              {clearable && chosen && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onChange('');
                  }}
                  className="rounded-lg px-2 py-1.5 text-[12px] font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </motion.div>,
        triggerRef.current?.closest('dialog[open]') ?? document.body,
      )}
    </>
  );
};

interface TimeFieldProps extends AriaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Minutes between choices. 11:59 PM is always offered for end-of-day deadlines. */
  step?: number;
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** A time picker in the portal's dropdown style. Same "HH:MM" value as the browser's time input. */
export const TimeField: React.FC<TimeFieldProps> = ({ value, step = 15, placeholder = 'Choose a time', ...props }) => {
  const time = parseTime(value);
  const current = time ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : '';
  return <SelectMenu {...props} value={current} options={timeOptions(step, current)} placeholder={placeholder} icon={Clock} />;
};

const splitDateTime = (value: string): [string, string] => {
  const [date = '', time = ''] = (value || '').split('T');
  return [date, time.slice(0, 5)];
};

/** A date and a time side by side, for "YYYY-MM-DDTHH:MM" values (the browser's datetime-local). */
export const DateTimeField: React.FC<{
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  disabled?: boolean;
  clearable?: boolean;
  invalid?: boolean;
  label: string;
}> = ({ id, value, onChange, min, disabled = false, clearable = false, invalid = false, label }) => {
  const [parts, setParts] = useState<[string, string]>(() => splitDateTime(value));
  const sent = useRef(value);

  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setParts(splitDateTime(value));
    }
  }, [value]);

  const update = (date: string, time: string) => {
    setParts([date, time]);
    const next = date && time ? `${date}T${time}` : '';
    sent.current = next;
    onChange(next);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
      <DateField
        id={id}
        value={parts[0]}
        min={min}
        disabled={disabled}
        clearable={clearable}
        aria-label={`${label}, date`}
        aria-invalid={invalid || undefined}
        className={invalid ? 'form-control-error' : ''}
        onChange={date => update(date, date ? parts[1] : '')}
      />
      <TimeField
        value={parts[1]}
        disabled={disabled || !parts[0]}
        aria-label={`${label}, time`}
        aria-invalid={invalid || undefined}
        className={invalid ? 'form-control-error' : ''}
        onChange={time => update(parts[0], time)}
      />
    </div>
  );
};
