const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ROOT=path.join(__dirname,".."),Engine=require("../dist/engine.js");
const E={...Engine,createScene:options=>Engine.createScene({sizing:"legacy",size:"S",format:"landscape",width:1200,height:630,...options})};
const context={};vm.runInNewContext(fs.readFileSync(path.join(ROOT,"dist/data.js"),"utf8"),context);const D=context.STUDIO_DATA;
const normal=x=>JSON.parse(JSON.stringify(x));
test("background visibility hides SVG output without deleting objects or moving the scene",()=>{
 const scene=E.validateScene(E.generate("Свет знаний",E.createScene({framing:"focus"}),D).scene,D);
 assert.ok(scene.items.some(i=>i.role==="background"));
 const hidden=E.validateScene({...scene,showSupporting:false},D);
 assert.deepEqual(hidden.items,scene.items);assert.equal(hidden.scale,scene.scale);
 assert.ok(!E.exportSvg(hidden,D).includes('data-role="background"'));
 assert.ok(E.exportSvg({...hidden,showSupporting:true},D).includes('data-role="background"'));
 const restored=E.validateScene(JSON.parse(JSON.stringify(hidden)),D);
 assert.equal(restored.showSupporting,false);assert.equal(restored.items.length,scene.items.length);
 assert.equal(E.validateScene({...scene,showSupporting:undefined,supporting:false},D).showSupporting,true);
});
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
   assert.ok(!E.objectsOverlap(s,D,s.items[i],s.items[j])||E.validContact(s,D,s.items[i],s.items[j]),"Unexpected main overlap in "+f.id+"/"+size+"/"+l.id);
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
test("mirror transforms preserve all original contours and round-trip project flags",()=>{
 const scene=E.generate("книга",E.createScene({background:"transparent",supporting:false}),D).scene;
 const original=D.svgs[E.variant(D,"book",scene.size,"main").path];
 const paths=s=>[...s.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map(m=>m[1]);
 for(const [flipX,flipY]of [[true,false],[false,true],[true,true]]){
  const s=E.clone(scene);s.items[0].flipX=flipX;s.items[0].flipY=flipY;s.items[0].rotation=37;
  const saved=E.validateScene(JSON.parse(JSON.stringify(s)),D),out=E.exportSvg(saved,D);
  assert.equal(saved.items[0].flipX,flipX);assert.equal(saved.items[0].flipY,flipY);
  assert.deepEqual(paths(out),paths(original));assert.match(out,/rotate\(37\)/);
  const transform=out.match(/data-instance="[^"]+"[^>]*transform="([^"]+)"/)[1];
  const scales=transform.match(/scale\(([^)]+)\)/)[1].split(" ").map(Number);
  assert.equal(Math.sign(scales[0]),flipX?-1:1);assert.equal(Math.sign(scales[1]),flipY?-1:1);
  assert.equal(Math.abs(scales[0]),Math.abs(scales[1]));
 }
});
test("old projects default to no reflection and invalid mirror flags are rejected",()=>{
 const s=E.generate("телефон",E.createScene(),D).scene;
 const old=E.validateScene(s,D);assert.equal(old.items[0].flipX,false);assert.equal(old.items[0].flipY,false);
 s.items[0].flipX="false";assert.throws(()=>E.validateScene(s,D),/отражение/);
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

test("semantic topics select complete existing scenes and keep exclusions",()=>{
 const cases=[['Финансы под контролем','finance',['wallet','coin']],['Обучение онлайн','online',['phone','book']],['Порядок в документах','work',['folder','pen']],['Музыка и подкасты','audio',['headphones']],['Решаем задачи вместе','team',['puzzle']],['Забота и подарки','care',['flowers']]];
 for(const [query,id,expected]of cases){const g=E.generate(query,E.createScene(),D);assert.ok(g.scene);assert.equal(E.recipeFor(g.scene).id,id);for(const assetId of expected)assert.ok(g.scene.items.some(i=>i.assetId===assetId&&i.role==='main'),query+' / '+assetId)}
 const g=E.generate('книга без финансов и телефона',E.createScene(),D);assert.equal(E.recipeFor(g.scene).id,'study');assert.ok(g.scene.items.every(i=>!['wallet','coin','phone'].includes(i.assetId)));
});
test("authored scene layers put the base behind its foreground details",()=>{
 for(const [query,back,front]of [['книга, лампа','book','lamp'],['папка, ручка','folder','pen'],['кошелёк, монета','wallet','coin'],['телефон, пазл','phone','puzzle']]){
  const s=E.generate(query,E.createScene(),D).scene;
  const a=s.items.findIndex(i=>i.assetId===back),b=s.items.findIndex(i=>i.assetId===front);assert.ok(a>=0&&b>a,query);
  const svg=E.exportSvg(s,D);assert.ok(svg.indexOf('data-asset="'+back+'"')<svg.indexOf('data-asset="'+front+'"'));
  assert.ok(s.items.slice(0,a).every(i=>i.role==='background'||E.RULES.depth[i.assetId]<=E.RULES.depth[back]));
 }
});
test("all authored scenes fit every size, format, layout and alternate placement",()=>{
 let cases=0;
 for(const r of E.RULES.recipes)for(const f of E.FORMATS)for(const size of ['S','L'])for(const l of E.LAYOUTS)for(const variation of [0,1,2]){
  const s=E.generate('',E.createScene({recipe:r.id,format:f.id,width:f.width,height:f.height,size,layout:l.id}),D,{variation}).scene;
  assert.ok(s,r.id);E.validateScene(s,D);
  for(const item of s.items){const b=E.boundsFor(item,s,D);assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=s.width+1&&b.y+b.height<=s.height+1,[r.id,f.id,size,l.id,item.assetId].join('/'))}
  assert.deepEqual(E.layoutIssues(s,D),[],[r.id,f.id,size,l.id,variation].join('/'));
  cases++;
 }
 assert.equal(cases,504);
});

test('every subject has a support profile and every directed pair has inverse placement rules',()=>{
 const R=E.RULES.registry,opposite={left:'right',right:'left',above:'below',below:'above'};
 assert.equal(Object.keys(R.objectRules).length,10);assert.equal(R.spatialPairs.length,45);
 for(const a of R.subjects)for(const b of R.subjects){
  const rule=R.placement(a,b);assert.ok(rule.allowed.length);assert.ok(rule.text);
  for(const support of R.supports.filter(r=>r.front===b))assert.ok(R.objectRules[b].canRestOn.includes(support.back));
  if(a!==b)assert.deepEqual(R.placement(b,a).allowed,rule.allowed.map(d=>opposite[d]));
 }
 assert.deepEqual(R.objectRules.lamp.canRestOn,[]);assert.deepEqual(R.objectRules.flowers.canRestOn,[]);assert.deepEqual(R.objectRules.headphones.canRestOn,[]);
 assert.deepEqual(R.placement('book','lamp').allowed,['left']);assert.deepEqual(R.placement('lamp','book').allowed,['right']);
});

test('all pair directions survive size, role, frame and layout changes in8640 configurations',()=>{
 let checked=0;
 for(const pair of E.RULES.registry.spatialPairs)for(const size of ['S','L'])for(const f of E.FORMATS)for(const l of E.LAYOUTS)for(const framing of ['overview','focus'])for(const roleA of ['main','background'])for(const roleB of ['main','background']){
  const items=[{uid:'ibase',assetId:pair.base,role:roleA,x:0,y:0,rotation:0},{uid:'itarget',assetId:pair.target,role:roleB,x:0,y:0,rotation:0}];
  const s=E.arrange(E.createScene({items,size,format:f.id,width:f.width,height:f.height,layout:l.id,framing}),D,{variation:checked%3});
  const plan=E.placementPlan(s,D);assert.ok(plan.relations.every(r=>r.satisfied),JSON.stringify({pair:pair.id,size,format:f.id,layout:l.id,framing,roleA,roleB,plan}));
  assert.deepEqual(E.layoutIssues(s,D),[]);checked++;
 }
 assert.equal(checked,8640);
});

test('supported groups inherit the base position among standing and separate objects',()=>{
 for(const query of ['book phone lamp flowers','folder pen wallet coin','headphones flowers phone','book puzzle pen lamp'])for(const size of ['S','L'])for(const f of E.FORMATS)for(const l of E.LAYOUTS){
  const s=E.generate(query,E.createScene({size,format:f.id,width:f.width,height:f.height,layout:l.id,supporting:false}),D).scene;
  assert.deepEqual(E.layoutIssues(s,D),[],query);const plan=E.placementPlan(s,D);assert.ok(plan.relations.every(r=>r.satisfied));
  const group=plan.groups.find(g=>g.asset==='book'||g.asset==='folder');if(group)assert.ok(group.members.length>1);
 }
});

test('writing requests retain designer focus and use the original study scene without a special pen zoom',()=>{
 const old=E.generate('Свет знаний',E.createScene({focus:'book',framing:'focus'}),D).scene;
 const s=E.generate('Обучение письму',old,D).scene;
 assert.equal(s.focus,'book');assert.equal(E.recipeFor(s).id,'study');assert.equal(E.focusFor(s).assetId,'book');
 assert.ok(s.items.some(i=>i.assetId==='lamp'));assert.ok(s.items.some(i=>i.assetId==='pen'));assert.deepEqual(E.layoutIssues(s,D),[]);
});

test('old remembered right-hand lamp layouts migrate to the clarified left-hand reading order',()=>{
 const fresh=E.generate('book lamp',E.createScene({supporting:false}),D).scene;
 const old=E.clone(fresh),book=old.items.find(i=>i.assetId==='book'),lamp=old.items.find(i=>i.assetId==='lamp');
 lamp.x=book.x+1000;
 const remembered=E.captureTemplate(old,D);remembered.rulesVersion=E.RULES.version-1;
 const restored=E.applyTemplate(fresh,remembered,D),a=E.boundsFor(restored.items.find(i=>i.assetId==='book'),restored,D),b=E.boundsFor(restored.items.find(i=>i.assetId==='lamp'),restored,D);
 assert.ok(b.x+b.width<a.x);assert.deepEqual(E.layoutIssues(restored,D),[]);
});

test('manual edits may violate automatic side rules and remain exactly editable',()=>{
 const s=E.generate('book lamp',E.createScene({supporting:false}),D).scene,book=s.items.find(i=>i.assetId==='book'),lamp=s.items.find(i=>i.assetId==='lamp');
 const moved=E.moveScene(s,D,lamp.uid,{x:book.x+500,y:book.y},{resolve:false});
 assert.ok(E.positionIssues(moved,D).length);assert.equal(E.validateScene(moved,D).items.find(i=>i.assetId==='lamp').x,book.x+500);
 const t=E.captureTemplate(moved,D),restored=E.applyTemplate(s,t,D);assert.equal(restored.items.find(i=>i.assetId==='lamp').x,book.x+500);
});
test("rearranging preserves authored edits to angle and mirror",()=>{
 const s=E.generate('книга, лампа',E.createScene(),D).scene;
 const book=s.items.find(i=>i.assetId==='book');book.rotation=28;book.flipX=true;
 const next=E.arrange(s,D,{variation:1}),other=next.items.find(i=>i.uid===book.uid);
 assert.equal(other.rotation,28);assert.equal(other.flipX,true);
 for(const item of next.items){const b=E.boundsFor(item,next,D);assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=next.width+1&&b.y+b.height<=next.height+1)}
});
test("saved placements restore exact positions, layer order and transforms for new instances",()=>{
 const s=E.generate('книга, лампа',E.createScene(),D).scene;
 s.items[0].rotation=-17;s.items[0].flipY=true;
 const safe=E.arrange(s,D);Object.assign(s,safe);s.items.forEach(item=>{item.x+=12;item.y+=8});
 assert.deepEqual(E.layoutIssues(s,D),[]);
 const template=E.captureTemplate(s,D),fresh=E.generate('лампа, книга',E.createScene(),D).scene;
 const applied=E.applyTemplate(fresh,JSON.parse(JSON.stringify(template)),D);
 assert.notEqual(applied.items[0].uid,s.items[0].uid);
 for(let i=0;i<s.items.length;i++)for(const key of ['assetId','role','x','y','rotation','flipX','flipY']){if(typeof s.items[i][key]==='number')assert.ok(Math.abs(applied.items[i][key]-s.items[i][key])<1e-8);else assert.equal(applied.items[i][key],s.items[i][key]===undefined?false:s.items[i][key])}
 assert.equal(applied.scale,s.scale);assert.equal(fresh.items[0].x,E.generate('лампа, книга',E.createScene(),D).scene.items[0].x);
});
test("saved placements cannot leak to another format, detail size, subject set or role",()=>{
 const s=E.generate('книга, лампа',E.createScene(),D).scene,t=E.captureTemplate(s,D);
 for(const change of [x=>{x.format='square';x.width=1080;x.height=1080},x=>x.size='L',x=>x.items.pop(),x=>x.items[0].role='main']){const n=E.clone(s);change(n);assert.throws(()=>E.applyTemplate(n,t,D))}
 const recolored={...s,palette:'peach'};assert.equal(E.templateKey(s),E.templateKey(recolored));assert.equal(E.applyTemplate(recolored,t,D).palette,'peach');
});
test("malformed saved placements are rejected without changing source scene",()=>{
 const s=E.generate('книга',E.createScene(),D).scene,t=E.captureTemplate(s,D),before=JSON.stringify(s);
 for(const change of [x=>x.scale=-2,x=>x.slots[0].x=Infinity,x=>x.slots[0].key='missing',x=>x.slots[0].flipX='yes',x=>x.slots[1].order=x.slots[0].order]){const n=E.clone(t);change(n);assert.throws(()=>E.applyTemplate(s,n,D))}
 assert.equal(JSON.stringify(s),before);
});

// Regression: the supplied wide L book/lamp screenshot exposed an overlap
// that the previous area-based test explicitly allowed. No pair is exempt.
test("book and lamp never touch and their feet agree with depth in every variant",()=>{
 for(const size of ['S','L'])for(const f of E.FORMATS)for(const l of E.LAYOUTS)for(const variation of [0,1,2]){
  const s=E.generate('книга, лампа',E.createScene({size,format:f.id,width:f.width,height:f.height,layout:l.id,palette:'lavender',supporting:false}),D,{variation}).scene;
  const book=s.items.find(i=>i.assetId==='book'),lamp=s.items.find(i=>i.assetId==='lamp'),a=E.boundsFor(book,s,D),b=E.boundsFor(lamp,s,D);
  assert.ok(b.x+b.width<a.x,'reading order must be lamp then book from left to right');
  assert.ok(b.y+b.height>a.y+a.height,'lamp base must be nearer the viewer');
  assert.ok(s.items.indexOf(lamp)>s.items.indexOf(book));assert.deepEqual(E.layoutIssues(s,D),[]);
 }
});
test("all subject pairs and role combinations stay disjoint after rotation and reflection",()=>{
 let cases=0;
 for(let a=0;a<D.manifest.assets.length;a++)for(let b=a+1;b<D.manifest.assets.length;b++)for(const roleA of ['main','background'])for(const roleB of ['main','background'])for(const size of ['S','L'])for(const f of E.FORMATS){
  const items=[{uid:'ione',assetId:D.manifest.assets[a].id,role:roleA,x:0,y:0,rotation:37,flipX:true},{uid:'itwo',assetId:D.manifest.assets[b].id,role:roleB,x:0,y:0,rotation:-23,flipY:true}];
  const s=E.arrange(E.createScene({size,format:f.id,width:f.width,height:f.height,items}),D,{variation:cases%3});assert.deepEqual(E.layoutIssues(s,D),[]);
  for(const i of s.items){const box=E.boundsFor(i,s,D);assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=s.width+1e-6&&box.y+box.height<=s.height+1e-6)}
  cases++;
 }
 assert.equal(cases,1440);
});
test("dense mixed roles and repeated instances have no collisions",()=>{
 for(const size of ['S','L'])for(const f of E.FORMATS)for(const l of E.LAYOUTS){
  const items=Array.from({length:32},(_,n)=>({uid:'iitem'+n,assetId:D.manifest.assets[n%10].id,role:n%3?'main':'background',x:0,y:0,rotation:n%2?45:-30}));
  const s=E.arrange(E.createScene({size,format:f.id,width:f.width,height:f.height,layout:l.id,items}),D);assert.deepEqual(E.layoutIssues(s,D),[]);
 }
});
test("legacy overlapping templates are repaired without dropping subjects or changing paths",()=>{
 const s=E.generate('книга лампа',E.createScene({size:'L',format:'wide',width:1920,height:1080,supporting:false}),D).scene;
 s.items.forEach(i=>{i.x=600;i.y=500});s.items.reverse();
 const template=E.captureTemplate(s,D);delete template.rulesVersion;delete template.manual;
 const fresh=E.generate('книга лампа',E.createScene({...s,items:[]}),D).scene;
 const fixed=E.applyTemplate(fresh,template,D);assert.deepEqual(E.layoutIssues(fixed,D),[]);assert.equal(fixed.items.length,s.items.length);
 assert.ok(E.exportSvg(fixed,D).includes('data-asset="lamp"'));assert.ok(E.exportSvg(fixed,D).includes('data-asset="book"'));
 assert.deepEqual(E.layoutIssues(E.ensureLayout(s,D),D),[]);
});
test("optional placement solver can resolve an overlapping proposal",()=>{
 const s=E.generate('книга лампа',E.createScene({supporting:false}),D).scene;
 const book=s.items.find(i=>i.assetId==='book'),lamp=s.items.find(i=>i.assetId==='lamp');
 const target={x:lamp.x+1000,y:lamp.y},moved=E.safeMove(s,D,book,target);
 assert.equal(moved.x,target.x);assert.ok(E.collisionFree(s,D,{...book,...moved}));
 const away=E.safeMove(s,D,book,{x:book.x+200,y:book.y});assert.equal(away.x,book.x+200);
 const onto=E.safeMove(s,D,book,{x:lamp.x,y:lamp.y});assert.ok(E.collisionFree(s,D,{...book,...onto}));
});

function visibleFraction(item,scene){const b=E.boundsFor(item,scene,D);return Math.max(0,Math.min(scene.width,b.x+b.width)-Math.max(0,b.x))*Math.max(0,Math.min(scene.height,b.y+b.height)-Math.max(0,b.y))/(b.width*b.height)}
test('reference book/phone contact is exact, layered and safe in all frames',()=>{
 let cases=0;
 for(const size of ['S','L'])for(const f of E.FORMATS)for(const l of E.LAYOUTS)for(const framing of ['overview','focus'])for(const variation of [0,1,2]){
  const s=E.generate('phone book',E.createScene({size,format:f.id,width:f.width,height:f.height,layout:l.id,framing,supporting:false}),D,{variation}).scene;
  const book=s.items.find(i=>i.assetId==='book'),phone=s.items.find(i=>i.assetId==='phone'),slot=E.contactSlot(s,D,book,phone);
  assert.ok(E.validContact(s,D,book,phone));assert.ok(Math.hypot(phone.x-slot.x,phone.y-slot.y)<1e-6);assert.deepEqual(E.layoutIssues(s,D),[]);
  assert.ok(s.items.indexOf(phone)>s.items.indexOf(book));cases++;
 }
 assert.equal(cases,144);
});
test('reference puzzle can sit on a background book while a pen remains separate',()=>{
 for(const size of ['S','L'])for(const f of E.FORMATS)for(const framing of ['focus','overview']){
  const input=E.generate('puzzle book pen',E.createScene({size,format:f.id,width:f.width,height:f.height,framing,supporting:false}),D).scene;
  input.items.find(i=>i.assetId==='book').role='background';input.focus='puzzle';const s=E.arrange(input,D);
  const book=s.items.find(i=>i.assetId==='book'),puzzle=s.items.find(i=>i.assetId==='puzzle');
  assert.ok(E.validContact(s,D,book,puzzle));assert.deepEqual(E.layoutIssues(s,D),[]);assert.equal(book.role,'background');
 }
});
test('whitelisted subjects cannot overlap at arbitrary offsets, angles or roles',()=>{
 const scene=E.generate('phone book',E.createScene({supporting:false}),D).scene;
 const b=scene.items.find(i=>i.assetId==='book'),p=scene.items.find(i=>i.assetId==='phone');assert.ok(E.validContact(scene,D,b,p));
 for(const mutate of [x=>x.x+=30,x=>x.rotation=15,x=>x.flipX=true,x=>x.role='background']){
  const bad=E.clone(scene),phone=bad.items.find(i=>i.assetId==='phone');mutate(phone);
  assert.ok(!E.validContact(bad,D,bad.items.find(i=>i.assetId==='book'),phone));assert.ok(E.layoutIssues(bad,D).some(i=>i.type==='collision'));
  assert.deepEqual(E.layoutIssues(E.ensureLayout(bad,D),D),[]);
 }
});
test('semantic focus follows intent, exclusion and explicit user choice',()=>{
 for(const [query,id]of [['Обучение онлайн','phone'],['Финансы под контролем','wallet'],['Накопления','coin'],['Новая идея','lamp'],['Музыка и подкасты','headphones'],['Решаем задачи вместе','puzzle']]){
  const s=E.generate(query,E.createScene(),D).scene;assert.equal(E.focusFor(s).assetId,id,query);
 }
 const s=E.generate('phone book',E.createScene({focus:'book'}),D).scene;assert.equal(E.focusFor(s).assetId,'book');
 const without=E.generate('книга без телефона',E.createScene(),D).scene;assert.equal(E.focusFor(without).assetId,'book');
});
test('close framing keeps focus legible, context visible and all geometry uniformly scaled',()=>{
 let cases=0,cropped=0;
 for(const r of E.RULES.recipes)for(const f of E.FORMATS)for(const size of ['S','L'])for(const l of E.LAYOUTS)for(const variation of [0,1,2]){
  const s=E.generate('',E.createScene({recipe:r.id,format:f.id,width:f.width,height:f.height,size,layout:l.id,framing:'focus'}),D,{variation}).scene;
  assert.ok(visibleFraction(E.focusFor(s),s)>=.8-1e-6,[r.id,f.id,size,l.id].join('/'));
  for(const item of s.items.filter(i=>i.role==='main'))assert.ok(visibleFraction(item,s)>=.2-1e-6);
  assert.deepEqual(E.layoutIssues(s,D),[]);E.validateScene(s,D);
  if(s.items.some(i=>visibleFraction(i,s)<.999))cropped++;
  const svg=E.exportSvg(s,D);assert.ok(svg.includes('clip-path="url(#composition-crop)"'));for(const item of s.items)assert.ok(svg.includes('scale('+Number(s.scale.toFixed(5))+')'));
  cases++;
 }
 assert.equal(cases,504);assert.ok(cropped>0);
});
test('optional contact solver snaps to an authored slot',()=>{
 const s=E.generate('phone book',E.createScene({supporting:false}),D).scene,b=s.items.find(i=>i.assetId==='book'),p=s.items.find(i=>i.assetId==='phone');
 const slot=E.contactSlot(s,D,b,p),snap=E.safeMove(s,D,p,{x:slot.x+2,y:slot.y+2});assert.ok(E.collisionFree(s,D,{...p,...snap}));
 const move=E.safeMove(s,D,p,{x:b.x,y:b.y});assert.ok(E.collisionFree(s,D,{...p,...move}));
 const free=E.safeMove(s,D,p,{x:2000,y:2000});assert.ok(E.collisionFree(s,D,{...p,...free}));
});
test('framing and focus persist, scope templates, and safely default in old projects',()=>{
 const s=E.generate('phone book',E.createScene({framing:'focus',focus:'phone',supporting:false}),D).scene;
 const saved=E.validateScene(JSON.parse(JSON.stringify(s)),D);assert.equal(saved.framing,'focus');assert.equal(saved.focus,'phone');
 const t=E.captureTemplate(s,D);assert.throws(()=>E.applyTemplate({...s,framing:'overview'},t,D));assert.throws(()=>E.applyTemplate({...s,focus:'book'},t,D));
 for(const field of ['framing','focus']){const bad=E.clone(s);bad[field]='invented';assert.throws(()=>E.validateScene(bad,D))}
 const legacy=E.clone(s);delete legacy.framing;delete legacy.focus;const validated=E.validateScene(legacy,D);assert.equal(validated.framing,'overview');assert.equal(validated.focus,'auto');
 const old=E.captureTemplate(validated,D);old.key=E.templateKey(validated,{legacy:true});assert.ok(E.applyTemplate(validated,old,D));
});

test('registry covers100 directed pairs with10 visually reviewed support families',()=>{
 const R=E.RULES.registry;assert.equal(R.matrix.length,100);assert.equal(new Set(R.matrix.map(r=>r.back+':'+r.front)).size,100);assert.equal(R.supports.filter(r=>r.reviewed).length,10);
 assert.equal(R.supports.filter(r=>r.basis==='reference').length,2);
 for(const id of R.subjects)assert.equal(R.decision(id,id).status,'separate');
 assert.equal(R.decision('book','lamp').status,'separate');assert.equal(R.decision('lamp','book').status,'separate');
});
test('all120 size-role-anchor placements remain coherent across rotation and reflection',()=>{
 let cases=0;
 for(const rule of E.RULES.registry.supports)for(const size of ['S','L'])for(const role of ['main','background'])for(let anchor=0;anchor<rule.anchors.length;anchor++)for(const angle of [-15,0,15])for(const flips of [[false,false],[true,false],[false,true],[true,true]]){
  const base={uid:'ibase',assetId:rule.back,role,x:600,y:315,rotation:angle,flipX:flips[0],flipY:flips[1]},child={uid:'ichild',assetId:rule.front,role:'main',x:0,y:0,rotation:angle,flipX:flips[0],flipY:flips[1]};
  const s=E.createScene({size,scale:size==='S'?.6:.3,items:[base,child]}),slot=E.contactSlot(s,D,base,child,anchor);Object.assign(child,{x:slot.x,y:slot.y});assert.ok(E.validContact(s,D,base,child),rule.id);assert.deepEqual(E.layoutIssues(s,D),[]);cases++;
 }
 assert.equal(cases,1440);
});
test('a supported item moves locally in its zone and detaches without sticking',()=>{
 const s=E.generate('phone book',E.createScene({supporting:false}),D).scene,phone=s.items.find(i=>i.assetId==='phone'),book=s.items.find(i=>i.assetId==='book');
 const fine=E.moveScene(s,D,phone.uid,{x:phone.x+1,y:phone.y+1}),p=fine.items.find(i=>i.uid===phone.uid);assert.equal(p.x,phone.x+1);assert.equal(p.y,phone.y+1);assert.ok(E.validContact(fine,D,fine.items.find(i=>i.uid===book.uid),p));
 const detached=E.moveScene(s,D,phone.uid,{x:phone.x+1000,y:phone.y+1000});assert.equal(detached.items.find(i=>i.uid===phone.uid).x,phone.x+1000);assert.equal(detached.items.find(i=>i.uid===book.uid).x,book.x);
});
test('moving a support carries its group and preserves the rest of the scene',()=>{
 const s=E.generate('phone book',E.createScene({supporting:false}),D).scene,book=s.items.find(i=>i.assetId==='book'),phone=s.items.find(i=>i.assetId==='phone');
 s.items.push({uid:'iexternal',assetId:'flowers',role:'main',x:-2000,y:-2000,rotation:0});
 const next=E.moveScene(s,D,book.uid,{x:book.x+50,y:book.y+20});
 for(const original of [book,phone]){const item=next.items.find(i=>i.uid===original.uid);assert.equal(item.x,original.x+50);assert.equal(item.y,original.y+20)}
 assert.deepEqual(next.items.find(i=>i.uid==='iexternal'),s.items.find(i=>i.uid==='iexternal'));
 const p=next.items.find(i=>i.uid===phone.uid),b=next.items.find(i=>i.uid===book.uid);assert.ok(E.validContact(next,D,b,p));
});
test('free move preserves an overlap while the optional solver resolves it',()=>{
 const s=E.generate('book lamp',E.createScene({supporting:false}),D).scene,book=s.items.find(i=>i.assetId==='book'),lamp=s.items.find(i=>i.assetId==='lamp'),target={x:lamp.x,y:lamp.y};
 const preview=E.moveScene(s,D,book.uid,target,{resolve:false});assert.equal(preview.items.find(i=>i.uid===book.uid).x,lamp.x);assert.ok(E.layoutIssues(preview,D).some(i=>i.type==='collision'));
 const dropped=E.moveScene(s,D,book.uid,target);assert.ok(!E.layoutIssues(dropped,D).some(i=>i.type==='collision'));assert.deepEqual(dropped.items.find(i=>i.uid===lamp.uid),lamp);
});
test('publication framing protects recognizable features and gives one subject color priority',()=>{
 for(const recipe of E.RULES.recipes)for(const f of E.FORMATS)for(const size of ['S','L']){
  const scene=E.generate('',E.createScene({recipe:recipe.id,size,format:f.id,width:f.width,height:f.height,framing:'focus'}),D).scene;
  const mains=scene.items.filter(i=>i.role==='main');assert.equal(mains.length,1);const hero=E.focusFor(scene),critical=E.protectedBox(hero,scene,D);assert.ok(E.visibleBox(critical,scene.width,scene.height)>=.995-1e-6);
  const box=E.boundsFor(hero,scene,D);assert.ok(box.width*box.height/(scene.width*scene.height)>.10);assert.deepEqual(E.layoutIssues(scene,D),[]);
 }
});
test('financial coin and document pen keep readable protected context instead of crop slivers',()=>{
 for(const [query,id,format,layout]of [['Финансы под контролем','coin','square','offset'],['Порядок в документах','pen','landscape','compact']])for(const size of ['S','L']){
  const f=E.FORMATS.find(f=>f.id===format),s=E.generate(query,E.createScene({size,format,width:f.width,height:f.height,layout,framing:'focus'}),D).scene;
  const context=s.items.find(i=>i.assetId===id);assert.ok(context);assert.ok(E.visibleBox(E.protectedBox(context,s,D),s.width,s.height)>=(id==='pen'?.995:.75)-1e-6,query+' / '+size);
 }
 const rule=E.RULES.registry.supports.find(r=>r.id==='book-pen'),base={uid:'ibase',assetId:'book',role:'background',x:600,y:315,rotation:0},pen={uid:'ichild',assetId:'pen',role:'main',x:600,y:315,rotation:0};
 const s=E.createScene({items:[base,pen]});assert.ok(rule);assert.ok(!E.validContact(s,D,base,pen),'the spine between separate page zones is not a support slot');
});

test('automatic book/lamp depth and ground order are independent of color roles in576 variants',()=>{
 let checked=0;
 for(const size of ['S','L'])for(const f of E.FORMATS)for(const l of E.LAYOUTS)for(const framing of ['overview','focus'])for(const variation of [0,1,2])for(const bookRole of ['main','background'])for(const lampRole of ['main','background']){
  const seed=E.createScene({size,format:f.id,width:f.width,height:f.height,layout:l.id,framing,query:'book lamp',items:[{uid:'ibook',assetId:'book',role:bookRole,x:0,y:0,rotation:0},{uid:'ilamp',assetId:'lamp',role:lampRole,x:0,y:0,rotation:0}]});
  const s=E.arrange(seed,D,{variation}),book=s.items.find(i=>i.assetId==='book'),lamp=s.items.find(i=>i.assetId==='lamp'),a=E.boundsFor(book,s,D),b=E.boundsFor(lamp,s,D);
  assert.ok(s.items.indexOf(book)<s.items.indexOf(lamp),bookRole+'/'+lampRole);assert.ok(b.x+b.width<a.x);assert.ok(b.y+b.height>a.y+a.height);assert.ok(!E.objectsOverlap(s,D,book,lamp));assert.deepEqual(E.layoutIssues(s,D),[]);checked++;
 }
 assert.equal(checked,576);
});
test('explicit scene-depth edges override background paint order without changing color roles',()=>{
 const s=E.createScene({items:[{uid:'ibook',assetId:'book',role:'main',x:0,y:0,rotation:0},{uid:'ilamp',assetId:'lamp',role:'background',x:0,y:0,rotation:0},{uid:'ipen',assetId:'pen',role:'background',x:0,y:0,rotation:0}]});
 assert.ok(E.layerPlan(s).edges.some(([a,b])=>a==='ibook'&&b==='ilamp'));const ordered=E.orderLayers(E.clone(s));assert.deepEqual(ordered.items.map(i=>i.uid),['ipen','ibook','ilamp']);assert.equal(ordered.items[2].role,'background');
});
test('manual overlap and custom layer order survive validation, SVG export and remembered layouts',()=>{
 const s=E.generate('book lamp',E.createScene({supporting:false}),D).scene,book=s.items.find(i=>i.assetId==='book'),lamp=s.items.find(i=>i.assetId==='lamp');
 const moved=E.moveScene(s,D,book.uid,{x:lamp.x,y:lamp.y},{resolve:false});moved.items.reverse();const edited=moved.items.find(i=>i.uid===book.uid);edited.rotation=23;
 assert.equal(edited.x,lamp.x);assert.ok(E.layoutIssues(moved,D).some(i=>i.type==='collision'));
 const parsed=E.validateScene(JSON.parse(JSON.stringify(moved)),D);assert.equal(parsed.items.find(i=>i.uid===book.uid).x,lamp.x);
 const template=E.captureTemplate(parsed,D);assert.equal(template.manual,true);const restored=E.applyTemplate(E.generate('book lamp',E.createScene({supporting:false}),D).scene,template,D);
 assert.deepEqual(restored.items.map(i=>i.assetId),parsed.items.map(i=>i.assetId));assert.equal(restored.items.find(i=>i.assetId==='book').rotation,23);assert.equal(restored.items.find(i=>i.assetId==='book').x,lamp.x);
 const svg=E.exportSvg(restored,D);assert.ok(svg.indexOf('data-asset="lamp"')<svg.indexOf('data-asset="book"'));
});

test('dense automatic scenes preserve all-role book/lamp depth and grounded placement',()=>{
 let checked=0;
 for(const size of ['S','L'])for(const f of E.FORMATS)for(const bookRole of ['main','background'])for(const lampRole of ['main','background']){
  const items=[{uid:'ibook',assetId:'book',role:bookRole,x:0,y:0,rotation:0},{uid:'ilamp',assetId:'lamp',role:lampRole,x:0,y:0,rotation:0},...Array.from({length:12},(_,n)=>({uid:'icoin'+n,assetId:'coin',role:n%2?'main':'background',x:0,y:0,rotation:0}))];
  const s=E.arrange(E.createScene({size,format:f.id,width:f.width,height:f.height,items}),D),book=s.items.find(i=>i.assetId==='book'),lamp=s.items.find(i=>i.assetId==='lamp'),a=E.boundsFor(book,s,D),b=E.boundsFor(lamp,s,D);
  assert.ok(s.items.indexOf(book)<s.items.indexOf(lamp));assert.ok(b.x+b.width<a.x);assert.ok(b.y+b.height>a.y+a.height);assert.deepEqual(E.layoutIssues(s,D),[]);checked++;
 }
 assert.equal(checked,32);
});
