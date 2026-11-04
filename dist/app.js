/* The editor uses the exact prepared SVGs. All state is browser-local. */
"use strict";
const E=CompositionEngine,V=CompositionView,DATA=STUDIO_DATA;
const PALETTE=CompositionPalette;
const API=CompositionAPI.create(globalThis.STUDIO_DEPLOYMENT),STATIC_DEMO=API.mode==="static";
const $=id=>document.getElementById(id);
const SETTINGS_TABS=["scene","object"];
function activateSettings(name,{focus=false}={}){
 for(const key of SETTINGS_TABS){
  const active=key===name,tab=$("tab-"+key);
  tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1;
  $("panel-"+key).hidden=!active;
 }
 document.querySelector(".settings-body").scrollTop=0;
 if(focus)$("tab-"+name).focus({preventScroll:true});
}
for(const name of SETTINGS_TABS){
 const tab=$("tab-"+name);
 tab.addEventListener("click",()=>activateSettings(name));
 tab.addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  const index=SETTINGS_TABS.indexOf(name),count=SETTINGS_TABS.length,target=event.key==="Home"?0:event.key==="End"?count-1:(index+(event.key==="ArrowRight"?1:count-1))%count;
  activateSettings(SETTINGS_TABS[target],{focus:true});
 });
}

const ICONS={"grid":"<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/>","download":"<path d=\"M12 3v12m-4-4 4 4 4-4\"/><path d=\"M4 16v4h16v-4\"/>","undo":"<path d=\"m8 4-5 5 5 5\"/><path d=\"M3 9h10a7 7 0 0 1 0 14\"/>","redo":"<path d=\"m16 4 5 5-5 5\"/><path d=\"M21 9H11a7 7 0 0 0 0 14\"/>","plus":"<path d=\"M12 5v14M5 12h14\"/>","copy":"<rect x=\"8\" y=\"8\" width=\"12\" height=\"13\" rx=\"2\"/><path d=\"M16 8V3H3v13h5\"/>","trash":"<path d=\"M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7\"/>","up":"<path d=\"m6 14 6-6 6 6\"/>","down":"<path d=\"m6 10 6 6 6-6\"/>","rotate":"<path d=\"M3 10a9 9 0 1 1 2 9M3 3v7h7\"/>","search":"<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"m16 16 5 5\"/>","layers":"<path d=\"m12 3 10 6-10 6L2 9 12 3Zm-9 11 9 5 9-5m-18 5 9 5 9-5\"/>","file":"<path d=\"M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 16h6\"/>","upload":"<path d=\"M12 17V3m-4 4 4-4 4 4M4 16v5h16v-5\"/>","close":"<path d=\"m6 6 12 12M6 18 18 6\"/>","arrow":"<path d=\"M4 12h16m-6-6 6 6-6 6\"/>","check":"<path d=\"m5 12 4 4L19 6\"/>"};
const icon=name=>'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[name]+'</svg>';
const STORAGE_KEY="svg-composition-studio-v1";
const LAYOUT_STORAGE_KEY="svg-composition-layouts-v1";
let scene,selected=null,past=[],future=[],showGuide=true,drag=null,rotationSession=null,numericSession=null,toastTimer=null;
let recognition=null;
const CUSTOM_PALETTE_KEY="svg-composition-custom-palette-v1";let importedPalette=null;
try{const saved=localStorage.getItem(CUSTOM_PALETTE_KEY);if(saved)importedPalette=PALETTE.normalize(JSON.parse(saved))}catch{}
let composeMode=STATIC_DEMO?"keywords":"gemini",aiConnected=false,aiController=null,aiSequence=0;
let variantMemory=null,migratedSizing=false,sceneRevision=0;
let savedLayouts=Object.create(null);
try{const stored=JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY)||"{}");if(stored&&typeof stored==="object"&&!Array.isArray(stored)&&Object.keys(stored).length<=24)savedLayouts=Object.assign(Object.create(null),stored)}catch{}
function nativeScene(input){
 const old=E.validateScene(input,DATA);if(old.sizing==="native")return old;
 migratedSizing=true;const format=E.FORMATS.find(f=>f.id===old.format&&f.width===old.width&&f.height===old.height);
 return E.validateScene({...old,sizing:"native",format:format?format.id:"custom",scale:1,camera:old.camera?{scale:1,x:0,y:0}:null},DATA);
}
function nativeMemory(input){
 const migrated=input.version===2?{...input,formats:Object.fromEntries(Object.entries(input.formats).map(([key,bank])=>[key,bank.map(nativeScene)]))}:{...input,scenes:input.scenes.map(nativeScene)};
 const memory=V.validateMemory(migrated,DATA,E);return V.upgradeMemory(V.current(memory),DATA,E,memory);
}
try{
 const saved=localStorage.getItem(STORAGE_KEY);
 if(saved){
  const stored=JSON.parse(saved);
  if(stored.type==="composition-project"){
   variantMemory=stored.memory?nativeMemory(stored.memory):null;
   scene=variantMemory?E.clone(V.current(variantMemory)):nativeScene(stored.scene);
  }else scene=nativeScene(stored);
  if(migratedSizing&&!localStorage.getItem(STORAGE_KEY+"-before-native"))localStorage.setItem(STORAGE_KEY+"-before-native",saved);
 }
}catch{}
if(!scene){const initial=E.generate("Любит писать",E.createScene(),DATA);scene=initial.scene;recognition=initial.result}
function refreshCompositionCopy(value){
 if(!value.composition||value.sizing!=="native")return value;
 const current=value.composition.options[value.composition.index],words=E.tokenize(current.principle),ids=new Set(value.items.map(i=>i.assetId));
 const missing=Object.keys(E.DIRECT).some(id=>!ids.has(id)&&words.some(word=>E.DIRECT[id].some(stem=>word.startsWith(E.normalize(stem)))));
 if(!missing)return value;
 const next=E.clone(value),mainIds=new Set(next.items.filter(i=>i.role==="main").map(i=>i.uid));
 const group=(next.groups||[]).find(g=>g.members.every(uid=>mainIds.has(uid)));
 const background=next.items.filter(i=>i.role==="background").map(i=>asset(i.assetId).name.toLocaleLowerCase("ru"));
 next.composition.options[next.composition.index].principle=((group?.reason||"Главная группа сохраняет выбранное положение.")+" "+(background.length?"Окружение: "+background.join(", ")+".":"Без фоновых предметов.")).slice(0,320);
 return next;
}
scene=refreshCompositionCopy(scene);
variantMemory=V.upgradeMemory(scene,DATA,E,variantMemory);scene=E.clone(V.current(variantMemory));
function notify(message){
 $("toast").textContent=message;$("toast").hidden=false;clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>$("toast").hidden=true,3600);
}
function projectSnapshot(){
 const memory=variantMemory?V.remember(variantMemory,scene,DATA,E):null;
 return {type:"composition-project",version:2,scene:E.validateScene(scene,DATA),memory};
}
function saveLocal({syncPlacement=false}={}){
 sceneRevision++;
 if(syncPlacement&&variantMemory)variantMemory=V.syncPlacement(variantMemory,scene,DATA,E);
 if(variantMemory){variantMemory=V.remember(variantMemory,scene,DATA,E);scene=E.clone(V.current(variantMemory))}
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(projectSnapshot()))}catch{}
}
function persistLayouts(){
 try{localStorage.setItem(LAYOUT_STORAGE_KEY,JSON.stringify(savedLayouts));return true}catch{return false}
}
function useSavedLayout(next){
 const key=E.templateKey(next),legacyKey=E.templateKey(next,{legacy:true}),template=savedLayouts[key]||(next.framing==="overview"?savedLayouts[legacyKey]:null);
 if(!template||next.sizing==="native"&&template.sizing!=="native")return next;
 try{const applied=E.applyTemplate(next,template,DATA);if(template.rulesVersion!==E.RULES.version||template.key!==key){savedLayouts[key]=E.captureTemplate(applied,DATA);delete savedLayouts[legacyKey];persistLayouts()}return applied}catch{delete savedLayouts[key];persistLayouts();notify("Сохранённая раскладка повреждена. Использованы опорные позиции.");return next}
}
function deselect(){flushNumericEdit();selected=null;activateSettings("scene");renderCanvas();renderLayers();renderSelection()}
function record(before){
 const memory=variantMemory?V.remember(variantMemory,before,DATA,E):null;
 past.push({scene:E.clone(before),memory});if(past.length>60)past.shift();future=[];
}
function constrainEdit(before,next,uid){
 if(next.sizing!=="native"||!E.layoutIssues(next,DATA).length)return next;
 try{return E.REFERENCE.PHYSICS.constrain(next,DATA,E,{movable:uid?[...E.attachedGroup(before,DATA,uid)]:null})}catch(error){notify(error.message);return E.clone(before)}
}
function commit(next,{message=null,select=selected,history=true,memory=undefined,variants=undefined,collection=undefined,syncPlacement=false,appearanceOnly=false}={}){
 flushNumericEdit();
 try{
  next=refreshCompositionCopy(E.validateScene(next,DATA));
  if(!appearanceOnly&&next.sizing==="native"&&E.layoutIssues(next,DATA).length)next=E.REFERENCE.PHYSICS.constrain(next,DATA,E,{movable:select?[...E.attachedGroup(next,DATA,select)]:null});
  let nextMemory=collection?V.validateMemory(collection,DATA,E):variants?V.upgradeMemory(next,DATA,E,V.createMemory(next,DATA,E,variants)):memory;
  if(nextMemory===undefined)nextMemory=variantMemory?V.remember(variantMemory,next,DATA,E):null;
  if(syncPlacement&&nextMemory&&JSON.stringify(next.items)!==JSON.stringify(scene.items))nextMemory=V.syncPlacement(nextMemory,next,DATA,E);
  if(nextMemory){nextMemory=V.remember(nextMemory,next,DATA,E);next=E.clone(V.current(nextMemory))}
  if(history)record(scene);
  variantMemory=nextMemory;scene=next;selected=scene.items.some(a=>a.uid===select)?select:null;
  saveLocal();renderAll();if(message)notify(message);
 }catch(error){notify(error.message)}
}
function asset(id){return DATA.manifest.assets.find(a=>a.id===id)}
function selectedItem(){return scene.items.find(a=>a.uid===selected)}
function thumb(id,role="main",prefix="preview"){
 const v=E.variant(DATA,id,scene.size,role),p=E.paletteFor(scene,DATA);
 return E.uniqueSvg(E.recolor(DATA.svgs[v.path],p,role),prefix+"-"+id);
}
function renderLibrary(){
 const q=E.normalize($("library-search").value);
 const items=DATA.manifest.assets.filter(a=>E.normalize([a.name,a.id,...a.tags].join(" ")).includes(q));
 $("library-grid").innerHTML=items.length?items.map(a=>'<button class="asset-button" data-add="'+a.id+'" aria-label="Добавить: '+E.escapeXml(a.name)+'"><span class="asset-add">'+icon("plus")+'</span><span class="asset-picture">'+thumb(a.id,"main","library")+'</span><span class="asset-name">'+E.escapeXml(a.name)+'</span></button>').join(""):'<p class="library-empty">Предметов не найдено. Попробуйте «книга» или «свет».</p>';
}
function selectionMarkup(){
 const item=selectedItem();if(!item||item.hidden||!showGuide||(item.role==="background"&&scene.showSupporting===false))return "";
 const v=E.variant(DATA,item.assetId,scene.size,item.role),w=v.nativeWidth*scene.scale,h=v.nativeHeight*scene.scale;
 const handles=[[-w/2,-h/2],[w/2,-h/2],[-w/2,h/2],[w/2,h/2]].map(([x,y])=>'<circle class="selection-handle" cx="'+x+'" cy="'+y+'" r="'+(3*scene.width/Math.max(300,$("artboard").clientWidth))+'"/>').join("");
 return '<g aria-hidden="true" transform="'+V.transform(scene)+'"><g transform="translate('+item.x+' '+item.y+') rotate('+item.rotation+')"><rect class="selection-outline" x="'+(-w/2)+'" y="'+(-h/2)+'" width="'+w+'" height="'+h+'"/>'+handles+'</g></g>';
}
function renderCanvas(){
 const svg=$("artboard"),wrap=$("artboard-wrap");
 svg.setAttribute("viewBox","0 0 "+scene.width+" "+scene.height);
 wrap.style.aspectRatio=scene.width+" / "+scene.height;
 wrap.style.width=innerWidth>760?"min(100%, "+(Math.max(200,innerHeight-200)*scene.width/scene.height)+"px)":"100%";
 let guide="";
 if(scene.layout==="headline"&&showGuide){
  guide='<g aria-hidden="true"><rect class="headline-guide" x="'+scene.width*.055+'" y="'+scene.height*.18+'" width="'+scene.width*.36+'" height="'+scene.height*.64+'"/><text class="headline-guide-label" x="'+scene.width*.08+'" y="'+scene.height*.25+'">Место для заголовка</text></g>';
 }
 svg.innerHTML=E.sceneMarkup(scene,DATA)+guide+selectionMarkup();
 $("empty-canvas").hidden=E.visibleItems(scene).length>0;
 $("canvas-dimensions").textContent=scene.width+" × "+scene.height;
 $("canvas-note").textContent="SVG · "+scene.size+" · 1:1";
 $("toggle-guide").setAttribute("aria-pressed",String(showGuide));
 $("toggle-guide").textContent=showGuide?"Скрыть границы":"Показать границы";
 const visible=E.visibleItems(scene),main=visible.filter(i=>i.role==="main").length,bg=visible.length-main,hidden=scene.items.length-visible.length;
 $("scene-summary").textContent=scene.items.length?"Главных: "+main+" · Фоновых: "+bg+(hidden?" · Скрыто: "+hidden:""):"Пока без предметов";
 $("export").disabled=!E.visibleItems(scene).length;
}
function renderLayers(){
 const relations=scene.layerRelations||[];
 $("semantic-layers").hidden=!relations.length;
 $("semantic-layer-reasons").replaceChildren(...relations.map(r=>{
  const back=scene.items.find(i=>i.uid===r.back),front=scene.items.find(i=>i.uid===r.front),li=document.createElement("li");
  const manual=scene.items.indexOf(back)>scene.items.indexOf(front),overridden=E.layerPlan(scene).ignored.some(link=>link.back===r.back&&link.front===r.front);
  li.textContent=asset(back.assetId).name+" → "+asset(front.assetId).name+": "+r.reason+(overridden?" Приоритет у связи с опорой.":manual?" Порядок изменён вручную.":"");return li;
 }));
 $("layer-count").textContent=scene.items.length;
 const eye='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
 $("layer-list").innerHTML=[...scene.items].reverse().map((item,n)=>{const visible=item.hidden!==true&&(scene.showSupporting!==false||item.role!=="background"),name=E.escapeXml(asset(item.assetId).name);return '<li class="layer-row"><button class="layer-visibility" data-visibility="'+item.uid+'" aria-label="'+(visible?'Скрыть':'Показать')+': '+name+'" aria-pressed="'+visible+'">'+eye+'</button><button class="layer-item" data-select="'+item.uid+'" aria-pressed="'+(item.uid===selected)+'"><span class="layer-thumb">'+thumb(item.assetId,item.role,"layer-"+item.uid)+'</span><span class="layer-label"><span class="layer-name">'+name+'</span><span class="layer-role">'+(item.role==="main"?'Главный':'Фоновый')+(visible?'':' · скрыт')+'</span></span></button><span class="layer-order"><button data-order="'+item.uid+'" data-direction="1" aria-label="Поднять: '+name+'" '+(n===0?'disabled':'')+'>'+icon('up')+'</button><button data-order="'+item.uid+'" data-direction="-1" aria-label="Опустить: '+name+'" '+(n===scene.items.length-1?'disabled':'')+'>'+icon('down')+'</button></span></li>'}).join("");
}
function renderSelection(){
 const item=selectedItem();
 $("selection-empty").hidden=Boolean(item);$("selection-controls").hidden=!item;
 if(!item)return;
 $("selection-name").textContent=asset(item.assetId).name;
 $("role-control").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.value===item.role)));
 if(document.activeElement!==$("rotation"))$("rotation").value=Math.round(item.rotation);
 $("rotation-range").value=Math.round(item.rotation);
 for(const [id,key] of [["flip-x","flipX"],["flip-y","flipY"]])$(id).setAttribute("aria-pressed",String(item[key]===true));
 const index=scene.items.indexOf(item);
 $("layer-up").disabled=index===scene.items.length-1;$("layer-down").disabled=index===0;
 for(const [id,key,length]of [["position-x","x",scene.width],["position-y","y",scene.height]]){
  const field=$(id);field.min=-length;field.max=length*2;if(document.activeElement!==field)field.value=Math.round(item[key]);
 }
}
function renderSceneInfo(){
 $("format-principle").textContent=E.REFERENCE.planFor(scene).principle;
 $("format-options").querySelectorAll("[data-format]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.format===scene.format)));
 $("native-canvas").textContent="Холст под набор "+scene.size+" · "+(scene.size==="S"?500:1000)+" × "+(scene.size==="S"?500:1000);
 const description=E.sceneDescription(scene,DATA),hasSaved=Boolean(savedLayouts[E.templateKey(scene)]);
 $("scene-context").textContent=scene.items.length?description.name:"Новая композиция";
 $("scene-context").dataset.recipe=E.recipeFor(scene).id;
 $("scene-reason").textContent=scene.items.length?description.text:"Выберите предметы или введите тему. Их положение можно будет настроить и запомнить.";
 $("remember-layout").disabled=!scene.items.length;
 $("remember-layout").textContent=hasSaved?"Обновить раскладку":"Запомнить раскладку";
 $("forget-layout").hidden=!hasSaved;$("saved-layout-status").hidden=!hasSaved;
}
function renderPalette(){
 applyTheme();
 const custom=scene.customPalette||importedPalette,palettes=[...DATA.palettes.palettes,...(custom?[custom]:[])];
 $("palette-options").innerHTML=palettes.map(p=>'<button class="palette-option" data-palette="'+p.id+'" title="'+E.escapeXml(p.name)+'" aria-label="'+E.escapeXml(p.name)+'" aria-pressed="'+(p.id===scene.palette)+'"><span class="palette-swatch" style="background:linear-gradient(135deg,'+p.slots["background.base"]+' 0 50%,'+p.slots["object.secondary"]+' 50% 75%,'+p.slots["object.primary"]+' 75%)"></span></button>').join("");
 const current=E.paletteFor(scene,DATA);
 document.querySelector(".palette-note").textContent=current.name+(scene.palette==="custom"?" · своя схема":" · из исходных макетов");
 $("custom-palette-controls").hidden=scene.palette!=="custom";
 if(scene.palette==="custom")$("custom-palette-colors").replaceChildren(...PALETTE.ROLES.map(([id,label])=>{const row=document.createElement('label'),input=document.createElement('input'),title=document.createElement('span'),value=document.createElement('span');row.className='palette-color-row';input.type='color';input.value=current.slots[id];input.dataset.colorSlot=id;input.setAttribute('aria-label',label);title.textContent=label;value.textContent=current.slots[id];value.className='palette-hex';row.append(input,title,value);return row}));
}
function applyTheme(){
 const p=scene.palette==="custom"?DATA.palettes.palettes.find(p=>p.id==="aqua"):E.paletteFor(scene,DATA),slots=p.slots,root=document.documentElement;
 const mix=(a,b,t)=>"#"+[0,2,4].map(i=>Math.round(parseInt(a.slice(i+1,i+3),16)*(1-t)+parseInt(b.slice(i+1,i+3),16)*t).toString(16).padStart(2,"0")).join("");
 const base=slots["background.base"],dark=slots["background.dark"],ink=slots.ink;
 const tokens={ink,muted:mix(ink,base,.32),surface:mix("#FFFFFF",base,.07),chrome:mix("#FFFFFF",base,.23),line:mix("#FFFFFF",base,.78),accent:slots["object.primary"],"accent-strong":ink,hover:mix("#FFFFFF",base,.45),focus:ink,workspace:mix("#FFFFFF",base,.43),toolbar:mix("#FFFFFF",base,.16),selected:mix("#FFFFFF",base,.7),"selected-line":dark,primary:dark,"primary-text":p.id==="lavender"?"#FFFFFF":ink,"brand-accent":slots["object.secondary"],"brand-base":base};
 for(const [name,value]of Object.entries(tokens))root.style.setProperty("--"+name,value);
 root.dataset.palette=p.id;
 document.querySelector('meta[name="theme-color"]').content=tokens.chrome;
}
function renderBackdrop(){
 const design=E.backdropDesignFor(scene),pattern=scene.background==="pattern";
 $("backdrop-options").innerHTML=[["details","Точки и линии"],["table","Край стола"]].map(([id,name])=>{
  const preview={...scene,size:"S",width:500,height:320,background:"pattern",backgroundDesign:id};
  return '<button class="backdrop-option" data-backdrop="'+id+'" aria-pressed="'+(pattern&&design===id)+'"><svg viewBox="0 0 500 320" aria-hidden="true" focusable="false">'+E.uniqueSvg(E.backgroundMarkup(preview,DATA),'backdrop-preview-'+id)+'</svg><span>'+name+'</span></button>';
 }).join("");
}
function renderAll(){
 if(document.activeElement!==$("query"))$("query").value=scene.query;
 $("format").value=scene.format;$("background").value=scene.background;
 $("size-control").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.value===scene.size)));
 if(document.activeElement!==$("canvas-width"))$("canvas-width").value=scene.width;
 if(document.activeElement!==$("canvas-height"))$("canvas-height").value=scene.height;
 $("undo").disabled=!past.length;$("redo").disabled=!future.length;
 renderCanvas();renderPalette();renderBackdrop();renderLibrary();renderLayers();renderSelection();renderSceneInfo();
 if(recognition){
  $("match-status").dataset.error=String(!recognition.items.length);
  $("match-status").textContent=recognition.items.length
    ?(recognition.source==="gemini"?"Gemini выбрал: ":"Подобраны: ")+recognition.items.map(i=>asset(i.assetId).name.toLocaleLowerCase("ru")+(i.role==="background"?" — фон":"")).join(", ")+"."
    :"Не нашёл совпадений. Попробуйте названия предметов или примеры выше.";
 }else{$("match-status").textContent="";$("match-status").dataset.error="false"}
}
function composeKeywords(query){
 $("ai-stage").textContent="Подбор по словам: Gemini не вызывался.";$("ai-stage").dataset.error="false";$("ai-result").hidden=true;$("ai-json-details").hidden=true;
 try{
 const before={...scene,supporting:true};
 const result=E.generate(query,before,DATA,{variation:0});recognition=result.result;
 if(!result.scene){renderAll();$("query").value=query;notify("Нет совпадений. Попробуйте «книга», «лампа» или «финансы».");return}
 const initial=result.scene;initial.composition={index:0,options:V.DEFAULTS.map(i=>({...i}))};commit(useSavedLayout(initial),{select:null,collection:V.createCollection(initial,DATA,E)});
 }catch(error){
  $("match-status").dataset.error="true";$("match-status").textContent=error.message;notify(error.message);
 }
}
function aiBusy(busy){
 $("compose-submit").disabled=busy;$("compose-form").setAttribute("aria-busy",String(busy));$("ai-cancel").hidden=!busy;
 $("compose-label").textContent=busy?"Gemini подбирает…":composeMode==="gemini"?"Собрать с Gemini":"Собрать по словам";
 $("ai-debug").dataset.busy=String(busy);
}
function stopAI(message="Запрос остановлен. Текущая сцена сохранена."){
 if(!aiController)return;aiController.abort();aiController=null;aiSequence++;aiBusy(false);$("ai-stage").textContent=message;$("match-status").dataset.error="false";$("match-status").textContent=message;
}
function showAIResult(result){
 const p=result.plan;$("ai-result").hidden=false;$("ai-title").textContent=p.title;
 $("ai-explanation").replaceChildren(...p.explanation.map(text=>{const li=document.createElement("li");li.textContent=text;return li}));
 $("ai-limitations").hidden=!p.limitations.length;$("ai-limitations").textContent=p.limitations.join(" ");
 $("ai-meta").textContent=[result.model,result.vision?'Визуальный каталог и план размещения':null,typeof result.elapsedMs==="number"?(result.elapsedMs/1000).toLocaleString("ru",{maximumFractionDigits:1})+" с":null,result.usage?.totalTokenCount?result.usage.totalTokenCount+" токенов":null].filter(Boolean).join(" · ");
 $("ai-json-details").hidden=false;$("ai-json").textContent=JSON.stringify(p,null,2);
}
async function compose(query){
 stopAI();
 if(composeMode==="keywords"){composeKeywords(query);return}
 query=query.trim();if(!query){notify("Введите тему для иллюстрации.");$("query").focus();return}
 if(!aiConnected){$("match-status").dataset.error="true";$("match-status").textContent=STATIC_DEMO?"В этой демоверсии доступны подбор «По словам» и ручной редактор. Результаты Gemini можно посмотреть в отчётах в меню «Проект».":API.mode==="remote"?"Не удалось подключиться к серверу Gemini. Попробуйте позже или выберите «По словам».":"Для Gemini запустите проект командой npm start. Подбор «По словам» доступен без сервера.";return}
 flushNumericEdit();
 const mode="compose",revision=sceneRevision,before=JSON.stringify(scene),base={...E.clone(scene),query},id=++aiSequence;
 const controller=new AbortController();aiController=controller;aiBusy(true);
 $("ai-result").hidden=true;$("ai-json-details").hidden=true;$("ai-stage").dataset.error="false";
 $("ai-stage").textContent="Передаём тему и изображения ассетов. Gemini составляет план расположения…";
 $("match-status").dataset.error="false";$("match-status").textContent="Подбираем сцену с Gemini. Текущая композиция остаётся на холсте.";
 try{
  const response=await API.request("/api/compose",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,scene:base,mode}),signal:controller.signal});
  const result=await response.json();if(id!==aiSequence)return;
  if(!response.ok)throw new Error(result.error||"Не удалось получить план Gemini.");
  CompositionAI.validatePlan(result.plan,base,DATA,E,{mode});showAIResult(result);
  if(!result.scene||result.plan.status!=="ready"){
   $("ai-stage").textContent="В библиотеке недостаточно подходящих предметов. Текущая сцена сохранена.";
   $("match-status").dataset.error="true";$("match-status").textContent=result.plan.limitations.join(" ")||result.plan.title;return;
  }
  if(sceneRevision!==revision||JSON.stringify(scene)!==before||$("query").value.trim()!==query){
   $("ai-stage").textContent="План готов, но сцена уже изменилась. Нажмите «Собрать с Gemini», чтобы применить новый запрос.";return;
  }
  const next=E.validateScene(result.scene,DATA);if(next.query!==query)throw new Error("Получен ответ для другого запроса.");
  recognition={items:result.plan.items,source:"gemini"};
  commit(useSavedLayout(next),{select:null,collection:result.collection,variants:result.collection?undefined:result.variants});
  $("ai-stage").textContent="Композиция готова. Три формата доступны без новых запросов к ИИ.";
 }catch(error){
  if(id!==aiSequence||error.name==="AbortError")return;
  $("ai-stage").dataset.error="true";$("ai-stage").textContent=error.message;
  $("match-status").dataset.error="true";$("match-status").textContent=error.message+" Текущая сцена сохранена.";
 }finally{if(id===aiSequence){aiController=null;aiBusy(false)}}
}
$("canvas-size-form").addEventListener("submit",event=>{
 event.preventDefault();const width=Number($("canvas-width").value),height=Number($("canvas-height").value);
 if(![width,height].every(n=>Number.isInteger(n)&&n>=256&&n<=4096)){notify("Ширина и высота — целые числа от 256 до 4096.");return}
 resizeCanvas(width,height,"Размер холста изменён. Положение предметов и кадр сохранены.");
});
$("native-canvas").addEventListener("click",()=>{
 const side=scene.size==="S"?500:1000;
 resizeCanvas(side,side,"Холст под набор "+scene.size+". Положение предметов и кадр сохранены.");
});
function resizeCanvas(width,height,message){
 flushNumericEdit();
 try{commit(V.resizeCanvas(scene,width,height,DATA,E),{message})}catch(error){notify(error.message)}
}
$("ai-cancel").addEventListener("click",()=>{stopAI();$("match-status").textContent="Запрос остановлен. Можно изменить тему и повторить."});
$("query").addEventListener("input",()=>stopAI("Тема изменена. Предыдущий запрос остановлен."));
$("show-ai-debug").addEventListener("change",()=>{$("ai-debug").hidden=!$("show-ai-debug").checked});
$("compose-mode").addEventListener("click",event=>{
 const button=event.target.closest("[data-mode]");if(!button)return;stopAI();composeMode=button.dataset.mode;
 $("compose-mode").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===composeMode)));
 $("ai-connection").textContent=composeMode==="keywords"?"Без ИИ":aiConnected?"Gemini подключён":STATIC_DEMO?"Демоверсия":API.mode==="remote"?"Сервер недоступен":"Нужен npm start";aiBusy(false);
});
$("ai-prompt-details").addEventListener("toggle",async()=>{
 if(!$("ai-prompt-details").open||$("ai-prompt").dataset.loaded)return;
 if(STATIC_DEMO){$("ai-prompt").textContent=await(await fetch("composition-prompt.txt")).text();$("ai-prompt").dataset.loaded="true";return}
 try{const response=await API.request("/api/ai-prompt");if(!response.ok)throw new Error();const p=await response.json();$("ai-prompt").textContent=p.system+"\n\nФОРМАТ ОТВЕТА\n"+JSON.stringify(p.responseSchema,null,2)+"\n\nБИБЛИОТЕКА И ПРАВИЛА\n"+JSON.stringify(p.context,null,2);$("ai-prompt").dataset.loaded="true"}
 catch{$("ai-prompt").textContent="Промпт находится в prompts/composition-system.txt. Для просмотра здесь запустите npm start."}
});
async function checkAIConnection(){
 if(STATIC_DEMO){$("ai-connection").textContent="Без ИИ";$("compose-mode").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===composeMode)));aiBusy(false);return}
 try{const response=await API.request("/api/ai-status");const status=await response.json();aiConnected=response.ok&&status.configured===true}catch{aiConnected=false}
 $("ai-connection").textContent=composeMode==="keywords"?"Без ИИ":aiConnected?"Gemini подключён":API.mode==="remote"?"Сервер недоступен":"Нужен npm start";
}
checkAIConnection().then(renderSceneInfo);
$("format").innerHTML=E.FORMATS.map(f=>'<option value="'+f.id+'">'+f.name+' · '+f.width+' × '+f.height+'</option>').join("")+'<option value="custom">Свой размер</option>';
$("compose-form").addEventListener("submit",e=>{e.preventDefault();compose($("query").value)});
document.querySelector(".examples").addEventListener("click",e=>{const b=e.target.closest("[data-example]");if(!b)return;$("query").value=b.dataset.example;compose(b.dataset.example)});
$("library-search").addEventListener("input",renderLibrary);
$("library-grid").addEventListener("click",e=>{
 const b=e.target.closest("[data-add]");if(!b)return;
 if(scene.items.length>=32){notify("На холсте уже 32 предмета. Удалите один, чтобы добавить новый.");return}
 const item={uid:E.uid(),assetId:b.dataset.add,role:"main",x:scene.width*.5,y:scene.height*.5,rotation:0};
 const next=E.clone(scene);next.items.push(item);
 if(next.items.length===1){const arranged=E.arrange(next,DATA);commit(arranged,{select:item.uid})}
 else commit(next,{select:item.uid,message:"Предмет добавлен. Переместите его на холсте."});
 activateSettings("object");
});
function applyUserPalette(value){
 const palette=PALETTE.normalize(value);importedPalette=palette;
 try{localStorage.setItem(CUSTOM_PALETTE_KEY,JSON.stringify(palette))}catch{}
 stopAI();commit(E.applyCustomPalette(scene,palette,DATA),{appearanceOnly:true,message:"Палитра применена к предметам и фону."});
}
$("palette-options").addEventListener("click",e=>{const b=e.target.closest("[data-palette]");if(!b||b.dataset.palette===scene.palette)return;if(b.dataset.palette==="custom")applyUserPalette(scene.customPalette||importedPalette);else commit({...scene,palette:b.dataset.palette,backgroundDesign:E.backdropDesignFor(scene)},{appearanceOnly:true})});
$("import-palette").addEventListener("click",()=>$("palette-file").click());
$("palette-file").addEventListener("change",async()=>{
 const file=$("palette-file").files[0];if(!file)return;
 try{if(file.size>PALETTE.MAX_BYTES)throw Error("Файл палитры должен быть меньше 128 КБ.");const palette=PALETTE.parse(await file.text(),file.name);stopAI();applyUserPalette(palette);$("palette-status").dataset.error="false";$("palette-status").textContent="Загружена «"+palette.name+"». Все цветовые роли можно настроить ниже."}
 catch(error){$("palette-status").dataset.error="true";$("palette-status").textContent=error.message}
 finally{$("palette-file").value=""}
});
$("custom-palette-colors").addEventListener("change",event=>{const id=event.target.dataset.colorSlot;if(!id)return;const current=E.paletteFor(scene,DATA);applyUserPalette({...current,slots:{...current.slots,[id]:event.target.value}})});
$("save-palette").addEventListener("click",()=>download(JSON.stringify(E.paletteFor(scene,DATA),null,2),"application/json","palette.json"));
$("size-control").addEventListener("click",e=>{
 const b=e.target.closest("[data-value]");if(!b||b.dataset.value===scene.size)return;
 try{commit(V.changeSize(scene,b.dataset.value,DATA,E),{message:"Набор "+b.dataset.value+". Геометрия главной группы проверена, SVG в масштабе 1:1."})}catch(error){notify(error.message)}
});
function switchFormat(format){
 flushNumericEdit();if(format===scene.format)return;
 try{const memory=V.selectFormat(variantMemory,scene,format,DATA,E);commit(V.current(memory),{memory,select:null,message:"Формат восстановлен вместе с его правками. Gemini не вызывался."})}catch(error){notify(error.message)}
}
$("format-options").addEventListener("click",event=>{const b=event.target.closest("[data-format]");if(b)switchFormat(b.dataset.format)});
$("format").addEventListener("change",()=>{
 if($("format").value==="custom"){$("canvas-width").focus();return}switchFormat($("format").value);
});
$("remember-layout").addEventListener("click",()=>{
 if(!scene.items.length)return;
 flushNumericEdit();const template=E.captureTemplate(scene,DATA);savedLayouts[template.key]=template;
 while(Object.keys(savedLayouts).length>24)delete savedLayouts[Object.keys(savedLayouts)[0]];
 const persisted=persistLayouts();renderSceneInfo();notify(persisted?"Раскладка сохранена в этом браузере. Она применяется к тем же предметам, размеру и формату.":"Раскладка запомнена до закрытия страницы: сохранение в браузере недоступно.");
});
$("forget-layout").addEventListener("click",()=>{
 delete savedLayouts[E.templateKey(scene)];persistLayouts();commit(E.arrange(scene,DATA),{message:"Восстановлены исходные позиции сцены."});
});
$("background").addEventListener("change",()=>commit({...scene,background:$("background").value}));
$("backdrop-options").addEventListener("click",event=>{const button=event.target.closest("[data-backdrop]");if(button)commit({...scene,background:"pattern",backgroundDesign:button.dataset.backdrop})});
$("toggle-guide").addEventListener("click",()=>{showGuide=!showGuide;renderCanvas()});
$("layer-list").addEventListener("click",e=>{
 const eye=e.target.closest("[data-visibility]"),order=e.target.closest("[data-order]");
 if(eye){const result=E.toggleLayerVisibility(scene,eye.dataset.visibility,DATA);let next=result.scene;
  const item=next.items.find(i=>i.uid===eye.dataset.visibility),promoted=next.items.find(i=>i.uid===result.promoted);
  if(promoted){recognition=null;if(next.framing==="focus")next=V.reframe(next,DATA,E)}
  commit(next,{select:item.hidden&&selected===item.uid?null:selected,message:promoted?"Главный предмет теперь — "+asset(promoted.assetId).name.toLocaleLowerCase("ru")+".":null});return}
 if(order){const next=E.clone(scene),index=next.items.findIndex(i=>i.uid===order.dataset.order),target=index+Number(order.dataset.direction);if(index<0||target<0||target>=next.items.length)return;[next.items[index],next.items[target]]=[next.items[target],next.items[index]];commit(next);return}
 const b=e.target.closest("[data-select]");if(!b)return;selected=b.dataset.select;activateSettings("object");renderCanvas();renderLayers();renderSelection();
});
$("role-control").addEventListener("click",e=>{
 const b=e.target.closest("[data-value]"),item=selectedItem();if(!b||!item||item.role===b.dataset.value)return;
 const next=E.clone(scene);next.items.find(i=>i.uid===selected).role=b.dataset.value;recognition=null;commit(next);
});
function flushNumericEdit(){
 if(!numericSession)return;
 const {before,id,key,uid}=numericSession;numericSession=null;scene=constrainEdit(before,scene,uid);const item=scene.items.find(i=>i.uid===uid);
 if(item)$(id).value=Math.round(item[key]);
 const moved=JSON.stringify(before.items)!==JSON.stringify(scene.items);if(moved)record(before);
 saveLocal({syncPlacement:moved});
}
for(const [id,key,length]of [["position-x","x","width"],["position-y","y","height"],["rotation","rotation",null]]){
 $(id).addEventListener("input",()=>{
  const item=selectedItem(),field=$(id),value=Number(field.value);
  if(!item||field.value.trim()===""||!Number.isFinite(value))return;
  if(numericSession&&(numericSession.id!==id||numericSession.uid!==item.uid))flushNumericEdit();
  if(!numericSession)numericSession={before:E.clone(scene),id,key,uid:item.uid};
  if(length){const target={x:item.x,y:item.y,[key]:Math.max(-scene[length],Math.min(scene[length]*2,value))};scene=E.moveScene(scene,DATA,item.uid,target,{resolve:false})}
  else item.rotation=Math.max(-180,Math.min(180,value));
  if(key==="rotation")$("rotation-range").value=item.rotation;
  renderCanvas();
 });
 $(id).addEventListener("change",()=>{flushNumericEdit();renderAll()});
 $(id).addEventListener("blur",()=>{flushNumericEdit();renderAll()});
}
$("rotation-range").addEventListener("input",()=>{
 if(!selectedItem())return;
 if(!rotationSession)rotationSession=E.clone(scene);
 const candidate={...selectedItem(),rotation:Number($("rotation-range").value)};
 selectedItem().rotation=candidate.rotation;
 $("rotation-range").value=selectedItem().rotation;
 $("rotation").value=selectedItem().rotation;renderCanvas();
});
$("rotation-range").addEventListener("change",()=>{
 if(!rotationSession)return;scene=constrainEdit(rotationSession,scene,selected);const moved=JSON.stringify(rotationSession.items)!==JSON.stringify(scene.items);record(rotationSession);rotationSession=null;renderAll();saveLocal({syncPlacement:moved});
});
document.querySelector(".rotation-shortcuts").addEventListener("click",event=>{
 const button=event.target.closest("[data-angle]");if(!button||!selectedItem())return;
 const next=E.clone(scene),item=next.items.find(i=>i.uid===selected);
 item.rotation=button.dataset.angle==="reset"?0:((item.rotation+Number(button.dataset.angle)+180)%360+360)%360-180;
 commit(next,{syncPlacement:true});
});
for(const [id,key]of [["flip-x","flipX"],["flip-y","flipY"]])$(id).addEventListener("click",()=>{
 if(!selectedItem())return;const next=E.clone(scene),item=next.items.find(i=>i.uid===selected);item[key]=!item[key];commit(next,{syncPlacement:true});
});
function duplicate(){
 const item=selectedItem();if(!item)return;
 if(scene.items.length>=32){notify("На холсте уже 32 предмета.");return}
 const copy={...item,uid:E.uid(),x:item.x+scene.width*.025,y:item.y+scene.height*.025};
 const next=E.clone(scene);next.items.splice(next.items.findIndex(i=>i.uid===selected)+1,0,copy);recognition=null;commit(next,{select:copy.uid});
}
function remove(){
 if(!selectedItem())return;
 const next=E.clone(scene);next.items=next.items.filter(i=>i.uid!==selected);recognition=null;commit(next,{select:null});
}
$("duplicate").addEventListener("click",duplicate);$("remove").addEventListener("click",remove);
function layer(direction){
 const index=scene.items.findIndex(i=>i.uid===selected),target=index+direction;
 if(index<0||target<0||target>=scene.items.length)return;
 const next=E.clone(scene);[next.items[index],next.items[target]]=[next.items[target],next.items[index]];commit(next);
}
$("layer-up").addEventListener("click",()=>layer(1));$("layer-down").addEventListener("click",()=>layer(-1));
function restoreSnapshot(snapshot){scene=E.clone(snapshot.scene);variantMemory=snapshot.memory?V.validateMemory(snapshot.memory,DATA,E):null;selected=null;recognition=null;saveLocal();renderAll()}
function undo(){flushNumericEdit();if(!past.length)return;future.push(projectSnapshot());restoreSnapshot(past.pop())}
function redo(){flushNumericEdit();if(!future.length)return;past.push(projectSnapshot());restoreSnapshot(future.pop())}
$("undo").addEventListener("click",undo);$("redo").addEventListener("click",redo);
function point(event){
 const m=$("artboard").getScreenCTM();if(!m)return null;
 return V.worldPoint(scene,new DOMPoint(event.clientX,event.clientY).matrixTransform(m.inverse()));
}
$("artboard").addEventListener("pointerdown",event=>{
 if(event.button!==0)return;flushNumericEdit();
 const group=event.target.closest("[data-instance]");
 if(!group){deselect();return}
 const item=scene.items.find(i=>i.uid===group.dataset.instance),p=point(event);if(!item||!p)return;
 event.preventDefault();selected=item.uid;activateSettings("object");$("artboard").focus({preventScroll:true});
 drag={uid:item.uid,pointer:event.pointerId,start:p,x:item.x,y:item.y,before:E.clone(scene),moved:false};
 try{$("artboard").setPointerCapture(event.pointerId)}catch{}
 $("artboard").dataset.dragging="true";renderCanvas();renderLayers();renderSelection();
});
$("artboard").addEventListener("pointermove",event=>{
 if(!drag||drag.pointer!==event.pointerId)return;const p=point(event);if(!p)return;
 const item=scene.items.find(i=>i.uid===drag.uid);if(!item)return;
 const dx=p.x-drag.start.x,dy=p.y-drag.start.y;
 if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;
 scene=E.moveScene(drag.before,DATA,drag.uid,{x:drag.x+dx,y:drag.y+dy},{resolve:false});renderCanvas();
});
function endDrag(event){
 if(!drag||event.pointerId!==drag.pointer)return;
 const before=drag.before;
 if(event.type==="pointercancel")scene=drag.before;
 else if(drag.moved){const target=scene.items.find(i=>i.uid===drag.uid);scene=E.moveScene(drag.before,DATA,drag.uid,target,{resolve:true});record(drag.before)}
 try{$("artboard").releasePointerCapture(event.pointerId)}catch{}
 const moved=JSON.stringify(before.items)!==JSON.stringify(scene.items);drag=null;$("artboard").dataset.dragging="false";renderAll();saveLocal({syncPlacement:moved});
}
$("artboard").addEventListener("pointerup",endDrag);$("artboard").addEventListener("pointercancel",endDrag);
function download(text,type,name){
 const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
$("export").addEventListener("click",()=>{
 try{download(E.exportSvg(scene,DATA),"image/svg+xml;charset=utf-8","composition-"+scene.size+"-"+scene.width+"x"+scene.height+".svg");notify("SVG готов. Предметы сохранены отдельными векторными группами.")}
 catch(error){notify("Не удалось экспортировать: "+error.message)}
});
$("save-project").addEventListener("click",()=>{flushNumericEdit();download(JSON.stringify(projectSnapshot(),null,2),"application/json","composition-project.json");document.querySelector(".project-menu").open=false;notify("Проект и правки всех вариантов сохранены.")});
$("load-project").addEventListener("click",()=>{$("project-file").click();document.querySelector(".project-menu").open=false});
$("project-file").addEventListener("change",async()=>{
 const file=$("project-file").files[0];if(!file)return;
 try{
  if(file.size>1000000)throw new Error("Файл проекта слишком большой");
  const parsed=JSON.parse(await file.text());
  const memory=parsed.type==="composition-project"&&parsed.memory?nativeMemory(parsed.memory):null;
  const next=memory?V.current(memory):nativeScene(parsed.type==="composition-project"?parsed.scene:parsed);
  recognition=null;commit(next,{memory,select:null,message:memory?"Проект открыт. Форматы и варианты восстановлены.":"Проект открыт."});$("query").value=next.query;
 }catch(error){notify("Не удалось открыть проект: "+error.message)}
 $("project-file").value="";
});
$("reset-project").addEventListener("click",()=>{
 recognition=null;commit(E.createScene({...scene,items:[],query:"",scale:1}),{select:null,message:"Холст очищен. Действие можно отменить."});$("query").value="";$("match-status").textContent="";document.querySelector(".project-menu").open=false;
});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"){deselect();return}
 const typing=event.target.matches("input,textarea,select,[contenteditable=true]");
 if(typing)return;
 if((event.metaKey||event.ctrlKey)&&(event.code==="KeyZ"||event.key.toLowerCase()==="z")){event.preventDefault();event.shiftKey?redo():undo();return}
 if(event.ctrlKey&&(event.code==="KeyY"||event.key.toLowerCase()==="y")){event.preventDefault();redo();return}
 if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="d"){event.preventDefault();duplicate();return}
 if(event.key==="Delete"||event.key==="Backspace"){if(selected){event.preventDefault();remove()}return}
 if(selectedItem()&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){
  event.preventDefault();const next=E.clone(scene),item=next.items.find(i=>i.uid===selected),step=event.shiftKey?10:1;
  if(event.key==="ArrowLeft")item.x-=step;if(event.key==="ArrowRight")item.x+=step;if(event.key==="ArrowUp")item.y-=step;if(event.key==="ArrowDown")item.y+=step;commit(E.moveScene(scene,DATA,selected,item,{resolve:false}),{syncPlacement:true});
 }
});
$("canvas-area").addEventListener("pointerdown",event=>{if(event.composedPath().includes($("artboard"))||event.target.closest("button,a,input,select,textarea"))return;deselect()});
document.addEventListener("click",event=>{const menu=document.querySelector(".project-menu");if(menu.open&&!menu.contains(event.target))menu.open=false});
let resizeFrame;window.addEventListener("resize",()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(renderCanvas)});
renderAll();saveLocal();

if(migratedSizing)notify("Проект переведён на исходные размеры S/L. Копия прежней версии сохранена в браузере.");
