'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pairingCode,findPairedChat,parseCommand,lastUpdateOffset,formatAgenda}=require('../electron/telegram.cjs');
const {cleanPowerAddress}=require('../electron/power-address.cjs');
const {recognizeAudio}=require('../electron/audd.cjs');
const {scheduledOccurs,taskDone,cleanTask,occurs}=require('../electron/logic.cjs');

test('Telegram pairing needs an exact six-digit code from a private chat',()=>{
 const updates=[{update_id:3,message:{chat:{id:44,type:'group'},text:'/link 123456'}},{update_id:4,message:{chat:{id:55,type:'private'},text:'/link 1234567'}},{update_id:5,message:{chat:{id:66,type:'private'},text:'/link 123456'}}];
 assert.equal(findPairedChat(updates,'123456'),'66');
 assert.equal(findPairedChat(updates,'123457'),'');
 const code=pairingCode(); assert.match(code,/^\d{6}$/);
 assert.equal(lastUpdateOffset(updates,0),6);
});
test('Telegram bot commands allow only a narrow set',()=>{
 assert.deepEqual(parseCommand('/add 19:30 Підготувати відео'),{action:'add',time:'19:30',title:'Підготувати відео'});
 assert.deepEqual(parseCommand('/done 2'),{action:'done',index:2});
 assert.equal(parseCommand('/remind 27:00 bad').action,'unknown');
 assert.equal(parseCommand('/today').action,'today');
 assert.equal(parseCommand('/tomorrow').action,'tomorrow');
 assert.equal(parseCommand('/help').action,'help');
});
test('Telegram agenda includes status and number',()=>{
 const task=cleanTask({title:'Відео',dueDate:'2026-11-20',time:'19:00',category:'rankdaily',recurrence:'none',note:''});
 const text=formatAgenda([task],'2026-11-20',{occurs,taskDone});
 assert.match(text,/1\. ▫️ 19:00 · Відео/);
});
test('DTEK local address validates complete fields',()=>{
 assert.deepEqual(cleanPowerAddress({settlement:' Фастів ',street:' Шевченка ',house:'7А'}),{settlement:'Фастів',street:'Шевченка',house:'7А'});
 assert.throws(()=>cleanPowerAddress({settlement:'Фастів',street:'',house:'7А'}),/Заповни/);
 assert.deepEqual(cleanPowerAddress({}),{settlement:'',street:'',house:''});
});
test('AudD accepts Windows WebM system audio with correct file type',async()=>{
 const audio=Buffer.alloc(2000,1);let type='';
 await recognizeAudio('separate-audd-token',audio,'tiktok-capture.webm',async(_u,o)=>{
  type=o.body.get('file').type;
  return {ok:true,json:async()=>({status:'success',result:{artist:'Artist',title:'Song'}})};
 });
 assert.equal(type,'audio/webm');
});
test('Calendar tracks scheduled dates without carrying overdue tasks',()=>{
 const task=cleanTask({title:'Одноденна подія',dueDate:'2026-11-20',time:'',category:'personal',recurrence:'none',note:''});
 assert.equal(scheduledOccurs(task,'2026-11-20'),true);
 assert.equal(scheduledOccurs(task,'2026-11-21'),false);
});
