const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Engine=require('../dist/engine.js'),E={...Engine,createScene:options=>Engine.createScene({sizing:'legacy',size:'S',format:'landscape',width:1200,height:630,...options})},V=require('../dist/composition-view.js');
const context={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/data.js'),'utf8'),context);const D=context.STUDIO_DATA;
test('focus and framing change only camera metadata, preserving positions, roles, transforms and layers',()=>{
 const original=E.validateScene(E.generate('книга телефон наушники',E.createScene({framing:'overview'}),D).scene,D);
 const focused=V.reframe(original,D,E,{focus:'phone',framing:'focus'});
 assert.deepEqual(focused.items,original.items);assert.equal(focused.scale,original.scale);
 assert.notDeepEqual(focused.camera,{scale:1,x:0,y:0});
 const overview=V.reframe(focused,D,E,{framing:'overview',focus:'headphones'});
 assert.deepEqual(overview.items,original.items);assert.equal(overview.scale,original.scale);
 const roundtrip=E.validateScene(JSON.parse(JSON.stringify(focused)),D);assert.deepEqual(roundtrip.camera,focused.camera);
 assert.match(E.exportSvg(focused,D),/id="composition-view"/);
});
test('pointer coordinates are mapped back from camera space before manual dragging',()=>{
 const scene={camera:{scale:2.4,x:-100,y:60}};
 const point=V.worldPoint(scene,{x:140,y:300});assert.equal(point.x,100);assert.equal(point.y,100);
});
test('three arrangements differ while preserving subjects, source transforms and placement rules',()=>{
 for(const query of ['книга телефон','книга лампа','книга','Финансы под контролем','книга телефон наушники пазл папка ручка']){
  const source=E.validateScene(E.generate(query,E.createScene({framing:'overview'}),D).scene,D),variants=V.variants(source,D,E);
  assert.equal(variants.length,3);
  const signatures=variants.map(s=>JSON.stringify([s.scale,s.items.map(i=>[i.uid,i.x,i.y])]));
  assert.equal(new Set(signatures).size,3,query);
  for(const s of variants){
   assert.deepEqual(s.items.map(i=>i.assetId).sort(),source.items.map(i=>i.assetId).sort());
   assert.deepEqual(E.layoutIssues(s,D),[],query);assert.equal(s.composition.options.length,3);
  }
 }
});
test('individual layer visibility persists and is respected by SVG export',()=>{
 const scene=E.validateScene(E.generate('книга телефон',E.createScene({supporting:false}),D).scene,D);
 const phone=scene.items.find(i=>i.assetId==='phone');phone.hidden=true;
 const saved=E.validateScene(JSON.parse(JSON.stringify(scene)),D);
 assert.equal(saved.items.find(i=>i.uid===phone.uid).hidden,true);assert.ok(!E.exportSvg(saved,D).includes('data-asset="phone"'));
 assert.equal(saved.items.length,2);
});
function layerScene(items){return E.validateScene(E.createScene({focus:'phone',items:items.map(([assetId,role,hidden],index)=>({uid:'ilayer'+index,assetId,role,x:200+index*150,y:300,rotation:0,...(hidden?{hidden:true}:{})}))}),D)}
test('hiding the only visible main promotes the next visible layer below without moving any item',()=>{
 const scene=layerScene([['lamp','background'],['book','background'],['phone','main']]);
 const result=E.toggleLayerVisibility(scene,'ilayer2',D);
 assert.equal(result.promoted,'ilayer1');assert.equal(result.scene.focus,'book');
 assert.equal(result.scene.items[1].role,'main');assert.equal(result.scene.items[2].hidden,true);
 assert.deepEqual(result.scene.items.map(i=>[i.uid,i.x,i.y,i.rotation]),scene.items.map(i=>[i.uid,i.x,i.y,i.rotation]));
 assert.deepEqual(E.visibleItems(result.scene).filter(i=>i.role==='main').map(i=>i.assetId),['book']);
 assert.equal(scene.items[1].role,'background');assert.equal(scene.items[2].hidden,undefined);
});
test('promotion skips hidden layers and falls back to the closest visible layer above',()=>{
 const lower=layerScene([['lamp','background'],['book','background',true],['phone','main']]);
 assert.equal(E.toggleLayerVisibility(lower,'ilayer2',D).promoted,'ilayer0');
 const upper=layerScene([['phone','main'],['book','background'],['lamp','background']]);
 assert.equal(E.toggleLayerVisibility(upper,'ilayer0',D).promoted,'ilayer1');
});
test('other visible main objects prevent promotion and hiding background objects never promotes',()=>{
 const multiple=layerScene([['lamp','background'],['book','main'],['phone','main']]);
 assert.equal(E.toggleLayerVisibility(multiple,'ilayer2',D).promoted,null);
 const background=layerScene([['book','background'],['phone','main']]);
 assert.equal(E.toggleLayerVisibility(background,'ilayer0',D).promoted,null);
});
test('hiding the last visible item leaves an empty scene without revealing hidden backgrounds',()=>{
 const scene=layerScene([['book','background'],['phone','main']]);scene.showSupporting=false;
 const result=E.toggleLayerVisibility(scene,'ilayer1',D);
 assert.equal(result.promoted,null);assert.equal(E.visibleItems(result.scene).length,0);
 assert.equal(result.scene.items.length,2);
});
test('each variant remembers positions, layer order, visibility, source transforms and scene settings independently',()=>{
 const source=E.validateScene(E.generate('книга телефон',E.createScene({supporting:false,framing:'overview'}),D).scene,D);
 let memory=V.createMemory(source,D,E),first=E.clone(memory.scenes[0]);
 first.items.reverse();first.items[0].x+=37;first.items[0].rotation=19;first.items[0].flipX=true;first.items[0].hidden=true;
 first.palette='peach';first=V.reframe(first,D,E,{framing:'focus',focus:'book'});
 memory=V.selectVariant(memory,first,1,D,E);let second=E.clone(memory.scenes[1]);
 assert.notDeepEqual(second.items,first.items);assert.equal(second.palette,'aqua');
 second.items.splice(0,1);second.background='transparent';second.items[0].x-=29;
 memory=V.selectVariant(memory,second,2,D,E);
 memory=V.selectVariant(memory,memory.scenes[2],0,D,E);
 assert.deepEqual(memory.scenes[0],first);
 memory=V.selectVariant(memory,memory.scenes[0],1,D,E);assert.deepEqual(memory.scenes[1],second);
 const loaded=V.validateMemory(JSON.parse(JSON.stringify(memory)),D,E);assert.deepEqual(loaded,memory);
});
test('explicit format rebuild metadata stays in the current memory slot, and snapshots do not share references',()=>{
 const source=E.validateScene(E.generate('книга телефон',E.createScene(),D).scene,D);
 let memory=V.createMemory(source,D,E);memory=V.selectVariant(memory,source,2,D,E);
 const format=E.FORMATS.find(f=>f.id==='square'),rebuilt=E.arrange({...memory.scenes[2],format:format.id,width:format.width,height:format.height},D);
 assert.equal(rebuilt.composition,null);
 memory=V.remember(memory,rebuilt,D,E);assert.equal(memory.scenes[2].composition.index,2);assert.equal(memory.scenes[0].format,'landscape');
 const restored=V.validateMemory(JSON.parse(JSON.stringify(memory)),D,E);restored.scenes[2].items[0].x+=100;
 assert.notEqual(restored.scenes[2].items[0].x,memory.scenes[2].items[0].x);
 assert.throws(()=>V.validateMemory({...memory,index:3},D,E),/память/);
});
