'use strict';
// Experimental, user-initiated read of DTEK's publicly displayed schedule.
// Never infer an outage from a blank or unknown timetable. Don't bypass site protections.
const {cleanPowerAddress}=require('./power-address.cjs');
const DTEK_URL='https://www.dtek-krem.com.ua/ua/shutdowns';
const clock=()=>new Date().toISOString();
function validateIntervals(raw){
 const unique=new Set(); const out=[];
 for(const value of raw||[]){
  const date=String(value.date||'');const start=String(value.start||'');const end=String(value.end||'');
  if(!/^20\d\d-\d\d-\d\d$/.test(date)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(end)||end<=start)continue;
  const key=date+'|'+start+'|'+end;if(unique.has(key))continue;unique.add(key);
  out.push({date,start,end,status:'outage'});
 }
 return out.sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).slice(0,84);
}
function mapDtekResponse(raw,source='dtek-krem.com.ua'){
 const input=raw&&typeof raw==='object'?raw:{};
 const intervals=validateIntervals(input.intervals);
 const checkedAt=clock();
 return {status:intervals.length?'verified':'unavailable',checkedAt,source,intervals,message:String(input.message||(intervals.length?`Знайдено ${intervals.length} підтверджених періодів відключення.`:'Не вдалося підтвердити години графіка ДТЕК. Не використовуй його для автоматичного планування.')).slice(0,250)};
}
// Parse the documented public /ua/ajax response by exact house and DTEK group.
// Statuses 'maybe', 'mfirst', 'msecond' are NOT considered confirmed outages.
function normAddress(s){return String(s||'').toLocaleLowerCase('uk-UA').replace(/\s+/g,'').replace(/[’']/g,'').replace(/а/g,'a').replace(/в/g,'b').replace(/е/g,'e').replace(/і/g,'i');}
function localDate(unix){const ms=Number(unix)*1000;if(!Number.isFinite(ms)||ms<1500000000000||ms>2200000000000)return '';const date=new Date(ms);if(Number.isNaN(date.valueOf()))return '';const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const get=t=>p.find(x=>x.type===t)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`;}
function slotsToIntervals(slots,date){
 if(!slots||typeof slots!=='object')return [];
 const half=[];
 for(let hour=1;hour<=24;hour++){
  const status=String(slots[String(hour)]||'').toLowerCase();
  if(!['no','first','second'].includes(status))continue;
  const h=(hour-1)*2;
  if(status==='no'||status==='first')half.push(h);
  if(status==='no'||status==='second')half.push(h+1);
 }
 if(!half.length)return [];
 half.sort((a,b)=>a-b);
 const intervals=[],fmt=n=>`${String(Math.floor(n/2)).padStart(2,'0')}:${n%2?'30':'00'}`;
 let a=half[0],b=a;
 for(const x of [...half.slice(1),-1]){if(x===b+1){b=x;continue;}intervals.push({date,start:fmt(a),end:fmt(b+1)});a=x;b=x;}
 return intervals;
}
function extractFactResponse(data,house){
 if(!data||typeof data!=='object'||data.result!==true)return {message:'ДТЕК не повернув коректну відповідь про адресу.',intervals:[]};
 const homes=data.data||{},matched=Object.keys(homes).find(k=>normAddress(k)===normAddress(house));
 if(!matched)return {message:'ДТЕК не знайшов номер будинку. Перевір назву вулиці та номер.',intervals:[]};
 const groups=homes[matched]?.sub_type_reason;
 const ids=[...new Set(Array.isArray(groups)?groups:typeof groups==='string'?[groups]:[])].filter(x=>/^GPV\d+\.\d+$/.test(x));
 if(ids.length!==1)return {message:ids.length?'Будинок має кілька груп відключень — потрібне уточнення.':'ДТЕК не повернув чергу відключень цього будинку.',intervals:[]};
 const fact=data.fact?.data||{};
 if(data.showTableFact===false||data.showTableSchedule===false)return {message:'ДТЕК поки не опублікував підтверджений графік для цієї адреси.',intervals:[]};
 const entries=[];
 for(const [day,groupsForDay] of Object.entries(fact)){
  const date=localDate(day);if(!date)continue;
  const slots=groupsForDay?.[ids[0]];
  entries.push(...slotsToIntervals(slots,date));
 }
 if(!entries.length)return {message:'Підтверджені години відключення не опубліковані або не знайдені. Це НЕ означає, що світло буде весь день.',intervals:[]};
 return {message:`ДТЕК: черга ${ids[0].replace('GPV','')}, отримано підтверджені інтервали на ${new Set(entries.map(x=>x.date)).size} дн.`,intervals:entries};
}
// The page is read in a sandboxed browser window. The official site may change markup or block automation.
async function readDtekSchedule(BrowserWindow,address,options={}){
 const clean=cleanPowerAddress(address);
 if(!clean.settlement||!clean.street||!clean.house)throw new Error('Спочатку введи й збережи населений пункт, вулицю та будинок.');
 const win=new BrowserWindow({show:false,width:1024,height:800,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true,partition:'dtek-public-schedule'}});
 const timeout=options.timeoutMs||36000;
 try{
  const loaded=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Сайт ДТЕК не відповідає. Спробуй повторити пізніше.')),timeout);
   win.webContents.once('did-finish-load',()=>{clearTimeout(timer);resolve();});
   win.webContents.once('did-fail-load',(_event,_code,reason)=>{clearTimeout(timer);reject(new Error('ДТЕК: '+String(reason).slice(0,100)));});
  });
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(!/^https:\/\/(?:www\.)?dtek-krem\.com\.ua\//.test(url))event.preventDefault();});
  await win.loadURL(DTEK_URL);await loaded;
  let directResult=null;
  try{directResult=await win.webContents.executeJavaScript(`(async()=>{
   const address=${JSON.stringify(clean)};
   const csrf=document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')||'';
   const norm=s=>String(s||'').toLocaleLowerCase('uk-UA').replace(/\\s+/g,' ').trim();
   async function post(fields){
    const params=new URLSearchParams(fields);
    const r=await fetch('/ua/ajax',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest',...(csrf?{'X-CSRF-Token':csrf}:{})},body:params.toString()});
    if(!r.ok)throw new Error('HTTP '+r.status);return r.json();
   }
   const streets=await post({method:'getStreets'});
   const cities=streets?.streets||{};
   const key=Object.keys(cities).find(x=>norm(x)===norm(address.settlement))||Object.keys(cities).find(x=>norm(x).endsWith(' '+norm(address.settlement))||norm(x).endsWith('. '+norm(address.settlement)))||address.settlement;
   const cityStreets=cities[key];
   const street=Array.isArray(cityStreets)?(cityStreets.find(x=>norm(x)===norm(address.street))||cityStreets.find(x=>norm(x).endsWith(' '+norm(address.street)))||address.street):address.street;
   return await post({method:'getHomeNum','data[0][name]':'city','data[0][value]':key,'data[1][name]':'street','data[1][value]':street,'data[2][name]':'updateFact','data[2][value]':'01.01.2000 00:00'});
  })()`,true);}catch{directResult=null;}
  if(directResult?.result===true){const parsed=extractFactResponse(directResult,clean.house);return mapDtekResponse(parsed);}
  const result=await win.webContents.executeJavaScript(`(async()=>{
   const addr=${JSON.stringify(clean)};
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const visible=el=>el instanceof HTMLElement && el.getClientRects().length>0;
   const norm=s=>String(s||'').toLocaleLowerCase('uk-UA').replace(/[.,]/g,'').replace(/\\s+/g,' ').trim();
   const inputs=()=>[...document.querySelectorAll('input')].filter(visible);
   const change=(node,value)=>{if(!node)return false; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));node.focus();return true;};
   async function choose(input,value){
    if(!change(input,value))return false; await wait(900);
    const candidates=[...document.querySelectorAll('[role=option],.ui-menu-item,.autocomplete-suggestion,.dropdown-item,li')].filter(visible).filter(el=>{const text=norm(el.textContent);return text===norm(value)||text.endsWith(' '+norm(value))||text.includes(norm(value));});
    if(candidates.length){candidates[0].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));candidates[0].click();await wait(450);}else {input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(400);}
    return true;
   }
   const all=inputs();const autos=all.filter(x=>/почніть|населен|вулиц|settlement|street|city|адрес|start typing/i.test((x.placeholder||'')+' '+(x.getAttribute('aria-label')||'')));
   const house=all.find(x=>/номер будин|будинок|house/i.test((x.placeholder||'')+' '+(x.getAttribute('aria-label')||'')))||all[all.length-1];
   if(autos.length<2||!house)return {message:'Сайт ДТЕК змінив форму пошуку: поля адреси не знайдені.',intervals:[]};
   await choose(autos[0],addr.settlement);
   await choose(autos[1],addr.street);
   change(house,addr.house); house.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
   const button=[...document.querySelectorAll('button')].find(x=>visible(x)&&/показати|перевірити графік|знайти/i.test(x.textContent||''));if(button)button.click();
   await wait(2200);
   // Only explicit text intervals marked as OFF can be imported. Ambiguous chart colors are never guessed.
   const intervals=[];
   // No guessed date is used to confirm an outage interval.
   const lines=(document.body?.innerText||'').split('\\n').map(x=>x.trim()).filter(Boolean);
   const dates=[...document.querySelectorAll('[data-date]')].map(x=>x.getAttribute('data-date')).filter(x=>/^20\\d\\d-\\d\\d-\\d\\d$/.test(x||''));
   for(const line of lines){if(!dates.length)break;if(!/відключен|без світла|power outage|немає світла/i.test(line))continue;
    const times=[...line.matchAll(/([01]\\d|2[0-3]):([0-5]\\d)\\s*[-–—]\\s*([01]\\d|2[0-3]):([0-5]\\d)/g)];
    for(const m of times)intervals.push({date:dates[0],start:m[1]+':'+m[2],end:m[3]+':'+m[4]});
   }
   return {message:intervals.length?'Відключення прочитано з видимого тексту. Перевір відповідність дат на сайті.':'ДТЕК відкрився, але не вдалося однозначно зчитати погодинний графік. Можлива зміна сайту або захист від автоматичних запитів.',intervals};
  })()`,true);
  return mapDtekResponse(result);
 }catch(error){return mapDtekResponse({message:String(error?.message||error).slice(0,200),intervals:[]});}
 finally{if(!win.isDestroyed())win.close();}
}
module.exports={DTEK_URL,validateIntervals,mapDtekResponse,slotsToIntervals,extractFactResponse,localDate,readDtekSchedule};
