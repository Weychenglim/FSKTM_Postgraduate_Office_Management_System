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

// Production components with isolated synthetic HTTP only; no live portal writes.
test('phase-one completed and abandoned drafts',{timeout:180000},async()=>{
  let executable;
  for(const path of [process.env.CHROME_PATH,join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')].filter(Boolean))try{await access(path);executable=path;break;}catch{}
  assert.ok(executable,'Chrome/Edge required');
  const directory=await mkdtemp(join(tmpdir(),'phase-one-drafts-'));
  const server=await createServer({configFile:false,root:fileURLToPath(new URL('../',import.meta.url)),cacheDir:join(directory,'vite-cache'),logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'phase-one-drafts-fixture',configureServer(vite){vite.middlewares.use((req,res,next)=>{
    const url=new URL(req.url,'http://localhost');if(url.pathname!=='/phase-one-drafts-test')return next();res.setHeader('Content-Type','text/html');
    if(url.searchParams.has('frame'))res.end('<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"></head><body style="padding:16px"><div id="root"></div><script type="module" src="/tests/phaseOneDrafts.fixture.tsx"></script></body></html>');
    else res.end(`<!doctype html><html><body style="margin:0"><iframe title="Phase one draft regression" style="border:0;width:${Number(url.searchParams.get('width'))}px;height:1200px" src="/phase-one-drafts-test?frame"></iframe><pre id="test-results">RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='phase-one-drafts-results')document.getElementById('test-results').textContent=JSON.stringify(event.data)});</script></body></html>`);
  });}},tailwindcss()]});
  try{
    await server.listen();
    for(const width of [1440,390]){
      const {stdout}=await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,`profile-${width}`)}`,'--window-size=1500,1250','--dump-dom','--virtual-time-budget=60000',`${server.resolvedUrls.local[0]}phase-one-drafts-test?width=${width}`],{timeout:70000,maxBuffer:3*1024*1024,windowsHide:true});
      const encoded=stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(encoded&&encoded!=='RUNNING',stdout.slice(-2500));
      const result=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
      console.log(result.results.map(row=>`${row.error?'FAIL':'PASS'} ${width}px ${row.name}${row.error?`: ${row.error}`:''}`).join('\n'));
      assert.equal(result.width,width);assert.equal(result.results.length,10);assert.deepEqual(result.results.filter(row=>row.error),[]);
    }
  }finally{
    await server.close();const resolved=await realpath(directory),within=relative(await realpath(tmpdir()),resolved);assert.ok(!isAbsolute(within)&&!within.startsWith('..')&&basename(resolved).startsWith('phase-one-drafts-'));await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
});
