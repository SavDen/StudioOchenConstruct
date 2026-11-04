const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../dist/engine.js'),V=require('../dist/composition-view.js'),AI=require('../dist/ai-plan.js');
const ctx={};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/data.js'),'utf8'),ctx);const D=ctx.STUDIO_DATA;
const formats={square:{flow:'diagonal',anchor:'center',background:'left',principle:'Диагональная группа.'},landscape:{flow:'horizontal',anchor:'center',background:'right',principle:'Группа вдоль широкого кадра.'},portrait:{flow:'vertical',anchor:'lower',background:'top',principle:'Вертикальная группа.'}};
const plan=()=>({version:1,status:'ready',title:'Любит писать',explanation:['Книга и ручка связаны письмом.'],limitations:[],recipe:'study',layout:'compact',focus:'book',items:[{assetId:'book',role:'main',zone:'auto',crop:'whole'},{assetId:'pen',role:'main',zone:'auto',crop:'whole'},{assetId:'lamp',role:'background',zone:'top-left',crop:'fragment'}],groups:[{kind:'writing',members:[0,1],reason:'Ручка на книге.'}],layers:[{back:2,front:0,reason:'Окружение позади.'},{back:0,front:1,reason:'Ручка на странице.'}],compositions:V.DEFAULTS,formats});
const build=()=>AI.buildCollection(plan(),E.createScene({query:'Любит писать'}),D,E);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('one semantic plan produces nine native scenes with format-specific staging and shared cast',()=>{
 const memory=build();assert.equal(memory.version,2);assert.deepEqual(Object.keys(memory.formats),V.OUTPUTS);
 const cast=s=>s.items.map(i=>[i.uid,i.assetId,i.role]);
 for(const key of V.OUTPUTS){const f=E.FORMATS.find(f=>f.id===key),bank=memory.formats[key];assert.equal(bank.length,3);
  bank.forEach((s,index)=>{assert.equal(s.width,f.width);assert.equal(s.height,f.height);assert.equal(s.composition.index,index);assert.equal(s.scale,1);assert.deepEqual(cast(s),cast(V.current(memory)));assert.deepEqual(E.layoutIssues(s,D),[])});
  assert.equal(new Set(bank.map(s=>JSON.stringify(s.items.map(i=>[i.x,i.y,i.rotation])))).size,3);
 }
 assert.match(memory.formats.landscape[0].items.find(i=>i.role==='background').zone,/right/);
 const poses=V.OUTPUTS.map(k=>{const s=memory.formats[k][1];return s.items.filter(i=>i.role==='main').map(i=>[i.x/s.width,i.y/s.height])});
 assert.equal(new Set(poses.map(JSON.stringify)).size,3);
});
test('S/L keeps all objects, manual poses, support relationships and camera without invoking layout',()=>{
 const original=V.current(build());original.environmentPrompt='Уютная комната';original.camera={scale:1,x:27,y:-19};
 const book=original.items.find(i=>i.assetId==='book'),pen=original.items.find(i=>i.assetId==='pen');
 book.rotation=23;book.flipX=true;pen.x=book.x+101;pen.y=book.y-38;pen.rotation=37;pen.flipY=true;original.items[0].hidden=true;
 const locked={...E,arrange(){throw Error('must not arrange')},REFERENCE:{...E.REFERENCE,environment(){throw Error('must not repack')}}};
 const small=V.changeSize(original,'S',D,locked),restored=V.changeSize(small,'L',D,locked);
 assert.equal(small.width,original.width);assert.equal(small.height,original.height);assert.deepEqual(small.camera,original.camera);assert.equal(small.environmentPrompt,original.environmentPrompt);
 for(let i=0;i<original.items.length;i++){
  const a=original.items[i],b=small.items[i],c=restored.items[i];assert.deepEqual({...b,x:a.x,y:a.y},a);near(c.x,a.x);near(c.y,a.y);
 }
 assert.deepEqual(small.groups,original.groups);assert.deepEqual(small.layerRelations,original.layerRelations);
 const a=E.variant(D,'book','L','main'),b=E.variant(D,'book','S','main'),bp=small.items.find(i=>i.uid===book.uid),pp=small.items.find(i=>i.uid===pen.uid),angle=book.rotation*Math.PI/180;
 const local=(p,o)=>[(p.x-o.x)*Math.cos(angle)+(p.y-o.y)*Math.sin(angle),-(p.x-o.x)*Math.sin(angle)+(p.y-o.y)*Math.cos(angle)];
 const old=local(pen,book),now=local(pp,bp);near(old[0]/a.nativeWidth,now[0]/b.nativeWidth);near(old[1]/a.nativeHeight,now[1]/b.nativeHeight);
});
test('format and variant switching plus JSON reload preserve each independent edit including S/L and environment',()=>{
 let memory=build(),scene=V.current(memory);const expected={};
 for(const format of V.OUTPUTS){memory=V.selectFormat(memory,scene,format,D,E);scene=V.current(memory);
  for(let index=0;index<3;index++){
   memory=V.selectVariant(memory,scene,index,D,E);scene=E.clone(V.current(memory));scene=V.changeSize(scene,index===1?'S':'L',D,E);scene.environmentPrompt=`${format}/${index}`;scene.items[0].x+=17+index;scene.items[0].hidden=index===2;
   memory=V.remember(memory,scene,D,E);expected[format+'/'+index]=E.clone(V.current(memory));
  }
 }
 memory=V.validateMemory(JSON.parse(JSON.stringify(memory)),D,E);
 for(const format of V.OUTPUTS){memory=V.selectFormat(memory,scene,format,D,E);scene=V.current(memory);for(let i=0;i<3;i++){memory=V.selectVariant(memory,scene,i,D,E);scene=V.current(memory);assert.deepEqual(scene,expected[format+'/'+i])}}
});
test('v1 mixed-format projects migrate without losing any saved variant',()=>{
 const project=JSON.parse(fs.readFileSync(require.resolve('./fixtures/legacy-project-v1.json'),'utf8')),old=V.validateMemory(project.memory,D,E);
 const memory=V.upgradeMemory(project.scene,D,E,old);assert.equal(memory.version,2);
 old.scenes.forEach((scene,index)=>assert.deepEqual(memory.formats[scene.format][index],scene));
 assert.deepEqual(V.current(memory),V.current(old));assert.equal(Object.keys(memory.formats).length,4);
});
test('manual canvas dimensions crop existing poses without arranging and new custom memory preserves every variant',()=>{
 let memory=build(),scene=E.clone(V.current(memory));scene.camera={scale:1,x:19,y:-11};scene.items[0].x+=27;scene.items[0].hidden=true;
 memory=V.remember(memory,scene,D,E);const original=E.clone(scene),oldBank=E.clone(memory.formats.square),locked={...E,arrange(){throw Error('resize must not arrange')}};
 const resized=V.resizeCanvas(scene,1330,870,D,locked);assert.equal(resized.format,'custom');assert.deepEqual(resized.items,original.items);assert.deepEqual(resized.camera,original.camera);assert.deepEqual(resized.composition,original.composition);assert.deepEqual(resized.groups,original.groups);assert.deepEqual(resized.layerRelations,original.layerRelations);assert.equal(resized.scale,original.scale);
 memory=V.remember(memory,resized,D,locked);assert.deepEqual(memory.formats.square,oldBank);for(let n=0;n<3;n++)assert.deepEqual(memory.formats.custom[n].items,oldBank[n].items);
 memory=V.selectFormat(memory,resized,'landscape',D,locked);memory=V.selectFormat(memory,V.current(memory),'custom',D,locked);assert.deepEqual(V.current(memory),resized);
 memory=V.validateMemory(JSON.parse(JSON.stringify(memory)),D,E);assert.deepEqual(V.current(memory),resized);
 const again=V.resizeCanvas(resized,1450,910,D,locked);memory=V.remember(memory,again,D,locked);assert.deepEqual(V.current(memory).items,original.items);assert.deepEqual(V.current(memory).camera,original.camera);
 memory=V.selectFormat(memory,again,'square',D,locked);assert.deepEqual(V.current(memory),original);
});
test('canvas dimensions that match a preset preserve manual placement too',()=>{
 const scene=E.clone(V.current(build()));scene.items[0].y+=13;scene.items[0].flipX=true;scene.camera={scale:1,x:-24,y:35};
 for(const [width,height]of [[1200,630],[800,1200],[1000,1000],[500,500]]){const resized=V.resizeCanvas(scene,width,height,D,E);assert.deepEqual(resized.items,scene.items);assert.deepEqual(resized.camera,scene.camera);assert.equal(resized.scale,1)}
 assert.throws(()=>V.resizeCanvas(scene,0,1000,D,E),/формат/);
});
test('manual arrangement follows its variant through all three formats, JSON and a second edit without changing the other variants',()=>{
 let memory=build(),source=E.clone(V.current(memory));const untouched=Object.fromEntries(V.OUTPUTS.map(f=>[f,E.clone(memory.formats[f].slice(1))]));
 const book=source.items.find(i=>i.assetId==='book');source=E.moveScene(source,D,book.uid,{x:book.x+45,y:book.y+22},{resolve:true});source.camera={scale:1,x:17,y:-9};
 memory=V.syncPlacement(memory,source,D,E);
 const relative=s=>s.items.map(i=>[i.uid,i.x+(s.camera?.x||0)-s.width/2,i.y+(s.camera?.y||0)-s.height/2,i.rotation,i.flipX,i.flipY,i.supportUid]);
 for(const format of V.OUTPUTS){const s=memory.formats[format][0];const byId=new Map(relative(s).map(row=>[row[0],row]));for(const row of relative(source)){const actual=byId.get(row[0]);near(actual[1],row[1]);near(actual[2],row[2]);assert.deepEqual(actual.slice(3),row.slice(3))}assert.deepEqual(memory.formats[format].slice(1),untouched[format]);assert.deepEqual(E.layoutIssues(s,D),[])}
 memory=V.validateMemory(JSON.parse(JSON.stringify(memory)),D,E);memory=V.selectFormat(memory,V.current(memory),'portrait',D,E);const second=E.clone(V.current(memory));for(const i of second.items){i.x-=15;i.y+=19}memory=V.syncPlacement(memory,second,D,E);memory=V.selectFormat(memory,second,'square',D,E);
 for(const row of relative(second)){const actual=relative(V.current(memory)).find(r=>r[0]===row[0]);near(actual[1],row[1]);near(actual[2],row[2])}
 memory=V.selectFormat(memory,V.current(memory),'wide',D,{...E,arrange(){throw Error('new manual format must not arrange')}});assert.equal(V.current(memory).width,1920);for(const row of relative(second)){const actual=relative(V.current(memory)).find(r=>r[0]===row[0]);near(actual[1],row[1]);near(actual[2],row[2])}
});
test('compact three-format schema is strict while older saved semantic plans remain compatible',()=>{
 const base=E.createScene(),schema=AI.responseSchema(D,E,base);assert.ok(schema.required.includes('formats'));assert.deepEqual(schema.properties.formats.required,V.OUTPUTS);
 assert.equal(AI.responseSchema(D,E,base,{mode:'environment'}).properties.formats,undefined);
 for(const bad of [{square:formats.square},{...formats,portrait:{...formats.portrait,flow:'zoom'}},{...formats,square:{...formats.square,extra:1}},{...formats,landscape:{...formats.landscape,principle:'x'.repeat(321)}}])assert.throws(()=>AI.validatePlan({...plan(),formats:bad},base,D,E),/План Gemini/);
 const legacy=plan();delete legacy.formats;assert.ok(AI.buildCollection(legacy,base,D,E));
});
