import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url);
const sharp=require('sharp');
const context={};vm.runInNewContext(await fs.readFile(path.join(root,'dist/data.js'),'utf8'),context);const D=context.STUDIO_DATA,shapes={};
await fs.mkdir(path.join(root,'qa/source-audit'),{recursive:true});
for(const size of ['S','L'])for(const role of ['main','background']){
 const cells=[];
 for(let index=0;index<D.manifest.assets.length;index++){
  const a=D.manifest.assets[index],v=a.variants[size][role],source=Buffer.from(D.svgs[v.path]);
  const {data,info}=await sharp(source).resize({width:384,height:384,fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const points=[];let weight=0,cx=0,cy=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>1){
   const px=(x+.5)/info.width*v.nativeWidth,py=(y+.5)/info.height*v.nativeHeight;
   points.push([px,py]);weight++;cx+=px;cy+=py;
  }
  // Circumscribed support polygon, padded for raster sampling uncertainty.
  // This is conservative collision metadata; it never replaces source paths.
  const padding=2.5*Math.max(v.nativeWidth/info.width,v.nativeHeight/info.height),planes=[];
  for(let k=0;k<16;k++){const angle=k*Math.PI/8,nx=Math.cos(angle),ny=Math.sin(angle);let limit=-Infinity;for(const p of points)limit=Math.max(limit,nx*p[0]+ny*p[1]);planes.push({nx,ny,limit:limit+padding})}
  const hull=planes.map((a,k)=>{const b=planes[(k+1)%16],det=a.nx*b.ny-a.ny*b.nx;return [(a.limit*b.ny-a.ny*b.limit)/det/v.nativeWidth,(a.nx*b.limit-a.limit*b.nx)/det/v.nativeHeight]});
  // Body-only metadata: remove shadow/outline underlays, then fill enclosed
  // dark details. Original SVGs and the legacy full-paint envelopes stay intact.
  const bodySource=D.svgs[v.path].replace(/<path\b[^>]*data-fill-slot="(?:ink|background.dark)"[^>]*\/>/g,'');
  const raster=await sharp(Buffer.from(bodySource)).resize({width:128,height:128,fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const bw=raster.info.width,bh=raster.info.height,mask=new Uint8Array(bw*bh),outside=new Uint8Array(bw*bh),queue=[];
  for(let i=0;i<mask.length;i++)mask[i]=raster.data[i*4+3]>64?1:0;
  const add=(x,y)=>{if(x<0||y<0||x>=bw||y>=bh)return;const i=y*bw+x;if(!mask[i]&&!outside[i]){outside[i]=1;queue.push(i)}};
  for(let x=0;x<bw;x++){add(x,0);add(x,bh-1)}for(let y=0;y<bh;y++){add(0,y);add(bw-1,y)}
  for(let i=0;i<queue.length;i++){const p=queue[i],x=p%bw,y=Math.floor(p/bw);add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1)}
  const bodyPoints=[],rows=[];
  for(let y=0;y<bh;y++){const runs=[];let start=-1;for(let x=0;x<=bw;x++){const filled=x<bw&&(mask[y*bw+x]||!outside[y*bw+x]);if(filled){bodyPoints.push([(x+.5)/bw,(y+.5)/bh]);if(start<0)start=x}else if(start>=0){runs.push([start,x-1]);start=-1}}rows.push(runs)}
  if(!bodyPoints.length)throw Error('Empty physical mask: '+a.id+'-'+size+'-'+role);
  shapes[a.id+'-'+size+'-'+role]={hull,paintRatio:weight/(info.width*info.height),centroid:[cx/weight/v.nativeWidth,cy/weight/v.nativeHeight],body:{width:bw,height:bh,rows}};
  const thumb=await sharp(source).resize({width:260,height:230,fit:'contain',background:'#e9e2f8'}).png().toBuffer();
  const x=index%5*280,y=Math.floor(index/5)*275;
  cells.push({input:thumb,left:x+10,top:y+5});
  cells.push({input:Buffer.from('<svg width="280" height="35"><text x="10" y="24" font-size="16" fill="#181817">'+a.id+' / '+size+' / '+role+'</text></svg>'),left:x,top:y+235});
 }
 await sharp({create:{width:1400,height:550,channels:4,background:'#faf8ff'}}).composite(cells).png().toFile(path.join(root,'qa/source-audit',size+'-'+role+'.png'));
}
const output='/* Conservative, padded source-SVG collision envelopes. Rebuild: node scripts/build_geometry.mjs. */\n(function(r,f){const v=f();if(typeof module==="object"&&module.exports)module.exports=v;else r.SourceGeometry=v})(typeof globalThis!=="undefined"?globalThis:this,function(){return '+JSON.stringify({version:1,method:'16 padded alpha support planes at384px; original vector paths remain authoritative',shapes})+'});\n';
await fs.writeFile(path.join(root,'dist/geometry.js'),output);
console.log('Generated40 conservative envelopes and4 source inspection sheets.');
