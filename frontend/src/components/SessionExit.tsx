import React, {createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState} from 'react';
import {PortalConfirmModal} from './PortalPrimitives';

type ExitDraft = {dirty:boolean;busy:boolean;allow:React.RefObject<boolean>};
type ReportDraft = (key:symbol,draft:ExitDraft|null)=>void;
const SessionDrafts = createContext<ReportDraft|null>(null);
type SessionExitProps = {scopeKey:string;children:(requestExit:(action:()=>void)=>void)=>React.ReactNode};

/** Voluntary session exit must resolve drafts before auth state is cleared. */
export function SessionExitProvider({scopeKey,children}:SessionExitProps) {
  return <SessionExitScope key={scopeKey}>{children}</SessionExitScope>;
}

function SessionExitScope({children}:Pick<SessionExitProps,'children'>) {
  const drafts=useRef(new Map<symbol,ExitDraft>());
  const [,changed]=useReducer(value=>value+1,0);
  const [requested,setRequested]=useState(false);
  const pending=useRef<(()=>void)|null>(null);
  const exiting=useRef(false),mounted=useRef(false);
  useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pending.current=null;};},[]);
  const report=useCallback<ReportDraft>((key,draft)=>{
    const old=drafts.current.get(key);
    if(draft?old?.dirty===draft.dirty&&old?.busy===draft.busy&&old?.allow===draft.allow:!old)return;
    if(draft)drafts.current.set(key,draft);else drafts.current.delete(key);
    changed();
  },[]);
  const states=[...drafts.current.values()];
  const dirty=states.some(draft=>draft.dirty&&!draft.allow.current),busy=states.some(draft=>draft.busy);
  const proceed=useCallback(()=>{
    if(!mounted.current||exiting.current||[...drafts.current.values()].some(draft=>draft.busy))return;
    const action=pending.current;if(!action)return;
    exiting.current=true;pending.current=null;setRequested(false);
    for(const draft of drafts.current.values())draft.allow.current=true;
    action();
  },[]);
  const requestExit=useCallback((action:()=>void)=>{
    if(!mounted.current||exiting.current||pending.current)return;
    pending.current=action;
    if([...drafts.current.values()].some(draft=>draft.busy||(draft.dirty&&!draft.allow.current)))setRequested(true);
    else proceed();
  },[proceed]);
  useEffect(()=>{if(requested&&!busy&&!dirty)proceed();},[requested,busy,dirty,proceed]);
  return <SessionDrafts.Provider value={report}>
    {children(requestExit)}
    <PortalConfirmModal isOpen={requested} title={busy?'Saving changes':'Discard unsaved changes and sign out?'}
      message={busy?'Please wait for the current operation to finish.':'Your unsaved changes will be discarded when you sign out.'}
      confirmLabel="Discard and sign out" cancelLabel="Stay signed in" isLoading={busy}
      onCancel={()=>{if(!busy){pending.current=null;setRequested(false);}}} onConfirm={proceed}/>
  </SessionDrafts.Provider>;
}

/** Observe the owning page's aggregate; this adds no router blocker. */
export function useSessionExitDraft(dirty:boolean,busy:boolean,allow:React.RefObject<boolean>) {
  const report=useContext(SessionDrafts),key=useRef(Symbol('session-draft'));
  const state=useMemo(()=>({dirty,busy,allow}),[dirty,busy,allow]);
  useLayoutEffect(()=>{report?.(key.current,state);},[report,state]);
  useLayoutEffect(()=>()=>report?.(key.current,null),[report]);
}
