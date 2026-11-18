'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseChart,fetchFreshAlbumTracks,fetchMusicCharts}=require('../electron/music.cjs');
const {sanitizeCollectionVideo,dedupeVideos,canScanUrl,isCollectionUrl}=require('../electron/tiktok-collection.cjs');

test('top 100 chart is not mistakenly truncated to 25',()=>{
 const results=Array.from({length:95},(_,i)=>({id:String(i+1),name:'Song '+i,artistName:'Artist',url:'https://music.apple.com/us/songs/'+i,releaseDate:'2026-11-15'}));
 assert.equal(parseChart({feed:{results}},'us').length,95);
});
test('fresh album lookup yields labelled songs from verified release dates',async()=>{
 const fetcher=async url=>{
  if(url.includes('albums.json'))return {ok:true,text:async()=>JSON.stringify({feed:{results:[{id:'123456',name:'Album One',artistName:'Band',releaseDate:'2026-11-15',url:'https://music.apple.com/us/album/123456'}]}})};
  if(url.includes('lookup?id=123456'))return {ok:true,json:async()=>({results:[{wrapperType:'collection',collectionName:'Album One'},{wrapperType:'track',kind:'song',trackId:1,trackName:'First',artistName:'Band',trackViewUrl:'https://music.apple.com/us/song/1'}]})};
  throw Error('unexpected');
 };
 const data=await fetchFreshAlbumTracks('us',fetcher,new Date('2026-11-17T12:00:00Z'));
 assert.equal(data.length,1);assert.equal(data[0].source,'new-album');assert.equal(data[0].releaseDate,'2026-11-15');
});
test('new-release source never invents tracks if album lookup fails',async()=>{
 const x=await fetchFreshAlbumTracks('us',async url=>url.includes('albums.json')?{ok:true,text:async()=>JSON.stringify({feed:{results:[{id:'1',releaseDate:'2026-11-15'}]}})}:{ok:false,status:404},new Date('2026-11-17T12:00:00Z'));
 assert.deepEqual(x,[]);
});
test('TikTok link recognizer accepts full collection and short link',()=>{
 assert.equal(Boolean(isCollectionUrl('https://www.tiktok.com/@ennuii17/collection/%D0%9C%D1%83%D0%B7-7433474501058956038')),true);
 assert.equal(canScanUrl('https://vt.tiktok.com/ZShortLink/'),true);
 assert.equal(canScanUrl('https://bad.example.com/@someone/collection/123'),false);
});
test('TikTok sanitizes video URLs, de-duplicates, rejects untrusted URLs',()=>{
 const links=[{url:'https://www.tiktok.com/@a/video/7433474501058956038?tracking=1',title:'  A  song\n ',sound:'Unknown Sound'},{url:'https://www.tiktok.com/@a/video/7433474501058956038',title:'Duplicate'},{url:'https://evil.test/@a/video/7433474501058956038',title:'Bad'}];
 const out=dedupeVideos(links);assert.equal(out.length,1);assert.equal(out[0].sound,'Unknown Sound');assert.equal(out[0].url,'https://www.tiktok.com/@a/video/7433474501058956038');
 assert.equal(sanitizeCollectionVideo({url:'javascript:alert(1)'}),null);
});
