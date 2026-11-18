'use strict';
// All metrics are returned by the official YouTube Data API, no modeled/fake views.
const TOPICS=[
 {id:'games',label:'Ігри',queries:['gaming shorts viral 2026','new game trailer 2026']},
 {id:'gta',label:'GTA VI',queries:['GTA 6 gameplay shorts','GTA VI funny moments']},
 {id:'anime',label:'Аніме',queries:['anime edits shorts 2026','new anime trailer 2026']},
 {id:'internet',label:'Інтернет / меми',queries:['viral meme shorts 2026','internet trends shorts']},
 {id:'stream',label:'Стрімери',queries:['streamer funny clips shorts 2026']},
 {id:'technology',label:'Технології',queries:['tech ai gadgets shorts 2026']},
 {id:'sports',label:'Спорт',queries:['football best moments shorts 2026']},
 {id:'film',label:'Кіно / серіали',queries:['movie trailers shorts 2026']}
];
function daysAgo(d=7,clock=Date.now()){return new Date(clock-d*86400000).toISOString();}
function parseTrends(searchResults,details,now=Date.now()){
 const byId=new Map((details?.items||[]).map(v=>[v.id,v]));
 const map=new Map();
 for(const row of searchResults){const video=byId.get(row?.id?.videoId);if(!video)continue;const id=video.id;const snippet=video.snippet||{};const views=Number(video.statistics?.viewCount||0);const likes=Number(video.statistics?.likeCount||0);const days=Math.max(0.25,(now-Date.parse(snippet.publishedAt))/86400000);if(!views||!Number.isFinite(days))continue;
  const old=map.get(id);const item={id,category:row._topic||'games',subtopic:row._query||'',title:String(snippet.title||'').slice(0,160),channel:String(snippet.channelTitle||'').slice(0,100),url:`https://www.youtube.com/watch?v=${id}`,thumbnail:snippet.thumbnails?.medium?.url||'',publishedAt:snippet.publishedAt||'',views,likes,viewsPerDay:Math.round(views/days),likeRate:views?Math.round(likes/views*10000)/100:0};
  if(!old)map.set(id,item);
 }
 const grouped={};for(const item of map.values()){(grouped[item.category]??=[]).push(item);}for(const key in grouped)grouped[key].sort((a,b)=>b.viewsPerDay-a.viewsPerDay);
 return Object.entries(grouped).flatMap(([,list])=>list.slice(0,4)).sort((a,b)=>b.viewsPerDay-a.viewsPerDay);
}
async function fetchYoutubeTrends(apiKey,fetcher=fetch){
 if(typeof apiKey!=='string'||apiKey.trim().length<20)throw new Error('Потрібен API-ключ YouTube Data API v3.');
 const all=[];
 for(const topic of TOPICS){for(const q of topic.queries){
  const url=new URL('https://www.googleapis.com/youtube/v3/search');url.searchParams.set('key',apiKey);url.searchParams.set('part','snippet');url.searchParams.set('type','video');url.searchParams.set('q',q);url.searchParams.set('maxResults','8');url.searchParams.set('order','viewCount');url.searchParams.set('publishedAfter',daysAgo());
  const r=await fetcher(url.toString(),{signal:AbortSignal.timeout(12000)});const data=await r.json();if(!r.ok)throw new Error(`YouTube API: ${String(data.error?.message||r.status).slice(0,140)}`);
  all.push(...(data.items||[]).map(x=>({...x,_topic:topic.id,_query:q})));
 }}
 const ids=[...new Set(all.map(x=>x?.id?.videoId).filter(Boolean))];const details={items:[]};
 for(let i=0;i<ids.length;i+=50){const url=new URL('https://www.googleapis.com/youtube/v3/videos');url.searchParams.set('key',apiKey);url.searchParams.set('part','snippet,statistics');url.searchParams.set('id',ids.slice(i,i+50).join(','));const r=await fetcher(url.toString(),{signal:AbortSignal.timeout(12000)});const data=await r.json();if(!r.ok)throw new Error(`YouTube API: ${String(data.error?.message||r.status).slice(0,140)}`);details.items.push(...(data.items||[]));}
 return {videos:parseTrends(all,details),fetchedAt:new Date().toISOString(),topics:TOPICS.map(x=>({id:x.id,label:x.label})),method:'search + official video statistics; sample of queries, not complete ranking'};
}
module.exports={TOPICS,parseTrends,fetchYoutubeTrends};
