import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {DecisionDialog, type DecisionDialogProps} from '../src/components/DecisionDialog';

const results: {name: string; error: string | null}[] = [];
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const until = async (predicate: () => unknown) => {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for dialog state');
};
let root = createRoot(document.getElementById('root')!);
let saves = 0;
function Harness(props: Partial<DecisionDialogProps>) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  return <>
    <button id="open" onClick={() => setOpen(true)}>Review recommendation</button>
    <label className="form-label" id="outside-label">Unrelated form label</label>
    <DecisionDialog isOpen={open} decisionKey="panel:7" title="Reject Panel recommendation?"
      context="Test Student · Master of Cyber Security (Coursework)"
      message="This recommendation will be rejected. The recorded reason remains in its history."
      confirmLabel="Reject recommendation" successMessage="Panel recommendation rejected."
      tone="danger" dirty={!!reason} canConfirm={!!reason.trim()} onConfirm={async () => { saves++; }}
      {...props} onClose={() => { setOpen(false); setReason(''); }}>
      {props.kind === 'confirmation' ? null : <label className="form-label block">Reason for rejection (required)
        <textarea required className="form-control form-control-md mt-2 min-h-28" value={reason}
          onChange={event => setReason(event.target.value)}/>
      </label>}
    </DecisionDialog>
  </>;
}
const dialog = () => document.querySelector<HTMLDialogElement>('dialog')!;
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('dialog[open] button')].find(node => node.textContent === text)!;
const closeButton = () => {
  const node = dialog().querySelector<HTMLButtonElement>('button[aria-label="Close dialog"]');
  check(node, 'Missing accessible header X button'); return node!;
};
const reason = () => dialog().querySelector('textarea')!;
async function mount(props: Partial<DecisionDialogProps> = {}) {
  root.unmount(); root = createRoot(document.getElementById('root')!); saves = 0;
  flushSync(() => root.render(<Harness {...props}/>));
  const opener = document.getElementById('open')!;
  opener.focus(); opener.click(); await until(() => dialog()?.open);
}
async function typeReason(value = 'Please review the nominated expertise.') {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason(), value);
  reason().dispatchEvent(new Event('input', {bubbles: true}));
  await until(() => !button('Reject recommendation').disabled);
}
function dismiss(method: 'X' | 'Cancel' | 'Escape' | 'backdrop') {
  if (method === 'X') closeButton().click();
  else if (method === 'Cancel') button('Cancel').click();
  else if (method === 'Escape') dialog().dispatchEvent(new Event('cancel', {cancelable: true}));
  else dialog().dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: 0, clientY: 0}));
}
async function scenario(name: string, run: () => Promise<void>) {
  try { await run(); results.push({name, error: null}); }
  catch (error) { results.push({name, error: error instanceof Error ? error.message : String(error)}); }
}

await scenario('X and Cancel close clean dialogs and return focus without submitting', async () => {
  for (const method of ['X', 'Cancel'] as const) {
    await mount(); dismiss(method); await until(() => !dialog());
    check(document.activeElement?.id === 'open', 'Focus did not return to the opener');
    check(saves === 0, 'Dismissal submitted a decision');
  }
});
await scenario('all dismissal paths protect a typed reason with the existing discard prompt', async () => {
  for (const method of ['X', 'Cancel', 'Escape', 'backdrop'] as const) {
    await mount(); await typeReason(); dismiss(method);
    await until(() => document.body.textContent?.includes('Discard unsaved changes?'));
    button('Keep editing').click(); await until(() => !!button('Reject recommendation'));
    check(reason().value.includes('nominated expertise'), `${method}: reason was lost`);
    dismiss(method); await until(() => !!button('Discard changes'));
    button('Discard changes').click(); await until(() => !dialog());
    check(saves === 0, `${method}: discard submitted a decision`);
  }
});
await scenario('saving blocks dismissal and duplicate submissions until the confirmed outcome', async () => {
  let finish!: () => void;
  await mount({onConfirm: () => { saves++; return new Promise<void>(resolve => { finish = resolve; }); }});
  await typeReason(); button('Reject recommendation').click();
  await until(() => closeButton().disabled);
  check(button('Cancel').disabled, 'Cancel remains enabled while saving');
  for (const method of ['X', 'Cancel', 'Escape', 'backdrop'] as const) dismiss(method);
  dialog().querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
  check(dialog().open && saves === 1, 'Saving allowed dismissal or a duplicate submission');
  finish(); await until(() => !dialog());
  check(document.querySelectorAll('[role="status"]').length === 1, 'Expected one saved outcome');
});
await scenario('failed saves retain the reason and allow a deliberate retry', async () => {
  await mount({onConfirm: async () => { saves++; throw new Error('Service unavailable'); }});
  await typeReason(); button('Reject recommendation').click();
  await until(() => dialog().textContent?.includes('Service unavailable'));
  check(reason().value.includes('nominated expertise'), 'Failure cleared the reason');
  check(!button('Reject recommendation').disabled && saves === 1, 'Failure prevented retry');
});
await scenario('permission and conflict blocks survive closing and require a successful review reload', async () => {
  for (const status of [403, 409]) {
    await mount({onConfirm: async () => { saves++; throw {status, message: 'Review latest state'}; }, onReload: async () => {}});
    await typeReason(); button('Reject recommendation').click();
    await until(() => !!button('Review latest record'));
    dismiss('X'); await until(() => !!button('Discard changes')); button('Discard changes').click();
    await until(() => !dialog()); document.getElementById('open')!.click(); await until(() => dialog()?.open);
    check(!button('Reject recommendation') && saves === 1, `${status}: stale retry became available`);
    button('Review latest record').click(); await until(() => !dialog());
  }
});
await scenario('explicit secondary labels and reason-free approval remain supported', async () => {
  await mount({kind: 'confirmation', title: 'Approve Panel recommendation?', confirmLabel: 'Approve recommendation',
    cancelLabel: 'Review again', canConfirm: true, tone: 'info'});
  check(button('Review again') && !reason(), 'Custom label or reason-free confirmation changed');
  check(closeButton().type === 'button', 'X must never submit the form');
  button('Approve recommendation').click(); await until(() => !dialog()); check(saves === 1, 'Approval did not save once');
});
await scenario('decision typography is consistent and isolated, with wrapping at this viewport', async () => {
  await mount();
  const label = getComputedStyle(reason().parentElement!);
  const control = getComputedStyle(reason());
  check(label.fontSize === '12px' && label.fontWeight === '600' && label.textTransform === 'none', 'Decision label must be 12px semibold sentence case');
  check(control.fontSize === '12px' && control.fontWeight === '400', 'Entered reason must be 12px regular');
  check(getComputedStyle(document.getElementById('outside-label')!).textTransform === 'uppercase', 'Decision styling leaked into unrelated forms');
  const bounds = dialog().getBoundingClientRect();
  check(bounds.left >= 0 && bounds.right <= innerWidth, 'Dialog exceeds the viewport');
  check(dialog().scrollWidth <= dialog().clientWidth, 'Dialog content overflows horizontally');
  const x = closeButton().getBoundingClientRect();
  check(x.width >= 36 && x.right <= bounds.right && x.top >= bounds.top, 'Header close control is clipped or too small');
  check(document.getElementById(dialog().getAttribute('aria-labelledby')!)?.textContent === 'Reject Panel recommendation?', 'Dialog accessible title missing');
});
parent.postMessage({type: 'decision-dialog-results', width: innerWidth, results}, location.origin);
