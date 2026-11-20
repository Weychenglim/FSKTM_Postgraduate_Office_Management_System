import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {OperationalHistory} from '../src/components/OperationalPeriodManagement';
import type {OperationalHistoryEvent} from '../src/types/operationalPeriods';
const results:{name:string;error?:string}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
const pause=()=>new Promise(resolve=>setTimeout(resolve,30));
const events=Array.from({length:12},(_,index)=>({id:index+1,action:'UPDATE',reason:`Reason ${index+1}`,actorName:'Office staff',createdAt:`2026-11-${String(index+1).padStart(2,'0')}T01:00:00Z`,before:{name:`Old ${index+1}`},after:{name:`New ${index+1}`}}));
let replace:(rows:OperationalHistoryEvent[])=>void=()=>{};
function Fixture(){const [rows,setRows]=useState<OperationalHistoryEvent[]>(events);replace=setRows;return <div data-office-dashboard className="period-workspace space-y-5">{['Supervisor applications','Panel recommendations','Marks evaluations'].map(name=><article key={name} className="rounded-xl bg-white p-5"><h1 className="text-lg font-semibold mb-4">{name}</h1><details><summary className="cursor-pointer font-semibold">History</summary><div className="pt-5"><OperationalHistory events={rows}/></div></details></article>)}</div>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);await pause();
const scenario=async(name:string,work:()=>Promise<void>)=>{try{await work();results.push({name});}catch(error){results.push({name,error:String(error)});}};
await scenario('All three histories start collapsed and show five newest changes',async()=>{
 const sections=[...document.querySelectorAll('article')];check(sections.length===3,'Window types missing');
 for(const section of sections){const disclosure=section.querySelector('details')!;check(!disclosure.open,'History starts expanded');disclosure.open=true;
  const rows=section.querySelectorAll('ol > li');check(rows.length===5,'History not limited to five');check(rows[0].textContent?.includes('Reason 12'),'Newest entry is not first');check(section.textContent?.includes('Showing 1–5 of 12 changes'),'Range missing');}
 check(document.documentElement.scrollWidth<=innerWidth+1,'History page overflows');
});
await scenario('Each history navigates independently and returns focus to its heading',async()=>{
 const sections=[...document.querySelectorAll('article')];
 for(const section of sections){const buttons=section.querySelectorAll<HTMLButtonElement>('nav button');check(buttons[0].disabled,'Previous enabled on first page');buttons[1].click();await pause();
  check(section.textContent?.includes('Showing 6–10 of 12 changes'),'Second page wrong');check(document.activeElement===section.querySelector('summary'),'Focus not returned to History');
  buttons[1].click();await pause();check(section.querySelectorAll('ol > li').length===2,'Last page should have two entries');check(buttons[1].disabled,'Next enabled on last page');
  buttons[0].click();await pause();check(section.textContent?.includes('Showing 6–10 of 12 changes'),'Previous did not work');}
});
await scenario('Refreshed shorter history resets to first page and hides controls',async()=>{
 replace(events.slice(0,3));await pause();
 for(const section of document.querySelectorAll('article')){check(section.querySelectorAll('ol > li').length===3,'Refreshed history lost entries');check(!section.querySelector('nav'),'Short history has pagination');check(section.querySelector('ol > li')?.textContent?.includes('Reason 3'),'Refresh order incorrect');}
});
await scenario('Empty history is clear and has no page controls',async()=>{
 replace([]);await pause();
 for(const section of document.querySelectorAll('article')){check(section.textContent?.includes('No window changes recorded.'),'Empty history message missing');check(!section.querySelector('nav'),'Empty history has pagination');}
 check(document.documentElement.scrollWidth<=innerWidth+1,'Mobile layout overflows');
});
window.parent.postMessage({type:'period-history-results',results},location.origin);
