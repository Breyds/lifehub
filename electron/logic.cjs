'use strict';
const crypto = require('node:crypto');
const CATEGORIES = ['personal','rankdaily','twitch','cs2','sport','study'];
const RECURRENCES = ['none','daily','weekdays','weekly'];
function validDate(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(x + 'T12:00:00Z');
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10) === x;
}
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
function occurrenceKey(t,date){return t.recurrence==='none'?t.dueDate:date;}
function complete(t,date){return (t.completions||[]).includes(occurrenceKey(t,date));}
function cleanTask(payload, id=crypto.randomUUID()) {
  if (!payload || typeof payload !== 'object') throw new Error('Некоректне завдання');
  const title = String(payload.title||'').trim().slice(0,120);
  if (!title) throw new Error('Додай назву завдання');
  const dueDate=String(payload.dueDate||'');
  if(!validDate(dueDate)) throw new Error('Некоректна дата');
  const time=String(payload.time||'');
  if(!validTime(time)) throw new Error('Некоректний час');
  const category=CATEGORIES.includes(payload.category)?payload.category:'personal';
  const recurrence=RECURRENCES.includes(payload.recurrence)?payload.recurrence:'none';
  return {id,title,dueDate,time,category,recurrence,note:String(payload.note||'').trim().slice(0,500),completions:[],createdAt:new Date().toISOString()};
}
function validateProposal(p,tasks) {
  if (!p || !['create','reschedule'].includes(p.action)) return null;
  if(!validDate(p.date) || !validTime(p.time))return null;
  if(p.action==='create'){
    try{return {action:'create',task:cleanTask({title:p.title,dueDate:p.date,time:p.time,category:p.category,recurrence:p.recurrence,note:p.note})};}catch{return null;}
  }
  const target=tasks.find(t=>t.id===p.task_id);
  if(!target || target.recurrence!=='none')return null;
  return {action:'reschedule',taskId:target.id,date:p.date,time:p.time,title:target.title};
}
module.exports={CATEGORIES,RECURRENCES,validDate,validTime,dayDiff,occurs,occurrenceKey,complete,cleanTask,validateProposal};
