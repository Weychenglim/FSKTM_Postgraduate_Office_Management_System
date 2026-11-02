import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {access,mkdtemp,realpath,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

// Actual components, production CSS and isolated HTTP fixture. Never calls live APIs.
test('Marks contextual feedback',{timeout:240000},async()=>{
  let executable;
  for(const path of [process.env.CHROME_PATH,join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')].filter(Boolean))try{await access(path);executable=path;break;}catch{}
  assert.ok(executable,'Chrome/Edge required');
  const directory=await mkdtemp(join(tmpdir(),'marks-feedback-'));
  const baselineNames=new Set(['MarkEntryDetail.tsx','SubmittedMarksActions.tsx','MarksCompletionWindows.tsx','DecisionDialog.tsx','LecturerMarksEntry.tsx']);
  const baselinePlugin={name:'task-four-baseline-red',enforce:'pre',async load(id){
    if(process.env.TASK4_BASELINE_RED!=='1')return null;
    const clean=id.split('?')[0].replaceAll('\\','/');
    if(!clean.includes('/src/components/')||!baselineNames.has(basename(clean)))return null;
    return readFile(fileURLToPath(new URL(`../../.superpowers/sdd/PHASE_FIVE_MARKS_FEEDBACK_PLAN_2026-10-31/task-4-baseline/${basename(clean)}`,import.meta.url)),'utf8');
  }};
  const server=await createServer({configFile:false,root:fileURLToPath(new URL('../',import.meta.url)),logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[baselinePlugin,{name:'marks-feedback-fixture',configureServer(vite){vite.middlewares.use((req,res,next)=>{
    const url=new URL(req.url,'http://localhost');if(url.pathname!=='/marks-feedback-test')return next();res.setHeader('Content-Type','text/html');
    if(url.searchParams.has('frame'))res.end('<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"></head><body style="padding:16px"><div id="root" style="max-width:1000px;margin:0 auto"></div><script type="module" src="/tests/marksFeedback.fixture.tsx"></script></body></html>');
    else res.end(`<!doctype html><html><body style="margin:0;background:#e2e8f0;display:flex;justify-content:center"><iframe title="Semester activation fixture" style="border:0;width:${Number(url.searchParams.get('width'))}px;height:1200px" src="/marks-feedback-test?frame"></iframe><pre id="test-results" style="display:none">RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='marks-feedback-results')document.getElementById('test-results').textContent=JSON.stringify(event.data)});</script></body></html>`);
  });}},tailwindcss()]});
  try{await server.listen();for(const width of [1440,390]){
    const {stdout}=await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,`profile-${width}`)}`,'--window-size=1400,1250','--dump-dom','--virtual-time-budget=60000',`--screenshot=${join(tmpdir(),`marks-feedback-${width}.png`)}`,`${server.resolvedUrls.local[0]}marks-feedback-test?width=${width}`],{timeout:75000,maxBuffer:3*1024*1024,windowsHide:true});
    const encoded=stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(encoded&&encoded!=='RUNNING',stdout.slice(-2000));
    const result=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
    console.log(result.results.map(row=>`${row.error?'FAIL':'PASS'} ${width}px ${row.name}${row.error?`: ${row.error}`:''}`).join('\n'));
    assert.equal(result.results.length,19);assert.deepEqual(result.results.filter(row=>row.error),[]);
  }
  }finally{await server.close();const resolved=await realpath(directory),within=relative(await realpath(tmpdir()),resolved);assert.ok(!isAbsolute(within)&&!within.startsWith('..')&&basename(resolved).startsWith('marks-feedback-'));await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
