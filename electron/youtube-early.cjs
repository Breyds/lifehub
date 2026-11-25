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
const STOP=new Set('the a an and or of in on to is for with how what why this that you your my best new video shorts short viral trending facts top de la el los las en y un una que con para por del на в і та з до як про що це не для и что как это по'.split(' '));
function words(title){return [...new Set(String(title||'').normalize('NFKC').toLowerCase().replace(/#[\p{L}\p{N}_]+/gu,' ').match(/[\p{L}\p{N}]{2,}/gu)||[])].filter(w=>!STOP.has(w)).slice(0,14);}
function topicQuery(title){return words(title).slice(0,7).join(' ');}
function related(a,b){const x=words(a),y=new Set(words(b)),n=x.filter(w=>y.has(w)).length;return n>=2&&n/Math.max(1,Math.min(x.length,y.size))>=0.6&&n/Math.max(1,Math.max(x.length,y.size))>=0.32;}
function breakout(v,now=Date.now()){const age=now-Date.parse(v.publishedAt);return age>=0&&age<=7*DAY&&Number.isFinite(v.subscribers)&&v.subscribers>=0&&v.subscribers<=10000&&v.views>=10000&&v.views/Math.max(v.subscribers,1)>=10;}
function evidence(seed,results,{query='',now=Date.now(),sampleSize=results.length,saturated=false}={}){
 const comparable=[...new Map([seed,...results].filter(x=>x.format===seed.format&&(x.id===seed.id||related(seed.title,x.title))).map(x=>[x.id,x])).values()];
 const winners=comparable.filter(v=>breakout(v,now)).sort((a,b)=>b.views-a.views),unique=[...new Map(winners.map(v=>[v.channelId,v])).values()];
 const sparse=comparable.length<=12,exceptional=seed.views>=50000&&seed.views/Math.max(seed.subscribers,1)>=50;
 if(!sparse||(!exceptional&&unique.length<2))return null;
 return {query,checkedAt:now,similarCount:comparable.length,sampleSize,saturated,independentChannels:unique.length,ratio:seed.views/Math.max(seed.subscribers,1),confirmed:unique.length>=2&&!saturated,examples:unique.slice(0,6).map(v=>({id:v.id,title:v.title,channel:v.channel,channelId:v.channelId,views:v.views,subscribers:v.subscribers,url:v.url}))};
}
async function searchPage(key,params,fetcher){const u=new URL('https://www.googleapis.com/youtube/v3/search');u.search=new URLSearchParams({key,...params}).toString();const r=await fetcher(u,{signal:AbortSignal.timeout(18000)}),d=await r.json();if(!r.ok)throw Error('YouTube API: '+String(d.error?.message||r.status).slice(0,180));return {ids:(d.items||[]).map(v=>v.id?.videoId).filter(x=>ID.test(x)),saturated:!!d.nextPageToken||(d.items||[]).length>=50};}
async function readRows(key,ids,now,fetcher,maxAge=7*DAY){
 const videos=[],all=[...new Set(ids)];for(let i=0;i<all.length;i+=50)videos.push(...await api(key,'videos',{part:'snippet,statistics,contentDetails',id:all.slice(i,i+50).join(',')},fetcher));
 const channelIds=[...new Set(videos.map(v=>v.snippet?.channelId).filter(x=>CID.test(x)))],channels=[];
 for(let i=0;i<channelIds.length;i+=50)channels.push(...await api(key,'channels',{part:'snippet,statistics',id:channelIds.slice(i,i+50).join(',')},fetcher));
 const owners=new Map(channels.map(c=>[c.id,c])),rows=[];
 for(const v of videos){const ch=owners.get(v.snippet?.channelId),views=Number(v.statistics?.viewCount),subs=ch?.statistics?.hiddenSubscriberCount||ch?.statistics?.subscriberCount===undefined?null:Number(ch.statistics.subscriberCount),published=Date.parse(v.snippet?.publishedAt),seconds=durationSeconds(v.contentDetails?.duration);
 if(!ch||!Number.isFinite(views)||views<0||!Number.isFinite(published)||now-published>maxAge||published>now)continue;
 rows.push({id:v.id,channelId:ch.id,channel:ch.snippet?.title||'',channelUrl:'https://www.youtube.com/channel/'+ch.id,channelCreatedAt:ch.snippet?.publishedAt||'',channelVideoCount:Number(ch.statistics?.videoCount)||0,subscribers:subs,title:v.snippet?.title||'',url:'https://www.youtube.com/watch?v='+v.id,thumbnail:v.snippet?.thumbnails?.medium?.url||'',publishedAt:v.snippet.publishedAt,seconds,format:seconds===null?'unknown':seconds<=180?'short-candidate':'long',views,checkedAt:now});
 }return rows;
}
async function refreshEarly(key,raw,{discover=false,now=Date.now(),fetcher=fetch}={}){
 const state=cleanState(raw,now),old=new Map(state.rows.map(x=>[x.id,x])),queries=state.query?[state.query]:Array.from({length:3},(_,i)=>DEFAULT_QUERIES[(state.cursor+i)%DEFAULT_QUERIES.length]);
 const ids=new Set(old.keys());
 if(discover){for(const q of queries){for(const order of ['viewCount','date']){const found=await searchPage(key,{part:'snippet',type:'video',q,order,publishedAfter:new Date(now-7*DAY).toISOString(),maxResults:'50'},fetcher);for(const id of found.ids)ids.add(id);}}}
 const rawRows=await readRows(key,ids,now,fetcher),rows=rawRows.filter(v=>v.subscribers!==null&&Number.isFinite(v.subscribers)&&v.subscribers>=0&&v.subscribers<=10000).map(v=>({...v,samples:sample(old.get(v.id)?.samples,v.views,now),opportunity:old.get(v.id)?.opportunity||null}));
 if(discover){
  const seeds=rows.filter(v=>breakout(v,now)&&topicQuery(v.title).split(' ').length>=2&&v.format!=='unknown').sort((a,b)=>b.views/Math.max(b.subscribers,1)-a.views/Math.max(a.subscribers,1)||b.views-a.views);
  const tried=[];
  for(const seed of seeds){if(tried.length>=4)break;if(tried.some(x=>x.format===seed.format&&related(x.title,seed.title)))continue;tried.push(seed);
   const query=topicQuery(seed.title),found=await searchPage(key,{part:'snippet',type:'video',q:query,order:'relevance',publishedAfter:new Date(now-90*DAY).toISOString(),maxResults:'50'},fetcher);
   const comparable=await readRows(key,found.ids,now,fetcher,90*DAY),op=evidence(seed,comparable,{query,now,sampleSize:found.ids.length,saturated:found.saturated});
   for(const v of rows)if(v.format===seed.format&&(v.id===seed.id||related(seed.title,v.title)))v.opportunity=null;
   if(op)seed.opportunity=op;
  }
 }
 for(const v of rows)if(!breakout(v,now)||!v.opportunity||now-v.opportunity.checkedAt>24*H)v.opportunity=null;
 rows.sort((a,b)=>Number(!!b.opportunity)-Number(!!a.opportunity)||Number(b.opportunity?.confirmed||false)-Number(a.opportunity?.confirmed||false)||(b.opportunity?.independentChannels||0)-(a.opportunity?.independentChannels||0)||b.views/Math.max(b.subscribers,1)-a.views/Math.max(a.subscribers,1)||b.views-a.views);
 return {...state,rows:rows.slice(0,150),checkedAt:now,discoveredAt:discover?now:state.discoveredAt,cursor:discover&&!state.query?(state.cursor+queries.length)%DEFAULT_QUERIES.length:state.cursor,error:'',nextAt:now+H};
}
module.exports={DEFAULT_QUERIES,cleanState,sample,windowChange,publicRadar,refreshEarly,breakout,related,evidence,topicQuery};
