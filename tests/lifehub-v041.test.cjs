'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {cleanTask,occurs,scheduledOccurs}=require('../electron/logic.cjs');
const {parseRss,fetchNews}=require('../electron/news.cjs');
const {parseChart,fetchMusicCharts}=require('../electron/music.cjs');
test('one-day all-day event appears only on scheduled calendar date',()=>{
 const t=cleanTask({title:'До Артемки',dueDate:'2026-11-21',allDay:true,recurrence:'none'});
 assert.equal(scheduledOccurs(t,'2026-11-21'),true);
 for(const d of ['2026-11-20','2026-11-22','2026-11-30','2026-12-13'])assert.equal(scheduledOccurs(t,d),false);
 assert.equal(occurs(t,'2026-11-22'),true,'overdue task remains in today list until done');
});
test('weekly event matches only weekly scheduled dates',()=>{
 const t=cleanTask({title:'Щосуботи',dueDate:'2026-11-21',recurrence:'weekly'});
 assert.equal(scheduledOccurs(t,'2026-11-22'),false);
 assert.equal(scheduledOccurs(t,'2026-11-28'),true);
});
test('publisher RSS image is parsed from media:thumbnail',()=>{
 const xml='<rss><channel><item><title>Article</title><link>https://www.bbc.com/news/123</link><pubDate>Tue, 17 Nov 2026 10:00:00 GMT</pubDate><media:thumbnail url="https://ichef.bbci.co.uk/news/200.jpg"/></item></channel></rss>';
 const [a]=parseRss(xml,'world',20,'BBC News');
 assert.equal(a.imageUrl,'https://ichef.bbci.co.uk/news/200.jpg');assert.equal(a.source,'BBC News');
});
test('publisher RSS fallback feed is requested alongside news search',async()=>{
 let count=0;
 const result=await fetchNews(['world'],async(url)=>{count++;return {ok:true,text:async()=>'<rss></rss>'};});
 assert.ok(count>=4);assert.equal(result.totalSources,count);
});
test('apple chart preserves rank, country, releaseDate and source link',()=>{
 const feed={feed:{results:[{id:'456',name:'New Song',artistName:'Artist',releaseDate:'2026-11-13',url:'https://music.apple.com/us/album/456',artworkUrl100:'https://is1-ssl.mzstatic.com/image/abc.jpg'}]}};
 const [song]=parseChart(feed,'us');
 assert.equal(song.title,'New Song');assert.equal(song.rank,1);assert.equal(song.releaseDate,'2026-11-13');assert.equal(song.market,'us');
});
test('partial regional chart outage never generates fake songs',async()=>{
 const response=await fetchMusicCharts(async(url)=>{
  if(url.includes('/ru/'))return {ok:false,status:404};
  return {ok:true,text:async()=>JSON.stringify({feed:{results:[{id:'a1',name:'Song',artistName:'Artist',releaseDate:'2026-11-12',url:'https://music.apple.com/something'}]}})};
 });
 assert.ok(response.markets.us.length>0);assert.ok(response.markets.kz.length>0);
 assert.equal(response.markets.ru.length,0);assert.deepEqual(response.errors,['ru']);
});
test('news image CSP permits HTTPS while embedded scripts remain blocked',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 assert.match(html,/img-src 'self' data: https:/);
 assert.match(html,/object-src 'none'/);
});
