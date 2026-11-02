import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PortalModal, useModalTitle } from './PortalModal';
import { PortalConfirmModal } from './PortalPrimitives';

/** Capacity row tasks keep their table mounted and use the portal's shared dialogs. */
export function CapacityLecturerDialog({ title, lecturerName, staffNo, dirty = false, busy = false, onClose, children, footer }: {
  title: string; lecturerName: string; staffNo: string; dirty?: boolean; busy?: boolean;
  onClose: () => void; children: React.ReactNode; footer: (requestClose: () => void) => React.ReactNode;
}) {
  const titleId = useModalTitle();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const origin = useRef({ focused: document.activeElement as HTMLElement | null, top: window.scrollY, url: window.location.href, view: document.querySelector('[data-capacity-view]')?.getAttribute('data-capacity-view') });
  useEffect(() => { content.current?.querySelector<HTMLElement>('input:not(:disabled)')?.focus({ preventScroll: true }); }, []);
  useEffect(() => () => {
    requestAnimationFrame(() => {
      if (document.querySelector('[data-capacity-lecturer-dialog]') || window.location.href !== origin.current.url || document.querySelector('[data-capacity-view]')?.getAttribute('data-capacity-view') !== origin.current.view) return;
      const target = origin.current.focused?.isConnected ? origin.current.focused : document.querySelector<HTMLElement>('.capacity-workspace #capacity-roster-show, .capacity-workspace input[type="search"]');
      if (!target) return;
      target.focus({ preventScroll: true });
      window.scrollTo({ top: origin.current.top, behavior: 'instant' });
    });
  }, []);
  const requestClose = () => { if (busy) return; if (dirty) setConfirmLeave(true); else onClose(); };
  return <>
    <PortalModal isOpen onClose={requestClose} busy={busy} labelledBy={titleId} className="max-w-xl overscroll-contain p-0">
      <div ref={content} data-office-dashboard data-capacity-lecturer-dialog className="text-sm text-slate-700">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
          <div className="min-w-0"><h2 id={titleId} className="section-heading">{title}</h2><p className="mt-2 font-semibold text-brand-navy break-words">{lecturerName}</p><p className="mt-1 text-slate-600">{staffNo}</p></div>
          <button type="button" className="icon-button h-9 w-9 shrink-0 disabled:opacity-50" aria-label="Close lecturer dialog" disabled={busy} onClick={requestClose}><X className="h-4 w-4" aria-hidden="true" /></button>
        </header>
        <div className="space-y-5 p-5 sm:p-6">{children}</div>
        <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 p-5 sm:px-6">{footer(requestClose)}</footer>
      </div>
    </PortalModal>
    <PortalConfirmModal isOpen={confirmLeave} title="Discard unsaved changes?" message="Your changes have not been saved. Close this dialog and discard them?"
      confirmLabel="Discard changes" cancelLabel="Keep editing" isLoading={busy} onConfirm={() => { if (!busy) onClose(); }} onCancel={() => setConfirmLeave(false)} />
  </>;
}
