import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {createRequire} from "node:module";
const root=path.resolve(import.meta.dirname,".."),req=createRequire(import.meta.url),E=req("../dist/engine.js");
const context={};vm.runInNewContext(fs.readFileSync(path.join(root,"dist/data.js"),"utf8"),context);const data=context.STUDIO_DATA;
const examples=[
 ["writing","Обучение письму","landscape","S","lavender","compact"],
 ["writing-portrait","Обучение письму","portrait","L","lavender","compact"],
 ["education","Свет знаний","landscape","S","aqua","compact"],
 ["online","Обучение онлайн","square","L","lavender","compact"],
 ["finance","Финансы под контролем","square","L","peach","offset"],
 ["documents","Порядок в документах","landscape","S","lavender","compact"],
 ["audio","Музыка и подкасты","wide","L","aqua","compact"],
 ["teamwork","Решаем задачи вместе","portrait","L","lavender","compact"],
 ["care","Забота и подарки","portrait","S","peach","compact"],
 ["study-portrait","Свет знаний","portrait","L","aqua","offset"],
 ["headline","Обучение онлайн","landscape","L","lavender","headline"]
];
fs.mkdirSync(path.join(root,"qa/examples"),{recursive:true});
const results=[];
for(const [id,query,format,size,palette,layout]of examples){
 const f=E.FORMATS.find(f=>f.id===format),scene=E.generate(query,E.createScene({format,width:f.width,height:f.height,size,palette,layout,supporting:!id.startsWith("writing"),framing:id.startsWith("writing")?"overview":"focus",focus:id.startsWith("writing")?"book":"auto"}),data).scene;
 if(!scene)throw new Error("Example has no subjects: "+id);
 fs.writeFileSync(path.join(root,"qa/examples",id+".svg"),E.exportSvg(scene,data));
 fs.writeFileSync(path.join(root,"qa/examples",id+".json"),JSON.stringify(scene,null,2));
 results.push({id,query,recipe:E.recipeFor(scene).id,objects:scene.items.length,width:scene.width,height:scene.height,size,palette,layout,framing:scene.framing,focus:E.focusFor(scene).assetId});
}
fs.writeFileSync(path.join(root,"qa/examples/index.json"),JSON.stringify(results,null,2)+"\n");
console.log(JSON.stringify({examples:results.length,recipes:E.RULES.recipes.length}));
