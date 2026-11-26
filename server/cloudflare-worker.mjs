// LifeHub Cloudflare Worker — single-user, compatible with desktop 0.9.2.
// Paste the entire file into the Worker editor. Requires DB binding and three secrets.
// Shared task/menu/sync helpers derived from the corresponding desktop modules.

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
function assertScheduledDate(x,previous=''){if(x===previous)return;if(!validPlanningDate(x))throw new Error('Дата має бути у межах 2000–2100 років');if(!validScheduledDate(x))throw new Error('Для нового плану обери сьогодні або майбутню дату. Минулі дати можна переглянути й перенести.');}
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



function validToken(x){return typeof x==='string'&&/^\d{5,20}:[A-Za-z0-9_-]{30,}$/.test(x.trim());}
async function telegramRequest(token,method,payload={},fetcher=fetch){
 if(!validToken(token))throw new Error('Некоректний токен Telegram-бота.');
 const response=await fetcher(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.ok)throw new Error(`Telegram: ${String(result?.description||'запит відхилено').slice(0,140)}`);
 return result.result;
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



const PAGE=6;
function nextDate(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
const keyboard={keyboard:[[{text:'📅 Сьогодні'},{text:'📆 Завтра'}],[{text:'⚡ Світло'},{text:'💪 Тренування'}],[{text:'📊 Прогрес'},{text:'🔥 Важливе'}],[{text:'➕ Додати справу'},{text:'ℹ️ Допомога'}]],resize_keyboard:true,is_persistent:true};
const help='LifeHub · особистий бот\n📅 Сьогодні / 📆 Завтра — справи з кнопками\n⚡ Світло — графік на сьогодні\n💪 Тренування — вправи з плану\n📊 Прогрес — виконання за день\n🔥 Важливе — пріоритетні справи\n/add 19:00 Назва — додати сьогодні\n/addtomorrow 19:00 Назва — додати завтра\nУ списку: виконати, повернути, деталі, перенести одноразову справу на завтра або видалити з підтвердженням.';
const buttons={'📅 Сьогодні':'/today','📆 Завтра':'/tomorrow','⚡ Світло':'/power','💪 Тренування':'/workout','📊 Прогрес':'/progress','🔥 Важливе':'/important','➕ Додати справу':'/addhelp','ℹ️ Допомога':'/help'};
function list(tasks,date,today){return tasks.filter(t=>date===today?occurs(t,date):scheduledOccurs(t,date)).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||String(a.id).localeCompare(String(b.id)));}
const dateCode=d=>d.replaceAll('-','');
const decodeDate=s=>s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);
const idOK=id=>/^[A-Za-z0-9_-]{1,40}$/.test(String(id));
const cb=(a,d,id)=>a+'|'+dateCode(d)+'|'+id;
const action=(text,a,d,id)=>({text,callback_data:cb(a,d,id)});
function response(text,markup=keyboard,changed=false){return {text,reply_markup:markup,changed};}
function agenda(db,date,today,page=0,kind='all'){
 let rows=list(db.tasks,date,today);if(kind==='workout')rows=rows.filter(t=>t.category==='sport'&&t.note?.includes('[FitnessStudio]')&&!t.title.startsWith('Контроль ваги'));if(kind==='important')rows=rows.filter(t=>['urgent','critical','high'].includes(t.priority));
 const max=Math.max(0,Math.ceil(rows.length/PAGE)-1);page=Math.min(Math.max(0,Number(page)||0),max);const shown=rows.slice(page*PAGE,(page+1)*PAGE),prefix=kind==='workout'?'💪 Тренування':kind==='important'?'🔥 Важливі справи':'📅 Справи';
 if(!shown.length)return response(prefix+' · '+date+'\nНічого не заплановано.');
 const text=[prefix+' · '+date+' · '+(page+1)+'/'+(max+1)],keys=[];
 for(const [i,t] of shown.entries()){const n=page*PAGE+i+1;text.push(n+'. '+(taskDone(t,date)?'✅':'▫️')+' '+(t.time||'Увесь день')+' · '+t.title);if(kind==='workout'&&t.note)text.push(t.note.replace('[FitnessStudio]','').slice(0,500));if(idOK(t.id))keys.push([action((taskDone(t,date)?'↩ ':'✅ ')+n,taskDone(t,date)?'u':'d',date,t.id),action('ℹ️ '+n,'i',date,t.id),action('🗑 '+n,'x',date,t.id)]);}
 const nav=[];const code=kind==='workout'?'w':kind==='important'?'p':'l';if(page>0)nav.push(action('◀',code,date,page-1));if(page<max)nav.push(action('▶',code,date,page+1));if(nav.length)keys.push(nav);
 return response(text.join('\n').slice(0,3900),{inline_keyboard:keys});
}
function powerText(live,date,now=Date.now()){
 const day=live?.days?.find(d=>d.date===date),forecast=live?.weeklyDays?.find(d=>d.date===date),data=day||forecast;if(!data)return '⚡ '+date+'\nГрафік недоступний. '+String(live?.message||'Онови графік у LifeHub.').slice(0,300);
 const status=day&&live.status==='verified'&&now-Date.parse(live.checkedAt)<6*3600000?'Підтверджений добовий графік':!day?'Тижневий прогноз (не підтверджено)':live.status==='stale'||now-Date.parse(live.checkedAt)>=6*3600000?'Застарілі дані (довідково)':'Неофіційні добові дані (не підтверджено)';
 const groups=[];for(const slot of data.slots||[]){const prev=groups.at(-1);if(prev&&prev.status===slot.status&&prev.end===slot.start)prev.end=slot.end;else groups.push({...slot});}
 const names={on:'🟢 За графіком є',off:'🔴 Відключення за графіком',possible:'🟡 Можливе відключення',unknown:'⚪ Невідомо'};
 return ['⚡ Світло · '+date,status,'Черга: '+(live.group||'невідома'),...groups.map(s=>s.start+'–'+s.end+' · '+(names[s.status]||names.unknown)),'Джерело: '+String(!day&&live.forecastSource?live.forecastSource:live.source||'невідоме'),'Оновлено: '+String(live.sourceUpdatedAt||live.checkedAt||'невідомо')].join('\n');
}
function setDone(t,date,value){const key=occurrenceKey(t,date);if(t.progressType==='counter'||t.progressType==='minutes'){if(value&&!taskDone(t,date))updateProgress(t,date,Number(t.target||1)-progressFor(t,date));if(!value&&taskDone(t,date))updateProgress(t,date,-progressFor(t,date));}else{t.completions=t.completions.filter(k=>k!==key);if(value)t.completions.push(key);}}
function handleCallback(db,data,today){const match=String(data||'').match(/^([lwpduixcm])\|(\d{8})\|([A-Za-z0-9_-]{1,40})$/);if(!match)return response('Невідома кнопка.');const [,op,raw,id]=match,date=decodeDate(raw);if(date!==today&&date!==nextDate(today))return response('Цей список застарів. Відкрий Сьогодні або Завтра.');
 if(['l','w','p'].includes(op))return agenda(db,date,today,Number(id),op==='w'?'workout':op==='p'?'important':'all');
 const t=db.tasks.find(t=>t.id===id);if(!t||!(date===today?occurs(t,date):scheduledOccurs(t,date)))return response('Ця справа вже змінена або видалена. Відкрий актуальний список.');
 if(op==='i'){const keys=[[action(taskDone(t,date)?'↩ Повернути':'✅ Виконано',taskDone(t,date)?'u':'d',date,id),action('🗑 Видалити','x',date,id)]];if(t.recurrence==='none'&&date===today&&!taskDone(t,date))keys.push([action('➡ Перенести на завтра','m',date,id)]);keys.push([action('◀ До списку','l',date,0)]);return response([t.title,date+' · '+(t.time||'Увесь день'),t.note||'Нотаток немає',t.durationMin?t.durationMin+' хв':'',t.recurrence==='none'?'Одноразова':'Повторювана'].filter(Boolean).join('\n'),{inline_keyboard:keys});}
 if(op==='x')return response('Видалити «'+t.title+'»? '+(t.recurrence==='none'?'Дію не можна скасувати.':'Буде видалено всю повторювану серію, не лише цей день.'),{inline_keyboard:[[action('Так, видалити','c',date,id),action('Скасувати','l',date,0)]]});
 if(op==='c'){db.tasks=db.tasks.filter(x=>x.id!==id);return response('🗑 Видалено: '+t.title,keyboard,true);}
 if(op==='m'){if(t.recurrence!=='none'||date!==today||taskDone(t,date)||progressFor(t,date)>0)return response('Перенесення доступне тільки для невиконаної одноразової справи без записаного прогресу.');t.dueDate=nextDate(today);return response('➡ Перенесено на '+t.dueDate+': '+t.title,keyboard,true);}
 setDone(t,date,op==='d');return response((op==='d'?'✅ Виконано: ':'↩ Повернуто: ')+t.title,keyboard,true);
}
function handleMessage(db,raw,today){const text=buttons[String(raw||'').trim()]||String(raw||'').trim(),cmd=parseCommand(text),tomorrow=nextDate(today);
 if(/^\/power(?:@\w+)?$/i.test(text))return response(powerText(db.powerLive,today));
 if(/^\/workout(?:@\w+)?$/i.test(text))return agenda(db,today,today,0,'workout');
 if(/^\/important(?:@\w+)?$/i.test(text))return agenda(db,today,today,0,'important');
 if(/^\/progress(?:@\w+)?$/i.test(text)){const rows=list(db.tasks,today,today),ok=rows.filter(t=>taskDone(t,today)).length;return response('📊 Сьогодні: '+ok+'/'+rows.length+' виконано ('+(rows.length?Math.round(ok*100/rows.length):0)+'%).\nЗалишилось: '+(rows.length-ok));}
 if(/^\/addhelp$/i.test(text))return response('Додати справу:\n/add 19:00 Назва — сьогодні\n/addtomorrow 19:00 Назва — завтра');
 const add=text.match(/^\/addtomorrow(?:@\w+)?\s+([01]\d|2[0-3]):([0-5]\d)\s+(.{1,120})$/i);
 if(add||cmd.action==='add'){const task=cleanTask({title:add?add[3]:cmd.title,dueDate:add?tomorrow:today,time:add?add[1]+':'+add[2]:cmd.time,category:'personal',recurrence:'none',note:'Додано через Telegram LifeHub'});db.tasks.push(task);return response('✅ Створено: '+task.title+' · '+task.dueDate+' '+task.time,keyboard,true);}
 if(cmd.action==='today'||cmd.action==='tomorrow')return agenda(db,cmd.action==='today'?today:tomorrow,today);
 if(cmd.action==='done')return response('Для безпечного вибору справи відкрий /today або /tomorrow та натисни ✅ біля потрібної справи.');
 return response(help);
}




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
function differences(before,after){const a=new Map(before.map(t=>[t.id,t])),b=new Map(after.map(t=>[t.id,t]));return [...new Set([...a.keys(),...b.keys()])].flatMap(id=>{const old=a.get(id)||null,next=b.get(id)||null;return stable(old)===stable(next)?[]:[{id:crypto.randomUUID(),taskId:id,before:copy(old),after:copy(next)}];});}

const kyivDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
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

// Public third-party snapshot of DTEK queue schedules. No address→queue lookup.
// Used only after the user confirms their queue or DTEK has established it.

const MIRROR_URL='https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/kyiv-region.json';
function normalizeGroup(raw){const value=String(raw||'').trim().replace(/^GPV/i,'');return /^[1-6]\.[12]$/.test(value)?`GPV${value}`:'';}
function isoKyiv(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function mirrorNextDay(s){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
function parseMirror(raw,group,now=new Date()){
 const key=normalizeGroup(group);if(!key)throw new Error('Для резервного джерела потрібно обрати свою чергу ДТЕК');
 if(!raw||raw.regionId!=='kyiv-region'||!raw.fact||typeof raw.fact.data!=='object')throw new Error('Некоректні дані дзеркала');
 const updated=Date.parse(raw.lastUpdated||'');if(!Number.isFinite(updated)||updated>now.getTime()+3600000)throw new Error('Невірна дата оновлення дзеркала');
 const age=(now.getTime()-updated)/3600000;const today=isoKyiv(now),tomorrow=mirrorNextDay(today);
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
  let date=today;for(let j=0;j<i;j++)date=mirrorNextDay(date);
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


function safePower(raw){if(!raw||typeof raw!=='object')return {};const slot=s=>s&&/^\d{2}:\d{2}$/.test(s.start)&&/^\d{2}:\d{2}$/.test(s.end)&&['on','off','possible','unknown'].includes(s.status);const days=a=>(Array.isArray(a)?a:[]).slice(0,7).filter(d=>d&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)).map(d=>({date:d.date,slots:(Array.isArray(d.slots)?d.slots:[]).filter(slot).slice(0,48).map(s=>({start:s.start,end:s.end,status:s.status}))}));return {status:String(raw.status||'').slice(0,30),checkedAt:String(raw.checkedAt||'').slice(0,40),source:String(raw.source||'').slice(0,250),sourceUpdatedAt:String(raw.sourceUpdatedAt||'').slice(0,40),forecastSource:String(raw.forecastSource||'').slice(0,250),group:normalizeGroup(raw.group),message:String(raw.message||'').slice(0,300),days:days(raw.days),weeklyDays:days(raw.weeklyDays)};}


const MAX_STATE=1_500_000,MAX_PENDING=1000,MAX_OUTBOX=40;
const initialState=()=>({active:false,enabled:false,tasks:[],pending:[],offset:0,notified:[],eveningShown:[],powerLive:{},powerGroup:'',lastSync:'',activatedAt:0,outbox:[]});
const SCHEMA="CREATE TABLE IF NOT EXISTS lifehub_state (id INTEGER PRIMARY KEY CHECK(id=1), rev INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, lease TEXT NOT NULL DEFAULT '', lease_until INTEGER NOT NULL DEFAULT 0)";
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const reply=(status,data)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
const byteLength=s=>new TextEncoder().encode(s).length;
function config(env){const token=String(env.TELEGRAM_BOT_TOKEN||'').trim(),chat=String(env.TELEGRAM_CHAT_ID||'').trim(),key=String(env.LIFEHUB_SYNC_KEY||'');if(!env.DB||!validToken(token)||!/^\d{1,20}$/.test(chat)||key.length<32||key.length>256)throw new HttpError(503,'Set DB and three secrets');return {token,chat,key};}
async function authenticated(req,key){const hash=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));const [a,b]=await Promise.all([hash(req.headers.get('authorization')||''),hash('Bearer '+key)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
async function readBody(req){const length=Number(req.headers.get('content-length')||0);if(length>MAX_STATE)throw new HttpError(413,'Payload too large');if(!req.body)throw new HttpError(400,'Missing JSON');const reader=req.body.getReader(),parts=[];let total=0;try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_STATE){await reader.cancel();throw new HttpError(413,'Payload too large');}parts.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(total);let at=0;for(const p of parts){bytes.set(p,at);at+=p.byteLength;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'Invalid JSON');}}
async function init(db){await db.prepare(SCHEMA).run();await db.prepare("INSERT OR IGNORE INTO lifehub_state(id,rev,data) VALUES(1,0,?)").bind(JSON.stringify(initialState())).run();}
async function read(db){const row=await db.prepare("SELECT rev,data,lease,lease_until FROM lifehub_state WHERE id=1").first();if(!row)throw new HttpError(503,'Open LifeHub and connect first');return {...row,state:{...initialState(),...JSON.parse(row.data)}};}
async function change(db,fn,lease=''){for(let i=0;i<4;i++){const row=await read(db);if(lease&&(row.lease!==lease||Number(row.lease_until)<Date.now()))throw new HttpError(409,'Cron lease expired');const result=fn(row.state);if(result?.skip)return result.value;const payload=JSON.stringify(row.state);if(byteLength(payload)>MAX_STATE)throw new HttpError(413,'State exceeds safe D1 row limit');const r=lease?await db.prepare("UPDATE lifehub_state SET data=?,rev=rev+1 WHERE id=1 AND rev=? AND lease=? AND lease_until>=?").bind(payload,row.rev,lease,Date.now()).run():await db.prepare("UPDATE lifehub_state SET data=?,rev=rev+1 WHERE id=1 AND rev=?").bind(payload,row.rev).run();if(r.meta?.changes===1)return result?.value;}throw new HttpError(409,'Concurrent change; retry');}
function applySync(state,data,now=Date.now()){const tasks=cleanTasks(data.tasks),ack=new Set(Array.isArray(data.ack)?data.ack.slice(0,MAX_PENDING).filter(x=>typeof x==='string'):[]);state.pending=state.pending.filter(p=>!ack.has(p.id));if(!state.pending.length){if(!state.active)state.activatedAt=Math.floor(now/1000);state.tasks=tasks;state.powerLive=safePower(data.powerLive);state.powerGroup=normalizeGroup(data.powerGroup);state.lastSync=new Date(now).toISOString();state.active=true;state.enabled=data.enabled===true;state.taskReminders=data.taskReminders!==false;state.privateNotificationText=data.privateNotificationText===true;state.evening=data.evening===true;state.notified=[...new Set([...state.notified,...(Array.isArray(data.notified)?data.notified.filter(x=>typeof x==='string'&&x.length<160):[])])].slice(-4000);if(!state.enabled)state.outbox=[];}return {pending:state.pending,lastSync:state.lastSync};}
function kyivTime(now=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));return {date:p.year+'-'+p.month+'-'+p.day,clock:p.hour+':'+p.minute};}
function enqueue(state,id,text,markup=keyboard){if(state.outbox.length>=MAX_OUTBOX)return false;if(state.outbox.some(x=>x.id===id))return true;state.outbox.push({id,text:String(text).slice(0,3900),markup});return true;}
function processUpdate(state,item,chat,today,power=null){if(!state.active||!state.enabled)return {skip:true,value:false};if(!Number.isSafeInteger(item?.update_id)||item.update_id<state.offset)return {skip:true,value:false};const cb=item.callback_query,msg=item.message||cb?.message;const accepted=msg?.chat?.type==='private'&&String(msg.chat.id)===chat&&(!cb||String(cb.from?.id)===chat);if(!accepted||(!cb&&Number(msg.date||0)<state.activatedAt)){state.offset=item.update_id+1;return {value:false};}if(state.outbox.length>=MAX_OUTBOX)return {skip:true,value:false};
 if(power)state.powerLive=power;
 const before=copy(state.tasks);const result=cb?handleCallback(state,cb.data,today):handleMessage(state,msg.text,today);
 if(result.changed){const delta=differences(before,state.tasks);if(state.pending.length+delta.length>MAX_PENDING||state.tasks.length>5000){state.tasks=before;result.text='Ліміт несинхронізованих змін. Відкрий LifeHub на ПК.';}else state.pending.push(...delta);}
 state.offset=item.update_id+1;enqueue(state,'update:'+item.update_id,result.text,result.reply_markup);return {value:true};}
function queueReminders(state,now=new Date()){if(!state.active||!state.enabled)return {skip:true,value:0};const {date,clock}=kyivTime(now);let added=0;const seen=new Set(state.notified);
 if(state.taskReminders)for(const t of state.tasks){if(added>=6||state.outbox.length>=MAX_OUTBOX)break;const id=t.id+'|'+date+'|'+t.time;if(t.time&&t.time<=clock&&occurs(t,date)&&!taskDone(t,date)&&!seen.has(id)){const message=state.privateNotificationText?'🔔 LifeHub: є запланована справа.':'🔔 '+t.title+' ('+t.time+')';if(enqueue(state,'reminder:'+id,message)){state.notified.push(id);seen.add(id);added++;}}}
 if(state.evening&&clock>='21:00'&&!state.eveningShown.includes(date)&&enqueue(state,'evening:'+date,'🌙 LifeHub: перевір виконані справи й заплануй завтра.')){state.eveningShown.push(date);added++;}
 state.notified=state.notified.slice(-4000);state.eveningShown=state.eveningShown.slice(-90);return added?{value:added}:{skip:true,value:0};}
async function tick(env){const {token,chat}=config(env),db=env.DB,lease=crypto.randomUUID(),now=Date.now();let locked=false;
 try{
  // The first authenticated /health creates the table. Cron before pairing is harmless.
  const lock=await db.prepare("UPDATE lifehub_state SET lease=?,lease_until=? WHERE id=1 AND lease_until<=?").bind(lease,now+110000,now).run();locked=lock.meta?.changes===1;if(!locked)return;
  let row=await read(db);if(!row.state.active||!row.state.enabled)return;
  // Pull a small batch once per minute. No public Telegram webhook or additional secret required.
  let updates=[];try{updates=await telegramRequest(token,'getUpdates',{offset:row.state.offset,limit:4,timeout:0,allowed_updates:['message','callback_query']});}catch{console.warn('LifeHub Telegram polling failed');}
  for(const item of (Array.isArray(updates)?updates:[]).slice(0,4)){
   if(Date.now()-now>55000)break;
   row=await read(db);if(!row.state.active||!row.state.enabled)break;
   let power=null;const msg=item.message;
   if(msg?.chat?.type==='private'&&String(msg.chat.id)===chat&&/^(?:\/power(?:@\w+)?|⚡ Світло)$/i.test(String(msg.text||'').trim())&&row.state.powerGroup){
    const old=row.state.powerLive,date=kyivTime().date;
    if(!(old.status==='verified'&&old.days?.some(d=>d.date===date)&&Date.now()-Date.parse(old.checkedAt)<6*3600000)){
     // Mirror is public and unconfirmed. Keep the last synced schedule if unavailable.
     power=await fetchMirror(row.state.powerGroup).catch(()=>null);
    }
   }
   const accepted=await change(db,s=>processUpdate(s,item,chat,kyivTime().date,power),lease);
   if(accepted&&item.callback_query?.id)await telegramRequest(token,'answerCallbackQuery',{callback_query_id:item.callback_query.id}).catch(()=>{});
  }
  await change(db,s=>queueReminders(s),lease);
  // An outbox survives restarts. Telegram sendMessage is not exactly-once: an interrupted
  // delivery after Telegram accepted it but before D1 recorded it may be repeated.
  for(let i=0;i<6&&Date.now()-now<65000;i++){
   row=await read(db);if(!row.state.active||!row.state.enabled||row.lease!==lease||row.lease_until<Date.now())break;
   const item=row.state.outbox[0];if(!item)break;
   try{await telegramRequest(token,'sendMessage',{chat_id:chat,text:item.text,reply_markup:item.markup});}
   catch{console.warn('LifeHub Telegram delivery failed');break;}
   await change(db,s=>{s.outbox=s.outbox.filter(x=>x.id!==item.id);return {value:true};},lease);
  }
 }catch{console.warn('LifeHub cron not ready or failed; retry next minute');}
 finally{if(locked)await db.prepare("UPDATE lifehub_state SET lease='',lease_until=0 WHERE id=1 AND lease=?").bind(lease).run().catch(()=>{});}
}
async function handle(req,env){try{const url=new URL(req.url);if(req.method==='GET'&&url.pathname==='/')return reply(200,{ok:true,service:'LifeHub Telegram Cloudflare',protocol:1});if(req.method!=='POST'||!['/health','/sync','/stop'].includes(url.pathname))return reply(404,{ok:false,error:'Not found'});
 const {token,chat,key}=config(env);if(!await authenticated(req,key))return reply(401,{ok:false,error:'Unauthorized'});const data=await readBody(req);if(String(data?.chatId||'')!==chat)return reply(403,{ok:false,error:'Wrong chat'});
 if(url.pathname==='/health'){await init(env.DB);const row=await read(env.DB);return reply(200,{ok:true,botId:token.split(':')[0],chatId:chat,active:row.state.active});}
 if(url.pathname==='/stop'){await change(env.DB,s=>{if(s.pending.length)throw new HttpError(409,'Unsynced changes');s.active=false;s.enabled=false;s.outbox=[];return {value:true};});return reply(200,{ok:true});}
 const result=await change(env.DB,s=>({value:applySync(s,data)}));return reply(200,{ok:true,...result});
 }catch(e){const status=e instanceof HttpError?e.status:400;return reply(status,{ok:false,error:e instanceof HttpError?e.message:'Invalid request or database unavailable'});}}
export default {fetch:handle,scheduled:(_event,env,ctx)=>ctx.waitUntil(tick(env))};
export {initialState,applySync,processUpdate,queueReminders,kyivTime,handle,change,SCHEMA};
