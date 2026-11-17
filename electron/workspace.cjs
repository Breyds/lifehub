'use strict';
const crypto=require('node:crypto');
const {validDate}=require('./logic.cjs');
const KINDS=['projects','gym','cardio','cs2logs','weight','meals','channels','ideas','streams','songs','programs'];
const MAX_ITEMS=2000;
const string=(x,max=500)=>String(x??'').trim().slice(0,max);
const dateField=x=>{const s=string(x,10);return validDate(s)?s:''};
const timeField=x=>{const s=string(x,5);return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)?s:''};
const num=(x,max=5000)=>{if(x===''||x===null||x===undefined)return null;const n=Number(x);return Number.isFinite(n)&&n>=0&&n<=max?Number(n.toFixed(2)):null};
const urlField=x=>{const s=string(x,500);if(!s)return '';try{const u=new URL(s);if(!['https:','http:'].includes(u.protocol))return '';if(/^(localhost|\[?::1\]?|0\.|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname))return '';return u.toString();}catch{return '';}};
function blankWorkspace(){const w={};for(const k of KINDS)w[k]=[];return w;}
function safeWorkspace(value){const out=blankWorkspace();if(!value||typeof value!=='object')return out;for(const kind of KINDS){if(Array.isArray(value[kind]))out[kind]=value[kind].slice(0,MAX_ITEMS).filter(x=>x&&typeof x==='object');}return out;}
function validateItem(kind,raw,original){
 if(!KINDS.includes(kind))throw new Error('Невідомий тип запису');
 if(!raw||typeof raw!=='object')throw new Error('Некоректні дані');
 const x={id:original?.id||crypto.randomUUID(),createdAt:original?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(kind==='projects'){
  const steps=string(raw.steps,4000),list=steps.split('\n').map(s=>s.trim()).filter(Boolean);
  const completedSteps=Array.isArray(raw.completedSteps)?raw.completedSteps.map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<list.length).slice(0,100):[];
  const progress=list.length&&completedSteps.length?Math.round(new Set(completedSteps).size/list.length*100):num(raw.progress,100)??0;
  Object.assign(x,{title:string(raw.title,130),description:string(raw.description,2500),deadline:dateField(raw.deadline),status:['active','paused','done'].includes(raw.status)?raw.status:'active',steps,completedSteps:[...new Set(completedSteps)],progress,note:string(raw.note,3500)});
 }
 if(kind==='gym')Object.assign(x,{title:string(raw.title,130),date:dateField(raw.date),exercises:string(raw.exercises,3000),duration:num(raw.duration,600),note:string(raw.note,1500),setting:string(raw.setting,100)||'home'});
 if(kind==='cardio')Object.assign(x,{title:string(raw.title,130)||'Ходьба на доріжці',date:dateField(raw.date),duration:num(raw.duration,600),distance:num(raw.distance,1000),speed:num(raw.speed,35),incline:num(raw.incline,40),note:string(raw.note,1500)});
 if(kind==='cs2logs')Object.assign(x,{title:string(raw.title,130),date:dateField(raw.date),duration:num(raw.duration,600),practice:string(raw.practice,2500),note:string(raw.note,1500),dmKills:num(raw.dmKills,100000),botKills:num(raw.botKills,100000),matches:num(raw.matches,1000),demoFile:string(raw.demoFile,200)});
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
function updateItem(w,kind,id,raw){if(!KINDS.includes(kind))throw new Error('Невідомий тип');const i=w[kind].findIndex(x=>x.id===id);if(i<0)throw new Error('Запис не знайдено');const item=validateItem(kind,{...w[kind][i],...raw},w[kind][i]);w[kind][i]=item;return item;}
function deleteItem(w,kind,id){if(!KINDS.includes(kind))throw new Error('Невідомий тип');const i=w[kind].findIndex(x=>x.id===id);if(i<0)return false;w[kind].splice(i,1);return true;}
function defaultPreferences(){return {nickname:'Мій LifeHub',avatarData:'',tiktokCollectionUrl:'',cs2Targets:{dmKills:500,botKills:1000,matches:5,minutes:120},accent:'green',density:'comfortable',language:'uk',newsAutoRefresh:true,newsCategories:['anime','games','internet','world','tech','music_us','music_ru'],fitness:{goal:'general',experience:'beginner',constraints:'',height:null,currentWeight:null,age:null,activity:'moderate',weeklyDays:3,homeEquipment:'Доріжка'},fridayReminder:true};}
function safePreferences(x){const d=defaultPreferences();if(!x||typeof x!=='object')return d;
 const f=x.fitness||{};return {nickname:string(x.nickname||d.nickname,40),tiktokCollectionUrl:urlField(x.tiktokCollectionUrl),cs2Targets:{dmKills:num(x.cs2Targets?.dmKills,100000)??500,botKills:num(x.cs2Targets?.botKills,100000)??1000,matches:num(x.cs2Targets?.matches,1000)??5,minutes:num(x.cs2Targets?.minutes,1440)??120},avatarData:typeof x.avatarData==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x.avatarData)&&x.avatarData.length<1500000?x.avatarData:'',accent:['green','blue','violet','orange'].includes(x.accent)?x.accent:d.accent,density:['comfortable','compact'].includes(x.density)?x.density:d.density,language:['uk','en'].includes(x.language)?x.language:d.language,newsAutoRefresh:x.newsAutoRefresh!==false,newsCategories:Array.isArray(x.newsCategories)?x.newsCategories.filter(v=>['anime','games','internet','world','tech','europe','america','asia','africa','cis','music_us','music_ru'].includes(v)).slice(0,12):d.newsCategories,fitness:{goal:['general','loss','muscle','endurance'].includes(f.goal)?f.goal:'general',experience:['beginner','intermediate','advanced'].includes(f.experience)?f.experience:'beginner',constraints:string(f.constraints,1000),height:num(f.height,260),currentWeight:num(f.currentWeight,500),age:num(f.age,110),activity:['low','moderate','high'].includes(f.activity)?f.activity:'moderate',weeklyDays:num(f.weeklyDays,7)||3,homeEquipment:string(f.homeEquipment||'Доріжка',250)},fridayReminder:x.fridayReminder!==false};}
function fridayForDate(date){const d=new Date(date+'T12:00:00Z');if(Number.isNaN(d.valueOf()))throw new Error('Некоректна дата');const day=d.getUTCDay(),distance=(day+2)%7;d.setUTCDate(d.getUTCDate()-distance);return d.toISOString().slice(0,10);}
function toggleProjectStep(w,id,index){
 const p=w.projects.find(x=>x.id===id);if(!p)throw new Error('Проєкт не знайдено');
 const steps=String(p.steps||'').split('\n').map(x=>x.trim()).filter(Boolean);
 if(!Number.isInteger(index)||index<0||index>=steps.length)throw new Error('Невідомий етап');
 const completed=new Set(p.completedSteps||[]);
 if(completed.has(index))completed.delete(index);else completed.add(index);
 p.completedSteps=[...completed].sort((a,b)=>a-b);p.progress=Math.round(p.completedSteps.length/steps.length*100);p.updatedAt=new Date().toISOString();
 return p;
}
module.exports={KINDS,blankWorkspace,safeWorkspace,validateItem,addItem,updateItem,deleteItem,toggleProjectStep,safePreferences,defaultPreferences,fridayForDate,urlField};
