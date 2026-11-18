'use strict';
const {randomInt}=require('node:crypto');
function validToken(x){return typeof x==='string'&&/^\d{5,20}:[A-Za-z0-9_-]{30,}$/.test(x.trim());}
async function telegramRequest(token,method,payload={},fetcher=fetch){
 if(!validToken(token))throw new Error('Некоректний токен Telegram-бота.');
 const response=await fetcher(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.ok)throw new Error(`Telegram: ${String(result?.description||'запит відхилено').slice(0,140)}`);
 return result.result;
}
// Backward-compatible pure helper for legacy unit tests; never used for account pairing.
function findStartedChat(items){const messages=(Array.isArray(items)?items:[]).map(x=>x?.message).filter(x=>x?.chat?.type==='private'&&String(x.text||'').trim().startsWith('/start')&&Number.isSafeInteger(x.chat.id));return messages.length?String(messages[messages.length-1].chat.id):'';}
function pairingCode(){return String(randomInt(100000,1000000));}
function findPairedChat(updates,code){
 if(!/^\d{6}$/.test(String(code||'')))return '';
 const messages=(Array.isArray(updates)?updates:[]).map(x=>x?.message).filter(x=>x?.chat?.type==='private'&&Number.isSafeInteger(x.chat.id));
 const match=messages.find(m=>new RegExp(`^/link(?:@\\w+)?\\s+${code}\\s*$`,'i').test(String(m.text||'').trim()));
 return match?String(match.chat.id):'';
}
function parseCommand(raw){
 const s=String(raw||'').trim().slice(0,400);
 if(/^\/(start|help)(?:@\w+)?\s*$/i.test(s))return {action:'help'};
 if(/^\/today(?:@\w+)?\s*$/i.test(s))return {action:'today'};
 if(/^\/tomorrow(?:@\w+)?\s*$/i.test(s))return {action:'tomorrow'};
 const add=s.match(/^\/(?:add|remind)(?:@\w+)?\s+([01]\d|2[0-3]):([0-5]\d)\s+(.{1,120})$/i);
 if(add)return {action:'add',time:`${add[1]}:${add[2]}`,title:add[3].trim()};
 const done=s.match(/^\/done(?:@\w+)?\s+([1-9]\d?)$/i);
 if(done)return {action:'done',index:Number(done[1])};
 return {action:'unknown'};
}
function lastUpdateOffset(items,current=0){return (Array.isArray(items)?items:[]).reduce((n,x)=>Number.isSafeInteger(x?.update_id)?Math.max(n,x.update_id+1):n,current);}
function formatAgenda(tasks,date,doneFn){
 const list=tasks.filter(t=>doneFn.occurs(t,date)).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 if(!list.length)return `📅 ${date}: справ немає.`;
 return [`📅 Справи на ${date}:`,...list.slice(0,25).map((t,i)=>`${i+1}. ${doneFn.taskDone(t,date)?'✅':'▫️'} ${t.time||'Увесь день'} · ${t.title}`),'\n/done 1 — відмітити першу справу сьогодні'].join('\n');
}
module.exports={validToken,telegramRequest,findStartedChat,pairingCode,findPairedChat,parseCommand,lastUpdateOffset,formatAgenda};
