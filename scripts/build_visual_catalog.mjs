import fs from 'node:fs/promises';import vm from 'node:vm';import{createRequire}from'node:module';import{createHash}from'node:crypto';
const require=createRequire(import.meta.url),E=require('../dist/engine.js'),c={};const sharp=require('sharp');
vm.runInNewContext(await fs.readFile(new URL('../dist/data.js',import.meta.url),'utf8'),c);const D=c.STUDIO_DATA,dir=new URL('../library/vision/',import.meta.url);await fs.mkdir(dir,{recursive:true});const sheets=[];
for(const size of ['S','L'])for(const role of ['main','background']){
 const layers=[];for(const [n,a]of D.manifest.assets.entries()){
  const v=E.variant(D,a.id,size,role),svg=E.recolor(D.svgs[v.path],D.palettes.palettes.find(p=>p.id==='aqua'),role),png=await sharp(Buffer.from(svg)).resize({width:280,height:235,fit:'contain',background:'#BEEBEB'}).png().toBuffer(),left=n%5*300+10,top=Math.floor(n/5)*290+35;
  layers.push({input:png,left,top});layers.push({input:Buffer.from('<svg width="290" height="32"><text x="5" y="20" font-family="Helvetica" font-size="16" fill="#181817">'+a.id+' / '+size+' / '+Math.round(v.nativeWidth)+'x'+Math.round(v.nativeHeight)+'</text></svg>'),left,top:top-30});
 }
 const filename=size+'-'+role+'.png',png=await sharp({create:{width:1500,height:580,channels:4,background:'#BEEBEB'}}).composite(layers).png().toBuffer();await fs.writeFile(new URL(filename,dir),png);sheets.push({size,role,file:filename,sha256:createHash('sha256').update(png).digest('hex')});
}
const sourceHash=createHash('sha256').update(JSON.stringify(D.manifest.assets.map(a=>a.variants))).digest('hex');await fs.writeFile(new URL('manifest.json',dir),JSON.stringify({version:1,sourceHash,preview:'Each cell is fitted for recognition; the labels and catalog nativeSize give true dimensions. Two connected puzzle pieces are ONE puzzle asset.',sheets},null,2));console.log('Built four labeled visual catalogs from the forty original SVG presentations.');
