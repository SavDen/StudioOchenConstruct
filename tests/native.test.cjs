const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=require('../dist/engine.js'),V=require('../dist/composition-view.js'),AI=require('../dist/ai-plan.js');
const context={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/data.js'),'utf8'),context);const D=context.STUDIO_DATA;
const item=(assetId,role='main',overrides={})=>({assetId,role,uid:'inative'+assetId,x:0,y:0,rotation:0,flipX:false,flipY:false,...overrides});
const pose=scene=>scene.items.filter(i=>i.role==='main').map(({uid,assetId,role,x,y,rotation,flipX,flipY,hidden})=>({uid,assetId,role,x,y,rotation,flipX,flipY,hidden}));
function plan(overrides={}){return {version:1,status:'ready',title:'Любит писать',explanation:['Книга и ручка образуют главную группу.'],limitations:[],recipe:'study',layout:'compact',focus:'book',items:[{assetId:'book',role:'main',zone:'auto',crop:'whole'},{assetId:'pen',role:'main',zone:'auto',crop:'whole'},{assetId:'lamp',role:'background',zone:'top-left',crop:'fragment'}],groups:[{kind:'writing',members:[0,1],reason:'Книга и ручка связаны действием письма.'}],layers:[{back:0,front:1,reason:'Ручка находится перед страницей.'},{back:2,front:0,reason:'Лампа задаёт окружение.'}],compositions:V.DEFAULTS,...overrides}}
test('native generation, three alternatives and camera retain exact 1:1 sizes across reference formats',()=>{
 for(const size of ['S','L'])for(const f of E.FORMATS)for(const layout of E.LAYOUTS){
  const source=E.generate('книга ручка',E.createScene({size,format:f.id,width:f.width,height:f.height,layout:layout.id,supporting:false}),D).scene;
  for(const scene of V.variants(source,D,E)){
   assert.equal(scene.scale,1);assert.equal(scene.sizing,'native');assert.deepEqual(E.layoutIssues(scene,D),[]);
   const framed=V.reframe(scene,D,E,{focus:'pen',framing:'focus'});assert.equal(framed.camera.scale,1);assert.deepEqual(framed.items,scene.items);
   const svg=E.exportSvg(framed,D);assert.match(svg,/scale\(1\)/);assert.doesNotMatch(svg,/scale\(0\./);
  }
 }
});
test('standalone source viewBoxes and every path remain exact for all 20 size variants and both color roles',()=>{
 assert.equal(D.manifest.canonicalElements,20);
 for(const asset of D.manifest.assets)for(const size of ['S','L'])for(const role of ['main','background']){
  const variant=asset.variants[size][role],source=fs.readFileSync(path.join(__dirname,'../library',variant.sourceFile),'utf8'),prepared=D.svgs[variant.path];
  const paths=s=>Array.from(s.matchAll(/<path\b[^>]*\sd="([^"]*)"/g),m=>m[1]);
  assert.deepEqual(paths(prepared),paths(source));assert.equal(variant.padding,0);
  const view=s=>s.match(/viewBox="([^"]*)"/)[1];assert.equal(view(prepared),view(source));
  const scene=E.createScene({size,background:'transparent',items:[item(asset.id,role,{x:500,y:500})]});
  assert.deepEqual(paths(E.exportSvg(scene,D)),paths(source));
 }
});
test('native plans reject arbitrary scale and camera zoom, allow custom bounded canvas sizes',()=>{
 const scene=E.generate('книга',E.createScene(),D).scene;
 assert.throws(()=>E.validateScene({...scene,scale:.5},D),/1:1/);
 assert.throws(()=>E.validateScene({...scene,camera:{scale:2,x:0,y:0}},D),/масштаб/);
 assert.equal(E.validateScene({...scene,format:'custom',width:500,height:500},D).width,500);
 assert.throws(()=>E.validateScene({...scene,format:'custom',width:500,height:0},D),/формат/);
});
test('writing variants provide a page contact, adjacent position and crosswise pen without changing dimensions',()=>{
 const scenes=AI.buildVariants(plan(),E.createScene({query:'Любит писать'}),D,E);
 assert.equal(scenes.length,3);assert.equal(scenes[0].items.find(i=>i.assetId==='pen').supportUid,scenes[0].items.find(i=>i.assetId==='book').uid);
 assert.equal(scenes[1].items.find(i=>i.assetId==='pen').supportUid,undefined);
 assert.equal(scenes[2].items.find(i=>i.assetId==='pen').rotation,-65);
 assert.equal(new Set(scenes.map(s=>JSON.stringify(pose(s)))).size,3);assert.ok(scenes.every(s=>s.scale===1));
});
test('reading pair keeps lamp on the left while collection may follow the authored right-hand lamp',()=>{
 const source=E.createScene({items:[item('book'),item('lamp')],groups:[{kind:'reading',members:['inativebook','inativelamp'],reason:'Лампа освещает книгу.'}]});
 const reading=E.arrange(source,D);assert.ok(reading.items.find(i=>i.assetId==='lamp').x<reading.items.find(i=>i.assetId==='book').x);
 const collection=E.arrange({...source,groups:[{kind:'collection',members:['inativebook','inativelamp'],reason:'Самостоятельные предметы.'}]},D);
 assert.ok(collection.items.find(i=>i.assetId==='lamp').x>collection.items.find(i=>i.assetId==='book').x);
});
test('audio composition uses a large native main and a cropped supporting fragment, without mandatory third object',()=>{
 const scene=E.arrange(E.createScene({focus:'headphones',items:[item('headphones'),item('flowers','background',{zone:'top-left',crop:'fragment'})]}),D);
 const b=E.boundsFor(scene.items.find(i=>i.assetId==='headphones'),scene,D);assert.ok(b.width/scene.width>.85);
 const bg=scene.items.find(i=>i.assetId==='flowers'),exposed=E.REFERENCE.exposed(bg,scene,D,E,scene.items.filter(i=>i.role==='main'));
 assert.ok(exposed>.035);assert.ok(exposed<.85);assert.equal(scene.items.length,2);
});
test('environment-only generation preserves exact main poses, order, camera, focus, palette and size',()=>{
 const source=AI.buildVariants(plan(),E.createScene({query:'Любит писать'}),D,E)[2];
 source.environmentPrompt='Уютно, фрагмент цветов справа';source.camera={scale:1,x:-20,y:31};source.palette='peach';
 source.items.find(i=>i.assetId==='book').flipX=true;
 const input=plan({items:[{assetId:'book',role:'main',zone:'auto',crop:'whole'},{assetId:'pen',role:'main',zone:'auto',crop:'whole'},{assetId:'flowers',role:'background',zone:'top-right',crop:'fragment'}],layers:[{back:2,front:0,reason:'Цветы создают домашнюю атмосферу.'},{back:0,front:1,reason:'Порядок главной группы сохраняется.'}]});
 const next=AI.applyEnvironment(input,source,D,E);
 assert.deepEqual(pose(next),pose(source));for(const key of ['camera','focus','palette','size','scale','format','composition','environmentPrompt'])assert.deepEqual(next[key],source[key]);
 assert.ok(next.items.find(i=>i.assetId==='flowers').x>=source.width*.75,'explicit right-hand environment zone must not be replaced with a left-hand free space');
 assert.ok(next.items.some(i=>i.assetId==='flowers'));assert.ok(!next.items.some(i=>i.assetId==='lamp'));
 assert.throws(()=>AI.applyEnvironment({...input,items:input.items.filter(i=>i.assetId!=='pen'),groups:[],layers:[]},source,D,E),/главную группу|порядок слоёв/);
});
test('each variant retains its own environment request, background, transforms and source size through JSON',()=>{
 const source=AI.buildVariants(plan(),E.createScene({query:'Любит писать'}),D,E),original=E.clone(source);
 let memory=V.createMemory(source[0],D,E,source),first=E.clone(memory.scenes[0]);first.environmentPrompt='Вечер, лампа';first.items[0].hidden=true;
 memory=V.selectVariant(memory,first,1,D,E);let second=E.clone(memory.scenes[1]);second.environmentPrompt='Без фоновых предметов';second.items=second.items.filter(i=>i.role==='main');second.size='S';second=E.validateScene(second,D);
 memory=V.selectVariant(memory,second,2,D,E);assert.deepEqual(memory.scenes[2],original[2]);
 memory=V.validateMemory(JSON.parse(JSON.stringify(memory)),D,E);memory=V.selectVariant(memory,memory.scenes[2],0,D,E);
 assert.deepEqual(memory.scenes[0],first);memory=V.selectVariant(memory,memory.scenes[0],1,D,E);assert.deepEqual(memory.scenes[1],second);
});
test('native AI schema and brief distinguish main group, environment and fixed authored dimensions',()=>{
 const scene=E.createScene({query:'Любит писать',environmentPrompt:'вечер'}),schema=AI.responseSchema(D,E,scene),brief=AI.brief(scene.query,scene,D,E,{mode:'environment'});
 assert.ok(schema.required.includes('groups'));assert.ok(schema.properties.compositions.items.required.includes('placement'));
 assert.equal(brief.environmentRequest,'вечер');assert.equal(brief.catalog.find(a=>a.assetId==='book').nativeSize.width,1446);
 assert.equal(AI.validatePlan(plan(),{...scene,framing:'focus'},D,E).items.filter(i=>i.role==='main').length,2);
 assert.throws(()=>AI.validatePlan(plan(),{...scene,environmentPrompt:'без фоновых предметов'},D,E),/запрещены/);
});
test('environment backend transmits locked main subjects and returns only one updated scene without secrets',async t=>{
 const {createStudioServer}=await import('../scripts/serve.mjs');const source=AI.buildVariants(plan(),E.createScene({query:'Любит писать'}),D,E)[0];
 let sent,attempts=0;const server=createStudioServer({config:{GEMINI_PROXY_URL:'https://proxy.example',GEMINI_PROXY_TOKEN:'private-test-token'},fetchImpl:async(url,options)=>{sent=JSON.parse(options.body);if(++attempts===1)return Response.json({error:'temporarily overloaded'},{status:503});return Response.json({text:JSON.stringify(plan()),finishReason:'STOP',model:'test'})}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()}));
 const response=await fetch(`http://127.0.0.1:${server.address().port}/api/compose`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'environment',query:source.query,scene:source})}),result=await response.json();
 assert.equal(response.status,200,JSON.stringify(result));assert.equal(attempts,2);assert.equal(result.variants,null);assert.deepEqual(pose(result.scene),pose(source));
 const brief=JSON.parse(sent.message);assert.equal(brief.mode,'environment');assert.equal(brief.lockedMain.length,2);assert.equal(sent.generationConfig.responseSchema.properties.items.maxItems,5);assert.equal(JSON.stringify(result).includes('private-test-token'),false);
});

test('offset rearranges subjects inside the group while headline reserves the left text field',()=>{
 const source=AI.applyPlan(plan(),E.createScene({query:'Любит писать'}),D,E);
 const compact=E.arrange(source,D),offset=E.arrange({...source,layout:'offset'},D);
 assert.notDeepEqual(pose(compact),pose(offset));assert.equal(compact.scale,offset.scale);
 const headline=E.arrange({...source,layout:'headline'},D),svg=E.exportSvg(headline,D);
 assert.match(svg,/<rect x="430" width="570" height="1000"/);assert.equal(headline.scale,1);
});

test('keyword generation also respects a separate explicit ban on background subjects',()=>{
 const scene=E.generate('Любит писать',E.createScene({environmentPrompt:'Без фоновых предметов'}),D).scene;
 assert.ok(scene.items.every(i=>i.role==='main'));assert.equal(scene.scale,1);
});

test('single-subject variants still offer three positions in every layout without scaling',()=>{
 for(const asset of D.manifest.assets)for(const layout of E.LAYOUTS){
  const source=E.arrange(E.createScene({layout:layout.id,items:[item(asset.id)],focus:asset.id}),D);
  const variants=V.variants(source,D,E);assert.equal(new Set(variants.map(s=>JSON.stringify(pose(s)))).size,3,asset.id+'/'+layout.id);
  assert.ok(variants.every(s=>s.scale===1));
 }
});
