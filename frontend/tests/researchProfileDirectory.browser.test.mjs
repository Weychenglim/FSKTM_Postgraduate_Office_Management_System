import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp, readFile, readdir, rm, access, realpath, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, relative, isAbsolute, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

// Run after npm run build: node --test tests/researchProfileDirectory.browser.test.mjs
// Uses an isolated headless profile and mocked HTTP responses; no live portal APIs.
test('mounted research profile directory regressions', {timeout:120000}, async()=>{
  const browsers=[process.env.CHROME_PATH,
    join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean);
  let executable;
  for(const browser of browsers) {try {await access(browser);executable=browser;break;} catch {}}
  assert.ok(executable,'Install Chrome/Edge or set CHROME_PATH to run the mounted browser regressions.');
  const directory=await mkdtemp(join(tmpdir(),'research-directory-browser-'));
  const bundle=join(directory,'fixture.js');
  const assets = fileURLToPath(new URL('../dist/assets/', import.meta.url));
  const css = await readFile(join(assets, (await readdir(assets)).find(name => name.endsWith('.css'))), 'utf8');
  const server=createServer(async(req,res)=>{
    if(req.url==='/fixture.js') {
      res.setHeader('Content-Type','application/javascript');res.end(await readFile(bundle));
    } else if (req.url === '/style.css') {
      res.setHeader('Content-Type','text/css');res.end(css);
    } else {
      res.setHeader('Content-Type','text/html');
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/frame') res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="background:#f1f5f9;padding:20px"><main style="max-width:1120px;margin:auto"><div id="root"></div></main><pre id="test-results" style="display:none">RUNNING</pre><script type="module" src="/fixture.js"></script></body></html>');
      else res.end(`<!doctype html><html><body style="margin:0"><iframe title="Research profile directory" style="display:block;border:0;width:${Number(url.searchParams.get('width')) || 1280}px;height:3600px" src="/frame${url.searchParams.has('preview') ? '?preview' : ''}"></iframe><pre id="test-results" style="display:none">RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='research-directory-results')document.getElementById('test-results').textContent=JSON.stringify(event.data)});</script></body></html>`);
    }
  });
  try {
    await build({entryPoints:[fileURLToPath(new URL('./researchProfileDirectory.fixture.tsx',import.meta.url))],
      outfile:bundle,bundle:true,platform:'browser',format:'esm',jsx:'automatic',
      define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{}'}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    for (const width of [1280, 390]) {
    const {stdout}=await promisify(execFile)(executable,[
      '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
      `--user-data-dir=${join(directory,'profile-' + width)}`,'--dump-dom','--virtual-time-budget=15000',`--window-size=${width},1000`,
      `http://127.0.0.1:${server.address().port}/?width=${width}`,
    ],{timeout:45000,maxBuffer:2*1024*1024,windowsHide:true});
    const result=stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(result && result!=='RUNNING',`Browser tests did not finish: ${stdout.slice(-3000)}`);
    const decoded=result.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
    const output=JSON.parse(decoded);
    assert.equal(output.width,width,'Use an actual viewport at the requested width');
    const checks=output.results;
    assert.equal(checks.length,7,'Every mounted scenario must finish');
    console.log(checks.map(check=>`${check.error?'FAIL':'PASS'} ${width}px ${check.name}${check.error?`: ${check.error}`:''}`).join('\n'));
    assert.deepEqual(checks.filter(check=>check.error),[],'Mounted browser regression failures');
    }
    const output = process.env.RESEARCH_DIRECTORY_OUTPUT || fileURLToPath(new URL('../../output/research-profile-directory-20261023/', import.meta.url));
    await mkdir(output, {recursive: true});
    for (const width of [1280, 390]) await promisify(execFile)(executable, [
      '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--hide-scrollbars',
      `--user-data-dir=${join(directory,'preview-' + width)}`,`--window-size=${width},${width === 390 ? 1800 : 1200}`,
      '--virtual-time-budget=4000',`--screenshot=${join(output,'directory-' + width + '.png')}`,
      `http://127.0.0.1:${server.address().port}/?preview&width=${width}`,
    ], {timeout:15000,windowsHide:true});
  } finally {
    await new Promise(resolve=>server.close(resolve));
    const target=await realpath(directory);
    const withinTemp=relative(await realpath(tmpdir()),target);
    assert.ok(!isAbsolute(withinTemp)&&!withinTemp.startsWith('..')&&basename(target).startsWith('research-directory-browser-'),
      'Only remove this test run\'s isolated temporary directory');
    await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
});
