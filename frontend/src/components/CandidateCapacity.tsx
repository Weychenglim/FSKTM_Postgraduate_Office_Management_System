import React from 'react';
import type {AppointmentCapacityMetadata} from '../types';
import {StatusBadge} from './PortalPrimitives';

type CapacityProps = Pick<AppointmentCapacityMetadata,'capacityState'|'availableSlots'|'selectable'> & {
  role:'Supervisor'|'Panel'; limit?:number; load?:number;
};

/** Display only: eligibility and capacity enforcement remain on the server. */
export function CandidateCapacity({role,capacityState,availableSlots,selectable,limit,load}:CapacityProps){
  const configured=limit!=null&&limit>0;
  const remaining=availableSlots??(configured&&load!=null?Math.max(0,limit-load):undefined);
  let text:string;
  if(capacityState==='NOT_CONFIGURED'||(!capacityState&&!configured))text='Availability not configured';
  else if(capacityState==='TEMPORARILY_UNAVAILABLE')text='Temporarily unavailable';
  else if(capacityState==='INELIGIBLE')text='Unavailable for new requests';
  else if(capacityState==='OVER_CAPACITY')text='Over capacity';
  else if(capacityState==='FULL'||remaining===0)text=`No ${role} places available`;
  else if(selectable===false)text='Unavailable for new requests';
  else if(remaining!=null)text=`${remaining} ${role} ${remaining===1?'place':'places'} remaining`;
  else text='Capacity unavailable';
  const available=remaining!=null&&remaining>0&&selectable!==false&&(!capacityState||capacityState==='AVAILABLE');
  return <StatusBadge tone={available?(remaining===1?'warning':'success'):'neutral'}>{text}</StatusBadge>;
}

export function CandidateCapacityBreakdown({activeLoad,reservedLoad,limit}:Pick<AppointmentCapacityMetadata,'activeLoad'|'reservedLoad'>&{limit?:number}){
  const facts=[activeLoad!=null?`${activeLoad} active`:null,reservedLoad!=null?`${reservedLoad} awaiting Coordinator approval`:null,limit!=null?`Limit ${limit}`:null].filter(Boolean);
  return facts.length?<p className="card-description">{facts.join(' · ')}</p>:null;
}
