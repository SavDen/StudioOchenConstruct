/* Validated AI selection; geometry remains in CompositionEngine. */
(function(root,factory){const local=typeof module==="object"&&module.exports,api=factory(local?require("./composition-view.js"):root.CompositionView);if(local)module.exports=api;else root.CompositionAI=api})(typeof globalThis!=="undefined"?globalThis:this,function(VIEW){
"use strict";
const KEYS=["version","status","title","explanation","limitations","recipe","layout","focus","items"];
const SEMANTICS={
 book:{literal:['чтение','знания'],associations:['источник','опыт','история','последовательность'],backgroundUse:'Спокойная плоскость страниц или контекст накопленного опыта; возможная опора по реестру.',recognizable:'Разворот страниц и часть переплёта.'},
 folder:{literal:['документы','архив'],associations:['порядок','структура','сохранение результата','организация'],backgroundUse:'Фрагмент плоскости у края поддерживает порядок или деловой контекст.',recognizable:'Контур папки с краем документов.'},
 phone:{literal:['связь','цифровой сервис'],associations:['доступность','дистанция','мобильность','личный канал'],backgroundUse:'Сдержанный цифровой контекст рядом с главным действием; уместен и без темы учёбы.',recognizable:'Экран вместе с частью корпуса; случайный обрезок рамки недостаточен.'},
 wallet:{literal:['личные финансы'],associations:['запас','сохранность','личное пространство','доступ к ресурсу'],backgroundUse:'Контекст личных ресурсов или бережного хранения, даже если деньги не главный сюжет.',recognizable:'Часть корпуса и характерная застёжка.'},
 coin:{literal:['деньги'],associations:['ценность','единица результата','обмен','малый вклад','накопление'],backgroundUse:'Тихий знак ценности или результата; небольшой круглый акцент в исходном размере.',recognizable:'Большая часть круглого силуэта.'},
 pen:{literal:['письмо','запись'],associations:['действие','фиксация мысли','авторство','решение','начало работы'],backgroundUse:'Направляющая диагональ, след творческой или деловой деятельности.',recognizable:'Связный участок корпуса с колпачком или наконечником.'},
 puzzle:{literal:['части','сборка'],associations:['совместимость','взаимосвязь','интеграция','поиск решения'],backgroundUse:'Эхо темы связи или согласования; две соединённые детали уже являются одним ассетом.',recognizable:'Характерный выступ или выемка вместе с телом детали.'},
 headphones:{literal:['звук','музыка'],associations:['личный ритм','фокус','погружение','фильтрация шума','внимание'],backgroundUse:'Контекст самостоятельного темпа или личного пространства, а не только музыка.',recognizable:'Чашка и связанный с ней участок дужки.'},
 lamp:{literal:['освещение'],associations:['ясность','прояснение','направление внимания','поиск'],backgroundUse:'Осмысленный световой контекст. Не универсальный компаньон для любого рабочего сюжета.',recognizable:'Связный фрагмент плафона со стойкой либо основания со стойкой.'},
 flowers:{literal:['цветы','домашняя обстановка'],associations:['рост','забота','обновление','развитие','спокойствие'],backgroundUse:'Органический противовес геометричным предметам или смысл роста и заботы.',recognizable:'Ваза либо связный фрагмент букета со стеблями.'}
};
function backgroundsAllowed(query,E){return !/(?:\bwithout\b|\bno\b)\s+backgrounds?(?:\s+(?:objects|items|elements)\b|\s*(?:$|[.,;!?]))|(?:без|никаких)\s+(?:фона(?:\s|$|[.,;!?])|фоновых\s+(?:предмет|объект|элемент)|фонового\s+окружени)|не\s+добавля(?:ть|й|йте)\s+(?:фон(?:\s|$|[.,;!?])|фоновые\s+(?:предмет|объект|элемент))|только\s+(?:главн|основн)/.test(E.normalize(query))}
function allows(scene,E){return backgroundsAllowed(scene?.query,E)&&backgroundsAllowed(scene?.environmentPrompt,E)}
function requestedCount(scene,id,E,{mode='compose'}={}){
 const words=E.tokenize((scene.query||'')+' '+(scene.environmentPrompt||'')),names=[];
 for(let n=0;n<words.length;n++)if((E.DIRECT[id]||[]).some(stem=>words[n].startsWith(E.normalize(stem))))names.push(n);
 const quantities={two:2,three:3,'2':2,'3':3,два:2,две:2,двух:2,три:3,трех:3};
 return Math.max(1,names.length,...names.map(n=>Math.max(1,...words.slice(Math.max(0,n-2),n).map(w=>quantities[w]||1))),mode==='environment'?(scene.items||[]).filter(i=>i.assetId===id&&i.role==='main').length:0);
}
function responseSchema(data,E,scene,{mode="compose",staging=false}={}){
 const ids=data.manifest.assets.map(a=>a.id),strings={type:"array",items:{type:"string"},maxItems:3};
 const roles=allows(scene,E)?["main","background"]:["main"],layouts=scene?.layout?[scene.layout]:E.LAYOUTS.map(l=>l.id);
 const schema={type:"object",properties:{version:{type:"integer"},status:{type:"string",enum:["ready","unavailable"]},title:{type:"string"},explanation:{...strings,minItems:1},limitations:strings,recipe:{type:"string",enum:["auto",...E.RULES.recipes.map(r=>r.id)]},layout:{type:"string",enum:layouts},focus:{type:"string",enum:["none",...ids]},items:{type:"array",maxItems:6,items:{type:"object",properties:{assetId:{type:"string",enum:ids},role:{type:"string",enum:roles}},required:["assetId","role"]}},layers:{type:"array",maxItems:15,items:{type:"object",properties:{back:{type:"integer"},front:{type:"integer"},reason:{type:"string"}},required:["back","front","reason"]}},compositions:{type:"array",minItems:3,maxItems:3,items:{type:"object",properties:{strategy:{type:"string",enum:["balanced","spacious","diagonal"]},title:{type:"string"},principle:{type:"string"}},required:["strategy","title","principle"]}}},required:[...KEYS,"compositions","layers"]};
 if(mode==="environment")schema.properties.items.maxItems=Math.min(32,(scene?.items.filter(i=>i.role==="main").length||0)+(allows(scene,E)?3:0));
 if(scene?.sizing==="native"){
  const item=schema.properties.items.items,composition=schema.properties.compositions.items;
  item.properties.zone={type:"string",enum:E.REFERENCE.ZONES};item.properties.crop={type:"string",enum:["whole","fragment"]};item.required.push("zone","crop");
  composition.properties.placement={type:"string",enum:E.REFERENCE.PLACEMENTS};composition.required.push("placement");
  schema.properties.groups={type:"array",maxItems:8,items:{type:"object",properties:{kind:{type:"string",enum:E.REFERENCE.KINDS},members:{type:"array",minItems:2,maxItems:6,items:{type:"integer"}},reason:{type:"string"}},required:["kind","members","reason"]}};schema.required.push("groups");
  if(mode==="compose"){
   const format={type:"object",properties:{flow:{type:"string",enum:E.REFERENCE.FLOWS},anchor:{type:"string",enum:E.REFERENCE.ANCHORS},background:{type:"string",enum:E.REFERENCE.SIDES},principle:{type:"string"}},required:["flow","anchor","background","principle"]};
   schema.properties.formats={type:"object",properties:Object.fromEntries(VIEW.OUTPUTS.map(key=>[key,format])),required:VIEW.OUTPUTS};schema.required.push("formats");
  }
  if(staging){
   const derived=["recipe","groups","layers","compositions","formats"];for(const key of derived)delete schema.properties[key];schema.required=schema.required.filter(k=>!derived.includes(k));
   const placement={type:"object",properties:{item:{type:"integer"},target:{type:"integer"},relation:{type:"string",enum:E.REFERENCE.STAGING.RELATIONS},x:{type:"number"},y:{type:"number"},gap:{type:"number"},rotation:{type:"number"}},required:["item","target","relation","x","y","gap","rotation"]},rows={type:"array",maxItems:mode==="compose"?6:3,items:placement};
   if(mode==="compose"){
    delete schema.properties.formats;schema.required=schema.required.filter(k=>k!=="formats");
    const views={type:"array",minItems:3,maxItems:3,items:{type:"object",properties:{principle:{type:"string"},placements:rows},required:["principle","placements"]}};
    schema.properties.staging={type:"object",properties:Object.fromEntries(VIEW.OUTPUTS.map(key=>[key,views])),required:VIEW.OUTPUTS};schema.properties.backdrop={type:"string",enum:["keep","details","table"]};schema.required.push("staging","backdrop");
   }else{schema.properties.environmentLayout=rows;schema.required.push("environmentLayout")}
  }
 }
 return schema;
}
function validatePlan(plan,scene,data,E,{mode="compose"}={}){
 const native=scene.sizing==="native",environment=mode==="environment";
 const fail=message=>{throw new Error("План Gemini не принят: "+message)};
 if(!plan||typeof plan!=="object"||Array.isArray(plan)||Object.keys(plan).some(k=>![...KEYS,"compositions","layers","groups","formats","staging","backdrop","environmentLayout"].includes(k))||KEYS.some(k=>!(k in plan)))fail("неверный формат ответа");
 if(plan.formats!==undefined){
  const formats=plan.formats;
  if(!native||environment||!formats||typeof formats!=="object"||Array.isArray(formats)||Object.keys(formats).length!==3||VIEW.OUTPUTS.some(key=>!formats[key]))fail("нужны компоновки трёх форматов");
  for(const f of Object.values(formats))if(!f||Object.keys(f).length!==4||!E.REFERENCE.FLOWS.includes(f.flow)||!E.REFERENCE.ANCHORS.includes(f.anchor)||!E.REFERENCE.SIDES.includes(f.background)||typeof f.principle!=="string"||!f.principle.trim()||f.principle.length>320)fail("неверная компоновка формата");
 }
 if(plan.compositions!==undefined){
  if(!Array.isArray(plan.compositions)||plan.compositions.length!==3)fail("нужно три варианта композиции");
  const strategies=["balanced","spacious","diagonal"];
  plan.compositions.forEach((v,index)=>{if(v?.placement!==undefined&&!E.REFERENCE.PLACEMENTS.includes(v.placement))fail("неизвестное расположение группы");if(!v||v.strategy!==strategies[index]||typeof v.title!=="string"||!v.title.trim()||v.title.length>100||typeof v.principle!=="string"||!v.principle.trim()||v.principle.length>320||Object.keys(v).some(k=>!["strategy","title","principle","placement"].includes(k)))fail("неверный принцип построения")});
 }
 if(plan.version!==1||!["ready","unavailable"].includes(plan.status))fail("неверная версия или статус");
 if(typeof plan.title!=="string"||!plan.title.trim()||plan.title.length>100)fail("неверное название");
 for(const key of ["explanation","limitations"]){
  if(!Array.isArray(plan[key])||plan[key].length>3||(key==="explanation"&&!plan[key].length)||plan[key].some(t=>typeof t!=="string"||!t.trim()||t.length>240))fail("неверное объяснение");
 }
 if(plan.layout!==scene.layout)fail("изменена выбранная раскладка");
 if(!["auto",...E.RULES.recipes.map(r=>r.id)].includes(plan.recipe))fail("неизвестный сценарий");
 if(!Array.isArray(plan.items)||plan.items.length>(environment?32:6))fail("неверное число предметов");
 const ids=new Set(data.manifest.assets.map(a=>a.id)),counts={};
 for(const item of plan.items){
  if(!item||typeof item!=="object"||Array.isArray(item)||Object.keys(item).some(k=>!["assetId","role",...(native?["zone","crop"]:[])].includes(k))||!ids.has(item.assetId)||!["main","background"].includes(item.role))fail("неизвестный предмет или роль");
  if(item.zone!==undefined&&!E.REFERENCE.ZONES.includes(item.zone)||item.crop!==undefined&&!["whole","fragment"].includes(item.crop))fail("неверное окружение");
  counts[item.assetId]=(counts[item.assetId]||0)+1;if(!environment&&counts[item.assetId]>3)fail("слишком много повторов");
 }
 for(const [id,count]of Object.entries(counts))if(count>requestedCount(scene,id,E,{mode}))fail("повтор предмета без явного запроса количества: "+id);
 try{
  if(plan.backdrop!==undefined&&(!native||environment||!["keep","details","table"].includes(plan.backdrop)))fail("неверный рисунок фона");
  if(plan.staging!==undefined){if(!native||environment)fail("неверный режим плана размещения");E.REFERENCE.STAGING.validateBanks(plan.staging,plan.items)}
  if(plan.environmentLayout!==undefined){if(!native||!environment)fail("неверный режим окружения");E.REFERENCE.STAGING.validateRows(plan.environmentLayout,plan.items,{indices:true,backgroundOnly:true})}
 }catch(error){fail(error.message)}
 if(plan.groups!==undefined){
  if(!Array.isArray(plan.groups)||plan.groups.length>8)fail("неверные смысловые группы");
  for(const g of plan.groups)if(!g||Object.keys(g).some(k=>!["kind","members","reason"].includes(k))||!E.REFERENCE.KINDS.includes(g.kind)||!Array.isArray(g.members)||g.members.length<2||g.members.length>6||new Set(g.members).size!==g.members.length||g.members.some(i=>!Number.isInteger(i)||i<0||i>=plan.items.length)||typeof g.reason!=="string"||!g.reason.trim()||g.reason.length>240)fail("неверная смысловая группа");
 }
 if(plan.layers!==undefined){
  if(!Array.isArray(plan.layers)||plan.layers.length>64)fail("неверные смысловые слои");
  if(plan.status==="ready"&&plan.items.length>1&&!plan.layers.length)fail("не задан смысловой порядок слоёв");
  const seen=new Set();
  for(const r of plan.layers){
   if(!r||Object.keys(r).some(k=>!["back","front","reason"].includes(k))||![r.back,r.front].every(i=>Number.isInteger(i)&&i>=0&&i<plan.items.length)||r.back===r.front||typeof r.reason!=="string"||!r.reason.trim()||r.reason.length>240)fail("неверная связь слоёв");
   const key=r.back+":"+r.front;if(seen.has(key))fail("повтор связи слоёв");seen.add(key);
  }
  try{E.orderLayers({sizing:scene.sizing,items:plan.items.map((i,index)=>({...i,uid:"iplan"+index})),layerRelations:plan.layers.map(r=>({...r,back:"iplan"+r.back,front:"iplan"+r.front}))},{strict:true})}catch{fail("смысловые слои противоречат правилам глубины")}
 }
 if(plan.status==="unavailable"){
  if(plan.items.length||plan.focus!=="none")fail("недоступная сцена содержит предметы");
 }else{
  const main=plan.items.filter(i=>i.role==="main"),background=plan.items.filter(i=>i.role==="background");
  if(!main.length||!environment&&!main.some(i=>i.assetId===plan.focus))fail("акцент не является главным предметом");
  const allowBackgrounds=allows(scene,E);
  if(!allowBackgrounds&&background.length)fail("фоновые предметы запрещены в запросе");
  if(!native&&allowBackgrounds&&scene.framing==="focus"&&main.length!==1)fail("акцентный кадр требует одного главного предмета");
  if((native||scene.framing!=="focus")&&background.length>(native?3:2))fail("слишком много фоновых предметов");
  if(environment){
   const signature=items=>items.filter(i=>i.role==="main").map(i=>i.assetId).sort().join("|");
   if(signature(plan.items)!==signature(scene.items))fail("окружение изменяет главную группу");
  }
  const excluded=E.pick(scene.query,data,{supporting:false}).excluded,envExcluded=E.pick(scene.environmentPrompt||"",data,{supporting:false}).excluded;
  if(plan.items.some(i=>(!environment&&excluded.includes(i.assetId))||i.role==="background"&&(excluded.includes(i.assetId)||envExcluded.includes(i.assetId))))fail("добавлен исключённый предмет");
  if(native&&allowBackgrounds&&!background.length&&main.length<(environment?32:6)&&data.manifest.assets.some(a=>!counts[a.id]&&!excluded.includes(a.id)&&!envExcluded.includes(a.id)))fail("нужен хотя бы один фоновый предмет-компаньон");
 }
 return JSON.parse(JSON.stringify(plan));
}
function hydrateVisualPlan(input,scene,E,{mode="compose",data}={}){
 const plan=JSON.parse(JSON.stringify(input)),rows=mode==='compose'?plan.staging?.[scene.format]?.[0]?.placements||plan.staging?.square?.[0]?.placements:plan.environmentLayout;
 if(!Array.isArray(plan.items)||!Array.isArray(rows))return plan;
 const corrections=new Set(),name=id=>data?.manifest.assets.find(a=>a.id===id)?.name||id;
 const lists=mode==='compose'?Object.values(plan.staging||{}).flatMap(views=>Array.isArray(views)?views.map(v=>v.placements):[]):[rows];
 for(const list of lists)if(Array.isArray(list))for(const p of list){
  if(!p||!plan.items[p.item])continue;const item=plan.items[p.item],target=plan.items[p.target];
  if(p.relation==='on'&&target&&!E.REFERENCE.PHYSICS.allowed(target,item)){
   p.relation='right';p.x=.75;p.y=.5;p.gap=.03;
   corrections.add('«'+name(item.assetId)+'» размещён рядом с «'+name(target.assetId)+'»: реестр не разрешает эту опору.');
  }else if(p.relation==='on'&&[p.x,p.y].every(n=>Number.isFinite(n)&&n>=-.1&&n<=1.1)&&(p.x<0||p.x>1||p.y<0||p.y>1)){
   p.x=Math.max(0,Math.min(1,p.x));p.y=Math.max(0,Math.min(1,p.y));corrections.add('Опорная точка «'+name(item.assetId)+'» приведена к границам поверхности.');
  }
 }
 if(corrections.size)plan.limitations=[...(plan.limitations||[]).slice(0,Math.max(0,3-corrections.size)),...corrections].slice(0,3);
 plan.recipe='auto';plan.groups=[];plan.layers=[];
 const add=(back,front,reason)=>{if(back!==front&&!plan.layers.some(r=>r.back===back&&r.front===front))plan.layers.push({back,front,reason})};
 for(const p of rows)if(p.relation==='on')add(p.target,p.item,'Предмет лежит на допустимой опоре.');
 const mains=plan.items.map((i,index)=>i.role==='main'?index:-1).filter(i=>i>=0);
 for(const [index,item]of plan.items.entries())if(item.role==='background'&&!rows.some(r=>r.item===index&&r.relation==='on'))if(mains.length)add(index,mains[0],'Фоновый компаньон находится позади главной группы.');
 if(!plan.layers.length&&plan.items.length>1)add(0,1,'Порядок самостоятельных предметов.');
 plan.compositions=VIEW.DEFAULTS.map((d,index)=>({...d,principle:mode==='compose'?plan.staging?.square?.[index]?.principle||d.principle:d.principle}));
 delete plan.formats;return plan;
}
function applyPlan(plan,scene,data,E){
 const clean=validatePlan(plan,scene,data,E);if(clean.status!=="ready")return null;
 const manual=scene.focus!=="auto"&&clean.items.some(i=>i.assetId===scene.focus&&i.role==="main");
 const next=E.createScene({...scene,stagingPlans:undefined,executionNotes:undefined,supporting:allows(scene,E),environmentExplanation:clean.explanation,groups:[],formatPlans:Object.entries(clean.staging?{}:clean.formats||{}).map(([format,p])=>({format,...p})),recipe:clean.recipe,layout:clean.layout,focus:manual?scene.focus:clean.focus,layerRelations:[],items:clean.items.map(i=>({...i,uid:E.uid(),x:0,y:0,rotation:0,flipX:false,flipY:false}))});
 next.groups=(clean.groups||[]).map(g=>({...g,members:g.members.map(i=>next.items[i].uid)}));
 next.layerRelations=(clean.layers||[]).map(r=>({back:next.items[r.back].uid,front:next.items[r.front].uid,reason:r.reason}));
 if(clean.staging)next.stagingPlans=E.REFERENCE.STAGING.fromBanks(clean.staging,next.items);
 if(scene.backgroundDesign==="auto"&&clean.backdrop&&clean.backdrop!=="keep")next.backgroundDesign=clean.backdrop;
 const arranged=E.validateScene(E.arrange(next,data,{variation:0,placement:clean.compositions?.[0]?.placement}),data);arranged.composition={index:0,options:plan.compositions||VIEW.DEFAULTS.map(i=>({...i}))};return arranged;
}
function applyEnvironment(plan,scene,data,E){
 const clean=validatePlan(plan,scene,data,E,{mode:"environment"});if(clean.status!=="ready")return null;
 const next=E.clone(scene),mains=next.items.filter(i=>i.role==="main"),used=new Set(),planItems=[];
 for(const item of clean.items){
  if(item.role==="main"){
   const existing=mains.find(i=>!used.has(i.uid)&&i.assetId===item.assetId);used.add(existing.uid);planItems.push(existing);
  }else{
   const existing=scene.items.find(i=>i.role==="background"&&i.assetId===item.assetId&&!used.has(i.uid));if(existing)used.add(existing.uid);
   planItems.push({...item,uid:existing?.uid||E.uid(),x:existing?.x||0,y:existing?.y||0,rotation:0,flipX:false,flipY:false});
  }
 }
 next.items=[...planItems.filter(i=>i.role==="background"),...mains];
 next.layerRelations=(scene.layerRelations||[]).filter(r=>mains.some(i=>i.uid===r.back)&&mains.some(i=>i.uid===r.front));
 for(const r of clean.layers||[]){const back=planItems[r.back],front=planItems[r.front];if(back.role==="background"||front.role==="background")next.layerRelations.push({back:back.uid,front:front.uid,reason:r.reason})}
 for(let i=1;i<mains.length;i++)next.layerRelations.push({back:mains[i-1].uid,front:mains[i].uid,reason:"Сохранён порядок главной группы."});
 next.environmentExplanation=clean.explanation;
 let arranged;
 if(clean.environmentLayout){const placements=clean.environmentLayout.map(p=>({uid:planItems[p.item].uid,relation:p.relation,...(p.target>=0?{targetUid:planItems[p.target].uid}:{}),x:p.x,y:p.y,gap:p.gap,rotation:p.rotation}));arranged=E.REFERENCE.STAGING.execute(next,data,E,{placements},{lockedMain:true})}
 else arranged=E.REFERENCE.environment(next,data,E);
 E.orderLayers(arranged,{strict:true});return E.validateScene(arranged,data);
}
function brief(query,scene,data,E,{mode="compose"}={}){
 return {mode,outputs:mode==="compose"&&scene.sizing==="native"?VIEW.OUTPUTS.map(id=>{const f=E.FORMATS.find(f=>f.id===id);return {format:id,width:f.width,height:f.height}}):[],query,environmentRequest:scene.environmentPrompt||"",settings:{format:scene.format,width:scene.width,height:scene.height,size:scene.size,sizing:scene.sizing,palette:scene.palette,backgroundDesign:scene.backgroundDesign,layout:scene.layout,framing:scene.framing,backgroundsAllowed:allows(scene,E),backgroundCompanions:{minimum:scene.sizing==="native"&&allows(scene,E)?1:0,preferred:allows(scene,E)?1:0,maximum:allows(scene,E)?(scene.sizing==="native"?3:2):0},focus:scene.focus},lockedMain:mode==="environment"?scene.items.filter(i=>i.role==="main").map(({assetId,role,hidden,x,y,rotation,flipX,flipY,uid})=>({assetId,role,uid,hidden:!!hidden,x,y,rotation,flipX,flipY})):[],catalog:data.manifest.assets.map(({id,name,description,tags,variants})=>({assetId:id,name,description,tags,semantic:SEMANTICS[id],maxInstances:requestedCount(scene,id,E,{mode}),physicalClass:E.RULES.registry.physicalClass(id),optical:E.RULES.registry.protectedRegions[id].optical,protectedRegion:E.RULES.registry.protectedRegions[id].rect,allowedOn:E.RULES.contacts.filter(r=>r.reviewed&&r.front===id).map(r=>({base:r.back,anchors:r.anchors.map(([x,y])=>[x+.5,y+.5])})),presentations:Object.fromEntries(["main","background"].map(role=>[role,{width:variants[scene.size][role].nativeWidth,height:variants[scene.size][role].nativeHeight}])),nativeSize:{width:variants[scene.size].main.nativeWidth,height:variants[scene.size].main.nativeHeight}})),recipes:E.RULES.recipes.map(({id,name,description,main,support})=>({id,name,description,main,support})),spatialRules:{physicalGroups:E.RULES.registry.physicalGroups,nativeScale:"1:1; ни общий, ни индивидуальный масштаб и zoom не меняются",groups:"reading: книга и освещающая её лампа — лампа слева; writing: книга/папка и ручка; collection: самостоятельные предметы, лампа может быть справа. Сначала определи смысловые связи, даже если предметов много.",layouts:{compact:"Связная группа, опоры и обрезка краями кадра",offset:"Меняются взаимные стороны предметов внутри группы; функциональные связи сохраняются",headline:"Группа справа; левые 43% свободны под заголовок"},environment:"Монохромные фрагменты у края. Их не требуется показывать целиком. Не добавляй предметы только ради количества.",layerIndexing:"layers.back/front — индексы items с 0; back рисуется раньше front",supports:E.RULES.contacts.filter(r=>r.reviewed).map(r=>({base:r.back,child:r.front,text:r.text}))}};
}
function buildVariants(plan,scene,data,E){const initial=applyPlan(plan,scene,data,E);return initial?VIEW.variants(initial,data,E,plan.compositions):[]}
function buildCollection(plan,scene,data,E){const initial=applyPlan(plan,scene,data,E);return initial?VIEW.createCollection(initial,data,E):null}
return {backgroundsAllowed,allows,applyEnvironment,responseSchema,validatePlan,hydrateVisualPlan,applyPlan,buildVariants,buildCollection,brief};
});
