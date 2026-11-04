/* Executes model-authored placements; native dimensions and the registry are authoritative. */
(function(root,factory){const local=typeof module==='object'&&module.exports,api=factory(local?require('./physical-layout.js'):root.PhysicalLayout,local?require('./interaction-registry.js'):root.InteractionRegistry);if(local)module.exports=api;else root.StagingPlan=api})(typeof globalThis!=='undefined'?globalThis:this,function(P,R){
'use strict';
const FORMATS=['square','landscape','portrait'],RELATIONS=['canvas','on','left','right','above','below'];
function validateRows(rows,items,{indices=false,backgroundOnly=false}={}){
 if(!Array.isArray(rows)||rows.length>32)throw Error('Некорректный план размещения');
 const find=id=>indices?items[id]:items.find(i=>i.uid===id),seen=new Set();
 for(const p of rows){
  const id=indices?p.item:p.uid,target=indices?p.target:p.targetUid,item=find(id);
  if(!p||Object.keys(p).some(k=>!(indices?['item','target','relation','x','y','gap','rotation']:['uid','targetUid','relation','x','y','gap','rotation']).includes(k))||!item||seen.has(id)||!RELATIONS.includes(p.relation)||![p.x,p.y].every(n=>Number.isFinite(n)&&n>=-.75&&n<=1.75)||!Number.isFinite(p.gap)||p.gap<0||p.gap>.3||!Number.isFinite(p.rotation)||p.rotation< -180||p.rotation>180)throw Error('Некорректное положение предмета');
  if(indices&&(!Number.isInteger(id)||!Number.isInteger(target)))throw Error('Некорректный индекс предмета');
  if(backgroundOnly&&item.role!=='background')throw Error('Окружение изменяет положение главного предмета');
  seen.add(id);
  if(p.relation==='canvas'){if(indices?target!==-1:target!==undefined)throw Error('У положения на холсте не должно быть опоры')}
  else{
   const base=find(target);if(!base||target===id)throw Error('Неизвестная опора или сосед');
   if(p.relation==='on'&&!P.allowed(base,item))throw Error('Недопустимая опора в плане размещения');
   if(p.relation==='on'&&(p.x<0||p.x>1||p.y<0||p.y>1))throw Error('Опорная точка вне предмета');
  }
  if(['standing'].includes(R.physicalClass(item.assetId))&&p.rotation!==0)throw Error('Стоящий предмет нельзя наклонять');
 }
 const expected=items.filter(i=>!backgroundOnly||i.role==='background');if(rows.length!==expected.length||expected.some(i=>!seen.has(indices?items.indexOf(i):i.uid)))throw Error('План должен разместить каждый предмет ровно один раз');
 const visiting=new Set(),done=new Set();function visit(id){if(done.has(id))return;if(visiting.has(id))throw Error('Циклическое размещение предметов');visiting.add(id);const p=rows.find(r=>(indices?r.item:r.uid)===id);if(p&&p.relation!=='canvas')visit(indices?p.target:p.targetUid);visiting.delete(id);done.add(id)}for(const id of seen)visit(id);
 return rows;
}
function validateBanks(banks,items){
 if(!banks||typeof banks!=='object'||Array.isArray(banks)||Object.keys(banks).length!==3||FORMATS.some(f=>!banks[f]))throw Error('Нужны планы размещения трёх форматов');
 for(const views of Object.values(banks)){
  if(!Array.isArray(views)||views.length!==3)throw Error('Нужны три плана для каждого формата');
  for(const v of views){if(!v||Object.keys(v).some(k=>!['principle','placements'].includes(k))||typeof v.principle!=='string'||!v.principle.trim()||v.principle.length>320)throw Error('Некорректный принцип размещения');validateRows(v.placements,items,{indices:true})}
 }return banks;
}
function fromBanks(banks,items){validateBanks(banks,items);return FORMATS.map(format=>({format,views:banks[format].map(v=>({principle:v.principle,placements:v.placements.map(p=>({uid:items[p.item].uid,relation:p.relation,...(p.target>=0?{targetUid:items[p.target].uid}:{}),x:p.x,y:p.y,gap:p.gap,rotation:p.rotation}))}))}))}
function cleanPlans(plans,items){
 if(plans===undefined)return undefined;if(!Array.isArray(plans)||plans.length!==3||new Set(plans.map(p=>p?.format)).size!==3||plans.some(p=>!FORMATS.includes(p?.format)))throw Error('Некорректная память планов размещения');
 // Editing a cast invalidates its old automatic plans, without blocking deletion.
 if(plans.some(p=>p.views?.some(v=>v.placements?.length!==items.length||v.placements?.some(r=>!items.some(i=>i.uid===r.uid)||r.targetUid&&!items.some(i=>i.uid===r.targetUid)))))return undefined;
 for(const bank of plans){if(Object.keys(bank).some(k=>!['format','views'].includes(k))||!Array.isArray(bank.views)||bank.views.length!==3)throw Error('Некорректная память планов размещения');for(const v of bank.views){if(typeof v.principle!=='string'||v.principle.length>320)throw Error('Некорректный принцип размещения');validateRows(v.placements,items)}}
 return JSON.parse(JSON.stringify(plans));
}
function area(s){const c=s.camera||{x:0,y:0};return {x:(s.layout==='headline'?s.width*.43:0)-c.x,y:-c.y,w:s.width*(s.layout==='headline'?.57:1),h:s.height}}
function viewFor(s,index=0){const key=FORMATS.includes(s.format)?s.format:s.height>s.width*1.12?'portrait':s.width>s.height*1.12?'landscape':'square';return s.stagingPlans?.find(b=>b.format===key)?.views[index]}
function opticalOffset(i,s,data,E){const v=E.variant(data,i.assetId,s.size,i.role),o=R.protectedRegions[i.assetId].optical,r=i.rotation*Math.PI/180,x=(o[0]-.5)*v.nativeWidth*(i.flipX?-1:1),y=(o[1]-.5)*v.nativeHeight*(i.flipY?-1:1);return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)}}
function place(i,p,s,data,E){
 const a=area(s);i.rotation=p.rotation;const opt=opticalOffset(i,s,data,E);i.x=a.x+a.w*p.x-opt.x;i.y=a.y+a.h*p.y-opt.y;delete i.supportUid;
 if(p.relation==='canvas')return;
 const target=s.items.find(j=>j.uid===p.targetUid);if(!target)throw Error('Не найдена цель размещения');
 if(p.relation==='on'){
  const v=E.variant(data,target.assetId,s.size,target.role),r=target.rotation*Math.PI/180,x=(p.x-.5)*v.nativeWidth*(target.flipX?-1:1),y=(p.y-.5)*v.nativeHeight*(target.flipY?-1:1);i.x=target.x+x*Math.cos(r)-y*Math.sin(r);i.y=target.y+x*Math.sin(r)+y*Math.cos(r);i.supportUid=target.uid;return;
 }
 const b=P.bounds(target,s,data,E),own=P.bounds(i,s,data,E),gap=Math.max(s.size==='S'?10:18,Math.min(a.w,a.h)*p.gap);
 if(p.relation==='left')i.x+=Math.min(0,b.x-gap-(own.x+own.width));
 if(p.relation==='right')i.x+=Math.max(0,b.x+b.width+gap-own.x);
 if(p.relation==='above')i.y+=Math.min(0,b.y-gap-(own.y+own.height));
 if(p.relation==='below')i.y+=Math.max(0,b.y+b.height+gap-own.y);
}
function keepReadable(s,data,E){
 const a=area(s);for(const item of s.items.filter(i=>i.role==='main'&&['phone','puzzle','wallet','coin','pen','headphones','lamp','flowers'].includes(i.assetId))){
  const b=P.bounds(item,s,data,E),pad=Math.min(a.w,a.h)*.02;let dx=0,dy=0;if(b.width<=a.w-pad*2)dx=Math.max(a.x+pad,Math.min(a.x+a.w-pad-b.width,b.x))-b.x;if(b.height<=a.h-pad*2)dy=Math.max(a.y+pad,Math.min(a.y+a.h-pad-b.height,b.y))-b.y;
  let root=item;const seen=new Set();while(root.supportUid&&!seen.has(root.uid)){seen.add(root.uid);root=s.items.find(i=>i.uid===root.supportUid)||root;if(seen.has(root.uid))break}const ids=P.attached(s,root.uid);for(const i of s.items)if(ids.has(i.uid)){i.x+=dx;i.y+=dy}
 }return s;
}
function fitBackground(s,item,data,E,placed,{outward=false}={}){
 const originals={x:item.x,y:item.y},a=area(s),b=P.bounds(item,s,data,E),mains=s.items.filter(i=>i.role==='main'&&!i.hidden),target=item.crop==='whole'?.85:.24,points=[originals],xs=[item.x],ys=[item.y];
 if(outward&&[...mains,...placed].some(i=>P.intersects(item,i,s,data,E))){
  const probe={...s,items:[...mains,...placed,item]},fixed=P.separateOutward(probe,data,E,{includeBackground:true,movable:[...placed,item].map(i=>i.uid)}),byId=new Map(fixed.items.map(i=>[i.uid,i]));
  for(const i of [...placed,item]){const p=byId.get(i.uid);i.x=p.x;i.y=p.y}return;
 }
 for(const f of [-.4,-.2,0,.12,.28,.5,.72,.88,1,1.2,1.4]){xs.push(a.x+a.w*f);ys.push(a.y+a.h*f)}
 for(const x of xs)for(const y of ys)points.push({x,y});points.sort((p,q)=>(p.x-originals.x)**2+(p.y-originals.y)**2-(q.x-originals.x)**2-(q.y-originals.y)**2);
 let best=null;for(const p of points){const candidate={...item,...p},visible=P.visibility(candidate,s,data,E);if(visible<.035||mains.some(m=>P.intersects(candidate,m,s,data,E)))continue;if(placed.some(m=>P.intersects(candidate,m,s,data,E)))continue;
  const distance=((p.x-originals.x)/Math.max(a.w,b.width))**2+((p.y-originals.y)/Math.max(a.h,b.height))**2,score=distance+Math.abs(visible-target)*.22;if(!best||score<best.score)best={...p,score};if(distance===0)break;
 }if(!best)throw Error('Не удалось разместить фоновый предмет без пересечения с главными. Выберите S или другой вариант.');item.x=best.x;item.y=best.y;
}
function constrainReadable(s,data,E,{outward=false}={}){const a=area(s),minimums={},priorities={};for(const i of s.items.filter(i=>i.role==='main')){const b=P.bounds(i,s,data,E);priorities[i.uid]=R.physicalClass(i.assetId)==='surfaces'?1:0;if(b.width<=a.w&&b.height<=a.h)minimums[i.uid]=R.physicalClass(i.assetId)==='surfaces'?.65:1}try{return P.constrain(s,data,E,{minimums,priorities,outward})}catch(error){for(const i of s.items.filter(i=>i.role==='main'&&R.physicalClass(i.assetId)==='surfaces'))minimums[i.uid]=.16;try{return P.constrain(s,data,E,{minimums,priorities,outward})}catch{for(const id of Object.keys(minimums))if(minimums[id]===1)minimums[id]=.65;return P.constrain(s,data,E,{minimums,priorities,outward})}}}
function frameReadable(scene,data,E){
 // Pan only when all individually fitting non-surface mains can share a frame.
 // Their world poses and support offsets stay exact; large surfaces may crop.
 const a=area({...scene,camera:null}),mains=E.visibleItems(scene).filter(i=>i.role==='main'),targets=mains.filter(i=>R.physicalClass(i.assetId)!=='surfaces').map(i=>P.bounds(i,scene,data,E)).filter(b=>b.width<=a.w&&b.height<=a.h);
 if(!targets.length)return scene;
 let minX=-Infinity,maxX=Infinity,minY=-Infinity,maxY=Infinity;
 for(const b of targets){const px=Math.min(a.w*.02,(a.w-b.width)/2),py=Math.min(a.h*.02,(a.h-b.height)/2);minX=Math.max(minX,a.x+px-b.x);maxX=Math.min(maxX,a.x+a.w-px-b.x-b.width);minY=Math.max(minY,a.y+py-b.y);maxY=Math.min(maxY,a.y+a.h-py-b.y-b.height)}
 if(minX>maxX||minY>maxY)return scene;
 const c=scene.camera||{x:0,y:0},x=Math.max(minX,Math.min(maxX,c.x)),y=Math.max(minY,Math.min(maxY,c.y));
 if(Math.abs(x-c.x)<.01&&Math.abs(y-c.y)<.01)return scene;
 const next={...scene,camera:{scale:1,x,y}};
 if(mains.some(i=>P.visibility(i,next,data,E)<Math.min(P.visibility(i,scene,data,E),R.physicalClass(i.assetId)==='surfaces'?.16:.65)))return scene;
 // Panning must not reveal an invalid contact that used to be outside the crop.
 if(P.issues(next,data,E).length)return scene;
 return next;
}
function execute(scene,data,E,view,{lockedMain=false}={}){
 if(!view)return null;let s=E.clone(scene);s.scale=1;if(!lockedMain)s.camera=null;
 const rows=view.placements,done=new Set(),visiting=new Set(),original=new Map();
 if(!lockedMain){const ids=s.items.filter(i=>i.role==="main").map(i=>i.uid);s.groups=(s.groups||[]).filter(g=>g.kind!=="surface"&&!(g.kind==="collection"&&g.members.length===ids.length&&ids.every(id=>g.members.includes(id))));if(ids.length>1)s.groups.push({kind:"collection",members:ids,reason:(view.principle||"Composition").slice(0,240)})}
 function visit(uid){if(done.has(uid))return;if(visiting.has(uid))throw Error('Циклический план размещения');visiting.add(uid);const p=rows.find(r=>r.uid===uid);if(!p){done.add(uid);visiting.delete(uid);return}if(p.targetUid)visit(p.targetUid);const i=s.items.find(j=>j.uid===uid);if(!i)throw Error('Предмет отсутствует в плане');if(lockedMain&&i.role==='main')throw Error('Окружение изменяет главную группу');place(i,p,s,data,E);original.set(uid,{x:i.x,y:i.y,supportUid:i.supportUid});done.add(uid);visiting.delete(uid)}
 for(const p of rows)visit(p.uid);E.orderLayers(s,{strict:true});if(!lockedMain){keepReadable(s,data,E);s=constrainReadable(s,data,E,{outward:true});s=frameReadable(s,data,E)}
 const placed=[];for(const i of s.items.filter(i=>i.role==='background'&&!i.hidden)){
  if(i.supportUid||s.items.some(j=>j.supportUid===i.uid)){placed.push(i);continue}const p=rows.find(r=>r.uid===i.uid);if(p&&!lockedMain&&p.targetUid)place(i,p,s,data,E);fitBackground(s,i,data,E,placed,{outward:true});placed.push(i);
 }
 E.orderLayers(s,{strict:true});if(P.issues(s,data,E).length)throw Error('Главная группа нарушает реестр пересечений');
 s.executionNotes=[];if(!lockedMain&&s.camera&&(Math.abs(s.camera.x)>.01||Math.abs(s.camera.y)>.01))s.executionNotes.push('Кадр сдвинут без масштабирования, чтобы снизить обрезку главных предметов.');for(const i of s.items){const p=original.get(i.uid);if(p&&(Math.hypot(p.x-i.x,p.y-i.y)>2||p.supportUid!==i.supportUid))s.executionNotes.push('Положение «'+data.manifest.assets.find(a=>a.id===i.assetId).name+'» уточнено по границам кадра и реестру пересечений.')}
 s.executionNotes=s.executionNotes.slice(0,12);return s;
}
function repairNative(scene,data,E){let s=E.clone(scene);keepReadable(s,data,E);s=constrainReadable(s,data,E);const placed=[];for(const i of s.items.filter(i=>i.role==='background'&&!i.hidden)){if(!i.supportUid&&!s.items.some(j=>j.supportUid===i.uid))fitBackground(s,i,data,E,placed);placed.push(i)}E.orderLayers(s,{strict:true});return s}
return {FORMATS,RELATIONS,validateRows,validateBanks,fromBanks,cleanPlans,viewFor,execute,repairNative,frameReadable};
});
