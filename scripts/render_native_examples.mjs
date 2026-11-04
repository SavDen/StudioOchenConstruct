import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url);
const sharp=require('sharp');
const E=require('../dist/engine.js'),V=require('../dist/composition-view.js'),context={};
vm.runInNewContext(await fs.readFile(path.join(root,'dist/data.js'),'utf8'),context);
const data=context.STUDIO_DATA,dir=path.join(root,'qa/native-layout');await fs.mkdir(dir,{recursive:true});
const source=E.generate('Любит писать',E.createScene({palette:'lavender'}),data).scene;
const jobs=V.variants(source,data,E).map((scene,index)=>({id:'writing-'+index,scene,label:['Ручка на книге','Ручка рядом','Ручка поперёк'][index]}));
for(const [id,query]of [['audio','наушники'],['team','телефон пазл'],['finance','кошелёк монета']])jobs.push({id,scene:E.generate(query,E.createScene({palette:'lavender'}),data).scene,label:query});
const layers=[];
for(let index=0;index<jobs.length;index++){
 const {id,scene,label}=jobs[index],svg=E.exportSvg(scene,data);
 await fs.writeFile(path.join(dir,id+'.svg'),svg);await fs.writeFile(path.join(dir,id+'.json'),JSON.stringify(scene,null,2)+'\n');
 await sharp(Buffer.from(svg)).png().toFile(path.join(dir,id+'.png'));
 const thumb=await sharp(Buffer.from(svg)).resize({width:340,height:340,fit:'contain'}).png().toBuffer(),x=index%3*360,y=Math.floor(index/3)*390;
 layers.push({input:thumb,left:x+10,top:y});
 layers.push({input:Buffer.from('<svg width="360" height="40"><text x="10" y="24" font-size="14" font-family="Helvetica">'+label+'</text></svg>'),left:x,top:y+344});
}
await sharp({create:{width:1080,height:780,channels:4,background:'#f7f5f1'}}).composite(layers).png().toFile(path.join(dir,'contact.png'));
console.log('Rendered six native-size SVG/JSON/PNG scenes and comparison sheet.');
