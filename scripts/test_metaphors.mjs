import fs from 'node:fs/promises';import path from 'node:path';import vm from 'node:vm';import{createRequire}from'node:module';import{setTimeout as delay}from'node:timers/promises';
import{createStudioServer,readConfig,ROOT}from'./serve.mjs';import{readVisualCatalog}from'./visual_catalog.mjs';
const require=createRequire(import.meta.url),E=require('../dist/engine'),V=require('../dist/composition-view'),c={};vm.runInNewContext(await fs.readFile(path.join(ROOT,'dist/data.js'),'utf8'),c);const D=c.STUDIO_DATA,P=E.REFERENCE.PHYSICS;
const queries=['Свет знаний','Поймать мысль','Превратить идеи в слова','Разложить мысли по полочкам','Найти недостающий элемент','Собрать целое из частей','Знания всегда под рукой','От бумажного к цифровому','Учиться в своём ритме','Настроиться на одну волну','Услышать главное','Сосредоточиться на важном','Держать финансы под контролем','Сохранить самое ценное','Навести порядок в делах','Дать идеям расцвести','Найти ключ к решению','Создать пространство для вдохновения'];
export const OUTPUT=path.join(ROOT,'exports','metaphors-2026-11-04');await fs.mkdir(path.join(OUTPUT,'svg'),{recursive:true});await fs.mkdir(path.join(OUTPUT,'projects'),{recursive:true});await fs.mkdir(path.join(OUTPUT,'responses'),{recursive:true});
let manifest;try{manifest=JSON.parse(await fs.readFile(path.join(OUTPUT,'manifest.json'),'utf8'))}catch{manifest={version:1,size:'S',formats:V.OUTPUTS,variants:3,cases:[]}}
const server=createStudioServer({config:await readConfig(),visualCatalog:await readVisualCatalog()});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let last=0;
function diagnostics(s){
 const issues=E.layoutIssues(s,D),warnings=[],mains=s.items.filter(i=>i.role==='main'),backgrounds=s.items.filter(i=>i.role==='background'),visible=[];
 for(const i of s.items){const fraction=P.visibility(i,s,D,E);visible.push({assetId:i.assetId,role:i.role,fraction});if(i.role==='main'&&fraction<.65)warnings.push('Сильно обрезан главный предмет: '+D.manifest.assets.find(a=>a.id===i.assetId).name);if(i.role==='background'&&fraction<.035)warnings.push('Фоновый предмет почти не виден')}
 for(const b of backgrounds)for(const m of mains)if(P.intersects(b,m,s,D,E)&&!P.contact(b,m,s,D,E))issues.push({type:'background-collision',items:[b.uid,m.uid]});
 if(backgrounds.length!==1)warnings.push('Число фоновых компаньонов отличается от одного');return {issues,warnings,visible,executionNotes:s.executionNotes||[]};
}
try{for(const [index,query]of queries.entries()){
 const id=String(index+1).padStart(2,'0');if(manifest.cases.find(c=>c.id===id&&['ready','unavailable'].includes(c.status))){console.log(JSON.stringify({id,query,cached:true}));continue}
 let result,status,attempt=0;for(;attempt<3;attempt++){
  const pause=Math.max(0,6500-(Date.now()-last));if(pause)await delay(pause);last=Date.now();
  try{const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/compose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,mode:'compose',scene:E.createScene({query,size:'S',palette:'aqua'})})});status=response.status;result=await response.json()}catch(error){status=502;result={error:'Network '+error.name}}
  await fs.writeFile(path.join(OUTPUT,'responses',id+'-attempt-'+(attempt+1)+'.json'),JSON.stringify(result,null,2));
  if(status===200)break;console.log(JSON.stringify({id,attempt:attempt+1,http:status,error:result.error}));if(status===429)await delay(55000);
 }
 const entry={id,query,status:status===200?result.plan.status:'error',http:status,attempts:attempt+1,model:result?.model,vision:result?.vision,usage:result?.usage,explanation:result?.plan?.explanation||[],limitations:result?.plan?.limitations||[],error:result?.error,cast:result?.plan?.items||[],outputs:[]};
 if(entry.status==='ready'){
  if(!result.vision||!result.plan.staging)throw Error('Batch did not use the visual planner');
  for(const format of V.OUTPUTS)for(const [variant,s]of result.collection.formats[format].entries()){
   const check=diagnostics(s);if(check.issues.length)throw Error('Invalid exported geometry: '+id+' '+format+' '+variant);
   const file=id+'-'+format+'-v'+(variant+1)+'.svg';await fs.writeFile(path.join(OUTPUT,'svg',file),E.exportSvg(s,D));entry.outputs.push({format,variant:variant+1,file:'svg/'+file,principle:E.REFERENCE.STAGING.viewFor(s,variant).principle,...check});
  }
  entry.project='projects/'+id+'.json';await fs.writeFile(path.join(OUTPUT,entry.project),JSON.stringify({type:'composition-project',version:2,scene:result.scene,memory:result.collection},null,2));
 }
 manifest.cases=manifest.cases.filter(c=>c.id!==id);manifest.cases.push(entry);manifest.cases.sort((a,b)=>a.id.localeCompare(b.id));await fs.writeFile(path.join(OUTPUT,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log(JSON.stringify({id,query,status:entry.status,http:status,cast:entry.cast.map(i=>i.assetId+':'+i.role),svgs:entry.outputs.length,warningViews:entry.outputs.filter(o=>o.warnings.length).length,ms:result?.elapsedMs}));
}}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
console.log(JSON.stringify({done:manifest.cases.length,ready:manifest.cases.filter(c=>c.status==='ready').length,svgCount:manifest.cases.flatMap(c=>c.outputs).length,output:OUTPUT}));
