'use strict';
const crypto=require('node:crypto'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const SCOPES=['youtube.readonly','youtube.upload','yt-analytics.readonly'].map(s=>'https://www.googleapis.com/auth/'+s);
const ID=/^[A-Za-z0-9_-]{11}$/;
const channelId=/^UC[A-Za-z0-9_-]{22}$/;
const shortText=(v,n)=>String(v??'').trim().slice(0,n);
function config(raw){
 const clientId=shortText(raw?.clientId,200),clientSecret=shortText(raw?.clientSecret,200);
 if(!/^[a-zA-Z0-9_.-]+\.apps\.googleusercontent\.com$/.test(clientId)||!clientSecret||!/^[a-zA-Z0-9_-]+$/.test(clientSecret))throw Error('Потрібні Client ID та Client Secret власного Google OAuth Desktop client');
 return {clientId,clientSecret};
}
async function json(url,opts={},fetcher=fetch){
 const r=await fetcher(url,{...opts,signal:opts.signal||AbortSignal.timeout(25000)});
 const data=await r.json();
 if(!r.ok)throw Error('Google API '+r.status+': '+String(data.error?.message||data.error_description||data.error||'Запит відхилено').slice(0,220));
 return data;
}
function tokenRequest(cfg,params,fetcher=fetch){
 return json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,...params})},fetcher);
}
async function authorize(cfg,openExternal,fetcher=fetch){
 const verifier=crypto.randomBytes(48).toString('base64url'),state=crypto.randomBytes(32).toString('base64url');
 const server=http.createServer();
 await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
 const redirect='http://127.0.0.1:'+server.address().port+'/callback';
 try{
  const code=await new Promise((resolve,reject)=>{
   let done=false;const finish=(err,value)=>{if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(value);};
   const timer=setTimeout(()=>finish(Error('Час авторизації вичерпано')),180000);
   server.on('request',(req,res)=>{
    const u=new URL(req.url,redirect);
    if(u.pathname!=='/callback'||u.searchParams.get('state')!==state){res.writeHead(400);res.end('Invalid callback');return;}
    const code=u.searchParams.get('code');res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end(code?'LifeHub: authorization received. Return to the app.':'Authorization cancelled.');
    finish(code?null:Error('Google не надав дозвіл'),code);
   });
   const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
   u.search=new URLSearchParams({client_id:cfg.clientId,redirect_uri:redirect,response_type:'code',scope:SCOPES.join(' '),state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',access_type:'offline',prompt:'consent select_account'}).toString();
   Promise.resolve(openExternal(u.toString())).catch(e=>finish(e));
  });
  return await tokenRequest(cfg,{code,code_verifier:verifier,redirect_uri:redirect,grant_type:'authorization_code'},fetcher);
 }finally{server.close();}
}
function api(token,endpoint,params={},fetcher=fetch){
 const u=new URL('https://www.googleapis.com/youtube/v3/'+endpoint);u.search=new URLSearchParams(params).toString();
 return json(u,{headers:{Authorization:'Bearer '+token}},fetcher);
}
async function mine(token,fetcher=fetch){
 const data=await api(token,'channels',{part:'snippet,statistics,contentDetails',mine:'true',maxResults:'50'},fetcher);
 return (data.items||[]).filter(x=>channelId.test(x.id)).map(x=>({id:x.id,title:shortText(x.snippet?.title,150),thumbnail:x.snippet?.thumbnails?.medium?.url||'',uploads:x.contentDetails?.relatedPlaylists?.uploads||'',subscribers:x.statistics?.hiddenSubscriberCount?null:Number(x.statistics?.subscriberCount||0),views:Number(x.statistics?.viewCount||0),videos:Number(x.statistics?.videoCount||0)}));
}
function durationSeconds(s){const m=String(s||'').match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return m?Number(m[1]||0)*86400+Number(m[2]||0)*3600+Number(m[3]||0)*60+Number(m[4]||0):null;}
function videoRow(v){
 const seconds=durationSeconds(v.contentDetails?.duration);
 return {id:v.id,title:shortText(v.snippet?.title,180),description:shortText(v.snippet?.description,1200),thumbnail:v.snippet?.thumbnails?.medium?.url||'',channelId:v.snippet?.channelId||'',publishedAt:v.snippet?.publishedAt||'',seconds,format:seconds===null?'unknown':seconds<=180?'short-candidate':'long',views:Number(v.statistics?.viewCount||0),likes:v.statistics?.likeCount===undefined?null:Number(v.statistics.likeCount),comments:v.statistics?.commentCount===undefined?null:Number(v.statistics.commentCount),privacy:v.status?.privacyStatus||'',publishAt:v.status?.publishAt||'',uploadStatus:v.status?.uploadStatus||''};
}
async function listVideos(token,owner,pageToken='',fetcher=fetch){
 if(!owner.uploads)throw Error('YouTube не повернув плейлист завантажень');
 const p=await api(token,'playlistItems',{part:'contentDetails',playlistId:owner.uploads,maxResults:'50',...(pageToken?{pageToken}:{})},fetcher);
 const ids=(p.items||[]).map(v=>v.contentDetails?.videoId).filter(x=>ID.test(x));
 const d=ids.length?await api(token,'videos',{part:'snippet,contentDetails,statistics,status',id:ids.join(',')},fetcher):{items:[]};
 return {items:(d.items||[]).filter(v=>v.snippet?.channelId===owner.id).map(videoRow),nextPageToken:p.nextPageToken||''};
}
async function analytics(token,owner,videoId='',fetcher=fetch,clock=new Date()){
 if(videoId&&!ID.test(videoId))throw Error('Некоректний video ID');
 const end=new Date(clock.getTime()-2*86400000),start=new Date(end.getTime()-27*86400000);
 const u=new URL('https://youtubeanalytics.googleapis.com/v2/reports');
 u.search=new URLSearchParams({ids:'channel=='+owner.id,startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10),metrics:'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost',...(videoId?{filters:'video=='+videoId}:{})}).toString();
 const d=await json(u,{headers:{Authorization:'Bearer '+token}},fetcher);
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10),metrics:Object.fromEntries((d.columnHeaders||[]).map((h,i)=>[h.name,d.rows?.[0]?.[i]??null]))};
}
function uploadMetadata(raw,now=Date.now()){
 const title=shortText(raw.title,100),description=shortText(raw.description,5000),tags=String(raw.tags||'').split(',').map(x=>shortText(x,80)).filter(Boolean).slice(0,30);
 if(!title||/[<>]/.test(title)||/[<>]/.test(description))throw Error('Назва обов’язкова; символи < > не допускаються');
 if(tags.join(',').length>450)throw Error('Забагато тегів');
 if(typeof raw.madeForKids!=='boolean')throw Error('Вкажи, чи відео призначене для дітей');
 const ms=Date.parse(raw.publishAt);if(!Number.isFinite(ms)||ms<now+15*60000)throw Error('Заплануй публікацію щонайменше через 15 хвилин');
 return {snippet:{title,description,tags,categoryId:/^\d{1,3}$/.test(raw.categoryId)?raw.categoryId:'22'},status:{privacyStatus:'private',publishAt:new Date(ms).toISOString(),selfDeclaredMadeForKids:raw.madeForKids}};
}
function safeUploadLocation(raw){const u=new URL(raw);if(u.protocol!=='https:'||!['www.googleapis.com','youtube.googleapis.com'].includes(u.hostname)||!u.pathname.startsWith('/upload/'))throw Error('Недовірена адреса завантаження');return u.toString();}
async function upload(token,file,meta,onProgress=()=>{},fetcher=fetch){
 const stat=fs.statSync(file);if(!stat.isFile()||stat.size<1||stat.size>4*1024**3)throw Error('Підтримуються файли до 4 ГБ');
 const type=({'.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.mkv':'video/x-matroska'})[path.extname(file).toLowerCase()];if(!type)throw Error('Підтримувані формати MP4, MOV, WEBM, MKV');
 const start=await fetcher('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Upload-Content-Length':String(stat.size),'X-Upload-Content-Type':type},body:JSON.stringify(meta),signal:AbortSignal.timeout(30000)});
 if(!start.ok)throw Error('YouTube не почав завантаження: '+start.status+' '+(await start.text()).slice(0,200));
 const location=safeUploadLocation(start.headers.get('location'));const fd=fs.openSync(file,'r');let offset=0;
 try{
  while(offset<stat.size){
   const size=Math.min(8*1024*1024,stat.size-offset),buf=Buffer.alloc(size);if(fs.readSync(fd,buf,0,size,offset)!==size)throw Error('Файл змінився під час завантаження');
   const r=await fetcher(location,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':type,'Content-Length':String(size),'Content-Range':'bytes '+offset+'-'+(offset+size-1)+'/'+stat.size},body:buf,signal:AbortSignal.timeout(120000)});
   if(r.status===308){const m=r.headers.get('range')?.match(/^bytes=0-(\d+)$/i),next=m?Number(m[1])+1:0;if(next<=offset||next>offset+size)throw Error('YouTube не підтвердив прогрес; перевір Studio перед повтором');offset=next;onProgress(offset/stat.size);continue;}
   if(!r.ok)throw Error('YouTube upload: '+r.status+' '+(await r.text()).slice(0,200));
   const data=await r.json();if(!ID.test(data.id))throw Error('Не підтверджено ID відео; перевір YouTube Studio');
   onProgress(1);return videoRow(data);
  }
  throw Error('YouTube не підтвердив завершення; перевір Studio перед повторним завантаженням');
 }finally{fs.closeSync(fd);}
}
module.exports={config,authorize,tokenRequest,api,mine,durationSeconds,videoRow,listVideos,analytics,uploadMetadata,upload,safeUploadLocation};
