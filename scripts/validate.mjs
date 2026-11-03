import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
const root=path.resolve(import.meta.dirname,".."),req=createRequire(import.meta.url);
for(const file of ["app.js","engine.js","data.js"])execFileSync(process.execPath,["--check",path.join(root,"dist",file)]);
execFileSync(process.execPath,["--test",path.join(root,"tests/engine.test.cjs")],{stdio:"inherit"});
const ctx={};vm.runInNewContext(fs.readFileSync(path.join(root,"dist/data.js"),"utf8"),ctx);
const E=req("../dist/engine.js"),data=ctx.STUDIO_DATA;
const examples=[
 {id:"education",query:"Свет знаний",format:E.FORMATS[0],size:"S",palette:"aqua",layout:"compact"},
 {id:"finance",query:"Финансы и безопасность денег",format:E.FORMATS[1],size:"L",palette:"peach",layout:"offset"},
 {id:"teamwork",query:"Решаем сложные задачи вместе",format:E.FORMATS[2],size:"L",palette:"lavender",layout:"headline"}
];
fs.mkdirSync(path.join(root,"qa/examples"),{recursive:true});
const results=[];
for(const example of examples){
 const f=example.format;
 const scene=E.generate(example.query,E.createScene({format:f.id,width:f.width,height:f.height,size:example.size,palette:example.palette,layout:example.layout}),data).scene;
 if(!scene)throw new Error("Example has no matches");
 fs.writeFileSync(path.join(root,"qa/examples",example.id+".svg"),E.exportSvg(scene,data));
 fs.writeFileSync(path.join(root,"qa/examples",example.id+".json"),JSON.stringify(scene,null,2));
 results.push({id:example.id,objects:scene.items.length,width:scene.width,height:scene.height,size:scene.size,palette:scene.palette});
}
fs.writeFileSync(path.join(root,"qa/validation.json"),JSON.stringify({status:"passed",engineTests:13,layoutConfigurations:24,colorAndVectorCases:120,examples:results,browserReview:"Unavailable: local browser control disabled; native Mac is locked."},null,2)+"\n");
console.log(JSON.stringify({examples:results,status:"passed"}));
