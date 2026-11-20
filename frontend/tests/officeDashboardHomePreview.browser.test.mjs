import assert from 'node:assert/strict';
import test from 'node:test';
import {access,mkdtemp,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute,basename} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createOfficeDashboardPreview} from './officeDashboardHomePreview.server.mjs';

// This suite starts its own preview server and visits only fictional data.
test('Dashboard home preview with actual portal shell at five widths',{timeout:240000},async()=>{
  let executable;
  for(const path of [process.env.CHROME_PATH,join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')].filter(Boolean))try{await access(path);executable=path;break;}catch{}
  assert.ok(executable,'Chrome/Edge required');
  const directory=await mkdtemp(join(tmpdir(),'office-dashboard-home-preview-'));
  const server=await createOfficeDashboardPreview(false);
  try{
    await server.listen();
    const previewUrl=new URL('/office-dashboard-home-preview',server.resolvedUrls.local[0]);
    for(const item of [{width:1440},{width:1280},{width:1024},{width:390},{width:320},{width:1440,scale:200}]){
    const {width,scale}=item,label=scale?'zoom-200':String(width);
    const {stdout}=await promisify(execFile)(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,`profile-${label}`)}`,'--window-size=1500,1150','--dump-dom','--virtual-time-budget=60000',`--screenshot=${join(tmpdir(),`office-dashboard-home-preview-${label}.png`)}`,`${previewUrl}?width=${width}&test${scale?`&scale=${scale}`:''}`],{timeout:75000,maxBuffer:3*1024*1024,windowsHide:true});
    const encoded=stdout.match(/<pre id="preview-test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(encoded&&encoded!=='RUNNING',stdout.slice(-2000));
    const result=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
    console.log(result.results.map(row=>`${row.error?'FAIL':'PASS'} ${width}px${scale?' 200% scaling':''} ${row.name}${row.error?`: ${row.error}`:''}`).join('\n'));
    assert.equal(result.width,width);assert.equal(result.results.length,9);assert.deepEqual(result.results.filter(row=>row.error),[]);
  }}finally{await server.close();const resolved=await realpath(directory),within=relative(await realpath(tmpdir()),resolved);assert.ok(!isAbsolute(within)&&!within.startsWith('..')&&basename(resolved).startsWith('office-dashboard-home-preview-'));await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
