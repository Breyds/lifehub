'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {cleanTask,updateProgress,taskDone}=require('../electron/logic.cjs');
const {blankWorkspace,addItem}=require('../electron/workspace.cjs');
const {candidates,publicCandidates,applyCandidates}=require('../electron/personal-import.cjs');
const imported={format:'lifehub-personal-review-import',proposedData:{workspace:{projects:[{title:'LifeHub',steps:'Перший етап',_review:{decision:'ready'}}]},taskDrafts:[{title:'Оновити плейлист',category:'personal',recurrenceProposal:'weekly',timeProposal:'00:00'}]}};

test('personal import provides workspace preview, filters existing items and does not auto-schedule',()=>{
 const list=candidates(imported),db={workspace:blankWorkspace(),tasks:[]};
 assert.ok(list.some(x=>x.kind==='projects'));
 assert.ok(list.some(x=>x.recordType==='draft'));
 const preview=publicCandidates(list,db);assert.ok(preview.some(x=>x.status==='review'));
 const some=preview.find(x=>x.kind==='projects');
 const result=applyCandidates(db,list,[{id:some.id}],addItem);
 assert.equal(result.workspace,1);assert.equal(db.workspace.projects.length,1);assert.equal(db.tasks.length,0);
 assert.equal(publicCandidates(list,db).find(x=>x.id===some.id).exists,true);
 const dupe=applyCandidates(db,list,[{id:some.id}],addItem);assert.equal(dupe.added,0);
});
test('personal import requires explicit start dates for any recurring proposal',()=>{
 const list=candidates(imported),db={workspace:blankWorkspace(),tasks:[]};const x=list.find(y=>y.recordType==='draft');assert.ok(x);
 assert.throws(()=>applyCandidates(db,list,[{id:x.id}],addItem),/дату/);
 const res=applyCandidates(db,list,[{id:x.id,date:'2026-12-04'}],addItem);assert.equal(res.tasks,1);
 assert.equal(db.tasks[0].dueDate,'2026-12-04');
});
test('time progress supports manual minute updates',()=>{
 const t=cleanTask({title:'Вивчити англійську',dueDate:'2026-11-19',category:'study',time:'17:00',recurrence:'daily',progressType:'minutes',target:60,unit:'хв'});
 assert.equal(t.progressType,'minutes');assert.equal(updateProgress(t,'2026-11-19',15),15);assert.equal(taskDone(t,'2026-11-19'),false);updateProgress(t,'2026-11-19',45);assert.equal(taskDone(t,'2026-11-19'),true);
});
test('critical priority is distinct from very important',()=>{
 const base={title:'Біг',dueDate:'2026-11-19',category:'sport',time:'',recurrence:'none'};
 assert.equal(cleanTask({...base,priority:'urgent'}).priority,'urgent');
 assert.equal(cleanTask({...base,priority:'critical'}).priority,'critical');
});
test('dashboard has a single global AI CTA and visual agenda editor controls',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/main.tsx'),'utf8');
 assert.match(src,/LifeTimeWheel/);assert.match(src,/LifeDatePicker/);assert.match(src,/lh-main-agenda/);
 assert.match(src,/PersonalImportPanel/);assert.doesNotMatch(src,/Плануй разом з AI/);
 assert.match(src,/Сьогодні/);assert.match(src,/До сьогодні/);
});
