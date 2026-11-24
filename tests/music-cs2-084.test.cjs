'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {selectFreshHits}=require('../electron/music.cjs');
const {recommend,excludeSaved}=require('../electron/spotify-personal.cjs');
const {starter}=require('../electron/cs2-pro-feed.cjs');
test('fresh hits use individual tracks, dates and chart ranks',()=>{
 const t=(title,releaseDate,rank,source)=>({title,artist:'Artist',releaseDate,rank,source});
 const result=selectFreshHits({us:[t('Album track','2026-11-23',1,'new-album'),t('Old','2026-10-23',1),t('Second','2026-11-23',8),t('First','2026-11-24',2),t('First','2026-11-24',4)]},new Date('2026-11-24T12:00:00Z'));
 assert.deepEqual(result.us.map(t=>t.title),['First','Second']);
});
test('Friday recommendations exclude familiar songs and limit one artist to three',()=>{
 const taste=['A','B','C','D'].map(artist=>({artist,title:'Saved'}));
 const tracks=taste.flatMap(({artist})=>['Saved','One','Two','Three','Four'].map((title,i)=>({artist,title,rank:i+1})));
 const out=recommend(taste,{spotify:tracks},[{artist:'A',title:'One'}]);
 assert.equal(out.length,10);assert.ok(out.every(t=>t.title!=='Saved'));assert.ok(!out.some(t=>t.artist==='A'&&t.title==='One'));
 for(const {artist} of taste)assert.ok(out.filter(t=>t.artist===artist).length<=3);
});
test('library membership checked in batches using Spotify track URIs',async()=>{
 const tracks=Array.from({length:42},(_,i)=>({id:String(i).padStart(22,'0')}));
 let calls=0;
 const out=await excludeSaved('token',tracks,async url=>{
  const uris=new URL(url).searchParams.get('uris').split(',');calls++;assert.ok(uris.length<=40);
  return {ok:true,json:async()=>uris.map(x=>x.endsWith('0'))};
 });
 assert.equal(calls,2);assert.equal(out.length,37);
});
test('bundled lineup feed contains five verified entries per supported map',()=>{
 const items=starter().items;
 for(const map of ['Mirage','Dust2','Inferno','Nuke','Ancient','Anubis','Cache'])assert.ok(items.filter(t=>t.map===map).length>=5,map);
 assert.ok(items.length>=35);
});
