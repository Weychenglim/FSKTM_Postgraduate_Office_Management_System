import React,{useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {PortalModal,useModalTitle} from './PortalModal';
import {PortalConfirmModal} from './PortalPrimitives';

/** A focused form composition using the existing portal modal, buttons and confirmations. */
export function SubmissionWindowDialog({title,semesterLabel,dirty,busy,onClose,children,footer,returnFocusId}:{title:string;semesterLabel:string;dirty:boolean;busy:boolean;onClose:()=>void;children:React.ReactNode;footer:(requestClose:()=>void)=>React.ReactNode;returnFocusId?:string}) {
 const titleId=useModalTitle();
 const [discard,setDiscard]=useState(false);
 const body=useRef<HTMLDivElement>(null);
 const origin=useRef({focus:document.activeElement as HTMLElement|null,top:window.scrollY,url:window.location.href});
 useEffect(()=>{body.current?.querySelector<HTMLElement>('input:not(:disabled)')?.focus({preventScroll:true});},[]);
 // Restore after the shared dialog has closed and released its native focus trap.
 useEffect(()=>()=>{queueMicrotask(()=>{
  if(window.location.href!==origin.current.url||document.querySelector('[data-submission-window-dialog]'))return;
  const prior=origin.current.focus;
  const target=prior?.isConnected&&prior!==document.body&&prior!==document.documentElement?prior:returnFocusId?document.getElementById(returnFocusId):null;
  target?.focus({preventScroll:true});window.scrollTo({top:origin.current.top,behavior:'instant'});
 });},[returnFocusId]);
 const requestClose=()=>{if(busy)return;if(dirty)setDiscard(true);else onClose();};
 return <>
  <PortalModal isOpen busy={busy} onClose={requestClose} labelledBy={titleId} className="max-w-[880px] p-0 overflow-hidden overflow-y-hidden overscroll-contain">
   <div ref={body} data-office-dashboard data-submission-window-dialog className="submission-window-dialog flex max-h-[calc(90dvh_-_2px)] flex-col text-sm text-slate-700">
    <header className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-8"><div className="min-w-0"><h2 id={titleId} className="section-heading">{title}</h2><p className="card-description mt-1">{semesterLabel}</p></div><button type="button" className="icon-button h-9 w-9 shrink-0" aria-label="Close submission window" disabled={busy} onClick={requestClose}><X className="h-4 w-4" aria-hidden="true"/></button></header>
    <div data-submission-window-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">{children}</div>
    <footer className="shrink-0 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-8">{footer(requestClose)}</footer>
   </div>
  </PortalModal>
  <PortalConfirmModal isOpen={discard} title="Discard unsaved changes?" message="Your window details have not been saved. Close the form and discard them?" confirmLabel="Discard changes" cancelLabel="Keep editing" isLoading={busy} onConfirm={()=>{if(!busy)onClose();}} onCancel={()=>setDiscard(false)}/>
 </>;
}
