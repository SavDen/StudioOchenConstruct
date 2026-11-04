/* Keyword selection, template placement and vector export. No DOM or API required. */
(function(root,factory){const local=typeof module==="object"&&module.exports;const api=factory(local?require("./composition-rules.js"):root.CompositionRules,local?require("./geometry.js"):root.SourceGeometry,local?require("./reference-layout.js"):root.ReferenceLayout);if(local)module.exports=api;else root.CompositionEngine=api})(typeof globalThis!=="undefined"?globalThis:this,function(RULES,GEOMETRY,REFERENCE){
"use strict";
const FORMATS=[{id:"landscape",name:"Горизонтальный",width:1200,height:630},{id:"square",name:"Квадрат",width:1000,height:1000},{id:"portrait",name:"Вертикальный",width:800,height:1200},{id:"wide",name:"Широкий",width:1920,height:1080}];
const LAYOUTS=[{id:"compact",name:"Собранно"},{id:"offset",name:"Со смещением"},{id:"headline",name:"Под заголовок"}];
const DIRECT={
book:["книг","book","учебник"],phone:["телефон","смартфон","айфон","iphone","phone"],puzzle:["пазл","puzzle"],coin:["монет","coin"],headphones:["наушник","headphone"],lamp:["ламп","светильник","lamp"],flowers:["цветы","цветов","цветоч","тюльпан","букет","ваз","flower"],wallet:["кошел","wallet"],folder:["папк","folder"],pen:["ручк","pen"]};
const SEMANTIC={
book:["чтен","читат","читаю","обуч","учеб","учит","учиться","знан","образован","опыт"],
phone:["онлайн","online","приложен","цифров","связ","технолог","интернет","мобильн"],
puzzle:["решен","задач","вместе","команд","сотруднич","объедин","сложн","недоста"],
coin:["безопас","защит","накоп","деньг","ценност","ценность","сбереж","замок"],
headphones:["музык","аудио","слуш","подкаст","концентрац","звук","вниман"],
lamp:["свет","идея","идеи","идею","вдохнов","понят","пониман","озарен","работ","ясно"],
flowers:["забот","уют","подар","весн","благополуч","рост"],
wallet:["финанс","бюджет","расход","деньг","оплат","платеж","платёж"],
folder:["документ","поряд","организац","хранен","оформлен","файл","план"],
pen:["писат","пиш","письм","запис","замет","план","творч","подпис","состав"]};
const normalize=s=>String(s||"").toLocaleLowerCase("ru").replace(/ё/g,"е");
const tokenize=s=>normalize(s).match(/[a-zа-я0-9]+/g)||[];
const matchStem=(word,stem)=>stem.length<4?word===stem:word.startsWith(stem);
const hits=(words,stems)=>stems.filter(stem=>words.some(w=>matchStem(w,normalize(stem))));
const assetById=(data,id)=>data.manifest.assets.find(a=>a.id===id);
const uid=()=> "i"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const clone=x=>JSON.parse(JSON.stringify(x));
const escapeXml=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const fmt=n=>Number(Number(n).toFixed(5)).toString();
function recipeFor(scene){
 const forced=RULES.recipes.find(r=>r.id===scene.recipe);
 if(forced)return forced;
 const positive=normalize(scene.query).replace(/(?:\bwithout\b|без|не добавля(?:ть|й|йте)|исключи(?:ть|те)?)\s+([^,.;]+)/g," ");
 const words=tokenize(positive),ids=(scene.items||[]).filter(i=>i.role!=="background").map(i=>i.assetId);
 let best=RULES.recipes[0],bestScore=-1;
 for(const r of RULES.recipes){
  const score=hits(words,r.words).length*12+ids.reduce((sum,id)=>sum+(r.affinity[id]||0),0);
  if(score>bestScore){best=r;bestScore=score}
 }
 return best;
}
function pick(query,data,{supporting=true,recipe="auto",nativeWriting=true}={}){
 let text=normalize(query).slice(0,600),excluded=new Set();
 text=text.replace(/(?:\bwithout\b|без|не добавля(?:ть|й|йте)|исключи(?:ть|те)?)\s+([^,.;]+)/g,(_,clause)=>{
  const words=tokenize(clause);
  for(const id of Object.keys(DIRECT))if(hits(words,[...DIRECT[id],...SEMANTIC[id]]).length)excluded.add(id);
  return " ";
 });
 const words=tokenize(text);
 const matches=data.manifest.assets.map((a,index)=>{
  const direct=hits(words,DIRECT[a.id]),semantic=hits(words,SEMANTIC[a.id]);
  return {assetId:a.id,score:direct.length*100+semantic.length*10,direct:direct.length>0,reasons:[...direct,...semantic],index};
 }).filter(a=>a.score>0&&!excluded.has(a.assetId)).sort((a,b)=>b.score-a.score||a.index-b.index);
 const context=recipeFor({query:text,recipe,items:matches.map(a=>({assetId:a.assetId,role:"main"}))});
 const direct=matches.filter(a=>a.direct);
 const hasTopic=hits(words,context.words).length>0;
 let selected=direct;
 if(!direct.length&&(matches.length||hasTopic||(!words.length&&recipe!=="auto"))){
  const writing=nativeWriting&&hits(words,["писат","пиш","письм"]).length>0;
  const ids=[...new Set([...(writing?["book","pen"]:context.main),...matches.map(a=>a.assetId)])].filter(id=>!excluded.has(id)).slice(0,4);
  selected=ids.map(id=>matches.find(m=>m.assetId===id)||{assetId:id,score:1,direct:false,reasons:["Сцена: "+context.name],index:data.manifest.assets.findIndex(a=>a.id===id)});
 }
 const items=selected.map(a=>({assetId:a.assetId,role:"main"}));
 if(supporting&&!/без\s+фон|только\s+главн/.test(normalize(query))&&items.length){
  const ids=new Set(items.map(a=>a.assetId));
  const extra=context.support.find(id=>!ids.has(id)&&!excluded.has(id));
  if(extra)items.push({assetId:extra,role:"background"});
 }
 return {items,matches:selected,excluded:[...excluded],recipeId:context.id,mode:direct.length?"components":"keywords"};
}
function createScene(overrides={}){
 return {version:1,sizing:"native",environmentPrompt:"",environmentExplanation:[],groups:[],formatPlans:[],width:1000,height:1000,format:"square",size:"L",palette:"aqua",layout:"compact",background:"pattern",backgroundDesign:"auto",supporting:true,showSupporting:true,recipe:"auto",framing:"overview",focus:"auto",query:"Свет знаний",scale:1,items:[],...overrides};
}
function focusFor(scene){
 const chosen=scene.items.find(i=>i.assetId===scene.focus);if(chosen)return chosen;
 const mains=scene.items.filter(i=>i.role==="main");
 if(!mains.length)return scene.items[0]||null;
 const manual=mains.find(i=>i.assetId===scene.focus);if(manual)return manual;
 const positive=normalize(scene.query).replace(/(?:\bwithout\b|без|не добавля(?:ть|й|йте)|исключи(?:ть|те)?)\s+([^,.;]+)/g," "),words=tokenize(positive);
 // A named component is a stronger signal than a generic thematic default.
 const named=mains.filter(i=>hits(words,DIRECT[i.assetId]).length);
 if(named.length===1)return named[0];
 for(const [id,stems]of Object.entries(RULES.focusWords)){const item=mains.find(i=>i.assetId===id);if(item&&hits(words,stems).length)return item}
 return mains.find(i=>i.assetId===RULES.focusDefaults[recipeFor(scene).id])||mains[0];
}
function variant(data,id,size,role){
 const v=assetById(data,id)?.variants?.[size]?.[role];
 if(!v)throw new Error("Нет исходного варианта "+[id,size,role].join("/"));
 return v;
}
function boundsFor(item,scene,data){
 const v=variant(data,item.assetId,scene.size,item.role),w=v.nativeWidth*scene.scale,h=v.nativeHeight*scene.scale;
 const rad=item.rotation*Math.PI/180;
 const bw=Math.abs(w*Math.cos(rad))+Math.abs(h*Math.sin(rad)),bh=Math.abs(w*Math.sin(rad))+Math.abs(h*Math.cos(rad));
 return {x:item.x-bw/2,y:item.y-bh/2,width:bw,height:bh,cx:item.x,cy:item.y};
}
function anchorPoints(n){
 if(n===1)return [[.5,.5]];
 if(n===2)return [[.30,.62],[.73,.34]];
 if(n===3)return [[.28,.63],[.73,.66],[.62,.25]];
 if(n===4)return [[.24,.3],[.73,.3],[.24,.78],[.73,.78]];
 const cols=n<=6?3:n<=12?4:5,rows=Math.ceil(n/cols);
 return Array.from({length:n},(_,i)=>[(i%cols+.5)/cols,(Math.floor(i/cols)+.5)/rows]);
}
function dimensions(item,scene,data){
 const v=variant(data,item.assetId,scene.size,item.role),r=item.rotation*Math.PI/180;
 return {width:Math.abs(v.nativeWidth*Math.cos(r))+Math.abs(v.nativeHeight*Math.sin(r)),
  height:Math.abs(v.nativeWidth*Math.sin(r))+Math.abs(v.nativeHeight*Math.cos(r))};
}
// Every obstacle includes the whole source viewBox, strokes and authored shadow.
// A rotated viewBox uses its conservative axis-aligned envelope.
function sceneRank(item){return (item.role==="background"?-1000:0)+(RULES.depth[item.assetId]||0)}
// Color role is not spatial depth. Explicit scene relations and support
// surfaces override the default background-first paint order.
function depthPath(edges,start,end,seen=new Set()){
 if(start===end)return true;if(seen.has(start))return false;seen.add(start);
 return edges.some(([a,b])=>a===start&&depthPath(edges,b,end,seen));
}
function layerPlan(scene,{strict=false}={}){
 const edges=[],ignored=[],items=scene.items;
 for(const rule of scene.sizing==="native"?[]:[...RULES.relations,...RULES.contacts.filter(r=>r.reviewed)])for(const back of items.filter(i=>i.assetId===rule.back))for(const front of items.filter(i=>i.assetId===rule.front)){
  const active=rule.allRoles||((back.role==="main"&&front.role==="main")||rule.baseRoles?.includes(back.role)&&rule.childRoles?.includes(front.role));
  if(active)edges.push([back.uid,front.uid]);
 }
 for(const item of items)if(item.supportUid&&items.some(i=>i.uid===item.supportUid))edges.push([item.supportUid,item.uid]);
 for(const relation of scene.layerRelations||[])if(items.some(i=>i.uid===relation.back)&&items.some(i=>i.uid===relation.front)){
  if(depthPath(edges,relation.front,relation.back)){
   if(strict)throw new Error("Противоречивые отношения глубины сцены");
   ignored.push(relation); // A later manual role change may activate a stronger support rule.
  }else edges.push([relation.back,relation.front]);
 }
 return {edges,ignored,ruleVersion:RULES.version};
}
function orderLayers(scene,options){
 const {edges}=layerPlan(scene,options),remaining=[...scene.items],result=[];
 while(remaining.length){
  const ready=remaining.filter(i=>!edges.some(([a,b])=>b===i.uid&&remaining.some(j=>j.uid===a))).sort((a,b)=>sceneRank(a)-sceneRank(b));
  if(!ready.length)throw new Error("Противоречивые отношения глубины сцены");
  const item=ready[0];result.push(item);remaining.splice(remaining.indexOf(item),1);
 }
 scene.items=result;return scene;
}
function localPoint(item,scene,data,point){
 const v=variant(data,item.assetId,scene.size,item.role),r=item.rotation*Math.PI/180;
 const x=(point[0]-.5)*v.nativeWidth*scene.scale*(item.flipX?-1:1),y=(point[1]-.5)*v.nativeHeight*scene.scale*(item.flipY?-1:1);
 return {x:item.x+x*Math.cos(r)-y*Math.sin(r),y:item.y+x*Math.sin(r)+y*Math.cos(r)};
}
function polygonFor(item,scene,data){
 const shape=GEOMETRY.shapes[item.assetId+'-'+scene.size+'-'+item.role];
 return shape.hull.map(p=>localPoint(item,scene,data,p));
}
function polygonOverlap(a,b,gap=0){
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);if(len<1e-9)continue;
  const nx=-dy/len,ny=dx/len,aa=a.map(p=>p.x*nx+p.y*ny),bb=b.map(p=>p.x*nx+p.y*ny);
  if(Math.max(...aa)+gap<=Math.min(...bb)+1e-6||Math.max(...bb)+gap<=Math.min(...aa)+1e-6)return false;
 }
 return true;
}
function objectsOverlap(scene,data,a,b,gap=0){
 const padding=16*(scene.size==="L"?2:1)*scene.scale;
 if(!overlaps(boundsFor(a,scene,data),boundsFor(b,scene,data),gap+padding))return false;
 return polygonOverlap(polygonFor(a,scene,data),polygonFor(b,scene,data),gap);
}
function contactSlots(scene,data,back,front){
 const rule=RULES.contacts.find(r=>r.reviewed&&r.back===back.assetId&&r.front===front.assetId&&r.baseRoles.includes(back.role)&&r.childRoles.includes(front.role)&&r.sizes.includes(scene.size));
 if(!rule||Math.abs(back.rotation-front.rotation)>.01||Boolean(back.flipX)!==Boolean(front.flipX)||Boolean(back.flipY)!==Boolean(front.flipY))return [];
 return rule.anchors.map((offset,index)=>({...localPoint(back,scene,data,[offset[0]+.5,offset[1]+.5]),rule,index,zone:back.assetId==="book"?(offset[0]<0?"left-page":"right-page"):"surface"}));
}
function contactSlot(scene,data,back,front,index=0){return contactSlots(scene,data,back,front)[index]||null}
function nearSegment(point,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));return {x:a.x+dx*t,y:a.y+dy*t}}
function nearestContact(scene,data,back,front,target){
 const slots=contactSlots(scene,data,back,front);if(!slots.length)return null;
 // Three visually reviewed anchors define a small continuous placement zone.
 const zones=[...new Set(slots.map(s=>s.zone))].map(zone=>slots.filter(s=>s.zone===zone)),candidates=[];
 for(const group of zones){
  const signs=group.map((p,i)=>{const q=group[(i+1)%group.length];return (q.x-p.x)*(target.y-p.y)-(q.y-p.y)*(target.x-p.x)});
  if(group.length>2&&(signs.every(v=>v>=-1e-6)||signs.every(v=>v<=1e-6)))return {...target,rule:slots[0].rule,distance:0};
  candidates.push(...group.flatMap((p,i)=>[p,nearSegment(target,p,group[(i+1)%group.length])]));
 }
 const best=candidates.sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y))[0];
 return {...best,rule:slots[0].rule,distance:Math.hypot(best.x-target.x,best.y-target.y)};
}
function validContact(scene,data,a,b){
 if(scene.sizing==="native")return REFERENCE.PHYSICS.contact(a,b,scene,data,API);
 const rule=RULES.contacts.find(r=>r.reviewed&&((r.back===a.assetId&&r.front===b.assetId)||(r.back===b.assetId&&r.front===a.assetId)));if(!rule)return false;
 const back=a.assetId===rule.back?a:b,front=back===a?b:a,n=nearestContact(scene,data,back,front,front);if(!n)return false;
 const v=variant(data,back.assetId,scene.size,back.role),radius=Math.min(v.nativeWidth,v.nativeHeight)*scene.scale*rule.zoneRadius;
 return n.distance<=radius+1e-5&&scene.items.indexOf(front)>scene.items.indexOf(back);
}
function placementGroups(scene,data){
 const parent=new Map();
 for(const child of scene.items)for(const base of scene.items)if(base.uid!==child.uid&&RULES.contacts.some(r=>r.back===base.assetId&&r.front===child.assetId)&&validContact(scene,data,base,child)){parent.set(child.uid,base);break}
 const root=item=>{let current=item;const seen=new Set();while(parent.has(current.uid)&&!seen.has(current.uid)){seen.add(current.uid);current=parent.get(current.uid)}return current};
 const groups=new Map();for(const item of scene.items){const base=root(item);if(!groups.has(base.uid))groups.set(base.uid,{root:base,items:[]});groups.get(base.uid).items.push(item)}
 return [...groups.values()];
}
function sideAllowed(rule,base,target){
 const epsilon=1e-6;
 return rule.allowed.some(d=>d==="left"?target.x<base.x-epsilon:d==="right"?target.x>base.x+epsilon:d==="above"?target.y<base.y-epsilon:target.y>base.y+epsilon);
}
function placementPlan(scene,data){
 const groups=placementGroups(scene,data),relations=[];
 for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
  const base=groups[i].root,target=groups[j].root,rule=RULES.registry.placement(base.assetId,target.assetId);
  relations.push({base:base.uid,target:target.uid,baseAsset:base.assetId,targetAsset:target.assetId,allowed:rule.allowed,text:rule.text,satisfied:sideAllowed(rule,base,target)});
 }
 return {version:RULES.registry.version,groups:groups.map(g=>({root:g.root.uid,asset:g.root.assetId,members:g.items.map(i=>i.uid)})),relations};
}
function positionIssues(scene,data){return placementPlan(scene,data).relations.filter(r=>!r.satisfied).map(r=>({type:"placement",items:[r.base,r.target],allowed:r.allowed}))}
function packItems(next,data,{allowContacts=true,contactIndex=0}={}){
 const ref=next.size==="L"?2:1,gap=(RULES.clearance+16)*ref,ground=RULES.groundClearance*ref;
 const ordered=[...next.items].sort((a,b)=>(RULES.depth[a.assetId]||0)-(RULES.depth[b.assetId]||0));
 const placed=[];
 for(const item of ordered){
  const d=dimensions(item,next,data),w=d.width,h=d.height;
  const sourceScene={...next,scale:1,items:ordered};
  const attachment=allowContacts&&placed.flatMap(p=>contactSlots(sourceScene,data,p.item,item).map((slot,index,slots)=>({p,slot:slots[(index+contactIndex)%slots.length]}))).find(({p,slot})=>placed.every(other=>other===p||!objectsOverlap(sourceScene,data,{...item,x:slot.x,y:slot.y},other.item,RULES.clearance*ref)));
  if(attachment){item.x=attachment.slot.x;item.y=attachment.slot.y;placed.push({item,root:attachment.p.root||attachment.p.item,x:item.x,y:item.y,w,h});continue}
  let minX=-Infinity,maxX=Infinity,minY=-Infinity;
  for(const r of RULES.relations.filter(r=>r.front===item.assetId&&(r.allRoles||item.role==="main")))for(const back of placed.filter(p=>(r.allRoles||p.item.role==="main")&&p.item.assetId===r.back)){
   // Horizontal reading order is explicit; it is independent of SVG layer order.
   if(r.side==="left")maxX=Math.min(maxX,back.x-back.w/2-w/2-gap);
   else minX=Math.max(minX,back.x+back.w/2+w/2+gap);
   minY=Math.max(minY,back.y+back.h/2-h/2+ground);
  }
  const x=Math.min(maxX,Math.max(item.x,minX)),y=Math.max(item.y,minY);
  const xs=[x,...placed.flatMap(p=>[p.x-(p.w+w)/2-gap,p.x+(p.w+w)/2+gap])];
  const ys=[y,...placed.flatMap(p=>[p.y-(p.h+h)/2-gap,p.y+(p.h+h)/2+gap])];
  let best=null,score=Infinity;
  for(const cx of xs)for(const cy of ys){
   if(cx<minX-1e-7||cx>maxX+1e-7||cy<minY-1e-7)continue;
   if(placed.some(p=>!sideAllowed(RULES.registry.placement((p.root||p.item).assetId,item.assetId),p.root||p.item,{x:cx,y:cy})))continue;
   if(placed.some(p=>objectsOverlap(sourceScene,data,{...item,x:cx,y:cy},p.item,RULES.clearance*ref)))continue;
   const value=(cx-x)**2+(cy-y)**2;
   if(value<score){score=value;best={x:cx,y:cy}}
  }
  if(!best)throw new Error("Не удалось разместить предмет без пересечений");
  item.x=best.x;item.y=best.y;placed.push({item,root:item,x:item.x,y:item.y,w,h});
 }
 orderLayers(next);
}
function visibleBox(box,width,height){return Math.max(0,Math.min(width,box.x+box.width)-Math.max(0,box.x))*Math.max(0,Math.min(height,box.y+box.height)-Math.max(0,box.y))/(box.width*box.height||1)}
function protectedBox(item,scene,data){
 const r=RULES.registry.protectedRegions[item.assetId].rect,points=[[r[0],r[1]],[r[0]+r[2],r[1]],[r[0]+r[2],r[1]+r[3]],[r[0],r[1]+r[3]]].map(p=>localPoint(item,scene,data,p));
 const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return {x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
}
function compactContext(next,data){
 const focus=focusFor(next);if(next.framing!=="focus"||!focus)return;
 const source={...next,scale:1},f=dimensions(focus,source,data),gap=RULES.clearance*(next.size==="L"?2:1);
 for(const bg of next.items.filter(i=>i.role==="background")){
  if(RULES.relations.some(r=>r.lockPlacement&&[r.back,r.front].includes(bg.assetId)&&next.items.some(i=>i.assetId===(bg.assetId===r.back?r.front:r.back))))continue;
  if(next.items.some(i=>i.uid!==bg.uid&&validContact(source,data,bg,i)))continue;
  const d=dimensions(bg,source,data);let placed=false;
  const upright=d.height>d.width;
  const slots=upright?[[-1,0],[1,0],[-1,-1],[1,-1]]:[[-1,-1],[1,-1],[-1,1],[1,1]];
  for(const k of [.76,.9,1.04,1.2]){for(const [sx,sy]of slots){
   const candidate={...bg,x:focus.x+sx*(f.width+d.width)*.5*k,y:sy===0?focus.y-(d.height-f.height)*.5:focus.y+sy*(f.height+d.height)*.43*k};
   if(next.items.every(o=>o.uid===bg.uid||!objectsOverlap(source,data,candidate,o,gap))&&!positionIssues({...source,items:source.items.map(i=>i.uid===bg.uid?candidate:i)},data).length){bg.x=candidate.x;bg.y=candidate.y;placed=true;break}
  }if(placed)break}
 }
}
function fitScene(next,data){
 const source={...next,scale:1},boxes=next.items.map(item=>boundsFor(item,source,data));
 const minX=Math.min(...boxes.map(b=>b.x)),minY=Math.min(...boxes.map(b=>b.y)),maxX=Math.max(...boxes.map(b=>b.x+b.width)),maxY=Math.max(...boxes.map(b=>b.y+b.height));
 const area=next.layout==="headline"?{x:next.width*.49,y:next.height*.08,w:next.width*.47,h:next.height*.84}
  :{x:next.width*.06,y:next.height*.06,w:next.width*.88,h:next.height*.88};
 const overview=Math.min(area.w/(maxX-minX),area.h/(maxY-minY)),focus=focusFor(next);
 let scale=overview,origin={x:(minX+maxX)/2,y:(minY+maxY)/2},target={x:area.x+area.w/2,y:area.y+area.h/2};
 if(next.framing==="focus"&&focus){
  const optical=RULES.registry.protectedRegions[focus.assetId].optical,feature=localPoint(focus,source,data,optical),f=dimensions(focus,source,data);
  const desired=Math.min(area.w*.74/f.width,area.h*.80/f.height);
  const locations=next.layout==="headline"?[[.72,.50],[.75,.382],[.70,.618]]:next.layout==="offset"?[[.618,.50],[.667,.50],[.618,.382]]:[[.50,.48],[.382,.50],[.618,.50],[.50,.382],[.50,.618]];
  const candidates=[];
  for(const gain of [1.18,1.06,1,.94,.86,.76,.64,.52,.4])for(const [tx,ty]of locations){
   const s=desired*gain,t={x:next.width*tx,y:next.height*ty};
   const mapped=item=>{const b=boundsFor(item,source,data);return{x:t.x+(b.x-feature.x)*s,y:t.y+(b.y-feature.y)*s,width:b.width*s,height:b.height*s}};
   const p=protectedBox(focus,source,data),critical={x:t.x+(p.x-feature.x)*s,y:t.y+(p.y-feature.y)*s,width:p.width*s,height:p.height*s};
   if(visibleBox(critical,next.width,next.height)<.995||visibleBox(mapped(focus),next.width,next.height)<.90)continue;
   if(next.layout==="headline"&&critical.x<next.width*.49)continue;
   if(next.items.some(i=>i.role==="main"&&i.uid!==focus.uid&&visibleBox(mapped(i),next.width,next.height)<.4))continue;
   if(next.items.length<=5&&next.items.some(i=>{
    if(i.role!=="background")return false;
    const b=mapped(i),visible=visibleBox(b,next.width,next.height);
    return visible<(i.assetId==="flowers"?.38:i.assetId==="lamp"?.5:.22);
   }))continue;
   if(next.items.length<=5&&next.items.some(i=>{
    if(i.role!=="background")return false;
    const p=protectedBox(i,source,data),b={x:t.x+(p.x-feature.x)*s,y:t.y+(p.y-feature.y)*s,width:p.width*s,height:p.height*s};
    const supporting=next.items.some(child=>child.uid!==i.uid&&validContact(source,data,i,child));
    const minimum=i.assetId==="pen"?.995:supporting?.4:i.assetId==="coin"?.75:.55;
    return visibleBox(b,next.width,next.height)<minimum;
   }))continue;
   const focusArea=mapped(focus).width*mapped(focus).height/(next.width*next.height),shape=GEOMETRY.shapes[focus.assetId+'-'+next.size+'-'+focus.role];
   let score=100-Math.abs(focusArea*shape.paintRatio-.32)*115-Math.hypot(tx-.5,ty-.48)*12;
   for(const item of next.items.filter(i=>i.uid!==focus.uid)){
    const box=mapped(item),visible=visibleBox(box,next.width,next.height),paint=GEOMETRY.shapes[item.assetId+'-'+next.size+'-'+item.role].paintRatio*box.width*box.height*visible/(next.width*next.height);
    if(item.role==="background")score+=Math.min(visible,.4)*9-paint*18;
    else score-=Math.max(0,paint-focusArea*shape.paintRatio*.85)*100;
   }
   if(next.layout==="headline")for(const item of next.items.filter(i=>i.role==="main")){const b=mapped(item);score-=Math.max(0,Math.min(b.x+b.width,next.width*.43)-Math.max(0,b.x))*Math.max(0,Math.min(b.y+b.height,next.height*.86)-Math.max(next.height*.14,b.y))/(next.width*next.height)*150}
   candidates.push({s,t,score});
  }
  const best=candidates.sort((a,b)=>b.score-a.score)[0];
  if(best){scale=best.s;origin=feature;target=best.t}
 }
 next.scale=scale;
 next.items.forEach(item=>{item.x=target.x+(item.x-origin.x)*scale;item.y=target.y+(item.y-origin.y)*scale});
 return next;
}
function overlaps(a,b,gap=0){return Math.abs(a.cx-b.cx)<(a.width+b.width)/2+gap-1e-6&&Math.abs(a.cy-b.cy)<(a.height+b.height)/2+gap-1e-6}
function layoutIssues(scene,data){
 if(scene.sizing==="native")return REFERENCE.issues(scene,data,API);
 const issues=positionIssues(scene,data),boxes=scene.items.map(i=>boundsFor(i,scene,data)),ref=scene.size==="L"?2:1;
 const gap=RULES.clearance*ref*scene.scale;
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(objectsOverlap(scene,data,scene.items[i],scene.items[j],gap)&&!validContact(scene,data,scene.items[i],scene.items[j]))issues.push({type:"collision",items:[scene.items[i].uid,scene.items[j].uid]});
 for(const r of RULES.relations){
  const backs=scene.items.filter(i=>(r.allRoles||i.role==="main")&&i.assetId===r.back),fronts=scene.items.filter(i=>(r.allRoles||i.role==="main")&&i.assetId===r.front);
  if(backs.length!==1||fronts.length!==1||scene.items.filter(i=>i.role==="main").length>5)continue;
  for(const back of backs)for(const front of fronts){
   if(validContact(scene,data,back,front)||scene.items.some(base=>base.uid!==front.uid&&validContact(scene,data,base,front)))continue;
   const a=boundsFor(back,scene,data),b=boundsFor(front,scene,data);
   if((r.side==="left"?b.x+b.width>a.x-gap+1e-5:b.x<a.x+a.width+gap-1e-5)||b.y+b.height<a.y+a.height+RULES.groundClearance*ref*scene.scale-1e-5||scene.items.indexOf(front)<scene.items.indexOf(back))issues.push({type:"ground",items:[back.uid,front.uid]});
  }
 }
 return issues;
}
function ensureLayout(scene,data){
 if(scene.sizing==="native")return REFERENCE.arrange(scene,data,API);
 if(!scene.items.length||!layoutIssues(scene,data).length)return scene;
 const next=clone(scene);
 next.items.forEach(i=>{i.x/=next.scale;i.y/=next.scale});
 packItems(next,data);return fitScene(next,data);
}
// Optional collision solver for callers that request constrained placement.
// The manual editor uses resolve:false and accepts free movement and rotation.
function collisionFree(scene,data,item){
 if(scene.sizing==="native")return !REFERENCE.PHYSICS.issues({...scene,items:scene.items.map(i=>i.uid===item.uid?item:i)},data,API).some(r=>r.items.includes(item.uid));
 const probe={...scene,items:scene.items.map(i=>i.uid===item.uid?item:i)},gap=RULES.clearance*(scene.size==="L"?2:1)*scene.scale;
 return probe.items.every(other=>other.uid===item.uid||!objectsOverlap(probe,data,item,other,gap)||validContact(probe,data,item,other));
}
function attachedGroup(scene,data,uid){
 if(scene.sizing==="native")return REFERENCE.PHYSICS.attached(scene,uid);
 const ids=new Set([uid]);let changed=true;
 while(changed){changed=false;for(const base of scene.items.filter(i=>ids.has(i.uid)))for(const child of scene.items)if(!ids.has(child.uid)&&RULES.contacts.some(r=>r.back===base.assetId&&r.front===child.assetId)&&validContact(scene,data,base,child)){ids.add(child.uid);changed=true}}
 return ids;
}
function moveScene(scene,data,uid,target,{resolve=true}={}){
 if(scene.sizing==="native"&&resolve)return REFERENCE.PHYSICS.move(scene,data,API,uid,target);
 const original=scene.items.find(i=>i.uid===uid);if(!original)return clone(scene);
 const ids=attachedGroup(scene,data,uid),gap=RULES.clearance*(scene.size==="L"?2:1)*scene.scale;
 const proposal=(x,y)=>{const next=clone(scene);next.items.forEach(i=>{if(i.uid===uid){i.x=x;i.y=y}else if(ids.has(i.uid)){i.x+=x-original.x;i.y+=y-original.y}});return next};
 if(!resolve)return proposal(target.x,target.y);
 const legal=next=>next.items.filter(i=>ids.has(i.uid)).every(i=>next.items.every(o=>ids.has(o.uid)||!objectsOverlap(next,data,i,o,gap)||validContact(next,data,i,o)));
 let result=proposal(target.x,target.y);if(legal(result))return result;
 if(ids.size===1)for(const base of scene.items.filter(i=>!ids.has(i.uid))){
  const slot=nearestContact(scene,data,base,original,target);if(!slot||slot.distance>Math.max(20,gap*2.5))continue;
  result=proposal(slot.x,slot.y);if(legal(result))return result;
 }
 // Resolve only the dragged group on release; do not rearrange the scene.
 const xs=[target.x],ys=[target.y],padding=gap+16*(scene.size==="L"?2:1)*scene.scale;
 for(const moving of scene.items.filter(i=>ids.has(i.uid)))for(const fixed of scene.items.filter(i=>!ids.has(i.uid))){
  const a=boundsFor(moving,scene,data),b=boundsFor(fixed,scene,data),dx=moving.x-original.x,dy=moving.y-original.y;
  xs.push(fixed.x-(a.width+b.width)/2-padding-dx,fixed.x+(a.width+b.width)/2+padding-dx);
  ys.push(fixed.y-(a.height+b.height)/2-padding-dy,fixed.y+(a.height+b.height)/2+padding-dy);
 }
 const candidates=xs.flatMap(x=>ys.map(y=>({x,y,score:(x-target.x)**2+(y-target.y)**2}))).sort((a,b)=>a.score-b.score);
 for(const p of candidates){result=proposal(p.x,p.y);if(legal(result))return result}
 return clone(scene);
}
function safeMove(scene,data,item,target){const result=moveScene(scene,data,item.uid,target),moved=result.items.find(i=>i.uid===item.uid);return {x:moved.x,y:moved.y}}
function automaticResult(scene,data){
 const result=fitScene(scene,data);
 if(layoutIssues(result,data).length)throw new Error("Не удалось собрать сцену с соблюдением правил размещения. Попробуйте другой набор предметов.");
 return result;
}
function arrange(scene,data,{variation=0,allowContacts=true,contactIndex=0,placement}={}){
 if(scene.sizing==="native")return REFERENCE.arrange(scene,data,API,{variation,placement});
 const next=clone(scene);
 next.camera=null;next.composition=null;
 if(!next.items.length){next.scale=1;return next}
 if(next.items.length>12){
  const dims=next.items.map(i=>dimensions(i,next,data)),gap=80*(next.size==="L"?2:1),w=Math.max(...dims.map(d=>d.width))+gap,h=Math.max(...dims.map(d=>d.height))+gap,cols=Math.ceil(Math.sqrt(next.items.length*next.width/next.height*h/w));
  next.items.sort((a,b)=>sceneRank(a)-sceneRank(b));next.items.forEach((i,n)=>{i.x=(n%cols+.5)*w;i.y=(Math.floor(n/cols)+.5)*h});packItems(next,data,{allowContacts});return automaticResult(next,data);
 }
 const context=recipeFor(next),main=next.items.filter(a=>a.role==="main"),background=next.items.filter(a=>a.role==="background");
 const primary=main.length?main:next.items;
 const useScene=primary.length<=5&&new Set(primary.map(i=>i.assetId)).size===primary.length;
 const isTall=next.height>next.width,ref=next.size==="L"?2:1,anchors=anchorPoints(primary.length);
 const offsets=[
  {},{book:[-60,35],lamp:[65,-20],phone:[55,45],headphones:[-35,-40],wallet:[40,-20],coin:[45,35],puzzle:[40,-25],folder:[-35,20],pen:[35,0],flowers:[0,-30]},
  {book:[25,-20],lamp:[-50,45],phone:[-45,25],headphones:[35,20],wallet:[-30,35],coin:[-25,-20],puzzle:[-40,40],folder:[35,-20],pen:[-30,35],flowers:[30,10]}
 ][Math.abs(variation)%3];
 primary.forEach((item,index)=>{
  const base=useScene
   ?(isTall?(context.tall[item.assetId]||RULES.tallDefaults[item.assetId]):(context.positions[item.assetId]||RULES.defaults[item.assetId]))
   :[anchors[(index+variation)%anchors.length][0]*1300,anchors[(index+variation)%anchors.length][1]*800];
  const shift=useScene?(offsets[item.assetId]||[0,0]):[0,0];
  item.x=(base[0]+shift[0])*ref;item.y=(base[1]+shift[1])*ref;
 });
 if(main.length)background.forEach((item,index)=>{
  let p=context.background[item.assetId]||RULES.defaults[item.assetId];
  if(isTall)p=context.tall[item.assetId]||RULES.tallDefaults[item.assetId];
  item.x=(p[0]+index*55)*ref;item.y=(p[1]-index*35)*ref;
 });
 packItems(next,data,{allowContacts,contactIndex});
 compactContext(next,data);
 return automaticResult(next,data);
}

function sceneDescription(scene,data){
 if(scene.sizing==="native"){
  const reasons=(scene.groups||[]).map(g=>g.reason),warnings=data?REFERENCE.warnings(scene,data,API):[];
  return {name:recipeFor(scene).name,text:[...reasons,"Исходные размеры "+scene.size+", масштаб 1:1. Края предметов могут выходить за границы кадра.",...warnings].join(" ")};
 }
 const context=recipeFor(scene);
 const focus=focusFor(scene),contacts=data?RULES.contacts.filter(r=>scene.items.some(a=>a.assetId===r.back&&scene.items.some(b=>b.assetId===r.front&&validContact(scene,data,a,b)))):[];
 const actual=RULES.relations.filter(r=>{
  const back=scene.items.findIndex(i=>i.assetId===r.back),front=scene.items.findIndex(i=>i.assetId===r.front);
  return back>=0&&front>back;
 }).slice(0,2).map(r=>r.text);
 const spatial=data?placementPlan(scene,data).relations.slice(0,2).map(r=>assetById(data,r.targetAsset).name+" — "+r.text+"; ориентир: "+assetById(data,r.baseAsset).name+"."):[];
 const accent=focus?"Акцент — "+(data?assetById(data,focus.assetId).name.toLocaleLowerCase("ru"):focus.assetId)+". ":"";
 return {name:context.name,text:accent+([...contacts.map(r=>r.text),...spatial].join(" ")||(actual.length?actual.join(" "):context.description))};
}
function templateKey(scene,{legacy=false}={}){
 const signature=scene.items.map(i=>i.assetId+":"+i.role).sort().join(",");
 const key=[recipeFor(scene).id,scene.layout,scene.format,scene.size,signature];
 if(!legacy)key.push(scene.framing||"overview",focusFor(scene)?.assetId||"none");
 if(scene.sizing==="native")key.push("native-v2",scene.width,scene.height);
 return key.join("|");
}
function occurrenceKeys(items){
 const counts={};return items.map(item=>{const base=item.assetId+":"+item.role,n=counts[base]||0;counts[base]=n+1;return base+":"+n});
}
function captureTemplate(scene,data){
 const s=validateScene(scene,data),keys=occurrenceKeys(s.items);
 return {version:1,sizing:s.sizing,manual:true,rulesVersion:RULES.version,key:templateKey(s),width:s.width,height:s.height,scale:s.scale,slots:s.items.map((item,index)=>({
  key:keys[index],nativeX:item.x,nativeY:item.y,x:item.x/s.width,y:item.y/s.height,rotation:item.rotation,flipX:item.flipX,flipY:item.flipY,order:index
 }))};
}
function applyTemplate(scene,template,data){
 const keyMatches=template&&(template.key===templateKey(scene)||((scene.framing||"overview")==="overview"&&template.key===templateKey(scene,{legacy:true})));
 if(!template||template.version!==1||!keyMatches||!Array.isArray(template.slots)||template.slots.length!==scene.items.length)throw new Error("Раскладка не подходит к этим предметам и формату");
 if(!Number.isFinite(template.scale)||template.scale<.001||template.scale>20)throw new Error("Некорректный масштаб раскладки");
 const s=clone(scene),keys=occurrenceKeys(s.items),slots=new Map();
 for(const slot of template.slots){
  if(!slot||typeof slot.key!=="string"||slots.has(slot.key)||!["x","y","rotation","order"].every(k=>Number.isFinite(slot[k]))||!Number.isInteger(slot.order)||slot.order<0||slot.order>=s.items.length)throw new Error("Некорректная позиция в раскладке");
  if(typeof slot.flipX!=="boolean"||typeof slot.flipY!=="boolean")throw new Error("Некорректное отражение в раскладке");
  slots.set(slot.key,slot);
 }
 if(new Set(template.slots.map(t=>t.order)).size!==s.items.length)throw new Error("Повторяющийся слой в раскладке");
 s.scale=template.scale;
 const order=new Map();
 s.items.forEach((item,index)=>{
  const slot=slots.get(keys[index]);if(!slot)throw new Error("В раскладке отсутствует предмет");
  item.x=template.width===s.width&&Number.isFinite(slot.nativeX)?slot.nativeX:slot.x*s.width;item.y=template.height===s.height&&Number.isFinite(slot.nativeY)?slot.nativeY:slot.y*s.height;item.rotation=slot.rotation;item.flipX=slot.flipX;item.flipY=slot.flipY;order.set(item.uid,slot.order);
 });
 s.items.sort((a,b)=>order.get(a.uid)-order.get(b.uid));
 return template.manual===true&&template.rulesVersion===RULES.version?validateScene(s,data):ensureLayout(validateScene(s,data),data);
}
function generate(query,scene,data,options={}){
 const result=pick(query,data,{supporting:scene.supporting,recipe:scene.recipe||"auto",nativeWriting:scene.sizing==="native"});
 if(!result.items.length)return {scene:null,result};
 const next=createScene({...scene,query,environmentExplanation:[],groups:[],layerRelations:[],items:result.items.map(a=>({...a,uid:uid(),x:0,y:0,rotation:0}))});
 if(next.sizing==="native"&&/(?:без|никаких)\s+фон|не\s+добавля(?:ть|й|йте)\s+фон/.test(normalize(next.environmentPrompt)))next.items=next.items.filter(i=>i.role==="main");
 if(next.sizing!=="native"&&next.framing==="focus"&&next.supporting){
  if(next.items.filter(i=>i.role==="main").length>1)next.items=next.items.filter(i=>i.role==="main");
  const lead=focusFor(next);for(const item of next.items)if(lead&&item.uid!==lead.uid)item.role="background";
  result.items=next.items.map(i=>({assetId:i.assetId,role:i.role}));
 }
 if(next.sizing==="native"){
  const book=next.items.find(i=>i.assetId==="book"),pen=next.items.find(i=>i.assetId==="pen"),lamp=next.items.find(i=>i.assetId==="lamp");
  if(book&&pen)next.groups.push({kind:"writing",members:[book.uid,pen.uid],reason:"Книга и ручка образуют место для письма."});
  if(book&&lamp&&next.items.filter(i=>i.role==="main").length===2&&lamp.role==="main")next.groups.push({kind:"reading",members:[book.uid,lamp.uid],reason:"Лампа освещает книгу слева."});
 }
 return {scene:arrange(next,data,options),result};
}
function recolor(svg,palette,role){
 const allowed=role==="main"?["background.base","background.mid","background.dark","object.primary","object.secondary","object.tertiary","ink","paper"]:role==="backdrop"?["background.base","background.mid","background.dark","ink","paper"]:["background.base","background.mid","background.dark","ink"];
 return svg.replace(/<[^>]+>/g,node=>{
  for(const attr of ["fill","stroke"]){
   const slot=node.match(new RegExp('data-'+attr+'-slot="([^"]+)"'))?.[1];
   if(!slot)continue;
   if(!allowed.includes(slot))throw new Error("Запрещённая цветовая роль "+slot);
   const color=palette.slots[slot];
   if(!/^#[a-f0-9]{6}$/i.test(color||""))throw new Error("Не задан цвет "+slot);
   node=node.replace(new RegExp(' '+attr+'="[^"]*"'),' '+attr+'="'+color+'"');
  }
  return node;
 });
}
function uniqueSvg(svg,prefix){
 if(!/^[a-z][\w-]*$/i.test(prefix))throw new Error("Некорректный идентификатор");
 const ids=new Map([...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>[m[1],prefix+"-"+m[1]]));
 return svg.replace(/<[^>]+>/g,node=>node.replace(/ (id|aria-labelledby|aria-describedby|href|xlink:href)="([^"]*)"/g,(_,attr,value)=>{
  if(attr==="id")return ' '+attr+'="'+ids.get(value)+'"';
  if(attr==="aria-labelledby"||attr==="aria-describedby")return ' '+attr+'="'+value.split(/\s+/).map(id=>ids.get(id)||id).join(" ")+'"';
  if(value.startsWith("#"))return ' '+attr+'="#'+(ids.get(value.slice(1))||value.slice(1))+'"';
  return ' '+attr+'="'+value+'"';
 }).replace(/url\(#([^)]*)\)/g,(_,id)=>"url(#"+(ids.get(id)||id)+")"));
}
function paletteFor(scene,data){const p=data.palettes.palettes.find(p=>p.id===scene.palette);if(!p)throw new Error("Неизвестная палитра");return p}
function objectMarkup(item,scene,data){
 const v=variant(data,item.assetId,scene.size,item.role),p=paletteFor(scene,data);
 const source=data.svgs[v.path];if(!source)throw new Error("Не загружен SVG "+v.path);
 const svg=uniqueSvg(recolor(source,p,item.role),item.uid);
 const sx=scene.scale*(item.flipX?-1:1),sy=scene.scale*(item.flipY?-1:1);
 const scaleTransform=item.flipX||item.flipY?fmt(sx)+' '+fmt(sy):fmt(scene.scale);
 return '<g id="object-'+item.uid+'" data-instance="'+item.uid+'" data-asset="'+item.assetId+'" data-role="'+item.role+'" data-flip-x="'+Boolean(item.flipX)+'" data-flip-y="'+Boolean(item.flipY)+'" transform="translate('+fmt(item.x)+' '+fmt(item.y)+') rotate('+fmt(item.rotation)+') scale('+scaleTransform+') translate('+fmt(-v.nativeWidth/2)+' '+fmt(-v.nativeHeight/2)+')">'+svg+'</g>';
}
function backdropDesignFor(scene){return scene.backgroundDesign&&scene.backgroundDesign!=="auto"?scene.backgroundDesign:(scene.palette==="peach"?"table":"details")}
function backgroundMarkup(scene,data){
 if(scene.background==="transparent")return "";
 const p=paletteFor(scene,data),fill='<rect width="'+scene.width+'" height="'+scene.height+'" fill="'+p.slots["background.base"]+'"/>';
 if(scene.background==="solid")return fill;
 const design=backdropDesignFor(scene),b=data.manifest.backdrops.find(b=>b.size===scene.size&&b.palette===(design==="table"?"peach":"lavender"));
 if(!b||!data.svgs[b.path])throw new Error("Нет исходного фона");
 const paths=[...recolor(data.svgs[b.path],p,"backdrop").matchAll(/<path\b[^>]*\/>/g)].map(m=>m[0]),[ox,oy]=b.sourceBounds,dx=scene.width-b.nativeWidth,dy=scene.height-b.nativeHeight;
 if(paths.length!==(design==="table"?3:9))throw new Error("Некорректный исходный фон");
 const motif=(indices,x,y,anchor)=>'<g data-backdrop-anchor="'+anchor+'" transform="translate('+fmt(x)+' '+fmt(y)+')"><g transform="translate('+fmt(-ox)+' '+fmt(-oy)+')">'+indices.map(i=>paths[i]).join("")+'</g></g>';
 const artwork=design==="table"?motif([0,2],dx,dy,"bottom-right")+motif([1],dx,0,"top-right"):motif([0,1,2],0,dy,"bottom-left")+motif([3,4,5,7],0,0,"top-left")+motif([6,8],dx,dy,"bottom-right");
 return fill+'<svg id="scene-background" width="'+scene.width+'" height="'+scene.height+'" viewBox="0 0 '+scene.width+' '+scene.height+'" overflow="hidden" role="img" aria-label="'+(design==="table"?'Край стола':'Точки и линии')+'" data-backdrop-source="'+b.id+'" data-backdrop-palette="'+p.id+'">'+artwork+'</svg>';
}
function visibleItems(scene){return scene.items.filter(i=>i.hidden!==true&&(scene.showSupporting!==false||i.role!=="background"))}
function toggleLayerVisibility(scene,uid,data){
 const next=validateScene(scene,data),index=next.items.findIndex(i=>i.uid===uid);
 if(index<0)throw new Error("Предмет не найден");
 const item=next.items[index],before=visibleItems(next),onlyMain=item.role==="main"&&before.some(i=>i.uid===uid)&&before.filter(i=>i.role==="main").length===1;
 if(item.role==="background"&&next.showSupporting===false){next.showSupporting=true;delete item.hidden}else if(item.hidden)delete item.hidden;else item.hidden=true;
 let promoted=null;
 if(onlyMain&&item.hidden){
  const visible=new Set(visibleItems(next).map(i=>i.uid));
  const following=[...next.items.slice(0,index)].reverse(),preceding=next.items.slice(index+1);
  const candidate=[...following,...preceding].find(i=>visible.has(i.uid));
  if(candidate){candidate.role="main";next.focus=candidate.assetId;promoted=candidate.uid}else next.focus="auto";
 }
 return {scene:validateScene(next,data),promoted};
}
function sceneMarkup(scene,data){
 let objects=visibleItems(scene).map(i=>objectMarkup(i,scene,data)).join("");
 if(scene.camera){const c=scene.camera;objects='<g id="composition-view" transform="matrix('+fmt(c.scale)+' 0 0 '+fmt(c.scale)+' '+fmt(c.x)+' '+fmt(c.y)+')">'+objects+'</g>'}
 const inset=scene.layout==="headline"?scene.width*(scene.sizing==="native"?.43:.47):0;
 const frame=(scene.sizing==="native"?scene.layout==="headline":scene.framing==="focus")?'<defs><clipPath id="composition-crop"><rect x="'+inset+'" width="'+(scene.width-inset)+'" height="'+scene.height+'"/></clipPath></defs><g clip-path="url(#composition-crop)">'+objects+'</g>':objects;
 return backgroundMarkup(scene,data)+frame;
}
function exportSvg(scene,data){
 const clean=validateScene(scene,data);
 if(clean.sizing==="native"&&REFERENCE.PHYSICS.issues(clean,data,API).length)throw new Error("Исправьте недопустимое наложение главных предметов перед экспортом.");
 return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="'+clean.width+'" height="'+clean.height+'" viewBox="0 0 '+clean.width+' '+clean.height+'" fill="none"><title>'+escapeXml(clean.query||"Композиция")+'</title><desc>Композиция из исходных векторных объектов. Размер '+clean.size+'.</desc>'+sceneMarkup(clean,data)+'</svg>';
}
function validateScene(input,data){
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Некорректный проект");
 if(input.sizing!==undefined&&!["native","legacy"].includes(input.sizing))throw new Error("Неизвестный режим размеров");
 const native=input.sizing==="native";
 const preset=FORMATS.find(f=>f.id===input.format);
 const legacy=!native&&((input.format==="square"&&input.width===1080&&input.height===1080)||(input.format==="portrait"&&input.width===1080&&input.height===1350));
 const custom=input.format==="custom"&&[input.width,input.height].every(n=>Number.isInteger(n)&&n>=256&&n<=4096);
 if(!custom&&!legacy&&(!preset||input.width!==preset.width||input.height!==preset.height))throw new Error("Неизвестный формат холста");
 const f=custom||legacy?{id:input.format,width:input.width,height:input.height}:preset;
 if(!["S","L"].includes(input.size))throw new Error("Неизвестная детализация");
 if(!LAYOUTS.some(l=>l.id===input.layout))throw new Error("Неизвестная раскладка");
 if(!["pattern","solid","transparent"].includes(input.background))throw new Error("Неизвестный фон");
 paletteFor(input,data);
 if(input.backgroundDesign!==undefined&&!["auto","details","table"].includes(input.backgroundDesign))throw new Error("Неизвестный рисунок фона");
 if(input.framing!==undefined&&!["overview","focus"].includes(input.framing))throw new Error("Неизвестное кадрирование");
 if(input.focus!==undefined&&input.focus!=="auto"&&!assetById(data,input.focus))throw new Error("Неизвестный акцент");
 if(input.recipe!==undefined&&input.recipe!=="auto"&&!RULES.recipes.some(r=>r.id===input.recipe))throw new Error("Неизвестный смысл сцены");
 if(native&&input.scale!==1)throw new Error("Масштаб исходных SVG зафиксирован: 1:1");
 if(!Number.isFinite(input.scale)||input.scale<.001||input.scale>20)throw new Error("Некорректный масштаб");
 if(!Array.isArray(input.items)||input.items.length>32)throw new Error("Можно использовать до 32 предметов");
 const ids=new Set();
 const items=input.items.map(item=>{
  if(!item||!assetById(data,item.assetId)||!["main","background"].includes(item.role))throw new Error("Неизвестный предмет или роль");
  if(typeof item.uid!=="string"||!/^i[a-z0-9-]{1,60}$/i.test(item.uid)||ids.has(item.uid))throw new Error("Некорректный идентификатор");
  ids.add(item.uid);
  if(!["x","y","rotation"].every(k=>Number.isFinite(item[k])&&Math.abs(item[k])<100000))throw new Error("Некорректные координаты");
  variant(data,item.assetId,input.size,item.role);
  if(["flipX","flipY"].some(k=>item[k]!==undefined&&typeof item[k]!=="boolean"))throw new Error("Некорректное отражение предмета");
  if(item.hidden!==undefined&&typeof item.hidden!=="boolean")throw new Error("Некорректная видимость предмета");
  return {uid:item.uid,assetId:item.assetId,role:item.role,x:item.x,y:item.y,rotation:item.rotation,flipX:item.flipX===true,flipY:item.flipY===true,...(item.hidden===true?{hidden:true}:{}),...(item.supportUid?{supportUid:item.supportUid}:{}),...(item.zone?{zone:item.zone}:{}),...(item.crop?{crop:item.crop}:{})};
 });
 for(const item of items){
  if(item.supportUid&&!ids.has(item.supportUid))delete item.supportUid;
  if(item.supportUid===item.uid)throw new Error("Предмет не может опираться на себя");
  if(item.zone&&!REFERENCE.ZONES.includes(item.zone))throw new Error("Неизвестная зона окружения");
  if(item.crop&&!["fragment","whole"].includes(item.crop))throw new Error("Некорректное кадрирование предмета");
 }
 const groups=(input.groups||[]);
 if(!Array.isArray(groups)||groups.length>8)throw new Error("Некорректные смысловые группы");
 const cleanGroups=groups.map(g=>{
  if(!g||!REFERENCE.KINDS.includes(g.kind)||!Array.isArray(g.members)||g.members.length>32||g.members.some(id=>typeof id!=="string")||typeof g.reason!=="string"||g.reason.length>240)throw new Error("Некорректная смысловая группа");
  return {kind:g.kind,members:[...new Set(g.members.filter(id=>ids.has(id)))],reason:g.reason};
 }).filter(g=>g.members.length>=2);
 const plans=input.formatPlans||[];
 if(!Array.isArray(plans)||plans.length>3||new Set(plans.map(p=>p?.format)).size!==plans.length)throw new Error("Некорректные планы форматов");
 const formatPlans=plans.map(p=>{
  if(!p||!["square","landscape","portrait"].includes(p.format)||!REFERENCE.FLOWS.includes(p.flow)||!REFERENCE.ANCHORS.includes(p.anchor)||!REFERENCE.SIDES.includes(p.background)||typeof p.principle!=="string"||!p.principle.trim()||p.principle.length>320)throw new Error("Некорректная компоновка формата");
  return {format:p.format,flow:p.flow,anchor:p.anchor,background:p.background,principle:p.principle};
 });
 let sizeGeometryOrigin;
 if(input.sizeGeometryOrigin!==undefined){
  const o=input.sizeGeometryOrigin;
  if(!o||!["S","L"].includes(o.size)||typeof o.target!=="string"||o.target.length>24000||!Array.isArray(o.poses)||o.poses.length>32||new Set(o.poses.map(p=>p?.uid)).size!==o.poses.length||o.poses.some(p=>!p||typeof p.uid!=="string"||!/^i[a-z0-9-]{1,60}$/i.test(p.uid)||![p.x,p.y].every(n=>Number.isFinite(n)&&Math.abs(n)<100000)||p.supportUid!==undefined&&typeof p.supportUid!=="string"))throw new Error("Некорректная память геометрии размера");
  if(o.poses.length===items.length&&o.poses.every(p=>ids.has(p.uid)&&(!p.supportUid||ids.has(p.supportUid))))sizeGeometryOrigin={size:o.size,target:o.target,poses:o.poses.map(({uid,x,y,supportUid})=>({uid,x,y,...(supportUid?{supportUid}:{})}))};
 }
 const layerRelations=(input.layerRelations||[]);
 if(!Array.isArray(layerRelations)||layerRelations.length>64)throw new Error("Некорректные смысловые слои");
 const relations=layerRelations.map(r=>{
  if(!r||typeof r.back!=="string"||typeof r.front!=="string"||r.back===r.front||typeof r.reason!=="string"||!r.reason.trim()||r.reason.length>240)throw new Error("Некорректная связь слоёв");
  return {back:r.back,front:r.front,reason:r.reason};
 }).filter(r=>ids.has(r.back)&&ids.has(r.front));
 // Deleting an object removes its links. Manual layer ordering remains editable.
 const relationEdges=[];for(const r of relations){if(depthPath(relationEdges,r.front,r.back))throw new Error("Противоречивые смысловые слои");relationEdges.push([r.back,r.front])}
 const focus=items.some(i=>i.assetId===input.focus)?input.focus:"auto";
 let camera=null,composition=null;
 if(input.camera!==undefined&&input.camera!==null){
  if(!["scale","x","y"].every(k=>Number.isFinite(input.camera[k]))||input.camera.scale<.05||input.camera.scale>5||Math.abs(input.camera.x)>100000||Math.abs(input.camera.y)>100000)throw new Error("Некорректный кадр");
  if(native&&input.camera.scale!==1)throw new Error("Кадр не должен изменять исходный масштаб");
  camera={scale:input.camera.scale,x:input.camera.x,y:input.camera.y};
 }
 if(input.composition!==undefined&&input.composition!==null){
  const c=input.composition,strategies=["balanced","spacious","diagonal"];
  if(!Number.isInteger(c.index)||c.index<0||c.index>2||!Array.isArray(c.options)||c.options.length!==3)throw new Error("Некорректные варианты композиции");
  const options=c.options.map((v,index)=>{if(!v||v.strategy!==strategies[index]||typeof v.title!=="string"||v.title.length>100||typeof v.principle!=="string"||v.principle.length>320)throw new Error("Некорректный принцип композиции");if(v.placement!==undefined&&!REFERENCE.PLACEMENTS.includes(v.placement))throw new Error("Неизвестное расположение группы");return {strategy:v.strategy,title:v.title,principle:v.principle,...(v.placement?{placement:v.placement}:{})}});
  composition={index:c.index,options};
 }
 if(input.showSupporting!==undefined&&typeof input.showSupporting!=="boolean")throw new Error("Некорректная видимость фоновых предметов");
 if(input.environmentPrompt!==undefined&&(typeof input.environmentPrompt!=="string"||input.environmentPrompt.length>600))throw new Error("Пожелания к окружению — до 600 символов");
 if(input.environmentExplanation!==undefined&&(!Array.isArray(input.environmentExplanation)||input.environmentExplanation.length>3||input.environmentExplanation.some(t=>typeof t!=="string"||t.length>240)))throw new Error("Некорректное объяснение окружения");
 const stagingPlans=REFERENCE.STAGING.cleanPlans(input.stagingPlans,items);
 const executionNotes=input.executionNotes===undefined?[]:input.executionNotes;if(!Array.isArray(executionNotes)||executionNotes.length>12||executionNotes.some(t=>typeof t!=="string"||t.length>320))throw Error("Invalid execution notes");
 return {version:1,sizing:native?"native":"legacy",environmentPrompt:input.environmentPrompt||"",environmentExplanation:input.environmentExplanation||[],groups:cleanGroups,formatPlans,...(stagingPlans?{stagingPlans}:{}),...(executionNotes.length?{executionNotes}:{}),...(sizeGeometryOrigin?{sizeGeometryOrigin}:{}),width:f.width,height:f.height,format:f.id,size:input.size,palette:input.palette,layout:input.layout,background:input.background,backgroundDesign:input.backgroundDesign||"auto",supporting:input.supporting!==false,showSupporting:input.showSupporting!==false,camera,composition,layerRelations:relations,recipe:input.recipe||"auto",framing:input.framing||"overview",focus,query:String(input.query||"").slice(0,600),scale:input.scale,items};
}
const API={REFERENCE,RULES,FORMATS,LAYOUTS,DIRECT,SEMANTIC,recipeFor,focusFor,layerPlan,orderLayers,placementPlan,positionIssues,contactSlot,contactSlots,nearestContact,validContact,protectedBox,visibleBox,polygonFor,polygonOverlap,objectsOverlap,attachedGroup,moveScene,sceneDescription,templateKey,captureTemplate,applyTemplate,normalize,tokenize,pick,createScene,variant,boundsFor,layoutIssues,ensureLayout,collisionFree,safeMove,arrange,generate,recolor,uniqueSvg,paletteFor,backdropDesignFor,objectMarkup,backgroundMarkup,sceneMarkup,exportSvg,validateScene,visibleItems,toggleLayerVisibility,escapeXml,uid,clone};
return API;
});
