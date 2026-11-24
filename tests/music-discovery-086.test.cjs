'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {charts,buildProfile,rankCandidates,selectWeekly,matchChartTracks,generate}=require('../electron/music-discovery.cjs');
const w={from:'2026-11-14',to:'2026-11-20'};
const song=(artist,title,rank,region='us',genres=['hip hop'])=>({id:artist+title,artist,title,rank,chartRank:rank,region,genres,releaseDate:'2026-11-20'});
test('raw chart list keeps old songs and is independent of the taste profile',()=>{
 const old={...song('A','old',1),releaseDate:'2023-05-10'};
 assert.equal(charts({us:[old]},'us')[0].title,'old');
 assert.equal(charts({ua:[song('A','X',5)],kz:[song('A','X',2)]},'regional')[0].rank,2);
});
test('fresh unknown artists, genre matches, US representation and dislikes',()=>{
 const taste=[{artist:'Known',title:'Saved'}],topArtists=[{name:'Known',genres:['hip hop']}];
 const catalog=Array.from({length:15},(_,i)=>song('Artist'+i,'new',i+1,'spotify'));
 const chartTracks=[...Array.from({length:6},(_,i)=>song('US'+i,'hit',i+1)),...Array.from({length:6},(_,i)=>song('Regional'+i,'hit',i+1,'regional'))];
 catalog.push({...song('Known','Old',1),releaseDate:'2025-01-01'},song('Known','Saved',2),song('No','bad',1));
 const feedback={'no|bad':{vote:'dislike',artist:'No',genres:[]}};
 const r=selectWeekly({taste,topArtists,catalog,chartTracks,window:w,feedback});
 assert.equal(r.items.length,10);assert.equal(r.regions.us.length,5);assert.equal(r.regions.regional.length,5);
 assert.ok(r.items.filter(t=>t.region==='us').length>=3);assert.ok(r.items.every(t=>!['Old','Saved','bad'].includes(t.title)));
 assert.ok(r.items.some(t=>t.reason.includes('Схожий жанр')));
});
test('no filler with old tracks, artist diversity, and Radar copy is the only Friday source when selected',()=>{
 const catalog=Array.from({length:12},(_,i)=>song('A','x'+i,i+1,'spotify'));
 const chartTracks=[song('B','hit',1),song('C','hit',2)];
 const r=selectWeekly({taste:[],catalog,chartTracks,window:w,radar:true});
 assert.equal(r.items.length,2);assert.ok(r.items.every(t=>t.artist==='A'));assert.equal(r.regions.us.length,2);
});
test('chart matches must have the exact title, artist and Spotify release date',async()=>{
 const t=song('A','New',1);
 const exact={id:'a'.repeat(22),name:'New',artists:[{name:'A'}],album:{release_date:'2026-11-20',images:[{url:'https://i.scdn.co/image/cover'}]}};
 const rows=await matchChartTracks('token',{us:[t]},w,[],{},async()=>({ok:true,json:async()=>({tracks:{items:[{...exact,name:'wrong'},exact]}})}));
 assert.equal(rows.length,1);assert.equal(rows[0].id,exact.id);assert.equal(rows[0].chartRank,1);
});
test('feedback is part of ranking, unknown genres get an honest discovery label',()=>{
 const rows=[song('A','new',3,'us',['pop']),song('B','new',2,'us',['rock']),song('C','new',1,'us',['rock'])];
 const p=buildProfile([],[],{}, {'old|song':{vote:'like',artist:'Old',genres:['pop']},'c|new':{vote:'dislike',artist:'C',genres:[]}});
 const sorted=rankCandidates(rows,p,w);
 assert.equal(sorted[0].artist,'A');assert.ok(sorted[0].reason.includes('Схожий жанр'));assert.ok(sorted[1].reason.includes('відкриття'));assert.equal(sorted.length,2);
});
