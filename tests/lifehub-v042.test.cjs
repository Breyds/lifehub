'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {classifyTikTokUrl,checkTikTokUrl}=require('../electron/tiktok.cjs');
const {FEEDS}=require('../electron/news.cjs');

test('TikTok: rejects non-HTTPS and other hosts (no SSRF)',()=>{
 for(const s of ['http://tiktok.com/@me/video/1234','https://tiktok.com.evil.com/@x/video/1234','file:///etc/passwd','https://127.0.0.1/'])assert.equal(classifyTikTokUrl(s).kind,'invalid');
});
test('TikTok collection link: reports unsupported access without network request',async()=>{
 let calls=0;const r=await checkTikTokUrl('https://www.tiktok.com/@someone/collection/Songs-123456',()=>{calls++;throw Error('must not call')});
 assert.equal(r.status,'collection');assert.equal(calls,0);assert.match(r.message,/не повертає список/);
});
test('TikTok short link: no redirects requested',async()=>{
 let calls=0;const r=await checkTikTokUrl('https://vm.tiktok.com/ZZZZ/',()=>{calls++;throw Error('must not call')});
 assert.equal(r.status,'short');assert.equal(calls,0);
});
test('TikTok single video: reads only trusted oEmbed fields, not HTML',async()=>{
 let url='';const result=await checkTikTokUrl('https://www.tiktok.com/@demo/video/7457683300000',async request=>{
  url=request;return {ok:true,text:async()=>JSON.stringify({provider_name:'TikTok',title:'Demo sound',author_name:'Creator',html:'<script>alert(1)</script>'})};
 });
 assert.match(url,/^https:\/\/www\.tiktok\.com\/oembed\?/);assert.equal(result.status,'video');assert.equal(result.title,'Demo sound');assert.equal(result.author,'Creator');assert.equal(result.html,undefined);
});
test('TikTok unavailable video gives useful status',async()=>{
 const r=await checkTikTokUrl('https://www.tiktok.com/@demo/video/7457683300000',async()=>({ok:false,status:403}));
 assert.equal(r.status,'unavailable');assert.match(r.message,/403/);
});
test('Music news categories removed from the news feeds',()=>{
 assert.equal(FEEDS.music_us,undefined);assert.equal(FEEDS.music_ru,undefined);
});
test('News feed UI suppresses rejected article, supports undo and page size',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/WorkspacePages.tsx'),'utf8');
 assert.match(src,/setLocalHidden\(old=>new Set\(old\)\.add\(id\)\)/);
 assert.match(src,/reactions\[x\.id\]\?\.vote!=='not'/);
 assert.match(src,/window\.lifehub\.unrateNews\(id\)/);
 assert.match(src,/sorted\.slice\(0,visibleCount\)/);
});
test('Thin branded scrollbars are styled for Chromium',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/studio.css'),'utf8');assert.match(src, /::-webkit-scrollbar-thumb/);assert.match(src,/scrollbar-width:thin/);
});
