import React from 'react';
import { TimeField } from './DateFields';

/** One schedule value, with date-only import and explicit required clock time. */
export function SubmissionScheduleField({id,label,value,onChange}:{id:string;label:string;value:string;onChange:(value:string)=>void}) {
  const [date='',time='']=value.split('T');
  const change=(nextDate:string,nextTime:string)=>onChange(nextDate||nextTime?`${nextDate}T${nextTime}`:'');
  return <fieldset className="min-w-0 space-y-2"><legend className="font-semibold text-slate-900 mb-2">{label}</legend>
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3">
      <label className="form-label block" htmlFor={`${id}-date`}>Date<input id={`${id}-date`} type="date" className="form-control form-control-md mt-2" required value={date} onChange={event=>change(event.target.value,time)}/></label>
      <div className="min-w-0"><label className="form-label block mb-2" htmlFor={`${id}-time`}>Time</label><TimeField id={`${id}-time`} required value={time} onChange={nextTime=>change(date,nextTime)}/></div>
    </div>
  </fieldset>;
}
