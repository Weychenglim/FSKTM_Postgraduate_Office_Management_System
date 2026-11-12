/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { THIN_SCROLLBAR } from '../utils/scrollbar';
import {
  firstEnabledIndex,
  lastEnabledIndex,
  nextEnabledIndex,
  typeaheadIndex,
} from '../utils/selectMenu';

export interface SelectMenuOption<T extends string = string> {
  value: T;
  label: string;
  /** A second, quieter line under the label, e.g. "Master · Coursework". */
  description?: string;
  /** Shown before the label, e.g. a coloured dot or icon. */
  leading?: React.ReactNode;
  /** Shorter text for the closed button, e.g. "All" for "All programmes". */
  triggerLabel?: string;
  disabled?: boolean;
}

interface SelectMenuProps<T extends string> {
  id?: string;
  value: T | '';
  options: SelectMenuOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  /** Opt-in search inside the popup; other selectors retain select-only behaviour. */
  searchPlaceholder?: string;
  /** Keep the search input in the field itself instead of adding a second input to the popup. */
  searchMode?: 'popup' | 'inline';
  /** Limit rendered search results for large in-memory option sets. */
  maxSearchResults?: number;
  /** Search callback for remote option providers. Local filtering still applies. */
  onSearchChange?: (query: string) => void;
  searchResultCount?: number;
  searchResultsLoading?: boolean;
  searchResultsError?: string | null;
  showSelectedDescription?: boolean;
  /** Toolbar filters read "Prefix: value", e.g. "Programme: All". */
  prefix?: string;
  variant?: 'field' | 'filter';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  /** Shown in place of the arrow, e.g. a clock for a time. */
  icon?: LucideIcon;
  controlRef?: React.Ref<HTMLButtonElement>;
  title?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
}

const MENU_GAP = 6;
const MENU_MAX_HEIGHT = 288;
const VIEWPORT_MARGIN = 8;
const MENU_MIN_WIDTH = 240;
const FILTER_MAX_WIDTH = 420;

/**
 * A styled replacement for the native <select>, whose open list cannot be
 * styled. Follows the WAI-ARIA select-only combobox pattern: focus stays on the
 * button and `aria-activedescendant` points at the highlighted option. The
 * list is portalled with fixed positioning so dialogs that scroll cannot clip it.
 */
export const SelectMenu = <T extends string>({
  id,
  value,
  options: allOptions,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder,
  searchMode = 'popup',
  maxSearchResults,
  onSearchChange,
  searchResultCount,
  searchResultsLoading = false,
  searchResultsError = null,
  showSelectedDescription = true,
  prefix,
  variant = 'field',
  size = 'md',
  disabled = false,
  className = '',
  icon: Icon,
  controlRef,
  title,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-required': ariaRequired,
  'aria-invalid': ariaInvalid,
}: SelectMenuProps<T>) => {
  const reducedMotion = useReducedMotion();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const triggerRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [openUp, setOpenUp] = useState(false);

  const matchingOptions = searchPlaceholder && query.trim()
    ? allOptions.filter(option => !option.value || `${option.label} ${option.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    : allOptions;
  const options = maxSearchResults && searchPlaceholder
    ? matchingOptions.slice(0, maxSearchResults)
    : matchingOptions;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = allOptions.find(option => option.value === value);
  const inlineSearch = Boolean(searchPlaceholder && searchMode === 'inline');

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const above = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    const up = below < Math.min(MENU_MAX_HEIGHT, 180) && above > below;
    const room = window.innerWidth - VIEWPORT_MARGIN * 2;
    const minWidth = Math.min(Math.max(rect.width, MENU_MIN_WIDTH), room);
    const maxWidth = variant === 'filter' ? Math.min(Math.max(minWidth, FILTER_MAX_WIDTH), room) : minWidth;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - VIEWPORT_MARGIN - maxWidth));
    setOpenUp(up);
    setMenuStyle({
      left,
      minWidth,
      maxWidth,
      maxHeight: Math.max(0, Math.min(MENU_MAX_HEIGHT, up ? above : below)),
      ...(up ? { bottom: window.innerHeight - rect.top + MENU_GAP } : { top: rect.bottom + MENU_GAP }),
    });
  }, [variant]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const update = (event: Event) => {
      if (event.target instanceof Node && (popupRef.current ?? listRef.current)?.contains(event.target)) return;
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
      if (triggerRef.current?.contains(target) || (popupRef.current ?? listRef.current)?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [open]);

  useEffect(() => {
    if (!open || active < 0) return;
    const list = listRef.current;
    const item = list?.children.item(active) as HTMLElement | null;
    if (!list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
    }
  }, [open, active, menuStyle]);

  useEffect(() => {
    if (open && (!options[active] || options[active].disabled)) setActive(firstEnabledIndex(options));
  }, [open, options, active]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (open && searchPlaceholder && !inlineSearch) searchRef.current?.focus({preventScroll:true});
  }, [open, searchPlaceholder, inlineSearch]);

  useEffect(() => {
    if (searchPlaceholder) {
      const match = query.trim() ? options.findIndex(option=>!!option.value&&!option.disabled) : selectedIndex;
      setActive(match >= 0 ? match : firstEnabledIndex(options));
    }
  }, [query]);

  const openAt = (index: number) => {
    setQuery('');
    onSearchChange?.('');
    setActive(options[index] && !options[index].disabled ? index : firstEnabledIndex(options));
    setOpen(true);
  };

  const choose = (index: number, keepFocus = true) => {
    const option = options[index];
    if (!option || option.disabled) return;
    setOpen(false);
    if (option.value !== value) onChange(option.value);
    if (keepFocus) triggerRef.current?.focus();
  };

  const jumpTo = (key: string) => {
    const now = Date.now();
    const text = now - typed.current.at > 600 ? key : typed.current.text + key;
    typed.current = { text, at: now };
    return typeaheadIndex(options, text, open ? active : selectedIndex);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    // A portalled list remains part of the surrounding dialog in React's event tree.
    if (open) event.stopPropagation();
    const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    const typing = Date.now() - typed.current.at <= 600 && typed.current.text !== '';
    const isInlineInput = inlineSearch && event.target === triggerRef.current;
    if ((event.target === searchRef.current || isInlineInput) && !['ArrowDown','ArrowUp','Enter','Escape','Tab','PageDown','PageUp'].includes(event.key)) return;
    if (isInlineInput && event.key === ' ') return;

    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || (event.key === ' ' && !typing)) {
        event.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options));
      } else if (event.key === 'ArrowUp' || event.key === 'Home') {
        event.preventDefault();
        openAt(firstEnabledIndex(options));
      } else if (event.key === 'End') {
        event.preventDefault();
        openAt(lastEnabledIndex(options));
      } else if (printable) {
        event.preventDefault();
        const match = jumpTo(event.key);
        openAt(match >= 0 ? match : selectedIndex);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((current) => nextEnabledIndex(options, current, 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (event.altKey) choose(active);
        else setActive((current) => nextEnabledIndex(options, current, -1));
        break;
      case 'PageDown':
        event.preventDefault();
        setActive((current) => nextEnabledIndex(options, current, 10));
        break;
      case 'PageUp':
        event.preventDefault();
        setActive((current) => nextEnabledIndex(options, current, -10));
        break;
      case 'Home':
        event.preventDefault();
        setActive(firstEnabledIndex(options));
        break;
      case 'End':
        event.preventDefault();
        setActive(lastEnabledIndex(options));
        break;
      case 'Enter':
        event.preventDefault();
        choose(active);
        break;
      case ' ':
        event.preventDefault();
        if (typing) {
          const match = jumpTo(' ');
          if (match >= 0) setActive(match);
        } else {
          choose(active);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        if (searchPlaceholder) triggerRef.current?.focus();
        break;
      case 'Tab':
        if (searchPlaceholder) {
          event.preventDefault();
          const trigger = triggerRef.current;
          const scope = trigger?.closest('dialog') ?? document;
          const stops = Array.from(scope.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]'))
            .filter(element=>element.tabIndex>=0&&!element.matches(':disabled')&&!popupRef.current?.contains(element)&&element.getClientRects().length>0);
          const index = trigger ? stops.indexOf(trigger) : -1;
          (stops[index+(event.shiftKey?-1:1)] ?? trigger)?.focus();
        } else choose(active, false);
        setOpen(false);
        break;
      default:
        if (printable) {
          event.preventDefault();
          const match = jumpTo(event.key);
          if (match >= 0) setActive(match);
        }
    }
  };

  const triggerText = selected ? selected.triggerLabel ?? selected.label : '';
  const fieldSize = size === 'sm' ? 'form-control-sm' : 'form-control-md';
  const triggerClass =
    variant === 'filter'
      ? 'inline-flex items-center gap-2 max-w-full bg-white border border-slate-200 text-slate-700 font-extrabold text-[11px] uppercase tracking-wide pl-4 pr-3 py-2.5 rounded-xl hover:bg-slate-50 shadow-3xs'
      : `form-control ${fieldSize} flex items-center justify-between gap-3 text-left normal-case tracking-normal`;

  return (
    <>
      {inlineSearch ? (
        <div className={`relative ${className}`}>
          <input
            ref={element => { triggerRef.current = element; }}
            id={id}
            type="search"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-required={ariaRequired}
            aria-invalid={ariaInvalid}
            title={title}
            disabled={disabled}
            placeholder={open ? searchPlaceholder : placeholder}
            value={open ? query : triggerText}
            onFocus={() => {
              if (!open) openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options));
            }}
            onChange={event => {
              const next = event.target.value;
              setQuery(next);
              onSearchChange?.(next);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            className={`${triggerClass} w-full pr-10 font-semibold text-slate-800 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-brand-navy focus:ring-1 focus:ring-brand-navy disabled:cursor-not-allowed disabled:opacity-60`}
          />
          <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      ) : <button
        ref={(element) => {
          triggerRef.current = element;
          if (typeof controlRef === 'function') controlRef(element);
          else if (controlRef) controlRef.current = element;
        }}
        id={id}
        type="button"
        role={searchPlaceholder ? undefined : 'combobox'}
        aria-haspopup={searchPlaceholder ? 'dialog' : 'listbox'}
        aria-expanded={open}
        aria-controls={open ? searchPlaceholder ? `${listId}-popup` : listId : undefined}
        aria-activedescendant={!searchPlaceholder && open && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        aria-invalid={ariaInvalid}
        title={title}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options)))}
        onKeyDown={onKeyDown}
        className={`${triggerClass} cursor-pointer outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
          variant === 'filter'
            ? 'focus-visible:ring-2 focus-visible:ring-indigo-500/30'
            : open
              ? 'ring-1 ring-brand-navy border-brand-navy'
              : ''
        } ${className}`}
      >
        {variant === 'filter' ? (
          <span className="truncate">
            {prefix ? `${prefix}: ` : ''}
            {triggerText || placeholder}
          </span>
        ) : selected ? (
          <span className="flex items-center gap-2.5 min-w-0">
            {selected.leading}
            <span className="truncate text-slate-800 font-bold">{triggerText}</span>
            {showSelectedDescription && selected.description && size === 'md' && (
              <span className="hidden sm:inline truncate text-[11px] font-semibold text-slate-400">
                {selected.description}
              </span>
            )}
          </span>
        ) : (
          <span className="truncate text-slate-400 font-semibold">{placeholder}</span>
        )}
        {Icon ? (
          <Icon aria-hidden="true" className={`w-4 h-4 shrink-0 ${open ? 'text-brand-navy' : 'text-slate-400'}`} />
        ) : (
          <ChevronDown
            aria-hidden="true"
            className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>}

      {/* Closes at once, like a native list, so two lists never overlap. */}
      {open &&
        createPortal(
          searchPlaceholder ? <div ref={popupRef} id={`${listId}-popup`} role={inlineSearch ? undefined : 'dialog'} aria-label={ariaLabel ?? placeholder}
            style={menuStyle} className="portal-select-menu fixed z-[10020] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl text-left font-sans">
            {!inlineSearch ? <div className="shrink-0 border-b border-slate-200 p-3">
              <input ref={searchRef} type="search" role="combobox" aria-label={searchPlaceholder} aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                placeholder={searchPlaceholder} value={query} onChange={event=>{const next=event.target.value;setQuery(next);onSearchChange?.(next);}} onKeyDown={onKeyDown}
                className="form-control form-control-md w-full"/>
            </div> : null}
            <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel ?? placeholder} aria-busy={searchResultsLoading || undefined} onMouseDown={event=>event.preventDefault()}
              className={`relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 ${THIN_SCROLLBAR}`}>
            {!searchResultsLoading && !searchResultsError && options.map((option, index) => {
              const isSelected = index === selectedIndex;
              const isActive = index === active;
              return (
                <li
                  key={option.value || `option-${index}`}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onMouseMove={() => !option.disabled && index !== active && setActive(index)}
                  onClick={() => choose(index)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 select-none transition-colors ${
                    option.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                  } ${isActive ? 'bg-slate-100' : isSelected ? 'bg-blue-50/70' : ''}`}
                >
                  {option.leading}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm leading-snug ${
                        isSelected ? 'font-semibold text-brand-navy' : 'font-medium text-slate-700'
                      }`}
                    >
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="block text-xs font-normal leading-relaxed text-slate-500 mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && <Check aria-hidden="true" className="w-4 h-4 shrink-0 text-indigo-600" />}
                </li>
              );
            })}
            </ul>
            {searchResultsLoading ? <p role="status" className="shrink-0 px-4 pb-3 text-sm text-slate-600">Searching…</p> : null}
            {searchResultsError ? <p role="alert" className="shrink-0 px-4 pb-3 text-sm text-rose-700">{searchResultsError}</p> : null}
            {!searchResultsLoading && !searchResultsError && (query.trim() || searchResultCount === 0) && !matchingOptions.some(option=>!!option.value) ? <p role="status" className="shrink-0 px-4 pb-3 text-sm text-slate-600">No options match your search.</p> : null}
            {!searchResultsLoading && !searchResultsError && searchResultCount !== undefined && searchResultCount > options.length ? <p role="status" className="shrink-0 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">Showing {options.length} of {searchResultCount} matches. Refine your search to narrow the list.</p> : null}
            {!searchResultsLoading && !searchResultsError && searchResultCount === undefined && maxSearchResults && matchingOptions.length > maxSearchResults ? <p role="status" className="shrink-0 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">Showing the first {maxSearchResults} of {matchingOptions.length} matches. Refine your search to narrow the list.</p> : null}
          </div> : <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel ?? prefix ?? placeholder}
            tabIndex={-1}
            initial={{ opacity: 0, y: openUp ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.12 }}
            style={menuStyle}
            onMouseDown={(event) => event.preventDefault()}
            className={`portal-select-menu fixed z-[10020] overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-[0_8px_28px_-6px_rgba(15,23,42,0.18),0_2px_6px_rgba(15,23,42,0.04)] font-sans text-left normal-case tracking-normal ${THIN_SCROLLBAR}`}
          >
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              const isActive = index === active;
              return (
                <li
                  key={option.value || `option-${index}`}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onMouseMove={() => !option.disabled && index !== active && setActive(index)}
                  onClick={() => choose(index)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 select-none transition-colors ${
                    option.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                  } ${isActive ? 'bg-slate-100' : isSelected ? 'bg-blue-50/70' : ''}`}
                >
                  {option.leading}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-xs leading-snug ${
                        isSelected ? 'font-semibold text-brand-navy' : 'font-medium text-slate-700'
                      }`}
                    >
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="block text-[11px] font-normal leading-relaxed text-slate-500 mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && <Check aria-hidden="true" className="w-4 h-4 shrink-0 text-indigo-600" />}
                </li>
              );
            })}
          </motion.ul>,
          // Native modal dialogs occupy the top layer, above body portals.
          triggerRef.current?.closest('dialog[open]') ?? document.body,
        )}
    </>
  );
};
