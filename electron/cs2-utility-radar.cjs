'use strict';
// Find recent CS2 utility videos through the OFFICIAL YouTube Data API.
// Search results are candidates until a human reproduces the throw in-game.
const MAPS=['Mirage','Dust2','Inferno','Nuke','Ancient','Anubis','Overpass','Train','Cache','Vertigo'];
const UTILITY=/\b(smoke|smokes|flash|flashbang|molotov|nade|nades|grenade|utility|lineup|lineups|execute|setups)\b|смок|флеш|молотов|гранат/i;
const PROMOTIONAL=/\b(case opening|skin giveaway|unboxing|gambling|trade site)\b/i;
function inferMap(text){
 const lower=String(text||'').toLowerCase();
 return MAPS.find(m=>lower.includes(m.toLowerCase()))||'Other';
}
function inferType(text){
 const value=String(text||'').toLowerCase();
 if(/flash|флеш/.test(value))return 'flash';
 if(/molotov|incendiary|молотов/.test(value))return 'molotov';
 if(/\bhe\b|grenade damage|оскол/.test(value))return 'he';
 return 'smoke';
}
function normalizeVideoResults(responses,now=Date.now()){
 const seen=new Set(),out=[];
 for(const response of responses){
  for(const raw of (response?.items||[])){
   const videoId=String(raw?.id?.videoId||'');
   if(!/^[A-Za-z0-9_-]{11}$/.test(videoId)||seen.has(videoId))continue;
   const s=raw.snippet||{},title=String(s.title||'').replace(/<[^>]*>/g,'').trim().slice(0,180),description=String(s.description||'').slice(0,300);
   const publishedAt=String(s.publishedAt||'');
   const date=Date.parse(publishedAt);
   if(!title||!UTILITY.test(title+' '+description)||PROMOTIONAL.test(title)||!Number.isFinite(date)||date>now+86400000||date<now-31*86400000)continue;
   seen.add(videoId);
   out.push({id:videoId,title,channel:String(s.channelTitle||'').slice(0,110),publishedAt,map:inferMap(title+' '+description),type:inferType(title),url:'https://www.youtube.com/watch?v='+videoId,source:'YouTube',verified:false});
  }
 }
 return out.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,20);
}
async function fetchCS2UtilityRadar(key,options={}){
 if(typeof key!=='string'||key.length<20)throw new Error('Потрібен YouTube Data API key');
 const clock=Number.isFinite(options.now)?options.now:Date.now();
 const publishedAfter=new Date(clock-8*86400000).toISOString();
 const queries=['CS2 pro smoke flash new lineup tournament','Counter Strike 2 new pro utility molotov grenades'];
 const responses=[];
 for(const query of queries){
  const url=new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part','snippet');url.searchParams.set('type','video');url.searchParams.set('order','date');url.searchParams.set('maxResults','20');
  url.searchParams.set('publishedAfter',publishedAfter);url.searchParams.set('q',query);url.searchParams.set('key',key);
  const response=await fetch(url.toString(),{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('YouTube Data API повернув статус '+response.status+'. Перевір ключ та квоту.');
  responses.push(await response.json());
 }
 return {items:normalizeVideoResults(responses,clock),fetchedAt:new Date(clock).toISOString(),status:'ok',message:'Кандидати з YouTube за останні 8 днів. Не перевірені як про-розкидки — відтворюй у грі перед додаванням.'};
}
module.exports={fetchCS2UtilityRadar,normalizeVideoResults,inferMap,inferType};
