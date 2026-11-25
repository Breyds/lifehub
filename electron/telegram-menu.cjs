'use strict';
const {parseCommand}=require('./telegram.cjs');
const {scheduledOccurs,occurs,taskDone,occurrenceKey,progressFor,updateProgress,cleanTask}=require('./logic.cjs');
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
module.exports={handleMessage,handleCallback,powerText,agenda,keyboard,nextDate};
