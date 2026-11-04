import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import http from 'node:http';
import {createStudioServer} from '../scripts/serve.mjs';
import {createGatewayPolicy} from '../scripts/gateway-policy.mjs';
const req=createRequire(import.meta.url),E=req('../dist/engine'),Client=req('../dist/api-client');
const origin='https://savden.github.io',host='gateway.example';
function httpFetch(url,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const r=http.request(url,{method,headers},response=>{const chunks=[];response.on('data',c=>chunks.push(c));response.on('end',()=>resolve(new Response(response.statusCode===204?null:Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})))});r.on('error',reject);r.end(body)})}
async function running(t,extra={}){let calls=0;const server=createStudioServer({config:{GEMINI_PROXY_URL:'https://proxy.example',GEMINI_PROXY_TOKEN:'server-only-test-token',AI_PUBLIC_HOST:host,AI_ALLOWED_ORIGINS:origin,AI_API_ONLY:'1',...extra},fetchImpl:async()=>{calls++;return Response.json({text:JSON.stringify({version:1,status:'ready',title:'Учёба',explanation:['Книга и лампа'],limitations:[],recipe:'study',layout:'compact',focus:'book',items:[{assetId:'book',role:'main'},{assetId:'lamp',role:'background'}]}),model:'test',finishReason:'STOP'})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r)}));return {url:'http://127.0.0.1:'+server.address().port,calls:()=>calls}}
test('public gateway permits only its configured host and exact Pages origin',async t=>{
 const s=await running(t);
 for(const headers of [{Host:host},{Host:host,Origin:'https://savden.github.io.evil.example'},{Host:'other.example',Origin:origin}])assert.equal((await httpFetch(s.url+'/api/ai-status',{headers})).status,403);
 const response=await httpFetch(s.url+'/api/ai-status',{headers:{Host:host,Origin:origin}});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),origin);assert.equal(response.headers.get('vary'),'Origin');assert.equal((await response.json()).configured,true);assert.equal(s.calls(),0);
 assert.equal((await httpFetch(s.url+'/api/ai-status')).status,200);assert.equal((await httpFetch(s.url+'/api/ai-status',{headers:{Origin:origin}})).status,403);assert.equal((await httpFetch(s.url+'/')).status,404);
});
test('public preflight allows JSON calls and rejects extra authorization headers or methods',async t=>{
 const s=await running(t),headers={Host:host,Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'};
 const good=await httpFetch(s.url+'/api/compose',{method:'OPTIONS',headers});assert.equal(good.status,204);assert.equal(good.headers.get('access-control-allow-headers'),'Content-Type');assert.equal(good.headers.get('access-control-allow-credentials'),null);
 for(const change of [{'Access-Control-Request-Headers':'Authorization'},{'Access-Control-Request-Method':'DELETE'}])assert.equal((await httpFetch(s.url+'/api/compose',{method:'OPTIONS',headers:{...headers,...change}})).status,403);
 assert.equal(s.calls(),0);
});
test('per-client and daily budgets stop upstream calls without exposing the proxy token',async t=>{
 const s=await running(t,{AI_PER_IP_LIMIT:'1',AI_DAILY_LIMIT:'2'}),body=JSON.stringify({query:'Учёба',scene:E.createScene({sizing:'legacy',size:'S'})});
 const post=ip=>httpFetch(s.url+'/api/compose',{method:'POST',headers:{Host:host,Origin:origin,'Content-Type':'application/json','X-Studio-Client-IP':ip},body});
 const first=await post('198.51.100.1');assert.equal(first.status,200);assert.equal((await first.text()).includes('server-only-test-token'),false);
 const limited=await post('198.51.100.1');assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
 assert.equal((await post('198.51.100.2')).status,200);assert.equal((await post('198.51.100.3')).status,429);assert.equal(s.calls(),2);
});
test('public configuration rejects broad or incomplete origins and invalid budgets',()=>{
 for(const config of [{AI_PUBLIC_HOST:host},{AI_ALLOWED_ORIGINS:origin},{AI_PUBLIC_HOST:host,AI_ALLOWED_ORIGINS:'*'},{AI_PUBLIC_HOST:host,AI_ALLOWED_ORIGINS:origin+'/repo/'},{AI_PUBLIC_HOST:host,AI_ALLOWED_ORIGINS:origin,AI_PER_IP_LIMIT:'0'}])assert.throws(()=>createGatewayPolicy(config));
});
test('published client calls HTTPS gateway without browser credentials; local and offline modes stay distinct',async()=>{
 let sent;const fetchImpl=async(...args)=>{sent=args;return 'ok'},remote=Client.create({mode:'remote',apiBase:'https://gateway.example/studio-api/'},fetchImpl);
 assert.equal(await remote.request('/api/compose',{method:'POST',credentials:'include'}),'ok');assert.equal(sent[0],'https://gateway.example/studio-api/api/compose');assert.equal(sent[1].credentials,'omit');assert.equal(sent[1].mode,'cors');assert.throws(()=>remote.request('//evil.example'));
 await Client.create({mode:'local'},fetchImpl).request('/api/ai-status');assert.equal(sent[0],'/api/ai-status');assert.throws(()=>Client.create({mode:'static'},fetchImpl).request('/api/ai-status'));
 for(const apiBase of ['http://gateway.example','https://user:secret@gateway.example','https://gateway.example/?token=secret'])assert.throws(()=>Client.create({mode:'remote',apiBase}));
});
