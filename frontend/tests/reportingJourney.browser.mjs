// Opt-in runner for dashboard.reporting_browser_journey; never a dev server.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer, request as httpRequest } from 'node:http';
import { access, readFile, readdir, mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
const backend = new URL(config.backend);
assert.equal(backend.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost'].includes(backend.hostname));
assert.ok(backend.port && !['8000', '3000', '3001'].includes(backend.port), 'Never target a development server');
assert.ok([1440, 390].includes(config.width));
let chrome;
for (const path of [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
  try { await access(path); chrome = path; break; } catch {}
}
assert.ok(chrome, 'Chrome or Edge is required');
const directory = await mkdtemp(join(tmpdir(), 'a05-real-journey-'));
const bundle = join(directory, 'fixture.js');
let server;
try {
  await build({ entryPoints: ['tests/reportingJourney.fixture.tsx'], outfile: bundle, bundle: true, format: 'esm', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' });
  const css = (await readdir('dist/assets')).find(name => name.startsWith('index-') && name.endsWith('.css'));
  assert.ok(css, 'Run npm run build before the journey');
  server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.url.startsWith('/api/')) {
      const proxy = httpRequest(new URL(req.url, backend), { method: req.method, headers: { ...req.headers, host: backend.host } }, upstream => {
        res.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(res);
      });
      proxy.on('error', () => { res.writeHead(502); res.end('Isolated backend unavailable'); });
      req.pipe(proxy); return;
    }
    if (req.url === '/journey-config') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(config)); return; }
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(bundle)); return; }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(await readFile(join('dist/assets', css))); return; }
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/a05-frame') {
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="padding:12px;background:#f1f5f9"><div id="root" style="max-width:1100px;margin:0 auto"></div><pre id="journey-results" hidden>RUNNING</pre><script type="module" src="/fixture.js"></script></body></html>');
      return;
    }
    // Chrome's native window has platform minimum sizes and chrome borders.
    // An iframe establishes the exact CSS viewport, as in existing mounted suites.
    res.end(`<!doctype html><html><body style="margin:0"><iframe id="journey-frame" title="A05 reporting journey" style="border:0;width:${config.width}px;height:1400px" src="/a05-frame"></iframe><pre id="journey-results" hidden>RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.source===document.getElementById('journey-frame').contentWindow&&event.data.type==='a05-results')document.getElementById('journey-results').textContent=JSON.stringify(event.data.result)});</script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { stdout } = await promisify(execFile)(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync',
    `--user-data-dir=${join(directory, 'profile')}`, '--window-size=1500,1500',
    '--dump-dom', '--virtual-time-budget=180000',
    `http://127.0.0.1:${server.address().port}/dashboard`,
  ], { timeout: 210000, maxBuffer: 3 * 1024 * 1024, windowsHide: true });
  const encoded = stdout.match(/<pre id="journey-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];
  assert.ok(encoded && encoded !== 'RUNNING', 'Browser journey did not finish');
  const result = JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.equal(result.viewportWidth, config.width, 'The actual browser viewport must match the requested width');
  const expected = { reports: 40, reconciliation: 17, race: 9, privacy: 12 };
  assert.equal(result.checks.length, expected[config.mode], 'All A05 assertions must run');
  console.log(`${config.width}px ${config.mode}: ${result.checks.length} real HTTP/browser assertions passed`);
  console.log(result.checks.map(check => `PASS ${check}`).join('\n'));
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  const resolved = await realpath(directory);
  const within = relative(await realpath(tmpdir()), resolved);
  assert.ok(!isAbsolute(within) && !within.startsWith('..') && basename(resolved).startsWith('a05-real-journey-'));
  await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
