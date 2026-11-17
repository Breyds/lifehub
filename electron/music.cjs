'use strict';
// Public Apple Music RSS charts (no user token). These are charts, not a TikTok viral chart.
// A track can be popular without being released this Friday.
const CHART_MARKETS={
  us:{label:'США',region:'us'},
  kz:{label:'Казахстан',region:'regional'},
  ua:{label:'Україна',region:'regional'},
  ru:{label:'Росія (якщо доступно)',region:'regional'}
};
function dateOnly(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';}
function httpsUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'?u.href.slice(0,1200):'';}catch{return '';}}
function parseChart(body,market){
 const data=typeof body==='string'?JSON.parse(body):body;
 if(!data||!Array.isArray(data.feed?.results))throw new Error('Недійсний формат Apple Music RSS');
 return data.feed.results.slice(0,30).map((x,i)=>({
  id:String(x.id||`${market}-${i}`).slice(0,100),
  title:String(x.name||'').trim().slice(0,160),
  artist:String(x.artistName||'').trim().slice(0,160),
  url:httpsUrl(x.url),
  artworkUrl:httpsUrl(x.artworkUrl100),
  releaseDate:dateOnly(x.releaseDate),
  market,rank:i+1
 })).filter(x=>x.title&&x.url);
}
async function fetchMusicCharts(fetcher=fetch){
 const requests=Object.keys(CHART_MARKETS);
 const responses=await Promise.allSettled(requests.map(async market=>{
  const url=`https://rss.applemarketingtools.com/api/v2/${market}/music/most-played/25/songs.json`;
  const res=await fetcher(url,{signal:AbortSignal.timeout(14000)});
  if(!res.ok)throw new Error(`Apple RSS ${market}: ${res.status}`);
  const body=await res.text();if(body.length>1_500_000)throw new Error('Надто великий RSS');
  return parseChart(body,market);
 }));
 const markets={},errors=[];
 responses.forEach((r,i)=>{const market=requests[i];if(r.status==='fulfilled')markets[market]=r.value;
   else{markets[market]=[];errors.push(market);}});
 return {markets,errors,fetchedAt:new Date().toISOString(),source:'Apple Music — top songs',method:'Популярні зараз; нові релізи відбираються за датою, якщо вона є'};
}
module.exports={CHART_MARKETS,parseChart,fetchMusicCharts};
