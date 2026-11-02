import {useRef, useState} from 'react';
import {PortalConfirmModal} from './PortalPrimitives';

/** Local replacements use the same consent as routed editor exits. */
export function useDraftDiscard(dirty: boolean, busy: boolean) {
  const pending = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);
  const request = (action: () => void) => {
    if (busy) return;
    if (!dirty) {action(); return;}
    pending.current = action;
    setOpen(true);
  };
  const dialog = <PortalConfirmModal isOpen={open} title="Discard unsaved changes?"
    message="Your changes have not been saved. Discard them and continue?"
    confirmLabel="Discard changes" cancelLabel="Keep editing" isLoading={busy}
    onCancel={() => {if (!busy) {pending.current = null; setOpen(false);}}}
    onConfirm={() => {if (!busy) {const action = pending.current; pending.current = null; setOpen(false); action?.();}}}/>;
  return {request, dialog};
}
