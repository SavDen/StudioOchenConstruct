import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=JSON.parse(await fs.readFile(path.join(root,'docs','generation-baseline.json'),'utf8'));
const changed=[],missing=[];
for(const row of baseline.files){
 try{const bytes=await fs.readFile(path.join(root,row.path));if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)changed.push(row.path)}
 catch(error){if(error.code==='ENOENT')missing.push(row.path);else throw error}
}
console.log(JSON.stringify({baseline:baseline.id,checked:baseline.files.length,changed,missing},null,2));
if(changed.length||missing.length)process.exitCode=1;
