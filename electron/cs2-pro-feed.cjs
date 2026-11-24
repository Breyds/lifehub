'use strict';
// LifeHub editorial feed. No scraping or bulk copying from third-party lineup sites.
const bundled=require('./pro-picks.json');
const SOURCE='https://raw.githubusercontent.com/Breyds/lifehub/main/electron/pro-picks.json';
const MAPS=new Set(['Mirage','Dust2','Inferno','Nuke','Ancient','Anubis','Overpass','Cache','Train','Vertigo']);
const TYPES=new Set(['smoke','flash','molotov','he']);
const str=(v,max=170)=>typeof v==='string'?v.slice(0,max).replace(/[<>]/g,'').trim():'';
function normalizePick(raw){
 if(!raw||typeof raw!=='object')return null;
 const link=str(raw.url,400);
 try{
  const url=new URL(link);
  if(url.protocol!=='https:'||!['nades.ai','www.nades.ai','nadeiq.app','www.nadeiq.app'].includes(url.hostname))return null;
 }catch{return null;}
 const map=str(raw.map,25),type=str(raw.type,10);
 if(!MAPS.has(map)||!TYPES.has(type)||!str(raw.title)||!str(raw.id))return null;
 return {id:str(raw.id,90),map,type,side:['T','CT'].includes(raw.side)?raw.side:'',title:str(raw.title,150),label:str(raw.label,30),technique:str(raw.technique,120),timing:str(raw.timing,80),players:str(raw.players,120),teams:str(raw.teams,140),event:str(raw.event,140),evidence:str(raw.evidence,170),purpose:str(raw.purpose,400),practice:str(raw.practice,380),source:str(raw.source,80),url:link};
}
function normalizeFeed(feed){
 const reviewedAt=/^\d{4}-\d{2}-\d{2}$/.test(String(feed?.reviewedAt||''))?feed.reviewedAt:'';
 const records=Array.isArray(feed?.items)?feed.items.slice(0,120):[];
 const seen=new Set(),items=[];
 for(const raw of records){const pick=normalizePick(raw);if(pick&&!seen.has(pick.id)){seen.add(pick.id);items.push(pick);}}
 return {reviewedAt,items,notice:str(feed?.notice,450),source:'LifeHub editorial'};
}
async function fetchProPicks(fetchImpl=fetch){
 const response=await fetchImpl(SOURCE,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('Добірка LifeHub тимчасово недоступна: '+response.status);
 const contentType=response.headers?.get?.('content-length');
 if(contentType&&Number(contentType)>120000)throw new Error('Файл добірки завеликий');
 const text=await response.text();
 if(text.length>120000)throw new Error('Файл добірки завеликий');
 const feed=normalizeFeed(JSON.parse(text));
 if(!feed.items.length)throw new Error('Немає підтверджених записів у добірці');
 return {...feed,fetchedAt:new Date().toISOString()};
}
function starter(){return {...normalizeFeed(bundled),fetchedAt:'',status:'bundled'};}
module.exports={normalizeFeed,normalizePick,fetchProPicks,starter,SOURCE};
