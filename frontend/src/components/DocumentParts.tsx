/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Download, MoreHorizontal, Search, X } from 'lucide-react';
import { PortalButton } from './PortalPrimitives';
import { FloatingMenu } from './FloatingMenu';
import type { DocumentAutoTag, DocumentCheckStatus, DocumentKind, TaggableStudent } from '../types';
import { searchTaggableStudents } from '../services/filesApi';
import { checkChip, KIND_CLASSES, KIND_SHORT } from '../utils/documentDisplay';
import { tagText } from '../utils/documentTags';

export const KindBadge: React.FC<{ kind: DocumentKind | null | undefined; size?: 'md' | 'lg' }> = ({ kind, size = 'md' }) => (
  <span
    aria-hidden="true"
    className={`${size === 'lg' ? 'h-12 w-12 text-[11px]' : 'h-10 w-10 text-[10px]'} inline-flex shrink-0 items-center justify-center rounded-xl font-extrabold ${kind ? KIND_CLASSES[kind] : 'bg-slate-100 text-slate-500'}`}
  >
    {kind ? KIND_SHORT[kind] : 'FILE'}
  </span>
);

export const CheckChip: React.FC<{ status: DocumentCheckStatus; hideAccepted?: boolean }> = ({ status, hideAccepted = false }) => {
  const chip = checkChip(status);
  if (!chip || (hideAccepted && status === 'ACCEPTED')) return null;
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.className}`}>{chip.label}</span>;
};

export const DownloadIconButton: React.FC<{ label: string; busy?: boolean; onClick: () => void }> = ({ label, busy = false, onClick }) => (
  <button type="button" className="icon-button h-10 w-10 shrink-0 disabled:opacity-50" aria-label={label} title={label} disabled={busy} onClick={onClick}>
    <Download className="h-4 w-4" aria-hidden="true" />
  </button>
);

export interface MenuAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** The "⋯" button that holds the rarely used actions of a row or page. */
export const OverflowMenu: React.FC<{ label: string; actions: MenuAction[]; align?: 'left' | 'right'; triggerLabel?: string; disabled?: boolean }> = ({ label, actions, align = 'right', triggerLabel, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const menuId = useId();

  if (!actions.length) return null;
  return (
    <div ref={wrapper} className="shrink-0">
      {triggerLabel ? <PortalButton size="sm" icon={ChevronDown} iconPosition="right" disabled={disabled} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? menuId : undefined} onClick={() => setOpen(value => !value)}>
        {triggerLabel}
      </PortalButton> : <button type="button" disabled={disabled} className="icon-button h-10 w-10" aria-label={label}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(value => !value)}>
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>}
      {open && (
        <FloatingMenu id={menuId} role="menu" anchor={wrapper} onClose={() => setOpen(false)} width={224} align={align} className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {actions.map(action => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition hover:bg-slate-100 disabled:opacity-50 ${action.danger ? 'text-rose-700' : 'text-slate-700'}`}
              onClick={() => {
                setOpen(false);
                wrapper.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus({preventScroll: true});
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </FloatingMenu>
      )}
    </div>
  );
};

const Chip: React.FC<{ children: React.ReactNode; onRemove: () => void; removeLabel: string; tone?: 'brand' | 'plain' }> = ({ children, onRemove, removeLabel, tone = 'brand' }) => (
  <span className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-[13px] font-bold ${tone === 'brand' ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-100 text-slate-700'}`}>
    {children}
    <button type="button" onClick={onRemove} aria-label={removeLabel} className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/10">
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </span>
);

/** Search the students this person may tag, and keep the picked ones as chips. */
export const StudentPicker: React.FC<{
  picked: TaggableStudent[];
  onChange: (students: TaggableStudent[]) => void;
  disabled?: boolean;
  inputId?: string;
}> = ({ picked, onChange, disabled = false, inputId }) => {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<TaggableStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchTaggableStudents(text)
        .then(found => {
          if (cancelled) return;
          setResults(found);
          setProblem(null);
          setActive(0);
        })
        .catch(() => !cancelled && setProblem('Could not search students. Try again.'))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, open]);

  const choices = results.filter(result => !picked.some(student => student.matric === result.matric));
  const pick = (student: TaggableStudent) => {
    onChange([...picked, student]);
    setText('');
    setActive(0);
  };

  return (
    <div>
      <div ref={wrapper} className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 focus-within:border-brand-navy focus-within:ring-1 focus-within:ring-brand-navy">
        {picked.map(student => (
          <Chip key={student.matric} onRemove={() => onChange(picked.filter(item => item.matric !== student.matric))} removeLabel={`Remove ${student.name}`}>
            {student.name} <span className="font-semibold text-indigo-500">{student.matric}</span>
          </Chip>
        ))}
        <div className="flex min-w-[12rem] flex-1 items-center gap-2 px-1">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && choices[active] ? `${listId}-${active}` : undefined}
            disabled={disabled}
            value={text}
            placeholder={picked.length ? 'Add another student' : 'Search by name or student ID'}
            className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[14px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
            onFocus={() => setOpen(true)}
            onChange={event => {
              setText(event.target.value);
              setOpen(true);
            }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setOpen(true);
                setActive(index => Math.min(index + 1, Math.max(choices.length - 1, 0)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive(index => Math.max(index - 1, 0));
              } else if (event.key === 'Enter' && open && choices[active]) {
                event.preventDefault();
                pick(choices[active]);
              } else if (event.key === 'Escape') {
                setOpen(false);
              } else if (event.key === 'Backspace' && !text && picked.length) {
                onChange(picked.slice(0, -1));
              }
            }}
          />
        </div>
      </div>
      {open && (
        <FloatingMenu anchor={wrapper} onClose={() => setOpen(false)} maxHeight={288} className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <ul id={listId} role="listbox" aria-label="Students you can add">
            {choices.map((student, index) => (
              <li
                key={student.matric}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${index === active ? 'bg-slate-100' : ''}`}
                onMouseDown={event => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(student)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-slate-800">{student.name}</span>
                  <span className="block truncate text-[12px] text-slate-500">{student.matric} · {student.programme || 'No programme'}</span>
                </span>
                {student.relation && <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{student.relation}</span>}
              </li>
            ))}
          </ul>
          {!choices.length && (
            <p className="px-3 py-2.5 text-[13px] text-slate-500">
              {loading ? 'Searching...' : problem ?? (text ? 'No students match.' : 'No more students you can add.')}
            </p>
          )}
        </FloatingMenu>
      )}
    </div>
  );
};

/** The tags the system gave a file. With `onPick`, each one filters the list by it. */
export const AutoTagChips: React.FC<{ tags: DocumentAutoTag[]; onPick?: (tag: DocumentAutoTag) => void; limit?: number; className?: string }> = ({
  tags,
  onPick,
  limit,
  className = '',
}) => {
  const shown = limit ? tags.slice(0, limit) : tags;
  const hidden = tags.length - shown.length;
  const look = 'inline-flex max-w-full items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11.5px] font-semibold text-slate-600';
  return (
    <ul aria-label="Tags" className={`flex flex-wrap gap-1.5 ${className}`}>
      {shown.map(tag => (
        <li key={`${tag.kind}:${tag.label}`} className="min-w-0 max-w-full">
          {onPick ? (
            <button type="button" title={`Show files tagged ${tagText(tag)}`} className={`${look} cursor-pointer hover:border-brand-navy hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy`} onClick={() => onPick(tag)}>
              <span className="truncate">{tagText(tag)}</span>
            </button>
          ) : (
            <span className={look}><span className="truncate">{tagText(tag)}</span></span>
          )}
        </li>
      ))}
      {hidden > 0 && <li className="inline-flex items-center px-1 text-[11.5px] font-semibold text-slate-400">+{hidden}</li>}
    </ul>
  );
};
