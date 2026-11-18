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
 return data.feed.results.slice(0,100).map((x,i)=>({
  id:String(x.id||`${market}-${i}`).slice(0,100),
  title:String(x.name||'').trim().slice(0,160),
  artist:String(x.artistName||'').trim().slice(0,160),
  url:httpsUrl(x.url),
  artworkUrl:httpsUrl(x.artworkUrl100),
  releaseDate:dateOnly(x.releaseDate),
  market,rank:i+1
 })).filter(x=>x.title&&x.url);
}
// A separate verified source for recently released songs: tracks from top album releases.
// We never call an older chart hit a new release merely because it is trending now.
async function fetchFreshAlbumTracks(market,fetcher=fetch,now=new Date()){
 const cutoff=new Date(now.getTime()-7*86400000).toISOString().slice(0,10);
 const current=now.toISOString().slice(0,10);
 const albumUrl=`https://rss.applemarketingtools.com/api/v2/${market}/music/most-played/100/albums.json`;
 const res=await fetcher(albumUrl,{signal:AbortSignal.timeout(14000)});
 if(!res.ok)throw new Error(`Album RSS ${market}: ${res.status}`);
 const raw=await res.text();if(raw.length>2_000_000)throw new Error('Завелика відповідь');
 const data=JSON.parse(raw);
 const newest=(data.feed?.results||[]).map((a,i)=>({...a,albumRank:i+1})).filter(a=>dateOnly(a.releaseDate)>=cutoff&&dateOnly(a.releaseDate)<=current&&/^\d+$/.test(String(a.id))).slice(0,8);
 const arrays=await Promise.allSettled(newest.map(async a=>{
  const u=`https://itunes.apple.com/lookup?id=${encodeURIComponent(String(a.id))}&entity=song&country=${market}&limit=80`;
  const result=await fetcher(u,{signal:AbortSignal.timeout(10000)});
  if(!result.ok)throw new Error('Lookup failed');const json=await result.json();
  return (json.results||[]).filter(t=>t.wrapperType==='track'&&t.kind==='song').map(t=>({
   id:String(t.trackId||`${a.id}-${t.trackName}`),title:String(t.trackName||'').slice(0,160),artist:String(t.artistName||a.artistName||'').slice(0,160),url:httpsUrl(t.trackViewUrl||a.url),
   artworkUrl:httpsUrl(t.artworkUrl100||a.artworkUrl100),releaseDate:dateOnly(a.releaseDate),market,rank:a.albumRank,source:'new-album',album:String(a.name||'').slice(0,120)
  })).filter(t=>t.title&&t.url);
 }));
 return arrays.filter(x=>x.status==='fulfilled').flatMap(x=>x.value).slice(0,90);
}
async function fetchMusicCharts(fetcher=fetch){
 const requests=Object.keys(CHART_MARKETS);
 const responses=await Promise.allSettled(requests.map(async market=>{
  const url=`https://rss.applemarketingtools.com/api/v2/${market}/music/most-played/100/songs.json`;
  const res=await fetcher(url,{signal:AbortSignal.timeout(14000)});
  if(!res.ok)throw new Error(`Apple RSS ${market}: ${res.status}`);
  const body=await res.text();if(body.length>1_500_000)throw new Error('Надто великий RSS');
  return parseChart(body,market);
 }));
 const freshReleases={},freshErrors=[];
 // The new-release feed is separate from chart hits and may be unavailable in some markets.
 // This extra request costs no OpenAI tokens; it uses Apple's public catalog data.
 await Promise.all(requests.map(async market=>{try{freshReleases[market]=await fetchFreshAlbumTracks(market,fetcher);}catch{freshReleases[market]=[];freshErrors.push(market);}}));
 const markets={},errors=[];
 responses.forEach((r,i)=>{const market=requests[i];if(r.status==='fulfilled')markets[market]=r.value;
   else{markets[market]=[];errors.push(market);}});
 return {markets,freshReleases,errors,freshErrors,fetchedAt:new Date().toISOString(),source:'Apple Music — top 100 songs + top albums',method:'Новинки: підтверджені релізи із топ-100 пісень і треки з альбомів, що вийшли за останні 7 днів'};
}
module.exports={CHART_MARKETS,parseChart,fetchMusicCharts,fetchFreshAlbumTracks};
