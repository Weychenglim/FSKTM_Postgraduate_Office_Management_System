import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {access,copyFile,mkdtemp,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

// Actual components, production CSS and isolated HTTP fixture. Never calls live APIs.
test('Restriction review layout and discard modal',{timeout:240000},async()=>{
  let executable;
  for(const path of [process.env.CHROME_PATH,join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')].filter(Boolean))try{await access(path);executable=path;break;}catch{}
  assert.ok(executable,'Chrome/Edge required');
  const directory=await mkdtemp(join(tmpdir(),'periods-workspace-'));
  const server=await createServer({configFile:false,root:fileURLToPath(new URL('../',import.meta.url)),cacheDir:join(directory,'vite-cache'),logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'periods-workspace-fixture',configureServer(vite){vite.middlewares.use((req,res,next)=>{
    const url=new URL(req.url,'http://localhost');if(url.pathname!=='/periods-workspace-test')return next();res.setHeader('Content-Type','text/html');
    if(url.searchParams.has('frame'))res.end('<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"></head><body style="padding:16px"><div id="root" style="max-width:1000px;margin:0 auto"></div><script>addEventListener("error",e=>parent.postMessage({type:"periods-workspace-results",results:[{error:e.message}]},location.origin));addEventListener("unhandledrejection",e=>parent.postMessage({type:"periods-workspace-results",results:[{error:String(e.reason)}]},location.origin));</script><script type="module" src="/tests/periodsWorkspace.fixture.tsx"></script></body></html>');
    else res.end(`<!doctype html><html><body style="margin:0;background:#e2e8f0;display:flex;justify-content:center"><iframe title="Capacity workspace fixture" style="border:0;width:${Number(url.searchParams.get('width'))}px;height:1200px" src="/periods-workspace-test?frame"></iframe><pre id="test-results" style="display:none">RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='periods-workspace-results')document.getElementById('test-results').textContent=JSON.stringify(event.data)});</script></body></html>`);
  });}},tailwindcss()]});
  try{await server.listen();for(const width of [1440,1280,390,320]){
    const {stdout}=await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,`profile-${width}`)}`,'--window-size=1400,1250','--dump-dom','--virtual-time-budget=60000',`--screenshot=${join(directory,`periods-workspace-${width}.png`)}`,`${server.resolvedUrls.local[0]}periods-workspace-test?width=${width}&preview=restriction-review`],{timeout:75000,maxBuffer:3*1024*1024,windowsHide:true});
    if(process.env.RESTRICTION_REVIEW_SCREENSHOT_DIR)await copyFile(join(directory,`periods-workspace-${width}.png`),join(process.env.RESTRICTION_REVIEW_SCREENSHOT_DIR,`restriction-review-${width}.png`));
    const encoded=stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(encoded&&encoded!=='RUNNING',stdout.slice(-2000));
    const result=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
    console.log(result.results.map(row=>`${row.error?'FAIL':'PASS'} ${width}px ${row.name}${row.error?`: ${row.error}`:''}`).join('\n'));
    assert.equal(result.results.length,2);assert.deepEqual(result.results.filter(row=>row.error),[]);
  }
  }finally{await server.close();const resolved=await realpath(directory),within=relative(await realpath(tmpdir()),resolved);assert.ok(!isAbsolute(within)&&!within.startsWith('..')&&basename(resolved).startsWith('periods-workspace-'));await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});



