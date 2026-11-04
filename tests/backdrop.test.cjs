const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../dist/engine'),V=require('../dist/composition-view'),c={};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/data.js'),'utf8'),c);const D=c.STUDIO_DATA;
const paths=s=>[...s.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map(m=>m[1]);
test('backdrop designs use their original S/L paths at native scale in all three formats',()=>{
 for(const size of ['S','L'])for(const format of E.FORMATS.filter(f=>V.OUTPUTS.includes(f.id)))for(const design of ['details','table']){
  const scene=E.createScene({size,format:format.id,width:format.width,height:format.height,backgroundDesign:design,palette:'lavender'}),svg=E.backgroundMarkup(scene,D),source=D.manifest.backdrops.find(b=>b.size===size&&b.palette===(design==='table'?'peach':'lavender'));
  assert.deepEqual(paths(svg).sort(),paths(D.svgs[source.path]).sort());assert.doesNotMatch(svg,/scale\(/);assert.match(svg,new RegExp('data-backdrop-source="'+source.id+'"'));assert.match(svg,/overflow="hidden"/);
  const anchors=[...svg.matchAll(/data-backdrop-anchor="([^"]+)" transform="translate\(([-\d.]+) ([-\d.]+)\)"/g)];assert.ok(anchors.length>=2);
  for(const [,anchor,x,y]of anchors){assert.ok(Math.abs(Number(x)-(anchor.endsWith('right')?format.width-source.nativeWidth:0))<.001);assert.ok(Math.abs(Number(y)-(anchor.startsWith('bottom')?format.height-source.nativeHeight:0))<.001)}
 }
});
test('background follows the shared palette while design changes preserve subject geometry',()=>{
 const scene=E.validateScene(E.generate('книга ручка',E.createScene({size:'S',palette:'lavender'}),D).scene,D),next=E.validateScene({...scene,backgroundDesign:'table',palette:'lavender'},D);
 assert.equal(next.palette,scene.palette);assert.deepEqual(next.items,scene.items);assert.deepEqual(next.camera,scene.camera);
 assert.equal(next.items.map(i=>E.objectMarkup(i,next,D)).join(''),scene.items.map(i=>E.objectMarkup(i,scene,D)).join(''));
 const bg=E.backgroundMarkup(next,D);assert.match(bg,/#D7CDF5/);assert.match(bg,/#AA9BF0/);assert.doesNotMatch(bg,/#FDD7B9|#FAC896|#D27532/);
 for(const palette of D.palettes.palettes){const colored=E.backgroundMarkup({...next,palette:palette.id},D);for(const slot of ['background.base','background.mid','background.dark'])assert.ok(colored.includes(palette.slots[slot]))}
 assert.match(E.exportSvg(next,D),/data-backdrop-source="peach-S"/);
 assert.equal(E.backgroundMarkup({...next,background:'transparent'},D),'');assert.doesNotMatch(E.backgroundMarkup({...next,background:'solid'},D),/<path/);
});
test('old projects inherit the matching background while explicit choices validate and persist',()=>{
 const old=E.createScene({palette:'peach'});delete old.backgroundDesign;delete old.backgroundPalette;const migrated=E.validateScene(old,D);assert.equal(E.backdropDesignFor(migrated),'table');assert.equal(E.paletteFor(migrated,D).id,'peach');
 assert.equal(E.backdropDesignFor({...migrated,palette:'aqua'}),'details');assert.equal(E.backdropDesignFor({...migrated,palette:'aqua',backgroundDesign:'table'}),'table');
 assert.throws(()=>E.validateScene({...old,backgroundDesign:'injected'},D),/рисунок/);assert.equal(E.validateScene({...old,backgroundPalette:'lavender'},D).backgroundPalette,undefined);assert.match(E.backgroundMarkup({...migrated,backgroundPalette:'lavender'},D),/data-backdrop-palette="peach"/);
});
test('each format and variant retains its own backdrop through JSON and S/L switching',()=>{
 const scene=E.generate('ручка',E.createScene({size:'S'}),D).scene;let memory=V.createCollection(scene,D,E),first={...V.current(memory),backgroundDesign:'table',palette:'lavender'};
 memory=V.selectVariant(memory,first,1,D,E);const second={...V.current(memory),backgroundDesign:'details',palette:'peach'};memory=V.selectFormat(memory,second,'portrait',D,E);memory=V.selectFormat(memory,V.current(memory),'square',D,E);assert.equal(V.current(memory).palette,'peach');
 memory=V.selectVariant(memory,V.current(memory),0,D,E);memory=V.validateMemory(JSON.parse(JSON.stringify(memory)),D,E);assert.equal(V.current(memory).palette,'lavender');assert.equal(V.current(memory).backgroundDesign,'table');
 const bigger=V.changeSize(V.current(memory),'L',D,E);assert.equal(bigger.backgroundDesign,'table');assert.equal(bigger.palette,'lavender');assert.match(E.backgroundMarkup(bigger,D),/data-backdrop-source="peach-L"/);
});
