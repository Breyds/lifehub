'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cs2=require('../electron/cs2.cjs');
const {blankWorkspace,addItem,updateItem,defaultPreferences,safePreferences}=require('../electron/workspace.cjs');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('CS2 old DM logs retain legacy statistics after migration',()=>{
 const w=blankWorkspace();const row=addItem(w,'cs2logs',{title:'DM',date:'2026-11-20',duration:60,dmKills:500,botKills:0,matches:0,note:'Практика'});
 assert.equal(row.dmKills,500);assert.equal(row.duration,60);assert.equal(row.note,'Практика');
 const updated=updateItem(w,'cs2logs',row.id,{note:'Оновлено'});
 assert.equal(updated.dmKills,500);assert.equal(updated.note,'Оновлено');
});
test('CS2 screenshots and granular session fields survive persistence',()=>{
 const w=blankWorkspace(),imageId='13c53ef8-67ed-4a91-9957-9c15c8f44ee1';
 const s=addItem(w,'cs2logs',{title:'DM Mirage',mode:'dm',date:'2026-11-19',map:'Mirage',kills:430,deaths:75,headshots:344,hsPercent:80,accuracy:31.2,assists:12,duration:78,imageId});
 assert.equal(s.kills,430);assert.equal(s.headshots,344);assert.equal(s.dmKills,430);assert.equal(s.map,'Mirage');assert.equal(s.imageId,imageId);
 assert.equal(updateItem(w,'cs2logs',s.id,{duration:80}).hsPercent,80);
});
test('Impossible stats are rejected without silently fabricating numbers',()=>{
 assert.throws(()=>cs2.cleanResult({mode:'dm',date:'2026-11-19',kills:20,headshots:21}),/Хедшотів/);
 assert.throws(()=>cs2.cleanResult({mode:'dm',date:'2026-11-19',kills:100,headshots:5,hsPercent:95}),/відсоток HS/i);
 assert.equal(cs2.cleanResult({mode:'bots',date:'2026-11-19',kills:500}).botKills,500);
 assert.equal(cs2.cleanResult({mode:'match',date:'2026-11-19'}).kills,null);
 assert.equal(cs2.cleanResult({mode:'match',date:'2026-11-19'}).matches,1);
});
test('Week starts Monday and stats remain grounded in user logs',()=>{
 assert.equal(cs2.weeklyStart('2026-11-20'),'2026-11-16');
 const items=[{date:'2026-11-16',dmKills:500,botKills:400,matches:0,duration:80,kills:500,deaths:100},{date:'2026-11-18',dmKills:250,botKills:0,matches:1,duration:90,kills:30,deaths:20}];
 const result=cs2.summarize(items,'2026-11-16','2026-11-22');
 assert.equal(result.dmKills,750);assert.equal(result.botKills,400);assert.equal(result.matches,1);assert.equal(result.minutes,170);
});
test('Map breakdown differentiates manual and FACEIT sources',()=>{
 const rows=[{map:'Mirage',kills:50,deaths:20,hsPercent:70},{map:'Dust2',kills:40,deaths:20,hsPercent:null}];
 const data=cs2.mapBreakdown(rows,[{map:'Mirage',kills:15,deaths:10,win:true,hsPercent:55}]);
 const mirage=data.find(x=>x.map==='Mirage');assert.equal(mirage.sessions,1);assert.equal(mirage.faceitMatches,1);assert.equal(mirage.wins,1);
 assert.equal(mirage.kills,65);assert.equal(mirage.deaths,30);
});
test('FACEIT mapper reads real nested match player data and handles unavailable fields',()=>{
 const stats=cs2.parseMatchStats({rounds:[{round_stats:{Map:'de_mirage'},teams:[{players:[{player_id:'other',player_stats:{Kills:'99'}},{player_id:'own',player_stats:{Kills:'19',Deaths:'15',Assists:'6','Headshots %':'58',Result:'1'}}]}]}]},'own','match-123',1770000000);
 assert.equal(stats.length,1);assert.equal(stats[0].map,'Mirage');assert.equal(stats[0].kills,19);assert.equal(stats[0].win,true);
 assert.equal(stats[0].headshots,null);
});
test('FACEIT client makes only public official Data API calls with Bearer authorization',async()=>{
 let requests=[];
 const fetcher=async(url,options)=>{
  requests.push({url,authorization:options.headers.Authorization});
  let payload={};
  if(url.includes('/players?'))payload={player_id:'my-id',nickname:'testPlayer',games:{cs2:{faceit_elo:1250,skill_level:6}}};
  else if(url.includes('/history'))payload={items:[{match_id:'match1',started_at:1760000000}]};
  else if(url.includes('/stats/cs2'))payload={lifetime:{'Average K/D Ratio':'1.1'}};
  else if(url.includes('/matches/match1/stats'))payload={rounds:[{round_stats:{Map:'de_nuke'},teams:[{players:[{player_id:'my-id',player_stats:{Kills:'21',Deaths:'16',Result:'1'}}]}]}]};
  return {ok:true,status:200,json:async()=>payload};
 };
 const data=await cs2.getFaceit('testPlayer','TEST_PRIVATE_KEY',fetcher);
 assert.equal(data.player.elo,1250);assert.equal(data.matches[0].map,'Nuke');assert.equal(data.matches[0].kills,21);
 assert.equal(requests.length,4);assert(requests.every(r=>r.url.startsWith('https://open.faceit.com/data/v4/')));
 assert(requests.every(r=>r.authorization==='Bearer TEST_PRIVATE_KEY'));
 assert(!JSON.stringify(data).includes('TEST_PRIVATE_KEY'));
});
test('Utilities are validated and only safe HTTPS references are kept',()=>{
 const value=cs2.cleanUtility({map:'Mirage',type:'smoke',title:'Window smoke',url:'https://csnades.gg/mirage',reps:10,learned:true});
 assert.equal(value.reps,10);assert.equal(value.learned,true);
 assert.throws(()=>cs2.cleanUtility({title:' '}),/Назви/);
 assert.equal(cs2.cleanUtility({title:'Bad URL',url:'javascript:alert(1)'}).url,'');
});
test('CS2 preferences migrate old daily goals while adding weekly goals',()=>{
 const p=safePreferences({cs2Targets:{dmKills:500,botKills:900,matches:3,minutes:60}});
 assert.equal(p.cs2Targets.dmKills,500);assert.equal(p.cs2WeeklyTargets.dmKills,3500);
 assert.equal(defaultPreferences().cs2WeeklyTargets.minutes,840);
});
test('CS2 UI and secure IPC handlers are present and image analysis requires explicit user request',()=>{
 const ui=read('src/CS2Page.tsx'),main=read('electron/main.cjs'),preload=read('electron/preload.cjs');
 for(const key of ['FACEIT','Розпізнати AI','Підключити','Демки','Відеогіди','Карта','Цей тиждень'])assert.match(ui,new RegExp(key));
 assert.match(ui,/cs2AnalyzeImage\(form.imageId\)/);
 assert.match(ui,/cs2SaveFaceitKey/);
 assert.match(main,/safeStorage\.encryptString\(key\.trim\(\)\)/);
 assert.match(main,/ipcMain.handle\('cs2:demo-import'/);
 assert.match(preload,/cs2Coach:/);
 assert.match(main,/Демка збережена локально/);
});
