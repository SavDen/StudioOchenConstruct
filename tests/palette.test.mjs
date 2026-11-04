import {test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import vm from'node:vm';import{createRequire}from'node:module';import{createStudioServer}from'../scripts/serve.mjs';import{readVisualCatalog}from'../scripts/visual_catalog.mjs';
const req=createRequire(import.meta.url),E=req('../dist/engine'),V=req('../dist/composition-view'),Palette=req('../dist/palette'),c={};vm.runInNewContext(await fs.readFile(new URL('../dist/data.js',import.meta.url),'utf8'),c);const D=c.STUDIO_DATA,warm=Palette.parse(await fs.readFile(new URL('../dist/palette-template.json',import.meta.url),'utf8'));
test('palette template assigns every role exactly and accepts short hex without accepting active values',()=>{
 assert.equal(warm.slots['background.base'],'#F2EBE0');assert.equal(warm.slots.ink,'#242820');assert.equal(Palette.hex('abc'),'#AABBCC');
 for(const value of ['#12345678','red','url(https://example.com)','"/><script/>',null])assert.throws(()=>Palette.hex(value));
 for(const value of [{...warm,slots:{...warm.slots,script:'#FFFFFF'}},{...warm,slots:{ink:'#FFFFFF'}},{...warm,name:'x'.repeat(81)},{...warm,id:'<svg/>'}])assert.throws(()=>Palette.normalize(value));
});
test('JSON lists, HEX text, CSS, SVG and GPL import colors without rendering the file',()=>{
 const sources=[['["#f2ebe0","#a8c5ae","#df9b82"]','palette.json'],['#f2ebe0\n#a8c5ae\n#df9b82','palette.txt'],[':root {--bg:#f2ebe0;--a:#a8c5ae;--b:#df9b82}','palette.css'],['<svg><rect fill="#f2ebe0"/><rect fill="#a8c5ae"/><rect fill="#df9b82"/></svg>','palette.svg'],['GIMP Palette\nName: Warm\n242 235 224 Background\n168 197 174 Primary\n223 155 130 Secondary','palette.gpl']];
 for(const [text,file]of sources){const p=Palette.parse(text,file);assert.equal(p.slots['background.base'],'#F2EBE0');assert.equal(p.slots['object.primary'],'#A8C5AE');assert.equal(p.slots['object.secondary'],'#DF9B82');assert.equal(Object.keys(p.slots).length,8)}
 assert.throws(()=>Palette.parse('{bad','broken.json'));assert.throws(()=>Palette.parse('#123 #456','few.txt'));assert.throws(()=>Palette.parse('x'.repeat(Palette.MAX_BYTES+1)));assert.throws(()=>Palette.parse('GIMP Palette\n999 0 0 Red\n0 0 0 Black\n255 255 255 White'));
});
test('imported colors replace main and background slots across all 40 SVG sources without changing contours or dimensions',()=>{
 let tested=0;for(const a of D.manifest.assets)for(const size of ['S','L'])for(const role of ['main','background']){
  const v=a.variants[size][role],source=D.svgs[v.path],result=E.recolor(source,warm,role);assert.deepEqual([...result.matchAll(/\bd="([^"]*)"/g)].map(m=>m[1]),[...source.matchAll(/\bd="([^"]*)"/g)].map(m=>m[1]));assert.equal(result.match(/viewBox="([^"]+)"/)?.[1],source.match(/viewBox="([^"]+)"/)?.[1]);assert.ok(!/<(?:script|image|foreignObject)\b/.test(result));
  for(const node of result.match(/<[^>]+>/g))for(const attr of ['fill','stroke']){const slot=node.match(new RegExp('data-'+attr+'-slot="([^"]+)"'))?.[1];if(slot)assert.equal(node.match(new RegExp(' '+attr+'="([^"]+)"'))?.[1],warm.slots[slot])}tested++;
 }assert.equal(tested,40);
});
test('recoloring keeps layout, camera, source size and existing backdrop design in S/L and all formats',()=>{
 for(const size of ['S','L'])for(const format of ['square','landscape','portrait']){
  const f=E.FORMATS.find(f=>f.id===format),source=E.validateScene(E.generate('Любит писать',E.createScene({size,palette:'peach',...f,format}),D).scene,D),before=E.clone(source),next=E.applyCustomPalette(source,warm,D);assert.deepEqual(source,before);assert.deepEqual(next.items,source.items);assert.deepEqual(next.camera,source.camera);assert.equal(next.scale,1);assert.equal(next.size,size);assert.equal(next.backgroundDesign,E.backdropDesignFor(source));
  const svg=E.exportSvg(next,D);assert.ok(svg.includes('fill="#F2EBE0"'));assert.ok(svg.includes('#242820'));assert.ok(svg.includes('#9B826A'));assert.ok(svg.includes('data-backdrop-palette="custom"'));assert.deepEqual(E.layoutIssues(next,D),E.layoutIssues(source,D));
 }
});
test('custom and inactive palettes round-trip in independent scene memories and source-size switches',()=>{
 const source=E.generate('Любит писать',E.createScene({size:'S'}),D).scene;let memory=V.createCollection(source,D,E),scene=E.applyCustomPalette(V.current(memory),warm,D);memory=V.remember(memory,scene,D,E);memory=V.validateMemory(JSON.parse(JSON.stringify(memory)),D,E);assert.deepEqual(V.current(memory).customPalette,warm);assert.equal(memory.formats.square[1].palette,source.palette);
 const large=V.changeSize(V.current(memory),'L',D,E),back=V.changeSize(large,'S',D,E);assert.deepEqual(back.customPalette,warm);for(const [n,item]of back.items.entries()){assert.ok(Math.abs(item.x-scene.items[n].x)<1e-6);assert.ok(Math.abs(item.y-scene.items[n].y)<1e-6);assert.equal(item.rotation,scene.items[n].rotation);assert.equal(item.supportUid,scene.items[n].supportUid)}const preset=E.validateScene({...back,palette:'aqua'},D);assert.deepEqual(preset.customPalette,warm);assert.equal(E.paletteFor(preset,D).id,'aqua');
 assert.throws(()=>E.validateScene({...scene,customPalette:undefined},D));assert.throws(()=>E.validateScene({...scene,customPalette:{...warm,slots:{ink:'url(x)'}}},D));
});
test('Gemini gateway accepts a user palette and preserves it throughout the nine authored scenes',async t=>{
 const plan=JSON.parse(await fs.readFile(new URL('./fixtures/palette-ai-plan.json',import.meta.url),'utf8'));let sent;
 const server=createStudioServer({config:{GEMINI_PROXY_URL:'https://proxy.example',GEMINI_PROXY_TOKEN:'private-palette-test'},visualCatalog:await readVisualCatalog(),fetchImpl:async(url,options)=>{sent=JSON.parse(options.body);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(plan)}]}}],modelVersion:'mock'})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r)}));
 const scene=E.applyCustomPalette(E.createScene({query:'Любит писать',size:'S'}),warm,D),response=await fetch('http://127.0.0.1:'+server.address().port+'/api/compose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'Любит писать',scene})}),r=await response.json();assert.equal(response.status,200,JSON.stringify(r));assert.equal(JSON.parse(sent.contents[0].parts[0].text).settings.palette,'custom');
 for(const bank of Object.values(r.collection.formats))for(const s of bank){assert.equal(s.palette,'custom');assert.deepEqual(s.customPalette,warm);assert.ok(E.exportSvg(s,D).includes('#F2EBE0'))}
});
