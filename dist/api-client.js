(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CompositionAPI=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function create(settings={},fetchImpl=(...args)=>fetch(...args)){
  const mode=settings.mode||'local';if(!['local','static','remote'].includes(mode))throw Error('Unknown deployment mode');let base='';
  if(mode==='remote'){const u=new URL(settings.apiBase);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Invalid public API address');base=u.href.replace(/\/$/,'')}
  function request(path,options={}){if(!/^\/api\/[a-z-]+$/.test(path))throw Error('Invalid API route');if(mode==='static')throw Error('API is unavailable in static mode');return fetchImpl(base+path,mode==='remote'?{...options,mode:'cors',credentials:'omit'}:options)}
  return {mode,request};
 }
 return {create};
});
