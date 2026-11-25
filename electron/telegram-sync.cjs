'use strict';
const {randomUUID}=require('node:crypto');
const {cleanTask,validDate}=require('./logic.cjs');
const copy=x=>x==null?null:JSON.parse(JSON.stringify(x));
const stable=x=>x==null?JSON.stringify(x):Array.isArray(x)?'['+x.map(stable).join(',')+']':typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
function cleanTasks(rows){
 if(!Array.isArray(rows)||rows.length>5000)throw Error('Некоректний список справ');
 const seen=new Set();return rows.map(t=>{
 if(!t||typeof t.id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(t.id)||seen.has(t.id))throw Error('Некоректний ID справи');seen.add(t.id);
 const safe=cleanTask(t,t.id);safe.createdAt=typeof t.createdAt==='string'?t.createdAt.slice(0,40):safe.createdAt;
 safe.completions=Array.isArray(t.completions)?[...new Set(t.completions.filter(validDate))].slice(-5000):[];
 safe.progress=Object.fromEntries(Object.entries(t.progress||{}).filter(([k,v])=>validDate(k)&&typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10000000).slice(-5000));
 return safe;
 });
}
function differences(before,after){const a=new Map(before.map(t=>[t.id,t])),b=new Map(after.map(t=>[t.id,t]));return [...new Set([...a.keys(),...b.keys()])].flatMap(id=>{const old=a.get(id)||null,next=b.get(id)||null;return stable(old)===stable(next)?[]:[{id:randomUUID(),taskId:id,before:copy(old),after:copy(next)}];});}
function applyPending(tasks,pending){
 let next=cleanTasks(tasks),conflicts=[],ack=[];
 for(const p of pending){if(!p||typeof p.id!=='string'||typeof p.taskId!=='string')throw Error('Некоректна операція синхронізації');const index=next.findIndex(t=>t.id===p.taskId),current=index<0?null:next[index],old=p.before?cleanTasks([p.before])[0]:null,desired=p.after?cleanTasks([p.after])[0]:null;
 if((old&&old.id!==p.taskId)||(desired&&desired.id!==p.taskId))throw Error('Невідповідність ID синхронізації');
 if(stable(current)===stable(desired)){ack.push(p.id);continue;}
 if(stable(current)!==stable(old)){conflicts.push({id:p.id,title:desired?.title||old?.title||p.taskId});ack.push(p.id);continue;}
 if(index>=0){if(desired)next[index]=desired;else next.splice(index,1);}else if(desired)next.push(desired);ack.push(p.id);
 }return {tasks:next,ack,conflicts};
}
function endpoint(raw){const u=new URL(String(raw||'').trim());if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Потрібна HTTPS-адреса сервера без шляху');return u.origin;}
async function request(url,key,path,body,fetcher=fetch){if(typeof key!=='string'||key.length<32||key.length>256)throw Error('Ключ синхронізації має бути від 32 до 256 символів');const r=await fetcher(endpoint(url)+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok)throw Error('Сервер Telegram: HTTP '+r.status);const data=await r.json();if(!data?.ok)throw Error('Некоректна відповідь сервера Telegram');return data;}
module.exports={cleanTasks,differences,applyPending,endpoint,request};
