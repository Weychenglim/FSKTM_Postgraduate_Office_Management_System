import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {access, mkdtemp, readFile, realpath, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, relative, isAbsolute, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('mounted marks export', {timeout: 120000}, async () => {
  let browser;
  for (const path of [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].filter(Boolean)) {
    try { await access(path); browser = path; break; } catch {}
  }
  assert.ok(browser, 'Chrome/Edge required');
  const dir = await mkdtemp(join(tmpdir(), 'marks-export-test-'));
  const server = createServer(async (req, res) => {
    if (req.url === '/fixture.js') {
      res.setHeader('Content-Type', 'application/javascript'); res.end(await readFile(join(dir, 'fixture.js')));
    } else if (req.url === '/frame') {
      res.end('<html><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
    } else {
      const width = Number(new URL(req.url, 'http://localhost').searchParams.get('width'));
      res.end(`<html><body><iframe style="width:${width}px;height:1000px" src="/frame"></iframe><pre id="results">RUNNING</pre><script>addEventListener('message',e=>{if(e.origin===location.origin&&e.data.type==='marks-export-results')document.getElementById('results').textContent=JSON.stringify(e.data.results)})</script></body></html>`);
    }
  });
  try {
    await build({entryPoints: [fileURLToPath(new URL('./marksExport.fixture.tsx', import.meta.url))],
      outfile: join(dir, 'fixture.js'), bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic',
      define: {'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}'}});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    for (const width of [1440, 390]) {
      const {stdout} = await promisify(execFile)(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
        '--no-default-browser-check', `--user-data-dir=${join(dir, `profile-${width}`)}`, '--dump-dom',
        '--virtual-time-budget=15000', `http://127.0.0.1:${server.address().port}/?width=${width}`],
      {timeout: 45000, maxBuffer: 2 * 1024 * 1024, windowsHide: true});
      const value = stdout.match(/<pre id="results">([\s\S]*?)<\/pre>/)?.[1];
      assert.ok(value && value !== 'RUNNING', stdout.slice(-2500));
      const results = JSON.parse(value.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
      console.log(width, results);
      assert.equal(results.length, 5);
      assert.deepEqual(results.filter(r => r.error), []);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    const target = await realpath(dir), within = relative(await realpath(tmpdir()), target);
    assert.ok(!isAbsolute(within) && !within.startsWith('..') && basename(target).startsWith('marks-export-test-'));
    await rm(target, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
  }
});
