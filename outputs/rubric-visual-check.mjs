import {build} from '../frontend/node_modules/esbuild/lib/main.js';
import {readFile,writeFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const taskDir=await mkdtemp(join(tmpdir(),'rubric-visual-'));
let source=await readFile('frontend/tests/rubricDrafts.fixture.tsx','utf8');
source=source.slice(0,source.indexOf("await scenario('"))+`
await mount();
rows[0]={...rows[0],name:'Research Project Assessment',description:'Assessment criteria for the postgraduate research project.',componentTotal:'100.00',isReady:true,components:[{...component,name:'Research report',code:'REPORT',maxMarks:'60.00'},{...component,id:12,name:'Presentation',code:'PRES',maxMarks:'40.00',displayOrder:2}]};
await click('Back to rubric families');
await click('Manage rubric');
if(new URLSearchParams(location.search).has('list')) await click('Back to rubric families');
document.body.dataset.layout=JSON.stringify([...document.querySelectorAll('#root,#rubric-version-management,#rubric-version-selector,[data-assessment-components],fieldset')].map(n=>({tag:n.tagName,id:n.id,w:n.getBoundingClientRect().width,left:n.getBoundingClientRect().left,min:getComputedStyle(n).minWidth})));
if(new URLSearchParams(location.search).has('modal')) await click('Add component');
`;
const output=await build({stdin:{contents:source,resolveDir:resolve('frontend/tests'),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{}'}});
const cssName=(await readdir('frontend/dist/assets')).find(n=>n.startsWith('index-')&&n.endsWith('.css'));
const css=await readFile('frontend/dist/assets/'+cssName);
const server=createServer((req,res)=>{if(req.url.includes('width=390')){res.setHeader('content-type','text/html');res.end('<html><body style="margin:0;background:#fff"><iframe style="border:0;width:390px;height:1000px" src="/?frame=1'+(req.url.includes('modal=1')?'&modal=1':'')+(req.url.includes('list=1')?'&list=1':'')+'"></iframe></body></html>');}else if(req.url==='/fixture.js'){res.setHeader('content-type','application/javascript');res.end(output.outputFiles[0].text);}else if(req.url==='/app.css'){res.setHeader('content-type','text/css');res.end(css);}else{res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>*{animation:none!important;transition:none!important}body{background:#f1f5f9}#root{max-width:1200px;margin:auto;padding:32px 24px}#test-results{display:none}@media(max-width:640px){#root{padding:24px 16px}}</style></head><body><div id="root"></div><pre id="test-results"></pre><script type="module" src="/fixture.js"></script></body></html>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 for(const [name,width,modal] of [['desktop',1440,false],['component-modal',1440,true],['mobile',390,false],['component-mobile',390,true],['families',1440,false],['families-mobile',390,false]]){
  const path=resolve('outputs/rubric-'+name+'.png');
  const capture=await promisify(execFile)('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--hide-scrollbars','--user-data-dir='+join(taskDir,name),'--window-size='+(width===390?600:width)+',1000','--screenshot='+path,'--dump-dom','--virtual-time-budget=4000','http://127.0.0.1:'+server.address().port+'/?'+(modal?'modal=1':'')+(name.startsWith('families')?'&list=1':'')+(width===390?'&width=390':'')],{windowsHide:true,timeout:30000});
  console.log(path);console.log(capture.stdout.match(/data-layout="([^"]*)"/)?.[1]);
 }
}finally{await new Promise(r=>server.close(r));await rm(taskDir,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
