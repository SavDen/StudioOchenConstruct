import fs from "node:fs/promises";
import path from "node:path";
import {createRequire} from "node:module";
const root=path.resolve(import.meta.dirname,"..");
let req=createRequire(import.meta.url),sharp;
if(process.env.SVG_NODE_MODULES)req=createRequire(path.join(process.env.SVG_NODE_MODULES,"_runtime.cjs"));
sharp=req("sharp");
const examples=JSON.parse(await fs.readFile(path.join(root,"qa/examples/index.json"),"utf8")),layers=[];
const escape=s=>s.replaceAll("&","&amp;").replaceAll("<","&lt;");
for(let i=0;i<examples.length;i++){
 const example=examples[i],src=path.join(root,"qa/examples",example.id+".svg");
 await sharp(src).resize({width:1000}).png().toFile(path.join(root,"qa/examples",example.id+".png"));
 const thumb=await sharp(src).resize({width:404,height:285,fit:"contain",background:"#f8f8f5"}).png().toBuffer();
 const x=i%3*420,y=Math.floor(i/3)*330;
 layers.push({input:thumb,left:x+8,top:y+5});
 const label=Buffer.from('<svg width="420" height="40"><text x="10" y="25" font-size="14" font-family="Helvetica" fill="#181817">'+escape(example.query)+'</text></svg>');
 layers.push({input:label,left:x,top:y+290});
}
await sharp({create:{width:1260,height:Math.ceil(examples.length/3)*330,channels:4,background:"#f8f8f5"}}).composite(layers).png().toFile(path.join(root,"qa/scene-contact.png"));
console.log("Rendered "+examples.length+" compositions and contact sheet");
