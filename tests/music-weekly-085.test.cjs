'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {weekWindow,isFresh,regionalPicks,extractTracks,recommend,readFreshArtists,playlistId}=require('../electron/spotify-personal.cjs');
const window=weekWindow('2026-11-20',new Date('2026-11-24T12:00:00Z'));
test('Friday release window is exactly seven dates, excludes old and future albums',()=>{
 assert.deepEqual(window,{from:'2026-11-14',to:'2026-11-20'});
 assert.equal(isFresh({releaseDate:'2026-11-14'},window),true);
 for(const d of ['2026-11-13','2026-11-21','2026-11','2026'])assert.equal(isFresh({releaseDate:d},window),false);
 assert.equal(isFresh({releaseDate:'2026-11-20',album:'Old album (Remastered)'},window),false);
});
test('Spotify artwork stays attached to album tracks',()=>{
 const t=extractTracks([{id:'track',name:'New',artists:[{name:'A'}],album:{release_date:'2026-11-20',images:[{url:'https://i.scdn.co/image/cover'}]}}])[0];
 assert.equal(t.artworkUrl,'https://i.scdn.co/image/cover');assert.equal(t.releaseDate,'2026-11-20');
});
test('regional chart picks are capped, deduplicated, fresh, and relevant',()=>{
 const taste=['A','B','C','D','E','F'].map(artist=>({artist,title:'saved'}));
 const track=(artist,title,rank,releaseDate='2026-11-20')=>({artist,title,rank,releaseDate});
 const markets={us:[track('A','old',1,'2025-11-20'),track('A','saved',2),track('Unknown','x',3),...taste.map((t,i)=>track(t.artist,'new',i+4))],ua:[...taste.map((t,i)=>track(t.artist,'another',i+1))]};
 const r=regionalPicks(taste,markets,[],window);
 assert.equal(r.us.length,5);assert.equal(r.regional.length,5);
 assert.ok(r.us.every(t=>t.title==='new'));
});
test('owned copy can include unfamiliar artists and normal discovery cannot',()=>{
 const t={title:'New',artist:'Unknown',rank:1};
 assert.equal(recommend([],{spotify:[t]}).length,0);
 assert.equal(recommend([],{spotify:[t]},[],true).length,1);
 assert.equal(playlistId('https://example.org/playlist/1234567890123456789012'),'');
 assert.equal(playlistId('https://open.spotify.com/playlist/1234567890123456789012?si=abc'),'1234567890123456789012');
});
test('fresh artist search uses album date and propagates album artwork',async()=>{
 const a={id:'album',name:'Fresh',release_date:'2026-11-20',artists:[{name:'A'}],images:[{url:'https://i.scdn.co/image/cover'}]};
 const rows=await readFreshArtists('test',[{artist:'A'}],window,async u=>{
  const url=new URL(u);
  if(url.pathname.endsWith('/search')){assert.match(url.searchParams.get('q'),/tag:new/);return {ok:true,json:async()=>({albums:{items:[a,{...a,id:'old',release_date:'2026-10-20'}]}})};}
  assert.match(url.pathname,/albums\/album\/tracks/);
  return {ok:true,json:async()=>({items:[{id:'track',name:'Fresh',artists:[{name:'A'}]}]})};
 });
 assert.equal(rows.length,1);assert.equal(rows[0].artworkUrl,'https://i.scdn.co/image/cover');
});
