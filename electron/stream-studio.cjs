'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const MAX_FILE=100*1024*1024,MAX_XML=4*1024*1024;
const checklist=[
 ['content','Матеріали і сценарій'],['questions','Питання/контент перевірено'],['scenes','Сцени та переходи OBS'],['microphone','Мікрофон і баланс звуку'],['audio','Звук гри/системи'],['overlay','Оверлеї, вебка або рахунок'],['recording','Тестовий запис переглянуто'],['network','Інтернет та стабільність бітрейту'],['performance','Продуктивність під навантаженням'],['metadata','Назва, опис, категорія й прев’ю'],['backup','План паузи / резервний сценарій']
];
const text=(v,n=200)=>String(v??'').trim().slice(0,n);
function cleanStudio(raw={}){
 const check=Object.fromEntries(checklist.map(([id])=>[id,raw.check?.[id]===true]));
 return {platform:['Twitch','YouTube','Kick','Інше'].includes(raw.platform)?raw.platform:'Twitch',format:['quiz','gaming','talk','study','reaction','custom'].includes(raw.format)?raw.format:'custom',category:text(raw.category,100),description:text(raw.description,1500),plan:text(raw.plan,4000),obsPlan:text(raw.obsPlan,4000),post:text(raw.post,3000),check,materials:Array.isArray(raw.materials)?raw.materials.slice(0,20).filter(m=>m&&/^[a-f0-9-]{36}$/.test(m.id)).map(m=>({id:m.id,name:text(m.name,180),bytes:Math.max(0,Math.min(MAX_FILE,Number(m.bytes)||0)),kind:text(m.kind,20),entries:Math.max(0,Math.min(10000,Number(m.entries)||0)),questions:Math.max(0,Math.min(100000,Number(m.questions)||0)),warnings:Array.isArray(m.warnings)?m.warnings.slice(0,15).map(x=>text(x,240)):[],summary:text(m.summary,600)})):[]};
}
function inspectZip(buf){
 let e=-1;for(let i=buf.length-22;i>=Math.max(0,buf.length-65557);i--)if(buf.readUInt32LE(i)===0x06054b50&&i+22+buf.readUInt16LE(i+20)===buf.length){e=i;break;}
 if(e<0)throw Error('ZIP: не знайдено центральний каталог');
 const count=buf.readUInt16LE(e+10),size=buf.readUInt32LE(e+12),offset=buf.readUInt32LE(e+16);
 if(buf.readUInt16LE(e+4)||buf.readUInt16LE(e+6)||buf.readUInt16LE(e+8)!==count||count>10000||offset+size>e)throw Error('ZIP64, багатотомні або пошкоджені архіви не підтримуються');
 let p=offset,expanded=0,empty=0,dupes=0,unsafe=0,encrypted=0,questions=0,xmlFound=false;const seen=new Set(),warnings=[];
 for(let i=0;i<count;i++){
  if(p+46>offset+size||buf.readUInt32LE(p)!==0x02014b50)throw Error('Пошкоджений каталог ZIP');
  const flags=buf.readUInt16LE(p+8),method=buf.readUInt16LE(p+10),compressed=buf.readUInt32LE(p+20),uncompressed=buf.readUInt32LE(p+24),n=buf.readUInt16LE(p+28),extra=buf.readUInt16LE(p+30),comment=buf.readUInt16LE(p+32),local=buf.readUInt32LE(p+42);
  if(p+46+n+extra+comment>offset+size)throw Error('Пошкоджена назва ZIP');
  const name=buf.subarray(p+46,p+46+n).toString('utf8').replace(/\\/g,'/');p+=46+n+extra+comment;
  const lower=name.toLowerCase();if(seen.has(lower))dupes++;seen.add(lower);
  if(name.startsWith('/')||/^[a-z]:/i.test(name)||name.split('/').includes('..')||name.includes('\0'))unsafe++;
  if(flags&1)encrypted++;if(!name.endsWith('/')&&!uncompressed)empty++;
  expanded+=uncompressed;if(expanded>500*1024*1024)throw Error('Розпакований розмір перевищує 500 МБ');
  if(local+30>offset||buf.readUInt32LE(local)!==0x04034b50)throw Error('Пошкоджений локальний заголовок ZIP');
  const start=local+30+buf.readUInt16LE(local+26)+buf.readUInt16LE(local+28);
  if(start+compressed>offset)throw Error('Пошкоджені межі ZIP');
  if(lower==='content.xml'||lower.endsWith('/content.xml')){
   if(xmlFound)continue;xmlFound=true;
   if(flags&1||uncompressed>MAX_XML||![0,8].includes(method)){warnings.push('content.xml зашифрований, завеликий або має непідтримуваний метод');continue;}
   const bytes=buf.subarray(start,start+compressed);
   const xml=(method===0?bytes:zlib.inflateRawSync(bytes,{maxOutputLength:MAX_XML})).toString('utf8');
   if(/<!DOCTYPE|<!ENTITY/i.test(xml))warnings.push('XML містить DTD/ENTITY; не обробляємо його як документ');
   else{questions=(xml.match(/<(?:[\w-]+:)?question(?=[\s>\/])/gi)||[]).length;if(!questions)warnings.push('Не знайдено тегів question у content.xml');}
  }
 }
 if(!xmlFound)warnings.push('content.xml відсутній (це може бути звичайний ZIP, а не SIGame)');
 if(empty)warnings.push('Порожніх файлів: '+empty);
 if(dupes)warnings.push('Повторюваних імен: '+dupes);
 if(unsafe)warnings.push('Небезпечних шляхів: '+unsafe+'; архів не розпаковується');
 if(encrypted)warnings.push('Зашифрованих записів: '+encrypted);
 return {entries:count,questions,warnings,summary:'Каталог ZIP перевірено без розпакування. Питання — кількість XML-тегів; повна коректність медіа, відповідей та імпорт у SIGame не перевірені.'};
}
function inspectFile(file){
 const s=fs.statSync(file);if(!s.isFile()||s.size<1||s.size>MAX_FILE)throw Error('Файл має бути від 1 байта до 100 МБ');
 const ext=path.extname(file).toLowerCase();
 if(!['.siq','.zip','.txt','.md','.pdf','.png','.jpg','.jpeg','.webp','.mp3','.wav','.ogg','.mp4','.webm'].includes(ext))throw Error('Непідтримуваний формат. RAR спочатку перетвори на ZIP.');
 const base={kind:ext.slice(1),bytes:s.size,entries:0,questions:0,warnings:[],summary:'Файл існує й має допустимий розмір. Вміст медіа/PDF не декодовано.'};
 if(ext==='.siq'||ext==='.zip')Object.assign(base,inspectZip(fs.readFileSync(file)));
 if(['.txt','.md'].includes(ext)){const buf=fs.readFileSync(file);if(buf.includes(0))base.warnings.push('Текст містить нульові байти');else base.summary='Текстовий файл: '+buf.toString('utf8').split(/\r?\n/).length+' рядків. Зміст не оцінено.';}
 return base;
}
const hash=s=>crypto.createHash('sha256').update(s).digest('base64');
async function obsSnapshot(port=4455,password='',WS=globalThis.WebSocket){
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Некоректний порт OBS');
 if(typeof WS!=='function')throw Error('WebSocket недоступний у цій версії Electron');
 return new Promise((resolve,reject)=>{
  const ws=new WS('ws://127.0.0.1:'+port),pending=new Map();let settled=false,seq=0;
  const finish=(error,data)=>{if(settled)return;settled=true;clearTimeout(timer);try{ws.close();}catch{}error?reject(error):resolve(data);};
  const timer=setTimeout(()=>finish(Error('OBS не відповідає. Перевір сервер WebSocket 5.x і пароль.')),10000);
  const send=(op,d)=>ws.send(JSON.stringify({op,d}));
  const request=(requestType,requestData={})=>new Promise((res,rej)=>{const requestId=String(++seq);pending.set(requestId,{res,rej});send(6,{requestType,requestId,requestData});});
  ws.addEventListener('error',()=>finish(Error('Не вдалося підключитися до локального OBS')));
  ws.addEventListener('close',()=>finish(Error('OBS закрив з’єднання')));
  ws.addEventListener('message',async event=>{
   try{
    const msg=JSON.parse(String(event.data)),d=msg.d||{};
    if(msg.op===0){const auth=d.authentication;send(1,{rpcVersion:1,eventSubscriptions:0,...(auth?{authentication:hash(hash(password+auth.salt)+auth.challenge)}:{})});}
    if(msg.op===7){const p=pending.get(d.requestId);if(p){pending.delete(d.requestId);d.requestStatus?.result?p.res(d.responseData||{}):p.rej(Error('OBS: '+d.requestType));}}
    if(msg.op===2){
     const [stats,scenes,inputs,stream,record,video]=await Promise.allSettled(['GetStats','GetSceneList','GetInputList','GetStreamStatus','GetRecordStatus','GetVideoSettings'].map(t=>request(t)));
     const val=r=>r.status==='fulfilled'?r.value:null;
     const scene=val(scenes),list=(scene?.scenes||[]).slice(0,30).map(s=>s.sceneName).filter(x=>typeof x==='string');
     const sources=await Promise.allSettled(list.slice(0,12).map(async name=>({scene:name,items:(await request('GetSceneItemList',{sceneName:name})).sceneItems?.slice(0,50).map(s=>({name:s.sourceName,enabled:s.sceneItemEnabled}))||[]})));
     const st=val(stats),live=val(stream),rec=val(record),v=val(video),metric=(o,k)=>Number.isFinite(o?.[k])?o[k]:null;
     finish(null,{checkedAt:new Date().toISOString(),currentScene:scene?.currentProgramSceneName||'',scenes:list,sources:sources.filter(x=>x.status==='fulfilled').map(x=>x.value),inputs:(val(inputs)?.inputs||[]).slice(0,80).map(i=>({name:i.inputName,kind:i.inputKind})),cpu:metric(st,'cpuUsage'),memory:metric(st,'memoryUsage'),fps:metric(st,'activeFps'),renderSkipped:metric(st,'renderSkippedFrames'),renderTotal:metric(st,'renderTotalFrames'),outputSkipped:metric(st,'outputSkippedFrames'),outputTotal:metric(st,'outputTotalFrames'),streamActive:typeof live?.outputActive==='boolean'?live.outputActive:null,networkSkipped:metric(live,'outputSkippedFrames'),networkTotal:metric(live,'outputTotalFrames'),recording:typeof rec?.outputActive==='boolean'?rec.outputActive:null,width:metric(v,'outputWidth'),height:metric(v,'outputHeight')});
    }
   }catch(e){finish(e);}
  });
 });
}
module.exports={cleanStudio,checklist,inspectZip,inspectFile,obsSnapshot};
