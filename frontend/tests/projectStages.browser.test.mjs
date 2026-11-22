import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { access, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('Project stage correction review and student declarations', { timeout: 180000 }, async () => {
  let executable;
  for (const path of [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
    try { await access(path); executable = path; break; } catch {}
  }
  assert.ok(executable, 'Chrome/Edge required');
  const directory = await mkdtemp(join(tmpdir(), 'project-stage-review-'));
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('../', import.meta.url)), cacheDir: join(directory, 'vite-cache'), logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, plugins: [{ name: 'project-stage-fixture', configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/stage-review-test')) return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"></head><body><div id="root"></div><pre id="test-results" hidden>RUNNING</pre><script>addEventListener("message",event=>{if(event.origin===location.origin&&event.data.type==="project-stages-results")document.getElementById("test-results").textContent=JSON.stringify(event.data)});</script><script type="module" src="/tests/projectStages.fixture.tsx"></script></body></html>');
      });
    } }, tailwindcss()] });
  try {
    await server.listen();
    for (const width of [1280, 390]) {
      const { stdout } = await promisify(execFile)(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(directory, `profile-${width}`)}`, `--window-size=${width},1100`, '--dump-dom', '--virtual-time-budget=45000', `${server.resolvedUrls.local[0]}stage-review-test`], { timeout: 65000, maxBuffer: 3 * 1024 * 1024, windowsHide: true });
      const encoded = stdout.match(/<pre id="test-results"[^>]*>([\s\S]*?)<\/pre>/)?.[1];
      assert.ok(encoded && encoded !== 'RUNNING', stdout.slice(-3000));
      const result = JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
      console.log(`${width}px: ${JSON.stringify(result.results)}`);
      assert.equal(result.results.length, 9);
      assert.deepEqual(result.results.filter(row => row.error), []);
    }
  } finally {
    await server.close();
    const resolved = await realpath(directory), within = relative(await realpath(tmpdir()), resolved);
    assert.ok(!isAbsolute(within) && !within.startsWith('..') && basename(resolved).startsWith('project-stage-review-'));
    await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
