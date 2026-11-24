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
 url.search=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:REDIRECT,scope:'user-library-read user-top-read',code_challenge_method:'S256',code_challenge:challenge,state}).toString();
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
function extractTracks(items){
 return (items||[]).map(x=>x?.track||x?.item||x).filter(x=>x?.id&&x?.name&&x?.artists?.length).map(x=>({id:x.id,title:text(x.name),artist:text(x.artists[0].name),artists:x.artists.map(a=>text(a.name)),url:/^https:\/\/open\.spotify\.com\/track\//.test(x.external_urls?.spotify||'')?x.external_urls.spotify:'',album:text(x.album?.name),releaseDate:text(x.album?.release_date,10)}));
}
async function readTaste(token,fetcher=fetch){
 const saved=await spotifyGet(token,'me/tracks?limit=50',fetcher);
 const [top,more]=await Promise.allSettled([spotifyGet(token,'me/top/tracks?limit=50&time_range=medium_term',fetcher),saved.next?spotifyGet(token,'me/tracks?limit=50&offset=50',fetcher):Promise.resolve({items:[]})]);
 return [...extractTracks(saved.items),...extractTracks(more.status==='fulfilled'?more.value.items:[]),...extractTracks(top.status==='fulfilled'?top.value.items:[])];
}
function recommend(taste,markets,previous=[]){
 const known=new Set(taste.map(t=>key(t.artist,t.title))),seen=new Set(),prior=new Set(previous.map(t=>key(t.artist,t.title))),counts=new Map();
 for(const t of taste)for(const artist of t.artists||[t.artist])counts.set(artist.toLowerCase(),(counts.get(artist.toLowerCase())||0)+1);
 const candidates=Object.values(markets||{}).flat().filter(t=>!known.has(key(t.artist,t.title))&&!prior.has(key(t.artist,t.title)));
 const matching=candidates.map(t=>({t,affinity:counts.get(t.artist.toLowerCase())||0})).filter(x=>x.affinity>0).sort((a,b)=>b.affinity-a.affinity||a.t.rank-b.t.rank);
 const out=[];
 for(const {t,affinity} of matching){const k=key(t.artist,t.title);if(seen.has(k))continue;seen.add(k);out.push({...t,reason:'Виконавець є у твоїй бібліотеці Spotify ('+affinity+' збігів)'});if(out.length===10)break;}
 return out;
}
module.exports={REDIRECT,clientValid,authorize,tokenRequest,readTaste,recommend,extractTracks};
