/* Palette files contain colors only; imported SVG/CSS is never rendered or executed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CompositionPalette=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ROLES=[['background.base','Фон'],['object.primary','Основной акцент'],['object.secondary','Второй акцент'],['object.tertiary','Дополнительный цвет'],['background.mid','Мягкий оттенок фона'],['background.dark','Контур фона'],['ink','Контуры и тени'],['paper','Светлые участки']];
 const MAX_BYTES=131072;
 function hex(value){if(typeof value!=='string')throw Error('Цвет должен быть записан в HEX.');let s=value.trim().replace(/^#?/,'#');if(/^#[\da-f]{3}$/i.test(s))s='#'+s.slice(1).split('').map(c=>c+c).join('');if(!/^#[\da-f]{6}$/i.test(s))throw Error('Нужен непрозрачный HEX-цвет: например, #A8C5AE.');return s.toUpperCase()}
 function name(value){if(value===undefined)return 'Своя палитра';if(typeof value!=='string'||!value.trim()||value.length>80)throw Error('Название палитры должно содержать от 1 до 80 символов.');return value.trim().replace(/\s+/g,' ')}
 function normalize(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['id','name','slots'].includes(k))||value.id!==undefined&&value.id!=='custom')throw Error('Некорректная пользовательская палитра.');
  const slots=value.slots;if(!slots||typeof slots!=='object'||Array.isArray(slots)||Object.keys(slots).length!==ROLES.length||Object.keys(slots).some(k=>!ROLES.some(([id])=>id===k)))throw Error('В палитре должны быть заданы все восемь цветовых ролей.');
  return {id:'custom',name:name(value.name),slots:Object.fromEntries(ROLES.map(([id])=>[id,hex(slots[id])]))};
 }
 function mix(a,b,t){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('').toUpperCase()}
 function fromColors(values,title){
  if(!Array.isArray(values)||values.length<3||values.length>32)throw Error('Нужно от 3 до 32 цветов: фон и хотя бы два акцента.');
  const colors=values.map(hex),base=colors[0],bright=[1,3,5].reduce((sum,i,n)=>sum+parseInt(base.slice(i,i+2),16)*[.2126,.7152,.0722][n],0)>140,ink=bright?'#181817':'#F4F3F0',paper=bright?'#FFFFFF':'#20232B';
  const slots={'background.base':base,'object.primary':colors[1],'object.secondary':colors[2],'object.tertiary':colors[3]||mix(colors[1],paper,.45),'background.mid':mix(base,ink,.18),'background.dark':mix(base,ink,.42),ink,paper};
  for(let n=4;n<Math.min(8,colors.length);n++)slots[ROLES[n][0]]=colors[n];
  return normalize({name:name(title),slots});
 }
 function collect(value,depth=0,out=[]){
  if(depth>8||out.length>=32)return out;
  if(typeof value==='string'){try{out.push(hex(value))}catch{}return out}
  if(Array.isArray(value))for(const v of value)collect(v,depth+1,out);
  else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))if(!['name','id','description'].includes(k))collect(v,depth+1,out);
  return out;
 }
 function parse(text,filename='palette.json'){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Файл палитры должен быть меньше 128 КБ.');
  const title=filename.replace(/\.[^.]+$/,'').slice(0,80)||'Своя палитра',source=text.replace(/^\uFEFF/,'').trim();
  if(!source)throw Error('Файл палитры пуст.');
  if(/^[\[{]/.test(source)){
   let data;try{data=JSON.parse(source)}catch{throw Error('Не удалось прочитать JSON палитры.')}
   if(data?.palettes)data=data.palettes[0];
   if(data?.slots)return normalize({name:data.name||title,slots:data.slots});
   return fromColors(collect(data),data?.name||title);
  }
  let colors=[];
  if(/^GIMP Palette\b/.test(source)){
   for(const line of source.split(/\r?\n/)){const m=line.match(/^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s|$)/);if(m){const rgb=m.slice(1,4).map(Number);if(rgb.some(n=>n>255))throw Error('Некорректный RGB-цвет в GPL.');colors.push('#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join(''))}}
  }else{
   colors=[...source.matchAll(/#[\da-f]{6}(?![\da-f])|#[\da-f]{3}(?![\da-f])/gi)].map(m=>m[0]);
   if(!colors.length)colors=source.split(/[\s,;]+/).filter(s=>/^[\da-f]{6}$/i.test(s));
   colors=[...new Set(colors.map(hex))];
  }
  return fromColors(colors,title);
 }
 return {ROLES,MAX_BYTES,hex,normalize,fromColors,parse};
});
