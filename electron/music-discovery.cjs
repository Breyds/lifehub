'use strict';
const {spotifyGet,extractTracks,isFresh,excludeSaved}=require('./spotify-personal.cjs');
const norm=s=>String(s||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const key=t=>norm(t.artist)+'|'+norm(t.title);
const artistKey=t=>norm(t.artist);
const genres=t=>(Array.isArray(t.genres)?t.genres:[]).map(norm).filter(g=>g&&g!=='music'&&g!=='музика');
const quote=s=>String(s||'').replace(/["\\]/g,'').slice(0,120);
const groups={us:['us'],regional:['ua','kz','ru']};
function charts(markets,group){
 const best=new Map();
 for(const m of groups[group]||[])for(const t of markets?.[m]||[]){
  if(!t.title||!t.artist||!Number.isFinite(t.rank))continue;
  const k=key(t),old=best.get(k);
  if(!old||old.rank>t.rank)best.set(k,{...t,market:m,chartRank:t.rank,region:group});
 }
 return [...best.values()].sort((a,b)=>a.rank-b.rank||key(a).localeCompare(key(b)));
}
function buildProfile(taste,topArtists,markets,feedback={}){
 const artists=new Map(),styles=new Map();
 const add=(map,k,w)=>{if(k)map.set(k,(map.get(k)||0)+w);};
 for(const t of taste)for(const a of t.artists||[t.artist])add(artists,norm(a),1);
 for(const a of topArtists||[]){add(artists,norm(a.name),3);for(const g of genres(a))add(styles,g,3);}
 for(const group of Object.keys(groups))for(const t of charts(markets,group))if(artists.has(artistKey(t)))for(const g of genres(t))add(styles,g,1);
 for(const vote of Object.values(feedback||{})){
  if(!vote||!['like','dislike'].includes(vote.vote))continue;
  const w=vote.vote==='like'?5:-4;add(artists,norm(vote.artist),w);
  for(const g of genres(vote))add(styles,g,w);
 }
 return {artists,styles,known:new Set(taste.map(key)),feedback};
}
function affinity(t,profile){
 const artist=Math.max(0,...(t.artists||[t.artist]).map(a=>profile.artists.get(norm(a))||0));
 const style=Math.max(0,...genres(t).map(g=>profile.styles.get(g)||0));
 return {artist,style,score:Math.min(artist,12)*4+Math.min(style,12)*2};
}
function rated(t,profile){return profile.feedback?.[key(t)]?.vote;}
function rankCandidates(rows,profile,window){
 const best=new Map();
 for(const t of rows||[]){
  if(!isFresh(t,window)||profile.known.has(key(t))||rated(t,profile)==='dislike'||(profile.artists.get(artistKey(t))||0)<0)continue;
  const a=affinity(t,profile), chart=Number.isFinite(t.chartRank)?Math.max(0,101-t.chartRank):0;
  const score=a.score+chart/4+(rated(t,profile)==='like'?15:0);
  const reason=a.artist?'Збіг із твоїми виконавцями':a.style?'Схожий жанр: '+genres(t).filter(g=>(profile.styles.get(g)||0)>0).slice(0,2).join(', '):t.source==='radar-copy'?'З твоєї копії Release Radar':t.chartRank?'Популярна новинка · відкриття':'Новий реліз · відкриття';
  const row={...t,score,reason:reason+(t.chartRank?' · чарт #'+t.chartRank:'')};
  const old=best.get(key(t));if(!old||row.score>old.score)best.set(key(t),row);
 }
 return [...best.values()].sort((a,b)=>b.score-a.score||a.rank-b.rank||key(a).localeCompare(key(b)));
}
function pick(rows,limit,exclude=new Set(),artistLimit=2){
 const counts=new Map(),out=[],seen=new Set(exclude);
 for(const t of rows){const a=artistKey(t),k=key(t);if(seen.has(k)||(counts.get(a)||0)>=artistLimit)continue;
  seen.add(k);counts.set(a,(counts.get(a)||0)+1);out.push(t);if(out.length>=limit)break;
 }
 return out;
}
function selectWeekly({taste,topArtists=[],markets={},catalog=[],chartTracks=[],window,feedback={},radar=false}){
 const profile=buildProfile(taste,topArtists,markets,feedback);
 const regional={us:[],regional:[]};const used=new Set();
 for(const g of ['us','regional']){
  regional[g]=pick(rankCandidates(chartTracks.filter(t=>t.region===g),profile,window),5,used);
  for(const t of regional[g])used.add(key(t));
 }
 const pool=rankCandidates(radar?catalog:[...catalog,...chartTracks],profile,window);
 // Reserve some fresh US-market discoveries when they exist, even if familiar artists dominate.
 const us=radar?[]:pick(pool.filter(t=>t.region==='us'),3);
 const items=[...us,...pick(pool,10-us.length,new Set(us.map(key)))].slice(0,10).sort((a,b)=>b.score-a.score);
 return {items,regions:regional};
}
async function topArtists(token,fetcher=fetch){
 try{const data=await spotifyGet(token,'me/top/artists?limit=50&time_range=medium_term',fetcher);return data.items||[];}catch{return [];}
}
async function matchChartTracks(token,markets,window,taste,feedback={},fetcher=fetch){
 const profile=buildProfile(taste,[],markets,feedback),requests=[];
 for(const g of ['us','regional']){
  const rows=rankCandidates(charts(markets,g),profile,window);
  requests.push(...rows.slice(0,18));
 }
 const result=[];
 for(let i=0;i<requests.length;i+=4){
  const batch=await Promise.allSettled(requests.slice(i,i+4).map(async t=>{
   const q=new URLSearchParams({q:'track:"'+quote(t.title)+'" artist:"'+quote(t.artist)+'"',type:'track',limit:'5'});
   const data=await spotifyGet(token,'search?'+q,fetcher);
   const exact=extractTracks(data.tracks?.items).find(x=>key(x)===key(t)&&isFresh(x,window));
   if(!exact)return null;
   return {...exact,artworkUrl:exact.artworkUrl||t.artworkUrl,market:t.market,region:t.region,chartRank:t.rank,rank:t.rank,genres:t.genres,source:'spotify-chart'};
  }));
  for(const r of batch)if(r.status==='fulfilled'&&r.value)result.push(r.value);
 }
 return result;
}
async function discoverGenres(token,taste,artists,markets,window,feedback={},fetcher=fetch){
 const profile=buildProfile(taste,artists,markets,feedback);
 const chosen=[...profile.styles.entries()].filter(([g,w])=>w>0&&g.length<=60).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
 const queries=chosen.flatMap(g=>[0,10].map(offset=>({g,offset})));
 const out=[];
 for(let i=0;i<queries.length;i+=4){
  const batch=await Promise.allSettled(queries.slice(i,i+4).map(async ({g,offset})=>{
   const q=new URLSearchParams({q:'genre:"'+quote(g)+'" year:'+window.to.slice(0,4),type:'track',limit:'10',offset:String(offset)});
   const data=await spotifyGet(token,'search?'+q,fetcher);
   return extractTracks(data.tracks?.items).filter(t=>isFresh(t,window)).map((t,j)=>({...t,genres:[g],market:'spotify',rank:offset+j+1,source:'spotify-genre'}));
  }));
  for(const r of batch)if(r.status==='fulfilled')out.push(...r.value);
 }
 return out;
}
async function generate({token,taste,markets,window,catalog=[],radar=false,feedback={},fetcher=fetch}){
 const artists=await topArtists(token,fetcher);
 const chartTracks=await matchChartTracks(token,markets,window,taste,feedback,fetcher);
 const extra=radar?[]:await discoverGenres(token,taste,artists,markets,window,feedback,fetcher);
 const candidates=[...catalog,...extra,...chartTracks].filter(t=>isFresh(t,window));
 const unsaved=await excludeSaved(token,candidates,fetcher);
 const allowed=new Set(unsaved.map(t=>t.id));
 return selectWeekly({taste,topArtists:artists,markets,catalog:[...catalog,...extra].filter(t=>allowed.has(t.id)),chartTracks:chartTracks.filter(t=>allowed.has(t.id)),window,feedback,radar});
}
module.exports={key,charts,buildProfile,rankCandidates,selectWeekly,matchChartTracks,discoverGenres,generate};
