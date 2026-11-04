const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../dist/engine'),AI=require('../dist/ai-plan'),V=require('../dist/composition-view'),c={};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/data.js'),'utf8'),c);const D=c.STUDIO_DATA;
const base=()=>E.createScene({query:'Любит писать',size:'S'});
const plan=(ids=[])=>({version:1,status:'ready',title:'Письмо',explanation:['Книга и ручка образуют главную пару.'],limitations:[],recipe:'study',layout:'compact',focus:'book',items:[...['book','pen'].map(assetId=>({assetId,role:'main',zone:'auto',crop:'whole'})),...ids.map((assetId,n)=>({assetId,role:'background',zone:['top-left','top-right','bottom-right'][n%3],crop:'fragment'}))],groups:[{kind:'writing',members:[0,1],reason:'Письмо на странице.'}],layers:[{back:0,front:1,reason:'Ручка лежит на странице.'},...ids.map((_,n)=>({back:n+2,front:0,reason:'Компаньон позади главной пары.'}))],compositions:V.DEFAULTS});
test('native generation requires a background companion while explicit bans still permit a pair',()=>{
 assert.throws(()=>AI.validatePlan(plan(),base(),D,E),/компаньон/);
 assert.equal(AI.validatePlan(plan(),{...base(),query:'Книга и ручка без фоновых предметов'},D,E).status,'ready');
 assert.equal(AI.validatePlan(plan(),{...base(),environmentPrompt:'Без фоновых предметов'},D,E).status,'ready');
 assert.throws(()=>AI.validatePlan(plan(),{...base(),showSupporting:false},D,E),/компаньон/);
});
test('excluding a background lamp still permits the requested flowers companion',()=>{
 const scene={...base(),environmentPrompt:'Один фоновый предмет: цветы в вазе справа сверху. Без фоновой лампы.'};
 assert.equal(AI.brief(scene.query,scene,D,E,{mode:'environment'}).settings.backgroundsAllowed,true);
 assert.equal(AI.validatePlan(plan(['flowers']),scene,D,E).status,'ready');
 assert.throws(()=>AI.validatePlan(plan(),scene,D,E),/компаньон/);
});
test('one companion or three companions keep the main pair and native source dimensions',()=>{
 for(const ids of [['flowers'],['lamp','flowers','phone']]){const memory=AI.buildCollection(plan(ids),base(),D,E);for(const bank of Object.values(memory.formats))for(const scene of bank){assert.equal(scene.items.filter(i=>i.role==='background').length,ids.length);assert.deepEqual(scene.items.filter(i=>i.role==='main').map(i=>i.assetId),['book','pen']);assert.equal(scene.scale,1);assert.deepEqual(E.layoutIssues(scene,D),[])}}
});
test('model context asks for one companion, honors explicit exclusions and leaves manual scenes editable',()=>{
 assert.deepEqual(AI.brief('Любит писать',base(),D,E).settings.backgroundCompanions,{minimum:1,preferred:1,maximum:3});
 assert.deepEqual(AI.brief('Любит писать',{...base(),environmentPrompt:'Без фоновых предметов'},D,E).settings.backgroundCompanions,{minimum:0,preferred:0,maximum:0});
 assert.throws(()=>AI.validatePlan(plan(['lamp']),{...base(),environmentPrompt:'Без лампы'},D,E),/исключённый/);
 const manual=E.generate('книга ручка',E.createScene({supporting:false}),D).scene;assert.doesNotThrow(()=>E.validateScene(manual,D));
});
test('format edge preferences preserve distinct explicit companion zones across repeated variant building',()=>{
 const input=plan(['lamp','flowers','phone']);input.formats=Object.fromEntries(V.OUTPUTS.map(format=>[format,{flow:'diagonal',anchor:'center',background:'left',principle:'Главная пара и окружение по краям.'}]));
 const memory=AI.buildCollection(input,base(),D,E);for(const bank of Object.values(memory.formats))for(const scene of bank)for(const i of input.items.filter(i=>i.role==='background'))assert.equal(scene.items.find(j=>j.assetId===i.assetId).zone,i.zone);
});
