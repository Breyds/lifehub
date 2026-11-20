'use strict';
const crypto=require('node:crypto');
const {cleanResult,weekGoals}=require('./cs2.cjs');
const {validDate,assertScheduledDate}=require('./logic.cjs');
const KINDS=['projects','gym','cardio','cs2logs','weight','meals','channels','ideas','streams','songs','programs'];
const MAX_ITEMS=2000;
const string=(x,max=500)=>String(x??'').trim().slice(0,max);
const dateField=x=>{const s=string(x,30);if(!s)return '';if(!validDate(s)||Number(s.slice(0,4))<2000||Number(s.slice(0,4))>2100)throw new Error('Вкажи справжню дату від 2000 до 2100 року');return s;};
const timeField=x=>{const s=string(x,30);if(!s)return '';if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s))throw new Error('Час має бути у форматі 00:00–23:59');return s;};
const num=(x,max=5000)=>{if(x===''||x===null||x===undefined)return null;const n=Number(x);return Number.isFinite(n)&&n>=0&&n<=max?Number(n.toFixed(2)):null};
const urlField=x=>{const s=string(x,500);if(!s)return '';try{const u=new URL(s);if(!['https:','http:'].includes(u.protocol))return '';if(/^(localhost|\[?::1\]?|0\.|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname))return '';return u.toString();}catch{return '';}};
function blankWorkspace(){const w={};for(const k of KINDS)w[k]=[];return w;}
function safeWorkspace(value){const out=blankWorkspace();if(!value||typeof value!=='object')return out;for(const kind of KINDS){if(Array.isArray(value[kind]))out[kind]=value[kind].slice(0,MAX_ITEMS).filter(x=>x&&typeof x==='object');}return out;}
function validateItem(kind,raw,original){
 if(!KINDS.includes(kind))throw new Error('Невідомий тип запису');
 if(!raw||typeof raw!=='object')throw new Error('Некоректні дані');
 const x={id:original?.id||crypto.randomUUID(),createdAt:original?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 // History (workouts, meals, completed streams, published videos) may retain past dates.
 // Only new/changed future commitments are blocked.
 if(kind==='projects'&&raw.deadline)assertScheduledDate(String(raw.deadline),String(original?.deadline||''));
 if(kind==='streams'&&raw.date&&raw.status!=='done'&&raw.status!=='cancelled')assertScheduledDate(String(raw.date),String(original?.date||''));
 if(kind==='ideas'&&raw.date&&raw.status!=='published')assertScheduledDate(String(raw.date),String(original?.date||''));
 if(kind==='projects'){
  const legacy=string(raw.steps,4000).split('\n').map(s=>s.trim()).filter(Boolean).slice(0,80);
  const legacyDone=new Set(Array.isArray(raw.completedSteps)?raw.completedSteps.map(Number).filter(Number.isInteger):[]);
  const supplied=Array.isArray(raw.stages)?raw.stages:legacy.map((title,index)=>({title,progress:legacyDone.has(index)?100:0}));
  const stages=supplied.slice(0,80).map((value,index)=>({id:string(value?.id,90)||'stage-'+index+'-'+crypto.randomUUID(),title:string(value?.title,160),description:string(value?.description,700),progress:Math.max(0,Math.min(100,Number.isFinite(Number(value?.progress))?Math.round(Number(value.progress)):0))})).filter(v=>v.title);
  const steps=stages.map(v=>v.title).join('\n');
  const completedSteps=stages.flatMap((v,i)=>v.progress>=100?[i]:[]);
  const progress=stages.length?Math.round(stages.reduce((a,b)=>a+b.progress,0)/stages.length):num(raw.progress,100)??0;
  const resources=Array.isArray(raw.resources)?raw.resources.slice(0,80).map((v,i)=>({id:string(v?.id,90)||'link-'+i+'-'+crypto.randomUUID(),title:string(v?.title,120),url:urlField(v?.url),note:string(v?.note,350)})).filter(v=>v.url):[];
  const ideas=Array.isArray(raw.ideas)?raw.ideas.slice(0,100).map((v,i)=>({id:string(v?.id,90)||'idea-'+i+'-'+crypto.randomUUID(),text:string(v?.text,600)})).filter(v=>v.text):[];
  const blockers=Array.isArray(raw.blockers)?raw.blockers.slice(0,80).map((v,i)=>({id:string(v?.id,90)||'blocker-'+i+'-'+crypto.randomUUID(),text:string(v?.text,450),resolved:v?.resolved===true})).filter(v=>v.text):[];
  const journal=Array.isArray(raw.journal)?raw.journal.slice(0,250).map((v,i)=>({id:string(v?.id,90)||'log-'+i+'-'+crypto.randomUUID(),text:string(v?.text,1000),at:/^\d{4}-\d{2}-\d{2}T/.test(String(v?.at||''))?string(v.at,40):new Date().toISOString()})).filter(v=>v.text):[];
  Object.assign(x,{title:string(raw.title,130),description:string(raw.description,2500),deadline:dateField(raw.deadline),status:['active','paused','done'].includes(raw.status)?raw.status:'active',steps,stages,completedSteps,progress,note:string(raw.note,3500),resources,ideas,blockers,journal,nextAction:string(raw.nextAction,500),weeklyFocus:string(raw.weeklyFocus,500)});
 }
 if(['gym','cardio','cs2logs'].includes(kind)&&raw.duration!==null&&raw.duration!==undefined&&raw.duration!==''&&(!Number.isFinite(Number(raw.duration))||Number(raw.duration)<0||Number(raw.duration)>600))throw new Error('Тривалість тренування має бути від 0 до 600 хвилин');
 if(kind==='gym')Object.assign(x,{title:string(raw.title,130),date:dateField(raw.date),exercises:string(raw.exercises,3000),duration:num(raw.duration,600),note:string(raw.note,1500),setting:string(raw.setting,100)||'home'});
 if(kind==='cardio')Object.assign(x,{title:string(raw.title,130)||'Ходьба на доріжці',date:dateField(raw.date),duration:num(raw.duration,600),distance:num(raw.distance,1000),speed:num(raw.speed,35),incline:num(raw.incline,40),note:string(raw.note,1500)});
 if(kind==='cs2logs')Object.assign(x,{title:string(raw.title,130)||'CS2 · тренування',...cleanResult(raw),note:string(raw.note||raw.notes,1500),demoFile:string(raw.demoFile,200)});
 if(kind==='weight')Object.assign(x,{title:string(raw.title,130)||'Контроль ваги',date:dateField(raw.date),kg:num(raw.kg,500),waist:num(raw.waist,300),note:string(raw.note,1000)});
 if(kind==='meals')Object.assign(x,{title:string(raw.title,130),date:dateField(raw.date),calories:num(raw.calories,10000),protein:num(raw.protein,500),note:string(raw.note,1500),photoData:typeof raw.photoData==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(raw.photoData)&&raw.photoData.length<500000?raw.photoData:''});
 if(kind==='channels')Object.assign(x,{title:string(raw.title,130),url:urlField(raw.url),focus:string(raw.focus,350),uploadTime:timeField(raw.uploadTime)});
 if(kind==='ideas')Object.assign(x,{title:string(raw.title,130),channelId:string(raw.channelId,100),status:['idea','script','editing','ready','published'].includes(raw.status)?raw.status:'idea',date:dateField(raw.date),url:urlField(raw.url),note:string(raw.note,1800)});
 if(kind==='streams')Object.assign(x,{title:string(raw.title,130),date:dateField(raw.date),time:timeField(raw.time),endTime:timeField(raw.endTime),projectId:string(raw.projectId,100),status:['planned','done','cancelled'].includes(raw.status)?raw.status:'planned',note:string(raw.note,2500)});
 if(kind==='songs')Object.assign(x,{title:string(raw.title,130),artist:string(raw.artist,100),url:urlField(raw.url),note:string(raw.note,1000),status:['queued','added'].includes(raw.status)?raw.status:'queued',week:dateField(raw.week)});
 if(kind==='programs')Object.assign(x,{title:string(raw.title,130),content:string(raw.content,10000),date:dateField(raw.date),focus:['gym','cardio','nutrition','general'].includes(raw.focus)?raw.focus:'general'});
 if(!x.title)throw new Error('Додай назву');
 if(kind==='songs'&&raw.url&&!x.url)throw new Error('Посилання повинно починатися з https:// або http://');
 if(kind==='channels'&&raw.url&&!x.url)throw new Error('Перевір URL каналу');
 return x;
}
function addItem(w,kind,raw){if(!KINDS.includes(kind))throw new Error('Невідомий тип');if(w[kind].length>=MAX_ITEMS)throw new Error('Досягнуто ліміту записів');const item=validateItem(kind,raw);w[kind].unshift(item);return item;}
function updateItem(w,kind,id,raw){if(!KINDS.includes(kind))throw new Error('Невідомий тип');const i=w[kind].findIndex(x=>x.id===id);if(i<0)throw new Error('Запис не знайдено');const incoming=raw&&typeof raw==='object'?raw:{};const merged={...w[kind][i],...incoming};if(kind==='projects'){
  if(Object.prototype.hasOwnProperty.call(incoming,'steps')&&!Object.prototype.hasOwnProperty.call(incoming,'stages'))delete merged.stages;
  if(Object.prototype.hasOwnProperty.call(incoming,'progress')&&!Object.prototype.hasOwnProperty.call(incoming,'stages')&&!Object.prototype.hasOwnProperty.call(incoming,'steps')&&Array.isArray(merged.stages)){
    const pct=num(incoming.progress,100);if(pct===null)throw new Error('Прогрес має бути від 0 до 100%');merged.stages=merged.stages.map(x=>({...x,progress:pct}));
  }
 }const item=validateItem(kind,merged,w[kind][i]);w[kind][i]=item;return item;}
function deleteItem(w,kind,id){if(!KINDS.includes(kind))throw new Error('Невідомий тип');const i=w[kind].findIndex(x=>x.id===id);if(i<0)return false;w[kind].splice(i,1);return true;}
function defaultPreferences(){return {nickname:'Мій LifeHub',avatarData:'',tiktokCollectionUrl:'',cs2Targets:{dmKills:500,botKills:1000,matches:5,minutes:120},cs2WeeklyTargets:{dmKills:3500,botKills:7000,matches:20,minutes:840},accent:'green',density:'comfortable',language:'uk',newsAutoRefresh:true,newsCategories:['anime','games','internet','world','tech'],fitness:{goal:'general',experience:'beginner',constraints:'',height:null,currentWeight:null,age:null,activity:'moderate',weeklyDays:3,homeEquipment:'Доріжка'},fridayReminder:true};}
function safePreferences(x){const d=defaultPreferences();if(!x||typeof x!=='object')return d;
 const f=x.fitness||{};return {nickname:string(x.nickname||d.nickname,40),tiktokCollectionUrl:urlField(x.tiktokCollectionUrl),cs2Targets:{dmKills:num(x.cs2Targets?.dmKills,100000)??500,botKills:num(x.cs2Targets?.botKills,100000)??1000,matches:num(x.cs2Targets?.matches,1000)??5,minutes:num(x.cs2Targets?.minutes,1440)??120},cs2WeeklyTargets:weekGoals(x.cs2WeeklyTargets),avatarData:typeof x.avatarData==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x.avatarData)&&x.avatarData.length<1500000?x.avatarData:'',accent:['green','blue','violet','orange'].includes(x.accent)?x.accent:d.accent,density:['comfortable','compact'].includes(x.density)?x.density:d.density,language:['uk','en'].includes(x.language)?x.language:d.language,newsAutoRefresh:x.newsAutoRefresh!==false,newsCategories:Array.isArray(x.newsCategories)?x.newsCategories.filter(v=>['anime','games','internet','world','tech','europe','america','asia','africa','cis'].includes(v)).slice(0,12):d.newsCategories,fitness:{goal:['general','loss','muscle','endurance'].includes(f.goal)?f.goal:'general',experience:['beginner','intermediate','advanced'].includes(f.experience)?f.experience:'beginner',constraints:string(f.constraints,1000),height:num(f.height,260),currentWeight:num(f.currentWeight,500),age:num(f.age,110),activity:['low','moderate','high'].includes(f.activity)?f.activity:'moderate',weeklyDays:num(f.weeklyDays,7)||3,homeEquipment:string(f.homeEquipment||'Доріжка',250)},fridayReminder:x.fridayReminder!==false};}
function fridayForDate(date){const d=new Date(date+'T12:00:00Z');if(Number.isNaN(d.valueOf()))throw new Error('Некоректна дата');const day=d.getUTCDay(),distance=(day+2)%7;d.setUTCDate(d.getUTCDate()-distance);return d.toISOString().slice(0,10);}
function toggleProjectStep(w,id,index){
 const p=w.projects.find(x=>x.id===id);if(!p)throw new Error('Проєкт не знайдено');
 const stages=Array.isArray(p.stages)?p.stages:String(p.steps||'').split('\n').map(x=>x.trim()).filter(Boolean).map((title,i)=>({id:'legacy-'+i,title,description:'',progress:(p.completedSteps||[]).includes(i)?100:0}));
 if(!Number.isInteger(index)||index<0||index>=stages.length)throw new Error('Невідомий етап');
 stages[index]={...stages[index],progress:Number(stages[index].progress)>=100?0:100};
 p.stages=stages;p.completedSteps=stages.flatMap((x,i)=>Number(x.progress)>=100?[i]:[]);
 p.progress=stages.length?Math.round(stages.reduce((total,x)=>total+Number(x.progress||0),0)/stages.length):0;p.updatedAt=new Date().toISOString();
 return p;
}
module.exports={KINDS,blankWorkspace,safeWorkspace,validateItem,addItem,updateItem,deleteItem,toggleProjectStep,safePreferences,defaultPreferences,fridayForDate,urlField};
