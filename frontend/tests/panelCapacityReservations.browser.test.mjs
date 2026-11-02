import assert from 'node:assert/strict';
import test from 'node:test';
import {build as buildStyles} from 'vite';
import {build as buildScript} from 'esbuild';
import {createServer} from 'node:http';
import tailwindcss from '@tailwindcss/vite';
import {access,mkdtemp,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

// Actual components, production CSS and isolated HTTP fixture. Never calls live APIs.
test('Panel capacity acceptance and alerts',{timeout:240000},async()=>{
  let executable;
  for(const path of [process.env.CHROME_PATH,join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')].filter(Boolean))try{await access(path);executable=path;break;}catch{}
  assert.ok(executable,'Chrome/Edge required');
  const directory=await mkdtemp(join(tmpdir(),'capacity-reservations-'));
  const root=fileURLToPath(new URL('../',import.meta.url));
  const styles=await buildStyles({configFile:false,root,logLevel:'error',plugins:[tailwindcss()],build:{write:false,cssMinify:true,rollupOptions:{input:join(root,'src/index.css')}}});
  const css=styles.output.filter(asset=>asset.type==='asset'&&asset.fileName.endsWith('.css')).map(asset=>asset.source).join('\n').replace(/@import\s*"https:\/\/fonts\.googleapis\.com[^"]*";/g,'');
  const script=await buildScript({entryPoints:[join(root,'tests/panelCapacityReservations.fixture.tsx')],bundle:true,write:false,outdir:directory,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},logLevel:'error'});
  const js=script.outputFiles.find(file=>file.path.endsWith('.js')).text;
  const officeCss=script.outputFiles.find(file=>file.path.endsWith('.css'))?.text??'';
  const server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(js);return;}
    if(url.pathname==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css+'\n'+officeCss);return;}
    res.setHeader('Content-Type','text/html');
    if(url.searchParams.has('frame'))res.end('<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body class="font-sans" style="padding:16px;font-family:Inter,ui-sans-serif,system-ui,sans-serif"><div id="root" style="max-width:1000px;margin:0 auto"></div><script type="module" src="/fixture.js"></script></body></html>');
    else res.end(`<!doctype html><html><body style="margin:0;background:#e2e8f0;display:flex;justify-content:center"><iframe title="Panel nomination detail" style="border:0;flex-shrink:0;width:${Number(url.searchParams.get('width'))}px;height:1600px" src="/capacity-reservations-test?frame&preview=${encodeURIComponent(process.env.CAPACITY_PREVIEW??'')}"></iframe><pre id="test-results" style="display:none">RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='capacity-reservation-results')document.getElementById('test-results').textContent=JSON.stringify(event.data)});</script></body></html>`);
  });
  try{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));for(const width of [1440,390]){
    const {stdout}=await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,`profile-${width}`)}`,`--window-size=${Math.max(500,width+60)},1650`,'--dump-dom','--virtual-time-budget=60000',`--screenshot=${join(tmpdir(),`panel-capacity-reservations-${process.env.CAPACITY_PREVIEW||'review'}-${width}.png`)}`,`http://127.0.0.1:${server.address().port}/capacity-reservations-test?width=${width}`],{timeout:75000,maxBuffer:3*1024*1024,windowsHide:true});
    const encoded=stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(encoded&&encoded!=='RUNNING',stdout.slice(-2000));
    const result=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
    console.log(result.results.map(row=>`${row.error?'FAIL':'PASS'} ${width}px ${row.name}${row.error?`: ${row.error}`:''}`).join('\n'));
    assert.equal(result.width,width);assert.equal(result.results.length,8);assert.deepEqual(result.results.filter(row=>row.error),[]);
  }
  }finally{await new Promise(resolve=>server.close(resolve));const resolved=await realpath(directory),within=relative(await realpath(tmpdir()),resolved);assert.ok(!isAbsolute(within)&&!within.startsWith('..')&&basename(resolved).startsWith('capacity-reservations-'));await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
