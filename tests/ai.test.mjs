import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createStudioServer,ROOT} from '../scripts/serve.mjs';
const require=createRequire(import.meta.url),E=require('../dist/engine.js'),AI=require('../dist/ai-plan.js');
const data={manifest:JSON.parse(await fs.readFile(ROOT+'/library/manifest.json','utf8')),palettes:JSON.parse(await fs.readFile(ROOT+'/library/palettes.json','utf8'))};
const base=()=>E.createScene({sizing:'legacy',size:'S',format:'landscape',width:1200,height:630,query:'Свет знаний',framing:'focus'});
const plan=(overrides={})=>({version:1,status:'ready',title:'Свет знаний',explanation:['Книга передаёт знания; лампа поддерживает учебный контекст.'],limitations:[],recipe:'study',layout:'compact',focus:'book',items:[{assetId:'book',role:'main'},{assetId:'lamp',role:'background'}],...overrides});
test('AI plan uses deterministic geometry and preserves format, palette and sources',()=>{
 const b=base(),next=AI.applyPlan(plan(),b,data,E);
 assert.equal(next.palette,b.palette);assert.equal(next.size,b.size);assert.equal(next.format,b.format);
 assert.equal(next.focus,'book');assert.equal(next.items.length,2);assert.equal(next.recipe,'study');
 assert.deepEqual(E.layoutIssues(next,data),[]);
 assert.ok(next.items.every(i=>i.rotation===0&&!i.flipX&&!i.flipY));
 assert.equal(b.items.length,0);
});
test('plans reject new assets, injected code, changed layout and excluded objects',()=>{
 assert.throws(()=>AI.validatePlan(plan({items:[{assetId:'penguin',role:'main'}]}),base(),data,E),/неизвестный/);
 assert.throws(()=>AI.validatePlan({...plan(),svg:'<script/>'},base(),data,E),/формат/);
 assert.throws(()=>AI.validatePlan(plan({layout:'offset'}),base(),data,E),/раскладка/);
 assert.throws(()=>AI.validatePlan(plan(),{...base(),query:'книга без лампы'},data,E),/исключённый/);
 assert.throws(()=>AI.validatePlan(plan({items:[{assetId:'book',role:'main',x:100}]}),base(),data,E),/неизвестный/);
});
test('role constraints and unavailable outcomes are explicit',()=>{
 assert.equal(AI.validatePlan(plan(),{...base(),supporting:false,showSupporting:false},data,E).status,'ready');
 assert.throws(()=>AI.validatePlan(plan(),{...base(),query:'Свет знаний без фоновых предметов'},data,E),/запрещены в запросе/);
 assert.throws(()=>AI.validatePlan(plan({items:[{assetId:'book',role:'main'},{assetId:'lamp',role:'main'}]}),base(),data,E),/одного главного/);
 const unavailable=plan({status:'unavailable',focus:'none',items:[],recipe:'auto'});
 assert.equal(AI.applyPlan(unavailable,base(),data,E),null);
 assert.throws(()=>AI.validatePlan(plan({focus:'phone'}),base(),data,E),/акцент/);
});
test('only an explicit text ban excludes background roles; visibility never limits the model',()=>{
 const schema=AI.responseSchema(data,E,{...base(),query:'Свет знаний без фоновых предметов',layout:'headline'});
 assert.deepEqual(schema.properties.items.items.properties.role.enum,['main']);
 assert.deepEqual(schema.properties.layout.enum,['headline']);
 assert.deepEqual(AI.responseSchema(data,E,{...base(),supporting:false,showSupporting:false}).properties.items.items.properties.role.enum,['main','background']);
});
async function fixture(t,fetchImpl){
 const token='secret-proxy-token-do-not-expose';
 const server=createStudioServer({config:{GEMINI_PROXY_URL:'https://proxy.example',GEMINI_PROXY_TOKEN:token},fetchImpl});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()}));
 const url=`http://127.0.0.1:${server.address().port}`;
 return {url,token,post:async(input,headers={})=>fetch(url+'/api/compose',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(input)})};
}
test('backend sends prompt, catalog and schema with server-only proxy token',async t=>{
 let received;
 const f=await fixture(t,async(url,options)=>{
  assert.equal(String(url),'https://proxy.example/api/chat');assert.match(options.headers.Authorization,/^Bearer secret/);
  received=JSON.parse(options.body);assert.match(received.system,/ЭТАП 4\. ДАННЫЕ ДЛЯ ИСПОЛНИТЕЛЯ/);
  assert.equal(JSON.parse(received.message).catalog.length,10);
  assert.equal(received.generationConfig.responseMimeType,'application/json');
  assert.equal(received.generationConfig.responseSchema.properties.items.maxItems,6);
  assert.equal(received.generationConfig.responseSchema.properties.version.enum,undefined,'Google responseSchema supports string enums only');
  return Response.json({text:JSON.stringify(plan()),model:'test-model',finishReason:'STOP',usage:{totalTokenCount:20}});
 });
 const response=await f.post({query:'Свет знаний',scene:base()}),result=await response.json();
 assert.equal(response.status,200);assert.equal(result.plan.title,'Свет знаний');assert.equal(result.scene.items.length,2);
 assert.equal(JSON.stringify(result).includes(f.token),false);
 const status=await(await fetch(f.url+'/api/ai-status')).text();assert.equal(status.includes(f.token),false);
 assert.equal((await fetch(f.url+'/.env')).status,404);
 assert.equal((await fetch(f.url+'/index.html')).status,200);
});
test('malformed model plans and cross-origin requests never replace the scene',async t=>{
 let count=0;
 const f=await fixture(t,async()=>{count++;return Response.json({text:JSON.stringify(plan({focus:'injected'})),finishReason:'STOP'})});
 const response=await f.post({query:'Свет знаний',scene:base()}),result=await response.json();
 assert.equal(response.status,502);assert.equal(result.scene,undefined);
 assert.equal((await f.post({query:'Свет знаний',scene:base()},{Origin:'https://attacker.example'})).status,403);assert.equal(count,1);
});
test('quota errors stay actionable and never expose proxy details',async t=>{
 const f=await fixture(t,async()=>Response.json({error:'secret upstream data'},{status:429}));
 const response=await f.post({query:'Свет знаний',scene:base()}),result=await response.json();
 assert.equal(response.status,429);assert.match(result.error,/лимит/);assert.equal(JSON.stringify(result).includes('secret'),false);
});
test('an explicit request ban is enforced in the outgoing schema',async t=>{
 const f=await fixture(t,async(url,options)=>{
  const sent=JSON.parse(options.body);
  assert.deepEqual(sent.generationConfig.responseSchema.properties.items.items.properties.role.enum,['main']);
  assert.deepEqual(sent.generationConfig.responseSchema.properties.layout.enum,['compact']);
  assert.match(sent.system,/У КАЖДОГО предмета items роль только main/);
  assert.equal(JSON.parse(sent.message).settings.backgroundsAllowed,false);
  return Response.json({text:JSON.stringify(plan({items:[{assetId:'book',role:'main'},{assetId:'lamp',role:'main'}]})),finishReason:'STOP'});
 });
 const response=await f.post({query:'Свет знаний без фоновых предметов',scene:base()});
 const result=await response.json();assert.equal(response.status,200);
 assert.equal(result.scene.supporting,false);assert.ok(result.scene.items.every(i=>i.role==='main'));
});
test('hidden background objects remain in an accepted AI scene and can be shown without regenerating',async t=>{
 const f=await fixture(t,async(url,options)=>{
  const sent=JSON.parse(options.body),settings=JSON.parse(sent.message).settings;
  assert.deepEqual(sent.generationConfig.responseSchema.properties.items.items.properties.role.enum,['main','background']);
  assert.equal(settings.backgroundsAllowed,true);assert.equal(settings.supporting,undefined);assert.equal(settings.showSupporting,undefined);
  return Response.json({text:JSON.stringify(plan()),finishReason:'STOP'});
 });
 const response=await f.post({query:'Свет знаний',scene:{...base(),supporting:false,showSupporting:false}});
 const result=await response.json();assert.equal(response.status,200);
 assert.equal(result.scene.showSupporting,false);assert.equal(result.scene.items.length,2);
 assert.deepEqual(E.visibleItems(result.scene).map(i=>i.assetId),['book']);
 assert.equal(E.visibleItems({...result.scene,showSupporting:true}).length,2);
});
test('semantic layer links override color depth, persist by instance and keep source constraints',()=>{
 const input=plan({focus:'phone',items:[{assetId:'phone',role:'main'},{assetId:'headphones',role:'background'},{assetId:'folder',role:'background'}],layers:[{back:0,front:1,reason:'Наушники на переднем плане передают аудиоформат общения.'},{back:2,front:0,reason:'Папка задаёт рабочий контекст позади телефона.'}]});
 const scene=AI.applyPlan(input,base(),data,E),order=scene.items.map(i=>i.assetId);
 assert.ok(order.indexOf('phone')<order.indexOf('headphones'));assert.ok(order.indexOf('folder')<order.indexOf('phone'));
 assert.equal(scene.layerRelations.length,2);
 assert.deepEqual(E.validateScene(JSON.parse(JSON.stringify(scene)),data).layerRelations,scene.layerRelations);
 for(const variant of AI.buildVariants(input,base(),data,E)){
  const ids=variant.items.map(i=>i.uid);for(const r of variant.layerRelations)assert.ok(ids.indexOf(r.back)<ids.indexOf(r.front));
 }
 const deleted=E.validateScene({...scene,items:scene.items.filter(i=>i.assetId!=='phone')},data);assert.deepEqual(deleted.layerRelations,[]);
});
test('semantic layers reject dangling references, cycles and contradictory authored support depth',()=>{
 const reason='Учебный контекст';
 assert.throws(()=>AI.validatePlan(plan({layers:[{back:0,front:8,reason}]}),base(),data,E),/связь слоёв/);
 assert.throws(()=>AI.validatePlan(plan({layers:[{back:0,front:0,reason}]}),base(),data,E),/связь слоёв/);
 assert.throws(()=>AI.validatePlan(plan({layers:[{back:1,front:0,reason}]}),base(),data,E),/противоречат/);
 assert.throws(()=>AI.validatePlan(plan({layers:[{back:0,front:1,reason},{back:1,front:0,reason}]}),base(),data,E),/противоречат/);
 assert.throws(()=>AI.validatePlan(plan({layers:[]}),base(),data,E),/не задан/);
 const schema=AI.responseSchema(data,E,base());assert.ok(schema.required.includes('layers'));
});
test('promoting a background after hiding the main preserves memory links without blocking manual roles',()=>{
 const input=plan({items:[{assetId:'book',role:'main'},{assetId:'phone',role:'background'}],layers:[{back:1,front:0,reason:'Телефон передаёт цифровой контекст позади учебника.'}]});
 const source=AI.applyPlan(input,base(),data,E),book=source.items.find(i=>i.assetId==='book');
 const {scene,promoted}=E.toggleLayerVisibility(source,book.uid,data);
 assert.equal(scene.items.find(i=>i.uid===promoted).assetId,'phone');
 assert.equal(scene.items.find(i=>i.uid===book.uid).hidden,true);
 assert.equal(scene.layerRelations.length,1);
 const rebuilt=E.arrange(scene,data);assert.ok(E.layerPlan(rebuilt).ignored.length>0);
 assert.equal(rebuilt.items.at(-1).assetId,'phone','new support rules take priority after a manual role change');
});
test('one native Gemini request returns all nine format variants; environment remains a single scene',async t=>{
 let calls=0;
 const V=require('../dist/composition-view.js'),native=E.createScene({query:'Любит писать'});
 const semantic=plan({title:'Любит писать',focus:'book',items:[{assetId:'book',role:'main',zone:'auto',crop:'whole'},{assetId:'pen',role:'main',zone:'auto',crop:'whole'},{assetId:'flowers',role:'background',zone:'top-right',crop:'fragment'}],groups:[{kind:'writing',members:[0,1],reason:'Письмо.'}],layers:[{back:2,front:0,reason:'Окружение.'},{back:0,front:1,reason:'Ручка на книге.'}],compositions:V.DEFAULTS,formats:Object.fromEntries(V.OUTPUTS.map(format=>[format,{flow:format==='portrait'?'vertical':format==='landscape'?'horizontal':'diagonal',anchor:'center',background:'keep',principle:'Компоновка под пропорции.'}]))});
 const f=await fixture(t,async(url,options)=>{
  calls++;const body=JSON.parse(options.body),context=JSON.parse(body.message),schema=body.generationConfig.responseSchema;
  if(context.mode==='compose'){assert.equal(context.outputs.length,3);assert.deepEqual(schema.properties.formats.required,V.OUTPUTS)}else assert.equal(schema.properties.formats,undefined);
  const response={...semantic};if(context.mode==='environment')delete response.formats;
  return Response.json({text:JSON.stringify(response),finishReason:'STOP',model:'fixture'});
 });
 const response=await f.post({query:native.query,scene:native}),result=await response.json();assert.equal(response.status,200);assert.equal(calls,1);assert.equal(result.collection.version,2);assert.equal(Object.values(result.collection.formats).flat().length,9);assert.deepEqual(result.scene,V.current(result.collection));
 const env=await(await f.post({query:native.query,scene:result.scene,mode:'environment'})).json();assert.equal(calls,2);assert.equal(env.collection,null);assert.equal(env.variants,null);assert.deepEqual(env.scene.items.filter(i=>i.role==='main'),result.scene.items.filter(i=>i.role==='main'));
});
