import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm, access, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, relative, isAbsolute, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

// Run with: node --test tests/appointmentDrafts.browser.test.mjs
// Uses an isolated headless profile and mocked HTTP responses; no live portal APIs.
test('mounted appointment draft regressions', {timeout:60000}, async()=>{
  const browsers=[process.env.CHROME_PATH,
    join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean);
  let executable;
  for(const browser of browsers) {try {await access(browser);executable=browser;break;} catch {}}
  assert.ok(executable,'Install Chrome/Edge or set CHROME_PATH to run the mounted browser regressions.');
  const directory=await mkdtemp(join(tmpdir(),'appointment-feedback-browser-'));
  const bundle=join(directory,'fixture.js');
  const server=createServer(async(req,res)=>{
    if(req.url==='/fixture.js') {
      res.setHeader('Content-Type','application/javascript');res.end(await readFile(bundle));
    } else {
      res.setHeader('Content-Type','text/html');
      if(req.url.startsWith('/frame')) res.end('<!doctype html><html><body><div id="root"></div><pre id="test-results">RUNNING</pre><script type="module" src="/fixture.js"></script></body></html>');
      else res.end('<!doctype html><html><body><iframe style="border:0;width:'+Number(new URL(req.url,'http://localhost').searchParams.get('width'))+'px;height:1200px" src="/frame"></iframe><pre id="test-results">RUNNING</pre><script>addEventListener("message",event=>{if(event.origin===location.origin&&event.data.type==="appointment-fixture-results")document.getElementById("test-results").textContent=JSON.stringify(event.data.results)});</script></body></html>');
    }
  });
  try {
    await build({entryPoints:[fileURLToPath(new URL('./appointmentDrafts.fixture.tsx',import.meta.url))],
      outfile:bundle,bundle:true,platform:'browser',format:'esm',jsx:'automatic',
      define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{}'}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    for(const width of [1440,390,320]){
    const {stdout}=await promisify(execFile)(executable,[
      '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
      `--user-data-dir=${join(directory,'profile-'+width)}`,'--dump-dom','--virtual-time-budget=15000',
      `http://127.0.0.1:${server.address().port}/?width=${width}`,
    ],{timeout:45000,maxBuffer:2*1024*1024,windowsHide:true});
    const result=stdout.match(/<pre id="test-results">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(result && result!=='RUNNING',`Browser tests did not finish: ${stdout.slice(-3000)}`);
    const decoded=result.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
    const checks=JSON.parse(decoded);
    assert.equal(checks.length,10,'Every mounted scenario must finish');
    console.log(checks.map(check=>`${check.error?'FAIL':'PASS'} ${check.name}${check.error?`: ${check.error}`:''}`).join('\n'));
    assert.deepEqual(checks.filter(check=>check.error),[],'Mounted browser regression failures');
    }
  } finally {
    await new Promise(resolve=>server.close(resolve));
    const target=await realpath(directory);
    const withinTemp=relative(await realpath(tmpdir()),target);
    assert.ok(!isAbsolute(withinTemp)&&!withinTemp.startsWith('..')&&basename(target).startsWith('appointment-feedback-browser-'),
      'Only remove this test run\'s isolated temporary directory');
    await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
});
