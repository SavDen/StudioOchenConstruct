import fs from 'node:fs/promises';import path from 'node:path';import vm from 'node:vm';import{createRequire}from'node:module';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'exports','metaphors-2026-11-04'),require=createRequire(import.meta.url),E=require('../dist/engine'),AI=require('../dist/ai-plan'),c={};vm.runInNewContext(await fs.readFile(path.join(root,'dist/data.js'),'utf8'),c);const D=c.STUDIO_DATA,P=E.REFERENCE.PHYSICS,manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
for(const entry of manifest.cases.filter(c=>c.status==='ready')){
 let result;for(let n=1;n<=3;n++){try{const r=JSON.parse(await fs.readFile(path.join(dir,'responses',entry.id+'-attempt-'+n+'.json'),'utf8'));if(r.plan?.status==='ready')result=r}catch{}}
 if(!result)throw Error('Missing successful response '+entry.id);
 const base=E.createScene({query:entry.query,size:'S',palette:result.scene.palette,backgroundDesign:result.scene.backgroundDesign}),memory=AI.buildCollection(result.plan,base,D,E);entry.outputs=[];
 for(const [format,bank]of Object.entries(memory.formats))for(const [index,s]of bank.entries()){
  const issues=E.layoutIssues(s,D),warnings=[],visible=[];for(const i of s.items){const fraction=P.visibility(i,s,D,E);visible.push({assetId:i.assetId,role:i.role,fraction});if(i.role==='main'&&fraction<.65)warnings.push('Сильно обрезан главный предмет: '+D.manifest.assets.find(a=>a.id===i.assetId).name)}
  for(const b of s.items.filter(i=>i.role==='background'))for(const m of s.items.filter(i=>i.role==='main'))if(P.intersects(b,m,s,D,E)&&m.supportUid!==b.uid&&b.supportUid!==m.uid)issues.push({type:'background-collision',items:[b.uid,m.uid]});
  if(issues.length)throw Error('Invalid geometry '+entry.id+' '+format+' '+index);const file=entry.id+'-'+format+'-v'+(index+1)+'.svg';await fs.writeFile(path.join(dir,'svg',file),E.exportSvg(s,D));entry.outputs.push({format,variant:index+1,file:'svg/'+file,principle:E.REFERENCE.STAGING.viewFor(s,index).principle,issues,warnings,visible,executionNotes:s.executionNotes||[]});
 }
 await fs.writeFile(path.join(dir,entry.project),JSON.stringify({type:'composition-project',version:2,scene:memory.formats[memory.format][memory.index],memory},null,2));console.log(JSON.stringify({id:entry.id,views:entry.outputs.length,warnings:entry.outputs.filter(o=>o.warnings.length).length}));
}
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
