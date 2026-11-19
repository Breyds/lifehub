import {useMemo,useState} from 'react';
import {CalendarDays,CalendarPlus,Check,CheckCheck,ChevronDown,ChevronRight,Clock3,Edit3,Filter,Flag,FolderKanban,Hourglass,Plus,Repeat2,RotateCcw,Search,Target,Trash2,X} from 'lucide-react';
import type {Category,Priority,Task} from './types';
import './all-tasks.css';

type Scope='active'|'all'|'done';
type Kind='all'|'critical'|'high'|'repeat'|'normal';
type Props={tasks:Task[];onAdd:()=>void;onEdit:(t:Task)=>void;onDelete:(t:Task)=>void;onToggle:(t:Task,date:string)=>void;onMove:(t:Task,date:string)=>void};
type Row={t:Task;date:string;done:boolean;late:boolean;repeat:boolean};
const pad=(x:number)=>String(x).padStart(2,'0');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const addDays=(v:string,n:number)=>{const d=new Date(v+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const dateLabel=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('uk-UA',{weekday:'long',day:'numeric',month:'long'});
const names:Record<Category,string>={personal:'Особисте',rankdaily:'Rank Daily',twitch:'Twitch',cs2:'CS2',sport:'Спорт',study:'Навчання'};
const priorities:Record<Priority,string>={urgent:'Критичне',critical:'Дуже важливе',high:'Важливе',normal:'Звичайне',low:'Спокійне'};
const weight:Record<Priority,number>={urgent:0,critical:1,high:2,normal:3,low:4};
const repeatNames:Record<string,string>={daily:'Щодня',weekdays:'У будні',weekly:'Щотижня'};
function nextOccurrence(t:Task,now:string){
 if(t.recurrence==='none')return t.dueDate;
 const base=t.dueDate>now?t.dueDate:now;
 for(let i=0;i<15;i++){const day=addDays(base,i);const delta=Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(t.dueDate+'T12:00:00Z'))/86400000);
  if(t.recurrence==='daily'||t.recurrence==='weekdays'&&![0,6].includes(new Date(day+'T12:00:00').getDay())||t.recurrence==='weekly'&&delta>=0&&delta%7===0)return day;
 }return base;
}
function done(t:Task,date:string){const key=t.recurrence==='none'?t.dueDate:date;return (t.completions||[]).includes(key)||(['counter','minutes'].includes(t.progressType||'')&&Number(t.progress?.[key]||0)>=Number(t.target||1));}
function groupOf(r:Row,now:string,tomorrow:string){if(r.repeat)return 'repeat';if(r.done)return 'done';if(r.late)return 'late';if(r.date===now)return 'today';if(r.date===tomorrow)return 'tomorrow';return 'day:'+r.date;}
function meta(key:string){if(key==='late')return ['Потребують уваги','Прострочені — можна перенести одним натисканням','late'];if(key==='today')return ['Сьогодні','Справи на поточний день','today'];if(key==='tomorrow')return ['Завтра','Наступний день','future'];if(key==='repeat')return ['Повторювані','Показуються один раз, без копій на кожну дату','repeat'];if(key==='done')return ['Виконані','Історія завершених справ','done'];return [dateLabel(key.slice(4)),'Заплановані справи','future'];}
export function AllTasksPage({tasks,onAdd,onEdit,onDelete,onToggle,onMove}:Props){
 const [scope,setScope]=useState<Scope>('active');const [kind,setKind]=useState<Kind>('all');const [category,setCategory]=useState<Category|'all'>('all');const [query,setQuery]=useState('');const [sort,setSort]=useState<'date'|'priority'>('date');const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});const [limit,setLimit]=useState(80);const [showFilters,setShowFilters]=useState(true);
 const now=today(),tomorrow=addDays(now,1);
 const rows=useMemo<Row[]>(()=>tasks.map(t=>{const repeat=t.recurrence!=='none',date=nextOccurrence(t,now);return {t,date,repeat,done:done(t,repeat&&date!==now?now:date),late:!repeat&&t.dueDate<now&&!done(t,t.dueDate)};}),[tasks,now]);
 const metrics={active:rows.filter(r=>!r.done).length,now:rows.filter(r=>r.date===now||r.late).length,late:rows.filter(r=>r.late).length,completed:rows.filter(r=>r.done).length};
 const filtered=useMemo(()=>rows.filter(r=>{const p=r.t.priority||'normal',q=query.trim().toLocaleLowerCase('uk-UA');
  return !(scope==='active'&&r.done||scope==='done'&&!r.done)
  &&(kind==='all'||kind==='critical'&&['urgent','critical'].includes(p)||kind==='high'&&p==='high'||kind==='normal'&&['normal','low'].includes(p)||kind==='repeat'&&r.repeat)
  &&(category==='all'||category===r.t.category)
  &&(!q||[r.t.title,r.t.note||'',names[r.t.category],r.date].join(' ').toLocaleLowerCase('uk-UA').includes(q));
 }).sort((a,b)=>sort==='date'?a.date.localeCompare(b.date)||weight[a.t.priority||'normal']-weight[b.t.priority||'normal']:weight[a.t.priority||'normal']-weight[b.t.priority||'normal']||a.date.localeCompare(b.date)),[rows,scope,kind,category,query,sort]);
 const groups=useMemo(()=>{const m=new Map<string,Row[]>();filtered.forEach(r=>{const key=groupOf(r,now,tomorrow);m.set(key,[...(m.get(key)||[]),r]);});const order=(k:string)=>k==='late'?'0':k==='today'?'1':k==='tomorrow'?'2':k.startsWith('day:')?'3'+k.slice(4):k==='repeat'?'4':'5';return [...m.entries()].sort(([a],[b])=>order(a).localeCompare(order(b)));},[filtered,now,tomorrow]);
 const reset=()=>{setScope('active');setKind('all');setCategory('all');setQuery('');setSort('date');setLimit(80);};
 const hasFilter=scope!=='active'||kind!=='all'||category!=='all'||!!query;
 let shown=0;
 return <div className="lh-all-v2">
  <header className="lh-all-hero"><div><span className="lh-all-eyebrow"><Target size={14}/> LIFEHUB / TASK CENTER</span><h1>Усі справи. Один простір.</h1><p>Знаходь потрібне, керуй дедлайнами та бач свій прогрес без зайвого шуму.</p></div><button className="lh-all-primary" onClick={onAdd}><Plus size={18}/> Нова справа</button></header>
  <section className="lh-all-metrics">{([{title:'У роботі',value:metrics.active,icon:FolderKanban},{title:'Сьогодні та борги',value:metrics.now,icon:CalendarDays},{title:'Прострочено',value:metrics.late,icon:Hourglass},{title:'Виконано',value:metrics.completed,icon:CheckCheck}] as const).map(x=><div key={x.title} className={x.title==='Прострочено'&&x.value?'urgent':''}><x.icon size={21}/><strong>{x.value}</strong><span>{x.title}</span></div>)}</section>
  <div className="lh-all-toolbar"><div className="lh-all-search"><Search size={18}/><input type="search" aria-label="Пошук справ" value={query} onChange={e=>{setQuery(e.target.value);setLimit(80);}} placeholder="Пошук назви, нотатки, дати…"/>{query&&<button onClick={()=>setQuery('')} aria-label="Очистити пошук"><X size={17}/></button>}</div><div className="lh-all-scopes">{([{id:'active',label:'Актуальні'},{id:'all',label:'Усі'},{id:'done',label:'Виконані'}] as const).map(x=><button key={x.id} className={scope===x.id?'active':''} onClick={()=>{setScope(x.id);setLimit(80);}}>{x.label}</button>)}</div><button className={'lh-all-toggle '+(showFilters?'active':'')} onClick={()=>setShowFilters(v=>!v)}><Filter size={16}/> Фільтри <ChevronDown size={15}/></button></div>
  {showFilters&&<div className="lh-all-filters"><div className="lh-all-chips">{([{id:'all',label:'Усі типи'},{id:'critical',label:'Критичні'},{id:'high',label:'Важливі'},{id:'repeat',label:'Повторювані'},{id:'normal',label:'Звичайні'}] as const).map(x=><button key={x.id} className={'lh-all-chip '+(kind===x.id?'active ':'')+'kind-'+x.id} onClick={()=>{setKind(x.id);setLimit(80);}}>{x.id==='critical'&&<Flag size={14}/>} {x.id==='repeat'&&<Repeat2 size={14}/>} {x.label}</button>)}</div><div className="lh-all-selects"><label>Напрям <select value={category} onChange={e=>setCategory(e.target.value as Category|'all')} aria-label="Напрям"><option value="all">Усі напрямки</option>{Object.entries(names).map(([id,title])=><option value={id} key={id}>{title}</option>)}</select></label><label>Порядок <select value={sort} onChange={e=>setSort(e.target.value as 'date'|'priority')} aria-label="Сортування"><option value="date">За датою</option><option value="priority">За важливістю</option></select></label>{hasFilter&&<button className="lh-all-reset" onClick={reset}><X size={14}/> Скинути</button>}</div></div>}
  <div className="lh-all-section-title"><div><small>ОРГАНАЙЗЕР</small><h2>{scope==='done'?'Виконані завдання':scope==='all'?'Усі записи':'Твій робочий список'}</h2></div><span>{filtered.length} записів · за датами</span></div>
  <div className="lh-all-groups">{!filtered.length&&<div className="lh-all-empty"><CheckCheck size={35}/><h3>Справ поки немає</h3><p>{hasFilter?'Спробуй змінити фільтри.':'Створи першу справу, і вона з’явиться тут.'}</p><button onClick={hasFilter?reset:onAdd}>{hasFilter?'Скинути фільтри':'Додати справу'}</button></div>}
  {groups.map(([key,items])=>{const available=Math.max(0,limit-shown);const subset=items.slice(0,available);shown+=subset.length;if(!subset.length)return null;const [title,subtitle,tone]=meta(key);const closed=!!collapsed[key];return <section key={key} className={'lh-all-group tone-'+tone}>
   <button className="lh-all-group-head" aria-expanded={!closed} onClick={()=>setCollapsed(x=>({...x,[key]:!x[key]}))}><span className="lh-all-accent"/><span className="lh-all-group-title"><strong>{title}</strong><small>{subtitle}</small></span><span className="lh-all-count">{items.length}</span>{closed?<ChevronRight size={17}/>:<ChevronDown size={17}/>}</button>
   {!closed&&<div className="lh-all-task-list">{subset.map(r=>{const p=r.t.priority||'normal',t=r.t,keyDate=r.repeat?r.date:t.dueDate,canToggle=!r.repeat||r.date===now,hasProgress=['counter','minutes'].includes(t.progressType||''),current=Number(t.progress?.[keyDate]||0),goal=Number(t.target||1);
    return <article className={'lh-all-task '+(r.done?'done':'')} key={t.id}><button className={'lh-all-check '+(r.done?'checked':'')} aria-label={r.done?'Скасувати виконання '+t.title:'Виконати '+t.title} title={!canToggle?'Повторення не заплановане на сьогодні':undefined} disabled={!canToggle} onClick={()=>onToggle(t,keyDate)}>{r.done&&<Check size={15}/>}</button><div className="lh-all-task-info"><div className="lh-all-task-name"><strong>{t.title}</strong><span className={'lh-all-priority priority-'+p}>{priorities[p]}</span></div><div className="lh-all-task-meta"><span><FolderKanban size={13}/>{names[t.category]}</span><span><Clock3 size={13}/>{t.time||'Увесь день'}</span>{r.repeat?<span><RotateCcw size={13}/>{repeatNames[t.recurrence]||'Повторення'} · {r.date===now?'сьогодні':'наступне: '+dateLabel(r.date)}</span>:<span><CalendarDays size={13}/>{t.dueDate}</span>}{!!t.durationMin&&<span><Hourglass size={13}/>{t.durationMin} хв</span>}</div>{t.note&&<p>{t.note}</p>}{hasProgress&&<div className="lh-all-meter"><div><span style={{width:Math.max(0,Math.min(100,current/goal*100))+'%'}}/></div><small>{current.toLocaleString('uk-UA')} / {goal.toLocaleString('uk-UA')} {t.unit||'од.'}</small></div>}</div><div className="lh-all-actions">{r.late&&<button className="move" title="Перенести на сьогодні" onClick={()=>onMove(t,now)}><CalendarPlus size={16}/> Сьогодні</button>}<button title="Редагувати" aria-label={'Редагувати '+t.title} onClick={()=>onEdit(t)}><Edit3 size={16}/></button><button title="Видалити" aria-label={'Видалити '+t.title} onClick={()=>onDelete(t)}><Trash2 size={16}/></button></div></article>;
   })}</div>}</section>;})}
   {filtered.length>limit&&<button className="lh-all-more" onClick={()=>setLimit(n=>n+60)}>Показати ще {Math.min(60,filtered.length-limit)} справ <ChevronDown size={17}/></button>}
  </div><p className="lh-all-footnote"><Target size={14}/> Повторювані справи показано лише один раз. Виконання зараховується окремо на кожен запланований день.</p>
 </div>;
}
