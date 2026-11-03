/* The editor uses the exact prepared SVGs. All state is browser-local. */
"use strict";
const E=CompositionEngine,DATA=STUDIO_DATA;
const $=id=>document.getElementById(id);
const ICONS={"grid":"<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/>","download":"<path d=\"M12 3v12m-4-4 4 4 4-4\"/><path d=\"M4 16v4h16v-4\"/>","undo":"<path d=\"m8 4-5 5 5 5\"/><path d=\"M3 9h10a7 7 0 0 1 0 14\"/>","redo":"<path d=\"m16 4 5 5-5 5\"/><path d=\"M21 9H11a7 7 0 0 0 0 14\"/>","plus":"<path d=\"M12 5v14M5 12h14\"/>","copy":"<rect x=\"8\" y=\"8\" width=\"12\" height=\"13\" rx=\"2\"/><path d=\"M16 8V3H3v13h5\"/>","trash":"<path d=\"M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7\"/>","up":"<path d=\"m6 14 6-6 6 6\"/>","down":"<path d=\"m6 10 6 6 6-6\"/>","rotate":"<path d=\"M3 10a9 9 0 1 1 2 9M3 3v7h7\"/>","search":"<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"m16 16 5 5\"/>","layers":"<path d=\"m12 3 10 6-10 6L2 9 12 3Zm-9 11 9 5 9-5m-18 5 9 5 9-5\"/>","file":"<path d=\"M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 16h6\"/>","upload":"<path d=\"M12 17V3m-4 4 4-4 4 4M4 16v5h16v-5\"/>","close":"<path d=\"m6 6 12 12M6 18 18 6\"/>","arrow":"<path d=\"M4 12h16m-6-6 6 6-6 6\"/>","check":"<path d=\"m5 12 4 4L19 6\"/>"};
const icon=name=>'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[name]+'</svg>';
const STORAGE_KEY="svg-composition-studio-v1";
let scene,selected=null,past=[],future=[],variation=0,showGuide=true,drag=null,scaleSession=null,toastTimer=null;
let recognition=null;
try{
 const saved=localStorage.getItem(STORAGE_KEY);
 if(saved)scene=E.validateScene(JSON.parse(saved),DATA);
}catch{}
if(!scene){const initial=E.generate("Свет знаний",E.createScene(),DATA);scene=initial.scene;recognition=initial.result}
function notify(message){
 $("toast").textContent=message;$("toast").hidden=false;clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>$("toast").hidden=true,3600);
}
function saveLocal(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(scene))}catch{}}
function record(before){past.push(E.clone(before));if(past.length>60)past.shift();future=[]}
function commit(next,{message=null,select=selected,history=true}={}){
 try{
  next=E.validateScene(next,DATA);
  if(history)record(scene);
  scene=next;selected=scene.items.some(a=>a.uid===select)?select:null;
  renderAll();saveLocal();if(message)notify(message);
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
 const item=selectedItem();if(!item||!showGuide)return "";
 const v=E.variant(DATA,item.assetId,scene.size,item.role),w=v.nativeWidth*scene.scale,h=v.nativeHeight*scene.scale;
 const handles=[[-w/2,-h/2],[w/2,-h/2],[-w/2,h/2],[w/2,h/2]].map(([x,y])=>'<circle class="selection-handle" cx="'+x+'" cy="'+y+'" r="'+(3*scene.width/Math.max(300,$("artboard").clientWidth))+'"/>').join("");
 return '<g aria-hidden="true" transform="translate('+item.x+' '+item.y+') rotate('+item.rotation+')"><rect class="selection-outline" x="'+(-w/2)+'" y="'+(-h/2)+'" width="'+w+'" height="'+h+'"/>'+handles+'</g>';
}
function renderCanvas(){
 const svg=$("artboard"),wrap=$("artboard-wrap");
 svg.setAttribute("viewBox","0 0 "+scene.width+" "+scene.height);
 wrap.style.aspectRatio=scene.width+" / "+scene.height;
 wrap.style.width=innerWidth>680?"min(100%, "+(Math.max(280,innerHeight-340)*scene.width/scene.height)+"px)":"100%";
 let guide="";
 if(scene.layout==="headline"&&showGuide){
  guide='<g aria-hidden="true"><rect class="headline-guide" x="'+scene.width*.055+'" y="'+scene.height*.18+'" width="'+scene.width*.36+'" height="'+scene.height*.64+'"/><text class="headline-guide-label" x="'+scene.width*.08+'" y="'+scene.height*.25+'">Место для заголовка</text></g>';
 }
 svg.innerHTML=E.sceneMarkup(scene,DATA)+guide+selectionMarkup();
 $("empty-canvas").hidden=scene.items.length>0;
 $("canvas-dimensions").textContent=scene.width+" × "+scene.height;
 $("canvas-note").textContent="Исходные SVG · "+scene.size;
 $("toggle-guide").setAttribute("aria-pressed",String(showGuide));
 $("toggle-guide").textContent=showGuide?"Скрыть границы":"Показать границы";
 const main=scene.items.filter(i=>i.role==="main").length,bg=scene.items.length-main;
 $("scene-summary").textContent=scene.items.length?main+" главных · "+bg+" фоновых":"Пока без предметов";
 $("export").disabled=!scene.items.length;
}
function renderLayers(){
 $("layer-count").textContent=scene.items.length;
 $("layer-list").innerHTML=[...scene.items].reverse().map(item=>'<li><button class="layer-item" data-select="'+item.uid+'" aria-pressed="'+(item.uid===selected)+'"><span class="layer-thumb">'+thumb(item.assetId,item.role,"layer-"+item.uid)+'</span><span class="layer-label"><span class="layer-name">'+E.escapeXml(asset(item.assetId).name)+'</span><span class="layer-role">'+(item.role==="main"?"Главный":"Фоновый")+'</span></span></button></li>').join("");
}
function renderSelection(){
 const item=selectedItem();
 $("selection-empty").hidden=Boolean(item);$("selection-controls").hidden=!item;
 if(!item)return;
 $("selection-name").textContent=asset(item.assetId).name;
 $("role-control").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.value===item.role)));
 if(document.activeElement!==$("rotation"))$("rotation").value=Math.round(item.rotation);
 const index=scene.items.indexOf(item);
 $("layer-up").disabled=index===scene.items.length-1;$("layer-down").disabled=index===0;
}
function renderPalette(){
 $("palette-options").innerHTML=DATA.palettes.palettes.map(p=>'<button class="palette-option" data-palette="'+p.id+'" title="'+p.name+'" aria-label="'+p.name+'" aria-pressed="'+(p.id===scene.palette)+'"><span class="palette-swatch" style="background:linear-gradient(135deg,'+p.slots["background.base"]+' 0 50%,'+p.slots["object.secondary"]+' 50% 75%,'+p.slots["object.primary"]+' 75%)"></span></button>').join("");
 const current=DATA.palettes.palettes.find(p=>p.id===scene.palette);
 document.querySelector(".palette-note").textContent=current.name+" · из исходных макетов";
}
function renderAll(){
 if(document.activeElement!==$("query"))$("query").value=scene.query;
 $("supporting").checked=scene.supporting;$("format").value=scene.format;$("layout").value=scene.layout;$("background").value=scene.background;
 $("size-control").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.value===scene.size)));
 const pct=Math.round(scene.scale*(scene.size==="L"?2:1)*100);$("scale").max=Math.max(200,Math.ceil(pct/50)*50);$("scale").min=Math.min(5,pct);$("scale").value=pct;$("scale-value").textContent=pct+"%";
 $("undo").disabled=!past.length;$("redo").disabled=!future.length;
 renderCanvas();renderPalette();renderLibrary();renderLayers();renderSelection();
 if(recognition){
  $("match-status").dataset.error=String(!recognition.items.length);
  $("match-status").textContent=recognition.items.length
    ?"Подобраны: "+recognition.items.map(i=>asset(i.assetId).name.toLocaleLowerCase("ru")+(i.role==="background"?" — фон":"")).join(", ")+"."
    :"Не нашёл совпадений. Попробуйте названия предметов или примеры выше.";
 }
}
function compose(query){
 const before={...scene,supporting:$("supporting").checked};
 const result=E.generate(query,before,DATA,{variation:0});recognition=result.result;variation=0;
 if(!result.scene){renderAll();$("query").value=query;notify("Нет совпадений. Попробуйте «книга», «лампа» или «финансы».");return}
 commit(result.scene,{select:null});
}
$("format").innerHTML=E.FORMATS.map(f=>'<option value="'+f.id+'">'+f.name+' · '+f.width+' × '+f.height+'</option>').join("");
$("layout").innerHTML=E.LAYOUTS.map(l=>'<option value="'+l.id+'">'+l.name+'</option>').join("");
$("compose-form").addEventListener("submit",e=>{e.preventDefault();compose($("query").value)});
document.querySelector(".examples").addEventListener("click",e=>{const b=e.target.closest("[data-example]");if(!b)return;$("query").value=b.dataset.example;compose(b.dataset.example)});
$("library-search").addEventListener("input",renderLibrary);
$("library-grid").addEventListener("click",e=>{
 const b=e.target.closest("[data-add]");if(!b)return;
 if(scene.items.length>=32){notify("На холсте уже 32 предмета. Удалите один, чтобы добавить новый.");return}
 const item={uid:E.uid(),assetId:b.dataset.add,role:"main",x:scene.width*.5,y:scene.height*.5,rotation:0};
 const next=E.clone(scene);next.items.push(item);
 if(next.items.length===1){const arranged=E.arrange(next,DATA);commit(arranged,{select:item.uid})}
 else commit(next,{select:item.uid,message:"Предмет добавлен. Переместите его или нажмите «Пересобрать»."});
});
$("palette-options").addEventListener("click",e=>{const b=e.target.closest("[data-palette]");if(b&&b.dataset.palette!==scene.palette)commit({...scene,palette:b.dataset.palette})});
$("size-control").addEventListener("click",e=>{
 const b=e.target.closest("[data-value]");if(!b||b.dataset.value===scene.size)return;
 const next=E.clone(scene),old=scene.size;next.size=b.dataset.value;
 next.scale*=old==="S"?.5:2;
 commit(next,{message:"Подгружены исходные варианты "+next.size+". Положение предметов сохранено."});
});
$("format").addEventListener("change",()=>{
 const f=E.FORMATS.find(f=>f.id===$("format").value);
 commit(E.arrange({...scene,format:f.id,width:f.width,height:f.height},DATA),{message:"Композиция адаптирована к новому формату."});
});
$("layout").addEventListener("change",()=>{variation=0;commit(E.arrange({...scene,layout:$("layout").value},DATA))});
$("arrange").addEventListener("click",()=>{variation++;commit(E.arrange(scene,DATA,{variation}),{message:"Предметы расставлены по шаблону."})});
$("background").addEventListener("change",()=>commit({...scene,background:$("background").value}));
$("supporting").addEventListener("change",()=>commit({...scene,supporting:$("supporting").checked},{message:"Настройка будет учтена при следующей сборке."}));
$("toggle-guide").addEventListener("click",()=>{showGuide=!showGuide;renderCanvas()});
$("layer-list").addEventListener("click",e=>{const b=e.target.closest("[data-select]");if(!b)return;selected=b.dataset.select;renderCanvas();renderLayers();renderSelection()});
$("role-control").addEventListener("click",e=>{
 const b=e.target.closest("[data-value]"),item=selectedItem();if(!b||!item||item.role===b.dataset.value)return;
 const next=E.clone(scene);next.items.find(i=>i.uid===selected).role=b.dataset.value;recognition=null;commit(next);
});
$("rotation").addEventListener("change",()=>{
 const item=selectedItem();if(!item)return;
 const value=Number($("rotation").value);
 if(!Number.isFinite(value)){notify("Введите угол от −180 до 180°.");$("rotation").value=item.rotation;return}
 const next=E.clone(scene);next.items.find(i=>i.uid===selected).rotation=Math.max(-180,Math.min(180,value));commit(next);
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
function undo(){if(!past.length)return;future.push(E.clone(scene));scene=past.pop();selected=null;recognition=null;renderAll();saveLocal()}
function redo(){if(!future.length)return;past.push(E.clone(scene));scene=future.pop();selected=null;recognition=null;renderAll();saveLocal()}
$("undo").addEventListener("click",undo);$("redo").addEventListener("click",redo);
function point(event){
 const m=$("artboard").getScreenCTM();if(!m)return null;
 return new DOMPoint(event.clientX,event.clientY).matrixTransform(m.inverse());
}
$("artboard").addEventListener("pointerdown",event=>{
 if(event.button!==0)return;
 const group=event.target.closest("[data-instance]");
 if(!group){selected=null;renderCanvas();renderLayers();renderSelection();return}
 const item=scene.items.find(i=>i.uid===group.dataset.instance),p=point(event);if(!item||!p)return;
 event.preventDefault();selected=item.uid;$("artboard").focus({preventScroll:true});
 drag={uid:item.uid,pointer:event.pointerId,start:p,x:item.x,y:item.y,before:E.clone(scene),moved:false};
 try{$("artboard").setPointerCapture(event.pointerId)}catch{}
 $("artboard").dataset.dragging="true";renderCanvas();renderLayers();renderSelection();
});
$("artboard").addEventListener("pointermove",event=>{
 if(!drag||drag.pointer!==event.pointerId)return;const p=point(event);if(!p)return;
 const item=scene.items.find(i=>i.uid===drag.uid);if(!item)return;
 const dx=p.x-drag.start.x,dy=p.y-drag.start.y;
 if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;
 item.x=drag.x+dx;item.y=drag.y+dy;renderCanvas();
});
function endDrag(event){
 if(!drag||event.pointerId!==drag.pointer)return;
 if(event.type==="pointercancel")scene=drag.before;
 else if(drag.moved)record(drag.before);
 try{$("artboard").releasePointerCapture(event.pointerId)}catch{}
 drag=null;$("artboard").dataset.dragging="false";renderAll();saveLocal();
}
$("artboard").addEventListener("pointerup",endDrag);$("artboard").addEventListener("pointercancel",endDrag);
$("scale").min=5;$("scale").max=200;
$("scale").addEventListener("input",()=>{
 if(!scaleSession)scaleSession=E.clone(scene);
 const value=Number($("scale").value),newScale=value/100/(scene.size==="L"?2:1),factor=newScale/scaleSession.scale;
 scene=E.clone(scaleSession);scene.scale=newScale;
 scene.items.forEach(item=>{item.x=scene.width/2+(item.x-scene.width/2)*factor;item.y=scene.height/2+(item.y-scene.height/2)*factor});
 $("scale-value").textContent=value+"%";renderCanvas();
});
$("scale").addEventListener("change",()=>{if(!scaleSession)return;record(scaleSession);scaleSession=null;renderAll();saveLocal()});
function download(text,type,name){
 const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
$("export").addEventListener("click",()=>{
 try{download(E.exportSvg(scene,DATA),"image/svg+xml;charset=utf-8","composition-"+scene.size+"-"+scene.width+"x"+scene.height+".svg");notify("SVG готов. Предметы сохранены отдельными векторными группами.")}
 catch(error){notify("Не удалось экспортировать: "+error.message)}
});
$("save-project").addEventListener("click",()=>{download(JSON.stringify(E.validateScene(scene,DATA),null,2),"application/json","composition-project.json");document.querySelector(".project-menu").open=false;notify("Проект сохранён. Его можно открыть в конструкторе.")});
$("load-project").addEventListener("click",()=>{$("project-file").click();document.querySelector(".project-menu").open=false});
$("project-file").addEventListener("change",async()=>{
 const file=$("project-file").files[0];if(!file)return;
 try{
  if(file.size>100000)throw new Error("Файл проекта слишком большой");
  const next=E.validateScene(JSON.parse(await file.text()),DATA);recognition=null;commit(next,{select:null,message:"Проект открыт."});$("query").value=next.query;
 }catch(error){notify("Не удалось открыть проект: "+error.message)}
 $("project-file").value="";
});
$("reset-project").addEventListener("click",()=>{
 recognition=null;commit(E.createScene({...scene,items:[],query:"",scale:1}),{select:null,message:"Холст очищен. Действие можно отменить."});$("query").value="";$("match-status").textContent="";document.querySelector(".project-menu").open=false;
});
document.addEventListener("keydown",event=>{
 const typing=event.target.matches("input,textarea,select,[contenteditable=true]");
 if(typing)return;
 if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?redo():undo();return}
 if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="d"){event.preventDefault();duplicate();return}
 if(event.key==="Escape"){selected=null;renderCanvas();renderLayers();renderSelection();return}
 if(event.key==="Delete"||event.key==="Backspace"){if(selected){event.preventDefault();remove()}return}
 if(selectedItem()&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){
  event.preventDefault();const next=E.clone(scene),item=next.items.find(i=>i.uid===selected),step=event.shiftKey?10:1;
  if(event.key==="ArrowLeft")item.x-=step;if(event.key==="ArrowRight")item.x+=step;if(event.key==="ArrowUp")item.y-=step;if(event.key==="ArrowDown")item.y+=step;commit(next);
 }
});
document.addEventListener("click",event=>{const menu=document.querySelector(".project-menu");if(menu.open&&!menu.contains(event.target))menu.open=false});
let resizeFrame;window.addEventListener("resize",()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(renderCanvas)});
renderAll();saveLocal();
