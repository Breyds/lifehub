'use strict';
const crypto=require('node:crypto');
const http=require('node:http');
const REDIRECT='http://127.0.0.1:43827/callback';
const text=(s,n=180)=>String(s||'').trim().slice(0,n);
const key=(a,t)=>text(a).toLowerCase()+'|'+text(t).toLowerCase();
const clientValid=id=>typeof id==='string'&&/^[a-f0-9]{32}$/i.test(id);
async function tokenRequest(params,fetcher=fetch){
 const res=await fetcher('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw Error('Spotify token: HTTP '+res.status);
 const data=await res.json();if(!data.access_token)throw Error('Spotify не повернув токен');
 return data;
}
async function authorize(clientId,openBrowser){
 if(!clientValid(clientId))throw Error('Потрібен Spotify Client ID із Developer Dashboard');
 const verifier=crypto.randomBytes(48).toString('base64url'),state=crypto.randomBytes(24).toString('hex');
 const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
 const url=new URL('https://accounts.spotify.com/authorize');
 url.search=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:REDIRECT,scope:'user-library-read user-top-read playlist-read-private playlist-read-collaborative',code_challenge_method:'S256',code_challenge:challenge,state}).toString();
 let server,timer;
 try{
  const code=await new Promise((resolve,reject)=>{
   server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://127.0.0.1:43827');
    if(u.pathname!=='/callback'||u.searchParams.get('state')!==state){res.writeHead(400);res.end('Invalid callback');return;}
    const code=u.searchParams.get('code');
    res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(code?'Spotify authorized. Return to LifeHub.':'Authorization declined.');
    code?resolve(code):reject(Error('Spotify authorization cancelled'));
   });
   server.once('error',reject);
   server.listen(43827,'127.0.0.1',()=>{Promise.resolve(openBrowser(url.toString())).catch(reject);});
   timer=setTimeout(()=>reject(Error('Spotify authorization timed out')),120000);
  });
  return await tokenRequest({grant_type:'authorization_code',client_id:clientId,code,redirect_uri:REDIRECT,code_verifier:verifier});
 }finally{clearTimeout(timer);if(server)server.close();}
}
async function spotifyGet(token,endpoint,fetcher=fetch){
 const res=await fetcher('https://api.spotify.com/v1/'+endpoint,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw Error('Spotify API: HTTP '+res.status+(res.status===429?' · перевищено квоту, повтори пізніше':''));
 return res.json();
}
function cover(images){return (images||[]).map(x=>x?.url).find(v=>typeof v==='string'&&/^https:\/\/(?:i\.scdn\.co|image-cdn-ak\.spotifycdn\.com|image-cdn-fa\.spotifycdn\.com)\//i.test(v))||'';}
function weekWindow(week,now=new Date()){
 const d=new Date(week+'T12:00:00Z');if(!Number.isFinite(d.getTime()))throw Error('Невірна дата тижня');
 const end=week<=now.toISOString().slice(0,10)?week:now.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()-6);
 return {from:d.toISOString().slice(0,10),to:end};
}
function isFresh(t,window){return /^\d{4}-\d{2}-\d{2}$/.test(t.releaseDate||'')&&t.releaseDate>=window.from&&t.releaseDate<=window.to&&!/\b(remaster(?:ed)?|reissue|anniversary|deluxe)\b/i.test(t.album||'');}
function playlistId(raw){
 const s=String(raw||'').trim();if(/^[A-Za-z0-9]{22}$/.test(s))return s;
 try{const u=new URL(s);if(u.protocol==='https:'&&u.hostname==='open.spotify.com')return u.pathname.match(/\/playlist\/([A-Za-z0-9]{22})(?:\/|$)/)?.[1]||'';}catch{}
 return '';
}
async function readOwnedPlaylist(token,id,fetcher=fetch){
 if(!/^[A-Za-z0-9]{22}$/.test(id))throw Error('Некоректне посилання на плейлист');
 const data=await spotifyGet(token,'playlists/'+id+'/items?limit=50',fetcher);
 return extractTracks(data.items);
}
async function readFreshArtists(token,taste,window,fetcher=fetch){
 const weights=new Map();for(const t of taste)for(const a of t.artists||[t.artist])weights.set(a,(weights.get(a)||0)+1);
 const artists=[...weights.entries()].sort((a,b)=>b[1]-a[1]).slice(0,24).map(x=>x[0]);
 const albums=new Map();
 let successful=0;
 for(let i=0;i<artists.length;i+=4){
  const results=await Promise.allSettled(artists.slice(i,i+4).map(async a=>{
   const q=new URLSearchParams({q:'artist:"'+a.replace(/["\\]/g,'')+'" tag:new',type:'album',limit:'10'});
   const data=await spotifyGet(token,'search?'+q,fetcher);
   return (data.albums?.items||[]).filter(x=>x.id&&x.artists?.some(v=>v.name.toLowerCase()===a.toLowerCase())&&isFresh({releaseDate:x.release_date,album:x.name},window));
  }));
  for(const r of results)if(r.status==='fulfilled'){successful++;for(const a of r.value)albums.set(a.id,a);}
 }
 if(artists.length&&!successful)throw Error('Не вдалося прочитати нові релізи Spotify');
 const tracks=[],recent=[...albums.values()].sort((a,b)=>b.release_date.localeCompare(a.release_date)).slice(0,30);
 for(let i=0;i<recent.length;i+=4){
  const results=await Promise.allSettled(recent.slice(i,i+4).map(async album=>{
   const data=await spotifyGet(token,'albums/'+album.id+'/tracks?limit=50',fetcher);
   return extractTracks((data.items||[]).map(t=>({...t,album})));
  }));
  for(const r of results)if(r.status==='fulfilled')tracks.push(...r.value);
 }
 return tracks.map((t,i)=>({...t,market:'spotify',rank:i+1,source:'spotify-new'}));
}
function regionalPicks(taste,markets,excluded=[]){
 const result={us:[],regional:[]},seen=new Set(excluded.map(t=>key(t.artist,t.title)));
 const weights=new Map();for(const t of taste)for(const a of t.artists||[t.artist])weights.set(a.toLowerCase(),(weights.get(a.toLowerCase())||0)+1);
 const known=new Set(taste.map(t=>key(t.artist,t.title)));
 for(const [group,countries] of [['us',['us']],['regional',['ua','kz','ru']]]){
  const candidates=countries.flatMap(m=>markets[m]||[]).filter(t=>!known.has(key(t.artist,t.title))&&weights.has(t.artist.toLowerCase())).sort((a,b)=>a.rank-b.rank||(weights.get(b.artist.toLowerCase())||0)-(weights.get(a.artist.toLowerCase())||0));
  const artistCount=new Map();
  for(const t of candidates){const k=key(t.artist,t.title),a=t.artist.toLowerCase();if(seen.has(k)||(artistCount.get(a)||0)>=2)continue;seen.add(k);artistCount.set(a,(artistCount.get(a)||0)+1);result[group].push({...t,reason:'У твоєму смаку · чарт #'+t.rank});if(result[group].length>=5)break;}
 }
 return result;
}
function extractTracks(items){
 return (items||[]).map(x=>x?.track||x?.item||x).filter(x=>x?.id&&x?.name&&x?.artists?.length).map(x=>({id:x.id,title:text(x.name),artist:text(x.artists[0].name),artists:x.artists.map(a=>text(a.name)),url:/^https:\/\/open\.spotify\.com\/track\//.test(x.external_urls?.spotify||'')?x.external_urls.spotify:'',album:text(x.album?.name),releaseDate:text(x.album?.release_date,10),artworkUrl:cover(x.album?.images),artistIds:x.artists.map(a=>a.id).filter(Boolean)}));
}
async function readTaste(token,fetcher=fetch){
 const saved=await spotifyGet(token,'me/tracks?limit=50',fetcher);
 const [top,more]=await Promise.allSettled([spotifyGet(token,'me/top/tracks?limit=50&time_range=medium_term',fetcher),saved.next?spotifyGet(token,'me/tracks?limit=50&offset=50',fetcher):Promise.resolve({items:[]})]);
 return [...extractTracks(saved.items),...extractTracks(more.status==='fulfilled'?more.value.items:[]),...extractTracks(top.status==='fulfilled'?top.value.items:[])];
}
async function excludeSaved(token,tracks,fetcher=fetch){
 const unique=[...new Map(tracks.filter(t=>/^[A-Za-z0-9]{22}$/.test(t.id)).map(t=>[t.id,t])).values()];
 const out=[];
 for(let i=0;i<unique.length;i+=40){
  const batch=unique.slice(i,i+40);
  const result=await spotifyGet(token,'me/library/contains?'+new URLSearchParams({uris:batch.map(t=>'spotify:track:'+t.id).join(',')}),fetcher);
  if(!Array.isArray(result)||result.length!==batch.length||result.some(x=>typeof x!=='boolean'))throw Error('Spotify не підтвердив стан бібліотеки');
  out.push(...batch.filter((_,j)=>!result[j]));
 }
 return out;
}
async function discoverArtistTracks(token,taste,fetcher=fetch){
 const weights=new Map();
 for(const t of taste)for(const a of t.artists||[t.artist])weights.set(a,(weights.get(a)||0)+1);
 const artists=[...weights.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(a=>a[0]);
 const result=await Promise.allSettled(artists.map(async a=>{
  const query=new URLSearchParams({q:'artist:"'+a.replace(/["\\]/g,'')+'"',type:'track',limit:'10'});
  const response=await spotifyGet(token,'search?'+query,fetcher);
  return extractTracks(response.tracks?.items).filter(t=>t.artists.some(v=>v.toLowerCase()===a.toLowerCase())).map((t,i)=>({...t,market:'spotify',rank:100+i+1,artworkUrl:t.artworkUrl,source:'spotify-artist'}));
 }));
 return result.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);
}
function recommend(taste,markets,previous=[]){
 const known=new Set(taste.map(t=>key(t.artist,t.title))),seen=new Set(),prior=new Set(previous.map(t=>key(t.artist,t.title))),counts=new Map(),perArtist=new Map();
 for(const t of taste)for(const artist of t.artists||[t.artist])counts.set(artist.toLowerCase(),(counts.get(artist.toLowerCase())||0)+1);
 const candidates=Object.values(markets||{}).flat().filter(t=>!known.has(key(t.artist,t.title))&&!prior.has(key(t.artist,t.title)));
 const matching=candidates.map(t=>({t,affinity:counts.get(t.artist.toLowerCase())||0})).filter(x=>x.affinity>0).sort((a,b)=>b.affinity-a.affinity||a.t.rank-b.t.rank);
 const out=[];
 for(const {t,affinity} of matching){const k=key(t.artist,t.title);if(seen.has(k)||(perArtist.get(t.artist.toLowerCase())||0)>=3)continue;seen.add(k);perArtist.set(t.artist.toLowerCase(),(perArtist.get(t.artist.toLowerCase())||0)+1);out.push({...t,reason:'Виконавець є у твоїй бібліотеці Spotify ('+affinity+' збігів)'});if(out.length===10)break;}
 return out;
}
module.exports={REDIRECT,clientValid,authorize,tokenRequest,readTaste,recommend,extractTracks,discoverArtistTracks,excludeSaved,weekWindow,isFresh,readFreshArtists,readOwnedPlaylist,playlistId,regionalPicks,cover};
