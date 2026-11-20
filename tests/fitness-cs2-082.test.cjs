'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {normalizeVideoResults,inferMap,inferType}=require('../electron/cs2-utility-radar.cjs');
const {defaultPreferences,safePreferences}=require('../electron/workspace.cjs');
test('CS2 radar extracts actual video links, maps and types',()=>{
 const date=new Date('2026-11-19T09:00:00Z').toISOString();
 const a={items:[
   {id:{videoId:'aBcDeFgHi12'},snippet:{title:'CS2 Mirage pro Window smoke lineup',description:'Smoke for Mirage',channelTitle:'Useful Nades',publishedAt:date}},
   {id:{videoId:'cDeFgHiJk34'},snippet:{title:'CS2 Inferno new flashbang lineup',description:'utility',channelTitle:'Coach',publishedAt:date}},
 ]};
 const res=normalizeVideoResults([a],Date.parse('2026-11-20T09:00:00Z'));
 assert.equal(res.length,2);
 assert.equal(res[0].url,'https://www.youtube.com/watch?v=aBcDeFgHi12');
 assert.equal(res[0].map,'Mirage');
 assert.equal(res[1].type,'flash');
 assert.equal(res[0].verified,false);
 assert.equal(res[0].source,'YouTube');
});
test('Radar does not fabricate unverified search snippets',()=>{
 const fake={items:[
   {id:{videoId:'aBcDeFgHi12'},snippet:{title:'CS2 new Mirage skins case opening',description:'skin giveaway',publishedAt:'2026-11-19T11:00:00Z'}},
   {id:{videoId:'bad'},snippet:{title:'CS2 Mirage grenade',publishedAt:'2026-11-19T11:00:00Z'}},
   {id:{videoId:'cDeFgHiJk34'},snippet:{title:'CS2 Nuke smoke 2024',publishedAt:'2024-11-19T11:00:00Z'}}
 ]};
 assert.deepEqual(normalizeVideoResults([fake],Date.parse('2026-11-20T09:00:00Z')),[]);
 assert.equal(inferMap('CS2 ancient flash'),'Ancient');
 assert.equal(inferType('molotov for Ancient'),'molotov');
});
test('Fitness onboarding preferences sanitize days and keep legacy data',()=>{
 const d=defaultPreferences();
 assert.equal(d.fitness.onboardedAt,'');
 assert.deepEqual(d.fitness.availableWeekdays,[1,3,5]);
 const saved=safePreferences({fitness:{...d.fitness,goal:'muscle',currentWeight:72,availableWeekdays:[1,3,3,8,-1,5],sessionMinutes:300,onboardedAt:'2026-11-20'}});
 assert.equal(saved.fitness.goal,'muscle');
 assert.equal(saved.fitness.currentWeight,72);
 assert.deepEqual(saved.fitness.availableWeekdays,[1,3,5]);
 assert.equal(saved.fitness.sessionMinutes,120);
 assert.equal(saved.fitness.onboardedAt,'2026-11-20');
});
test('Generic CSNades carousel does not masquerade as fresh pro utility',()=>{
 const c=fs.readFileSync(path.join(__dirname,'../src/CS2Page.tsx'),'utf8');
 assert.doesNotMatch(c,/const curated:|csnades\.gg/i);
 assert.match(c,/Utility Radar/);
});
