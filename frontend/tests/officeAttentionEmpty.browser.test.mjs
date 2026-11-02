import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {access,mkdtemp,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

// Actual components, production CSS and isolated HTTP fixture. Never calls live APIs.
test('Office attention empty state and populated navigation',{timeout:240000},async()=>{
  let executable;
  for(const path of [process.env.CHROME_PATH,join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')].filter(Boolean))try{await access(path);executable=path;break;}catch{}
  assert.ok(executable,'Chrome/Edge required');
  const directory=await mkdtemp(join(tmpdir(),'office-dashboard-ux-'));
  const server=await createServer({configFile:false,root:fileURLToPath(new URL('../',import.meta.url)),logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'office-dashboard-ux-fixture',configureServer(vite){vite.middlewares.use((req,res,next)=>{
    const url=new URL(req.url,'http://localhost');if(url.pathname!=='/office-dashboard-ux-test')return next();res.setHeader('Content-Type','text/html');
    if(url.searchParams.has('frame'))res.end('<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"></head><body style="padding:16px"><div id="root"></div><script type="module" src="/tests/officeDashboard.fixture.tsx"></script></body></html>');
    else res.end(`<!doctype html><html><body style="margin:0;background:#e2e8f0;display:flex;justify-content:center"><iframe title="Office Dashboard fixture" style="border:0;width:${Number(url.searchParams.get('width'))}px;height:1200px" src="/office-dashboard-ux-test?frame&home-empty-only"></iframe><pre id="test-results" style="display:none">RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='office-dashboard-ux-results')document.getElementById('test-results').textContent=JSON.stringify(event.data)});</script></body></html>`);
  });}},tailwindcss()]});
  try{await server.listen();for(const width of [1440,1280,390,320]){
    const {stdout}=await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,`profile-${width}`)}`,'--window-size=1400,1250','--dump-dom','--virtual-time-budget=60000',`--screenshot=${join(process.env.OFFICE_EMPTY_SCREENSHOT_DIR||tmpdir(),`office-attention-empty-${width}.png`)}`,`${server.resolvedUrls.local[0]}office-dashboard-ux-test?width=${width}`],{timeout:75000,maxBuffer:3*1024*1024,windowsHide:true});
    const encoded=stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(encoded&&encoded!=='RUNNING',stdout.slice(-2000));
    const result=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
    console.log(result.results.map(row=>`${row.error?'FAIL':'PASS'} ${width}px ${row.name}${row.error?`: ${row.error}`:''}`).join('\n'));
    assert.equal(result.results.length,3);assert.deepEqual(result.results.filter(row=>row.error),[]);
  }}finally{await server.close();const resolved=await realpath(directory),within=relative(await realpath(tmpdir()),resolved);assert.ok(!isAbsolute(within)&&!within.startsWith('..')&&basename(resolved).startsWith('office-dashboard-ux-'));await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
