import React,{useEffect,useState} from 'react';
import {FilePenLine} from 'lucide-react';
import {getEvaluationTasks,getSubmittedEvaluations} from '../services/marksApi';
import {appointmentMarkingShortcut,mergeMarkingTasks,type AppointmentMarkingTarget} from '../utils/appointmentMarking';
import {PortalButton} from './PortalPrimitives';

/** Only rendered in a Lecturer detail host; the API scopes tasks to the signed-in evaluator. */
export function AppointmentMarkingAction({studentId,role,onOpen,busy=false}:{studentId:string;role:AppointmentMarkingTarget['role'];onOpen:(target:AppointmentMarkingTarget)=>void;busy?:boolean}) {
  const [state,setState]=useState<{key:string;shortcut:ReturnType<typeof appointmentMarkingShortcut>;error:boolean}|null>(null);
  const [attempt,setAttempt]=useState(0);
  const key=`${role}:${studentId}`;
  useEffect(()=>{
    let current=true;
    setState(null);
    Promise.all([getEvaluationTasks(),getSubmittedEvaluations()]).then(([active,submitted])=>{
      if(current)setState({key,shortcut:appointmentMarkingShortcut(mergeMarkingTasks(active,submitted),studentId,role),error:false});
    }).catch(()=>{if(current)setState({key,shortcut:null,error:true});});
    return ()=>{current=false;};
  },[studentId,role,attempt]);
  if(!state||state.key!==key)return null;
  if(state.error)return <div className="space-y-2"><p className="text-xs leading-6 text-slate-600">Marking availability could not be checked.</p><PortalButton size="sm" disabled={busy} onClick={()=>setAttempt(value=>value+1)}>Retry marking check</PortalButton></div>;
  const shortcut = state.shortcut;
  return shortcut?<PortalButton variant="primary" icon={FilePenLine} size="sm" disabled={busy} onClick={()=>onOpen(shortcut.target)}>{shortcut.label}</PortalButton>:null;
}
