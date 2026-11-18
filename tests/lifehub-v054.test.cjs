'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {cleanTask,progressFor,updateProgress,taskDone}=require('../electron/logic.cjs');
const {parseMirror,normalizeGroup}=require('../electron/dtek-mirror.cjs');
const {extractOGImage,matchArticle,trustedArticle,enrichNewsImages}=require('../electron/news-images.cjs');
const {parseRss}=require('../electron/news.cjs');
const fs=require('node:fs');const path=require('node:path');

test('water adds 0.8 liters and records an actual over-goal amount',()=>{
 const task=cleanTask({title:'Вода',dueDate:'2026-11-19',recurrence:'daily',progressType:'counter',target:2.3,unit:'л'});
 updateProgress(task,'2026-11-19',0.8);assert.equal(progressFor(task,'2026-11-19'),0.8);
 updateProgress(task,'2026-11-19',1.5);assert.equal(progressFor(task,'2026-11-19'),2.3);assert.equal(taskDone(task,'2026-11-19'),true);
 updateProgress(task,'2026-11-19',0.8);assert.equal(progressFor(task,'2026-11-19'),3.1);assert.equal(taskDone(task,'2026-11-19'),true);
 updateProgress(task,'2026-11-19',-1);assert.equal(progressFor(task,'2026-11-19'),2.1);assert.equal(taskDone(task,'2026-11-19'),false);
 assert.equal(progressFor(task,'2026-11-20'),0);
});
test('counter rejects huge accidental increments but accepts tiny portions',()=>{
 const task=cleanTask({title:'Вода',dueDate:'2026-11-19',progressType:'counter',target:1.5,unit:'л'});
 updateProgress(task,'2026-11-19',0.125);assert.equal(progressFor(task,'2026-11-19'),0.125);
 assert.throws(()=>updateProgress(task,'2026-11-19',99999999));
});
test('mirror schedule parses only requested queue and dates',()=>{
 const now=new Date('2026-11-19T14:00:00Z');const stamp=Math.floor(Date.parse('2026-11-19T00:00:00+02:00')/1000);
 const src={regionId:'kyiv-region',lastUpdated:'2026-11-19T12:00:00Z',fact:{data:{[stamp]:{'GPV4.1':{'1':'yes','2':'no','3':'maybe'},'GPV4.2':{'1':'no'}}}}};
 const out=parseMirror(src,'4.1',now);assert.equal(out.status,'mirror');assert.equal(out.days.length,1);assert.equal(out.days[0].slots[0].status,'on');assert.equal(out.days[0].slots[1].status,'off');assert.equal(out.group,'GPV4.1');
});
test('stale mirror data is explicitly marked stale, not confirmed',()=>{
 const now=new Date('2026-11-19T14:00:00Z');const stamp=Math.floor(Date.parse('2026-11-19T00:00:00+02:00')/1000);
 const src={regionId:'kyiv-region',lastUpdated:'2026-11-18T01:00:00Z',fact:{data:{[stamp]:{'GPV2.1':{'1':'yes'}}}}};
 const out=parseMirror(src,'2.1',now);assert.equal(out.status,'stale');assert.equal(out.intervals.length,0);
});
test('mirror validates queue instead of guessing by address',()=>{
 assert.equal(normalizeGroup('4.1'),'GPV4.1');assert.equal(normalizeGroup('GPV5.2'),'GPV5.2');assert.equal(normalizeGroup('7.1'),'');
});
test('anime publisher accepted and related franchises are mapped',()=>{
 assert.equal(trustedArticle('https://www.animenewsnetwork.com/news/2026-11-18/article'),true);
 assert.equal(matchArticle('Sakamoto Days season 2'), 'Sakamoto_Days');
 assert.equal(matchArticle('Spice & Wolf second season'), 'Spice_and_Wolf');
});
test('RSS parser recognizes image inside escaped HTML description',()=>{
 const xml='<rss><channel><item><title>Sakamoto Days trailer</title><link>https://www.animenewsnetwork.com/news/2026/x</link><pubDate>Wed, 18 Nov 2026 10:00:00 GMT</pubDate><description>&lt;img src=&quot;https://cdn.animenewsnetwork.com/assets/hero.jpg&quot;&gt;</description></item></channel></rss>';
 const rows=parseRss(xml,'anime');assert.equal(rows.length,1);assert.equal(rows[0].imageUrl,'https://cdn.animenewsnetwork.com/assets/hero.jpg');
});
test('article has an original image when og meta is available',async()=>{
 const article={id:'a',title:'Anime news',url:'https://www.animenewsnetwork.com/news/2026/x',category:'anime',imageUrl:''};
 const fake=async(url)=>({ok:true,url,headers:{get:()=> 'text/html'},text:async()=>'<meta property="og:image" content="https://example-cdn.org/anime-poster.jpg"/>'});
 const enriched=await enrichNewsImages([article],fake);assert.equal(enriched[0].imageUrl,'https://example-cdn.org/anime-poster.jpg');
});
test('v0.5.4 UI has precise quantity input and power group fallback',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../src/main.tsx'),'utf8');const power=fs.readFileSync(path.join(__dirname,'../src/PowerPage.tsx'),'utf8');
 assert.match(main,/customDelta/);assert.match(main,/Додати довільний обсяг/);assert.match(power,/Резервний графік за чергою/);
});
