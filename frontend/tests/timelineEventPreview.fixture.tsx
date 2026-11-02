import React from 'react';
import {createRoot} from 'react-dom/client';
import {TimelineCalendar} from '../src/components/TimelineCalendar';
import type {SemesterTimelineEntry} from '../src/types';
const container=document.getElementById('root')!;
const entry:SemesterTimelineEntry={id:1,level:'P1',step:1,title:'Supervisor appointment request',detail:'Students submit appointment of supervisor forms.',action:'Student / Supervisor',deadlineStart:'2026-11-01',deadlineEnd:'2026-11-03',weekLabel:'',targetRoles:['STUDENT','LECTURER'],status:'Upcoming',displayOrder:1,operationalPeriodId:1,linkedPeriodStatus:{lifecycleStatus:'PUBLISHED',scheduleStatus:'UPCOMING',datesEnforced:true}};
const root=createRoot(container);
const wait=async(fn:()=>unknown)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out');};
const results:{name:string;error:string|null}[]=[];
try{
 root.render(<TimelineCalendar groups={[{level:'P1',entries:[entry]}]}/>);
 await wait(()=>[...container.querySelectorAll('button')].some(b=>b.textContent?.includes(entry.title)));
 [...container.querySelectorAll('button')].find(b=>b.textContent?.includes(entry.title))!.click();
 await wait(()=>document.querySelector('dialog[open]'));
 let modal=document.querySelector<HTMLDialogElement>('dialog[open]')!;
 if(!modal.textContent?.includes('Submissions not open yet')||modal.textContent?.includes('Dates enforced')||modal.textContent?.includes('PUBLISHED'))throw Error('Administrative status leaked');
 const labels=[...modal.querySelectorAll('dt')].map(n=>n.textContent);
 if(labels.join('|')!=='Starts on|Ends on|Project phase|Responsible parties')throw Error('Wrong detail order');
 if(modal.scrollWidth>modal.clientWidth+1)throw Error('Modal content overflows');
 modal.querySelector<HTMLButtonElement>('[aria-label="Close timeline details"]')!.click();await wait(()=>!document.querySelector('dialog[open]'));
 root.render(<TimelineCalendar groups={[{level:'P1',entries:[{...entry,linkedPeriodStatus:{...entry.linkedPeriodStatus!,datesEnforced:false}}]}]}/>);
 await new Promise(r=>setTimeout(r,10));
 [...container.querySelectorAll('button')].find(b=>b.textContent?.includes(entry.title))!.click();await wait(()=>document.querySelector('dialog[open]'));
 modal=document.querySelector('dialog[open]')!;
 if(/Submissions|unrestricted|enforced|PUBLISHED|Upcoming/.test(modal.textContent||''))throw Error('Unrestricted event shows a status message');
 if(modal.querySelectorAll('time').length!==2)throw Error('Event dates missing');
 results.push({name:'Plain status, unrestricted silence, detail order, modal close and responsive layout',error:null});
}catch(error){results.push({name:'Timeline event preview',error:String(error)});}
parent.postMessage({type:'periods-workspace-results',results},location.origin);
