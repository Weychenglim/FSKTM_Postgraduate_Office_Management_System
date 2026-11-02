import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {access,mkdtemp,realpath,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('Research Intent wizard mounted interactions and responsive layout',{timeout:240000},async()=>{
 let executable;
 for(const path of [process.env.CHROME_PATH,join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe')].filter(Boolean))try{await access(path);executable=path;break;}catch{}
 assert.ok(executable,'Chrome/Edge required for mounted regressions');
 const directory=await mkdtemp(join(tmpdir(),'research-intent-'));
 const output=join(directory,'screenshots');await mkdir(output,{recursive:true});
 const server=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:fileURLToPath(new URL('../',import.meta.url)),logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'research-intent-fixture',configureServer(vite){vite.middlewares.use((req,res,next)=>{
  const url=new URL(req.url,'http://localhost');if(url.pathname!=='/research-intent-test')return next();res.setHeader('Content-Type','text/html');
  if(url.searchParams.has('frame'))res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body style="padding:16px"><div id="root" style="max-width:1000px;margin:auto"></div><script type="module" src="/tests/researchIntentWizard.fixture.tsx"></script></body></html>');
  else res.end(`<!doctype html><html><body style="margin:0;background:#e2e8f0;display:flex;justify-content:center"><iframe title="Research Intent fixture" style="border:0;width:${Number(url.searchParams.get('width'))}px;height:1200px" src="/research-intent-test?frame"></iframe><pre id="test-results" style="display:none">RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='research-intent-results')document.getElementById('test-results').textContent=JSON.stringify(event.data)});</script></body></html>`);
 });}},tailwindcss()]});
 try{
  await server.listen();
  for(const width of [1440,390,320]){
   const {stdout}=await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,`test-${width}`)}`,'--window-size=1500,1250','--dump-dom','--virtual-time-budget=45000',`${server.resolvedUrls.local[0]}research-intent-test?width=${width}`],{timeout:60000,maxBuffer:3*1024*1024,windowsHide:true});
   const encoded=stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(encoded&&encoded!=='RUNNING',stdout.slice(-2500));
   const result=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
   console.log(result.results.map(row=>`${row.error?'FAIL':'PASS'} ${width}px ${row.name}${row.error?`: ${row.error}`:''}`).join('\n'));
   assert.equal(result.results.length,34);assert.deepEqual(result.results.filter(row=>row.error),[]);
  }
  for(const width of [1440,390])for(const view of ['intent','intent-fields','review','detail','draft','saved'])await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,`preview-${view}-${width}`)}`,'--window-size=1500,1250','--dump-dom','--virtual-time-budget=8000',`--screenshot=${join(output,`${view}-${width}.png`)}`,`${server.resolvedUrls.local[0]}research-intent-test?width=${width}&preview=${view}`],{timeout:25000,maxBuffer:3*1024*1024,windowsHide:true});
 }finally{
  await server.close();const resolved=await realpath(directory),within=relative(await realpath(tmpdir()),resolved);assert.ok(!isAbsolute(within)&&!within.startsWith('..')&&basename(resolved).startsWith('research-intent-'));await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
});
