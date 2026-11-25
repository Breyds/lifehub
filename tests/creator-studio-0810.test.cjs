'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {config,durationSeconds,videoRow,listVideos,analytics,uploadMetadata,upload,schedule,safeUploadLocation}=require('../electron/youtube-studio.cjs');
const {parseTrends,nicheRadar}=require('../electron/youtube-trends.cjs');
const {blankWorkspace,addItem,updateItem}=require('../electron/workspace.cjs');
test('creator plans and production checks persist on edits',()=>{
 const w=blankWorkspace(),ch=addItem(w,'channels',{title:'Channel',strategy:'plan',watchlist:[{title:'Competitor',url:'https://www.youtube.com/@sample'}]});
 const idea=addItem(w,'ideas',{title:'Video',channelId:ch.id,format:'long',hook:'Hook',script:'Script',checklist:['hook','rights','invalid','hook']});
 assert.equal(idea.format,'long');assert.deepEqual(idea.checklist,['hook','rights']);
 assert.equal(updateItem(w,'ideas',idea.id,{status:'ready'}).script,'Script');assert.equal(ch.watchlist.length,1);
});
test('OAuth and upload parameters are validated and scheduling is private/future',()=>{
 assert.throws(()=>config({clientId:'bad',clientSecret:'bad'}));
 const now=Date.parse('2026-11-25T00:00:00Z'),r=uploadMetadata({title:'My video',publishAt:'2026-11-26T18:00:00Z',madeForKids:false,tags:'one,two'},now);
 assert.equal(r.status.privacyStatus,'private');assert.equal(r.status.selfDeclaredMadeForKids,false);assert.deepEqual(r.snippet.tags,['one','two']);
 assert.throws(()=>uploadMetadata({title:'x',publishAt:'2026-11-26T00:00:00Z'},now));
 assert.throws(()=>uploadMetadata({title:'x',publishAt:'2026-11-24T00:00:00Z',madeForKids:false},now));
 assert.throws(()=>safeUploadLocation('https://example.org/upload/'));
});
test('duration filter labels candidates rather than claiming actual Shorts',()=>{
 assert.equal(durationSeconds('PT2M59S'),179);assert.equal(durationSeconds('PT1H2M3S'),3723);assert.equal(durationSeconds('invalid'),null);
 assert.equal(videoRow({id:'abc',contentDetails:{duration:'PT3M'}}).format,'short-candidate');
 assert.equal(videoRow({id:'abc',contentDetails:{duration:'PT3M1S'}}).format,'long');
 const now=Date.parse('2026-11-25T12:00:00Z'),rows=[{id:{videoId:'a'},_topic:'games'},{id:{videoId:'b'},_topic:'games'}],detail={items:[{id:'a',snippet:{publishedAt:'2026-11-24T12:00:00Z'},statistics:{viewCount:'100'},contentDetails:{duration:'PT1M'}},{id:'b',snippet:{publishedAt:'2026-11-24T12:00:00Z'},statistics:{viewCount:'200'},contentDetails:{duration:'PT10M'}}]};
 assert.deepEqual(parseTrends(rows,detail,now).map(x=>x.format),['long','short-candidate']);
});
test('owner playlist pages and analytics use authenticated channel ID',async()=>{
 const owner={id:'UC'+'a'.repeat(22),uploads:'UUabc'},id='a'.repeat(11);
 const fetcher=async(url)=>{const u=new URL(url);let data={};if(u.pathname.endsWith('/playlistItems')){assert.equal(u.searchParams.get('pageToken'),'next');data={items:[{contentDetails:{videoId:id}}],nextPageToken:'more'};}else if(u.pathname.endsWith('/videos'))data={items:[{id,snippet:{channelId:owner.id,title:'Owned'}},{id:'b'.repeat(11),snippet:{channelId:'other'}}]};else{assert.equal(u.searchParams.get('ids'),'channel=='+owner.id);assert.equal(u.searchParams.get('filters'),'video=='+id);data={columnHeaders:[{name:'views'}],rows:[[42]]};}return {ok:true,json:async()=>data};};
 const v=await listVideos('token',owner,'next',fetcher);assert.equal(v.items.length,1);assert.equal(v.nextPageToken,'more');
 const a=await analytics('token',owner,id,fetcher);assert.equal(a.metrics.views,42);
});
test('chunked upload verifies actual ID, and schedule requires exact API confirmation',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lifehub-yt-')),file=path.join(dir,'v.mp4');fs.writeFileSync(file,Buffer.alloc(1024));const id='a'.repeat(11),status={privacyStatus:'private',publishAt:'2099-12-01T10:00:00Z',selfDeclaredMadeForKids:false};
 try{let calls=0;const r=await upload('token',file,{snippet:{title:'video'},status:{privacyStatus:'private'}},()=>{},async(url,opts)=>{calls++;if(calls===1){assert.equal(opts.method,'POST');return {ok:true,headers:{get:()=> 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=example'}};}assert.equal(opts.headers['Content-Range'],'bytes 0-1023/1024');return {ok:true,status:200,json:async()=>({id})};});assert.equal(r.id,id);
 const out=await schedule('token',id,status,async()=>({ok:true,json:async()=>({id,status})}));assert.equal(out.publishAt,status.publishAt);
 await assert.rejects(schedule('token',id,status,async()=>({ok:true,json:async()=>({id,status:{privacyStatus:'private'}})})));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('niche radar uses actual public subscriber counts and excludes large or hidden channels',async()=>{
 const a='UC'+'a'.repeat(22),b='UC'+'b'.repeat(22),id='a'.repeat(11),id2='b'.repeat(11);
 const result=await nicheRadar('key','quiz','short',async(url)=>{const p=new URL(url).pathname;let items;if(p.endsWith('/search'))items=[{id:{videoId:id}},{id:{videoId:id2}}];else if(p.endsWith('/videos'))items=[{id,snippet:{title:'Example',channelId:a,publishedAt:new Date().toISOString()},statistics:{viewCount:'10000'},contentDetails:{duration:'PT1M'}},{id:id2,snippet:{title:'Big',channelId:b,publishedAt:new Date().toISOString()},statistics:{viewCount:'100000'},contentDetails:{duration:'PT1M'}}];else items=[{id:a,snippet:{title:'Small'},statistics:{subscriberCount:'1000'}},{id:b,snippet:{title:'Big'},statistics:{subscriberCount:'100000'}}];return {ok:true,json:async()=>({items})};});
 assert.equal(result.length,1);assert.equal(result[0].ratio,10);
});
