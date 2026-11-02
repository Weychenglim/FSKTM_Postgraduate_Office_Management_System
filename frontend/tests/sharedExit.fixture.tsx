import React, {StrictMode, useRef, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createMemoryRouter, MemoryRouter, RouterProvider} from 'react-router';
import {RecordPage} from '../src/components/RecordPage';
import {useRecordDraft} from '../src/components/RecordDraft';
import {DecisionDialog} from '../src/components/DecisionDialog';
import {SessionExitProvider} from '../src/components/SessionExit';

const results: {name:string;error?:string}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const pause=()=>new Promise(resolve=>setTimeout(resolve,20));
const until=async(predicate:()=>unknown)=>{for(let i=0;i<120;i++){if(predicate())return;await pause();}throw Error('Timeout: '+document.body.textContent?.slice(-600));};
const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.getClientRects().length&&node.textContent===label);
const click=async(label:string)=>{check(button(label),'Missing '+label);button(label)!.click();await pause();};
const scenario=async(name:string,run:()=>Promise<void>)=>{try{await run();results.push({name});}catch(error){results.push({name,error:String(error)});}};
let root:Root|null=null,router:ReturnType<typeof createMemoryRouter>|null=null;
let finishWrite:()=>void=()=>{},finishReload:()=>void=()=>{},closeCount=0,completeCount=0,discardCount=0,reloads=0;
let exits=0,oldExit:()=>void=()=>{};
let failWrite:(status:number)=>void=()=>{};
let settledCount=0;
function SettlementHarness(){
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[armed,setArmed]=useState(false),[open,setOpen]=useState(true);
  return open?<RecordPage title="Settlement record" backLabel="Return to list" onBack={()=>setOpen(false)} dirty={dirty} busy={busy}
    onNavigationSettled={armed?()=>{settledCount++;setOpen(false);}:undefined}>
    <button onClick={()=>setBusy(true)}>Start settlement save</button>
    <button onClick={()=>setDirty(true)}>Make settlement dirty</button>
    <button onClick={()=>setArmed(true)}>Arm settlement</button>
    <button onClick={()=>{setDirty(false);setBusy(false);}}>Finish settlement clean</button>
  </RecordPage>:<h1>Settlement closed</h1>;
}
function ChildDraft(){useRecordDraft(true);return <p>Nested draft</p>;}
function RecordHarness(){
  const [dirty,setDirty]=useState(true),[busy,setBusy]=useState(false),[child,setChild]=useState(false);
  const completed=useRef(false);
  return <RecordPage title="Draft record" backLabel="Return to list" onBack={()=>{}} dirty={dirty} busy={busy} navigationComplete={completed}>
    <button onClick={()=>setBusy(true)}>Start saving</button>
    <button onClick={()=>{setDirty(false);setBusy(false);}}>Finish clean</button>
    <button onClick={()=>{completed.current=true;setBusy(false);}}>Finish completed dirty</button>
    <button onClick={()=>setBusy(false)}>Finish failed</button>
    <button onClick={()=>{completed.current=true;setDirty(false);}}>Commit in place</button>
    <button onClick={()=>setDirty(true)}>New edit</button>
    <button onClick={()=>setChild(value=>!value)}>Toggle child</button>
    {child?<ChildDraft/>:null}
  </RecordPage>;
}
function DecisionHarness({delayed=false,callbacks=false,dirtyReview=false}:{delayed?:boolean;callbacks?:boolean;dirtyReview?:boolean}){
  const [identity,setIdentity]=useState('A'),[open,setOpen]=useState(true);
  return <><button onClick={()=>{setIdentity('B');setOpen(true);}}>Switch decision</button>
    <button onClick={()=>setOpen(false)}>Owner closes</button><button onClick={()=>setOpen(true)}>Owner reopens</button>
    <DecisionDialog isOpen={open} decisionKey={identity} title={`Decision ${identity}`} message="Review record" confirmLabel="Save decision" successMessage={`Saved ${identity}`} onClose={()=>{closeCount++;setOpen(false);}}
      dirty={callbacks||dirtyReview} onComplete={callbacks?()=>{completeCount++;setOpen(false);}:undefined} onDiscard={callbacks?()=>{discardCount++;setOpen(false);}:undefined}
      onConfirm={delayed?()=>new Promise<void>((resolve,reject)=>{finishWrite=resolve;failWrite=status=>reject({status,message:'Review required for original request'});}):callbacks?async()=>{}:async()=>{throw {status:409,message:'Stale version'};}}
      onReload={()=>{reloads++;return new Promise<void>(resolve=>{finishReload=resolve;});}}/>
  </>;
}
function SessionHarness(){
  const [account,setAccount]=useState('A'),[expired,setExpired]=useState(false);
  if(expired)return <h1>Signed out</h1>;
  return <SessionExitProvider scopeKey={account}>{requestExit=><>
    <button onClick={()=>requestExit(()=>{exits++;setExpired(true);})}>Sign out</button>
    <button onClick={()=>{oldExit=()=>requestExit(()=>{exits++;});}}>Capture old exit</button>
    <button onClick={()=>setAccount('B')}>Change account</button>
    <button onClick={()=>setExpired(true)}>Force expiry</button>
    <RecordHarness/>
  </>}</SessionExitProvider>;
}
async function mount(component:React.ReactNode){root?.unmount();router?.dispose();await pause();closeCount=0;completeCount=0;discardCount=0;router=createMemoryRouter([{path:'/record',element:component},{path:'/other',element:<h1>Destination</h1>}],{initialEntries:['/record']});root=createRoot(document.getElementById('root')!);root.render(<StrictMode><RouterProvider router={router}/></StrictMode>);await until(()=>!!document.getElementById('root')?.textContent);await pause();}
async function mountWithoutDataRouter(component:React.ReactNode,memoryRouter:boolean){root?.unmount();router?.dispose();router=null;await pause();settledCount=0;root=createRoot(document.getElementById('root')!);root.render(<StrictMode>{memoryRouter?<MemoryRouter>{component}</MemoryRouter>:component}</StrictMode>);await until(()=>!!document.getElementById('root')?.textContent);await pause();}

for(const [label,memoryRouter] of [['without router',false],['inside MemoryRouter',true]] as const){
  await scenario(`completed settlement waits for busy write ${label}`,async()=>{
    await mountWithoutDataRouter(<SettlementHarness/>,memoryRouter);await click('Start settlement save');await click('Arm settlement');
    check(settledCount===0&&button('Finish settlement clean'),'Busy settlement closed the record');
    await click('Finish settlement clean');await until(()=>settledCount===1);check(document.body.textContent?.includes('Settlement closed')&&settledCount===1,'Clean settlement did not close exactly once');
  });
  await scenario(`stale settlement waits for clean draft ${label}`,async()=>{
    await mountWithoutDataRouter(<SettlementHarness/>,memoryRouter);await click('Make settlement dirty');await click('Arm settlement');
    check(settledCount===0&&button('Finish settlement clean'),'Dirty settlement closed the record');
    await click('Finish settlement clean');await until(()=>settledCount===1);check(document.body.textContent?.includes('Settlement closed')&&settledCount===1,'Clean settlement did not close exactly once');
  });
}
await scenario('blocked data-router route reaches its original destination before local settlement',async()=>{
  settledCount=0;await mount(<SettlementHarness/>);await click('Start settlement save');void router!.navigate('/other');
  await until(()=>document.querySelector('dialog[open]')?.textContent?.includes('Saving changes'));
  await click('Arm settlement');check(settledCount===0&&router!.state.location.pathname==='/record','Busy blocked route closed locally');
  await click('Finish settlement clean');await until(()=>router!.state.location.pathname==='/other');
  check(settledCount===0&&document.body.textContent?.includes('Destination'),'Local settlement preempted the blocked route');
});

await scenario('pending route exit proceeds when the write settles with a clean draft',async()=>{
  await mount(<RecordHarness/>);await click('Start saving');void router!.navigate('/other');await until(()=>document.querySelector('dialog[open]')?.textContent?.includes('Saving changes'));
  await click('Finish clean');await until(()=>router!.state.location.pathname==='/other');check(!document.querySelector('dialog[open]'),'Completed save stranded pending exit');
});
await scenario('completed blocked route proceeds when the owner still reports dirty',async()=>{
  await mount(<RecordHarness/>);await click('Start saving');void router!.navigate('/other');
  await until(()=>document.querySelector('dialog[open]')?.textContent?.includes('Saving changes'));
  await click('Finish completed dirty');await until(()=>router!.state.location.pathname==='/other');
  check(document.body.textContent?.includes('Destination')&&!document.querySelector('dialog[open]'),'Completed blocked route remained behind a discard prompt');
});
await scenario('pending route exit retains failed draft and can be cancelled',async()=>{
  await mount(<RecordHarness/>);await click('Start saving');void router!.navigate('/other');await until(()=>document.querySelector('dialog[open]'));
  await click('Finish failed');await until(()=>document.querySelector('dialog[open]')?.textContent?.includes('Discard unsaved changes?'));await click('Stay on this page');check(router!.state.location.pathname==='/record'&&!document.querySelector('dialog[open]'),'Failed save lost its draft');
});
await scenario('saving in place does not exempt fresh edits from route protection',async()=>{
  await mount(<RecordHarness/>);await click('Commit in place');await click('New edit');void router!.navigate('/other');await until(()=>document.querySelector('dialog[open]'));check(router!.state.location.pathname==='/record','Completion allowance leaked into new edits');
});
await scenario('removing a nested draft clears only its own protection under StrictMode',async()=>{
  await mount(<RecordHarness/>);await click('Commit in place');await click('Toggle child');await click('Toggle child');void router!.navigate('/other');await until(()=>router!.state.location.pathname==='/other');check(!document.querySelector('dialog[open]'),'Removed child left hidden draft');
  await mount(<RecordHarness/>);await click('Toggle child');await click('Toggle child');void router!.navigate('/other');await until(()=>document.querySelector('dialog[open]'));check(router!.state.location.pathname==='/record','Nested cleanup erased parent protection');
});
await scenario('late latest-record reload cannot close a different decision',async()=>{
  await mount(<DecisionHarness/>);await click('Save decision');await until(()=>button('Review latest record'));await click('Review latest record');await click('Switch decision');finishReload();await pause();await pause();check(document.querySelector('dialog[open]')?.textContent?.includes('Decision B')&&closeCount===0,'Old reload closed the new decision');
});
await scenario('late latest-record reload cannot close a reopened decision session',async()=>{
  await mount(<DecisionHarness/>);await click('Save decision');await until(()=>button('Review latest record'));await click('Review latest record');await click('Owner closes');await click('Owner reopens');finishReload();await pause();await pause();check(document.querySelector('dialog[open]')?.textContent?.includes('Decision A')&&closeCount===0,'Old reload closed a new session for the same record');
});
await scenario('an older save cannot close or clear the busy state of a newer decision',async()=>{
  await mount(<DecisionHarness delayed/>);await click('Save decision');const finishA=finishWrite;await click('Switch decision');await click('Save decision');const finishB=finishWrite;
  finishA();await pause();check(button('Save decision')?.disabled&&document.querySelector('dialog[open]')?.textContent?.includes('Decision B')&&closeCount===0,'Old result changed new decision state');
  check(![...document.querySelectorAll('[role="status"]')].some(node=>node.textContent==='Saved A'),'Old outcome appeared in new decision');finishB();await until(()=>!document.querySelector('dialog[open]'));check(closeCount===1,'Current decision did not finish once');
});
await scenario('a late same-record conflict remains visibly recoverable after owner close and reopen',async()=>{
  for(const status of [403,409]){
    await mount(<DecisionHarness delayed/>);await click('Save decision');await click('Owner closes');await click('Owner reopens');check(button('Save decision')?.disabled,'Reopened action conceals its pending write');failWrite(status);await pause();await pause();
    check(button('Review latest record')&&document.querySelector('dialog[open]')?.textContent?.includes('Review required for original request'),'Late conflict left an invisible submission block');
    await click('Review latest record');finishReload();await until(()=>!document.querySelector('dialog[open]'));
  }
});
await scenario('completion and confirmed discard have distinct owner callbacks',async()=>{
  await mount(<DecisionHarness callbacks/>);await click('Save decision');await until(()=>!document.querySelector('dialog[open]'));check(completeCount===1&&discardCount===0&&closeCount===0,'Completion used dismissal callback');
  await mount(<DecisionHarness callbacks/>);await click('Cancel');await until(()=>button('Discard changes'));await click('Discard changes');await until(()=>!document.querySelector('dialog[open]'));check(discardCount===1&&completeCount===0&&closeCount===0,'Discard used completion callback');
});
await scenario('latest-record review asks before replacing private dialog edits',async()=>{
  reloads=0;await mount(<DecisionHarness dirtyReview/>);await click('Save decision');await until(()=>button('Review latest record'));await click('Review latest record');
  check(reloads===0&&document.querySelector('dialog[open]')?.textContent?.includes('Replace the information'),'Latest review silently replaced dialog draft');await click('Keep editing');check(reloads===0,'Keep editing started reload');
  await click('Review latest record');await click('Replace and review');check(reloads===1,'Explicit review did not start once');finishReload();await until(()=>!document.querySelector('dialog[open]'));
});
await scenario('decision and exit dialogs associate their consequence text for assistive technology',async()=>{
  await mount(<DecisionHarness/>);let dialog=document.querySelector('dialog[open]')!;check(document.getElementById(dialog.getAttribute('aria-describedby')??'')?.textContent==='Review record','Decision consequence text has no accessible association');
  await mount(<RecordHarness/>);void router!.navigate('/other');await until(()=>document.querySelector('dialog[open]'));dialog=document.querySelector('dialog[open]')!;check(document.getElementById(dialog.getAttribute('aria-describedby')??'')?.textContent?.includes('Your changes have not been saved'),'Exit consequence text has no accessible association');
});
await scenario('dirty voluntary logout resolves before ending the session',async()=>{
  exits=0;await mount(<SessionHarness/>);await click('Sign out');await until(()=>button('Stay signed in'));check(exits===0,'Logout began before draft consent');await click('Stay signed in');check(exits===0&&button('New edit'),'Stay lost the editor');
  await click('Sign out');await click('Discard and sign out');await until(()=>document.body.textContent?.includes('Signed out'));check(exits===1&&!document.querySelector('dialog[open]'),'Logout was repeated or route blocker intercepted authorized exit');
});
await scenario('clean logout is immediate and busy logout waits for write settlement',async()=>{
  exits=0;await mount(<SessionHarness/>);await click('Finish clean');await click('Sign out');await until(()=>document.body.textContent?.includes('Signed out'));check(exits===1&&!document.querySelector('dialog[open]'),'Clean logout asked to discard');
  exits=0;await mount(<SessionHarness/>);await click('Start saving');await click('Sign out');await until(()=>document.querySelector('dialog[open]')?.textContent?.includes('Saving changes'));check(exits===0&&button('Stay signed in')?.disabled,'Pending logout permitted dismissal');await click('Finish clean');await until(()=>document.body.textContent?.includes('Signed out'));check(exits===1,'Clean write did not resolve requested logout');
});
await scenario('failed write retains draft before voluntary logout and expiry remains immediate',async()=>{
  exits=0;await mount(<SessionHarness/>);await click('Start saving');await click('Sign out');await click('Finish failed');await until(()=>button('Discard and sign out'));check(exits===0,'Failed write silently discarded');await click('Stay signed in');
  await click('Sign out');await click('Force expiry');await until(()=>document.body.textContent?.includes('Signed out'));check(exits===0&&!document.querySelector('dialog[open]'),'Expiry was held behind draft consent');
});
await scenario('account change drops the prior exit request and its late callbacks',async()=>{
  exits=0;await mount(<SessionHarness/>);await click('Capture old exit');await click('Sign out');await until(()=>button('Stay signed in'));await click('Change account');await pause();oldExit();await pause();check(exits===0&&!document.querySelector('dialog[open]')&&button('Sign out'),'Previous session exit affected new account');
});
root?.unmount();router?.dispose();
parent.postMessage({type:'shared-exit-results',width:innerWidth,results},location.origin);
