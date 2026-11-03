import fs from "node:fs/promises";
import path from "node:path";
import {createRequire} from "node:module";
const root=path.resolve(import.meta.dirname,"..");let req=createRequire(import.meta.url),sharp;
if(process.env.SVG_NODE_MODULES)req=createRequire(path.join(process.env.SVG_NODE_MODULES,"_runtime.cjs"));
try{sharp=req("sharp")}catch{sharp=createRequire("/Users/DenS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/_runtime.cjs")("sharp")}
for(const id of ["education","finance","teamwork"]){
 const src=path.join(root,"qa/examples",id+".svg");
 await sharp(src).resize({width:1000}).png().toFile(path.join(root,"qa/examples",id+".png"));
 console.log(id+".png");
}
