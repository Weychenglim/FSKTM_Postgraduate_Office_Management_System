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

// Isolated fixture and browser profile. No live portal APIs or academic records.
test('My availability confirmation, recovery and responsive history',{timeout:240000},async()=>{
  assert.equal(await access(fileURLToPath(new URL('../src/components/LecturerAvailabilityPage.tsx',import.meta.url))).then(()=>true,()=>false),true,'My availability page must exist before its confirmation flow can run');
  let executable;
  for(const path of [process.env.CHROME_PATH,join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')].filter(Boolean))try{await access(path);executable=path;break;}catch{}
  assert.ok(executable,'Chrome/Edge required');
  const directory=await mkdtemp(join(tmpdir(),'lecturer-availability-'));
  const screenshots=join(directory,'screenshots');
  await mkdir(screenshots,{recursive:true});
  const server=await createServer({configFile:false,root:fileURLToPath(new URL('../',import.meta.url)),cacheDir:join(directory,'vite-cache'),logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'availability-fixture',configureServer(vite){vite.middlewares.use((req,res,next)=>{
    const url=new URL(req.url,'http://localhost');if(url.pathname!=='/availability-test')return next();res.setHeader('Content-Type','text/html');
    if(url.searchParams.has('frame'))res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body style="padding:16px"><div id="root"></div><script type="module" src="/tests/lecturerAvailability.fixture.tsx"></script></body></html>');
    else res.end(`<!doctype html><html><body style="margin:0"><iframe title="My availability fixture" style="border:0;width:${Number(url.searchParams.get('width'))}px;height:1200px" src="/availability-test?frame"></iframe><pre id="test-results" style="display:none">RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='availability-results')document.getElementById('test-results').textContent=JSON.stringify(event.data.results)});</script></body></html>`);
  });}},tailwindcss()]});
  try{await server.listen();for(const width of [1440,390,320]){
    const {stdout}=await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,`profile-${width}`)}`,'--window-size=1500,1250','--dump-dom','--virtual-time-budget=30000',`--screenshot=${join(screenshots,`review-${width}.png`)}`,`${server.resolvedUrls.local[0]}availability-test?width=${width}`],{timeout:60000,maxBuffer:3*1024*1024,windowsHide:true});
    const encoded=stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(encoded&&encoded!=='RUNNING',stdout.slice(-2000));
    const results=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
    console.log(results.map(row=>`${row.error?'FAIL':'PASS'} ${width}px ${row.name}${row.error?`: ${row.error}`:''}`).join('\n'));
    assert.equal(results.length,19);assert.deepEqual(results.filter(row=>row.error),[]);
  }}finally{await server.close();const resolved=await realpath(directory),within=relative(await realpath(tmpdir()),resolved);assert.ok(!isAbsolute(within)&&!within.startsWith('..')&&basename(resolved).startsWith('lecturer-availability-'));await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
