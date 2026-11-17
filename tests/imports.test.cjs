const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {extractCandidates}=require('../electron/chat-import.cjs');
const {scanInbox,copyToInbox}=require('../electron/video-inbox.cjs');
test('відбирає тільки повідомлення користувача з релевантними темами',()=>{
  const m=(role,text,create_time,id)=>({message:{author:{role},content:{parts:[text]},create_time,id}});
  const data=[{title:'Мій чат',mapping:{a:m('assistant','Тренування CS2',3,'a'),b:m('user','Планую кожен день тренування CS2',4,'b'),c:m('user','Привіт!',5,'c')}}];
  const r=extractCandidates(data);assert.equal(r.scannedConversations,1);assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].id,'b');
});
test('не приймає довільний формат замість експорту',()=>assert.throws(()=>extractCandidates({hello:1})));
test('відео: виявлення підтримуваних форматів і безпечне перейменування',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lh-test-'));const src=path.join(folder,'video.mp4');const inbox=path.join(folder,'inbox');
  try{fs.writeFileSync(src,'test');assert.equal(copyToInbox(src,inbox),'video.mp4');assert.equal(copyToInbox(src,inbox),'video-1.mp4');fs.writeFileSync(path.join(inbox,'note.txt'),'x');assert.equal(scanInbox(inbox).length,2);}finally{fs.rmSync(folder,{recursive:true,force:true});}
});
