import fs from 'node:fs/promises';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),E=require('../dist/engine.js'),R=require('../dist/interaction-registry.js');
const sharp=require('sharp');
const ctx={};vm.runInNewContext(await fs.readFile(path.join(root,'dist/data.js'),'utf8'),ctx);const D=ctx.STUDIO_DATA;
await fs.mkdir(path.join(root,'qa/registry'),{recursive:true});
for(const rule of R.supports){
 const layers=[];let row=0;
 for(const size of ['S','L'])for(const role of ['main','background']){
  for(let col=0;col<rule.anchors.length;col++){
   const scale=size==='S'?.98:.49,v=E.variant(D,rule.back,size,role),offset=rule.anchors[col];
   const back={uid:'ibase',assetId:rule.back,role,x:600,y:335,rotation:0},front={uid:'ichild',assetId:rule.front,role:'main',x:600+offset[0]*v.nativeWidth*scale,y:335+offset[1]*v.nativeHeight*scale,rotation:0};
   const scene=E.createScene({size,scale,palette:'lavender',background:'solid',items:[back,front]});
   const svg=E.exportSvg(scene,D);await fs.writeFile(path.join(root,'qa/registry',rule.id+'-'+size+'-'+role+'-'+col+'.svg'),svg);
   layers.push({input:await sharp(Buffer.from(svg)).resize(360,189).png().toBuffer(),left:col*360,top:row*225});
   layers.push({input:Buffer.from('<svg width="360" height="36"><text x="12" y="24" font-size="15" fill="#181817">'+size+' / '+role+' / slot '+(col+1)+'</text></svg>'),left:col*360,top:row*225+189});
  }row++;
 }
 await sharp({create:{width:1080,height:900,channels:4,background:'#faf8ff'}}).composite(layers).png().toFile(path.join(root,'qa/registry',rule.id+'.png'));
}
console.log('Rendered10 interaction sheets:120 source size/role/anchor variations.');
