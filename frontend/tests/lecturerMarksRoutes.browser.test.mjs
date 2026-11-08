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

test('Lecturer task and history routes preserve navigation and draft protection',{timeout:180000},async()=>{
  let executable;
  for(const path of ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'])try{await access(path);executable=path;break;}catch{}
  assert.ok(executable,'Chrome or Edge required');
  const directory=await mkdtemp(join(tmpdir(),'lecturer-marks-routes-'));
  const server=await createServer({configFile:false,root:fileURLToPath(new URL('../',import.meta.url)),logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'marks-route-fixture',configureServer(vite){vite.middlewares.use((req,res,next)=>{
    if(!req.url.startsWith('/marks-route-test'))return next();
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body><div id="root"></div><pre id="test-results" hidden>RUNNING</pre><script type="module" src="/tests/lecturerMarksRoutes.fixture.tsx"></script></body></html>');
  });}},tailwindcss()]});
  try{
    await server.listen();
    const {stdout}=await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,'profile')}`,'--dump-dom','--virtual-time-budget=60000',`${server.resolvedUrls.local[0]}marks-route-test`],{timeout:90000,maxBuffer:3*1024*1024,windowsHide:true});
    const encoded=stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(encoded&&encoded!=='RUNNING',stdout.slice(-2000));
    const results=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
    for(const row of results)console.log(`${row.error?'FAIL':'PASS'} ${row.name}${row.error?`: ${row.error}`:''}`);
    assert.equal(results.length,6);assert.deepEqual(results.filter(row=>row.error),[]);
  }finally{
    await server.close();const resolved=await realpath(directory);const within=relative(await realpath(tmpdir()),resolved);
    assert.ok(!isAbsolute(within)&&!within.startsWith('..')&&basename(resolved).startsWith('lecturer-marks-routes-'));
    await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
});
