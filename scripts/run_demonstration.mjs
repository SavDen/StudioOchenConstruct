// A small fresh demonstration run; uses the deployed backend, never a client secret.
import fs from 'node:fs/promises';import path from 'node:path';import vm from 'node:vm';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),E=require('../dist/engine'),P=E.REFERENCE.PHYSICS,V=require('../dist/composition-view'),root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'exports','demonstration-2026-11-04'),context={};vm.runInNewContext(await fs.readFile(path.join(root,'dist/data.js'),'utf8'),context);const D=context.STUDIO_DATA;
for(const name of ['svg','projects','responses'])await fs.mkdir(path.join(dir,name),{recursive:true});
const api=JSON.parse(await fs.readFile(path.join(root,'deployment/pages.json'),'utf8')).apiBase,queries=['Любит писать','Личное пространство','Сохранить самое ценное: кошелёк и монета'],manifest={version:1,size:'S',formats:V.OUTPUTS,variants:3,generatedAt:new Date().toISOString(),cases:[]};
for(const [index,query]of queries.entries()){
 const id=String(index+1).padStart(2,'0');let r;
 for(let attempt=1;attempt<=2;attempt++){
  const response=await fetch(api+'/api/compose',{method:'POST',headers:{Origin:'https://savden.github.io','Content-Type':'application/json'},body:JSON.stringify({query,scene:E.createScene({query,size:'S',palette:['peach','aqua','lavender'][index]})}),signal:AbortSignal.timeout(125000)});r=await response.json();await fs.writeFile(path.join(dir,'responses',id+'-'+attempt+'.json'),JSON.stringify(r,null,2));
  if(response.ok&&r.collection)break;
  console.log(JSON.stringify({id,attempt,status:response.status,error:r.error}));
  if(response.status===429){const delay=Math.min(55000,Math.max(1000,Number(response.headers.get('retry-after')||10)*1000));await new Promise(resolve=>setTimeout(resolve,delay))}
 }
 if(!r.collection)throw Error('No complete demonstration for '+query);
 const entry={id,query,status:'ready',model:r.model,vision:r.vision,explanation:r.plan.explanation,limitations:r.plan.limitations,cast:r.plan.items,outputs:[],project:'projects/'+id+'.json',palette:['peach','aqua','lavender'][index]};
 for(const [format,bank]of Object.entries(r.collection.formats))for(const [n,scene]of bank.entries()){
  if(E.layoutIssues(scene,D).length)throw Error('Invalid main geometry');
  for(const b of scene.items.filter(i=>i.role==='background'))for(const m of scene.items.filter(i=>i.role==='main'))if(P.intersects(b,m,scene,D,E)&&!P.contact(b,m,scene,D,E))throw Error('Background collision');
  const file='svg/'+id+'-'+format+'-v'+(n+1)+'.svg';await fs.writeFile(path.join(dir,file),E.exportSvg(scene,D));entry.outputs.push({format,variant:n+1,file,principle:E.REFERENCE.STAGING.viewFor(scene,n).principle,executionNotes:scene.executionNotes||[],visibility:scene.items.map(i=>({assetId:i.assetId,role:i.role,fraction:P.visibility(i,scene,D,E)}))});
 }
 await fs.writeFile(path.join(dir,entry.project),JSON.stringify({type:'composition-project',version:2,scene:r.scene,memory:r.collection},null,2));manifest.cases.push(entry);await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({query,cast:entry.cast,svgs:entry.outputs.length}));
}
