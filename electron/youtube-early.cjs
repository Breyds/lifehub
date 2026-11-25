'use strict';
const {durationSeconds}=require('./youtube-studio.cjs');
const H=3600000,DAY=24*H,ID=/^[A-Za-z0-9_-]{11}$/,CID=/^UC[A-Za-z0-9_-]{22}$/;
const DEFAULT_QUERIES=['gaming challenges','quiz trivia','anime facts','mini documentaries','AI tools','football stories','internet memes','creative tutorials','ranking shorts','unusual hobbies','budget gadgets','history facts'];
function cleanState(raw,now=Date.now()){
 const v=raw&&typeof raw==='object'?raw:{};
 const rows=(Array.isArray(v.rows)?v.rows:[]).filter(x=>x&&ID.test(x.id)&&Number.isFinite(Date.parse(x.publishedAt))&&now-Date.parse(x.publishedAt)<=7*DAY&&now-Number(x.checkedAt||0)<=7*DAY).slice(0,150).map(x=>({...x,samples:(Array.isArray(x.samples)?x.samples:[]).filter(p=>Number.isFinite(p.at)&&p.at<=now&&now-p.at<=7*DAY&&Number.isFinite(p.views)&&p.views>=0).sort((a,b)=>a.at-b.at).slice(-90)}));
 return {enabled:v.enabled===true,query:String(v.query||'').slice(0,100),rows,checkedAt:Number(v.checkedAt)||0,discoveredAt:Number(v.discoveredAt)||0,cursor:Number.isSafeInteger(v.cursor)?v.cursor:0,error:String(v.error||'').slice(0,200),nextAt:Number(v.nextAt)||0};
}
function sample(old,views,now){
 const list=(old||[]).filter(x=>now-x.at<=7*DAY&&x.at<=now);
 if(list.length&&now-list.at(-1).at<30*60000)return list;
 return [...list,{at:now,views}].slice(-90);
}
function windowChange(samples,hours){
 if(samples.length<2)return null;
 const last=samples.at(-1),target=last.at-hours*H;
 const candidates=samples.slice(0,-1).filter(x=>Math.abs(x.at-target)<=Math.min(2*H,hours*H/4));
 if(!candidates.length)return null;
 const first=candidates.sort((a,b)=>Math.abs(a.at-target)-Math.abs(b.at-target))[0];
 return {from:first.at,to:last.at,startViews:first.views,endViews:last.views,change:last.views-first.views,hours:(last.at-first.at)/H};
}
function publicRadar(state,now=Date.now()){
 const v=cleanState(state,now);return {...v,rows:v.rows.map(r=>({...r,windows:[6,12,24].map(hours=>({hours,data:windowChange(r.samples,hours)}))}))};
}
async function api(key,endpoint,params,fetcher=fetch){
 const u=new URL('https://www.googleapis.com/youtube/v3/'+endpoint);u.search=new URLSearchParams({key,...params}).toString();
 const r=await fetcher(u,{signal:AbortSignal.timeout(18000)}),data=await r.json();
 if(!r.ok)throw Error('YouTube API: '+String(data.error?.message||r.status).slice(0,180));return data.items||[];
}
async function refreshEarly(key,raw,{discover=false,now=Date.now(),fetcher=fetch}={}){
 const state=cleanState(raw,now),old=new Map(state.rows.map(x=>[x.id,x])),queries=state.query?[state.query]:Array.from({length:3},(_,i)=>DEFAULT_QUERIES[(state.cursor+i)%DEFAULT_QUERIES.length]);
 const ids=new Set(old.keys());
 if(discover){
  for(const q of queries){
   const found=await api(key,'search',{part:'snippet',type:'video',q,order:'date',publishedAfter:new Date(now-3*DAY).toISOString(),maxResults:'35'},fetcher);
   for(const v of found)if(ID.test(v.id?.videoId))ids.add(v.id.videoId);
  }
 }
 const videos=[],all=[...ids];for(let i=0;i<all.length;i+=50)videos.push(...await api(key,'videos',{part:'snippet,statistics,contentDetails',id:all.slice(i,i+50).join(',')},fetcher));
 const channelIds=[...new Set(videos.map(v=>v.snippet?.channelId).filter(x=>CID.test(x)))],channels=[];
 for(let i=0;i<channelIds.length;i+=50)channels.push(...await api(key,'channels',{part:'snippet,statistics',id:channelIds.slice(i,i+50).join(',')},fetcher));
 const owners=new Map(channels.map(c=>[c.id,c])),rows=[];
 for(const v of videos){
  const ch=owners.get(v.snippet?.channelId),previous=old.get(v.id),views=Number(v.statistics?.viewCount),subs=ch?.statistics?.hiddenSubscriberCount||ch?.statistics?.subscriberCount===undefined?null:Number(ch.statistics.subscriberCount),published=Date.parse(v.snippet?.publishedAt),seconds=durationSeconds(v.contentDetails?.duration);
  if(!ch||!Number.isFinite(views)||views<0||!Number.isFinite(published)||now-published>7*DAY||published>now||subs===null||!Number.isFinite(subs)||subs<0)continue;
  if(!previous&&(views>20000||subs>10000))continue;
  rows.push({id:v.id,channelId:ch.id,channel:ch.snippet?.title||'',channelUrl:'https://www.youtube.com/channel/'+ch.id,channelCreatedAt:ch.snippet?.publishedAt||'',channelVideoCount:Number(ch.statistics?.videoCount)||0,subscribers:subs,title:v.snippet?.title||'',url:'https://www.youtube.com/watch?v='+v.id,thumbnail:v.snippet?.thumbnails?.medium?.url||'',publishedAt:v.snippet.publishedAt,seconds,format:seconds===null?'unknown':seconds<=180?'short-candidate':'long',views,checkedAt:now,samples:sample(previous?.samples,views,now)});
 }
 // Preserve tracked candidates first; new discoveries use recency, not a proprietary hype score.
 rows.sort((a,b)=>Number(old.has(b.id))-Number(old.has(a.id))||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 return {...state,rows:rows.slice(0,150),checkedAt:now,discoveredAt:discover?now:state.discoveredAt,cursor:discover&&!state.query?(state.cursor+queries.length)%DEFAULT_QUERIES.length:state.cursor,error:'',nextAt:now+H};
}
module.exports={DEFAULT_QUERIES,cleanState,sample,windowChange,publicRadar,refreshEarly};
