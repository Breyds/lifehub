'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {sample,windowChange,refreshEarly,publicRadar}=require('../electron/youtube-early.cjs');
const {scan,metadata,copyStable,coverFile}=require('../electron/youtube-inbox.cjs');
const {planOptions,validatePlan}=require('../electron/youtube-plan.cjs');
test('growth uses real sample windows, not extrapolated counts',()=>{
 const h=3600000,now=Date.parse('2026-11-25T18:00:00Z');
 let list=sample([],100,now-6*h);
 list=sample(list,400,now);
 assert.equal(windowChange(list,6).change,300);assert.equal(windowChange(list,6).hours,6);
 assert.equal(windowChange(list,12),null);assert.equal(windowChange(list,24),null);
 assert.equal(sample(list,500,now+1000).length,2);
});
test('early radar searches fresh publications, filters new low-view channels, keeps actual history',async()=>{
 const now=Date.parse('2026-11-25T18:00:00Z'),id='a'.repeat(11),big='b'.repeat(11),ch='UC'+'a'.repeat(22),chBig='UC'+'b'.repeat(22);
 let count=120;
 const fetcher=async(url)=>{const u=new URL(url),p=u.pathname;let items;if(p.endsWith('/search')){assert.equal(u.searchParams.get('order'),'date');items=[{id:{videoId:id}},{id:{videoId:big}}];}else if(p.endsWith('/videos'))items=[{id,snippet:{channelId:ch,title:'New idea',publishedAt:'2026-11-25T00:00:00Z'},statistics:{viewCount:String(count)},contentDetails:{duration:'PT1M'}},{id:big,snippet:{channelId:chBig,title:'Big',publishedAt:'2026-11-25T00:00:00Z'},statistics:{viewCount:'123456'},contentDetails:{duration:'PT5M'}}];else items=[{id:ch,snippet:{title:'Small',publishedAt:'2026-11-01T00:00:00Z'},statistics:{subscriberCount:'20',videoCount:'3'}},{id:chBig,snippet:{title:'Big'},statistics:{subscriberCount:'50000'}}];return {ok:true,json:async()=>({items})};};
 const first=await refreshEarly('key',{query:'quiz'},{discover:true,now,fetcher});assert.equal(first.rows.length,1);assert.equal(first.rows[0].views,120);
 count=600;const second=await refreshEarly('key',first,{discover:false,now:now+6*3600000,fetcher});const row=publicRadar(second,now+6*3600000).rows[0];
 assert.equal(row.windows[0].data.change,480);assert.equal(row.windows[1].data,null);
});
test('Inbox waits for stable files and reads bounded sidecar metadata and cover',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lifehub-inbox-')),name='example.mp4',file=path.join(folder,name);
 try{
 fs.writeFileSync(file,Buffer.from('video'));const t=Date.now()-120000;fs.utimesSync(file,new Date(t),new Date(t));fs.writeFileSync(path.join(folder,'example.json'),JSON.stringify({title:'My video',tags:['a','b'],madeForKids:false,publishAt:'2099-12-01T12:00:00Z',format:'long'}));fs.writeFileSync(path.join(folder,'example.png'),Buffer.from('image'));
 const first=scan(folder,{},t+30000);assert.equal(first.rows[0].ready,false);
 const second=scan(folder,first.next,t+60000);assert.equal(second.rows[0].ready,true);
 const m=metadata(folder,name);assert.equal(m.title,'My video');assert.equal(m.tags,'a, b');assert.equal(m.format,'long');assert.equal(m.madeForKids,false);assert.equal(path.basename(coverFile(folder,name)),'example.png');
 const hash=await copyStable(folder,second.rows[0],path.join(folder,'copy.mp4'));assert.match(hash,/^[a-f0-9]{64}$/);
 fs.writeFileSync(file,'changed file');await assert.rejects(copyStable(folder,second.rows[0],path.join(folder,'copy2.mp4')));
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('AI plan enforces dates, exact counts, real reference allowlist',()=>{
 const options=planOptions({start:'2099-12-01',days:7,shorts:1,longs:1});
 const raw={strategy:'Plan',items:[{day:1,format:'short',title:'A',hook:'Hook',script:'Script',note:'',referenceId:'real'},{day:7,format:'long',title:'B',hook:'',script:'',note:'',referenceId:'made-up'}]};
 const out=validatePlan(raw,options,[{id:'real',url:'https://www.youtube.com/watch?v=abc'}]);assert.equal(out.items[1].date,'2099-12-07');assert.equal(out.items[0].url,'https://www.youtube.com/watch?v=abc');assert.equal(out.items[1].url,'');
 assert.throws(()=>validatePlan({...raw,items:[raw.items[0]]},options));
 assert.throws(()=>validatePlan({...raw,items:[raw.items[0],{...raw.items[1],day:8}]},options));
});
