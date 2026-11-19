'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {blankWorkspace,addItem,updateItem,toggleProjectStep}=require('../electron/workspace.cjs');
const {cleanTask,validPlanningDate}=require('../electron/logic.cjs');
test('legacy project steps and completed flags migrate without data loss',()=>{
 const w=blankWorkspace();
 const p=addItem(w,'projects',{title:'LifeHub',steps:'Зробити інтерфейс\nПеревірити збірку',completedSteps:[0],deadline:'2026-12-10'});
 assert.equal(p.stages.length,2);assert.equal(p.stages[0].progress,100);assert.equal(p.stages[1].progress,0);assert.equal(p.progress,50);
 const updated=updateItem(w,'projects',p.id,{description:'Оновлена мета'});
 assert.deepEqual(updated.completedSteps,[0]);assert.equal(updated.stages[1].title,'Перевірити збірку');
});
test('stage progress is averaged, user toggle still works',()=>{
 const w=blankWorkspace();const p=addItem(w,'projects',{title:'Дизайн',stages:[{id:'a',title:'Макет',progress:50},{id:'b',title:'Стилі',progress:100}]});
 assert.equal(p.progress,75);assert.deepEqual(p.completedSteps,[1]);
 const changed=toggleProjectStep(w,p.id,0);assert.equal(changed.progress,100);
 assert.deepEqual(changed.completedSteps,[0,1]);
});
test('project retains idea bank, references, blockers, journal and focus',()=>{
 const w=blankWorkspace();
 const p=addItem(w,'projects',{title:'Стартап',resources:[{title:'Документація',url:'https://example.org/docs',note:'Зразок'}],ideas:[{text:'Перша ідея'}],blockers:[{text:'Дочекатися макета',resolved:false}],journal:[{text:'Старт проєкту',at:'2026-11-19T12:00:00Z'}],nextAction:'Зробити дизайн',weeklyFocus:'Завершити головну сторінку'});
 assert.equal(p.resources.length,1);assert.equal(p.ideas.length,1);assert.equal(p.blockers.length,1);assert.equal(p.journal.length,1);
 assert.equal(p.weeklyFocus,'Завершити головну сторінку');
 const updated=updateItem(w,'projects',p.id,{nextAction:'Перевірити збірку'});assert.equal(updated.resources.length,1);
});
test('all new planning dates refuse impossible centuries rather than silently saving',()=>{
 const w=blankWorkspace();
 assert.throws(()=>addItem(w,'projects',{title:'А',deadline:'1321-11-19'}),/2000.*2100/);
 assert.throws(()=>addItem(w,'gym',{title:'Вправи',date:'1300-10-01'}),/2000.*2100/);
 assert.throws(()=>addItem(w,'streams',{title:'Ефір',date:'1900-01-01'}),/2000.*2100/);
 assert.throws(()=>cleanTask({title:'Завдання',dueDate:'1321-11-19',category:'personal'}),/2000.*2100/);
 assert.equal(validPlanningDate('2026-11-19'),true);
 assert.equal(validPlanningDate('1300-01-01'),false);
});
test('UI includes project drilldown and explicit AI review actions',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/ProjectStudio.tsx'),'utf8');
 assert.match(src,/projectReview\(active\.id/);
 assert.match(src,/Підтвердити/);
 assert.match(src,/Референси/);
 assert.match(src,/Блокери/);
 assert.match(src,/Журнал/);
 assert.match(src,/До.+2100|2100/);
});
