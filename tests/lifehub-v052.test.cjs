'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {slotsToIntervals,extractFactResponse,validateIntervals,mapDtekResponse}=require('../electron/dtek-live.cjs');
const {extractOGImage,matchArticle, trustedArticle, fetchOriginalImage}=require('../electron/news-images.cjs');
const {parseTrends}=require('../electron/youtube-trends.cjs');

test('Only confirmed DTEK off slots are counted, possible outages are not',()=>{
 const rows=slotsToIntervals({'1':'yes','2':'mfirst','3':'first','4':'second','5':'no','6':'msecond'},'2026-11-18');
 assert.deepEqual(rows,[{date:'2026-11-18',start:'02:00',end:'02:30'},{date:'2026-11-18',start:'03:30',end:'05:00'}]);
});
test('DTEK refuses missing or ambiguous house group',()=>{
 const raw={result:true,data:{'10':{sub_type_reason:['GPV2.1','GPV2.2']}},fact:{data:{}}};
 assert.equal(extractFactResponse(raw,'11').intervals.length,0);
 assert.match(extractFactResponse(raw,'10').message,/кілька груп/);
});
test('DTEK confirmed slot maps are grouped by actual date and exact house',()=>{
 const raw={result:true,data:{'10А':{sub_type_reason:['GPV3.1']}},fact:{data:{'1794952800':{'GPV3.1':{'1':'no','2':'no','3':'yes'}}}}};
 const out=extractFactResponse(raw,'10а');
 assert.equal(out.intervals.length,1);
 assert.equal(out.intervals[0].end,'02:00');
 assert.match(out.message,/3.1/);
});
test('DTEK never treats an empty timetable as confirmed no outages',()=>{
 const x=mapDtekResponse({intervals:[],message:'No published schedule'});assert.equal(x.status,'unavailable');assert.equal(x.intervals.length,0);
});
test('DTEK end-of-day 24:00 is preserved',()=>{
 const a=validateIntervals([{date:'2026-11-18',start:'23:00',end:'24:00'}]);assert.equal(a.length,1);
});
test('News title image maps to named actual topic, not generic anime',()=>{
 assert.equal(matchArticle('Crimean bridge strike reported'),'Crimean_Bridge');
 assert.equal(matchArticle('Jujutsu Kaisen new season'),'Jujutsu_Kaisen');
 assert.equal(matchArticle('Adobe new AI tools'),'Adobe_Inc.');
 assert.equal(matchArticle('10 bad anime series'), '');
});
test('Original article og:image takes priority and is parsed safely',()=>{
 const html=`<meta property="og:image" content="https://cdn.example.org/pictures/bridge.jpg?test=1&amp;x=2">`;
 assert.equal(extractOGImage(html,'https://www.bbc.com/news/1'),'https://cdn.example.org/pictures/bridge.jpg?test=1&x=2');
 assert.equal(trustedArticle('https://www.bbc.com/news/1'),true);
 assert.equal(trustedArticle('http://127.0.0.1/admin'),false);
});
test('Network errors in original photo lookup fail closed',async()=>{
 const x=await fetchOriginalImage('https://www.bbc.com/news/foo',async()=>{throw Error('offline')});assert.equal(x,null);
});
test('Real YouTube video stats include channel url from channel ID',()=>{
 const channelId='UC'+'a'.repeat(22),vid='h8xQiHj2x8I';
 const found=parseTrends([{id:{videoId:vid},_topic:'anime',_query:'anime edits'}],{items:[{id:vid,statistics:{viewCount:'3000'},snippet:{title:'Example',publishedAt:'2026-11-18T00:00:00Z',channelId,channelTitle:'Creator'}}]},Date.parse('2026-11-19T00:00:00Z'));
 assert.equal(found[0].url,'https://www.youtube.com/watch?v='+vid);
 assert.equal(found[0].channelUrl,'https://www.youtube.com/channel/'+channelId);
 assert.equal(found[0].views,3000);
});
