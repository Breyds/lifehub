'use strict';
// All metrics are returned by the official YouTube Data API, no modeled/fake views.
const {durationSeconds}=require('./youtube-studio.cjs');
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
  const old=map.get(id);const seconds=durationSeconds(video.contentDetails?.duration);const item={id,seconds,format:seconds===null?'unknown':seconds<=180?'short-candidate':'long',channelId:snippet.channelId||'',category:row._topic||'games',subtopic:row._query||'',title:String(snippet.title||'').slice(0,160),channel:String(snippet.channelTitle||'').slice(0,100),channelUrl:/^UC[a-zA-Z0-9_-]{22}$/.test(String(snippet.channelId||''))?`https://www.youtube.com/channel/${snippet.channelId}`:'',url:`https://www.youtube.com/watch?v=${id}`,thumbnail:snippet.thumbnails?.medium?.url||'',publishedAt:snippet.publishedAt||'',views,likes,viewsPerDay:Math.round(views/days),likeRate:views?Math.round(likes/views*10000)/100:0};
  if(!old)map.set(id,item);
 }
 const grouped={};for(const item of map.values()){(grouped[item.category]??=[]).push(item);}for(const key in grouped)grouped[key].sort((a,b)=>b.viewsPerDay-a.viewsPerDay);
 return Object.entries(grouped).flatMap(([,list])=>list.slice(0,8)).sort((a,b)=>b.viewsPerDay-a.viewsPerDay);
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
 for(let i=0;i<ids.length;i+=50){const url=new URL('https://www.googleapis.com/youtube/v3/videos');url.searchParams.set('key',apiKey);url.searchParams.set('part','snippet,statistics,contentDetails');url.searchParams.set('id',ids.slice(i,i+50).join(','));const r=await fetcher(url.toString(),{signal:AbortSignal.timeout(12000)});const data=await r.json();if(!r.ok)throw new Error(`YouTube API: ${String(data.error?.message||r.status).slice(0,140)}`);details.items.push(...(data.items||[]));}
 return {videos:parseTrends(all,details),fetchedAt:new Date().toISOString(),topics:TOPICS.map(x=>({id:x.id,label:x.label})),method:'search + official video statistics; sample of queries, not complete ranking'};
}
async function nicheRadar(key,query,format='all',fetcher=fetch){
 if(typeof query!=='string'||query.trim().length<2||query.length>100)throw Error('Введи конкретну нішу (2–100 символів)');
 const get=async(endpoint,params)=>{const u=new URL('https://www.googleapis.com/youtube/v3/'+endpoint);u.search=new URLSearchParams({key,...params}).toString();const r=await fetcher(u,{signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error('YouTube API: '+String(d.error?.message||r.status).slice(0,180));return d;};
 const p=await get('search',{part:'snippet',type:'video',q:query,order:'viewCount',publishedAfter:daysAgo(30),maxResults:'50',...(format==='short'?{videoDuration:'short'}:format==='long'?{videoDuration:'medium'}:{})});
 const ids=(p.items||[]).map(x=>x.id?.videoId).filter(Boolean);
 if(!ids.length)return [];
 const d=await get('videos',{part:'snippet,statistics,contentDetails',id:ids.join(',')});
 const cs=[...new Set((d.items||[]).map(x=>x.snippet?.channelId).filter(Boolean))];
 const channels=cs.length?await get('channels',{part:'snippet,statistics',id:cs.join(',')}):{items:[]};
 const map=new Map((channels.items||[]).map(x=>[x.id,x]));
 return (d.items||[]).flatMap(v=>{
  const ch=map.get(v.snippet?.channelId),sub=ch?.statistics?.hiddenSubscriberCount?null:Number(ch?.statistics?.subscriberCount||0);
  if(!ch||!sub||sub>50000)return [];
  const views=Number(v.statistics?.viewCount||0),seconds=durationSeconds(v.contentDetails?.duration),date=v.snippet?.publishedAt||'',age=Math.max(.25,(Date.now()-Date.parse(date))/86400000);
  if(!Number.isFinite(age)||!views||seconds===null||format==='short'&&seconds>180||format==='long'&&seconds<=180)return [];
  return [{id:v.id,title:v.snippet.title,channel:ch.snippet.title,channelId:ch.id,channelUrl:'https://www.youtube.com/channel/'+ch.id,url:'https://www.youtube.com/watch?v='+v.id,thumbnail:v.snippet?.thumbnails?.medium?.url||'',subscribers:sub,views,viewsPerDay:Math.round(views/age),ratio:Math.round(views/sub*100)/100,seconds,publishedAt:date,format:seconds<=180?'short-candidate':'long'}];
 }).sort((a,b)=>b.ratio-a.ratio||b.viewsPerDay-a.viewsPerDay).slice(0,25);
}
module.exports={TOPICS,parseTrends,fetchYoutubeTrends,nicheRadar};
