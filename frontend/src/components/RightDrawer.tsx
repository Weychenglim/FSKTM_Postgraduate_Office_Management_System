import React from 'react';
import { RecordPage } from './RecordPage';

// Keep the import contract while active callers share the independent page frame.
export function RightDrawer({ isOpen, onClose, title, children, backLabel, pageKey, dirty = false, busy = false, onNavigationSettled }: {
  id?: string; isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode;
  backLabel: string; pageKey: string; dirty?: boolean; busy?: boolean; onNavigationSettled?: () => void;
}) {
  return isOpen ? <RecordPage title={title} onBack={onClose} backLabel={backLabel} pageKey={pageKey} dirty={dirty} busy={busy} onNavigationSettled={onNavigationSettled}>
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">{children}</section>
  </RecordPage> : null;
}
