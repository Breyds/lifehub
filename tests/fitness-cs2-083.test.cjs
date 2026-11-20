'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {addItem,updateItem,blankWorkspace}=require('../electron/workspace.cjs');
const {starter,normalizeFeed,normalizePick}=require('../electron/cs2-pro-feed.cjs');
const read=(file)=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('Workout journal stores confirmed sets and local-only video reference',()=>{
 const workspace=blankWorkspace();
 const id='123e4567-e89b-42d3-a456-426614174000';
 const saved=addItem(workspace,'gym',{title:'Full body',date:'2026-11-21',duration:40,exerciseLogs:[
  {id:'squat',title:'Присідання',sets:[{reps:12,kg:0,seconds:null,done:true},{reps:10,kg:5,done:true}]}],
  mediaId:id,mediaTitle:'squat.mp4'
 });
 assert.equal(saved.exerciseLogs[0].sets.length,2);
 assert.equal(saved.exerciseLogs[0].sets[1].kg,5);
 assert.equal(saved.mediaId,id);
 assert.equal(saved.mediaTitle,'squat.mp4');
 const edited=updateItem(workspace,'gym',saved.id,{note:'Потренувався вдома'});
 assert.equal(edited.exerciseLogs[0].title,'Присідання');
 assert.equal(edited.mediaId,id);
});
test('Bad video identifiers are ignored and exercise logs are capped',()=>{
 const workspace=blankWorkspace();
 const saved=addItem(workspace,'gym',{title:'Test',date:'2026-11-21',mediaId:'../../sensitive',
  exerciseLogs:[{id:'a',title:'Exercise',sets:Array.from({length:55},()=>({reps:5,done:true,secret:'ignored'}))}]
 });
 assert.equal(saved.mediaId,'');
 assert.equal(saved.exerciseLogs[0].sets.length,15);
 assert.equal(saved.exerciseLogs[0].sets[0].secret,undefined);
});
test('Manual treadmill workouts keep real metrics and survive editing',()=>{
 const w=blankWorkspace();
 const saved=addItem(w,'cardio',{title:'My FitShow session',date:'2026-11-21',duration:31,distance:2.84,speed:5.5,incline:2,calories:194,heartRate:118,steps:3894,source:'fitshow-manual'});
 assert.equal(saved.calories,194);
 assert.equal(saved.heartRate,118);
 assert.equal(saved.steps,3894);
 assert.equal(updateItem(w,'cardio',saved.id,{note:'Помірна ходьба'}).source,'fitshow-manual');
});
test('Pro lineup picks are editorial source links, not bulk scraped media',()=>{
 const feed=starter();
 assert.ok(feed.items.length>=5);
 assert.equal(feed.source,'LifeHub editorial');
 assert.ok(feed.items.every(p=>new URL(p.url).hostname==='nades.ai'));
 assert.ok(feed.items.every(p=>p.practice&&p.teams&&p.evidence));
 assert.equal(normalizePick({id:'x',map:'Mirage',type:'smoke',title:'bad',url:'http://nades.ai/hack'}),null);
 assert.equal(normalizePick({id:'x',map:'Mirage',type:'smoke',title:'bad',url:'https://example.org/hack'}),null);
 assert.equal(normalizeFeed({items:[{id:'x',map:'Mirage',type:'smoke',title:'bad',url:'https://example.org'}]}).items.length,0);
});
test('LifeHub exposes manual workouts, local clip import and editorial picks in the UI',()=>{
 const ui=read('src/FitnessStudio.tsx'),workout=read('src/FitnessWorkoutTracker.tsx'),cs2=read('src/CS2Page.tsx'),main=read('electron/main.cjs'),preload=read('electron/preload.cjs');
 assert.match(ui,/Зберегти результат доріжки/);
 assert.match(ui,/FitnessWorkoutTracker/);
 assert.match(workout,/exerciseLogs/);
 assert.match(workout,/fitnessImportVideo/);
 assert.match(workout,/Зберегти тренування/);
 assert.match(cs2,/proData/);
 assert.match(cs2,/proData\?\.items/);
 assert.match(main,/ipcMain.handle\('fitness:video-import'/);
 assert.match(main,/ipcMain.handle\('cs2:pro-picks'/);
 assert.match(preload,/fitnessOpenVideo/);
 assert.match(preload,/cs2FetchProPicks/);
});
