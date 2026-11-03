/* Keyword selection, template placement and vector export. No DOM or API required. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.CompositionEngine=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const FORMATS=[{id:"landscape",name:"Горизонтальный",width:1200,height:630},{id:"square",name:"Квадрат",width:1080,height:1080},{id:"portrait",name:"Вертикальный",width:1080,height:1350},{id:"wide",name:"Широкий",width:1920,height:1080}];
const LAYOUTS=[{id:"compact",name:"Собранно"},{id:"offset",name:"Со смещением"},{id:"headline",name:"Под заголовок"}];
const DIRECT={
book:["книг","book","учебник"],phone:["телефон","смартфон","айфон","iphone","phone"],puzzle:["пазл","puzzle"],coin:["монет","coin"],headphones:["наушник","headphone"],lamp:["ламп","светильник","lamp"],flowers:["цветы","цветов","цветоч","тюльпан","букет","ваз","flower"],wallet:["кошел","wallet"],folder:["папк","документ","folder"],pen:["ручк","pen"]};
const SEMANTIC={
book:["чтен","читат","читаю","обуч","учеб","учит","учиться","знан","образован","опыт"],
phone:["онлайн","online","приложен","цифров","связ","технолог","интернет","мобильн"],
puzzle:["решен","задач","вместе","команд","сотруднич","объедин","сложн","недоста"],
coin:["безопас","защит","накоп","деньг","ценност","ценность","сбереж","замок"],
headphones:["музык","аудио","слуш","подкаст","концентрац","звук","вниман"],
lamp:["свет","идея","идеи","идею","вдохнов","понят","пониман","озарен","работ","ясно"],
flowers:["забот","уют","подар","весн","благополуч","рост"],
wallet:["финанс","бюджет","расход","деньг","оплат","платеж","платёж"],
folder:["поряд","организац","хранен","оформлен","файл","план"],
pen:["письм","запис","замет","план","творч","подпис","состав"]};
const normalize=s=>String(s||"").toLocaleLowerCase("ru").replace(/ё/g,"е");
const tokenize=s=>normalize(s).match(/[a-zа-я0-9]+/g)||[];
const matchStem=(word,stem)=>stem.length<4?word===stem:word.startsWith(stem);
const hits=(words,stems)=>stems.filter(stem=>words.some(w=>matchStem(w,normalize(stem))));
const assetById=(data,id)=>data.manifest.assets.find(a=>a.id===id);
const uid=()=> "i"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const clone=x=>JSON.parse(JSON.stringify(x));
const escapeXml=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const fmt=n=>Number(Number(n).toFixed(5)).toString();
function pick(query,data,{supporting=true}={}){
 let text=normalize(query).slice(0,600),excluded=new Set();
 text=text.replace(/(?:\bwithout\b|без|не добавлять|исключить)\s+([^,.;]+)/g,(_,clause)=>{
  const words=tokenize(clause);for(const [id,stems]of Object.entries(DIRECT))if(hits(words,stems).length)excluded.add(id);return " ";
 });
 const words=tokenize(text);
 const matches=data.manifest.assets.map((a,index)=>{
  const direct=hits(words,DIRECT[a.id]),semantic=hits(words,SEMANTIC[a.id]);
  return {assetId:a.id,score:direct.length*100+semantic.length*10,direct:direct.length>0,reasons:[...direct,...semantic],index};
 }).filter(a=>a.score>0&&!excluded.has(a.assetId)).sort((a,b)=>b.score-a.score||a.index-b.index);
 // Explicit object lists retain every named object. Semantic-only matches add up to four.
 const direct=matches.filter(a=>a.direct);
 const selected=direct.length?direct:matches.slice(0,4);
 const items=selected.map(a=>({assetId:a.assetId,role:"main"}));
 if(supporting&&!/без\s+фон|только\s+главн/.test(normalize(query))&&items.length){
  const ids=new Set(items.map(a=>a.assetId));
  let candidates=[];
  if(ids.has("book"))candidates.push("lamp","headphones","pen");
  if(ids.has("wallet")||ids.has("coin"))candidates.push("phone","folder");
  if(ids.has("phone"))candidates.push("puzzle","book");
  if(ids.has("lamp"))candidates.push("book","pen");
  if(ids.has("folder"))candidates.push("pen");
  if(ids.has("headphones"))candidates.push("flowers");
  candidates=[...matches.map(m=>m.assetId),...candidates];
  const extra=candidates.find(id=>!ids.has(id)&&!excluded.has(id));
  if(extra)items.push({assetId:extra,role:"background"});
 }
 return {items,matches:selected,excluded:[...excluded],mode:direct.length?"components":"keywords"};
}
function createScene(overrides={}){
 return {version:1,width:1200,height:630,format:"landscape",size:"S",palette:"aqua",layout:"compact",background:"pattern",supporting:true,query:"Свет знаний",scale:1,items:[],...overrides};
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
function arrange(scene,data,{variation=0}={}){
 const next=clone(scene);if(!next.items.length){next.scale=1;return next}
 const main=next.items.filter(a=>a.role==="main"),bg=next.items.filter(a=>a.role==="background");
 const primary=main.length?main:next.items;
 const anchors=anchorPoints(primary.length);
 const refScale=next.size==="L"?2:1;
 primary.forEach((item,index)=>{
  let a=anchors[(index+variation)%anchors.length];
  item.x=a[0]*1300*refScale;item.y=a[1]*800*refScale;item.rotation=0;
 });
 // A bounded relaxation protects main-object boxes at the prepared anchor points.
 for(let pass=0;pass<50;pass++)for(let i=0;i<primary.length;i++)for(let j=i+1;j<primary.length;j++){
  const a=primary[i],b=primary[j],va=variant(data,a.assetId,next.size,a.role),vb=variant(data,b.assetId,next.size,b.role);
  const gap=30*refScale,ox=(va.nativeWidth+vb.nativeWidth)/2+gap-Math.abs(b.x-a.x),oy=(va.nativeHeight+vb.nativeHeight)/2+gap-Math.abs(b.y-a.y);
  if(ox>0&&oy>0){
   if(ox<oy){const sign=b.x>=a.x?1:-1;a.x-=sign*ox/2;b.x+=sign*ox/2}
   else {const sign=b.y>=a.y?1:-1;a.y-=sign*oy/2;b.y+=sign*oy/2}
  }
 }
 const raw=primary.map(item=>{const v=variant(data,item.assetId,next.size,item.role);return{x:item.x-v.nativeWidth/2,y:item.y-v.nativeHeight/2,X:item.x+v.nativeWidth/2,Y:item.y+v.nativeHeight/2}});
 const minX=Math.min(...raw.map(b=>b.x)),minY=Math.min(...raw.map(b=>b.y)),maxX=Math.max(...raw.map(b=>b.X)),maxY=Math.max(...raw.map(b=>b.Y));
 const area=next.layout==="headline"?{x:next.width*.49,y:next.height*.12,w:next.width*.47,h:next.height*.80}:next.layout==="offset"?{x:next.width*.22,y:next.height*.09,w:next.width*.74,h:next.height*.84}:{x:next.width*.06,y:next.height*.10,w:next.width*.88,h:next.height*.80};
 next.scale=Math.min(area.w/(maxX-minX),area.h/(maxY-minY));
 const targetX=area.x+area.w/2,targetY=area.y+area.h/2;
 primary.forEach(item=>{item.x=targetX+(item.x-(minX+maxX)/2)*next.scale;item.y=targetY+(item.y-(minY+maxY)/2)*next.scale});
 if(main.length){
  const bgAnchors=next.layout==="headline"?[[.63,.20],[.95,.86],[.82,.75]]:[[.12,.23],[.88,.75],[.72,.12]];
  bg.forEach((item,i)=>{const a=bgAnchors[i%bgAnchors.length];item.x=next.width*a[0];item.y=next.height*a[1];item.rotation=0});
  next.items=[...bg,...main];
 }
 return next;
}
function generate(query,scene,data,options={}){
 const result=pick(query,data,{supporting:scene.supporting});
 if(!result.items.length)return {scene:null,result};
 const next=createScene({...scene,query,items:result.items.map(a=>({...a,uid:uid(),x:0,y:0,rotation:0}))});
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
 return '<g id="object-'+item.uid+'" data-instance="'+item.uid+'" data-asset="'+item.assetId+'" data-role="'+item.role+'" transform="translate('+fmt(item.x)+' '+fmt(item.y)+') rotate('+fmt(item.rotation)+') scale('+fmt(scene.scale)+') translate('+fmt(-v.nativeWidth/2)+' '+fmt(-v.nativeHeight/2)+')">'+svg+'</g>';
}
function backgroundMarkup(scene,data){
 if(scene.background==="transparent")return "";
 const p=paletteFor(scene,data);
 if(scene.background==="solid")return '<rect width="'+scene.width+'" height="'+scene.height+'" fill="'+p.slots["background.base"]+'"/>';
 const b=data.manifest.backdrops.find(b=>b.size===scene.size&&b.palette===scene.palette);
 if(!b)throw new Error("Нет исходного фона");
 let svg=uniqueSvg(data.svgs[b.path],"scene-bg");
 svg=svg.replace(/^<svg\b[^>]*>/,opening=>opening.replace(/\bwidth="[^"]*"/,'width="'+scene.width+'"').replace(/\bheight="[^"]*"/,'height="'+scene.height+'"').replace(/>$/,' preserveAspectRatio="xMidYMid slice">'));
 return '<g id="scene-background">'+svg+'</g>';
}
function sceneMarkup(scene,data){return backgroundMarkup(scene,data)+scene.items.map(i=>objectMarkup(i,scene,data)).join("")}
function exportSvg(scene,data){
 const clean=validateScene(scene,data);
 return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="'+clean.width+'" height="'+clean.height+'" viewBox="0 0 '+clean.width+' '+clean.height+'" fill="none"><title>'+escapeXml(clean.query||"Композиция")+'</title><desc>Композиция из исходных векторных объектов. Размер '+clean.size+'.</desc>'+sceneMarkup(clean,data)+'</svg>';
}
function validateScene(input,data){
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Некорректный проект");
 const f=FORMATS.find(f=>f.id===input.format);
 if(!f||input.width!==f.width||input.height!==f.height)throw new Error("Неизвестный формат холста");
 if(!["S","L"].includes(input.size))throw new Error("Неизвестная детализация");
 if(!LAYOUTS.some(l=>l.id===input.layout))throw new Error("Неизвестная раскладка");
 if(!["pattern","solid","transparent"].includes(input.background))throw new Error("Неизвестный фон");
 paletteFor(input,data);
 if(!Number.isFinite(input.scale)||input.scale<.001||input.scale>20)throw new Error("Некорректный масштаб");
 if(!Array.isArray(input.items)||input.items.length>32)throw new Error("Можно использовать до 32 предметов");
 const ids=new Set();
 const items=input.items.map(item=>{
  if(!item||!assetById(data,item.assetId)||!["main","background"].includes(item.role))throw new Error("Неизвестный предмет или роль");
  if(typeof item.uid!=="string"||!/^i[a-z0-9-]{1,60}$/i.test(item.uid)||ids.has(item.uid))throw new Error("Некорректный идентификатор");
  ids.add(item.uid);
  if(!["x","y","rotation"].every(k=>Number.isFinite(item[k])&&Math.abs(item[k])<100000))throw new Error("Некорректные координаты");
  variant(data,item.assetId,input.size,item.role);
  return {uid:item.uid,assetId:item.assetId,role:item.role,x:item.x,y:item.y,rotation:item.rotation};
 });
 return {version:1,width:f.width,height:f.height,format:f.id,size:input.size,palette:input.palette,layout:input.layout,background:input.background,supporting:input.supporting!==false,query:String(input.query||"").slice(0,600),scale:input.scale,items};
}
return {FORMATS,LAYOUTS,DIRECT,SEMANTIC,normalize,tokenize,pick,createScene,variant,boundsFor,arrange,generate,recolor,uniqueSvg,paletteFor,objectMarkup,backgroundMarkup,sceneMarkup,exportSvg,validateScene,escapeXml,uid,clone};
});