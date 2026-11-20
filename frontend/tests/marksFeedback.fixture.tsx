import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {RubricsManagementView} from '../src/components/RubricsManagementView';
import {LecturerMarksEntry} from '../src/components/LecturerMarksEntry';
import {ListState} from '../src/components/ListState';
import {MarksCompletionWindows} from '../src/components/MarksCompletionWindows';
import {SubmittedMarksActions} from '../src/components/SubmittedMarksActions';
import type {EvaluationTask,EvaluationPreviewTask} from '../src/types';

const results:{name:string;error?:string}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const pause=()=>new Promise(r=>setTimeout(r,20));
const until=async(test:()=>unknown)=>{for(let i=0;i<200;i++){if(test())return;await pause();}throw Error('Timeout '+document.body.textContent?.slice(-400));};
const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(n=>n.textContent?.trim()===label)!;
const click=async(label:string)=>{check(button(label),'Missing '+label);button(label).click();await pause();};
const enter=async(node:HTMLInputElement|HTMLTextAreaElement,value:string)=>{check(node,'Missing field');Object.getOwnPropertyDescriptor(node instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));await pause();};
const component={id:3,code:'research',name:'Research',description:'Research quality',maxMarks:'100',required:true,isActive:true,displayOrder:1,marksAwarded:null,feedback:''};
const rubric={id:1,familyCode:'RES',name:'Research rubric',description:'Original description',version:1,isActive:true,isReady:true,isLocked:false,allowedEvaluatorRoles:['SUPERVISOR'],targetMark:'100',componentTotal:'100',components:[component]};
const task:EvaluationTask={writeVersion:'a'.repeat(64),id:4,studentId:'PG001',studentName:'Test Student',initials:'TS',researchTitle:'Research project',semester:'Semester I',status:'NOT STARTED',canEdit:true,canSubmit:true,deadlineState:'UPCOMING',deadline:'Tomorrow',components:[component],comments:''};
let savedDraft: EvaluationTask | null = null;
let root:Root|null=null,mode='',writes=0,reads=0,historyReads=0,activeTaskReads=0,submissionRefs:string[]=[],postBodies:any[]=[];
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
window.fetch=async(url,options={})=>{const path=new URL(String(url),location.origin).pathname,method=options.method??'GET';
 if(path.endsWith('/my-evaluation-tasks/')){activeTaskReads++;return response([['reloadchanged','draftconflict'].includes(mode)&&activeTaskReads>1?{...task,writeVersion:'b'.repeat(64),status:'DRAFT SAVED',components:[{...component,marksAwarded:'90.00',feedback:'Latest saved feedback'}],comments:'Latest saved comments'}:savedDraft??task]);}
 if(path.endsWith('/my-submitted-evaluations/'))return mode==='lecturerhistoryfail'?response({detail:'Submitted evaluations unavailable.'},500):response([]);
 if(path.endsWith('/submit/')){writes++;postBodies.push(JSON.parse(String(options.body)));submissionRefs.push(postBodies.at(-1).submissionId);if(mode==='reloadchanged')return response({detail:'The record changed. Review the latest record.'},409);if(mode==='retrylost'&&submissionRefs.length===1)throw new TypeError('Submission response was interrupted. Try again.');return response({...task,status:'SUBMITTED',canEdit:false,canSubmit:false,totalMark:'75'});}
 if(path.endsWith('/correct/')||path.endsWith('/reopen/')||path.endsWith('/revoke/')||path.endsWith('/marks/completion-windows/')){writes++;postBodies.push(JSON.parse(String(options.body)));if(mode==='officeconflict'&&writes===1)return response({detail:'The record changed.'},409);return response({});}
 if(path.endsWith('/draft/')){
  writes++;
  if(mode==='draftfail')return response({detail:'Draft service unavailable.'},500);
  if(['reloadchanged','draftconflict'].includes(mode))return response({detail:'The record changed. Review the latest record.'},409);
  const {scores,comments}=JSON.parse(String(options.body));
  const score=scores.find((item:{componentId:number})=>item.componentId===component.id);
  savedDraft={...task,status:'DRAFT SAVED',components:[{...component,marksAwarded:score?.marksAwarded,feedback:score?.feedback}],comments};
  return response(savedDraft);
 }
 if(path.endsWith('/completion-windows/')){historyReads++;return mode==='historyfail'||mode==='windowretry'&&historyReads>1?response({detail:'History unavailable.'},500):response({windows:['windowrevoke','windowretry'].includes(mode)?[{id:19,taskId:4,deadline:'2030-02-01T04:00:00Z',status:'ACTIVE',reason:'Earlier grant',grantedBy:{id:1,name:'Office'},createdAt:'2026-10-01T04:00:00Z',revokedAt:null,revocationReason:'',supersedesId:null,canRevoke:true}]:[]});}
 if(method!=='GET'){writes++;if(mode==='rubricfail')return response({target_mark:['Target must match the configured total.']},400);if(mode==='componentfail')return response({max_marks:['Maximum must be positive.']},400);return response({...rubric,...JSON.parse(options.body as string)});}
 if(path.endsWith('/rubrics/')){reads++;return mode==='readfail'?response({detail:'Rubrics unavailable.'},500):response([rubric]);}
 if(path.endsWith('/rubrics/1/'))return mode==='selectfail'||mode==='componentrefreshfail'&&writes?response({detail:'Version unavailable.'},500):response(rubric);
 throw Error('Unexpected '+path);
};
const officeRecord:any={recordId:'MRK-4',student:{name:'Test Student',studentId:'PG001'},evaluator:{name:'Dr Office'},entry:{status:'SUBMITTED',comments:'Original',totalMark:'80.00'},rubric:{targetMark:'100.00',components:[{id:3,name:'Research',marksAwarded:'30.00',maxMarks:'40.00',feedback:'Clarify the research question.'},{id:5,name:'Writing',marksAwarded:'50.00',maxMarks:'60.00',feedback:''}]},officeActions:{canCorrect:true,canReopen:true,version:'v1'}};
function OfficeHost(){const [record,setRecord]=React.useState(officeRecord);return <SubmittedMarksActions record={record} onChanged={async()=>{}} onReload={async()=>{reads++;if(mode==='officereadfail')throw Error('Latest record unavailable');if(mode==='officeconflict')setRecord({...officeRecord,entry:{...officeRecord.entry,comments:'Concurrent edit',totalMark:'85.00'},rubric:{components:[{...officeRecord.rubric.components[0],marksAwarded:'35.00'},officeRecord.rubric.components[1]]},officeActions:{...officeRecord.officeActions,version:'v2'}});}}/>}
const mount=async(nextMode:string,view='rubrics')=>{root?.unmount();savedDraft=null;mode=nextMode;writes=0;reads=0;historyReads=0;activeTaskReads=0;submissionRefs=[];postBodies=[];root=createRoot(document.getElementById('root')!);root.render(<MemoryRouter initialEntries={[view==='lecturer'&&nextMode==='lecturerhistoryfail'?'/marks/history':'/marks']}>{view==='lecturer'?<ListState.Provider value={new Map()}><LecturerMarksEntry/></ListState.Provider>:view==='windows'?<MarksCompletionWindows tasks={[{id:'task-4',taskId:4,studentId:'PG001',studentName:'Test Student',researchTitle:'Research project',semester:'Semester I',panelMember:'Dr Same',evaluatorRole:'SUPERVISOR',canGrantCompletionWindow:true,status:'NOT_STARTED'} satisfies EvaluationPreviewTask,{id:'task-5',taskId:5,studentId:'PG001',studentName:'Test Student',researchTitle:'Research project',semester:'Semester II',panelMember:'Dr Same',evaluatorRole:'PANEL',canGrantCompletionWindow:true,status:'NOT_STARTED'} satisfies EvaluationPreviewTask]} onChanged={async()=>{}}/>:view==='office'?<OfficeHost/>:<RubricsManagementView onBack={()=>{}}/>}</MemoryRouter>);await until(()=>view==='lecturer'?nextMode==='lecturerhistoryfail'?button('Retry'):button('Start marking'):view==='windows'?button('History'):view==='office'?button('Correct submitted marks'):nextMode==='readfail'?button('Retry'):button('Manage rubric'));};
const openRubric=async()=>{await click('Manage rubric');await until(()=>button('Edit details'));};
const openComponent=async()=>{await openRubric();await click('Add component');await until(()=>document.querySelector('dialog[open] form'));};
const saveComponent=()=>document.querySelector<HTMLButtonElement>('dialog[open] button[type=submit]')!.click();
const scenario=async(name:string,work:()=>Promise<void>)=>{try{await work();results.push({name});}catch(error){results.push({name,error:String(error)});}};
await scenario('rubric field failure stays in its form with input and focus',async()=>{await mount('rubricfail');await openRubric();await click('Edit details');await until(()=>button('Save version'));const form=document.querySelector('dialog[open] form')!;const field=form.querySelector('input[type="number"]') as HTMLInputElement;await enter(field,'101');await click('Save version');await until(()=>writes===1&&document.querySelector('[role="alert"]'));check(form.querySelector('[role="alert"]'),'Rubric failure outside form');check(!document.body.textContent?.includes('Couldn’t load data'),'Mutation shown as load error');check(field.value==='101','Input lost');check(field.getAttribute('aria-invalid')==='true','Explicit field error not marked');await until(()=>document.activeElement===field);mode='';await click('Save version');await until(()=>writes===2&&!form.querySelector('[role="alert"]'));});
await scenario('component field failure belongs to component form',async()=>{await mount('componentfail');await openComponent();const field=document.querySelector('input[placeholder="Maximum mark"]') as HTMLInputElement;await enter(document.querySelector('input[placeholder="Code"]')!,'extra');await enter(document.querySelector('input[placeholder="Component name"]')!,'Extra');await enter(field,'10');saveComponent();await until(()=>writes===1&&document.querySelector('[role="alert"]'));check(field.closest('form')?.querySelector('[role="alert"]'),'Component failure outside component form');check(field.value==='10','Component input lost');check(field.getAttribute('aria-invalid')==='true','Maximum field not marked');});
await scenario('rubric list failure retries the list',async()=>{await mount('readfail');const before=reads;mode='';await click('Retry');await until(()=>button('Manage rubric'));check(reads>before&&writes===0,'Retry mutated or skipped list read');});
await scenario('version detail failure preserves form and retries detail',async()=>{await mount('selectfail');await click('Manage rubric');await until(()=>document.querySelector('[role="alert"]'));check(button('Manage rubric'),'Version read failure discarded the family list');check(!document.querySelector('dialog[open] form'),'Version read failure opened an editor');mode='';await click('Retry');await until(()=>button('Edit details')&&!document.querySelector('[role="alert"]'));});
await scenario('draft failure stays by Save draft and retains evaluator input',async()=>{await mount('draftfail','lecturer');await click('Start marking');await until(()=>button('Save draft'));const mark=document.querySelector('input[type="number"]') as HTMLInputElement;await enter(mark,'75');const feedback=document.querySelector('textarea')!;await enter(feedback,'Keep this feedback');await click('Save draft');await until(()=>writes===1&&document.querySelector('[role="alert"]'));check(button('Save draft'),'Editor closed on failed draft');check(document.querySelector('[role="alert"]')?.textContent?.includes('Draft service unavailable.'),'Draft error missing from marking editor');check(mark.value==='75'&&feedback.value==='Keep this feedback','Draft input lost');check(!button('Save draft').disabled,'Save not reenabled');mode='';await click('Save draft');await until(()=>writes===2&&document.body.textContent?.includes('Draft saved'));check(button('Save draft'),'Successful draft should keep the editor open');check(mark.value==='75','Saved scores lost');check(!document.body.textContent?.includes('Unsaved changes'),'Successful save must clear dirty state');await click('Back to Marks Entry');await until(()=>!button('Save draft'));check(!button('Discard changes'),'Saved draft triggered a discard prompt');check(button('Continue marking'),'Saved draft did not update the task action');});
await scenario('review latest record replaces stale scores, feedback and dirty baseline',async()=>{await mount('reloadchanged','lecturer');await click('Start marking');await until(()=>button('Save draft'));await enter(document.querySelector('input[type="number"]')!,'75');await enter(document.querySelector('textarea')!,'Stale feedback');await click('Submit marks');await click('Submit and lock marks');await until(()=>button('Review latest record'));await click('Review latest record');await click('Keep editing');check((document.querySelector('input[type="number"]') as HTMLInputElement).value==='75','Canceled replacement lost local scores');await click('Review latest record');await click('Replace and review');await until(()=>!button('Review latest record'));check((document.querySelector('input[type="number"]') as HTMLInputElement)?.value==='90.00','Reload kept stale scores');check((document.querySelector('textarea') as HTMLTextAreaElement)?.value==='Latest saved feedback','Reload kept stale feedback');check((document.querySelector('textarea[id^="marks-comments-"]') as HTMLTextAreaElement)?.value==='Latest saved comments','Reload kept stale comments');check(!document.body.textContent?.includes('Unsaved changes'),'Reload failed to reset dirty baseline');await click('Back to Marks Entry');await until(()=>!button('Save draft'));check(!button('Discard changes'),'Freshly reloaded record triggered discard prompt');});
await scenario('stale draft retains input and explicitly loads latest before writes resume',async()=>{
 await mount('draftconflict','lecturer');await click('Start marking');await until(()=>button('Save draft'));
 await enter(document.querySelector('input[type="number"]')!,'75');await click('Save draft');await until(()=>document.querySelector('[role="alert"]'));
 check((document.querySelector('input[type="number"]') as HTMLInputElement).value==='75','Conflict discarded local scores');
 check(button('Save draft').matches(':disabled')&&button('Submit marks').matches(':disabled'),'Stale form still permits writes');
 await click('Load latest draft');await until(()=>!document.querySelector('[role="alert"]'));
 check((document.querySelector('input[type="number"]') as HTMLInputElement).value==='90.00','Latest draft not loaded');
 check(!button('Save draft').matches(':disabled')&&!document.body.textContent?.includes('Unsaved changes'),'Reload did not restore a clean writable form');
 check(writes===1,'Conflict recovery repeated the write');
});
await scenario('uncertain submission retries the same reference and preserves input',async()=>{
 await mount('retrylost','lecturer');await click('Start marking');await until(()=>button('Save draft'));await enter(document.querySelector('input[type="number"]')!,'75');
 await click('Submit marks');await click('Submit and lock marks');await until(()=>document.querySelector('dialog [role="alert"]'));
 check((document.querySelector('input[type="number"]') as HTMLInputElement).value==='75','Failed submission discarded input');
 await click('Submit and lock marks');await until(()=>!document.querySelector('dialog[open]'));
 check(submissionRefs.length===2&&!!submissionRefs[0]&&submissionRefs[0]===submissionRefs[1],'Retry did not reuse its submission reference');
 check((document.querySelector('input[type="number"]') as HTMLInputElement).disabled,'Retried successful submission did not lock');
});
await scenario('changed marks create a new submission reference after a failed attempt',async()=>{
 await mount('retrylost','lecturer');await click('Start marking');await until(()=>button('Save draft'));await enter(document.querySelector('input[type="number"]')!,'75');
 await click('Submit marks');await click('Submit and lock marks');await until(()=>document.querySelector('dialog [role="alert"]'));await click('Review again');
 await enter(document.querySelector('input[type="number"]')!,'76');await click('Submit marks');await click('Submit and lock marks');await until(()=>!document.querySelector('dialog[open]'));
 check(submissionRefs.length===2&&submissionRefs[0]!==submissionRefs[1],'Changed payload reused the previous submission reference');
});
await scenario('routed lecturer history distinguishes read failure from empty history',async()=>{await mount('lecturerhistoryfail','lecturer');check(document.body.textContent?.includes('Submitted evaluations unavailable.'),'History load failure missing');check(!document.body.textContent?.includes('No submitted evaluations yet'),'Failed history presented as empty');check(activeTaskReads===0,'History generated/read active tasks');mode='';await click('Retry');await until(()=>document.querySelector('#marks-entry-history p[role="status"]'));check(document.body.textContent?.includes('No submitted evaluations yet'),'Successful empty history not shown');await click('Back to Marks Entry');await until(()=>button('Start marking'));});
await scenario('completion history failure retries only that history read',async()=>{await mount('historyfail','windows');await click('History');await until(()=>document.querySelector('[role="alert"]'));const alert=document.querySelector('[role="alert"]')!;check(alert.parentElement?.textContent?.includes('Completion history')||alert.parentElement?.parentElement?.textContent?.includes('Completion history'),'History error outside history section');check(!document.body.textContent?.includes('No completion windows'),'Failure shown as empty history');mode='';await click('Retry');await until(()=>document.body.textContent?.includes('No completion windows'));check(historyReads===2&&writes===0,'History retry repeated mutation');});
await scenario('saved component plus failed refresh cannot be created twice',async()=>{await mount('componentrefreshfail');await openComponent();await enter(document.querySelector('input[placeholder="Code"]')!,'extra');await enter(document.querySelector('input[placeholder="Component name"]')!,'Extra');await enter(document.querySelector('input[placeholder="Maximum mark"]')!,'10');saveComponent();await until(()=>writes===1);await until(()=>document.body.textContent?.includes('Component saved; refresh required'));check(button('Add component').matches(':disabled'),'Saved component can be created again');mode='';await click('Reload rubric');await until(()=>!button('Add component').matches(':disabled'));check(writes===1,'Refresh repeated component write');});
await scenario('marks pages fit narrow viewport',async()=>{await mount('','lecturer');await click('Start marking');await until(()=>button('Save draft'));check(document.documentElement.scrollWidth<=innerWidth+1,'Page horizontally overflows');});
await scenario('lecturer final review matches submitted score feedback and comments',async()=>{
 await mount('','lecturer');await click('Start marking');await enter(document.querySelector('input[type="number"]')!,'75');await enter(document.querySelector('textarea')!,'Reviewed feedback');await enter(document.querySelector('textarea[id^="marks-comments-"]')!,'Reviewed comments');await click('Submit marks');
 const dialog=document.querySelector('dialog[open]')!;check(dialog.textContent?.includes('Task #4')&&dialog.textContent?.includes('75 / 100')&&dialog.textContent?.includes('Reviewed feedback')&&dialog.textContent?.includes('Reviewed comments')&&dialog.textContent?.includes('75.00 / 100.00'),'Exact final review missing');
 await click('Submit and lock marks');await until(()=>writes===1);check(JSON.stringify(postBodies[0]).includes('Reviewed comments')&&JSON.stringify(postBodies[0]).includes('Reviewed feedback')&&JSON.stringify(postBodies[0]).includes('75'),'POST differs from reviewed values');
});
await scenario('Office unchanged-total correction shows each delta and protects Cancel',async()=>{
 await mount('','office');await click('Correct submitted marks');const scores=[...document.querySelectorAll<HTMLInputElement>('input[type="number"]')];await enter(scores[0],'35');await enter(scores[1],'45');await enter([...document.querySelectorAll('textarea')].at(-1)!,'Balanced correction');await click('Cancel');await click('Keep editing');check(scores[0].value==='35','Keep lost correction');await click('Review correction');const dialog=document.querySelector('dialog[open]')!;check(dialog.textContent?.includes('Research: 30.00 → 35')&&dialog.textContent?.includes('Writing: 50.00 → 45')&&!dialog.textContent?.includes('Total mark:'),'Score changes missing or unchanged total repeated');await click('Back to editing');check(scores[0].value==='35','Review cancellation lost editor');await click('Review correction');await click('Save correction');await until(()=>writes===1);check(postBodies[0].scores.length===2&&postBodies[0].reason==='Balanced correction','Correction payload differs');
});
await scenario('Office edits component feedback in place and reviews a feedback-only correction',async()=>{
 await mount('','office');await click('Correct submitted marks');
 const editor=document.querySelector<HTMLDialogElement>('dialog[open]')!;
 check(editor.textContent?.includes('Clarify the research question.')&&editor.textContent.includes('No feedback'),'Feedback previews are missing');
 check(editor.scrollWidth<=editor.clientWidth+1,'Correction dialog overflows');
 const feedbackButton=(label:string)=>document.querySelector<HTMLButtonElement>(`dialog[open] button[aria-label="${label}"]`)!;
 const toggleFeedback=async(label:string)=>{feedbackButton(label).click();await pause();};
 const add=feedbackButton('Add feedback for Writing');
 const edit=feedbackButton('Edit feedback for Research');
 const total=[...editor.querySelectorAll('dt')].find(element=>element.textContent==='Total mark')!;
 const totalFooter=total.closest('dl')!;
 const marksCard=totalFooter.parentElement!;
 const header=editor.querySelector('h3')!.parentElement!;
 check(marksCard.contains(add)&&marksCard.lastElementChild===totalFooter,'Total footer is detached from the component marks');
 check(marksCard.getBoundingClientRect().top-header.getBoundingClientRect().bottom<=16,'Too much space between the dialog header and marks');
 check(getComputedStyle(totalFooter).backgroundColor!==getComputedStyle(add).backgroundColor,'Total footer and feedback have the same treatment');
 check(total.nextElementSibling?.textContent==='80.00 / 100.00','Total and maximum are not displayed together');
 const scoreInput=editor.querySelector('input[type="number"]')!;
 const score=scoreInput.getBoundingClientRect();
 const maximum=scoreInput.closest('label')!.querySelector('[aria-hidden="true"]')!;
 const maximumText=document.createRange();
 maximumText.selectNodeContents(maximum);
 const maximumGap=maximumText.getBoundingClientRect().left-score.right;
 check(maximumGap>=0&&maximumGap<=8,'Maximum has drifted away from the score input');
 const name=[...editor.querySelectorAll('p')].find(element=>element.textContent==='Research')!.getBoundingClientRect();
 check(Math.abs((name.top+name.bottom-score.top-score.bottom)/2)<1,'Component name is not centered with its score');
 check(edit.getBoundingClientRect().top>=score.bottom,'Feedback action sits beside the score');
 const actionRight=add.lastElementChild!.getBoundingClientRect().right;
 const checkActionAlignment=(label:string)=>check(Math.abs(feedbackButton(label).lastElementChild!.getBoundingClientRect().right-actionRight)<1,`${label} shifted with the feedback preview`);
 checkActionAlignment('Edit feedback for Research');
 await toggleFeedback('Add feedback for Writing');
 checkActionAlignment('Done editing feedback for Writing');
 check(editor.querySelector<HTMLTextAreaElement>('textarea[aria-label="Feedback for Writing"]')?.value==='','Add did not open an empty editor');
 await toggleFeedback('Done editing feedback for Writing');
 edit.querySelector('[title]')!.dispatchEvent(new MouseEvent('click',{bubbles:true}));await pause();
 checkActionAlignment('Done editing feedback for Research');
 const feedback=editor.querySelector<HTMLTextAreaElement>('textarea[aria-label="Feedback for Research"]')!;
 check(feedback.value==='Clarify the research question.'&&document.activeElement===feedback,'Inline editor did not open with the existing feedback and focus');
 const updated='Clarify the research question and cite a source.\n'+ 'LongWord'.repeat(30);
 await enter(feedback,updated);await toggleFeedback('Done editing feedback for Research');
 checkActionAlignment('Edit feedback for Research');
 const preview=edit.querySelector<HTMLElement>('[title]')!;
 check(preview.scrollWidth>preview.clientWidth&&getComputedStyle(preview).textOverflow==='ellipsis','Long preview does not truncate inside the feedback control');
 check(editor.textContent?.includes('Edited')&&editor.textContent.includes('cite a source'),'Collapsed row lost the edited preview');
 await click('Cancel');await click('Keep editing');
 await enter([...editor.querySelectorAll('textarea')].at(-1)!,'Evaluator confirmed the wording');
 await click('Review correction');
 const review=document.querySelector<HTMLDialogElement>('dialog[open]')!;
 const delta=review.querySelector('[aria-label="Research feedback before and after"]');
 check(delta?.textContent?.includes('Clarify the research question.')&&delta.textContent.includes(updated),'Review lost the exact feedback change');
 check(!review.textContent?.includes('Total mark:')&&!review.textContent?.includes('Writing feedback'),'Review repeated unchanged fields');
 check(review.scrollWidth<=review.clientWidth+1,'Long feedback overflows the review');
 await click('Back to editing');await toggleFeedback('Edit feedback for Research');
 check(document.querySelector<HTMLTextAreaElement>('dialog[open] textarea[aria-label="Feedback for Research"]')?.value===updated,'Returning to edit lost the feedback');
 await click('Review correction');await click('Save correction');await until(()=>writes===1);
 check(JSON.stringify(postBodies[0].feedback)===JSON.stringify([{componentId:3,feedback:updated}])&&postBodies[0].scores.length===0,'Save payload differs from reviewed feedback');
});
await scenario('Office conflict recovery requires consent and clears stale correction',async()=>{
 await mount('officeconflict','office');await click('Correct submitted marks');await enter(document.querySelector('input[type="number"]')!,'36');await enter([...document.querySelectorAll('textarea')].at(-1)!,'Old correction');await click('Review correction');await click('Save correction');await until(()=>button('Review latest record'));await click('Review latest record');await click('Keep editing');const review=document.querySelector('dialog[open]');check(review?.textContent?.includes('Research: 30.00 → 36')&&review.textContent.includes('Old correction'),'Keep lost stale correction');check(reads===0,'Cancel performed read');await click('Review latest record');await click('Replace and review');await until(()=>button('Correct submitted marks'));check(reads===1&&writes===1,'Recovery replayed write or skipped read');await click('Correct submitted marks');await until(()=>document.querySelector('input[type="number"]'));check((document.querySelector('input[type="number"]') as HTMLInputElement).value==='35.00','Stale correction survived successful recovery');
});
await scenario('completion grant reviews exact Supervisor identity and preserves unrelated role',async()=>{
 await mount('','windows');const select=document.querySelector<HTMLInputElement>('input[aria-label*="Task #4"]')!;select.click();await pause();await enter(document.querySelector('input[type="datetime-local"]')!,'2030-01-01T12:00');await enter(document.querySelector('textarea')!,'Grant reason');await click('Grant to 1 selected task(s)');const dialog=document.querySelector('dialog[open]')!;check(dialog.textContent?.includes('Task #4')&&dialog.textContent?.includes('SUPERVISOR')&&dialog.textContent?.includes('Semester I')&&!dialog.textContent?.includes('Task #5'),'Grant review mismatched task');await click('Grant completion windows');await until(()=>writes===1);check(JSON.stringify(postBodies[0].taskIds)==='[4]'&&postBodies[0].deadline==='2030-01-01T04:00:00.000Z','Grant body mismatched selected task or Malaysia time');
});
await scenario('completion revoke protects local reason and reviews exact window',async()=>{
 await mount('windowrevoke','windows');await click('History');await until(()=>button('Revoke window'));await click('Revoke window');await enter([...document.querySelectorAll('textarea')].at(-1)!,'Revoke reason');await click('Cancel');await click('Keep editing');check((document.querySelector('textarea') as HTMLTextAreaElement).value==='Revoke reason'||[...document.querySelectorAll<HTMLTextAreaElement>('textarea')].some(area=>area.value==='Revoke reason'),'Keep lost revocation reason');await click('Confirm revocation');const dialog=document.querySelector('dialog[open]')!;check(dialog.textContent?.includes('Task #4')&&dialog.textContent?.includes('Window #19')&&dialog.textContent?.includes('SUPERVISOR'),'Revoke review identity missing');await click('Revoke completion window');await until(()=>writes===1);check(postBodies[0].reason==='Revoke reason','Revoke reason mismatch');
});
await scenario('failed history Retry after another grant preserves revocation reason',async()=>{
 await mount('windowretry','windows');await click('History');await until(()=>button('Revoke window'));await click('Revoke window');await enter([...document.querySelectorAll('textarea')].at(-1)!,'Keep unrelated revocation');
 document.querySelector<HTMLInputElement>('input[aria-label*="Task #5"]')!.click();await pause();await enter(document.querySelector('input[type="datetime-local"]')!,'2030-01-01T12:00');await enter(document.querySelector('textarea')!,'Grant Panel time');await click('Grant to 1 selected task(s)');await click('Grant completion windows');
 await until(()=>historyReads===2&&button('Retry'));check([...document.querySelectorAll<HTMLTextAreaElement>('textarea')].some(area=>area.value==='Keep unrelated revocation'),'Grant refresh failure lost unrelated reason');
 await click('Retry');await until(()=>historyReads===3&&button('Retry'));check([...document.querySelectorAll<HTMLTextAreaElement>('textarea')].some(area=>area.value==='Keep unrelated revocation'),'Failed history Retry lost unrelated reason');check(writes===1,'History retry repeated grant');
});
parent.postMessage({type:'marks-feedback-results',results},location.origin);
