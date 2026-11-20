import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp, rm, realpath, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('Marks overview navigation, truthful states and responsive page hierarchy', { timeout: 240000 }, async () => {
  const frontend = fileURLToPath(new URL('../', import.meta.url));
  const output = process.env.MARKS_OUTPUT || join(frontend, '../output/marks-visual-polish-20261024');
  await mkdir(output, { recursive: true });
  const directory = await mkdtemp(join(tmpdir(), 'marks-visual-'));
  const bundle = join(directory, 'fixture.js');
  await build({ entryPoints: [join(frontend, 'tests/marksVisualPolish.fixture.tsx')], outfile: bundle, bundle: true, format: 'esm', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' });
  const css = (await readdir(join(frontend, 'dist/assets'))).find(name => name.startsWith('index-') && name.endsWith('.css'));
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(await readFile(bundle)); }
    if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(await readFile(join(frontend, 'dist/assets', css))); }
    if (url.pathname === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); return res.end(await readFile(join(directory, 'fixture.css'))); }
    res.setHeader('Content-Type', 'text/html');
    if (url.pathname === '/frame') return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="margin:0;background:#f1f5f9"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
    res.end(`<!doctype html><html><body style="margin:0;background:#e2e8f0;display:flex;justify-content:center"><iframe title="Marks UI fixture" style="border:0;width:${Number(url.searchParams.get('width'))}px;height:1900px" src="/frame?page=${url.searchParams.get('page')}"></iframe><pre id="checks" hidden>RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='marks-visual-results')document.getElementById('checks').textContent=JSON.stringify(event.data)});</script></body></html>`);
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const pages = (process.env.MARKS_PAGES || 'overview-empty,overview-active,overview-error,monitoring,periods-empty,periods,periods-published,periods-archived,periods-archived-only,periods-context,periods-new,rubrics-empty,rubrics-create,rubrics,rubrics-locked,assignment-empty,assignment-closed,assignment,records,records-empty,records-error,records-legacy,records-paged,records-monitoring-empty,lecturer,lecturer-empty,lecturer-error,lecturer-mixed,lecturer-panel-only,history,history-empty,history-retained,history-error,entry,entry-readonly,entry-draft-only,submitted,office-detail,office-overdue-draft,office-extra-time-draft,completion').split(',');
    if (!process.env.MARKS_PAGES) pages.splice(pages.indexOf('assignment') + 1, 0, 'assignment-scheduled', 'assignment-no-tasks');
    const failures = [];
    for (const page of pages) for (const width of [1440, 390, 320]) {
      const screenshot = process.env.MARKS_SCREENSHOTS === '0' ? [] : [`--screenshot=${join(output, `${page}-${width}.png`)}`];
      const { stdout } = await promisify(execFile)('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(directory, `${page}-${width}`)}`, `--window-size=${Math.max(550, width + 40)},1950`, '--force-device-scale-factor=1', '--dump-dom', '--virtual-time-budget=10000', ...screenshot, `http://127.0.0.1:${server.address().port}/?page=${page}&width=${width}`], { windowsHide: true, timeout: 35000, maxBuffer: 3 * 1024 * 1024 });
      const encoded = stdout.match(/<pre id="checks"[^>]*>([\s\S]*?)<\/pre>/)?.[1];
      assert.ok(encoded && encoded !== 'RUNNING', `${page} did not finish`);
      const result = JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
      assert.equal(result.width, width);
      if (result.error) {
        failures.push(`${page} ${width}px: ${result.error}`);
        console.log(`FAIL ${failures.at(-1)}`);
      } else {
        console.log(`PASS ${page} ${width}px: ${result.checks.length} checks`);
      }
    }
    assert.deepEqual(failures, [], 'Marks visual regressions');
  } finally {
    server.close();
    const resolved = await realpath(directory), within = relative(await realpath(tmpdir()), resolved);
    assert.ok(!isAbsolute(within) && !within.startsWith('..') && basename(resolved).startsWith('marks-visual-'));
    await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
