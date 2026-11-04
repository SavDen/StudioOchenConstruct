/* Native-size art direction. SVGs are positioned and cropped, never fitted. */
(function(root,factory){const local=typeof module==="object"&&module.exports,api=factory(local?require("./physical-layout.js"):root.PhysicalLayout,local?require("./staging-plan.js"):root.StagingPlan);if(local)module.exports=api;else root.ReferenceLayout=api})(typeof globalThis!=="undefined"?globalThis:this,function(PHYSICS,STAGING){
"use strict";
const KINDS=["reading","writing","surface","collection"];
const ZONES=["auto","top-left","top-right","bottom-left","bottom-right","back-center"];
const FLOWS=["diagonal","horizontal","vertical"],ANCHORS=["center","upper","lower","left","right"],SIDES=["keep","left","right","top","bottom"];
const PLACEMENTS=["on-surface","beside","across"];
function area(scene){const c=scene.camera||{x:0,y:0};return {x:(scene.layout==="headline"?scene.width*.43:0)-c.x,y:-c.y,w:scene.width*(scene.layout==="headline"?.57:1),h:scene.height}}
function planFor(scene){
 const format=["square","landscape","portrait"].includes(scene.format)?scene.format:scene.height>scene.width*1.12?"portrait":scene.width>scene.height*1.12?"landscape":"square";
 return (scene.formatPlans||[]).find(p=>p.format===format)||{format,flow:format==="portrait"?"vertical":format==="landscape"?"horizontal":"diagonal",anchor:"center",background:"keep",principle:"Расположение и обрезка подобраны под пропорции холста."};
}
function paired(scene,a,b,kind){
 const left=scene.items.find(i=>i.assetId===a),right=scene.items.find(i=>i.assetId===b);if(!left||!right)return false;
 const explicit=(scene.groups||[]).find(g=>g.members.includes(left.uid)&&g.members.includes(right.uid));
 if(explicit)return kind?explicit.kind===kind:explicit.kind!=="collection";
 return scene.items.filter(i=>i.role==="main").length===2&&left.role==="main"&&right.role==="main";
}
function readingPair(scene){return paired(scene,"book","lamp","reading")||(!(scene.groups||[]).length&&paired(scene,"book","lamp"))}
function clipBox(box,a){const x=Math.max(box.x,a.x),y=Math.max(box.y,a.y),right=Math.min(box.x+box.width,a.x+a.w),bottom=Math.min(box.y+box.height,a.y+a.h);return Math.max(0,right-x)*Math.max(0,bottom-y)/Math.max(1,box.width*box.height)}
function pointIn(poly,x,y){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
function exposed(item,scene,data,E,foreground=[]){
 const b=E.boundsFor(item,scene,data),a=area(scene),shape=E.polygonFor(item,scene,data),obstacles=foreground.map(i=>E.polygonFor(i,scene,data));let total=0,seen=0;
 for(let y=0;y<12;y++)for(let x=0;x<12;x++){
  const px=b.x+b.width*(x+.5)/12,py=b.y+b.height*(y+.5)/12;if(!pointIn(shape,px,py))continue;total++;
  if(px>=a.x&&px<=a.x+a.w&&py>=a.y&&py<=a.y+a.h&&!obstacles.some(p=>pointIn(p,px,py)))seen++;
 }
 return total?seen/total:0;
}
function backgroundCandidates(item,scene,data,E){
 const a=area(scene),b=E.boundsFor(item,scene,data),whole=item.crop==="whole";
 const positions={
  "top-left":[a.x+a.w*.08,a.y-b.height*.04],"top-right":[a.x+a.w*.92,a.y-b.height*.04],
  "bottom-left":[a.x+a.w*.04,a.y+a.h+b.height*.08],"bottom-right":[a.x+a.w*.96,a.y+a.h+b.height*.08],
  "back-center":[a.x+a.w*.52,a.y+a.h*.12]
 };
 if(whole)for(const p of Object.values(positions)){
  if(b.width<=a.w)p[0]=Math.max(a.x+b.width/2,Math.min(a.x+a.w-b.width/2,p[0]));
  if(b.height<=a.h)p[1]=Math.max(a.y+b.height/2,Math.min(a.y+a.h-b.height/2,p[1]));
 }
 if(item.assetId==="lamp"&&!whole){
  positions["top-left"]=[a.x+a.w*.28,a.y-b.height*.22];
  positions["top-right"]=[a.x+a.w*.80,a.y-b.height*.22];
 }
 const preferred=item.zone&&item.zone!=="auto"?item.zone:item.assetId==="folder"?"top-right":"top-left";
 const zones=item.zone&&item.zone!=="auto"?[preferred]:[preferred,...Object.keys(positions).filter(z=>z!==preferred)];
 return zones.flatMap((zone,index)=>{
  const p=positions[zone],edge=zone.startsWith("top")?1:zone.startsWith("bottom")?-1:0;
  return [0,.12,-.12].flatMap(shift=>(whole?[0]:[0,.18,.38,.55]).map(inset=>({x:p[0]+a.w*shift,y:p[1]+a.h*Math.abs(shift)*.5+edge*b.height*inset,preference:index===0?.12:0})));
 });

}
function environment(scene,data,E){
 const next=E.clone(scene),mains=next.items.filter(i=>i.role==="main"&&!i.hidden),backgrounds=next.items.filter(i=>i.role==="background"),placed=[];
 for(const item of backgrounds){
  if(next.items.some(i=>i.supportUid===item.uid)){if(!item.hidden)placed.push(item);continue}
  let best=null;
  for(const p of backgroundCandidates(item,next,data,E)){
   const candidate={...item,x:p.x,y:p.y},visible=exposed(candidate,next,data,E,[...mains,...placed]);
   const score=(visible>=.035?2:0)+Math.min(visible,.55)*2-Math.abs(visible-(item.crop==="whole"?.95:.32))*.4+p.preference;
   if(!best||score>best.score)best={...p,score};
  }
  if(best){item.x=best.x;item.y=best.y}if(!item.hidden)placed.push(item);
 }
 return next;
}
function arrange(scene,data,E,{variation=0,placement}={}){
 const authored=STAGING.viewFor(scene,Math.abs(variation)%3);if(authored)return STAGING.execute(scene,data,E,authored);
 let next=E.clone(scene);next.scale=1;next.camera=null;next.composition=null;delete next.sizeGeometryOrigin;
 if(!next.items.length)return next;
 variation=Math.abs(variation)%3;placement=placement||PLACEMENTS[variation];
 const plan=planFor(next),flow=plan.flow;
 const backgrounds=next.items.filter(i=>i.role==="background");
 for(const [index,bg]of backgrounds.entries()){
  if(backgrounds.length>1&&(index>0||bg.zone&&bg.zone!=="auto"))continue;
  const zone=bg.zone&&bg.zone!=="auto"?bg.zone:"top-left";
  if(plan.background==="left"||plan.background==="right")bg.zone=(zone.startsWith("bottom")?"bottom-":"top-")+plan.background;
  else if(plan.background==="top"||plan.background==="bottom")bg.zone=plan.background+(zone.endsWith("right")?"-right":"-left");
 }
 const a=area(next),mains=next.items.filter(i=>i.role==="main"),focus=mains.find(i=>i.assetId===next.focus)||mains[0]||next.items[0];
 const find=id=>next.items.find(i=>i.assetId===id),base=find("book")||find("folder");
 const set=(item,x,y)=>{if(item){const nx=a.x+a.w*x,ny=a.y+a.h*y,dx=nx-item.x,dy=ny-item.y;item.x=nx;item.y=ny;delete item.supportUid;next.items.filter(i=>i.supportUid===item.uid).forEach(i=>{i.x+=dx;i.y+=dy})}};
 const drift=variation===1?-.025:variation===2?.025:0;
 const anchors={book:[.54,.54],folder:[.56,.37],headphones:[.62,.64],flowers:[.36,.36],wallet:[.48,.72],coin:[.76,.45],phone:[.40,.68],puzzle:[.68,.22],pen:[.35,.81],lamp:[.87,.28]};
 const duplicates=new Map();
 for(const item of next.items){
  const n=duplicates.get(item.assetId)||0;duplicates.set(item.assetId,n+1);
  const p=anchors[item.assetId]||[.5,.5];set(item,p[0]+drift+n*.12,p[1]+n*.13);
 }
 if(focus.assetId==="headphones"){
  set(focus,(flow==="horizontal"?.64:.61)+drift,flow==="vertical"?.73:.64);if(find("flowers")?.role==="main")set(find("flowers"),.10,.12);
  if(find("phone")?.role==="main")set(find("phone"),.25,.18);
 }
 if(find("phone")&&find("puzzle")&&!find("book")){set(find("phone"),(next.layout==="offset"?.65:.40)+drift,.69);set(find("puzzle"),(next.layout==="offset"?.25:.65)-drift,.20)}
 if(find("wallet")&&find("coin")){set(find("wallet"),(next.layout==="offset"?.72:.49)+drift,.72);set(find("coin"),(next.layout==="offset"?.25:.76)-drift,.42)}
 if(base){
  const children=next.items.filter(i=>i.uid!==base.uid&&["phone","pen","puzzle","coin","wallet"].includes(i.assetId)&&i.role==="main"&&PHYSICS.wantsSupport(next,base,i,placement));
  if(children.length){
   if(placement==="beside"){
    const positions=flow==="vertical"?[[.56,.27],[.42,.78]]:flow==="horizontal"?[[.26,.28],[.77,.80]]:[[.80,.23],[.24,.80]];
    if(next.layout==="offset")positions.forEach(p=>p[0]=1-p[0]);
    set(base,...positions[0]);children.forEach((item,index)=>set(item,positions[1][0]+index*.18,positions[1][1]-index*.04));
   }else{
    set(base,(next.layout==="offset"?.72:flow==="horizontal"?.48:.54)+drift,flow==="vertical"?.64:flow==="horizontal"?.56:.51);
    const v=E.variant(data,base.assetId,next.size,base.role),slots={phone:[.12,-.10],pen:[-.10,.08],puzzle:[-.10,-.18],coin:[.20,.04],wallet:[.12,-.08]};
    children.forEach((item,index)=>{
     const p=item.assetId==="pen"&&next.layout==="offset"?[.13,-.10]:slots[item.assetId];item.x=base.x+v.nativeWidth*(p[0]+index*.06);item.y=base.y+v.nativeHeight*(p[1]+index*.05);item.supportUid=base.uid;
     if(item.assetId==="pen"&&placement==="across"){item.rotation=-65;item.x=base.x+v.nativeWidth*.04;item.y=base.y-v.nativeHeight*.02}
    });
   }
  }
 }
 // An illuminated reading pair has a functional direction. A collection may
 // put the lamp on the right, as in the authored compact reference.
 if(readingPair(next)){set(find("lamp"),.06+drift,.24);set(find("book"),.82+drift,.62)}
 else if(find("lamp")?.role==="main"){set(find("lamp"),(next.layout==="offset"?.04:.92)+drift,.28+variation*.025);if(base&&next.layout==="offset"){const dx=a.w*.22;base.x+=dx;next.items.filter(i=>i.supportUid===base.uid).forEach(i=>i.x+=dx)}}
 if(next.layout==="offset"&&!readingPair(next)){
  const headphone=find("headphones");if(headphone?.role==="main")headphone.x=a.x+a.w*(.42+drift);
 }
 if(mains.length===1&&next.items.length===1){const p=[[.5,.5],[.42,.62],[.60,.40]][variation];set(focus,p[0],p[1])}
 const shift={center:[0,0],upper:[0,-.12],lower:[0,.10],left:[-.10,0],right:[.10,0]}[plan.anchor],moving=new Set(mains.map(i=>i.uid));
 let expanded=true;while(expanded){expanded=false;for(const item of next.items)if(moving.has(item.uid)&&item.supportUid&&!moving.has(item.supportUid)){moving.add(item.supportUid);expanded=true}}
 next.items.filter(i=>moving.has(i.uid)).forEach(i=>{i.x+=shift[0]*a.w;i.y+=shift[1]*a.h});
 // Keep each main's optical feature in the drawing region; clipping outer
 // silhouettes and source shadows is intentional. Do not fit or resize.
 for(const item of mains){
  const v=E.variant(data,item.assetId,next.size,item.role),opt=E.RULES.registry.protectedRegions[item.assetId].optical;
  const x=item.x+(opt[0]-.5)*v.nativeWidth,y=item.y+(opt[1]-.5)*v.nativeHeight;
  const previous={x:item.x,y:item.y};
  if(!item.supportUid){item.x+=Math.max(a.x+a.w*.10,Math.min(a.x+a.w*.90,x))-x;item.y+=Math.max(a.y+a.h*.12,Math.min(a.y+a.h*.88,y))-y}
  const box=E.boundsFor(item,next,data);
  if(["pen","coin"].includes(item.assetId)&&box.width<=a.w*.96)item.x=Math.max(a.x+box.width/2+a.w*.02,Math.min(a.x+a.w*.98-box.width/2,item.x));
  if(["pen","coin"].includes(item.assetId)&&box.height<=a.h*.96)item.y=Math.max(a.y+box.height/2+a.h*.02,Math.min(a.y+a.h*.98-box.height/2,item.y));
  next.items.filter(i=>i.supportUid===item.uid).forEach(i=>{i.x+=item.x-previous.x;i.y+=item.y-previous.y});
 }
 next=environment(next,data,E);E.orderLayers(next);return PHYSICS.constrain(next,data,E);
}
function issues(scene,data,E){
 const result=[];
 if(scene.scale!==1||scene.camera&&scene.camera.scale!==1)result.push({type:"scale",text:"Исходный масштаб должен быть 1:1"});
 return result.concat(PHYSICS.issues(scene,data,E));
}
function warnings(scene,data,E){
 const a=area(scene),result=[];
 for(const item of E.visibleItems(scene)){
  const fraction=clipBox(E.boundsFor(item,scene,data),a);
  if(item.role==="main"&&fraction<.14)result.push("Предмет «"+data.manifest.assets.find(s=>s.id===item.assetId).name+"» сильно обрезан. Выберите S или больший холст.");
 }
 return result;
}
return {PHYSICS,STAGING,KINDS,ZONES,PLACEMENTS,FLOWS,ANCHORS,SIDES,planFor,area,paired,readingPair,arrange,environment,issues,warnings,exposed};
});
