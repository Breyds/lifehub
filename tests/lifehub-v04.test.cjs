'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {cleanTask,progressFor,taskDone,updateProgress,validDate}=require('../electron/logic.cjs');
const {blankWorkspace,addItem,updateItem,toggleProjectStep,safePreferences}=require('../electron/workspace.cjs');
test('task with progress target stores quantity and caps increments',()=>{
  const task=cleanTask({title:'Вода',dueDate:'2026-11-18',recurrence:'daily',progressType:'counter',target:3000,unit:'мл',priority:'high'});
  assert.equal(progressFor(task,'2026-11-18'),0);
  updateProgress(task,'2026-11-18',500);
  assert.equal(progressFor(task,'2026-11-18'),500);
  assert.equal(taskDone(task,'2026-11-18'),false);
  updateProgress(task,'2026-11-18',7000);
  assert.equal(progressFor(task,'2026-11-18'),3000);
  assert.equal(taskDone(task,'2026-11-18'),true);
  assert.equal(progressFor(task,'2026-11-19'),0);
  updateProgress(task,'2026-11-18',-500);
  assert.equal(taskDone(task,'2026-11-18'),false);
});
test('all-day tasks default to no clock',()=>{
 const task=cleanTask({title:'Подія',dueDate:'2026-12-13',time:'12:00',allDay:true});
 assert.equal(task.time,'');assert.equal(task.allDay,true);
});
test('priority validation drops unsupported value',()=>{
 assert.equal(cleanTask({title:'Тест',dueDate:'2026-11-18',priority:'panic'}).priority,'normal');
 assert.throws(()=>cleanTask({title:'Тест',dueDate:'2026-11-18',target:-5,progressType:'counter'}));
});
test('project milestones toggle calculates progress',()=>{
 const w=blankWorkspace();const p=addItem(w,'projects',{title:'Release',steps:'Дизайн\nТести\nРеліз'});
 assert.equal(p.progress,0); toggleProjectStep(w,p.id,1);assert.equal(w.projects[0].progress,33);
 toggleProjectStep(w,p.id,0);assert.equal(w.projects[0].progress,67);
 updateItem(w,'projects',p.id,{steps:'Дизайн\nТести\nРеліз\nПеревірка'});
 assert.equal(w.projects[0].progress,50);
});
test('profile accepts nickname and preferences safely',()=>{
 const p=safePreferences({nickname:'  Тест   ',avatarData:'data:image/png;base64,'+'A'.repeat(100),fitness:{goal:'loss',currentWeight:83}});
 assert.equal(p.nickname,'Тест');assert.equal(p.fitness.goal,'loss');assert.equal(p.fitness.currentWeight,83);
});
