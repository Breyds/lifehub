'use strict';
// Public third-party snapshot of DTEK queue schedules. No address→queue lookup.
// Used only after the user confirms their queue or DTEK has established it.
const {slotsToDay,slotsToIntervals,localDate}=require('./dtek-live.cjs');
const MIRROR_URL='https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/kyiv-region.json';
function normalizeGroup(raw){const value=String(raw||'').trim().replace(/^GPV/i,'');return /^[1-6]\.[12]$/.test(value)?`GPV${value}`:'';}
function isoKyiv(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function nextDay(s){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
function parseMirror(raw,group,now=new Date()){
 const key=normalizeGroup(group);if(!key)throw new Error('Для резервного джерела потрібно обрати свою чергу ДТЕК');
 if(!raw||raw.regionId!=='kyiv-region'||!raw.fact||typeof raw.fact.data!=='object')throw new Error('Некоректні дані дзеркала');
 const updated=Date.parse(raw.lastUpdated||'');if(!Number.isFinite(updated)||updated>now.getTime()+3600000)throw new Error('Невірна дата оновлення дзеркала');
 const age=(now.getTime()-updated)/3600000;const today=isoKyiv(now),tomorrow=nextDay(today);
 const days=[],weeklyDays=[],intervals=[];
 for(const [stamp,groups] of Object.entries(raw.fact.data)){
  const date=localDate(stamp);if(date!==today&&date!==tomorrow)continue;
  const slots=groups?.[key];if(!slots||!Object.keys(slots).some(x=>/^(?:[1-9]|1\d|2[0-4])$/.test(x)))continue;
  days.push(slotsToDay(slots,date));intervals.push(...slotsToIntervals(slots,date));
 }
 days.sort((a,b)=>a.date.localeCompare(b.date));
 // The public 'preset' schedule is a weekly FORECAST, not evidence that a house lost power.
 // Keep it separate from published daily fact data and never feed it into AI as confirmed hours.
 const forecast=raw.preset?.data?.[key]||{};
 for(let i=0;i<7;i++){
  let date=today;for(let j=0;j<i;j++)date=nextDay(date);
  const dow=new Date(date+'T12:00:00Z').getUTCDay()||7;
  const slots=forecast[String(dow)];
  if(!slots||typeof slots!=='object'||!Object.keys(slots).some(x=>/^(?:[1-9]|1\d|2[0-4])$/.test(x)))continue;
  weeklyDays.push(slotsToDay(slots,date));
 }
 const stale=age>8,hasAny=days.length||weeklyDays.length;
 const message=!hasAny?`Для черги ${key.slice(3)} графік не опубліковано.`:stale?`Дані дзеркала застаріли (${Math.round(age)} год). Графік показано лише для довідки.`:days.length?`Черга ${key.slice(3)}: публічні добові дані з дзеркала; прогноз на тиждень — окремо.`:`Черга ${key.slice(3)}: є лише прогноз на тиждень; підтвердженого добового розкладу немає.`;
 return {status:hasAny?(stale?'stale':'mirror'):'unavailable',checkedAt:now.toISOString(),source:'Baskerville42/outage-data-ua (неофіційне дзеркало)',sourceUpdatedAt:new Date(updated).toISOString(),group:key,days,weeklyDays,intervals:stale?[]:intervals,message};
}
async function fetchMirror(group,fetcher=fetch,now=new Date()){
 if(!normalizeGroup(group))throw new Error('Укажи чергу ДТЕК 1.1–6.2');
 const response=await fetcher(MIRROR_URL,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw new Error(`Дзеркало недоступне: HTTP ${response.status}`);
 const contentLength=Number(response.headers?.get?.('content-length')||0);if(contentLength>1_500_000)throw new Error('Надто велика відповідь дзеркала');
 const body=await response.text();if(body.length>1_500_000)throw new Error('Надто великий файл дзеркала');
 return parseMirror(JSON.parse(body),group,now);
}
module.exports={MIRROR_URL,normalizeGroup,parseMirror,fetchMirror};
