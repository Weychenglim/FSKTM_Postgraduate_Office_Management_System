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
  fromClock,
  inRange,
  isoDate,
  longDateLabel,
  monthGrid,
  monthTitle,
  normalTime,
  parseDate,
  timeLabel,
  toClock,
  todayInMalaysia,
  typedNumber,
  WEEKDAYS,
  weekBounds,
} from '../utils/dateFields';

const GAP = 6;
const MARGIN = 8;
const PANEL_WIDTH = 304;
const PANEL_HEIGHT = 380;
const TIME_PANEL_WIDTH = 264;
const TIME_PANEL_HEIGHT = 352;
const WEEK_COLUMNS = { gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' };
const ROW = 40;
const LOOPS = 3;
const SETTLE_MS = 120;
const TYPING_MS = 1000;
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const MERIDIEM = [0, 1];
const QUICK_TIMES = ['09:00', '12:00', '17:00', '23:59'];
const START_TIME = '09:00';
const FADE = 'linear-gradient(to bottom, transparent 0%, #000 34%, #000 66%, transparent 100%)';
const PANEL_CLASS = 'portal-select-menu fixed z-[10020] rounded-xl border border-slate-200/90 bg-white p-3 font-sans text-left normal-case tracking-normal shadow-[0_8px_28px_-6px_rgba(15,23,42,0.18),0_2px_6px_rgba(15,23,42,0.04)]';
const FOOTER_BUTTON = 'rounded-lg px-2 py-1.5 transition cursor-pointer text-[11px] font-extrabold uppercase tracking-wider';

const mod = (value: number, size: number) => ((value % size) + size) % size;
const twoDigits = (value: number) => String(value).padStart(2, '0');

type AriaProps = {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
};

const triggerClass = (size: 'sm' | 'md', open: boolean, className: string) =>
  `form-control ${size === 'sm' ? 'form-control-sm' : 'form-control-md'} flex items-center justify-between gap-3 text-left normal-case tracking-normal cursor-pointer outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${open ? 'ring-1 ring-brand-navy border-brand-navy' : ''} ${className}`;

/** Keeps a portalled panel next to its trigger, above it when there is no room below, and closes it on a press outside. */
function useAnchoredPanel(
  open: boolean,
  setOpen: (open: boolean) => void,
  triggerRef: React.RefObject<HTMLButtonElement | null>,
  panelRef: React.RefObject<HTMLDivElement | null>,
  panelWidth: number,
  panelHeight: number,
) {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [openUp, setOpenUp] = useState(false);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight || panelHeight;
    const below = window.innerHeight - rect.bottom - GAP - MARGIN;
    const above = rect.top - GAP - MARGIN;
    const up = below < height && above > below;
    const width = Math.min(panelWidth, window.innerWidth - MARGIN * 2);
    const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - MARGIN - width));
    setOpenUp(up);
    setStyle({ left, width, ...(up ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }) });
  }, [triggerRef, panelRef, panelWidth, panelHeight]);

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
  }, [open, place, panelRef]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [open, setOpen, triggerRef, panelRef]);

  return { style, openUp };
}

/** Escape closes and Tab stays inside the panel. The portalled panel stays inside a surrounding dialog in React's event tree. */
function keepKeysInPanel(event: React.KeyboardEvent<HTMLDivElement>, close: () => void) {
  event.stopPropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
  } else if (event.key === 'Tab') {
    const stops = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [role="spinbutton"]')).filter(element => element.tabIndex >= 0);
    if (!stops.length) return;
    event.preventDefault();
    const index = stops.indexOf(document.activeElement as HTMLElement);
    stops[(index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
  }
}

const portalTarget = (trigger: HTMLElement | null) => trigger?.closest('dialog[open]') ?? document.body;

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
  const { style, openUp } = useAnchoredPanel(open, setOpen, triggerRef, panelRef, PANEL_WIDTH, PANEL_HEIGHT);
  const today = todayInMalaysia();
  const chosen = parseDate(value) ? value : '';

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
        data-value={chosen}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            openPanel();
          }
        }}
        className={triggerClass(size, open, className)}
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
          onKeyDown={event => keepKeysInPanel(event, close)}
          className={PANEL_CLASS}
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
          <div style={WEEK_COLUMNS} className="grid gap-0.5 pb-1">
            {WEEKDAYS.map(day => (
              <span key={day} aria-hidden="true" className="py-1 text-center text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{day}</span>
            ))}
          </div>
          <div role="group" aria-label={monthTitle(focused)} onKeyDown={onGridKey} style={WEEK_COLUMNS} className="grid gap-0.5">
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
                <button type="button" onClick={() => choose(today)} className={`${FOOTER_BUTTON} text-blue-700 hover:bg-blue-50`}>Today</button>
              ) : <span />}
              {clearable && chosen && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onChange('');
                  }}
                  className={`${FOOTER_BUTTON} text-slate-500 hover:bg-slate-100 hover:text-slate-700`}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </motion.div>,
        portalTarget(triggerRef.current),
      )}
    </>
  );
};

interface WheelProps {
  label: string;
  values: number[];
  show: (value: number) => string;
  value: number;
  loop?: boolean;
  /** Digits pick a value, e.g. "4" then "5" for 45. */
  typing?: boolean;
  /** How far PageUp and PageDown move. */
  page?: number;
  className?: string;
  textClass?: string;
  onPick: (value: number) => void;
  onTyped?: () => void;
  onMeridiem: (pm: boolean) => void;
  onEnter: () => void;
}

/**
 * One scrolling column of the time picker, like a phone's wheel. The rows are
 * repeated three times for the looping columns, and the wheel is moved back to
 * the middle copy whenever it comes to rest, so it never runs out.
 */
function Wheel({ label, values, show, value, loop = false, typing = true, page, className = '', textClass = 'text-[24px]', onPick, onTyped, onMeridiem, onEnter }: WheelProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const count = values.length;
  const middle = loop ? count : 0;
  const index = Math.max(0, values.indexOf(value));
  const [offset, setOffset] = useState(middle + index);
  const resting = useRef(-1);
  const heading = useRef<number | null>(null);
  const settleTimer = useRef(0);
  const frame = useRef(0);
  const typed = useRef({ text: '', at: 0 });
  const rows = Array.from({ length: loop ? count * LOOPS : count }, (_, row) => row);

  useLayoutEffect(() => {
    const wheel = ref.current;
    if (!wheel || resting.current === index) return;
    if (resting.current < 0) {
      wheel.scrollTop = (middle + index) * ROW;
      setOffset(middle + index);
      resting.current = index;
      return;
    }
    resting.current = index;
    const here = Math.round(wheel.scrollTop / ROW);
    let target = middle + index;
    if (loop) {
      const start = here - mod(here, count);
      target = [start - count + index, start + index, start + count + index]
        .filter(row => row >= 0 && row < count * LOOPS)
        .reduce((best, row) => (Math.abs(row - here) < Math.abs(best - here) ? row : best));
    }
    heading.current = target;
    wheel.scrollTo({ top: target * ROW, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [index, count, loop, middle, reducedMotion]);

  useEffect(() => () => {
    window.clearTimeout(settleTimer.current);
    cancelAnimationFrame(frame.current);
  }, []);

  const settle = () => {
    const wheel = ref.current;
    if (!wheel) return;
    const row = Math.round(wheel.scrollTop / ROW);
    if (heading.current !== null) {
      if (row !== heading.current) {
        settleTimer.current = window.setTimeout(settle, SETTLE_MS);
        return;
      }
      heading.current = null;
    }
    const landed = mod(row, count);
    if (loop && (row < count || row >= count * 2)) {
      wheel.scrollTop = (count + landed) * ROW;
      setOffset(count + landed);
    }
    if (landed !== resting.current) {
      resting.current = landed;
      onPick(values[landed]);
    }
  };

  const onScroll = () => {
    const wheel = ref.current;
    if (!wheel) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setOffset(wheel.scrollTop / ROW));
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, SETTLE_MS);
  };

  const userMoves = () => {
    heading.current = null;
  };

  const chooseRow = (row: number) => {
    const wheel = ref.current;
    const landed = mod(row, count);
    resting.current = landed;
    heading.current = row;
    wheel?.scrollTo({ top: row * ROW, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (values[landed] !== value) onPick(values[landed]);
  };

  const moveBy = (steps: number) => {
    const next = loop ? mod(index + steps, count) : Math.max(0, Math.min(count - 1, index + steps));
    if (next !== index) onPick(values[next]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    const moves: Record<string, () => void> = {
      ArrowUp: () => moveBy(1),
      ArrowDown: () => moveBy(-1),
      Home: () => onPick(values[0]),
      End: () => onPick(values[count - 1]),
      Enter: onEnter,
      ...(page ? { PageUp: () => moveBy(page), PageDown: () => moveBy(-page) } : {}),
    };
    if (moves[key]) {
      event.preventDefault();
      moves[key]();
      return;
    }
    if (/^[ap]$/i.test(key)) {
      event.preventDefault();
      onMeridiem(key.toLowerCase() === 'p');
      return;
    }
    if (!typing || !/^\d$/.test(key)) return;
    event.preventDefault();
    const now = Date.now();
    const previous = now - typed.current.at < TYPING_MS ? typed.current.text : '';
    const result = typedNumber(previous, key, values);
    typed.current = { text: result.complete ? '' : result.typed, at: now };
    if (result.value !== null && result.value !== value) onPick(result.value);
    if (result.complete) onTyped?.();
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={values[0]}
      aria-valuemax={values[count - 1]}
      aria-valuetext={show(value)}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      onWheel={userMoves}
      onTouchStart={userMoves}
      onPointerDown={userMoves}
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
      className={`group relative z-10 h-[200px] snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <div aria-hidden="true" style={{ height: ROW * 2 }} />
      {rows.map(row => {
        const distance = Math.min(Math.abs(row - offset), 2.5);
        const centred = distance < 0.5;
        return (
          <div
            key={row}
            aria-hidden="true"
            data-value={values[mod(row, count)]}
            onClick={() => chooseRow(row)}
            style={{ height: ROW, opacity: Math.max(0.15, 1 - distance * 0.38), transform: `scale(${1 - distance * 0.13})` }}
            className={`flex snap-center cursor-pointer select-none items-center justify-center leading-none tabular-nums ${textClass} ${
              centred ? 'font-bold text-slate-900 group-focus-visible:text-indigo-700' : 'font-semibold text-slate-400'
            }`}
          >
            {show(values[mod(row, count)])}
          </div>
        );
      })}
      <div aria-hidden="true" style={{ height: ROW * 2 }} />
    </div>
  );
}

interface TimeFieldProps extends AriaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * A time picker with phone-style wheels for the hour, minute and AM or PM.
 * Same "HH:MM" (24-hour) value as the browser's time input. A choice is
 * saved as soon as a wheel stops.
 */
export const TimeField: React.FC<TimeFieldProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = 'Choose a time',
  size = 'md',
  className = '',
  ...aria
}) => {
  const reducedMotion = useReducedMotion();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const chosen = normalTime(value);
  const [clock, setClock] = useState(() => toClock(chosen || START_TIME)!);
  const latest = useRef(clock);
  const saved = useRef(chosen);
  saved.current = chosen;
  const { style, openUp } = useAnchoredPanel(open, setOpen, triggerRef, panelRef, TIME_PANEL_WIDTH, TIME_PANEL_HEIGHT);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!chosen || chosen === fromClock(latest.current)) return;
    const next = toClock(chosen)!;
    latest.current = next;
    setClock(next);
  }, [chosen]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('[role="spinbutton"]')?.focus({ preventScroll: true });
  }, [open]);

  const openPanel = () => {
    const start = toClock(chosen || START_TIME)!;
    latest.current = start;
    setClock(start);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const save = (time: string) => {
    if (time === saved.current) return;
    saved.current = time;
    onChange(time);
  };

  const change = (part: Partial<{ hour: number; minute: number; pm: boolean }>) => {
    const next = { ...latest.current, ...part };
    latest.current = next;
    setClock(next);
    save(fromClock(next));
  };

  const chooseQuick = (time: string) => {
    const next = toClock(time)!;
    latest.current = next;
    setClock(next);
    save(time);
    close();
  };

  const focusNextWheel = (from: number) => {
    panelRef.current?.querySelectorAll<HTMLElement>('[role="spinbutton"]')[from + 1]?.focus({ preventScroll: true });
  };

  const wheelKeys = { onMeridiem: (pm: boolean) => change({ pm }), onEnter: () => close() };

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
        data-value={chosen}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            openPanel();
          }
        }}
        className={triggerClass(size, open, className)}
      >
        {chosen
          ? <span className="truncate font-bold text-slate-800">{timeLabel(chosen)}</span>
          : <span className="truncate font-semibold text-slate-400">{placeholder}</span>}
        <Clock aria-hidden="true" className={`h-4 w-4 shrink-0 ${open ? 'text-brand-navy' : 'text-slate-400'}`} />
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
          aria-label="Choose a time"
          initial={{ opacity: 0, y: openUp ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.12 }}
          style={style}
          onKeyDown={event => keepKeysInPanel(event, close)}
          className={PANEL_CLASS}
        >
          <div className="relative flex h-[200px] items-center justify-center gap-1">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-1 top-20 h-10 rounded-xl bg-slate-100" />
            <Wheel label="Hour" values={HOURS} show={String} value={clock.hour} loop className="w-16" onPick={hour => change({ hour })} onTyped={() => focusNextWheel(0)} {...wheelKeys} />
            <span aria-hidden="true" className="relative z-10 pb-1 text-[24px] font-bold text-slate-900">:</span>
            <Wheel label="Minute" values={MINUTES} show={twoDigits} value={clock.minute} loop page={5} className="w-16" onPick={minute => change({ minute })} onTyped={() => focusNextWheel(1)} {...wheelKeys} />
            <Wheel label="AM or PM" values={MERIDIEM} show={pm => (pm ? 'PM' : 'AM')} value={clock.pm ? 1 : 0} typing={false} className="ml-2 w-16" textClass="text-[17px]" onPick={pm => change({ pm: pm === 1 })} {...wheelKeys} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {QUICK_TIMES.map(time => (
              <button
                key={time}
                type="button"
                aria-pressed={time === chosen}
                onClick={() => chooseQuick(time)}
                className={`rounded-xl border py-2 text-[13px] font-semibold tabular-nums transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                  time === chosen ? 'border-slate-100 bg-slate-100 text-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {timeLabel(time)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => {
                save(fromClock(latest.current));
                close();
              }}
              className={`${FOOTER_BUTTON} text-blue-700 hover:bg-blue-50`}
            >
              Done
            </button>
          </div>
        </motion.div>,
        portalTarget(triggerRef.current),
      )}
    </>
  );
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
  required?: boolean;
  clearable?: boolean;
  invalid?: boolean;
  describedBy?: string;
  label: string;
}> = ({ id, value, onChange, min, disabled = false, required = false, clearable = false, invalid = false, describedBy, label }) => {
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
        required={required}
        clearable={clearable}
        aria-label={`${label}, date`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={invalid ? 'form-control-error' : ''}
        onChange={date => update(date, date ? parts[1] : '')}
      />
      <TimeField
        value={parts[1]}
        disabled={disabled || !parts[0]}
        required={required}
        aria-label={`${label}, time`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={invalid ? 'form-control-error' : ''}
        onChange={time => update(parts[0], time)}
      />
    </div>
  );
};
