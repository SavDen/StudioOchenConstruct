import {isIP} from 'node:net';

// Public access is explicit. Local development keeps its original same-origin rule.
export function createGatewayPolicy(config={}, {now=Date.now}={}){
 const publicHost=(config.AI_PUBLIC_HOST||'').trim().toLowerCase();
 const origins=new Set((config.AI_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean));
 if(Boolean(publicHost)!==Boolean(origins.size)||publicHost&&!/^[a-z0-9.-]+$/.test(publicHost))throw Error('Invalid public gateway configuration');
 for(const origin of origins){const u=new URL(origin);if(u.origin!==origin||u.protocol!=='https:')throw Error('Public origins must be exact HTTPS origins')}
 const positive=(value,fallback)=>{const n=Number(value||fallback);if(!Number.isInteger(n)||n<1||n>100000)throw Error('Invalid gateway limit');return n};
 const perIp=positive(config.AI_PER_IP_LIMIT,4),dailyLimit=positive(config.AI_DAILY_LIMIT,200),clients=new Map();let day='',dailyCount=0;
 function authorize(req,res){
  const host=(req.headers.host||'').replace(/:\d+$/,'').toLowerCase(),origin=req.headers.origin;
  if(['localhost','127.0.0.1','[::1]'].includes(host))return {ok:!origin||origin==='http://'+req.headers.host,public:false};
  if(!publicHost||host!==publicHost||!origins.has(origin))return {ok:false};
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS'){
   const method=req.headers['access-control-request-method'],headers=String(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
   if(!['GET','POST'].includes(method)||headers.some(s=>s!=='content-type'))return {ok:false};
   res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Max-Age','600');return {ok:true,preflight:true,public:true};
  }
  return {ok:true,public:true};
 }
 function consume(req){
  const time=now(),date=new Date(time).toISOString().slice(0,10);
  if(day!==date){day=date;dailyCount=0;clients.clear()}
  const header=String(req.headers['x-studio-client-ip']||''),ip=isIP(header)?header:req.socket.remoteAddress;
  for(const [key,times]of clients){const recent=times.filter(t=>t>time-60000);if(recent.length)clients.set(key,recent);else clients.delete(key)}
  const recent=clients.get(ip)||[];
  if(dailyCount>=dailyLimit)return {ok:false,retryAfter:Math.max(1,Math.ceil((Date.parse(date+'T00:00:00Z')+86400000-time)/1000))};
  if(recent.length>=perIp)return {ok:false,retryAfter:Math.max(1,Math.ceil((recent[0]+60000-time)/1000))};
  recent.push(time);clients.set(ip,recent);dailyCount++;return {ok:true};
 }
 return {authorize,consume};
}
