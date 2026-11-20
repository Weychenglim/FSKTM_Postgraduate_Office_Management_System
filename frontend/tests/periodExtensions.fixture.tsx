import React,{useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {PeriodExtensions} from '../src/components/PeriodExtensions';
import {RecordPage,RecordPageProvider} from '../src/components/RecordPage';
import '../src/components/officeDashboard.css';

const results:{name:string;error?:string}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
const text=()=>document.body.innerText;
const until=async(test:()=>unknown)=>{for(let i=0;i<300;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error(`Timed out: ${text().slice(-800)}`);};
const click=async(label:string)=>{const node=[...document.querySelectorAll<HTMLButtonElement>('button')].find(node=>!node.closest('[hidden]')&&(node.textContent?.trim()===label||node.getAttribute('aria-label')===label));check(node,`Missing ${label}`);node!.click();await new Promise(resolve=>setTimeout(resolve,20));};
const input=(node:HTMLInputElement|HTMLTextAreaElement,value:string)=>{Object.getOwnPropertyDescriptor(node instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));};
const event={id:4,action:'EXTEND',reason:'Faculty approved extra review time',actorName:'Test Office',createdAt:'2026-11-09T01:00:00Z',before:{closesAt:'2026-11-10T09:00:00Z'},after:{closesAt:'2026-11-20T09:00:00Z',programmeScope:'ALL'}};
const makeGrants=()=>Array.from({length:12},(_,index)=>({id:index+1,taskId:index+40,studentId:`S${100+index}`,studentName:`Student ${index+1}`,programme:index%2?'Programme B':'Programme A',evaluatorName:'Test Lecturer',evaluatorRole:index%2?'Panel':'Supervisor',deadline:'2026-11-22T09:00:00Z',status:index===1?'EXPIRED':'ACTIVE',reason:`Approved for student ${index+1}`,grantedBy:{id:1,name:'Test Office'},createdAt:'2026-11-09T01:00:00Z',canRevoke:index!==1,submissionStatus:index===1?'SUBMITTED':'DRAFT',revokedAt:null,revocationReason:'',supersedesId:null}));
let grants=makeGrants(),fail=false,writes:unknown[]=[],root:Root|null=null;
window.fetch=async(url,init)=>{
 const path=new URL(String(url),location.origin).pathname;
 if(init?.method==='POST'){writes.push(JSON.parse(String(init.body)));const id=Number(path.split('/').at(-3));grants=grants.map(item=>item.id===id?{...item,status:'REVOKED',canRevoke:false,revocationReason:'Office correction'}:item);return Response.json({});}
 if(fail)return Response.json({error:'Synthetic read failure'},{status:503});
 if(path.includes('completion-windows'))return Response.json({windows:grants});
 if(path.includes('/exceptions/'))return Response.json({exceptions:[{id:1,studentId:7,studentName:'Appointment Student',matricNo:'AP001',programme:'Programme A',participantId:2,participantName:'Participant One',deadline:'2026-11-22T09:00:00Z',reason:'Approved appointment extra time',status:'ACTIVE',createdAt:'2026-11-09T01:00:00Z',canRevoke:true,grantedBy:{id:1,name:'Test Office'}}]});
 return Response.json({auditEvents:[event,{...event,id:5,createdAt:'2026-11-08T01:00:00Z'},{...event,id:6,createdAt:'2026-11-07T01:00:00Z'}].map(item=>({...item,beforeValues:item.before,afterValues:item.after}))});
};
function Harness({kind='marks'}:{kind?:'marks'|'appointment'}) {
 const [expanded,setExpanded]=useState(false);
 return <RecordPageProvider><RecordPage title={expanded?'Extension details':'Test evaluation period'} backLabel={expanded?'Back to period':'Back to periods'} onBack={()=>setExpanded(false)}>
  <div data-office-dashboard className="period-workspace space-y-5"><PeriodExtensions kind={kind} periodId={4} periodName="Test evaluation period" coverage="All programmes" semesterLabel="Semester 1 2026/2027" events={[event]} expanded={expanded} onOpen={()=>setExpanded(true)} refreshing={false} onChanged={async()=>{}}/></div>
 </RecordPage></RecordPageProvider>;
}
const mount=async(kind:'marks'|'appointment'='marks')=>{root?.unmount();document.getElementById('root')!.innerHTML='';root=createRoot(document.getElementById('root')!);root.render(<Harness kind={kind}/>);await until(()=>!text().includes('Loading extensions')&&!!document.querySelector('h1'));};
const scenario=async(name:string,work:()=>Promise<void>)=>{try{await work();results.push({name});}catch(error){results.push({name,error:String(error)});}};
await scenario('Compact summary and full page preserve context',async()=>{
 await mount();check(text().includes('11 active grants')&&text().includes('1 previous grant'),'Grant counts incorrect');
 check(text().includes('3 deadline changes'),'Multiple deadline changes not counted');
 await click('View deadline changes');check(!!document.querySelector('section[aria-label="Deadline changes"]'),'Deadline row did not open deadline history');
 check(document.querySelectorAll('section[aria-label="Deadline changes"] li').length===3,'Deadline history omitted entries');await click('Back to period');
 check(!text().includes('Select task'),'Task dropdown remains');await click('View individual extra time');
 check(text().includes('Extension details')&&text().includes('Semester 1 2026/2027'),'Details context missing');check(writes.length===0,'Opening details mutated data');
 check(document.documentElement.scrollWidth<=innerWidth+1,'Details page overflows');
});
await scenario('Search filters students and survives a return to period',async()=>{
 const search=document.querySelector<HTMLInputElement>('input[type="search"]')!;input(search,'S100');await until(()=>text().includes('1 grant'));
 check(document.querySelectorAll('section[aria-label="Individual extra time"] details').length===1,'Search did not narrow grants');
 await click('Back to period');await click('View individual extra time');check(document.querySelector<HTMLInputElement>('input[type="search"]')!.value==='S100','Search was lost');await click('Clear filters');
});
await scenario('Programme and extension status filters combine',async()=>{
 const selects=[...document.querySelectorAll<HTMLSelectElement>('select')];
 for(const [index,value] of [[0,'Programme B'],[1,'EXPIRED']] as const){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(selects[index],value);selects[index].dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,20));}
 check(document.querySelectorAll('section[aria-label="Individual extra time"] details').length===1,'Combined filters did not narrow grants');
 check(text().includes('Student 2'),'Wrong grant filtered');await click('Clear filters');
});
await scenario('Pagination and expanded details separate submission status',async()=>{
 await click('Next');check(text().includes('Student 12'),'Next page missing');await click('Previous');
 const rows=document.querySelectorAll<HTMLDetailsElement>('section[aria-label="Individual extra time"] details');rows[1].open=true;
 check(rows[1].textContent?.includes('Submission status: Submitted'),'Submission status missing');check(!rows[1].querySelector('button'),'Expired grant can be revoked');rows[1].open=false;
});
await scenario('Deadline changes show before, after, reason and actor',async()=>{
 await click('Deadline changes');check(text().includes('Previous deadline')&&text().includes('New deadline'),'Deadline comparison missing');check(text().includes('Faculty approved extra review time')&&text().includes('Changed by Test Office'),'Audit context missing');await click('Individual extra time');
});
await scenario('Revocation requires reason and refreshes summary',async()=>{
 const row=document.querySelector<HTMLDetailsElement>('section[aria-label="Individual extra time"] details')!;row.open=true;await click('Revoke extra time');
 await until(()=>document.querySelector('dialog[open]'));const dialog=document.querySelector<HTMLDialogElement>('dialog[open]')!;
 check([...dialog.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Revoke extra time')?.disabled,'Reason is optional');
 input(dialog.querySelector('textarea')!,'Office correction');await new Promise(resolve=>setTimeout(resolve,20));dialog.querySelectorAll('button').forEach(button=>{if(button.textContent?.trim()==='Revoke extra time')button.click();});
 await until(()=>!document.querySelector('dialog[open]'));check(writes.length===1,'Revocation did not write exactly once');await click('Back to period');await until(()=>text().includes('10 active grants'));
});
await scenario('Read failure offers recovery without false zero counts',async()=>{
 fail=true;await mount();await until(()=>text().includes('Synthetic read failure'));check(!text().includes('No extensions yet'),'Failure shown as empty state');fail=false;await click('Retry');await until(()=>text().includes('10 active grants'));
});
await scenario('Submission windows display student ID, programme and participant',async()=>{
 await mount('appointment');await click('View individual extra time');check(text().includes('Appointment Student')&&text().includes('AP001')&&text().includes('Participant One'),'Appointment identity missing');
 check(document.documentElement.scrollWidth<=innerWidth+1,'Mobile page overflows');
 // Leave a populated marks page for the runner screenshot.
 grants=makeGrants();await mount();await click('View deadline changes');
});
window.parent.postMessage({type:'period-extensions-results',results},location.origin);
