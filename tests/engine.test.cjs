const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ROOT=path.join(__dirname,".."),E=require("../dist/engine.js");
const context={};vm.runInNewContext(fs.readFileSync(path.join(ROOT,"dist/data.js"),"utf8"),context);const D=context.STUDIO_DATA;
const normal=x=>JSON.parse(JSON.stringify(x));
test("explicit names retain all ten objects",()=>{
 const p=E.pick("книга, телефон, пазл, монета, наушники, лампа, цветы, кошелёк, папка, ручка",D,{supporting:false});
 assert.equal(p.items.length,10);assert.ok(p.items.every(i=>i.role==="main"));
});
test("metaphor keyword mapping is explainable",()=>{
 const p=E.pick("Свет знаний",D,{supporting:false});
 assert.deepEqual(normal(p.items.map(i=>i.assetId)),["book","lamp"]);assert.ok(p.matches.every(m=>m.reasons.length));
});
test("negated subjects are never reintroduced as background",()=>{
 const p=E.pick("книга без телефона и наушников",D);
 assert.deepEqual(normal(p.excluded).sort(),["headphones","phone"]);assert.ok(p.items.every(i=>!p.excluded.includes(i.assetId)));
});
test("query without background does not introduce supporting subjects",()=>{
 const p=E.pick("книга без фона",D);assert.ok(p.items.every(i=>i.role==="main"));
});
test("unknown query does not invent objects or replace a composition",()=>{
 const s=E.createScene(),g=E.generate("пингвин космонавт",s,D);assert.equal(g.scene,null);assert.equal(s.items.length,0);
});
test("all formats, sizes and templates fit primary subjects",()=>{
 let checked=0;
 for(const f of E.FORMATS)for(const size of ["S","L"])for(const l of E.LAYOUTS){
  const q="книга телефон пазл монета наушники лампа цветы кошелёк папка ручка";
  const generated=E.generate(q,E.createScene({format:f.id,width:f.width,height:f.height,size,layout:l.id,supporting:false}),D).scene;
  const s=E.validateScene(generated,D);assert.equal(s.items.length,10);
  for(const item of s.items){const b=E.boundsFor(item,s,D);assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=s.width+1&&b.y+b.height<=s.height+1,JSON.stringify({f:f.id,size,l:l.id,item:item.assetId,b}));}
  for(let i=0;i<s.items.length;i++)for(let j=i+1;j<s.items.length;j++){
   const a=E.boundsFor(s.items[i],s,D),b=E.boundsFor(s.items[j],s,D);
   const overlap=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1;
   assert.ok(!overlap,"Unexpected main overlap in "+f.id+"/"+size+"/"+l.id);
  }
  checked++;
 }
 assert.equal(checked,24);
});
test("role palette restrictions reject foreground accents in a background",()=>{
 assert.throws(()=>E.recolor('<svg><path fill="#fff" data-fill-slot="object.primary"/></svg>',D.palettes.palettes[0],"background"),/Запрещённая/);
});
test("vector export preserves source path data for all 40 versions and all palettes",()=>{
 let checked=0;
 for(const a of D.manifest.assets)for(const size of ["S","L"])for(const role of ["main","background"])for(const palette of D.palettes.palettes){
  const s=E.createScene({size,palette:palette.id,background:"transparent",items:[{uid:"itest",assetId:a.id,role,x:600,y:315,rotation:23}],scale:size==="S"?.5:.25});
  const output=E.exportSvg(s,D),original=D.svgs[a.variants[size][role].path];
  const paths=x=>[...x.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map(m=>m[1]);
  assert.deepEqual(paths(output),paths(original));
  assert.ok(!/<(?:image|foreignObject|script)\b/.test(output));
  assert.match(output,/data-asset="/);assert.match(output,/rotate\(23\)/);
  checked++;
 }
 assert.equal(checked,120);
});
test("duplicating subjects and backdrops yields unique IDs and valid fragment references",()=>{
 for(const p of D.palettes.palettes){
  const s=E.createScene({palette:p.id,items:[{uid:"ione",assetId:"book",role:"main",x:400,y:400,rotation:0},{uid:"itwo",assetId:"book",role:"main",x:800,y:400,rotation:0}]});
  const svg=E.exportSvg(s,D),ids=[...svg.matchAll(/\sid="([^"]*)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const m of svg.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(m[1]),m[1]);
  for(const m of svg.matchAll(/aria-labelledby="([^"]*)"/g))for(const id of m[1].split(/\s+/))assert.ok(ids.includes(id),id);
  assert.ok(svg.includes('data-asset-id="book-S-main"'),"metadata attribute must not be treated as an ID");
 }
});
test("projects reject unknown objects, unsafe IDs, invalid dimensions and nonfinite coordinates",()=>{
 const base=E.generate("книга",E.createScene(),D).scene;
 for(const change of [
  s=>s.items[0].assetId="invented",s=>s.items[0].uid='i" onclick="bad',
  s=>s.items[0].x=NaN,s=>s.width=0,s=>s.scale=-1,
  s=>s.items.push({...s.items[0]})
 ]){const s=E.clone(base);change(s);assert.throws(()=>E.validateScene(s,D))}
});
test("query text is escaped in vector export",()=>{
 const s=E.generate("книга",E.createScene(),D).scene;s.query='<script>alert("x")</script>';
 const svg=E.exportSvg(s,D);assert.ok(!svg.includes("<script>"));assert.ok(svg.includes("&lt;script&gt;"));
});
test("S and L use the actual distinct smartphone artwork",()=>{
 const a=D.manifest.assets.find(a=>a.id==="phone");
 assert.notEqual(D.svgs[a.variants.S.main.path],D.svgs[a.variants.L.main.path]);
 assert.equal(a.variants.S.main.pathCount,96);assert.equal(a.variants.S.background.pathCount,155);
});

test("assembled SVGs parse as XML with every original backdrop and duplicate objects",()=>{
 const scenes=D.palettes.palettes.map(p=>{
  const s=E.generate("книга телефон",E.createScene({palette:p.id}),D).scene;
  s.items.push({...s.items[0],uid:"iduplicate"});
  return E.exportSvg(s,D);
 });
 const result=require("node:child_process").spawnSync(process.env.PYTHON_EXECUTABLE||"python3",["-c","import sys,json,xml.etree.ElementTree as E; [E.fromstring(s) for s in json.load(sys.stdin)]; print('XML valid')"],{input:JSON.stringify(scenes),encoding:"utf8",maxBuffer:2000000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/XML valid/);
});
