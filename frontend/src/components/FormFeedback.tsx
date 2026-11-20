import React from 'react';
import {AlertMessage} from './AlertMessage';
import type {FormFeedbackState} from '../utils/formFeedback';

export function FieldError({id,message}:{id:string;message?:string}) {
  return message?<span id={id} className="block text-sm font-medium leading-relaxed text-rose-800 normal-case tracking-normal">{message}</span>:null;
}

export function FormFeedback({feedback,title='Changes weren’t saved',id,fields={},showFieldSummary=true}:{feedback:FormFeedbackState|null;title?:string;id:string;fields?:Record<string,{id:string;label:string}>;showFieldSummary?:boolean}) {
  if(!feedback)return null;
  const entries=Object.entries(feedback.fields).filter(([key])=>fields[key]);
  return <div id={id} tabIndex={-1} className="min-w-0 focus:outline-none">
    <AlertMessage type="error" title={title} message={feedback.message}>
      {showFieldSummary&&entries.length>1?<ul className="list-disc space-y-1 pl-5">{entries.map(([key,message])=><li key={key}><a className="font-medium underline underline-offset-2" href={`#${fields[key].id}`} onClick={event=>{event.preventDefault();document.getElementById(fields[key].id)?.focus();}}>{fields[key].label}: {message}</a></li>)}</ul>:null}
    </AlertMessage>
  </div>;
}
