import React, {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {DecisionFeedbackProvider, useDecisionFeedback} from '../src/components/DecisionFeedback';
import {PortalToast} from '../src/components/PortalPrimitives';
import {PortalModal} from '../src/components/PortalModal';
import {RecordPage, RecordPageProvider} from '../src/components/RecordPage';

// Each assertion guards a consumer-visible break: overwrite, stale delivery,
// early expiry, lost pause, overlapping host or inaccessible native-modal output.
const results: {name: string; error: string | null}[] = [];
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const wait = (ms = 40) => new Promise(resolve => setTimeout(resolve, ms));
const until = async (predicate: () => unknown) => {
  for (let attempt=0; attempt<100; attempt++) {if (predicate()) return; await wait(10);}
  throw new Error('Timed out waiting for feedback');
};
let root = createRoot(document.getElementById('root')!);
let emit: ReturnType<typeof useDecisionFeedback>;
let nestedEmit: ReturnType<typeof useDecisionFeedback>;
let setScope: (scope: string) => void;
let setRoute: (route: number) => void;
let setModal: (open: boolean) => void;
let replaceStandalone: (id: string) => void;
function Publisher({nested = false}: {nested?: boolean}) {
  const publish = useDecisionFeedback();
  if (nested) nestedEmit = publish; else emit = publish;
  return <div>Publisher</div>;
}
function Harness() {
  const [scope, scopeSetter] = useState('session-A'); setScope=scopeSetter;
  const [route, routeSetter] = useState(1); setRoute=routeSetter;
  const [modal, modalSetter] = useState(false); setModal=modalSetter;
  return <DecisionFeedbackProvider scopeKey={scope}>
    <button id="opener">Outside focus target</button>
    <Publisher key={route}/>
    <DecisionFeedbackProvider scopeKey="nested-page"><Publisher nested/></DecisionFeedbackProvider>
    <PortalModal isOpen={modal} onClose={()=>modalSetter(false)} labelledBy="modal-title">
      <h2 id="modal-title">Review record</h2><button id="modal-close" onClick={()=>modalSetter(false)}>Close review</button>
    </PortalModal>
  </DecisionFeedbackProvider>;
}
function Standalone() {
  const [id, setId] = useState('first'); replaceStandalone=setId;
  return <PortalToast message="Standalone same text" eventId={id}/>;
}
function MountPublisher() {
  const publish = useDecisionFeedback();
  useEffect(() => { publish!('Loaded operation outcome', 'success', 'loaded-operation'); }, [publish]);
  return null;
}
const notices = () => [...document.querySelectorAll<HTMLElement>('[role="status"], [role="alert"]')];
const text = () => notices()[0]?.querySelector('p')?.textContent;
const dismiss = () => notices()[0]?.querySelector<HTMLButtonElement>('button')?.click();
const publish = (message: string, tone: 'info'|'success'|'warning'|'danger'='success', id?:string) =>
  flushSync(()=>emit!(message, tone, id));
async function mount(standalone = false) {
  root.unmount(); root=createRoot(document.getElementById('root')!);
  flushSync(()=>root.render(<StrictMode>{standalone?<Standalone/>:<Harness/>}</StrictMode>)); await wait();
}
async function scenario(name: string, run: () => Promise<void>) {
  try {await mount(); await run(); results.push({name,error:null});}
  catch(error) {results.push({name,error:error instanceof Error?error.message:String(error)});}
}
await scenario('routine success expires after four visible seconds',async()=>{
  document.getElementById('opener')!.focus(); publish('Saved record');
  await wait(3700); check(text()==='Saved record','Success expired before four seconds');
  check(document.activeElement?.id==='opener','Outcome stole focus');
  await wait(400); check(!notices().length,'Success did not expire after four seconds');
});
await scenario('distinct publishers queue without overlap and preserve route changes',async()=>{
  publish('First outcome','warning'); flushSync(()=>nestedEmit!('Second outcome','success'));
  check(text()==='First outcome','Nested publisher overwrote or overlapped first outcome');
  check(notices().length===1,'Nested provider rendered an overlapping host');
  flushSync(()=>setRoute(2)); check(text()==='First outcome','Route change lost feedback');
  dismiss(); await until(()=>text()==='Second outcome');
});
await scenario('same explicit operation is deduplicated after dismissal',async()=>{
  publish('Once','warning','operation-1'); publish('Once','warning','operation-1');
  dismiss(); await wait(); check(!notices().length,'Duplicate queued delivery remained');
  publish('Once','warning','operation-1'); check(!notices().length,'Consumed operation delivered again');
  publish('Once','warning','operation-2'); check(text()==='Once','Distinct operation was deduplicated by text');
});
await scenario('identical text with no operation ID is a new delivery',async()=>{
  publish('Same saved text'); publish('Same saved text'); await wait(2200); dismiss();
  await until(()=>text()==='Same saved text'); await wait(2200);
  check(text()==='Same saved text','Old timer cleared newer identical outcome');
  await wait(1900); check(!notices().length,'Second identical outcome did not receive its own lifetime');
});
await scenario('hover pauses remaining success time',async()=>{
  publish('Hover saved'); await wait(1800);
  notices()[0].dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
  await wait(4300); check(text()==='Hover saved','Hovered notification expired');
  notices()[0].dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:document.body}));
  await wait(1700); check(text()==='Hover saved','Hover resume lost remaining lifetime');
  await wait(700); check(!notices().length,'Hover pause never resumed expiry');
});
await scenario('focus pauses remaining info time without stealing focus',async()=>{
  publish('Informational update','info'); await wait(1800); notices()[0].querySelector('button')!.focus();
  await wait(4300); check(text()==='Informational update','Focused notification expired');
  document.getElementById('opener')!.focus(); await wait(1700);
  check(text()==='Informational update','Focus resume lost remaining lifetime');
  await wait(700); check(!notices().length,'Focus pause never resumed expiry');
});
await scenario('warning and danger remain accessible until dismissed',async()=>{
  publish('Review warning','warning'); publish('Failure detail','danger'); await wait(4200);
  check(text()==='Review warning','Warning expired'); dismiss(); await until(()=>text()==='Failure detail');
  check(notices()[0].getAttribute('role')==='alert','Danger is not announced as an alert');
  await wait(4200); check(text()==='Failure detail','Danger expired'); dismiss(); await wait(); check(!notices().length,'Dismiss did not clear danger');
});
await scenario('session changes clear queue and reject old callbacks including A-B-A',async()=>{
  const old=emit!; publish('Old session','warning'); publish('Old queued','warning');
  flushSync(()=>setScope('session-B')); await wait(); check(!notices().length,'Session change retained notices');
  flushSync(()=>old('Late previous session','success')); check(!notices().length,'Stale session callback published');
  flushSync(()=>setScope('session-A')); await wait();
  flushSync(()=>old('Late returned session','success')); check(!notices().length,'A-B-A revived stale callback');
  publish('Current session'); await wait(3500); check(text()==='Current session','Old lifecycle cleared new session');
});
await scenario('unmounted provider rejects late callbacks',async()=>{
  const old=emit!; flushSync(()=>root.render(<div>Signed out</div>));
  flushSync(()=>old('Late signout callback','success')); await wait(); check(!notices().length,'Unmounted provider published');
});
await scenario('native modal suppresses outcomes until close with a full visible lifetime',async()=>{
  document.getElementById('opener')!.focus(); flushSync(()=>setModal(true)); await until(()=>document.querySelector('dialog')?.open);
  publish('Saved behind review'); await wait(4300);
  check(!notices().length,'Outcome rendered while body was inert');
  check(document.activeElement?.id==='modal-close','Outcome interrupted modal focus');
  flushSync(()=>setModal(false)); await until(()=>text()==='Saved behind review');
  check(document.activeElement?.id==='opener','Outcome stole restored focus');
  await wait(3700); check(text()==='Saved behind review','Modal consumed visible lifetime');
  await wait(400); check(!notices().length,'Released modal outcome did not expire');
});
await scenario('opening a modal hides active output and restores its full lifetime',async()=>{
  publish('Existing saved outcome'); await wait(2100); flushSync(()=>setModal(true)); await wait();
  check(!notices().length,'Active outcome remained rendered during modal'); await wait(2200);
  flushSync(()=>setModal(false)); await until(()=>text()==='Existing saved outcome');
  await wait(3700); check(text()==='Existing saved outcome','Suspended outcome lost full visible lifetime');
  await wait(400); check(!notices().length,'Resumed outcome did not expire');
});
await scenario('standalone event identity resets dismiss while fallback stays persistent and fits viewport',async()=>{
  await mount(true); await wait(4200); check(text()==='Standalone same text','Legacy standalone lifetime changed');
  const bounds=notices()[0].getBoundingClientRect(); check(bounds.left>=0&&bounds.right<=innerWidth,'Toast overflows viewport');
  check(notices()[0].querySelectorAll('button[aria-label="Dismiss notification"]').length===1,'Missing unique accessible dismiss');
  dismiss(); await wait(); check(!notices().length,'Standalone dismissal failed');
  flushSync(()=>replaceStandalone('second')); await wait(); check(text()==='Standalone same text','New event ID reused dismissed text lifecycle');
});
await scenario('a mounted publisher can deliver an operation outcome from its effect',async()=>{
  flushSync(()=>root.render(<StrictMode><DecisionFeedbackProvider scopeKey="effect-session"><MountPublisher/></DecisionFeedbackProvider></StrictMode>));
  await wait(); check(text()==='Loaded operation outcome','Newly mounted publisher outcome was dropped');
  dismiss(); await wait(); check(!notices().length,'StrictMode duplicated the explicit mount operation');
});
await scenario('an open RecordPage does not suppress feedback because its retained list sibling is inert',async()=>{
  flushSync(()=>root.render(<DecisionFeedbackProvider scopeKey="record-session"><Publisher/>
    <RecordPageProvider><RecordPage title="Active record" backLabel="Return to list" onBack={()=>{}}>
      <p>Current record content</p>
    </RecordPage></RecordPageProvider>
  </DecisionFeedbackProvider>));
  await until(()=>document.querySelector('[inert]') && document.querySelector('[data-record-page]') &&
    !document.querySelector('[data-record-page]')!.closest('[inert]'));
  publish('Record update saved'); await wait();
  check(text()==='Record update saved','Unrelated inert workspace suppressed usable record feedback');
});
await scenario('body and document inert ancestors suspend output with a fresh visible lifetime',async()=>{
  for (const ancestor of [document.body, document.documentElement]) {
    try {
      ancestor.inert=true; await wait(); publish('Saved while document inert'); await wait(4300);
      check(!notices().length,'Feedback remained rendered within an inert ancestor');
      ancestor.inert=false; await until(()=>text()==='Saved while document inert');
      await wait(3700); check(text()==='Saved while document inert','Inert ancestor consumed visible lifetime');
      await wait(400); check(!notices().length,'Released inert output did not expire');
    } finally {ancestor.inert=false;}
  }
});
root.unmount();
parent.postMessage({type:'feedback-delivery-results',width:innerWidth,results},location.origin);
