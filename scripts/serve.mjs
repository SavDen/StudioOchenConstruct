import http from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {readVisualCatalog} from './visual_catalog.mjs';
import {createGatewayPolicy} from './gateway-policy.mjs';
const require=createRequire(import.meta.url);
const E=require('../dist/engine.js'),AI=require('../dist/ai-plan.js'),V=require('../dist/composition-view.js');
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const data={manifest:JSON.parse(await fs.readFile(path.join(ROOT,'library/manifest.json'),'utf8')),palettes:JSON.parse(await fs.readFile(path.join(ROOT,'library/palettes.json'),'utf8'))};
const system=await fs.readFile(path.join(ROOT,'prompts/composition-system.txt'),'utf8');
function parseEnv(text){return Object.fromEntries(text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const n=l.indexOf('=');let v=l.slice(n+1).trim();if(v.length>1&&v[0]===v.at(-1)&&['"',"'"].includes(v[0]))v=v.slice(1,-1);return [l.slice(0,n).trim(),v]}))}
export async function readConfig(){
 let config={};
 for(const file of [path.join(ROOT,'..','.env.proxy'),path.join(ROOT,'.env')]){try{config={...config,...parseEnv(await fs.readFile(file,'utf8'))}}catch(error){if(error.code!=='ENOENT')throw error}}
 return {...config,...process.env};
}
export function createStudioServer({config={},fetchImpl=fetch,visualCatalog=null}={}){
 let busy=0;const requests=[],policy=createGatewayPolicy(config);
 return http.createServer({maxHeaderSize:16384,requestTimeout:30000,headersTimeout:15000},async(req,res)=>{
  const json=(status,body)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))}};
  const controller=new AbortController();res.on('close',()=>{if(!res.writableFinished)controller.abort()});let timer,entered=false;
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname.startsWith('/api/')){
    const access=policy.authorize(req,res);
    if(!access.ok)return json(403,{error:'Запрос с этого адреса запрещён.'});
    if(access.preflight){res.writeHead(204);res.end();return}
    const configured=Boolean(config.GEMINI_PROXY_URL&&config.GEMINI_PROXY_TOKEN);
    if(req.method==='GET'&&url.pathname==='/api/ai-status')return json(200,{configured,vision:!!visualCatalog,model:config.GEMINI_MODEL||'gemini-flash-lite-latest'});
    if(req.method==='GET'&&url.pathname==='/api/ai-prompt')return json(200,{system,responseSchema:AI.responseSchema(data,E,E.createScene(),{staging:!!visualCatalog}),context:AI.brief('Ваш запрос',E.createScene(),data,E),visualCatalog:visualCatalog?{sourceHash:visualCatalog.sourceHash,sheetsPerSize:2}:null});
    if(req.method!=='POST'||url.pathname!=='/api/compose')return json(404,{error:'Метод не найден.'});
    if(!configured)return json(503,{error:'Gemini не настроен. Заполните .env проекта или соседний .env.proxy и перезапустите npm start.'});
    const proxyURL=new URL(config.GEMINI_PROXY_URL);
    if(proxyURL.protocol!=='https:')return json(503,{error:'Для прокси Gemini требуется HTTPS.'});
    if(!(req.headers['content-type']||'').startsWith('application/json'))return json(415,{error:'Ожидается JSON.'});
    if(Number(req.headers['content-length'])>30000)return json(413,{error:'Слишком большой запрос.'});
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>30000)return json(413,{error:'Слишком большой запрос.'});chunks.push(chunk)}
    let input;try{input=JSON.parse(Buffer.concat(chunks))}catch{return json(400,{error:'Некорректный JSON.'})}
    if(!input||typeof input.query!=='string'||!input.query.trim()||input.query.length>600)return json(400,{error:'Введите тему длиной от 1 до 600 символов.'});
    let base;try{base=E.validateScene(input.scene,data)}catch{return json(400,{error:'Некорректные настройки композиции.'})}
    base.query=input.query.trim();
    const mode=input.mode||"compose";
    if(!["compose","environment"].includes(mode))return json(400,{error:"Неизвестный режим сборки."});
    if(mode==="environment"&&!base.items.some(i=>i.role==="main"))return json(400,{error:"Сначала добавьте главные предметы."});
    if(access.public){const limit=policy.consume(req);if(!limit.ok){res.setHeader('Retry-After',String(limit.retryAfter));return json(429,{error:'Достигнут лимит демонстрационного API. Подождите и повторите запрос.'})}}
    while(requests.length&&requests[0]<Date.now()-60000)requests.shift();
    if(busy>=2||requests.length>=12)return json(429,{error:'Слишком много запросов. Подождите минуту и повторите.'});
    busy++;requests.push(Date.now());entered=true;timer=setTimeout(()=>controller.abort(),125000);
    const started=Date.now();
    const requestSystem=system+'\n\nОБЯЗАТЕЛЬНЫЕ НАСТРОЙКИ ЭТОГО ЗАПРОСА\nРежим: '+mode+'. Раскладка: '+base.layout+'. '+(AI.allows(base,E)?'Добавь ровно один логичный фоновый предмет-компаньон по умолчанию. Он заполняет свободное место, тише главной группы и не перекрывает её важные части. Несколько компаньонов — только по явной просьбе. Паттерн фона не считается компаньоном.':'Пользователь прямо запретил фоновые предметы в тексте. У КАЖДОГО предмета items роль только main; background запрещена.');
    const vision=!!visualCatalog&&base.sizing==='native',model=config.GEMINI_MODEL||'gemini-flash-lite-latest';
    if(!/^[a-zA-Z0-9_.-]+$/.test(model))return json(503,{error:'Некорректная модель Gemini.'});
    const brief=AI.brief(base.query,base,data,E,{mode});if(vision)delete brief.recipes;if(vision)brief.visualCatalog={sourceSize:base.size,sheets:['main','background'],nativeScale:1};
    const generationConfig={temperature:0.3,maxOutputTokens:vision?8192:4096,responseMimeType:'application/json',responseSchema:AI.responseSchema(data,E,base,{mode,staging:vision})};
    // The nine placement banks exceed Google's constrained-schema complexity.
    // JSON mode keeps the full schema in the brief; identical strict validation runs below.
    if(vision){brief.responseSchema=generationConfig.responseSchema;delete generationConfig.responseSchema}
    const parts=vision?[{text:JSON.stringify(brief)},...visualCatalog.images[base.size].flatMap(i=>[{text:i.label},{inlineData:i.inlineData}])]:null;
    const upstreamPath=vision?'/v1beta/models/'+model+':generateContent':'/api/chat';
    const requestBody=vision?{systemInstruction:{parts:[{text:requestSystem}]},contents:[{role:'user',parts}],generationConfig}:{model,system:requestSystem,message:JSON.stringify(brief),generationConfig};
    let response;
    for(let attempt=0;attempt<2;attempt++){
     response=await fetchImpl(new URL(upstreamPath,proxyURL),{method:'POST',headers:{Authorization:'Bearer '+config.GEMINI_PROXY_TOKEN,'Content-Type':'application/json'},signal:controller.signal,redirect:'error',body:JSON.stringify(requestBody)});
     if(attempt===1||![502,503,504].includes(response.status))break;
     await response.body?.cancel();await delay(600,undefined,{signal:controller.signal});
    }
    if(!response.ok){
     await response.body?.cancel();
     const message=response.status===429?'Достигнут лимит Gemini. Подождите и повторите запрос.':response.status===400?'Gemini отклонил формат запроса. Проверьте промпт и схему ответа.':[401,403].includes(response.status)?'Прокси отклонил авторизацию. Проверьте токен в env и перезапустите npm start.':'Сервер Gemini временно недоступен (HTTP '+response.status+'). Попробуйте позже или выберите «По словам».';
     return json(response.status===429?429:502,{error:message});
    }
    const upstream=await response.json(),candidate=upstream.candidates?.[0],raw=vision?{text:(candidate?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join(''),finishReason:candidate?.finishReason,model:upstream.modelVersion||model,usage:upstream.usageMetadata}:upstream;
    if(raw.finishReason&&raw.finishReason!=='STOP')return json(502,{error:'Gemini не завершил план ('+String(raw.finishReason).slice(0,40)+'). Попробуйте более короткий запрос.'});
    let plan,result,variants,collection=null;try{let decoded=JSON.parse(raw.text);if(vision)decoded=AI.hydrateVisualPlan(decoded,base,E,{mode,data});if(vision&&decoded.status==='ready'&&!(mode==='environment'?decoded.environmentLayout:decoded.staging))throw Error('План Gemini не принят: отсутствует план размещения');plan=AI.validatePlan(decoded,base,data,E,{mode});if(mode==="environment"){result=AI.applyEnvironment(plan,base,data,E);variants=null}else if(base.sizing==="native"){collection=AI.buildCollection(plan,base,data,E);variants=collection?V.scenesFor(collection):[];result=collection?V.current(collection):null}else{variants=AI.buildVariants(plan,base,data,E);result=variants[0]||null}}catch(error){return json(502,{error:/^(План Gemini|Не удалось|Главная группа|После коррекции|Внешний предмет|Предметы на одной опоре)/.test(error.message)?error.message:'Gemini вернул некорректный план. Сцена сохранена. Повторите запрос.'})}
    return json(200,{mode,plan,scene:result,variants,collection,vision,model:raw.model,usage:raw.usage,elapsedMs:Date.now()-started});
   }
   if(config.AI_API_ONLY==='1')return json(404,{error:'Метод не найден.'});
   if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Метод не поддерживается.'});
   const pathname=decodeURIComponent(url.pathname),review=pathname.startsWith('/reviews/'),baseDir=review?path.join(ROOT,'exports'):DIST,relative=review?pathname.slice('/reviews'.length):pathname,normalized=relative.endsWith('/')?relative+'index.html':relative,file=path.resolve(baseDir,'.'+normalized);
   if(!file.startsWith(baseDir+path.sep)||pathname.split('/').some(p=>p.startsWith('.')))return json(404,{error:'Файл не найден.'});
   const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())return json(404,{error:'Файл не найден.'});
   const content=await fs.readFile(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.zip':'application/zip'};
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':content.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
  }catch(error){if(!res.headersSent)json(error.code==='ENOENT'?404:controller.signal.aborted?504:502,{error:controller.signal.aborted?'Запрос прерван или превысил время ожидания.':'Не удалось выполнить запрос. Проверьте соединение и повторите.'});else res.destroy()}
  finally{clearTimeout(timer);if(entered)busy--}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const config=await readConfig(),visualCatalog=await readVisualCatalog(),server=createStudioServer({config,visualCatalog}),port=Number(process.env.PORT||8000);
 server.listen(port,config.HOST||'127.0.0.1',()=>console.log(`Конструктор: http://localhost:${port}/ · Gemini ${config.GEMINI_PROXY_TOKEN?'подключён':'не настроен'}`));
}
