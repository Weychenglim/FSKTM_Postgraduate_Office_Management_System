import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {DashboardHeader} from '../src/components/DashboardHeader';
import {ActiveSemesterContext} from '../src/components/ActiveSemesterContext';
import {OfficeSemesterContext} from '../src/components/OfficeSemesterContext';
import {DashboardTimeline} from '../src/components/DashboardTimeline';
import {TimelineManagement} from '../src/components/TimelineManagement';
import {UploadTimelineDrawer} from '../src/components/UploadTimelineDrawer';
import {WorkflowReconciliationCentre} from '../src/components/WorkflowReconciliationCentre';
import {WorkflowReports} from '../src/components/WorkflowReports';
import {OfficeDashboardLayout} from '../src/components/OfficeDashboardLayout';

const results: {name: string; error?: string}[] = [];
const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 20));
const until = async (test: () => unknown) => { for (let i = 0; i < 200; i++) { if (test()) return; await pause(); } throw Error('Timeout ' + document.body.textContent?.slice(-500)); };
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => node.getClientRects().length > 0 && node.textContent?.trim() === label)!;
const click = async (label: string) => { check(button(label), 'Missing ' + label); button(label).click(); await pause(); };
const enter = async (node: HTMLInputElement | HTMLTextAreaElement, value: string) => { Object.getOwnPropertyDescriptor(node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', {bubbles: true})); await pause(); };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const semester = {id: 2, code: '2026-2027-S1', academicSession: '2026/2027', term: 'SEMESTER_I', label: 'Semester I 2026/2027', startsOn: '2026-10-01', endsOn: '2027-03-01', lifecycleStatus: 'ACTIVE', effectiveStatus: 'ACTIVE'};
const entry = {id: 5, level: 'P1', title: 'Research checkpoint', detail: 'Research checkpoint', step: 1, deadlineStart: '2026-10-20', deadlineEnd: '2026-10-30', targetRoles: ['STUDENT'], status: 'Active'};
const issue = {issueId: 'programme-2', fingerprint: 'fresh-fingerprint', module: 'SUPERVISOR_APPOINTMENTS', issueType: 'PROGRAMME_MISMATCH', severity: 'WARNING', repairability: 'REPAIRABLE', title: 'Programme mismatch', summary: 'Review the programme.', recordType: 'SUPERVISOR_APPLICATION', recordId: '2', programme: 'Computer Science', studentId: 'S2', currentState: {}, dependencies: [], navigation: {}, suggestion: {}};
const report = {overview: {totalRecords: 0, pendingApprovals: 0, averageWaitingDays: null, longestWaitingDays: null, marksCompletionRate: 0, activeTimelineEntries: 0, overdueMarks: 0}, attention: [], filters: {semester: 'active', availableSemesters: [], availableProgrammes: []}};
let reportReads:URL[]=[],exportReads:URL[]=[],pendingReports:{url:URL;resolve:(value:Response)=>void}[]=[];
let failReport=false;
const reportFor=(url:URL)=>({...report,filters:{...report.filters,semester:url.searchParams.get('semester')??'active',availableProgrammes:['Computer Science','Software Engineering']},attention:[{kind:'WAITING',recordType:'SUPERVISOR_APPLICATION',recordId:'1',label:`Report for ${url.searchParams.get('startDate')||'all dates'}`,programme:'Computer Science',waitingOn:'SUPERVISOR',waitingDays:1}]});
let root: Root | null = null, mode = '', semesterReads = 0, timelineReads = 0, writes = 0, previews = 0;
// Exercise workbook creation without starting a browser download in the fixture.
HTMLAnchorElement.prototype.click = function () { check(this.download.endsWith('.xlsx'), 'Unexpected fixture navigation'); };
window.fetch = async (url, options = {}) => {
  const requestUrl=new URL(String(url), location.origin);const path = requestUrl.pathname, method = options.method ?? 'GET';
  if (path.endsWith('/academics/semesters/active/')) return response({available:true,semester});
  if (path.endsWith('/academics/semesters/')) { semesterReads++; return mode === 'semester-failure' ? response({error: 'Semester read unavailable.'}, 500) : response([semester]); }
  if (path.endsWith('/timeline/active/')) { timelineReads++; return mode === 'timeline-failure' ? response({error: 'Timeline read unavailable.'}, 500) : response({available: mode !== 'dashboard-no-timeline', uploadedAt:'2026-10-09T00:00:00Z', semester: 'Semester I', session: '2026/2027', levels: [{level: 'P1', entries: mode === 'timeline-layout' ? Array.from({length:12}, (_,i)=>({...entry,id:100+i,title:`Milestone ${i+1}`,status:i===0?'Active':'Upcoming'})) : [entry]}]}); }
  if (path.endsWith('/timeline/audit-logs/')) return response({logs: mode === 'timeline-layout' ? Array.from({length:12},(_,i)=>({id:i+1,actorName:'Demo Office Administrator',action:'ENTRY_ADDED',createdAt:'2026-10-21T08:00:00Z',summary:`Added milestone ${i+1}`})) : []});
  if (path.endsWith('/timeline/template/')) return response({error: 'Template unavailable.'}, 500);
  if (path.endsWith('/timeline/upload/preview/')) {
    previews++;
    check(options.body instanceof FormData && options.body.get('semesterId') === '2' && options.body.get('file') instanceof File, 'Preview lost workbook or semester');
    return mode === 'upload-preview-failure' ? response({error: 'Workbook preview unavailable.'}, 500) : response({importedCount: 1, rows: [], warnings: [], requiresAcknowledgement: false, previewToken: 'reviewed-token'});
  }
  if (path.endsWith('/timeline/upload/')) { writes++; return response({error: 'Import unavailable. Preview again.'}, 500); }
  if (path.includes('/timeline/entries/') && method !== 'GET') { writes++; return response({error: 'Timeline save unavailable.'}, 500); }
  if (path.endsWith('/reports/export/')) { exportReads.push(requestUrl);return mode === 'export-success' ? new Response('workbook') : response({error: 'Workbook unavailable.'}, 500); }
  if (path.endsWith('/reports/')) {reportReads.push(requestUrl);if(mode==='report-race'&&requestUrl.searchParams.has('startDate'))return new Promise<Response>(resolve=>pendingReports.push({url:requestUrl,resolve}));return failReport?response({error:'Report unavailable.'},503):response(reportFor(requestUrl));}
  if (path.endsWith('/reconciliation/audits/')) return response({results: []});
  if (path.endsWith('/reconciliation/')) return response({summary: {total: 1, blocking: 0, warnings: 1, repairable: 1, reviewRequired: 0}, count: 1, page: 1, pageSize: 25, availableProgrammes: ['Computer Science', 'Software Engineering'], results: [issue]});
  if (path.endsWith('/preview/')) { previews++; return mode === 'preview-failure' ? response({error: 'Preview unavailable.'}, 500) : response({issue, allowedResolutions: [{action: 'SET_PROGRAMME', label: 'Set managed programme', requiresProgramme: true}]}); }
  if (path.endsWith('/apply/')) { writes++; return response({error: 'This record has changed. Review latest state.'}, 409); }
  throw Error('Unexpected fixture request ' + path);
};
const mount = async (nextMode: string, component: React.ReactNode) => {
  root?.unmount(); mode = nextMode; semesterReads = timelineReads = writes = previews = 0;
  root = createRoot(document.getElementById('root')!);
  root.render(<MemoryRouter initialEntries={['/?semester=2']}><OfficeDashboardLayout enabled>{component}</OfficeDashboardLayout></MemoryRouter>);
  await pause();
};
const calendar = <TimelineManagement onBack={() => {}} onManageSemesters={() => {}} />;
const reconciliation = <WorkflowReconciliationCentre onBack={() => {}} onNavigateToRoute={() => {}} />;
const reports = <WorkflowReports currentUserRole="Office Staff/Admin" onBack={() => {}} onNavigateToRoute={() => {}} />;
const scenario = async (name: string, work: () => Promise<void>) => { try { await work(); results.push({name}); } catch (error) { results.push({name, error: String(error)}); } };

const preview=new URL(parent.location.href).searchParams.get('preview');
if(!preview){
await scenario('dashboard semester dates remain visible without a timeline for office and other roles', async () => {
  for (const timelineMode of ['', 'dashboard-no-timeline']) {
    await mount(timelineMode, <><DashboardHeader context={<ActiveSemesterContext/>}/><DashboardHeader context={<OfficeSemesterContext compact onNavigate={() => {}}/>}/><DashboardTimeline showManageTimeline={false}/></>);
    await until(() => document.querySelectorAll('[aria-label="Semester dates"]').length === 2 && timelineReads === 1);
    for (const range of document.querySelectorAll('[aria-label="Semester dates"]')) {
      check(range.textContent?.includes('01 Oct 2026') && range.textContent?.includes('01 Mar 2027'), 'Summary shows incorrect semester dates');
      check(range.querySelector('time')?.getAttribute('datetime') === semester.startsOn, 'Academic dates were replaced with upload metadata');
      const summary = range.closest('section')!;
      check(summary && getComputedStyle(summary).paddingTop === '0px' && getComputedStyle(summary).borderTopWidth === '0px' && getComputedStyle(summary).backgroundColor === 'rgba(0, 0, 0, 0)', 'Semester context still looks like a card');
      const title = [...summary.querySelectorAll('p')].find(node => node.textContent === semester.label)!;
      check(parseFloat(getComputedStyle(title).fontSize) === 14 && parseFloat(getComputedStyle(range).lineHeight) >= 24, 'Semester hierarchy is cramped');
      check(summary.scrollWidth <= summary.clientWidth + 1, 'Semester summary overflows');
    }
    const headers = [...document.querySelectorAll<HTMLElement>('[aria-label="Dashboard overview"]')];
    check(headers.length === 2 && headers.every(header => header.querySelector('h1')?.textContent === 'Dashboard' && header.textContent?.includes('Your academic overview, tasks and upcoming dates.')), 'Role header wording differs');
    check(headers.every(header => header.scrollWidth <= header.clientWidth + 1), 'Dashboard header overflows');
    const heading = document.getElementById('timeline-title-meta')!;
    check(heading.textContent?.trim() === 'Semester timeline', 'Timeline repeats the session or upload date');
    check(!document.body.textContent?.includes('Uploaded'), 'Dashboard exposes upload metadata');
  }
});
await scenario('semester Retry rereads semesters even with a semester URL', async () => {
  await mount('semester-failure', calendar); await until(() => button('Retry')); mode = ''; await click('Retry'); await until(() => semesterReads === 2 && timelineReads === 1); check(!document.querySelector('[role="alert"]'), 'Retry did not recover calendar');
});
await scenario('timeline Retry reloads timeline for the selected semester', async () => {
  await mount('timeline-failure', calendar); await until(() => button('Retry')); mode = ''; await click('Retry'); await until(() => timelineReads === 2 && !document.querySelector('[role="alert"]')); check(semesterReads === 1, 'Timeline Retry reread wrong source');
});
await scenario('create failure is inline and retains the event fields', async () => {
  await mount('', calendar); await until(() => button('Add events') && !button('Add events').disabled); await click('Add events'); await until(() => document.querySelector('form input[type="text"]'));
  const title = document.querySelector('form input[type="text"]') as HTMLInputElement; await enter(title, 'Retain this milestone'); const dates = document.querySelectorAll<HTMLInputElement>('form input[type="date"]'); await enter(dates[0], '2026-10-21'); await enter(dates[1], '2026-10-22'); await click('Create event'); await until(() => writes === 1); await pause();
  check(document.querySelector('form [role="alert"]'), 'Create failure detached from the event form'); check(title.value === 'Retain this milestone', 'Create failure erased title'); check(dates[0].value === '2026-10-21', 'Create failure erased dates');
});
await scenario('edit failure is inline and retains edited input', async () => {
  await mount('', calendar); await until(() => timelineReads === 1); await click('Entries'); await until(() => button('Edit event')); await click('Edit event'); await until(() => document.querySelector('form input[type="text"]')); const title = document.querySelector('form input[type="text"]') as HTMLInputElement; await enter(title, 'Edited checkpoint'); await click('Save Changes'); await until(() => writes === 1); await pause(); check(document.querySelector('form [role="alert"]'), 'Edit failure detached from form'); check(title.value === 'Edited checkpoint', 'Edit input erased');
});
await scenario('upload validation uses a persistent inline alert', async () => {
  await mount('', <UploadTimelineDrawer isOpen onClose={() => {}} semesterId={2} semesterLabel={semester.label} />); await until(() => document.querySelector('input[type="file"]')); const field = document.querySelector('input[type="file"]') as HTMLInputElement; const data = new DataTransfer(); data.items.add(new File(['bad'], 'invalid.csv', {type: 'text/csv'})); field.files = data.files; field.dispatchEvent(new Event('change', {bubbles: true})); await pause(); check(document.querySelector('[data-record-page] section [role="alert"]:not(.portal-toast)'), 'Upload validation missing inline alert'); check(!document.querySelector('.fixed[role="alert"]'), 'Upload validation uses overlay toast');
});
await scenario('failed workbook preview and import preserve the selected file', async () => {
  await mount('upload-preview-failure', <UploadTimelineDrawer isOpen onClose={() => {}} semesterId={2} semesterLabel={semester.label} />); await until(() => document.querySelector('input[type="file"]'));
  const field = document.querySelector('input[type="file"]') as HTMLInputElement, data = new DataTransfer(); data.items.add(new File(['workbook'], 'semester.xlsx', {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})); field.files = data.files; field.dispatchEvent(new Event('change', {bubbles: true})); await pause(); await click('Preview import'); await until(() => document.querySelector('[data-record-page] [role="alert"]')); check(document.body.textContent?.includes('semester.xlsx'), 'Preview failure erased workbook'); check(!button('Confirm Import'), 'Failed preview permits import'); mode = ''; await click('Preview import'); await until(() => button('Confirm Import')); await click('Confirm Import'); await until(() => writes === 1 && document.querySelector('[data-record-page] [role="alert"]')); check(document.body.textContent?.includes('semester.xlsx'), 'Import failure erased workbook'); check(!button('Confirm Import'), 'Failed import did not invalidate preview'); check(previews === 2, 'Retry did not preview same selected file');
});
await scenario('calendar template download failure stays beside the upload', async () => {
  await mount('', calendar); await until(() => button('Add events') && !button('Add events').disabled); await click('Add events'); await click('Import from Excel'); await click('Download template'); await until(() => [...document.querySelectorAll('[role="alert"]')].some(node => node.textContent?.includes('Template unavailable.'))); check(document.querySelector('dialog[open] [role="alert"].border-rose-100'), 'Template download failure is not inline');
});
await scenario('failed first reconciliation preview stays visible and retries the exact issue', async () => {
  await mount('preview-failure', reconciliation); await until(() => button('Review issue')); await click('Review issue'); await until(() => previews === 1); await pause(); check(document.querySelector('[data-record-page] [role="alert"]'), 'Initial preview error disappeared'); mode = ''; await click('Retry'); await until(() => document.querySelector('textarea')); check(previews === 2, 'Preview Retry did not retry the issue');
});
await scenario('stale reconciliation reload retains reason and programme but requires reconfirmation', async () => {
  await mount('', reconciliation); await until(() => button('Review issue')); await click('Review issue'); await until(() => document.querySelector('textarea')); const reason = document.querySelector('textarea')!; await enter(reason, 'Verified programme with the office');
  const programme = [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.includes('Computer Science') && node.getAttribute('aria-haspopup') === 'listbox')!; check(programme, 'Programme selector missing'); programme.click(); await pause(); const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(node => node.textContent?.includes('Software Engineering'))!; check(option, 'Programme option missing'); option.click(); await pause(); (document.querySelector('[data-record-page] input[type="checkbox"]') as HTMLInputElement).click(); await pause(); await click('Review and confirm repair'); await click('Apply audited repair'); await until(() => button('Review latest record')); await click('Review latest record'); await until(() => previews === 2 && !document.querySelector('[role="dialog"]')); check(reason.value === 'Verified programme with the office', 'Reload erased mandatory reason'); check(document.querySelector('[data-record-page]')?.textContent?.includes('Software Engineering'), 'Reload erased selected programme'); check(!(document.querySelector('[data-record-page] input[type="checkbox"]') as HTMLInputElement).checked, 'Reload retained confirmation for changed state'); check(writes === 1, 'Reload repeated repair mutation');
});
await scenario('report validation stays by filters and exports use explicit tones', async () => {
  await mount('', reports); await until(() => button('Download XLSX') && !button('Download XLSX').disabled); const dates = document.querySelectorAll<HTMLInputElement>('input[type="date"]'); await enter(dates[0], '2026-10-25'); await enter(dates[1], '2026-10-21'); check(document.querySelector('[aria-label="Report filters"] [role="alert"]'), 'Report validation detached from filters'); check(button('Download XLSX').disabled,'Invalid dates allow exporting a different scope');await enter(dates[1],'2026-10-28');await until(()=>!button('Download XLSX').disabled); await click('Download XLSX'); await until(() => document.querySelector('[role="alert"]')?.textContent?.includes('Workbook unavailable') || [...document.querySelectorAll('[role="alert"]')].some(node => node.textContent?.includes('Workbook unavailable'))); check([...document.querySelectorAll('[role="alert"]')].some(node => node.textContent?.includes('Workbook unavailable') && node.className.includes('border-rose-200')), 'Export failure has no danger tone'); mode = 'export-success'; await click('Download XLSX'); await until(() => document.querySelector('[role="status"].border-emerald-200')); check(!document.querySelector('[role="status"].border-rose-200'), 'Export success has wrong tone');
});
const chooseReport=async(label:string,option:string)=>{await click(label);await until(()=>document.querySelector('[role="option"]'));const node=[...document.querySelectorAll<HTMLElement>('[role="option"]')].find(node=>node.textContent?.trim()===option)!;check(node,'Missing '+option);node.click();await pause();};
await scenario('reports reuse shared filters and update valid selections immediately for every role',async()=>{
 for(const role of ['Office Staff/Admin','Lecturer','Programme Coordinator'] as const){reportReads=[];await mount('',<WorkflowReports currentUserRole={role} onBack={()=>{}} onNavigateToRoute={()=>{}}/>);await until(()=>!button('Download XLSX')?.disabled);
 const panel=document.querySelector('[aria-label="Report filters"]')!;check(panel.querySelector('[data-workspace-filter-card]'),'Reports still use a bespoke toolbar');check(!button('Apply filters')&&!button('Reset filters'),'Apply/reset buttons remain');check(panel.querySelectorAll('input,button[role="combobox"]').length===(role==='Office Staff/Admin'?4:3),'Role filter scope changed');
 const dates=panel.querySelectorAll<HTMLInputElement>('input[type="date"]');await enter(dates[0],'2026-10-21');await until(()=>reportReads.at(-1)?.searchParams.get('startDate')==='2026-10-21'&&!button('Download XLSX').disabled);const before=reportReads.length;await enter(dates[1],'2026-10-20');check(reportReads.length===before,'Invalid range requested report');check(button('Download XLSX').disabled,'Invalid range can export');await enter(dates[1],'2026-10-24');await until(()=>reportReads.at(-1)?.searchParams.get('endDate')==='2026-10-24'&&!button('Download XLSX').disabled);
 await chooseReport('Active semester','All semesters');await until(()=>reportReads.at(-1)?.searchParams.get('semester')==='all');if(role==='Office Staff/Admin'){await chooseReport('All authorised programmes','Computer Science');await until(()=>reportReads.at(-1)?.searchParams.get('programme')==='Computer Science');}
 for(const field of panel.querySelectorAll<HTMLElement>('input,button[role="combobox"]'))check(field.className.includes('form-control-sm'),'Reports use different control sizes');check(panel.scrollWidth<=panel.clientWidth+1,'Report filters overflow');
 await click('Clear filters');await until(()=>reportReads.at(-1)?.search==='?semester=active'&&!button('Download XLSX').disabled);check([...dates].every(node=>node.value===''),'Clear did not reset dates');check(!panel.querySelector('[role="alert"]'),'Clear kept validation error');
 }
});
await scenario('reports ignore superseded responses and exports match the displayed filter scope',async()=>{
 reportReads=[];exportReads=[];pendingReports=[];await mount('report-race',reports);await until(()=>!button('Download XLSX')?.disabled);const start=document.querySelector<HTMLInputElement>('input[type="date"]')!;
 await enter(start,'2026-10-01');await until(()=>pendingReports.length===1);check(button('Download XLSX').disabled,'Loading report exports stale results');await enter(start,'2026-10-02');await until(()=>pendingReports.length===2);await enter(start,'2026-10-03');await until(()=>pendingReports.length===3);
 pendingReports[2].resolve(response(reportFor(pendingReports[2].url)));await until(()=>document.body.textContent?.includes('Report for 2026-10-03')&&!button('Download XLSX').disabled);pendingReports[1].resolve(response({error:'Stale report failure'},503));pendingReports[0].resolve(response(reportFor(pendingReports[0].url)));await pause();await pause();
 check(document.body.textContent?.includes('Report for 2026-10-03')&&!document.body.textContent?.includes('Stale report failure'),'Out-of-order response replaced latest report');mode='export-success';await click('Download XLSX');await until(()=>exportReads.length===1);check(exportReads[0].searchParams.get('startDate')==='2026-10-03','Export uses stale filters');
});
await scenario('failed automatic report reload retains selections and retries the same query',async()=>{
 await mount('',reports);await until(()=>!button('Download XLSX')?.disabled);failReport=true;try{await enter(document.querySelector<HTMLInputElement>('input[type="date"]')!,'2026-10-15');await until(()=>document.body.textContent?.includes('Report unavailable.'));check(button('Download XLSX').disabled,'Failed report can export');check(document.querySelector<HTMLInputElement>('input[type="date"]')?.value==='2026-10-15','Failure cleared filter');failReport=false;await click('Retry');await until(()=>document.body.textContent?.includes('Report for 2026-10-15')&&!button('Download XLSX').disabled);check(reportReads.at(-1)?.searchParams.get('startDate')==='2026-10-15','Retry changed query');}finally{failReport=false;}
});
await scenario('timeline controls filter immediately, reset and paginate in both views', async () => {
  await mount('timeline-layout', calendar); await until(() => timelineReads === 1); await click('Entries');
  const panel = document.getElementById('timeline-records-box')!;
  const rows = () => panel.querySelectorAll('tbody tr');
  await until(() => rows().length === 10);
  check(!panel.textContent?.includes('Apply Filters'), 'Apply button remains');
  await click('Next'); check(rows()[0].textContent?.includes('Milestone 11'), 'Next event page missing');
  const search = panel.querySelector('input[type="search"]') as HTMLInputElement;
  await enter(search, 'Milestone 12'); check(rows().length === 1 && rows()[0].textContent?.includes('Milestone 12'), 'Search did not immediately reset page and filter');
  await click('Clear filters'); check(rows().length === 10 && search.value === '', 'Clear filters did not reset results');
  await click('All statuses'); await until(() => document.querySelector('[role="option"]'));
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(node => node.textContent?.trim() === 'Active')!;
  check(option, 'Active filter missing'); option.click(); await pause(); check(rows().length === 1, 'Status did not filter immediately');
  check(writes === 0 && timelineReads === 1, 'Local filters caused a mutation or reload');
  await click('History'); const history = document.getElementById('recent-timeline-updates-card')!;
  check(history.querySelectorAll('tbody tr').length === 10, 'History initial page incorrect');
  await click('Next'); check(history.querySelectorAll('tbody tr').length === 2, 'History pagination failed');
  await click('Entries'); await click('Clear filters');
  const actionCell = rows()[0].querySelector('td:last-child')!;
  check(actionCell.querySelectorAll('button').length === 2 && !actionCell.querySelector('a'), 'Row actions are not shared buttons');
  (actionCell.querySelector('button[aria-label]') as HTMLButtonElement).click(); await pause();
  check(document.querySelector('dialog[open]')?.textContent?.includes('Delete Timeline Entry?'), 'Delete skipped its confirmation');
  await click('Cancel'); check(writes === 0, 'Cancelling delete wrote data');
  (actionCell.querySelector('button') as HTMLButtonElement).click(); await pause();
  await click('Extend the deadline');
  check([...document.querySelectorAll('dialog[open]')].some(node => node.textContent?.includes('Extend calendar date')), 'Editor extension action did not open the audited flow');
  const cancelExtension = [...document.querySelectorAll<HTMLButtonElement>('dialog[open] button')].reverse().find(node => node.textContent?.trim() === 'Cancel')!; cancelExtension.click(); await pause(); check(writes === 0, 'Cancelling extension wrote data');
  const editTitle = document.querySelector('form input[type="text"]') as HTMLInputElement;
  const originalTitle = editTitle.value; await enter(editTitle, 'Unsaved milestone');
  check(button('Extend the deadline').disabled && document.getElementById('extension-unsaved-help'), 'Unsaved edits could be lost or overwrite an extension');
  const editDialog = editTitle.closest('dialog')!;
  check(editDialog && !document.querySelector('[data-record-page]'), 'Edit event did not open a shared modal');
  const rect = editDialog.getBoundingClientRect(); check(rect.left >= 0 && rect.right <= innerWidth + 1 && editDialog.scrollWidth <= editDialog.clientWidth + 1, 'Editor overflows viewport');
  editDialog.dispatchEvent(new Event('cancel', {cancelable:true})); await pause();
  await click('Keep editing'); check(editTitle.value === 'Unsaved milestone', 'Keep editing lost changes');
  editDialog.dispatchEvent(new Event('cancel', {cancelable:true})); await pause(); await click('Discard changes');
  check(!document.querySelector('dialog[open]') && writes === 0, 'Discard did not close safely');
  (actionCell.querySelector('button') as HTMLButtonElement).click(); await pause();
  check((document.querySelector('form input[type="text"]') as HTMLInputElement).value === originalTitle, 'Reopening retained discarded changes');
  await click('Cancel'); await pause();
  check(!button('Tools'), 'Old tools menu remains');
  await click('History'); check(!button('Add events'), 'History exposes creation actions');
  await click('Calendar'); await click('Add events');
  const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')!;
  check(dialog && !document.querySelector('dialog [data-record-page]'), 'Creation is not embedded in the shared modal');
  const title = dialog.querySelector('input[type="text"]') as HTMLInputElement;
  await enter(title, 'Keep across methods'); await click('Import from Excel');
  const field = dialog.querySelector('input[type="file"]') as HTMLInputElement;
  const data = new DataTransfer(); data.items.add(new File(['workbook'], 'keep.xlsx', {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  field.files = data.files; field.dispatchEvent(new Event('change', {bubbles:true})); await pause();
  await click('Create one event'); check(title.value === 'Keep across methods', 'Switching method erased event draft');
  await click('Import from Excel'); check(dialog.textContent?.includes('keep.xlsx'), 'Switching method erased selected workbook');
  const bounds = dialog.getBoundingClientRect(); check(bounds.left >= 0 && bounds.right <= innerWidth + 1 && dialog.scrollWidth <= dialog.clientWidth + 1, 'Add dialog overflows viewport');
  dialog.dispatchEvent(new Event('cancel', {cancelable:true})); await pause();
  check(button('Keep editing'), 'Closing dirty modal skipped confirmation'); await click('Keep editing'); check(field.files?.[0]?.name === 'keep.xlsx', 'Keep editing erased file');
  dialog.dispatchEvent(new Event('cancel', {cancelable:true})); await pause(); await click('Discard changes');
  check(!document.querySelector('dialog[open]') && writes === 0, 'Discard wrote data or left dialog open');
  await click('Add events'); await pause(); check((document.querySelector('dialog input[type="text"]') as HTMLInputElement).value === '', 'New modal retained discarded data');
  await click('Cancel'); await click('Entries');
  check(panel.scrollWidth <= panel.clientWidth + 1, 'Timeline entries overflow on this viewport');
  await mount('', <div className="space-y-6"><DashboardHeader context={<ActiveSemesterContext/>}/><DashboardTimeline showManageTimeline={false}/></div>);
  await until(() => document.querySelector('[aria-label="Semester dates"]') && timelineReads === 1); await pause();
});
}
if(preview==='reports'){await mount('',reports);await until(()=>!button('Download XLSX')?.disabled);}
parent.postMessage({type: 'timeline-workflow-feedback-results', results}, location.origin);
