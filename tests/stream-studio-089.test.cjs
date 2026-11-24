'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cleanStudio,checklist,inspectZip,obsSnapshot}=require('../electron/stream-studio.cjs');
const {chooseCover,canGenerate}=require('../electron/news-cover-queue.cjs');
const {blankWorkspace,addItem,updateItem}=require('../electron/workspace.cjs');
function zip(name,xml){
 const n=Buffer.from(name),data=Buffer.from(xml),l=Buffer.alloc(30),c=Buffer.alloc(46),e=Buffer.alloc(22);
 l.writeUInt32LE(0x04034b50);l.writeUInt32LE(data.length,18);l.writeUInt32LE(data.length,22);l.writeUInt16LE(n.length,26);
 c.writeUInt32LE(0x02014b50);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);
 e.writeUInt32LE(0x06054b50);e.writeUInt16LE(1,8);e.writeUInt16LE(1,10);e.writeUInt32LE(c.length+n.length,12);e.writeUInt32LE(l.length+n.length+data.length,16);
 return Buffer.concat([l,n,data,c,n,e]);
}
test('stream metadata and readiness persist while old records remain editable',()=>{
 const w=blankWorkspace(),date='2099-12-01';
 const item=addItem(w,'streams',{title:'Своя гра',date,time:'19:00',studio:{format:'quiz',check:{content:true,unknown:true},plan:'Порядок раундів'}});
 assert.equal(item.studio.format,'quiz');assert.equal(item.studio.check.content,true);assert.equal(item.studio.check.unknown,undefined);
 assert.equal(Object.keys(item.studio.check).length,checklist.length);
 const edited=updateItem(w,'streams',item.id,{note:'Нове'});assert.equal(edited.studio.plan,'Порядок раундів');
 assert.equal(cleanStudio().platform,'Twitch');
});
test('bounded SIQ inspection finds question samples, duplicate scenarios and unsafe paths',()=>{
 const xml='<package><question><scenario><atom>Test question</atom></scenario></question><question><scenario><atom>Test question</atom></scenario></question></package>';
 const result=inspectZip(zip('content.xml',xml));assert.equal(result.entries,1);assert.equal(result.questions,2);assert.equal(result.sample[0],'Test question');assert.ok(result.warnings.some(x=>x.includes('Повторюваних')));
 assert.ok(inspectZip(zip('../evil.txt','test')).warnings.some(x=>x.includes('Небезпечних')));
 assert.throws(()=>inspectZip(Buffer.from('not a zip')));
});
test('news image queue honors priority, cache, retries and paid request cap',()=>{
 const rows=[{id:'a',category:'anime'},{id:'b',category:'deals'},{id:'c',category:'ukraine',imageUrl:'https://example.org/photo'}];
 assert.equal(chooseCover(rows,{},{}).id,'b');
 assert.equal(chooseCover(rows,{b:'cached'},{a:{attempts:3},c:{broken:true}}).id,'c');
 assert.equal(chooseCover(rows,{b:'cached'},{a:{done:true}}),null);
 const base={enabled:true,hasKey:true,count:19,busy:false,spent:1,limit:5,now:100};
 assert.equal(canGenerate(base),true);
 for(const patch of [{enabled:false},{hasKey:false},{count:20},{busy:true},{spent:4.5},{pauseUntil:200}])assert.equal(canGenerate({...base,...patch}),false);
});
test('OBS snapshot only requests local read-only operations',async()=>{
 const sent=[];
 class MockWS{
  constructor(url){assert.equal(url,'ws://127.0.0.1:4455');this.handlers={};queueMicrotask(()=>this.emit({op:0,d:{rpcVersion:1}}));}
  addEventListener(k,fn){this.handlers[k]=fn;}
  emit(msg){this.handlers.message?.({data:JSON.stringify(msg)});}
  close(){}
  send(raw){const {op,d}=JSON.parse(raw);
   if(op===1){assert.equal(d.rpcVersion,1);queueMicrotask(()=>this.emit({op:2,d:{}}));return;}
   assert.equal(op,6);sent.push(d.requestType);
   const data={GetStats:{cpuUsage:12,activeFps:60,renderSkippedFrames:2},GetSceneList:{currentProgramSceneName:'Quiz',scenes:[{sceneName:'Quiz'}]},GetInputList:{inputs:[{inputName:'Mic',inputKind:'wasapi_input_capture'}]},GetStreamStatus:{outputActive:false},GetRecordStatus:{outputActive:false},GetVideoSettings:{outputWidth:1920,outputHeight:1080},GetSceneItemList:{sceneItems:[{sourceName:'Mic',sceneItemEnabled:true}]}};
   queueMicrotask(()=>this.emit({op:7,d:{requestId:d.requestId,requestType:d.requestType,requestStatus:{result:true},responseData:data[d.requestType]}}));
  }
 }
 const r=await obsSnapshot(4455,'',MockWS);
 assert.equal(r.cpu,12);assert.equal(r.fps,60);assert.equal(r.currentScene,'Quiz');assert.equal(r.sources[0].items[0].name,'Mic');assert.equal(r.streamActive,false);assert.ok(sent.every(x=>x.startsWith('Get')));
});
