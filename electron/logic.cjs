'use strict';
const crypto = require('node:crypto');
const CATEGORIES = ['personal','rankdaily','twitch','cs2','sport','study'];
const RECURRENCES = ['none','daily','weekdays','weekly'];
const PRIORITIES=['low','normal','high','critical','urgent'];
function validDate(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(x + 'T12:00:00Z');
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10) === x;
}
function validPlanningDate(x){return validDate(x)&&Number(x.slice(0,4))>=2000&&Number(x.slice(0,4))<=2100;}
function localToday(){const d=new Date();const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function validScheduledDate(x,from=localToday()){return validPlanningDate(x)&&x>=from;}
function assertScheduledDate(x,previous=''){if(x===previous)return;if(!validScheduledDate(x))throw new Error('Для нового плану обери сьогодні або майбутню дату. Минулі дати можна переглянути й перенести.');}
function validTime(x) { return typeof x === 'string' && (x === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(x)); }
function dayDiff(a,b){ const aMs=Date.parse(a+'T12:00:00Z'); const bMs=Date.parse(b+'T12:00:00Z'); return Math.round((bMs-aMs)/86400000); }
function occurs(t, date) {
  if (!validDate(date) || !validDate(t.dueDate)) return false;
  const days = dayDiff(t.dueDate,date);
  if (t.recurrence === 'none') return t.dueDate === date || (t.dueDate < date && !t.completions.includes(t.dueDate));
  if (days < 0) return false;
  if (t.recurrence === 'daily') return true;
  if (t.recurrence === 'weekdays') { const d=new Date(date+'T12:00:00Z').getUTCDay(); return d!==0 && d!==6; }
  if (t.recurrence === 'weekly') return days%7===0;
  return false;
}
// Calendar is a record of what was scheduled for a specific date.
// Unlike occurs(), this must not carry overdue one-time tasks into future calendar cells.
function scheduledOccurs(t,date){
  if(!validDate(date)||!validDate(t.dueDate))return false;
  if(t.recurrence==='none')return t.dueDate===date;
  const days=dayDiff(t.dueDate,date);
  if(days<0)return false;
  if(t.recurrence==='daily')return true;
  if(t.recurrence==='weekdays'){const d=new Date(date+'T12:00:00Z').getUTCDay();return d!==0&&d!==6;}
  if(t.recurrence==='weekly')return days%7===0;
  return false;
}
function occurrenceKey(t,date){return t.recurrence==='none'?t.dueDate:date;}
function complete(t,date){return (t.completions||[]).includes(occurrenceKey(t,date));}
function cleanTask(payload, id=crypto.randomUUID()) {
  if (!payload || typeof payload !== 'object') throw new Error('Некоректне завдання');
  const title = String(payload.title||'').trim().slice(0,120);
  if (!title) throw new Error('Додай назву завдання');
  const dueDate=String(payload.dueDate||'');
  if(!validPlanningDate(dueDate)) throw new Error('Дата справи має бути від 2000 до 2100 року');
  const time=String(payload.time||'');
  if(!validTime(time)) throw new Error('Некоректний час');
  const category=CATEGORIES.includes(payload.category)?payload.category:'personal';
  const recurrence=RECURRENCES.includes(payload.recurrence)?payload.recurrence:'none';
  const priority=PRIORITIES.includes(payload.priority)?payload.priority:'normal';
  const progressType=payload.progressType==='counter'||payload.progressType==='minutes'?payload.progressType:'check';
  const rawTarget=Number(payload.target??1);
  if(progressType!=='check' && (!Number.isFinite(rawTarget)||rawTarget<=0||rawTarget>1000000))throw new Error('Вкажи ціль більше нуля (до 1 000 000)');
  const target=progressType!=='check'?rawTarget:1;
  const durationMin=Number(payload.durationMin||0);
  if(!Number.isInteger(durationMin)||durationMin<0||durationMin>1440)throw new Error('Тривалість має бути від 0 до 1440 хвилин');
  const allDay=typeof payload.allDay==='boolean'?payload.allDay:!time;
  return {id,title,dueDate,time:allDay?'':time,allDay,durationMin,category,recurrence,priority,progressType,target,unit:String(payload.unit||'').trim().slice(0,24),note:String(payload.note||'').trim().slice(0,500),completions:[],progress:{},createdAt:new Date().toISOString()};
}
function validateProposal(p,tasks) {
  if (!p || !['create','reschedule'].includes(p.action)) return null;
  if(!validPlanningDate(p.date) || !validTime(p.time))return null;
  if(p.action==='create'){
    try{return {action:'create',task:cleanTask({title:p.title,dueDate:p.date,time:p.time,category:p.category,recurrence:p.recurrence,note:p.note})};}catch{return null;}
  }
  const target=tasks.find(t=>t.id===p.task_id);
  if(!target || target.recurrence!=='none')return null;
  return {action:'reschedule',taskId:target.id,date:p.date,time:p.time,title:target.title};
}
function progressFor(t,date){const key=occurrenceKey(t,date);return Number(t.progress?.[key]||0);}
function taskDone(t,date){return complete(t,date)||(['counter','minutes'].includes(t.progressType)&&progressFor(t,date)>=Number(t.target||1));}
function updateProgress(t,date,delta){
  if(!validDate(date)||!Number.isFinite(Number(delta)))throw new Error('Некоректний прогрес');
  if(!['counter','minutes'].includes(t.progressType))throw new Error('Це завдання з галочкою, а не лічильником');
  const key=occurrenceKey(t,date),cap=Number(t.target||1);
  if(!t.progress||typeof t.progress!=='object')t.progress={};
  // Preserve fractional portions (e.g. 0.8 l) and actual over-achievement.
  // A generous sanity limit prevents a mistaken multi-million-unit click.
  const next=progressFor(t,date)+Number(delta);
  if(!Number.isFinite(next)||Math.abs(Number(delta))>Math.max(1000000,cap*10))throw new Error('Занадто велика зміна прогресу');
  t.progress[key]=Math.round(Math.max(0,Math.min(cap*10,next))*1000)/1000;
  t.completions=Array.isArray(t.completions)?t.completions:[];
  t.completions=t.completions.filter(x=>x!==key);
  if(t.progress[key]>=cap)t.completions.push(key);
  return t.progress[key];
}
module.exports={CATEGORIES,RECURRENCES,PRIORITIES,validDate,validPlanningDate,validScheduledDate,assertScheduledDate,validTime,dayDiff,occurs,scheduledOccurs,occurrenceKey,complete,cleanTask,validateProposal,progressFor,taskDone,updateProgress};
