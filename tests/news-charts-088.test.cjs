'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {safePreferences}=require('../electron/workspace.cjs');
const {balancedItems}=require('../electron/news.cjs');
const {selectImageCandidates,matchArticle}=require('../electron/news-images.cjs');
test('pinned topics are persisted, validated and can all be removed',()=>{
 assert.deepEqual(safePreferences({}).newsPinnedTopics,['ukraine','deals']);
 assert.deepEqual(safePreferences({newsPinnedTopics:['anime','cis','anime','invalid']}).newsPinnedTopics,['anime','cis']);
 assert.deepEqual(safePreferences({newsPinnedTopics:[]}).newsPinnedTopics,[]);
});
test('image candidate budget is shared between categories',()=>{
 const items=Array.from({length:40},(_,i)=>({id:'anime'+i,category:'anime',url:'https://cbr.com/a'+i})).concat([{id:'ua',category:'ukraine',url:'https://www.pravda.com.ua/news/1'},{id:'games',category:'games',url:'https://ign.com/games'}]);
 const selected=selectImageCandidates(items,6);
 assert.equal(selected.length,6);assert.ok(selected.some(t=>t.id==='ua'));assert.ok(selected.some(t=>t.id==='games'));
 assert.equal(matchArticle('The Apothecary Diaries season 3'),'The_Apothecary_Diaries');
});
test('illustrated duplicate is retained rather than image-less headline',()=>{
 const base={category:'anime',source:'Example',publishedAt:'2026-11-24T00:00:00Z'};
 const rows=balancedItems([{...base,id:'a',title:'A new anime - Example'},{...base,id:'b',title:'A new anime',imageUrl:'https://example.com/image.jpg'}],['anime']);
 assert.equal(rows.length,1);assert.equal(rows[0].id,'b');
});
test('individual market selector and pinned topics UI are wired',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/WorkspacePages.tsx'),'utf8');
 assert.match(src,/market==='all'\?\[\{title:'США'/);
 assert.match(src,/\[\{title:names\[market\]\|\|market,markets:\[market\]\}\]/);
 assert.match(src,/<option value="us">США/);
 assert.match(src,/newsPinnedTopics:draftPins/);
 assert.match(src,/ns-missing-compact/);
});
