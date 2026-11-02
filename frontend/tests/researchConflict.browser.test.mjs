import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'vite';
import {access,mkdtemp,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('Research mounted conflict recovery and committed refresh outcomes',{timeout:120000},async()=>{
 let executable;
 for(const path of [process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean))try{await access(path);executable=path;break;}catch{}
 assert.ok(executable,'Chrome/Edge required');
 const directory=await mkdtemp(join(tmpdir(),'research-conflict-'));
 const server=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:fileURLToPath(new URL('../',import.meta.url)),logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'research-conflict-fixture',configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url!=='/research-conflict-test')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><div id="root"></div><pre id="test-results">RUNNING</pre><script type="module" src="/tests/researchConflict.fixture.tsx"></script></body></html>');});}}]});
 try{await server.listen();const {stdout}=await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,'browser')}`,'--dump-dom','--virtual-time-budget=65000',`${server.resolvedUrls.local[0]}research-conflict-test`],{timeout:90000,maxBuffer:4*1024*1024,windowsHide:true});
 const encoded=stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(encoded&&encoded!=='RUNNING',stdout.slice(-5000));const results=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));console.log(results.map(row=>`${row.error?'FAIL':'PASS'} ${row.name}${row.error?`: ${row.error}`:''}`).join('\n'));assert.equal(results.length,28);assert.deepEqual(results.filter(row=>row.error),[]);
 }finally{await server.close();const resolved=await realpath(directory),within=relative(await realpath(tmpdir()),resolved);assert.ok(!isAbsolute(within)&&!within.startsWith('..')&&basename(resolved).startsWith('research-conflict-'));await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
