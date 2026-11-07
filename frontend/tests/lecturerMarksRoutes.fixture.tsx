import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createMemoryRouter, RouterProvider, useLocation} from 'react-router';
import {LecturerMarksEntry} from '../src/components/LecturerMarksEntry';
import {ListState} from '../src/components/ListState';
import {RecordPageProvider} from '../src/components/RecordPage';

const component = {id:1,code:'research',name:'Research quality',description:'Assess the research',maxMarks:'100',required:true,isActive:true,displayOrder:1,marksAwarded:null,feedback:''};
const base:any = {id:1,studentId:'S1',studentName:'Test Student',initials:'TS',researchTitle:'Research title',semester:'Semester I',status:'NOT STARTED',evaluatorRole:'SUPERVISOR',taskLifecycleStatus:'ACTIVE',writeVersion:'a'.repeat(64),canEdit:true,canSubmit:true,deadline:'Tomorrow',deadlineState:'UPCOMING',components:[component],comments:''};
let saved = {...base};
const submitted:any = {...base,id:2,studentName:'Panel Student',studentId:'S2',evaluatorRole:'PANEL',status:'SUBMITTED',taskLifecycleStatus:'RETIRED',canEdit:false,canSubmit:false,totalMark:'80',submittedAt:'2026-11-03T01:00:00Z',components:[{...component,marksAwarded:'80',feedback:'Good work'}]};
let failRead = false;
window.fetch = async (input, init) => {
  const path = new URL(String(input), location.origin).pathname;
  if (path.endsWith('/my-evaluation-tasks/')) return Response.json(failRead ? {detail:'Temporarily unavailable'} : [saved], {status:failRead?503:200});
  if (path.endsWith('/my-submitted-evaluations/')) return Response.json([submitted]);
  if (path.endsWith('/tasks/1/draft/')) {
    const data = JSON.parse(String(init?.body));
    saved = {...saved,status:'DRAFT SAVED',components:[{...component,marksAwarded:data.scores[0].marksAwarded,feedback:data.scores[0].feedback}],comments:data.comments};
    return Response.json(saved);
  }
  throw Error(`Unexpected fixture request ${path}`);
};
const results:{name:string;error?:string}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const pause=()=>new Promise(resolve=>setTimeout(resolve,20));
const until=async(predicate:()=>unknown)=>{for(let i=0;i<250;i++){if(predicate())return;await pause();}throw Error('Timed out: '+document.body.textContent?.slice(-350));};
const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.textContent?.trim()===label);
const click=async(label:string)=>{check(button(label),'Missing '+label);button(label)!.click();await pause();};
const type=async(node:HTMLInputElement,value:string)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));await pause();};
let root:Root|undefined;
let router:ReturnType<typeof createMemoryRouter>;
function Host(){const location=useLocation();return <LecturerMarksEntry key={location.pathname+location.search} contextSearch={location.search}/>;}
async function mount(path:string){
  root?.unmount();router?.dispose();
  router=createMemoryRouter([{path:'*',element:<ListState.Provider value={new Map()}><RecordPageProvider><Host/></RecordPageProvider></ListState.Provider>}],{initialEntries:[path]});
  root=createRoot(document.getElementById('root')!);root.render(<RouterProvider router={router}/>);await pause();
}
async function scenario(name:string,work:()=>Promise<void>){try{await work();results.push({name});}catch(error){results.push({name,error:String(error)});}}

await scenario('task URL, browser Back and draft guard preserve list filters',async()=>{
  await mount('/marks?role=SUPERVISOR');await until(()=>button('Start marking'));
  await type(document.querySelector<HTMLInputElement>('#lecturer-marks-search')!,'Test');
  await click('Start marking');await until(()=>button('Save draft'));
  check(router.state.location.pathname==='/marks/tasks/1','Task URL did not change');
  check(!router.state.location.state?.portalRecordPage,'Synthetic duplicate history entry');
  await type(document.querySelector<HTMLInputElement>('input[type="number"]')!,'70');
  void router.navigate(-1);await until(()=>button('Stay on this page'));await click('Stay on this page');
  check(router.state.location.pathname==='/marks/tasks/1','Cancelled navigation left task');
  check(document.querySelector<HTMLInputElement>('input[type="number"]')?.value==='70','Draft lost');
  void router.navigate(-1);await until(()=>button('Discard changes'));await click('Discard changes');
  await until(()=>button('Start marking'));
  check(document.querySelector<HTMLInputElement>('#lecturer-marks-search')?.value==='Test','List filter lost');
  await router.navigate(1);await until(()=>button('Save draft'));
  check(router.state.location.pathname==='/marks/tasks/1','Browser Forward did not restore the task');
});
await scenario('direct task URL and refresh restore saved draft',async()=>{
  await mount('/marks/tasks/1');await until(()=>button('Save draft'));
  await type(document.querySelector<HTMLInputElement>('input[type="number"]')!,'72');await click('Save draft');await until(()=>saved.status==='DRAFT SAVED');await pause();
  await mount('/marks/tasks/1');await until(()=>button('Save draft'));
  check(document.querySelector<HTMLInputElement>('input[type="number"]')?.value==='72','Refresh did not restore draft');
  await click('Back to Marks Entry');await until(()=>button('Continue marking'));
  check(router.state.location.pathname==='/marks','Direct-link return did not reach list');
});
await scenario('history has a URL and can open retired submitted tasks',async()=>{
  await mount('/marks/history?role=PANEL');await until(()=>button('View submission'));
  await click('View submission');await until(()=>document.body.textContent?.includes('Submitted Mark Detail'));
  check(router.state.location.pathname==='/marks/tasks/2','History task URL missing');
  check(document.body.textContent?.includes('Panel Student'),'Wrong submitted record');
  await click('Back to Marks Entry History');await until(()=>button('View submission'));
  check(router.state.location.pathname==='/marks/history','History return lost');
  await mount('/marks/tasks/2');await until(()=>document.body.textContent?.includes('Submitted Mark Detail'));
});
await scenario('unknown or malformed task URL never opens another task',async()=>{
  for(const path of ['/marks/tasks/999','/marks/tasks/invalid']){
    await mount(path);await until(()=>document.body.textContent?.includes(path.endsWith('invalid')?'Marking page not found':'Marking task unavailable'));
    check(!button('Save draft'),'Unavailable task opened editor');
  }
});
await scenario('legacy appointment shortcut redirects to canonical exact task',async()=>{
  await mount('/marks?student=S1&role=SUPERVISOR&task=1');await until(()=>button('Save draft'));
  check(router.state.location.pathname==='/marks/tasks/1','Legacy URL not redirected');
  check(!new URLSearchParams(router.state.location.search).has('task'),'Duplicate task query retained');
  await mount('/marks/tasks/1?student=S2&role=SUPERVISOR');await until(()=>document.body.textContent?.includes('Marking task unavailable'));
});
await scenario('read failure can retry the exact routed task',async()=>{
  failRead=true;await mount('/marks/tasks/1');await until(()=>button('Retry'));
  check(!button('Save draft'),'Read failure opened stale editor');failRead=false;await click('Retry');await until(()=>button('Save draft'));
  check(router.state.location.pathname==='/marks/tasks/1','Retry changed task URL');
});
document.getElementById('test-results')!.textContent=JSON.stringify(results);
