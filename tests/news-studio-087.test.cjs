'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {FEEDS,balancedItems,fetchNews,isDeal}=require('../electron/news.cjs');
const {disposition,rankNews,score,filterIncoming,muteSource}=require('../electron/news-actions.cjs');
const {safePreferences}=require('../electron/workspace.cjs');
const now=Date.now(),at=new Date(now).toISOString();
const item=(id,category,title,source='Example')=>({id,category,title,source,url:'https://example.org/'+id,publishedAt:at});
test('all news topics have multiple discovery queries, including CIS, Ukraine and deals',()=>{
 assert.equal(Object.keys(FEEDS).length,12);
 for(const f of Object.values(FEEDS))assert.ok(f.queries.length>=2);
 assert.ok(FEEDS.internet.queries.some(x=>x.includes('TikTok')));
 assert.ok(FEEDS.cis&&FEEDS.ukraine&&FEEDS.deals);
});
test('balanced category quotas preserve a small internet category and reject unrelated deals',()=>{
 const rows=[...Array.from({length:300},(_,i)=>item('w'+i,'world','World headline '+i)),item('i','internet','YouTube update'),item('d','deals','Black Friday знижки'),item('x','deals','Weather report')];
 const out=balancedItems(rows,['world','internet','deals']);
 assert.equal(out.filter(x=>x.category==='world').length,45);assert.ok(out.some(x=>x.id==='i'));assert.ok(out.some(x=>x.id==='d'));assert.ok(!out.some(x=>x.id==='x'));
});
test('news source errors do not erase successful categories and diagnostics are recorded',async()=>{
 const xml='<rss><channel><item><title>YouTube creator update</title><link>https://example.org/news</link><pubDate>'+new Date(now).toUTCString()+'</pubDate></item></channel></rss>';
 const r=await fetchNews(['internet','world'],async url=>({ok:!url.includes('bbc.co.uk'),status:503,text:async()=>xml}));
 assert.ok(r.categoryStats.internet.ok>0);assert.ok(r.categoryStats.world.failed>0);assert.ok(r.items.some(x=>x.category==='internet'));
});
test('negative feedback lowers related topic and source scores, likes boost them, old feedback decays',()=>{
 const a=item('a','games','Nintendo Switch release','IGN');
 const db={news:{items:[a]},newsFeedback:{},newsDismissed:{},newsSaved:[]};
 disposition(db,'a','not');
 const other=item('b','games','Nintendo Switch trailer','IGN');
 const negative=score(other,db.newsFeedback,now);
 assert.ok(negative.affinity<0);assert.equal(db.newsFeedback.a.vote,'not');
 const positive=score(other,{a:{...db.newsFeedback.a,vote:'interesting'}},now);assert.ok(positive.affinity>0);
 assert.ok(Math.abs(score(other,db.newsFeedback,now+120*86400000).affinity)<Math.abs(negative.affinity));
});
test('muting is reversible and does not delete bookmarks',()=>{
 const db={news:{items:[]},newsSaved:[item('saved','anime','Saved','IGN')]};
 muteSource(db,'IGN',true);
 assert.equal(filterIncoming([item('1','games','New','ign')],db).length,0);
 assert.equal(db.newsSaved.length,1);
 muteSource(db,'ign',false);assert.equal(filterIncoming([item('1','games','New','IGN')],db).length,1);
});
test('automatic paid images are opt-in, and new topics persist',()=>{
 assert.equal(safePreferences({}).newsAutoImages,false);
 const p=safePreferences({newsAutoImages:true,newsCategories:['cis','ukraine','deals']});
 assert.equal(p.newsAutoImages,true);assert.deepEqual(p.newsCategories,['cis','ukraine','deals']);
});
