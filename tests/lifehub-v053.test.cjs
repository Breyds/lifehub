'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readDtekSchedule,slotsToDay,extractFactResponse}=require('../electron/dtek-live.cjs');
const {disposition,filterIncoming}=require('../electron/news-actions.cjs');
const {illustrationPrompt}=require('../electron/news-ai-image.cjs');
const fs=require('node:fs');const path=require('node:path');
test('DTEK schedule differentiates confirmed on/off and possible outages',()=>{
 const day=slotsToDay({'1':'yes','2':'no','3':'maybe','4':'first','5':'second'},'2026-11-18');
 assert.deepEqual(day.slots.slice(0,5).map(x=>x.status),['on','off','possible','off','on']);
 assert.equal(day.slots.at(-1).status,'unknown');
});
test('DTEK blocked POST returns an unavailable result instead of throwing or crashing',async()=>{
 const fake=async()=>({ok:false,status:403,headers:{get:()=>''}});
 const d=await readDtekSchedule(null,{settlement:'м. Приклад',street:'вул. Тестова',house:'1'},{fetcher:fake});
 assert.equal(d.status,'unavailable');assert.equal(d.intervals.length,0);assert.match(d.message,/403/);
});
test('DTEK official address data is selected by exact city/street using injected POST',async()=>{
 const date=new Date();const stamps=Math.floor(date.getTime()/1000);
 let count=0;
 const fake=async(_url,opts)=>{
  count++;const body=new URLSearchParams(opts.body);
  if(body.get('method')==='getStreets')return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({result:true,streets:{'м. Приклад':['вул. Тестова']}})};
  assert.equal(body.get('data[0][value]'),'м. Приклад');assert.equal(body.get('data[1][value]'),'вул. Тестова');
  return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({result:true,data:{'1':{sub_type_reason:['GPV2.1']}},fact:{data:{[stamps]:{'GPV2.1':{'1':'no','2':'yes'}}}}})};
 };
 const d=await readDtekSchedule(null,{settlement:'Приклад',street:'Тестова',house:'1'},{fetcher:fake});
 assert.equal(count,2);assert.equal(d.status,'verified');assert.ok(d.days.length>0);assert.ok(d.intervals.length>0);
});
test('DTEK does not infer that missing slots mean electricity is available',()=>{
 const out=extractFactResponse({result:true,data:{'1':{sub_type_reason:['GPV2.1']}},fact:{data:{}}},'1');
 assert.equal(out.days.length,0);
});
test('News dislike hides article and retains local topic feedback',()=>{
 const db={news:{items:[{id:'abc',title:'One story',category:'games',url:'https://example.org'}]},newsFeedback:{},newsSaved:[],newsDismissed:{}};
 disposition(db,'abc','not');assert.equal(db.news.items.length,0);assert.equal(db.newsFeedback.abc.vote,'not');assert.equal(db.newsFeedback.abc.title,'One story');assert.equal(db.newsSaved.length,0);
 assert.equal(filterIncoming([{id:'abc'}],db).length,0);
});
test('News like learns category but card disappears from feed',()=>{
 const db={news:{items:[{id:'a',title:'Video games',category:'games'}]},newsFeedback:{},newsSaved:[],newsDismissed:{}};
 disposition(db,'a','interesting');assert.equal(db.news.items.length,0);assert.equal(db.newsFeedback.a.category,'games');
 assert.equal(filterIncoming([{id:'a'}],db).length,0);
});
test('News bookmark preserves article separately',()=>{
 const db={news:{items:[{id:'b',title:'Interesting story',category:'world'}]},newsFeedback:{},newsSaved:[],newsDismissed:{}};
 disposition(db,'b','save');assert.equal(db.news.items.length,0);assert.equal(db.newsSaved[0].id,'b');
});
test('News image prompt avoids fake documentary photographic news depiction',()=>{
 const prompt=illustrationPrompt({title:'Example event',category:'world'});
 assert.match(prompt,/NOT a factual photograph/);assert.match(prompt,/Example event/);
});
test('Power page is separate and calendar/all tasks have filtering',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../src/main.tsx'),'utf8');
 const allTasks=fs.readFileSync(path.join(__dirname,'../src/AllTasksPage.tsx'),'utf8');
 const plan=fs.readFileSync(path.join(__dirname,'../src/WorkspacePages.tsx'),'utf8');
 assert.match(main,/page==='power'/);assert.match(main,/page==='allTasks'&&<AllTasksPage/);
 assert.match(allTasks,/lh-all-filters/);assert.match(allTasks,/kind==='high'/);
 assert.match(plan,/hub-accordion-title/);assert.match(plan,/priority==='high'/);
});
