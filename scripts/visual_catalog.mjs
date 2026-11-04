import fs from 'node:fs/promises';
export async function readVisualCatalog(){
 const root=new URL('../library/vision/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8')),images={S:[],L:[]};
 for(const sheet of manifest.sheets){if(!['S','L'].includes(sheet.size)||!['main','background'].includes(sheet.role)||sheet.file!==sheet.size+'-'+sheet.role+'.png')throw Error('Invalid visual catalog');const data=await fs.readFile(new URL(sheet.file,root));images[sheet.size].push({label:sheet.size+' '+sheet.role+' assets: '+manifest.preview,inlineData:{mimeType:'image/png',data:data.toString('base64')}})}
 if(images.S.length!==2||images.L.length!==2)throw Error('Incomplete visual catalog');return {version:manifest.version,sourceHash:manifest.sourceHash,images};
}
