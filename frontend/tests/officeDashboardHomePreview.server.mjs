import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Loopback-only preview of fictional data; no backend proxy or production entry point.
export function createOfficeDashboardPreview(strictPort=true) {
  return createServer({configFile:false,root:fileURLToPath(new URL('../',import.meta.url)),logLevel:'error',server:{host:'127.0.0.1',port:3318,strictPort,hmr:false,watch:null},plugins:[{name:'office-dashboard-home-preview',configureServer(vite){vite.middlewares.use((req,res,next)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname!=='/office-dashboard-home-preview')return next();
  res.setHeader('Content-Type','text/html');
  const width=Number(url.searchParams.get('width'));
  if(width>=280&&width<=2000&&!url.searchParams.has('frame')){
    const frame=new URLSearchParams(url.searchParams);frame.delete('width');frame.set('frame','true');
    res.end(`<!doctype html><html lang="en"><head><title>Dashboard preview ${width}px</title></head><body style="margin:0;background:#e2e8f0;display:flex;justify-content:center"><iframe title="Office Dashboard preview" style="width:${width}px;height:1800px;border:0;background:white" src="/office-dashboard-home-preview?${frame}"></iframe><pre id="preview-test-results" hidden>RUNNING</pre><script>addEventListener('message',event=>{if(event.origin===location.origin&&event.data.type==='home-preview-results')document.getElementById('preview-test-results').textContent=JSON.stringify(event.data)});</script></body></html>`);
  }else res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Office Dashboard · design preview</title><link rel="stylesheet" href="/src/index.css"></head><body${url.searchParams.get('scale')==='200'?' style="zoom:2"':''}><div id="root"></div><script type="module" src="/tests/officeDashboardHomePreview.fixture.tsx"></script></body></html>`);
});}},tailwindcss()]});
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const server=await createOfficeDashboardPreview();
  await server.listen();
  console.log('Office Dashboard preview: http://127.0.0.1:3318/office-dashboard-home-preview');
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
}
