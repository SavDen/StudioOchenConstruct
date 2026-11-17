/* One SVG: exact vector fallback plus an isolated, offline browser editor. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioInteractive=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION=1;
function scriptJSON(value){return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))}
function base64(text){const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary)}
function boot(){
 const root=document.documentElement;
 try{
  const payload=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(document.getElementById('studio-interactive-payload').textContent),c=>c.charCodeAt(0))));
  const shell=new TextDecoder().decode(Uint8Array.from(atob(payload.shell),c=>c.charCodeAt(0)));
  const json=value=>JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  const bootstrap='<script>globalThis.STUDIO_INITIAL_PROJECT='+json(payload.project)+';globalThis.STUDIO_SVG_SHELL='+json(payload.shell)+';</scr'+'ipt>';
  const frame=document.createElementNS('http://www.w3.org/1999/xhtml','iframe');
  frame.setAttribute('title','Интерактивный конструктор SVG');frame.setAttribute('sandbox','allow-scripts allow-downloads');
  frame.setAttribute('style','display:block;width:100%;height:100%;border:0;background:#f5f6f2');
  frame.srcdoc=shell.replace('<!--STUDIO_BOOTSTRAP-->',bootstrap);
  const surface=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
  surface.setAttribute('width','100%');surface.setAttribute('height','100%');surface.append(frame);
  root.removeAttribute('viewBox');root.setAttribute('width','100%');root.setAttribute('height','100%');
  root.setAttribute('style','position:fixed;inset:0;width:100%;height:100%;background:#f5f6f2');
  document.getElementById('studio-vector-preview').setAttribute('display','none');root.append(surface);
 }catch(error){console.error('Не удалось открыть интерактивный SVG',error)}
}
function create(project,data,E,shell){
 if(typeof shell!=='string'||shell.length<1000||!/^[A-Za-z0-9+/=]+$/.test(shell))throw Error('Не загружен автономный редактор. Повторите скачивание.');
 const clean=E.validateScene(project.scene,data);
 // A manual composition may deliberately overlap. Serialize it as drawn, preserving paths.
 const preview=E.sceneMarkup(clean,data);
 const stored={type:'composition-project',version:2,scene:clean,...(project.memory?{memory:project.memory}:{})};
 const payload=base64(JSON.stringify({version:VERSION,project:stored,shell}));
 return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="'+clean.width+'" height="'+clean.height+'" viewBox="0 0 '+clean.width+' '+clean.height+'" fill="none"><title>'+E.escapeXml(clean.query||'Интерактивная композиция')+'</title><desc>Откройте этот SVG отдельным файлом в браузере, чтобы редактировать композицию. В режиме изображения отображается векторный результат. Для Figma скачайте чистый SVG из редактора.</desc><g id="studio-vector-preview">'+preview+'</g><metadata id="studio-interactive-payload">'+payload+'</metadata><script><![CDATA[('+boot.toString()+')();]]></script></svg>';
}
return {VERSION,create,scriptJSON};
});
