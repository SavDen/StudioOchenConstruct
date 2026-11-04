const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../dist/engine'),V=require('../dist/composition-view'),R=require('../dist/interaction-registry'),G=require('../dist/geometry'),P=E.REFERENCE.PHYSICS,c={};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/data.js'),'utf8'),c);const D=c.STUDIO_DATA;
const item=(id,x=500,y=500,more={})=>({uid:'iphysical'+id,assetId:id,role:'main',x,y,rotation:0,flipX:false,flipY:false,...more});
const scene=items=>E.createScene({size:'S',items});
const outwardScene=items=>E.createScene({size:'S',format:'custom',width:2000,height:2000,items});
test('AI overlap moves only the originally outer item along the separating diagonal in either corner',()=>{
 for(const sign of [-1,1]){
  const center=item('wallet',1000,1000,{uid:'icenter'}),outer=item('wallet',1000+sign*60,1000+sign*60,{uid:'iouter'}),source=outwardScene([center,outer]);assert.ok(P.intersects(center,outer,source,D,E));
  const fixed=P.separateOutward(source,D,E),moved=fixed.items.find(i=>i.uid===outer.uid);assert.deepEqual(fixed.items[0],center);assert.ok((moved.x-outer.x)*sign>0);assert.ok((moved.y-outer.y)*sign>0);assert.ok(Math.abs((moved.x-outer.x)-(moved.y-outer.y))<1e-6);assert.deepEqual(E.layoutIssues(fixed,D),[]);assert.deepEqual(source.items,[center,outer]);assert.equal(fixed.scale,1);
 }
});
test('chain separation keeps the initial radial priority after an intermediate item moves outward',()=>{
 const center=item('wallet',1000,1000,{uid:'icenter'}),near=item('wallet',1060,1060,{uid:'inear'}),far=item('wallet',1120,1120,{uid:'ifar'}),pair=P.separateOutward(outwardScene([center,near]),D,E),chain=P.separateOutward(outwardScene([center,near,far]),D,E);
 assert.deepEqual(chain.items[0],center);assert.deepEqual(chain.items[1],pair.items[1]);assert.ok(chain.items[2].x>chain.items[1].x);assert.deepEqual(E.layoutIssues(chain,D),[]);
});
test('background overlap never moves the locked main even when the background is nearer the frame center',()=>{
 const main=item('wallet',1060,1060,{uid:'imain'}),bg=item('wallet',1000,1000,{uid:'ibg',role:'background'}),source=outwardScene([bg,main]),fixed=P.separateOutward(source,D,E,{includeBackground:true,movable:[bg.uid]});
 assert.deepEqual(fixed.items.find(i=>i.uid===main.uid),main);assert.ok(fixed.items[0].x<bg.x&&fixed.items[0].y<bg.y);assert.equal(P.intersects(...fixed.items,fixed,D,E),false);
});
test('a locked outer item fails safely instead of displacing the inner item or changing the input',()=>{
 const source=outwardScene([item('wallet',1000,1000,{uid:'icenter'}),item('wallet',940,940,{uid:'iouter'})]),before=E.clone(source);
 assert.throws(()=>P.separateOutward(source,D,E,{movable:['icenter']}),/закреплён/);assert.deepEqual(source,before);
});
test('a valid support is preserved and its whole outer assembly moves together',()=>{
 let source=E.createScene({size:'S',format:'custom',width:2400,height:2400,items:[item('book',1000,1000),item('pen',1000,1000,{supportUid:'iphysicalbook'})]});source=P.constrain(source,D,E);assert.equal(P.contact(...source.items,source,D,E),true);assert.deepEqual(P.separateOutward(source,D,E).items,source.items);
 const lamp=item('lamp',1200,1200);source.items.push(lamp);const fixed=P.separateOutward(source,D,E),book=fixed.items.find(i=>i.assetId==='book'),pen=fixed.items.find(i=>i.assetId==='pen');assert.deepEqual(fixed.items.find(i=>i.assetId==='lamp'),lamp);assert.ok(book.x<1000&&book.y<1000);assert.equal(pen.x-book.x,source.items[1].x-source.items[0].x);assert.equal(pen.y-book.y,source.items[1].y-source.items[0].y);assert.equal(P.contact(book,pen,fixed,D,E),true);assert.deepEqual(E.layoutIssues(fixed,D),[]);
});
test('physical classes and directed support pairs are independent of color roles',()=>{
 assert.equal(R.physicalClass('book'),'surfaces');assert.equal(R.physicalClass('lamp'),'standing');assert.equal(R.physicalClass('phone'),'portable');assert.equal(R.physicalClass('headphones'),'independent');
 for(const base of R.subjects)for(const child of R.subjects)assert.equal(Boolean(P.allowed({assetId:base},{assetId:child})),['book','folder'].includes(base)&&['phone','puzzle','pen','wallet','coin'].includes(child));
 const s=E.arrange(scene([item('book'),item('pen',0,0,{role:'background'})]),D);const base=s.items.find(i=>i.assetId==='book'),pen=s.items.find(i=>i.assetId==='pen');pen.role='main';pen.supportUid=base.uid;const slot=E.contactSlot(s,D,base,pen);pen.x=slot.x;pen.y=slot.y;E.orderLayers(s);assert.equal(E.validContact(s,D,base,pen),true);
 base.role='background';E.orderLayers(s);assert.equal(E.validContact(s,D,base,pen),true);
});
test('source body masks exist for all forty size/role SVG variants and shadows are not solid bodies',()=>{
 for(const id of R.subjects)for(const size of ['S','L'])for(const role of ['main','background']){const body=G.shapes[id+'-'+size+'-'+role].body;assert.ok(body.width>0&&body.height>0);assert.ok(body.rows.flat().length>0)}
 const s=scene([item('wallet'),item('coin',710,500)]);assert.equal(E.objectsOverlap(s,D,...s.items),true);assert.equal(P.intersects(...s.items,s,D,E),false);
});
test('forged support IDs do not permit a sheet to intersect a standing lamp or another sheet',()=>{
 for(const id of ['lamp','folder']){const s=scene([item(id),item('book',500,500,{supportUid:'iphysical'+id})]);assert.ok(E.layoutIssues(s,D).some(i=>i.type==='invalid-support'));assert.throws(()=>E.exportSvg(s,D),/наложение/)}
});
test('two portable objects cannot occupy the same part of a shared surface',()=>{
 const base=item('book',800,800),phone=item('phone',900,700,{supportUid:base.uid}),puzzle=item('puzzle',900,700,{supportUid:base.uid});const original=E.createScene({size:'S',format:'custom',width:2000,height:2000,items:[base,phone,puzzle]});
 assert.ok(E.layoutIssues(original,D).some(i=>i.type==='collision'));const fixed=P.constrain(original,D,E);assert.deepEqual(E.layoutIssues(fixed,D),[]);assert.equal(P.intersects(fixed.items.find(i=>i.assetId==='phone'),fixed.items.find(i=>i.assetId==='puzzle'),fixed,D,E),false);assert.equal(fixed.scale,1);
});
test('a thematic collection stays separate even when its asset types could form a stack',()=>{
 const source=E.createScene({size:'S',items:[item('folder'),item('wallet'),item('coin')],groups:[{kind:'collection',members:['iphysicalfolder','iphysicalwallet','iphysicalcoin'],reason:'Related financial items, placed separately.'}]});const fixed=E.arrange(source,D);
 assert.deepEqual(E.layoutIssues(fixed,D),[]);assert.ok(fixed.items.every(i=>!i.supportUid));for(let a=0;a<fixed.items.length;a++)for(let b=a+1;b<fixed.items.length;b++)assert.equal(P.intersects(fixed.items[a],fixed.items[b],fixed,D,E),false);
});
test('constrained manual movement fixes only the dragged group, not the other subjects',()=>{
 const before=E.createScene({size:'S',format:'custom',width:2000,height:2000,items:[item('book',700,700),item('lamp',1600,400)]});assert.deepEqual(E.layoutIssues(before,D),[]);
 const next=E.moveScene(before,D,'iphysicallamp',{x:700,y:700},{resolve:true});assert.deepEqual(E.layoutIssues(next,D),[]);assert.deepEqual(next.items.find(i=>i.assetId==='book'),before.items[0]);assert.equal(next.items.find(i=>i.assetId==='lamp').supportUid,undefined);
});
test('main geometry repair does not repack unrelated background objects',()=>{
 const bg=item('flowers',83,174,{role:'background',crop:'fragment',zone:'top-left'}),s=scene([bg,item('folder'),item('wallet'),item('coin')]);const fixed=P.constrain(s,D,E);assert.deepEqual(fixed.items.find(i=>i.uid===bg.uid),bg);assert.deepEqual(E.layoutIssues(fixed,D),[]);
});
test('editing one object on a shared surface leaves its sibling and support fixed',()=>{
 const items=['book','phone','puzzle'].map(id=>item(id)),source=E.arrange(E.createScene({size:'S',items,groups:[{kind:'surface',members:items.map(i=>i.uid),reason:'Shared surface.'}]}),D),next=E.clone(source),phone=next.items.find(i=>i.assetId==='phone'),puzzle=next.items.find(i=>i.assetId==='puzzle');phone.x=puzzle.x;phone.y=puzzle.y;
 assert.ok(E.layoutIssues(next,D).length);const fixed=P.constrain(next,D,E,{movable:[phone.uid]});assert.deepEqual(E.layoutIssues(fixed,D),[]);
 for(const id of ['book','puzzle'])assert.deepEqual(fixed.items.find(i=>i.assetId===id),source.items.find(i=>i.assetId===id));
});
test('native S/L repairs collisions without source scaling and keeps geometry valid through project memory',()=>{
 const source=E.arrange(scene([item('folder'),item('wallet'),item('coin')]),D);const larger=V.changeSize(source,'L',D,E);assert.equal(larger.scale,1);assert.equal(larger.width,source.width);assert.deepEqual(E.layoutIssues(larger,D),[]);const clean=E.validateScene(JSON.parse(JSON.stringify(larger)),D);const small=V.changeSize(clean,'S',D,E);assert.deepEqual(E.layoutIssues(small,D),[]);assert.deepEqual(small.items,source.items);
 if(clean.sizeGeometryOrigin){const removed=E.clone(clean);removed.items.pop();assert.doesNotThrow(()=>E.validateScene(removed,D))}
});
