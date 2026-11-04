"use strict";
const D=STUDIO_DATA,E=CompositionEngine,R=InteractionRegistry,$=id=>document.getElementById(id),names=Object.fromEntries(D.manifest.assets.map(a=>[a.id,a.name]));
for(const id of ['base','child'])$(id).innerHTML=D.manifest.assets.map(a=>'<option value="'+a.id+'">'+E.escapeXml(a.name)+'</option>').join('');
$('base').value='book';$('child').value='phone';
$('scheme').innerHTML=D.palettes.palettes.map(p=>'<option value="'+p.id+'">'+p.name+'</option>').join('');$('scheme').value='lavender';
function render(){
 const back=$('base').value,front=$('child').value,size=$('detail').value,baseRole=$('base-role').value,childRole=$('child-role').value,decision=R.decision(back,front),r=decision.rule;
 const allowed=decision.status==='supported',palette=D.palettes.palettes.find(p=>p.id===$('scheme').value);
 document.documentElement.style.setProperty('--line',palette.slots['background.mid']);document.documentElement.style.setProperty('--selected',palette.slots['background.base']);
 $('decision').textContent=allowed?'Можно: '+r.text:'Размещать раздельно';
 $('reason').textContent=allowed?'Отмечены начальные опорные положения. В композиции проверяется реальная форма предметов: верхний предмет должен большей частью лежать на поверхности, находиться выше неё в слоях и не пересекать соседние предметы. Цветовая роль не определяет физическую совместимость.':decision.reason;
 $('basis').textContent=r?(r.basis==='reference'?'Основание: предоставленные примеры композиций.':'Основание: визуальная оценка подготовленных SVG; дополнительный допуск.'):'Для этой пары совместимая опорная поверхность не зафиксирована.';
 const spatial=R.placement(back,front);
 $('placement-rule').textContent=names[front]+': '+spatial.text+'. '+R.objectRules[front].text+' Группа на опоре наследует положение опоры.';
 $('zones').disabled=!allowed;
 const anchors=allowed?r.anchors:[[0,0]];
 $('previews').innerHTML=anchors.map((offset,index)=>{
  const scale=1,v=E.variant(D,back,size,baseRole),childVariant=E.variant(D,front,size,childRole),margin=size==='S'?40:80;
  let width=Math.ceil(Math.max(v.nativeWidth,childVariant.nativeWidth+Math.abs(offset[0])*v.nativeWidth*2)+margin*2),height=Math.ceil(Math.max(v.nativeHeight,childVariant.nativeHeight+Math.abs(offset[1])*v.nativeHeight*2)+margin*2);
  const a={uid:'ibase'+index,assetId:back,role:baseRole,x:width/2,y:height/2,rotation:0},b={uid:'ichild'+index,assetId:front,role:childRole,x:width/2+offset[0]*v.nativeWidth,y:height/2+offset[1]*v.nativeHeight,rotation:0};
  if(!allowed){
   const direction=spatial.allowed[0];
   if(['above','below'].includes(direction)){
    width=Math.ceil(Math.max(v.nativeWidth,childVariant.nativeWidth)+margin*2);height=Math.ceil(v.nativeHeight+childVariant.nativeHeight+margin*3);a.x=b.x=width/2;
    if(direction==='above'){b.y=margin+childVariant.nativeHeight/2;a.y=margin*2+childVariant.nativeHeight+v.nativeHeight/2}else{a.y=margin+v.nativeHeight/2;b.y=margin*2+v.nativeHeight+childVariant.nativeHeight/2}
   }else{
    width=Math.ceil(v.nativeWidth+childVariant.nativeWidth+margin*3);height=Math.ceil(Math.max(v.nativeHeight,childVariant.nativeHeight)+margin*2);a.y=b.y=height/2;
    if(direction==='left'){b.x=margin+childVariant.nativeWidth/2;a.x=margin*2+childVariant.nativeWidth+v.nativeWidth/2}else{a.x=margin+v.nativeWidth/2;b.x=margin*2+v.nativeWidth+childVariant.nativeWidth/2}
   }
  }
  const scene=E.createScene({size,format:'custom',width,height,palette:palette.id,scale,background:'solid',items:[a,b]});
  let zone='';if(allowed&&$('zones').checked){
   const groups=back==='book'?[r.anchors.filter(p=>p[0]<0),r.anchors.filter(p=>p[0]>=0)]:[r.anchors];
   const radius=Math.min(v.nativeWidth,v.nativeHeight)*scale*r.zoneRadius;
   for(const points of groups.filter(p=>p.length)){
    const list=points.map(p=>(a.x+p[0]*v.nativeWidth*scale)+','+(a.y+p[1]*v.nativeHeight*scale)).join(' ');
    zone+='<polyline points="'+list+'" fill="none" stroke="#181817" stroke-opacity=".18" stroke-width="'+(radius*2)+'" stroke-linecap="round" stroke-linejoin="round"/>';
    zone+=points.map(p=>'<circle cx="'+(a.x+p[0]*v.nativeWidth*scale)+'" cy="'+(a.y+p[1]*v.nativeHeight*scale)+'" r="6" fill="#181817"/>').join('');
   }
  }
  return '<figure class="rule-preview"><svg viewBox="0 0 '+width+' '+height+'" aria-label="'+E.escapeXml(names[front]+' и '+names[back])+ '">'+E.sceneMarkup(scene,D)+zone+'</svg><figcaption>'+(allowed?'Опорное положение '+(index+1)+' · '+size:'Сочетание без наложения')+'</figcaption></figure>';
 }).join('');
 $('matrix').innerHTML='<thead><tr><th>Первый / второй</th>'+R.subjects.map(id=>'<th scope="col">'+E.escapeXml(names[id])+'</th>').join('')+'</tr></thead><tbody>'+R.subjects.map(a=>'<tr><th scope="row">'+E.escapeXml(names[a])+'</th>'+R.subjects.map(b=>{const ok=R.decision(a,b).status==='supported';return '<td><button data-base="'+a+'" data-child="'+b+'" data-supported="'+ok+'" aria-pressed="'+(back===a&&front===b)+'" aria-label="'+E.escapeXml(names[a]+' — '+names[b])+ '">'+(ok?'На опоре':R.placement(a,b).text)+'</button></td>'}).join('')+'</tr>').join('')+'</tbody>';
}
for(const id of ['base','child','detail','base-role','child-role','scheme','zones'])$(id).addEventListener('change',render);
$('matrix').addEventListener('click',event=>{const button=event.target.closest('[data-base]');if(!button)return;$('base').value=button.dataset.base;$('child').value=button.dataset.child;render();$('decision').scrollIntoView({behavior:'smooth',block:'center'})});
render();
