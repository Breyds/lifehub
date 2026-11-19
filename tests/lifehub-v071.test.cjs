'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {assertScheduledDate,validScheduledDate}=require('../electron/logic.cjs');
const {blankWorkspace,addItem,updateItem}=require('../electron/workspace.cjs');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('past scheduling is blocked, including the example a year ago',()=>{
 assert.equal(validScheduledDate('2025-11-19','2026-11-19'),false);
 assert.equal(validScheduledDate('2026-11-19','2026-11-19'),true);
 assert.equal(validScheduledDate('2026-11-20','2026-11-19'),true);
 assert.throws(()=>assertScheduledDate('2025-11-19',''),/сьогодні або майбутню/);
 assert.doesNotThrow(()=>assertScheduledDate('2025-11-19','2025-11-19'));
});
test('project creation cannot set a deadline in the past',()=>{
 const w=blankWorkspace();
 assert.throws(()=>addItem(w,'projects',{title:'Старий проєкт',deadline:'2023-01-02'}),/сьогодні або майбутню/);
 const p=addItem(w,'projects',{title:'Новий',deadline:'2050-11-19'});
 assert.equal(p.deadline,'2050-11-19');
 assert.doesNotThrow(()=>updateItem(w,'projects',p.id,{description:'Оновлений опис'}));
});
test('historic records and finished stream sessions remain writable',()=>{
 const w=blankWorkspace();
 assert.equal(addItem(w,'weight',{title:'Замір',date:'2023-01-05'}).date,'2023-01-05');
 assert.equal(addItem(w,'streams',{title:'Архів стріму',date:'2023-01-05',status:'done'}).date,'2023-01-05');
 assert.throws(()=>addItem(w,'streams',{title:'Запланований ефір',date:'2023-01-05',status:'planned'}),/сьогодні або майбутню/);
 assert.throws(()=>addItem(w,'ideas',{title:'Запланований ролик',date:'2023-01-05',status:'ready'}),/сьогодні або майбутню/);
});
test('Electron prevents older dates even for API calls or AI apply',()=>{
 const main=read('electron/main.cjs');
 assert.match(main,/tasks:add'.+assertScheduledDate\(payload\?\.dueDate\)/);
 assert.match(main,/tasks:edit'[\s\S]*?assertScheduledDate\(patch\?\.dueDate\?\?original\.dueDate,original\.dueDate\)/);
 assert.match(main,/validScheduledDate\(p\?\.date\)\?validateProposal/);
});
test('user interface prevents historic date selection and exposes a rich task center',()=>{
 const calendar=read('src/TaskEditorControls.tsx');
 const main=read('src/main.tsx');
 const center=read('src/AllTasksPage.tsx');
 const studio=read('src/ProjectStudio.tsx');
 assert.match(calendar,/minDate\?:string/);
 assert.match(calendar,/disabled=\{!allowed\(v\)\|\|v<floor\}/);
 assert.match(main,/LifeDatePicker value=\{form\.dueDate\} minDate=\{today\(\)\}/);
 assert.match(studio,/minDate=\{localToday\(\)\}/);
 for(const word of ['Пошук','Повторювані','Критичні','Виконані','Перенести на сьогодні','Скинути фільтри'])assert.match(center,new RegExp(word));
 assert.match(center,/onToggle\(t,keyDate\)/);
 assert.match(center,/onMove\(t,now\)/);
});
