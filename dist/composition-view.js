/* Camera and arrangement alternatives never replace source vector geometry. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.CompositionView=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const DEFAULTS=[
 {strategy:"balanced",title:"На опоре",placement:"on-surface",principle:"Связанные предметы собраны на общей опоре. Окружение дополняет главную группу фрагментами у краёв кадра."},
 {strategy:"spacious",title:"Рядом",placement:"beside",principle:"Главные предметы расположены рядом. Крупная обрезка сохраняет плотность без изменения исходных размеров."},
 {strategy:"diagonal",title:"Другой ракурс группы",placement:"across",principle:"Меняется взаимное расположение предметов; ручка может лежать поперёк страницы. Исходные размеры сохраняются."}
];
const OUTPUTS=["square","landscape","portrait"];
const BANKS=[...OUTPUTS,"wide","custom"];
function camera(scene){return scene.camera||{scale:1,x:0,y:0}}
function transform(scene){const c=camera(scene);return `matrix(${c.scale} 0 0 ${c.scale} ${c.x} ${c.y})`}
function worldPoint(scene,point){const c=camera(scene);return {x:(point.x-c.x)/c.scale,y:(point.y-c.y)/c.scale}}
function reframe(scene,data,E,changes={}){
 const next=E.validateScene({...scene,...changes},data),items=E.visibleItems(next);
 if(next.sizing==="native"){
  const mains=items.filter(i=>i.role==="main"),target=items.find(i=>i.assetId===next.focus)||mains[0]||items[0],a=E.REFERENCE.area({...next,camera:null});
  if(!target){next.camera={scale:1,x:0,y:0};return next}
  let x=target.x,y=target.y;
  if(next.framing==="overview"&&mains.length){
   const boxes=mains.map(i=>E.boundsFor(i,next,data));x=(Math.min(...boxes.map(b=>b.x))+Math.max(...boxes.map(b=>b.x+b.width)))/2;y=(Math.min(...boxes.map(b=>b.y))+Math.max(...boxes.map(b=>b.y+b.height)))/2;
  }else{const v=E.variant(data,target.assetId,next.size,target.role),o=E.RULES.registry.protectedRegions[target.assetId].optical;x+=(o[0]-.5)*v.nativeWidth;y+=(o[1]-.5)*v.nativeHeight}
  next.camera={scale:1,x:a.x+a.w/2-x,y:a.y+a.h/2-y};return next;
 }
 if(!items.length){next.camera={scale:1,x:0,y:0};return next}
 const boxes=items.map(i=>E.boundsFor(i,next,data));
 const left=Math.min(...boxes.map(b=>b.x)),top=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.width)),bottom=Math.max(...boxes.map(b=>b.y+b.height));
 const area=next.layout==="headline"?{x:next.width*.49,y:next.height*.07,w:next.width*.47,h:next.height*.86}:{x:next.width*.06,y:next.height*.06,w:next.width*.88,h:next.height*.88};
 let scale=Math.min(area.w/Math.max(1,right-left),area.h/Math.max(1,bottom-top)),cx=(left+right)/2,cy=(top+bottom)/2;
 if(next.framing==="focus"){
  const focus=items.find(i=>i.assetId===next.focus)||E.focusFor({...next,items});
  if(focus){const box=E.boundsFor(focus,next,data);scale=Math.min(area.w*.82/box.width,area.h*.84/box.height);cx=box.cx;cy=box.cy}
 }
 scale=Math.max(.05,Math.min(5,scale));
 next.camera={scale,x:area.x+area.w/2-cx*scale,y:area.y+area.h/2-cy*scale};
 return next;
}
function options(input){return input||DEFAULTS.map(i=>({...i}))}
function variants(scene,data,E,plans){
 const definitions=options(plans);
 return definitions.map((definition,index)=>{
  let next=E.arrange({...E.clone(scene),camera:null},{...data},{variation:index,placement:definition.placement,allowContacts:definition.strategy!=="spacious",contactIndex:index});
  if(index&&scene.sizing!=="native"){
   const factor=definition.strategy==="spacious"?.86:.94,cx=scene.width*(scene.layout==="headline"?.74:.5),cy=scene.height*.5,dx=scene.layout==="headline"?0:scene.width*(index===1?-.012:.012),dy=scene.height*(index===1?.008:-.008);
   next.scale*=factor;next.items.forEach(i=>{i.x=cx+(i.x-cx)*factor+dx;i.y=cy+(i.y-cy)*factor+dy});
  }
  next.composition={index,options:definitions};
  next=E.validateScene(next,data);
  if(E.layoutIssues(next,data).length)throw new Error("Вариант не соответствует правилам размещения");
  return next;
 });
}
function validateMemory(memory,data,E){
 if(memory?.version===2){
  if(!BANKS.includes(memory.format)||!Number.isInteger(memory.index)||memory.index<0||memory.index>2||!memory.formats||typeof memory.formats!=="object"||Array.isArray(memory.formats)||Object.keys(memory.formats).some(k=>!BANKS.includes(k))||!memory.formats[memory.format])throw new Error("Некорректная память форматов");
  const formats={};
  for(const [key,bank]of Object.entries(memory.formats)){
   if(!Array.isArray(bank)||bank.length!==3)throw new Error("В каждом формате нужны три варианта");
   formats[key]=bank.map((s,index)=>{const next=E.validateScene(s,data);if(next.format!==key||next.composition?.index!==index)throw new Error("Перепутаны форматы или варианты");return next});
  }
  if(memory.manualPlacements!==undefined&&(!Array.isArray(memory.manualPlacements)||memory.manualPlacements.length>3||new Set(memory.manualPlacements).size!==memory.manualPlacements.length||memory.manualPlacements.some(n=>!Number.isInteger(n)||n<0||n>2)))throw Error("Некорректная память ручной расстановки");
  return {version:2,format:memory.format,index:memory.index,formats,...(memory.manualPlacements?{manualPlacements:[...memory.manualPlacements]}:{})};
 }
 if(!memory||memory.version!==1||!Number.isInteger(memory.index)||memory.index<0||memory.index>2||!Array.isArray(memory.scenes)||memory.scenes.length!==3)throw new Error("Некорректная память вариантов");
 const scenes=memory.scenes.map((s,index)=>{
  const next=E.validateScene(s,data);if(next.composition?.index!==index)throw new Error("Перепутаны варианты композиции");return next;
 });
 return {version:1,index:memory.index,scenes};
}
function createMemory(scene,data,E,generated){
 const index=scene.composition?.index||0,scenes=generated||variants(scene,data,E,scene.composition?.options);
 const memory=validateMemory({version:1,index,scenes},data,E);
 return remember(memory,scene,data,E);
}
function remember(memory,scene,data,E){
 if(memory?.version===2){
  const next=validateMemory(memory,data,E),key=scene.format,index=next.index;
  if(!BANKS.includes(key))throw new Error("Неизвестный формат в памяти");
  if(!next.formats[key])next.formats[key]=next.formats[next.format].map(s=>E.validateScene({...E.clone(s),format:key,width:scene.width,height:scene.height},data));
  const composition={index,options:scene.composition?.options||next.formats[key][index].composition.options};
  next.formats[key][index]=E.validateScene({...scene,composition},data);next.format=key;return next;
 }
 const next=validateMemory(memory,data,E),index=next.index;
 const composition={index,options:scene.composition?.options||next.scenes[index].composition.options};
 next.scenes[index]=E.validateScene({...scene,composition},data);return next;
}
function selectVariant(memory,scene,index,data,E){
 if(!Number.isInteger(index)||index<0||index>2)throw new Error("Неизвестный вариант");
 const next=remember(memory,scene,data,E);next.index=index;return next;
}
function current(memory){return memory.version===2?memory.formats[memory.format][memory.index]:memory.scenes[memory.index]}
function scenesFor(memory){return memory.version===2?memory.formats[memory.format]:memory.scenes}
function bankFor(scene,key,data,E){
 const preset=E.FORMATS.find(f=>f.id===key),source={...E.clone(scene),format:key,camera:null};
 if(preset){source.width=preset.width;source.height=preset.height}
 else if(key!=="custom")throw new Error("Неизвестный формат");
 return variants(source,data,E,scene.composition?.options);
}
function createCollection(scene,data,E){
 const formats={};for(const key of OUTPUTS)formats[key]=bankFor(scene,key,data,E);
 if(!formats[scene.format])formats[scene.format]=bankFor(scene,scene.format,data,E);
 const memory={version:2,format:scene.format,index:scene.composition?.index||0,formats};
 return remember(memory,scene,data,E);
}
function upgradeMemory(scene,data,E,memory=null){
 if(memory?.version===2)return remember(memory,scene,data,E);
 const collection=createCollection(scene,data,E);
 if(memory){
  const old=validateMemory(memory,data,E);
  old.scenes.forEach((s,index)=>{if(!collection.formats[s.format])collection.formats[s.format]=bankFor(s,s.format,data,E);collection.formats[s.format][index]=s});
  collection.index=old.index;collection.format=scene.format;
 }
 return remember(collection,scene,data,E);
}
function selectFormat(memory,scene,format,data,E){
 if(!BANKS.includes(format))throw new Error("Неизвестный формат");
 let next=upgradeMemory(scene,data,E,memory);next=remember(next,scene,data,E);
 if(!next.formats[format]){
  if(next.manualPlacements?.includes(next.index)){
   const preset=E.FORMATS.find(f=>f.id===format),width=preset?.width||scene.width,height=preset?.height||scene.height;
   next.formats[format]=next.formats[next.format].map(s=>E.validateScene({...E.clone(s),format,width,height,items:s.items.map(i=>({...i,x:i.x+(width-s.width)/2,y:i.y+(height-s.height)/2})),sizeGeometryOrigin:undefined},data));
  }else next.formats[format]=bankFor(scene,format,data,E);
 }
 next.format=format;return validateMemory(next,data,E);
}
function resizeCanvas(scene,width,height,data,E){
 const preset=E.FORMATS.find(f=>f.width===width&&f.height===height);
 const next=E.validateScene({...E.clone(scene),width,height,format:preset?.id||"custom"},data);
 if(next.sizing==="native"&&E.layoutIssues(next,data).length)throw Error("Новый холст открывает недопустимое пересечение. Положение предметов сохранено; сначала исправьте пересечение.");
 return next;
}
function syncPlacement(memory,scene,data,E){
 const next=remember(memory,scene,data,E),index=next.index;
 if(next.version!==2)return next;
 next.manualPlacements=[...new Set([...(next.manualPlacements||[]),index])];
 for(const [format,bank]of Object.entries(next.formats)){
  if(format===scene.format)continue;
  const target=bank[index],source=scene.size===target.size?scene:changeSize(scene,target.size,data,E),byId=new Map(source.items.map(i=>[i.uid,i])),targetIds=new Set(target.items.map(i=>i.uid));
  const dx=(target.width-source.width)/2+(source.camera?.x||0)-(target.camera?.x||0),dy=(target.height-source.height)/2+(source.camera?.y||0)-(target.camera?.y||0);
  const items=target.items.map(item=>{const pose=byId.get(item.uid);if(!pose)return item;const value={...item,x:pose.x+dx,y:pose.y+dy,rotation:pose.rotation,flipX:pose.flipX,flipY:pose.flipY};delete value.supportUid;if(pose.supportUid&&targetIds.has(pose.supportUid))value.supportUid=pose.supportUid;return value});
  bank[index]=E.validateScene({...target,items,sizeGeometryOrigin:undefined},data);
 }
 return next;
}
function geometryKey(s){return JSON.stringify([s.size,s.width,s.height,s.layout,s.camera,s.items])}
function changeSize(scene,size,data,E){
 if(!["S","L"].includes(size))throw new Error("Неизвестный набор элементов");
 const original=E.validateScene(scene,data);if(original.size===size)return original;
 if(original.sizing!=="native")throw new Error("Сначала переведите проект в исходные размеры");
 if(original.sizeGeometryOrigin?.size===size&&original.sizeGeometryOrigin.target===geometryKey(original)){
  const restored=E.clone(original),poses=original.sizeGeometryOrigin.poses,byId=new Map(restored.items.map(i=>[i.uid,i]));restored.size=size;delete restored.sizeGeometryOrigin;
  restored.items=poses.map(p=>{const item=byId.get(p.uid);item.x=p.x;item.y=p.y;if(p.supportUid)item.supportUid=p.supportUid;else delete item.supportUid;return item});
  const clean=E.validateScene(restored,data);if(!E.layoutIssues(clean,data).length)return clean;
 }
 const next=E.clone(original),factor=size==="L"?2:.5,a=E.REFERENCE.area(original),pivot={x:a.x+a.w/2,y:a.y+a.h/2};
 next.size=size;next.scale=1;delete next.sizeGeometryOrigin;
 const before=new Map(original.items.map(i=>[i.uid,i])),after=new Map(next.items.map(i=>[i.uid,i])),done=new Set(),visiting=new Set();
 function place(item){
  if(done.has(item.uid))return;
  const old=before.get(item.uid);item.x=pivot.x+(old.x-pivot.x)*factor;item.y=pivot.y+(old.y-pivot.y)*factor;
  if(item.supportUid&&!visiting.has(item.supportUid)&&after.has(item.supportUid)){
   visiting.add(item.uid);const parent=after.get(item.supportUid);place(parent);visiting.delete(item.uid);
   const previous=before.get(parent.uid),v=E.variant(data,parent.assetId,original.size,parent.role),n=E.variant(data,parent.assetId,size,parent.role),angle=previous.rotation*Math.PI/180;
   const dx=old.x-previous.x,dy=old.y-previous.y,lx=dx*Math.cos(angle)+dy*Math.sin(angle),ly=-dx*Math.sin(angle)+dy*Math.cos(angle);
   const x=lx/v.nativeWidth*n.nativeWidth,y=ly/v.nativeHeight*n.nativeHeight;
   item.x=parent.x+x*Math.cos(angle)-y*Math.sin(angle);item.y=parent.y+x*Math.sin(angle)+y*Math.cos(angle);
  }
  done.add(item.uid);
 }
 next.items.forEach(place);
 const clean=E.validateScene(next,data);if(!clean.stagingPlans&&!E.layoutIssues(clean,data).length)return clean;
 const fixed=clean.stagingPlans?E.REFERENCE.STAGING.repairNative(clean,data,E):E.REFERENCE.PHYSICS.constrain(clean,data,E);
 if(!E.layoutIssues(original,data).length)fixed.sizeGeometryOrigin={size:original.size,target:geometryKey(fixed),poses:original.items.map(({uid,x,y,supportUid})=>({uid,x,y,...(supportUid?{supportUid}:{})}))};
 return E.validateScene(fixed,data);
}
return {DEFAULTS,OUTPUTS,BANKS,camera,transform,worldPoint,reframe,variants,validateMemory,createMemory,remember,selectVariant,current,scenesFor,createCollection,upgradeMemory,selectFormat,resizeCanvas,syncPlacement,changeSize};
});
