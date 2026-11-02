import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {access, mkdtemp, readFile, realpath, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, relative, isAbsolute, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

// Production React feedback and native dialogs with real portal CSS; no live APIs.
// Run: node --test tests/feedbackDelivery.browser.test.mjs
test('shared feedback queue, lifetime and session isolation', {timeout: 480000}, async () => {
  let executable;
  for (const browser of [process.env.CHROME_PATH,
    join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean)) {
    try { await access(browser); executable = browser; break; } catch {}
  }
  assert.ok(executable, 'Install Chrome/Edge or set CHROME_PATH for mounted tests');
  const directory = await mkdtemp(join(tmpdir(), 'feedback-delivery-browser-'));
  const server = await createServer({configFile: false, root: fileURLToPath(new URL('../', import.meta.url)), cacheDir: join(directory, 'vite-cache'),
    logLevel: 'error', server: {host: '127.0.0.1', port: 0, hmr: false, watch: null},
    plugins: [{name: 'feedback-delivery-fixture', configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/feedback-delivery-test') return next();
        res.setHeader('Content-Type', 'text/html');
        if (url.searchParams.has('frame')) {
          res.end('<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"></head><body><div id="root"></div><script type="module" src="/tests/feedbackDelivery.fixture.tsx"></script></body></html>');
        } else {
          const width = Number(url.searchParams.get('width'));
          res.end(`<!doctype html><html><body style="margin:0;background:#e2e8f0;display:flex;justify-content:center"><iframe title="Isolated feedback delivery" style="border:0;width:${width}px;height:850px" src="/feedback-delivery-test?frame"></iframe><pre id="test-results" style="display:none">RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='feedback-delivery-results')document.getElementById('test-results').textContent=JSON.stringify(event.data)});</script></body></html>`);
        }
      });
    }}, tailwindcss()],
  });
  try {
    await server.listen();
    for (const width of [1024, 390, 320]) {
      const screenshot = join(tmpdir(), `feedback-delivery-${width}.png`);
      const {stdout} = await promisify(execFile)(executable, ['--headless=new', '--disable-gpu', '--no-first-run',
        '--no-default-browser-check', `--user-data-dir=${join(directory, `profile-${width}`)}`,
        '--window-size=1280,900', '--dump-dom', '--virtual-time-budget=125000', `--screenshot=${screenshot}`,
        `${server.resolvedUrls.local[0]}feedback-delivery-test?width=${width}`,
      ], {timeout: 140000, maxBuffer: 2 * 1024 * 1024, windowsHide: true});
      const result = stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];
      assert.ok(result && result !== 'RUNNING', `Browser scenarios did not finish: ${stdout.slice(-2000)}`);
      const output = JSON.parse(result.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
      assert.equal(output.width, width, 'Check the actual child viewport');
      assert.equal(output.results.length, 15, 'Every scenario must finish');
      console.log(output.results.map(row => `${row.error ? 'FAIL' : 'PASS'} ${width}px ${row.name}${row.error ? `: ${row.error}` : ''}`).join('\n'));
      assert.deepEqual(output.results.filter(row => row.error), [], 'Mounted feedback regressions');
      assert.ok((await readFile(screenshot)).length > 0, 'Screenshot not captured');
    }
  } finally {
    await server.close();
    const target = await realpath(directory);
    const withinTemp = relative(await realpath(tmpdir()), target);
    assert.ok(!isAbsolute(withinTemp) && !withinTemp.startsWith('..') && basename(target).startsWith('feedback-delivery-browser-'), 'Only remove this run\'s temporary profiles');
    await rm(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
  }
});



