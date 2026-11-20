'use strict';
const crypto=require('node:crypto');
const MODES=['dm','bots','aim','match','utility','other'];
const MAPS=['Mirage','Dust2','Inferno','Nuke','Ancient','Anubis','Overpass','Cache','Train','Vertigo','Other'];
const int=(v,max=100000)=>v===''||v===null||v===undefined?null:Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=max?Number(v):null;
const dec=(v,max=1000)=>v===''||v===null||v===undefined?null:Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=max?Number(Number(v).toFixed(2)):null;
const text=(v,max=300)=>String(v??'').trim().slice(0,max);
function cleanResult(raw){
 const mode=MODES.includes(raw.mode)?raw.mode:'other';
 const kills=int(raw.kills??(mode==='dm'?raw.dmKills:mode==='bots'?raw.botKills:null));
 const deaths=int(raw.deaths);const headshots=int(raw.headshots);
 const hsPercent=dec(raw.hsPercent,100);
 if(headshots!==null&&kills!==null&&headshots>kills)throw new Error('Хедшотів не може бути більше за вбивства');
 if(hsPercent!==null&&headshots!==null&&kills!==null&&kills>0&&Math.abs(hsPercent-100*headshots/kills)>5)throw new Error('Відсоток HS не збігається з кількістю вбивств — перевір скрін');
 const time=int(raw.duration,600),matches=int(raw.matches,100),assists=int(raw.assists,2000),accuracy=dec(raw.accuracy,100),rating=dec(raw.rating,5);
 const date=text(raw.date,10);if(!/^(20\d\d|2100)-\d\d-\d\d$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00')))throw new Error('Вкажи дату заняття');
 return {mode,map:MAPS.includes(raw.map)?raw.map:'Other',date,kills,deaths,headshots,hsPercent:hsPercent??(kills&&headshots!==null?Number((100*headshots/kills).toFixed(2)):null),accuracy,assists,rating,duration:time,matches:matches??(mode==='match'?1:0),dmKills:mode==='dm'?kills??0:int(raw.dmKills,100000)??0,botKills:mode==='bots'?kills??0:int(raw.botKills,100000)??0,notes:text(raw.notes||raw.note,1800),practice:text(raw.practice,2000),imageId:/^[a-f0-9-]{36}$/.test(String(raw.imageId||''))?raw.imageId:'',imageSource:text(raw.imageSource,25)};
}
function weeklyStart(date){const d=new Date(date+'T12:00:00Z');const offset=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-offset);return d.toISOString().slice(0,10);}
function summarize(logs,from='',to=''){
 const chosen=logs.filter(x=>(!from||x.date>=from)&&(!to||x.date<=to));const numeric=k=>chosen.reduce((sum,x)=>sum+(Number(x[k])||0),0);
 const deaths=numeric('deaths'),kills=numeric('kills');return {sessions:chosen.length,dmKills:numeric('dmKills'),botKills:numeric('botKills'),matches:numeric('matches'),minutes:numeric('duration'),kills,deaths,kd:deaths>0?Number((kills/deaths).toFixed(2)):null};
}
function mapBreakdown(logs,faceitMatches=[]){
 const by=new Map();
 for(const row of logs.map(x=>({...x,source:'manual'})).concat(faceitMatches.map(x=>({...x,source:'faceit'})))){
  const map=MAPS.includes(row.map)?row.map:'Other';
  const a=by.get(map)||{map,sessions:0,kills:0,deaths:0,faceitMatches:0,wins:0,hsPercent:null,hsSamples:0};
  if(row.source==='manual')a.sessions++;a.kills+=Number(row.kills||0);a.deaths+=Number(row.deaths||0);
  if(row.source==='faceit'){a.faceitMatches++;a.wins+=row.win===true?1:0;}
  if(Number.isFinite(Number(row.hsPercent))&&row.hsPercent!==null){a.hsPercent=(a.hsPercent||0)+Number(row.hsPercent);a.hsSamples++;}
  by.set(map,a);
 }
 return [...by.values()].map(a=>({...a,kd:a.deaths?Number((a.kills/a.deaths).toFixed(2)):null,hsPercent:a.hsSamples?Number((a.hsPercent/a.hsSamples).toFixed(1)):null})).sort((a,b)=>b.sessions-a.sessions);
}
function goals(raw){const safe={dmKills:Math.min(20000,int(raw?.dmKills,20000)??500),botKills:Math.min(40000,int(raw?.botKills,40000)??1000),matches:Math.min(100,int(raw?.matches,100)??5),minutes:Math.min(10080,int(raw?.minutes,10080)??120)};return safe;}
function weekGoals(raw){return {dmKills:int(raw?.dmKills,100000)??3500,botKills:int(raw?.botKills,100000)??7000,matches:int(raw?.matches,1000)??20,minutes:int(raw?.minutes,10080)??840};}
function cleanUtility(raw){const map=MAPS.includes(raw.map)?raw.map:'Mirage';const type=['smoke','flash','molotov','he'].includes(raw.type)?raw.type:'smoke';const title=text(raw.title,130);if(!title)throw new Error('Назви гранату');
 let url='';if(raw.url){try{const a=new URL(raw.url);if(a.protocol==='https:'&&!['localhost','127.0.0.1'].includes(a.hostname))url=a.href;}catch{}}
 return {id:/^[a-f0-9-]{36}$/.test(String(raw.id||''))?raw.id:crypto.randomUUID(),map,type,title,url,note:text(raw.note,600),learned:raw.learned===true,reps:int(raw.reps,100000)??0,updatedAt:new Date().toISOString()};
}
const FACEIT_BASE='https://open.faceit.com/data/v4';
async function faceitGet(url,key,fetcher=fetch){
 if(!url.startsWith(FACEIT_BASE+'/'))throw new Error('Некоректний endpoint FACEIT');
 const res=await fetcher(url,{headers:{Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 if(!res.ok){if(res.status===401||res.status===403)throw new Error('FACEIT відхилив API-ключ');if(res.status===404)throw new Error('Гравця FACEIT не знайдено');if(res.status===429)throw new Error('FACEIT: забагато запитів, спробуй пізніше');throw new Error('FACEIT API '+res.status);}
 return res.json();
}
const canonicalMap=v=>{const plain=String(v||'').replace(/^de_/,'').toLowerCase().replace(/[\s_-]/g,'');return MAPS.find(m=>m.toLowerCase()===plain)||(plain==='dust2'?'Dust2':'Other');};
function parseMatchStats(raw,playerId,matchId,startedAt){
 const stats=[];for(const round of raw.rounds||[]){
  const map=canonicalMap(round.round_stats?.Map||round.round_stats?.map);
  for(const team of round.teams||[])for(const player of team.players||[]){
   if(String(player.player_id)!==String(playerId))continue;
   const p=player.player_stats||{},value=(...keys)=>{for(const k of keys)if(p[k]!==undefined&&p[k]!==null)return p[k];return null;};
   const kills=int(value('Kills','kills'),100),deaths=int(value('Deaths','deaths'),100);
   const hsPercent=dec(value('Headshots %','Headshots % ','HS %'),100);
   const rawWin=value('Result','Win');const win=rawWin===null?null:Number(rawWin)===1;
   stats.push({id:matchId,map,kills,deaths,assists:int(value('Assists'),100),hsPercent,headshots:int(value('Headshots'),100),rating:dec(value('Rating','FACEIT Rating'),5),win,startedAt,source:'FACEIT Data API'});
  }
 }
 return stats;
}
function cleanFaceitProfile(p){return {id:text(p.player_id,100),nickname:text(p.nickname,100),avatar:typeof p.avatar==='string'&&p.avatar.startsWith('https://')?p.avatar:'',url:'https://www.faceit.com/en/players/'+encodeURIComponent(p.nickname||''),elo:int(p.games?.cs2?.faceit_elo,10000),level:int(p.games?.cs2?.skill_level,10),region:text(p.games?.cs2?.region,30)};}
async function getFaceit(nickname,key,fetcher=fetch){
 if(!/^[\w\-]{2,40}$/.test(String(nickname)))throw new Error('Вкажи нік FACEIT (2–40 символів)');
 const player=await faceitGet(FACEIT_BASE+'/players?nickname='+encodeURIComponent(nickname)+'&game=cs2',key,fetcher);
 if(!player.player_id)throw new Error('Немає FACEIT CS2-профілю');
 const [history,overall]=await Promise.all([
  faceitGet(FACEIT_BASE+'/players/'+encodeURIComponent(player.player_id)+'/history?game=cs2&offset=0&limit=20',key,fetcher),
  faceitGet(FACEIT_BASE+'/players/'+encodeURIComponent(player.player_id)+'/stats/cs2',key,fetcher).catch(()=>null)
 ]);
 const items=Array.isArray(history.items)?history.items:[];
 const matchStats=await Promise.all(items.slice(0,8).map(async m=>{
  const matchId=text(m.match_id,100);if(!matchId)return [];
  try{const parsed=await faceitGet(FACEIT_BASE+'/matches/'+encodeURIComponent(matchId)+'/stats',key,fetcher);
  return parseMatchStats(parsed,player.player_id,matchId,m.started_at||m.finished_at||0);}catch{return [];}
 }));
 return {player:cleanFaceitProfile(player),matches:matchStats.flat(),overview:overall?.lifetime||{},historyCount:items.length,checkedAt:new Date().toISOString(),note:'Детальні показники отримано для не більше 8 останніх матчів. Не всі матчі на FACEIT мають доступну статистику.'};
}
module.exports={MAPS,MODES,cleanResult,weeklyStart,summarize,mapBreakdown,goals,weekGoals,cleanUtility,canonicalMap,parseMatchStats,cleanFaceitProfile,getFaceit};
