/* Native physical constraints. Source vectors are never modified or scaled. */
(function(root,factory){const local=typeof module==='object'&&module.exports,api=factory(local?require('./geometry.js'):root.SourceGeometry,local?require('./interaction-registry.js'):root.InteractionRegistry);if(local)module.exports=api;else root.PhysicalLayout=api})(typeof globalThis!=='undefined'?globalThis:this,function(G,R){
'use strict';
const samples=new Map();
function shape(i,s){const value=G.shapes[i.assetId+'-'+s.size+'-'+i.role];if(!value?.body)throw Error('Нет физической маски предмета');return value}
function points(i,s){const key=i.assetId+'-'+s.size+'-'+i.role;if(!samples.has(key)){const m=shape(i,s).body,p=[];for(let y=0;y<m.height;y+=2)for(const [a,b]of m.rows[y])for(let x=a;x<=b;x+=2)p.push([(x+.5)/m.width,(y+.5)/m.height]);samples.set(key,p)}return samples.get(key)}
function transform(i,s,data,E){const v=E.variant(data,i.assetId,s.size,i.role),r=i.rotation*Math.PI/180;return {w:v.nativeWidth*s.scale,h:v.nativeHeight*s.scale,c:Math.cos(r),s:Math.sin(r),fx:i.flipX?-1:1,fy:i.flipY?-1:1}}
function world(p,i,t){const x=(p[0]-.5)*t.w*t.fx,y=(p[1]-.5)*t.h*t.fy;return {x:i.x+x*t.c-y*t.s,y:i.y+x*t.s+y*t.c}}
function contains(p,i,t,m){const dx=p.x-i.x,dy=p.y-i.y,x=((dx*t.c+dy*t.s)/t.w*t.fx+.5)*m.width,y=((-dx*t.s+dy*t.c)/t.h*t.fy+.5)*m.height,iy=Math.floor(y);if(iy<0||iy>=m.height)return false;return m.rows[iy].some(([a,b])=>x>=a-.35&&x<=b+1.35)}
function area(s){const c=s.camera||{x:0,y:0};return {x:(s.layout==='headline'?s.width*.43:0)-c.x,y:-c.y,w:s.width*(s.layout==='headline'?.57:1),h:s.height}}
function inside(p,a){return p.x>=a.x&&p.x<=a.x+a.w&&p.y>=a.y&&p.y<=a.y+a.h}
function bounds(i,s,data,E){const t=transform(i,s,data,E),p=points(i,s).map(v=>world(v,i,t)),xs=p.map(v=>v.x),ys=p.map(v=>v.y),x=Math.min(...xs),y=Math.min(...ys);return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y}}
function intersects(a,b,s,data,E,{clip=true}={}){
 const aa=bounds(a,s,data,E),bb=bounds(b,s,data,E);if(aa.x+aa.width<bb.x||bb.x+bb.width<aa.x||aa.y+aa.height<bb.y||bb.y+bb.height<aa.y)return false;
 const ta=transform(a,s,data,E),tb=transform(b,s,data,E),ma=shape(a,s).body,mb=shape(b,s).body,frame=area(s);
 for(const [from,to,tf,tt,mask]of [[a,b,ta,tb,mb],[b,a,tb,ta,ma]])for(const p of points(from,s)){const w=world(p,from,tf);if((!clip||inside(w,frame))&&contains(w,to,tt,mask))return true}return false;
}
function coverage(child,base,s,data,E){const tc=transform(child,s,data,E),tb=transform(base,s,data,E),mask=shape(base,s).body,p=points(child,s);let n=0;for(const v of p)if(contains(world(v,child,tc),base,tb,mask))n++;return n/Math.max(1,p.length)}
function allowed(base,child){return R.supports.find(r=>r.reviewed&&r.back===base.assetId&&r.front===child.assetId)||null}
function onSurface(base,child,s,data,E){if(!allowed(base,child))return false;const tc=transform(child,s,data,E),tb=transform(base,s,data,E),opt=R.protectedRegions[child.assetId].optical;return contains(world(opt,child,tc),base,tb,shape(base,s).body)&&coverage(child,base,s,data,E)>=.60}
function contact(a,b,s,data,E,{ordered=true}={}){const base=allowed(a,b)?a:allowed(b,a)?b:null;if(!base)return false;const child=base===a?b:a;if(child.supportUid&&child.supportUid!==base.uid)return false;const pair=(s.groups||[]).filter(g=>g.members.includes(base.uid)&&g.members.includes(child.uid));if(!child.supportUid&&pair.some(g=>g.kind==='collection')&&!pair.some(g=>g.kind==='surface'))return false;return (!ordered||s.items.indexOf(base)<s.items.indexOf(child))&&onSurface(base,child,s,data,E)}
function wantsSupport(s,base,child,placement){if(!allowed(base,child))return false;const groups=(s.groups||[]).filter(g=>g.members.includes(base.uid)&&g.members.includes(child.uid));if(groups.some(g=>g.kind==='surface'))return true;if(groups.some(g=>g.kind==='collection'))return false;return placement!=='beside'}
function visible(s,E){return E.visibleItems(s)}
function issues(s,data,E){const result=[],items=visible(s,E),ids=new Set(items.map(i=>i.uid));for(const child of items)if(child.supportUid&&ids.has(child.supportUid)){const base=items.find(i=>i.uid===child.supportUid);if(!contact(base,child,s,data,E))result.push({type:'invalid-support',items:[base.uid,child.uid]})}
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];if(a.role!=='main'||b.role!=='main')continue;if(intersects(a,b,s,data,E)&&!contact(a,b,s,data,E))result.push({type:'collision',items:[a.uid,b.uid]})}return result;
}
function visibility(i,s,data,E){const t=transform(i,s,data,E),p=points(i,s),a=area(s);let n=0;for(const v of p)if(inside(world(v,i,t),a))n++;return n/Math.max(1,p.length)}
function slots(base,child,s,data,E){const rule=allowed(base,child);if(!rule)return [];const t=transform(base,s,data,E),p=rule.anchors.map(([x,y])=>world([x+.5,y+.5],base,t));for(const x of [-.26,-.13,0,.13,.26])for(const y of [-.2,-.08,.04,.16])p.push(world([x+.5,y+.5],base,t));return p.sort((a,b)=>(a.x-child.x)**2+(a.y-child.y)**2-(b.x-child.x)**2-(b.y-child.y)**2)}
function attach(s,data,E,movable=null){const settled=new Map();if(movable)for(const child of s.items)if(child.supportUid&&!child.hidden&&!movable.includes(child.uid)){const siblings=settled.get(child.supportUid)||[];siblings.push(child);settled.set(child.supportUid,siblings)}for(const child of s.items){if(movable&&!movable.includes(child.uid))continue;if(!child.supportUid||child.hidden)continue;const base=s.items.find(i=>i.uid===child.supportUid);if(!base||!allowed(base,child)){delete child.supportUid;continue}const siblings=settled.get(base.uid)||[],positions=[{x:child.x,y:child.y},...slots(base,child,s,data,E)];let found=false;for(const p of positions){const proposal={...child,x:p.x,y:p.y};if(onSurface(base,proposal,s,data,E)&&siblings.every(i=>!intersects(i,proposal,s,data,E,{clip:false}))){child.x=p.x;child.y=p.y;found=true;break}}if(found){siblings.push(child);settled.set(base.uid,siblings)}else delete child.supportUid}E.orderLayers(s);return s}
function attached(s,uid){const ids=new Set([uid]);let changed=true;while(changed){changed=false;for(const i of s.items)if(i.supportUid&&ids.has(i.supportUid)&&!ids.has(i.uid)){ids.add(i.uid);changed=true}}return ids}
function groups(s,E){const items=visible(s,E),parents=new Map(items.filter(i=>i.supportUid).map(i=>[i.uid,i.supportUid])),out=new Map();for(const i of items){let id=i.uid,seen=new Set();while(parents.has(id)&&!seen.has(id)){seen.add(id);id=parents.get(id)}if(!out.has(id))out.set(id,[]);out.get(id).push(i)}return [...out.values()].filter(g=>g.some(i=>i.role==='main'))}
function candidates(s,group,placed,data,E){const a=area(s),root=group.find(i=>!i.supportUid)||group[0],p=[{x:root.x,y:root.y}],boxes=group.map(i=>bounds(i,s,data,E)),left=Math.min(...boxes.map(b=>b.x)),right=Math.max(...boxes.map(b=>b.x+b.width)),top=Math.min(...boxes.map(b=>b.y)),bottom=Math.max(...boxes.map(b=>b.y+b.height)),xs=[root.x],ys=[root.y],gap=s.size==='L'?18:10;
 for(const fixed of placed){const b=bounds(fixed,s,data,E);xs.push(root.x+b.x-right-gap,root.x+b.x+b.width-left+gap);ys.push(root.y+b.y-bottom-gap,root.y+b.y+b.height-top+gap)}
 for(const x of [-.2,0,.04,.16,.28,.40,.52,.64,.76,.88,.98,1.2])xs.push(a.x+a.w*x);for(const y of [-.2,0,.04,.16,.28,.40,.52,.64,.76,.88,.98,1.2])ys.push(a.y+a.h*y);
 for(const x of xs)for(const y of ys)p.push({x,y});return {root,points:p.sort((a,b)=>(a.x-root.x)**2+(a.y-root.y)**2-(b.x-root.x)**2-(b.y-root.y)**2)};
}
function optical(i,s,data,E){return world(R.protectedRegions[i.assetId].optical,i,transform(i,s,data,E))}
function separateOutward(scene,data,E,{movable=null,minimums={},includeBackground=false}={}){
 const s=E.clone(scene),items=visible(s,E),a=area(s),center={x:a.x+a.w/2,y:a.y+a.h/2},origins=new Map(items.map(i=>[i.uid,optical(i,s,data,E)])),order=new Map(items.map((i,n)=>[i.uid,n]));
 const byId=new Map(s.items.map(i=>[i.uid,i])),root=i=>{const seen=new Set();while(i.supportUid&&byId.has(i.supportUid)&&!seen.has(i.uid)){seen.add(i.uid);i=byId.get(i.supportUid)}return i};
 const distance=i=>{const p=origins.get(i.uid)||optical(i,s,data,E);return (p.x-center.x)**2+(p.y-center.y)**2};
 const group=i=>{const r=root(i);return s.items.filter(j=>attached(s,r.uid).has(j.uid))};
 const canMove=g=>!movable||g.every(i=>movable.includes(i.uid));
 const background=g=>g.every(i=>i.role==='background');
 const minimum=i=>minimums[i.uid]??(i.role==='background'?.035:R.physicalClass(i.assetId)==='surfaces'?.16:.30);
 const authorizedContact=(x,y)=>contact(x,y,s,data,E)&&(x.role==='main'&&y.role==='main'||x.supportUid===y.uid||y.supportUid===x.uid);
 const gap=s.size==='L'?12:6;
 for(let pass=0;pass<96;pass++){
  let collision=null;
  for(let n=0;n<items.length&&!collision;n++)for(let m=n+1;m<items.length;m++){
   const x=items[n],y=items[m];if(!includeBackground&&(x.role!=='main'||y.role!=='main'))continue;
   if(!intersects(x,y,s,data,E)||authorizedContact(x,y))continue;
   if(root(x).uid===root(y).uid)throw Error('Предметы на одной опоре пересекаются. Нужна другая точка контакта.');
   collision=[x,y];break;
  }
  if(!collision){if(items.some(i=>i.role==='main'&&visibility(i,s,data,E)<minimum(i)))throw Error('После коррекции предмет слишком сильно обрезан.');return s}
  const [x,y]=collision,gx=group(x),gy=group(y),rx=root(x),ry=root(y);
  // A free background never displaces the main scene. Otherwise compare the
  // original optical centers, so chain corrections cannot change the priority.
  let moving,fixed;
  if(background(gx)!==background(gy))[moving,fixed]=background(gx)?[rx,ry]:[ry,rx];
  else [moving,fixed]=distance(rx)>distance(ry)||distance(rx)===distance(ry)&&order.get(rx.uid)>order.get(ry.uid)?[rx,ry]:[ry,rx];
  const movingGroup=group(moving),fixedGroup=group(fixed);
  if(!canMove(movingGroup))throw Error('Внешний предмет закреплён; исправление пересечения требует другого плана.');
  const p=origins.get(moving.uid)||optical(moving,s,data,E),q=origins.get(fixed.uid)||optical(fixed,s,data,E);let dx=p.x-q.x,dy=p.y-q.y;
  if(Math.hypot(dx,dy)<1e-6){const origin=origins.get(moving.uid)||p;dx=origin.x-center.x;dy=origin.y-center.y;if(Math.hypot(dx,dy)<1e-6){dx=-1;dy=-1}}
  const length=Math.hypot(dx,dy);dx/=length;dy/=length;
  const before=movingGroup.map(i=>({x:i.x,y:i.y})),b=bounds(moving,s,data,E),step=Math.max(2,Math.min(b.width,b.height)*.035);
  const set=(t,v)=>movingGroup.forEach((i,n)=>{i.x=before[n].x+v.x*t;i.y=before[n].y+v.y*t});
  const overlaps=()=>movingGroup.some(i=>!i.hidden&&fixedGroup.some(j=>!j.hidden&&intersects(i,j,s,data,E)&&!authorizedContact(i,j)));
  const limit=4*Math.max(a.w,a.h,b.width,b.height),directions=[[dx,dy],...[2,4,8,16,32,64].flatMap(k=>[[dx,dy*k],[dx*k,dy]])];
  for(const degrees of [15,-15,30,-30,45,-45,60,-60,75,-75]){const angle=degrees*Math.PI/180,x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);if(x*(p.x-center.x)+y*(p.y-center.y)>=0)directions.push([x,y])}
  let solved=false;
  // Prefer the direct opposite ray. At a frame edge, a steeper ray in the same
  // outward quadrant can retain readability without moving the central item.
  for(const [vx,vy]of directions){const length=Math.hypot(vx,vy),v={x:vx/length,y:vy/length};let low=0,high=step;
   for(;high<=limit;high+=step){set(high,v);if(!overlaps())break;low=high}
   if(high>limit)continue;
   for(let n=0;n<10;n++){const t=(low+high)/2;set(t,v);if(overlaps())low=t;else high=t}
   set(high+gap,v);
   if(movingGroup.every(i=>i.hidden||visibility(i,s,data,E)>=minimum(i))){solved=true;break}
  }
  if(!solved)throw Error('Внешний предмет выходит за допустимые границы. Нужен другой план или набор S.');
 }
 throw Error('Не удалось разрешить цепочку пересечений без перестройки композиции.');
}
function constrain(scene,data,E,{movable=null,minimums={},priorities={},outward=false}={}){const s=E.clone(scene);attach(s,data,E,movable);if(outward)return separateOutward(s,data,E,{movable,minimums});const all=groups(s,E),locked=[],free=[];for(const group of all){if(!movable){free.push(group);continue}const moving=group.filter(i=>movable.includes(i.uid)),fixed=group.filter(i=>!movable.includes(i.uid));if(moving.length)free.push(moving);if(fixed.length)locked.push(fixed)}
 const priority=g=>Math.min(...g.map(i=>priorities[i.uid]??(['standing','independent'].includes(R.physicalClass(i.assetId))?0:R.physicalClass(i.assetId)==='surfaces'?1:2)));free.sort((a,b)=>priority(a)-priority(b));const placed=locked.flat();
 for(const group of free){const ids=new Set(group.map(i=>i.uid)),original=group.map(i=>({x:i.x,y:i.y})),plan=candidates(s,group,placed,data,E),origin={x:plan.root.x,y:plan.root.y},placedIds=new Set(placed.map(i=>i.uid));let found=false;
  for(const p of plan.points){const dx=p.x-origin.x,dy=p.y-origin.y;group.forEach((i,n)=>{i.x=original[n].x+dx;i.y=original[n].y+dy});
   if(group.some(i=>i.role==='main'&&visibility(i,s,data,E)<(minimums[i.uid]??(R.physicalClass(i.assetId)==='surfaces'?.16:.30))))continue;
   const probe={...s,items:s.items.filter(i=>ids.has(i.uid)||placedIds.has(i.uid))};const collision=issues(probe,data,E).some(r=>r.items.some(id=>ids.has(id)));if(!collision){found=true;break}
  }
  if(!found)throw Error('Не удалось разместить предметы без недопустимого пересечения. Выберите S, другой вариант или меньше предметов.');placed.push(...group);
 }
 E.orderLayers(s);if(issues(s,data,E).length)throw Error('Главная группа содержит недопустимое пересечение.');return s;
}
function move(scene,data,E,uid,target){const source=scene.items.find(i=>i.uid===uid);if(!source)return E.clone(scene);const s=E.clone(scene),ids=attached(scene,uid),dx=target.x-source.x,dy=target.y-source.y;for(const i of s.items)if(ids.has(i.uid)){i.x+=dx;i.y+=dy}const child=s.items.find(i=>i.uid===uid);delete child.supportUid;
 for(const base of visible(s,E).filter(i=>!ids.has(i.uid)&&allowed(i,child)))if(onSurface(base,child,s,data,E)){child.supportUid=base.uid;break}
 try{return constrain(s,data,E,{movable:[...ids]})}catch{return E.clone(scene)}
}
return {physicalGroups:R.physicalGroups,allowed,wantsSupport,onSurface,contact,coverage,intersects,issues,constrain,separateOutward,move,attached,visibility,bounds};
});
