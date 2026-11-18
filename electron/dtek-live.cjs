'use strict';
// DTEK's public address lookup is an undocumented AJAX interface. Treat all remote
// data as untrusted. Never guess power status from an unavailable response.
const {cleanPowerAddress}=require('./power-address.cjs');
const DTEK_URL='https://www.dtek-krem.com.ua/ua/shutdowns';
const AJAX_URL='https://www.dtek-krem.com.ua/ua/ajax';
const timestamp=()=>new Date().toISOString();
const kyivDate=(date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const nextDate=(date)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};
const norm=s=>String(s||'').toLocaleLowerCase('uk-UA').replace(/[\s.,'’]+/g,'').replace(/^(?:провулок|вулиця|смт|пров|вул|м|с)/,'');
function validateIntervals(raw){
 const unique=new Set(),out=[];
 for(const value of raw||[]){const date=String(value.date||''),start=String(value.start||''),end=String(value.end||'');
  if(!/^20\d\d-\d\d-\d\d$/.test(date)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(end)||end<=start)continue;
  const key=date+'|'+start+'|'+end;if(unique.has(key))continue;unique.add(key);out.push({date,start,end,status:'outage'});
 }
 return out.sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).slice(0,84);
}
function mapDtekResponse(raw,source='dtek-krem.com.ua'){
 const data=raw&&typeof raw==='object'?raw:{};
 const intervals=validateIntervals(data.intervals),days=Array.isArray(data.days)?data.days:[];
 const verified=intervals.length>0||days.some(d=>d.slots?.some(s=>['on','off','possible'].includes(s.status)));
 return {status:verified?'verified':'unavailable',source,checkedAt:timestamp(),intervals,days:days.slice(0,2),message:String(data.message||(verified?'Години отримані від ДТЕК.':'ДТЕК не повернув підтверджених годин.')).slice(0,300)};
}
function localDate(unix){const ms=Number(unix)*1000;if(!Number.isFinite(ms)||ms<1500000000000||ms>2200000000000)return '';
 try{return kyivDate(new Date(ms));}catch{return '';}}
const halfStatus=(s)=>{
 const x=String(s||'').toLowerCase();
 if(x==='yes')return ['on','on'];if(x==='no')return ['off','off'];
 if(x==='first')return ['off','on'];if(x==='second')return ['on','off'];
 if(x==='maybe')return ['possible','possible'];if(x==='mfirst')return ['possible','unknown'];if(x==='msecond')return ['unknown','possible'];
 return ['unknown','unknown'];
};
function slotsToDay(slots,date){
 const half=[];for(let i=1;i<=24;i++)half.push(...halfStatus(slots?.[String(i)]));
 const fmt=n=>`${String(Math.floor(n/2)).padStart(2,'0')}:${n%2?'30':'00'}`;
 const out=[];for(let i=0;i<48;){let j=i+1;while(j<48&&half[j]===half[i])j++;out.push({start:fmt(i),end:fmt(j),status:half[i]});i=j;}
 return {date,slots:out};
}
function slotsToIntervals(slots,date){const day=slotsToDay(slots,date);return day.slots.filter(s=>s.status==='off').map(s=>({date,start:s.start,end:s.end}));}
function extractFactResponse(data,house,dates){
 if(!data||typeof data!=='object'||data.result!==true)return {message:'ДТЕК не підтвердив відповідь про адресу.',intervals:[],days:[]};
 const homes=data.data||{};const key=Object.keys(homes).find(x=>norm(x)===norm(house));
 if(!key)return {message:'ДТЕК не знайшов цей номер будинку.',intervals:[],days:[]};
 const rawGroups=homes[key]?.sub_type_reason;
 const groups=[...new Set(Array.isArray(rawGroups)?rawGroups:typeof rawGroups==='string'?[rawGroups]:[])].filter(x=>/^GPV\d+\.\d+$/.test(x));
 if(groups.length!==1)return {message:groups.length?'Будинок має кілька груп відключень — потрібне уточнення.':'Чергу для будинку не визначено.',intervals:[],days:[]};
 if(data.showTableFact===false)return {message:'ДТЕК поки не опублікував підтверджений добовий графік.',intervals:[],days:[]};
 const result=[],off=[],fact=data.fact?.data||{};
 const expected=dates||null;
 for(const [stamp,groupsOnDay] of Object.entries(fact)){
  const date=localDate(stamp);if(!date||(expected&&!expected.includes(date)))continue;
  const slots=groupsOnDay?.[groups[0]];if(!slots||typeof slots!=='object')continue;
  const day=slotsToDay(slots,date);result.push(day);off.push(...slotsToIntervals(slots,date));
 }
 result.sort((a,b)=>a.date.localeCompare(b.date));
 return {message:result.length?`ДТЕК: черга ${groups[0].replace('GPV','')}. Отримано добовий графік.`:'ДТЕК не повернув підтверджених годин для сьогодні/завтра.',days:result,intervals:off};
}
function matchingKey(values,name){const keys=Array.isArray(values)?values:Object.keys(values||{});return keys.find(x=>norm(x)===norm(name))||keys.find(x=>norm(x).endsWith(norm(name))||norm(name).endsWith(norm(x)))||'';}
// This is an optional, unofficial integration, not a guaranteed public API.
// Avoid the old hidden BrowserWindow: `ERR_ABORTED` during navigation caused user crashes.
async function readDtekSchedule(_browserWindow,address,options={}){
 const a=cleanPowerAddress(address);
 if(!a.settlement||!a.street||!a.house)return mapDtekResponse({message:'Введи населений пункт, вулицю та будинок.',intervals:[]});
 const fetcher=options.fetcher||fetch;
 try{
  const timeout=options.timeoutMs||14000;
  const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36','Accept':'application/json, text/javascript, */*; q=0.01','Accept-Language':'uk,en;q=0.9','Origin':'https://www.dtek-krem.com.ua','Referer':DTEK_URL,'X-Requested-With':'XMLHttpRequest','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'};
  let warmed=false;
  async function post(params){
   const send=()=>fetcher(AJAX_URL,{method:'POST',headers,body:new URLSearchParams(params),signal:AbortSignal.timeout(timeout)});
   let response=await send();
   // A normal same-origin session may need cookies and CSRF from the public form.
   // Do not attempt to bypass CAPTCHA, WAF, or login challenges.
   if(response.status===403&&!warmed){
    warmed=true;
    try{
     const page=await fetcher(DTEK_URL,{method:'GET',headers:{'User-Agent':headers['User-Agent'],'Accept-Language':'uk,en;q=0.9'},signal:AbortSignal.timeout(timeout)});
     if(page.ok){
      const cookies=typeof page.headers?.getSetCookie==='function'?page.headers.getSetCookie():[];
      const cookie=cookies.map(v=>String(v).split(';')[0]).filter(Boolean).join('; ');
      if(cookie)headers.Cookie=cookie;
      const html=(await page.text()).slice(0,250000);
      const token=html.match(/<meta[^>]+name=[\"']csrf-token[\"'][^>]+content=[\"']([^\"']+)/i)?.[1];
      if(token)headers['X-CSRF-Token']=token;
      response=await send();
     }
    }catch{/* Return original HTTP failure if DTEK rejects a normal session */}
   }
   if(!response.ok)throw new Error(`HTTP ${response.status}`);
   const type=response.headers?.get?.('content-type')||'';
   if(type&&!/json|text\/plain/i.test(type))throw new Error('ДТЕК повернув сторінку замість графіка');
   const json=await response.json();if(!json||json.result!==true)throw new Error('ДТЕК не підтвердив відповідь');return json;}
  const all=await post({method:'getStreets'});
  const city=matchingKey(all.streets,a.settlement);if(!city)throw new Error('Населений пункт не знайдено в ДТЕК');
  const street=matchingKey(all.streets?.[city],a.street);if(!street)throw new Error('Вулицю не знайдено в ДТЕК');
  const data=await post({method:'getHomeNum','data[0][name]':'city','data[0][value]':city,'data[1][name]':'street','data[1][value]':street,'data[2][name]':'updateFact','data[2][value]':new Date().toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'})});
  const today=kyivDate(new Date());return mapDtekResponse(extractFactResponse(data,a.house,[today,nextDate(today)]));
 }catch(e){const message=String(e?.message||e);
  return mapDtekResponse({message:/abort|timed?out/i.test(message)?'З’єднання з ДТЕК перервано. Спробуй оновити пізніше.':`Не вдалося отримати графік: ${message.slice(0,120)}. Сайт може блокувати сторонні запити.`,intervals:[]});}
}
module.exports={DTEK_URL,AJAX_URL,validateIntervals,mapDtekResponse,slotsToIntervals,slotsToDay,extractFactResponse,localDate,readDtekSchedule,matchingKey};
