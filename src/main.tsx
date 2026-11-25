import {Zap, Droplets, CalendarClock, Timer, ChevronDown, Coffee, CheckCircle2} from 'lucide-react';
import {PowerPage} from './PowerPage';
import {CS2Page} from './CS2Page';
import {AllTasksPage} from './AllTasksPage';
import {LifeDatePicker,LifeTimeWheel} from './TaskEditorControls';
import {PersonalImportPanel} from './PersonalImportPanel';
import {useEffect,useMemo,useState} from 'react';
import type {ComponentType,FormEvent,CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Activity,ArrowLeft,ArrowRight,Bell,Bot,CalendarDays,Check,CheckCheck,ChevronRight,
  CircleHelp,Clock,CloudDownload,Crosshair,Download,Dumbbell,Edit3,FolderKanban,
  GraduationCap,Home,KeyRound,Lightbulb,Menu,Plus,Save,Settings,ShieldCheck,
  Sparkles,Trash2,Twitch,Video,Wallet, X, RotateCcw, Layers3, Compass, CalendarRange, ListTodo, Youtube, Radio, Newspaper, Music2
} from 'lucide-react';
import type {Task,TaskInput,Category,Recurrence,Priority,Snapshot,Plan} from './types';
import './style.css';
import './studio.css';
import {ChatImportPage,RankStudioPage,UpdatesPanel} from './ExtraPages';
import {SmartSettings} from './SmartSettings';
import {SettingsCenter} from './SettingsCenter';
import {PlannerPage,ProjectsPage,YoutubePage,StreamsPage,NewsPage,MusicPage} from './WorkspacePages';
import {FitnessStudio} from './FitnessStudio';
const categories:{id:Category;title:string;short:string;icon:ComponentType<{size?:number}>;tone:string}[]=[
  {id:'personal',title:'Особисте',short:'Життя',icon:Home,tone:'slate'},
  {id:'rankdaily',title:'Rank Daily',short:'Контент',icon:Video,tone:'purple'},
  {id:'twitch',title:'Twitch',short:'Стріми',icon:Twitch,tone:'violet'},
  {id:'cs2',title:'CS2',short:'Кіберспорт',icon:Crosshair,tone:'orange'},
  {id:'sport',title:'Спорт',short:'Фізична форма',icon:Dumbbell,tone:'lime'},
  {id:'study',title:'Навчання',short:'Університет',icon:GraduationCap,tone:'blue'}
];
const priorityNames:Record<Priority,string>={low:'Спокійне',normal:'Звичайне',high:'Важливе',critical:'Дуже важливе',urgent:'Критичне'};
const priorityOrder:Priority[]=['normal','high','critical','urgent'];
const priorityColors:Record<string,string>={low:'#6e9680',normal:'#51b784',high:'#e7bb52',critical:'#f57467',urgent:'#ad3445'};
const repeatLabels:Record<Recurrence,string>={none:'Один раз',daily:'Щодня',weekdays:'Будні дні',weekly:'Щотижня'};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const plusDays=(s:string,n:number)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const pretty=(s:string,options?:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('uk-UA',options||{weekday:'long',day:'numeric',month:'long'}).format(new Date(s+'T12:00:00'));
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00').getTime());
const progressFor=(t:Task,d:string)=>Number(t.progress?.[t.recurrence==='none'?t.dueDate:d]||0);
const isDone=(t:Task,d:string)=>t.completions.includes(t.recurrence==='none'?t.dueDate:d)||(['counter','minutes'].includes(t.progressType||'')&&progressFor(t,d)>=Number(t.target||1));
const occurs=(t:Task,d:string)=>{
  if(!validDate(t.dueDate)||!validDate(d))return false;
  if(t.recurrence==='none')return t.dueDate===d||(t.dueDate<d&&!isDone(t,d));
  if(t.dueDate>d)return false;
  if(t.recurrence==='daily')return true;
  if(t.recurrence==='weekdays'){const day=new Date(d+'T12:00:00').getDay();return day!==0&&day!==6;}
  if(t.recurrence==='weekly'){const days=Math.round((Date.parse(d+'T12:00:00Z')-Date.parse(t.dueDate+'T12:00:00Z'))/86400000);return days%7===0;}
  return false;
};
const scheduledOccurs=(t:Task,d:string)=>{
 if(!validDate(t.dueDate)||!validDate(d))return false;
 if(t.recurrence==='none')return t.dueDate===d;
 if(t.dueDate>d)return false;
 if(t.recurrence==='daily')return true;
 if(t.recurrence==='weekdays'){const k=new Date(d+'T12:00:00').getDay();return k!==0&&k!==6;}
 return Math.round((Date.parse(d+'T12:00:00Z')-Date.parse(t.dueDate+'T12:00:00Z'))/86400000)%7===0;
};
const briefDate=(d:string)=>d===today()?'Сьогодні':d===plusDays(today(),1)?'Завтра':d===plusDays(today(),-1)?'Вчора':pretty(d,{weekday:'short',day:'numeric',month:'short'});
const durationText=(minutes:number)=>minutes>=60?`${Math.floor(minutes/60)} год${minutes%60?` ${minutes%60} хв`:''}`:`${minutes} хв`;
const blank=(cat:Category='personal'):TaskInput=>({title:'',category:cat,dueDate:today(),time:'',allDay:true,recurrence:'none',priority:'normal',progressType:'check',target:1,unit:'',durationMin:0,note:''});
function App(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [page,setPage]=useState<string>('today');
 const [previousPage,setPreviousPage]=useState('today');
 const [selectedDate,setSelectedDate]=useState(today());
 const [modal,setModal]=useState(false);
 const [editing,setEditing]=useState<string|null>(null);
 const [form,setForm]=useState<TaskInput>(blank());
 const [working,setWorking]=useState(false);
 const [toast,setToast]=useState('');
 const [aiOpen,setAiOpen]=useState(false);
 const [prompt,setPrompt]=useState('');
 const [plan,setPlan]=useState<Plan|null>(null);
 const [approved,setApproved]=useState<number[]>([]);
 const [aiLoading,setAiLoading]=useState(false);
 const [keyInput,setKeyInput]=useState('');
 const [menuOpen,setMenuOpen]=useState(false);
 const [expanded,setExpanded]=useState<string|null>(null);
 const [counterDraft,setCounterDraft]=useState<Record<string,string>>({});
 const [counterEditor,setCounterEditor]=useState<string|null>(null);
 const [upcomingMode,setUpcomingMode]=useState<'tomorrow'|'important'>('tomorrow');
 const [durationUnit,setDurationUnit]=useState<'min'|'hour'>('min');
 const [confirmTask,setConfirmTask]=useState<Task|null>(null);
 async function refresh(){try{setSnapshot(await window.lifehub.load());}catch(e){showError(e);}}
 useEffect(()=>{let active=true;void window.lifehub.load().then(s=>{if(active){setSnapshot(s);setPage(s.preferences.startupPage||'today');}}).catch(showError);const dispose=window.lifehub.onChanged(()=>void refresh());return()=>{active=false;dispose();};},[]);
 useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(''),4400);return()=>window.clearTimeout(id);},[toast]);
 function showError(err:unknown){setToast(err instanceof Error?err.message:String(err));}
 async function safe(work:()=>Promise<unknown>,success?:string){setWorking(true);try{await work();await refresh();if(success)setToast(success);}catch(e){showError(e);}finally{setWorking(false);}}
 function showAdd(category:Category='personal',date=selectedDate,title=''){const chosen=date<today()?today():date;if(date<today())setToast('Минулу дату не можна ставити для нового плану — відкрито сьогодні.');setDurationUnit('min');setEditing(null);setForm({...blank(category),dueDate:chosen,title});setModal(true);}
 function showEdit(task:Task){setDurationUnit('min');setEditing(task.id);setForm({title:task.title,note:task.note,category:task.category,dueDate:task.dueDate,time:task.time,allDay:task.allDay??!task.time,recurrence:task.recurrence,priority:task.priority||'normal',progressType:task.progressType||'check',target:task.target||1,unit:task.unit||'',durationMin:task.durationMin||0});setModal(true);}
 async function submit(e:FormEvent){e.preventDefault();if(!form.title.trim()){showError('Введи назву завдання');return;}
  const existing=editing?tasks.find(t=>t.id===editing):null;
  if(form.dueDate<today()&&form.dueDate!==existing?.dueDate){showError('Для нової справи або перенесення вибери сьогодні чи майбутню дату');return;}
  setWorking(true);try{if(editing)await window.lifehub.editTask(editing,form);else await window.lifehub.addTask(form);await refresh();setToast('Завдання збережено');setModal(false);}catch(err){showError(err);}finally{setWorking(false);}
 }
 function changePage(p:string){if(p==='settings'&&page!=='settings')setPreviousPage(page);setPage(p);setMenuOpen(false);}
 const tasks=snapshot?.tasks||[];
 const dayTasks=useMemo(()=>tasks.filter(t=>scheduledOccurs(t,selectedDate)).sort((a,b)=>(isDone(a,selectedDate)?1:0)-(isDone(b,selectedDate)?1:0)||(a.time||'99:99').localeCompare(b.time||'99:99')),[tasks,selectedDate]);
 const completed=dayTasks.filter(t=>isDone(t,selectedDate)).length;
 const estimatedMinutes=dayTasks.filter(t=>!isDone(t,selectedDate)).reduce((sum,t)=>sum+Number(t.durationMin||0),0);
 const pct=dayTasks.length?Math.round(completed/dayTasks.length*100):0;
 const activeCat=categories.find(c=>c.id===page);
 const dueSoon=tasks.filter(t=>!isDone(t,t.dueDate) && (upcomingMode==='tomorrow'? scheduledOccurs(t,plusDays(today(),1)):t.recurrence==='none'&&t.dueDate>=today()&&['high','critical','urgent'].includes(t.priority||'normal'))).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||(a.time||'99:99').localeCompare(b.time||'99:99')).slice(0,4);
 const navSections=[
  {title:'ПЛАНУВАННЯ',items:[{id:'today',title:'Сьогодні',icon:ListTodo},{id:'planner',title:'Плани',icon:CalendarRange},{id:'projects',title:'Проєкти',icon:FolderKanban},{id:'allTasks',title:'Усі справи',icon:CheckCheck},{id:'power',title:'Світло',icon:Zap}]},
  {title:'ТРЕНУВАННЯ',items:[{id:'fitness',title:'Фізична форма',icon:Dumbbell},{id:'cs2train',title:'CS2 · Практика',icon:Crosshair}]},
  {title:'КОНТЕНТ ТА МЕДІА',items:[{id:'youtube',title:'YouTube',icon:Youtube},{id:'streams',title:'Стріми',icon:Radio},{id:'news',title:'Новини',icon:Newspaper},{id:'music',title:'Музика',icon:Music2}]},
  {title:'ОСОБИСТЕ',items:[{id:'study',title:'Навчання',icon:GraduationCap}]},
 ];
 const allNav=navSections.flatMap(x=>x.items);
 const englishLabels:Record<string,string>={today:'Today',planner:'Planner',projects:'Projects',allTasks:'All tasks',power:'Power',fitness:'Fitness',cs2train:'CS2 training',youtube:'YouTube',streams:'Streams',news:'News',music:'Music',study:'Studies',stats:'Statistics',imports:'ChatGPT Import',settings:'Settings'};
 const navLabel=(p:{id:string;title:string})=>snapshot?.preferences.language==='en'?(englishLabels[p.id]||p.title):p.title;
 function taskItem(t:Task,date:string,showDate=false){
  const done=isDone(t,date),unavailable=t.recurrence!=='none'&&!occurs(t,date),tone=categories.find(c=>c.id===t.category)?.tone||'slate';
  const CatIcon=categories.find(c=>c.id===t.category)?.icon||Home;
  const target=Math.max(0.001,Number(t.target||1)),current=progressFor(t,date),counter=t.progressType==='counter'||t.progressType==='minutes';
  const isMl=/^(?:мл|ml)$/i.test((t.unit||'').trim());
  const isL=/^(?:л|l|літр(?:и|ів)?)$/i.test((t.unit||'').trim());
  const incr=isMl?250:isL?0.25:t.progressType==='minutes'?15:target>=100?Math.max(1,Math.round(target/10)):target>=10?5:1;
  const counterKey=`${t.id}|${date}`;
  const customDelta=()=>{const raw=(counterDraft[counterKey]||'').trim().replace(',','.');const n=Number(raw);
    if(!raw||!Number.isFinite(n)||n<=0){showError('Введи додатне число, наприклад 0,8');return;}
    void safe(()=>window.lifehub.advanceTask(t.id,date,n),'Прогрес оновлено');setCounterDraft(old=>({...old,[counterKey]:''}));
  };
  return <article className={`task lh-agenda-task ${done?'task-done':''} priority-${t.priority||'normal'}`} key={t.id} style={{'--priority-color':priorityColors[t.priority||'normal']} as CSSProperties}>
    <div className="lh-agenda-time"><strong>{t.time||'—'}</strong><small>{t.time?'ПОЧАТОК':'ВЕСЬ ДЕНЬ'}</small></div>
    <button className={`task-check ${done?'checked':''}`} disabled={unavailable} aria-label={done?'Скасувати виконання':'Відмітити виконаним'} onClick={()=>void safe(()=>window.lifehub.toggleTask(t.id,date))}>{done&&<Check size={15}/>}</button>
    <div className="task-body" onClick={()=>setExpanded(expanded===t.id?null:t.id)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')setExpanded(expanded===t.id?null:t.id);}}>
      <span className="task-title">{t.title}</span>
      <div className="task-meta"><span className={`tag ${tone}`}><CatIcon size={12}/>{categories.find(c=>c.id===t.category)?.title}</span><span className={`hub-priority priority-${t.priority||'normal'}`}>{priorityNames[t.priority||'normal']}</span>{!!t.durationMin&&<span><Timer size={12}/> {durationText(t.durationMin)}</span>}{showDate&&<span><CalendarDays size={12}/>{t.dueDate}</span>}{t.recurrence!=='none'&&<span><RotateCcw size={12}/>{repeatLabels[t.recurrence]}</span>}</div>
      {counter&&<div className="task-meter"><div className="task-meter-track"><span style={{width:`${Math.min(100,current/target*100)}%`}}/></div><small>{current.toLocaleString('uk-UA')} / {target.toLocaleString('uk-UA')} {t.unit||'од.'} · {Math.round(current/target*100)}%</small></div>}
      {expanded===t.id&&t.note&&<p className="task-note">{t.note}</p>}
    </div>
    <div className="task-actions lh-agenda-actions">
      {counter&&<button type="button" className="lh-progress-toggle" title="Змінити прогрес" aria-expanded={counterEditor===counterKey} onClick={()=>setCounterEditor(v=>v===counterKey?null:counterKey)}><Droplets size={15}/><ChevronDown size={13}/></button>}
      <button title="Редагувати" onClick={()=>showEdit(t)}><Edit3 size={15}/></button><button title="Видалити" onClick={()=>setConfirmTask(t)}><Trash2 size={15}/></button>
    </div>
    {counter&&counterEditor===counterKey&&<div className="lh-agenda-progress" aria-label={`Прогрес завдання ${t.title}`}>
      <div className="lh-agenda-progress-header"><strong>Додати прогрес</strong><span>Ціль {target} {t.unit}</span></div>
      <div className="lh-agenda-progress-tools"><button disabled={unavailable||current<=0||working} onClick={()=>void safe(()=>window.lifehub.advanceTask(t.id,date,-incr))}>−{incr}</button><button disabled={unavailable||working} onClick={()=>void safe(()=>window.lifehub.advanceTask(t.id,date,incr))}>+{incr}</button><input type="text" aria-label="Додати довільний обсяг" inputMode="decimal" value={counterDraft[counterKey]||''} onChange={e=>setCounterDraft(old=>({...old,[counterKey]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();customDelta();}}} placeholder={isL?'0,8':isMl?'250':'Кількість'}/><span>{t.unit||'од.'}</span><button className="lh-progress-add" onClick={customDelta}>Додати</button></div>
    </div>}
  </article>;
 }
 async function requestAI(){setAiLoading(true);setPlan(null);try{const p=await window.lifehub.aiPlan(prompt,today());setPlan(p);setApproved(p.changes.map((x,i)=>x.valid?i:-1).filter(x=>x>=0));await refresh();}catch(e){showError(e);}finally{setAiLoading(false);}}
 async function applyAI(){const changes=(plan?.changes||[]).filter((_,i)=>approved.includes(i));if(!changes.length)return;
  await safe(()=>window.lifehub.applyPlan(changes),`Підтверджено змін: ${changes.length}`);setPlan(null);setPrompt('');setApproved([]);
 }
 async function templateVideo(){const value:TaskInput={title:'Опублікувати відео Rank Daily',category:'rankdaily',dueDate:today(),time:'19:00',recurrence:'daily',note:'Приклад регулярного завдання. Можна змінити час або вимкнути.'};await safe(()=>window.lifehub.addTask(value),'Шаблон додано');}
 if(!snapshot)return <div className="loading"><Sparkles/> Відкриваємо LifeHub…</div>;
 return <div className={`app theme-${snapshot.preferences.accent} density-${snapshot.preferences.density} ${snapshot.preferences.reduceMotion?'reduce-motion':''} ${page==='settings'?'settings-fullscreen':''}`}>
  <aside className={`sidebar ${menuOpen?'sidebar-open':''}`}>
    <div className="brand"><div className="brand-icon brand-fixed"><Compass size={26}/></div><div><strong>LifeHub</strong><small>PERSONAL CONTROL CENTER</small></div></div>
    {navSections.map((group,index)=><div className="nav-group" key={group.title}><div className={`sidebar-section ${index?'section-gap':''}`}>{group.title}</div>{group.items.map(p=><button className={`nav ${page===p.id?'selected':''}`} key={p.id} onClick={()=>changePage(p.id)}><p.icon size={18}/>{navLabel(p)}{p.id==='today'&&dayTasks.length>0&&<span className="nav-count">{dayTasks.length}</span>}</button>)}</div>)}
    <div className="sidebar-bottom"><button className={`nav ${page==='settings'?'selected':''}`} onClick={()=>changePage('settings')}><Settings size={18}/>{navLabel({id:'settings',title:'Налаштування'})}</button><div className="sidebar-foot"><div className="avatar">{!snapshot.preferences.hideSidebarIdentity&&snapshot.preferences.avatarData?<img src={snapshot.preferences.avatarData} alt="Мій аватар"/>:'LH'}</div><div><strong>{snapshot.preferences.hideSidebarIdentity?'LifeHub':snapshot.preferences.nickname||'Мій LifeHub'}</strong><small>Локальний профіль</small></div><span className="online-dot"/></div></div>
  </aside>
  <main className="main">
   <header className="topbar"><button className="icon-button mobile-menu" onClick={()=>setMenuOpen(!menuOpen)}><Menu size={20}/></button><span className="crumb">LifeHub <ChevronRight size={14}/> <strong>{page==='today'?'Мій день':navLabel(allNav.find(x=>x.id===page)||{id:page,title:activeCat?.title||'LifeHub'})}</strong></span><div className="top-actions"><span className="local-pill"><span className="green-dot"/> Дані на комп'ютері</span><button className="button outline small" onClick={()=>setAiOpen(true)}><Sparkles size={16}/> AI-помічник</button>{page!=='allTasks'&&<button className="button primary small" onClick={()=>showAdd(activeCat?.id||'personal')}><Plus size={17}/> Завдання</button>}</div></header>
   <div className="content">
    {page==='today'&&<>
      <section className="lh-today-intro">
       <div><span className="lh-kicker"><span className="pulse-dot"/> ТВОЯ ОСОБИСТА ПАНЕЛЬ</span><h1>Фокус на <em>{briefDate(selectedDate).toLowerCase()}</em></h1><p>Плани, звички та справи в одному місці. Ти вирішуєш, що виконувати і коли.</p></div>
       <div className="lh-intro-actions"><button className="button primary" onClick={()=>showAdd('personal',selectedDate)}><Plus size={17}/> Нова справа</button><button className="button outline" onClick={()=>changePage('planner')}><CalendarDays size={16}/> Календар</button></div>
      </section>
      <div className="lh-today-metrics"><div className="lh-today-stat"><CalendarDays size={17}/><div><strong>{dayTasks.length}</strong><span>Заплановано</span></div></div><div className="lh-today-stat"><CheckCheck size={17}/><div><strong>{completed}</strong><span>Виконано</span></div></div><div className="lh-today-stat"><Activity size={17}/><div><strong>{pct}%</strong><span>Прогрес</span></div></div><div className="lh-today-stat"><Clock size={17}/><div><strong>{estimatedMinutes?durationText(estimatedMinutes):'—'}</strong><span>Залишилося часу</span></div></div></div>
      <div className="lh-focus-layout"><section className="panel lh-main-agenda">
        <div className="lh-agenda-head"><div><span className="lh-kicker">DAILY PLANNER</span><h2>План на {briefDate(selectedDate).toLowerCase()}</h2><p>{pretty(selectedDate,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {dayTasks.length} справ</p></div>
         <div className="lh-agenda-date-controls"><div className="day-picker"><button type="button" aria-label="Попередній день" onClick={()=>setSelectedDate(d=>plusDays(d,-1))}><ArrowLeft size={16}/></button><strong>{briefDate(selectedDate)}</strong><button type="button" aria-label="Наступний день" onClick={()=>setSelectedDate(d=>plusDays(d,1))}><ArrowRight size={16}/></button></div>{selectedDate!==today()&&<button type="button" className="lh-back-today" onClick={()=>setSelectedDate(today())}>До сьогодні</button>}</div>
        </div>
        <div className="lh-agenda-progress-line"><span style={{width:`${pct}%`}}/></div>
        <div className="lh-agenda-list">{dayTasks.length?dayTasks.map(t=>taskItem(t,selectedDate)):<div className="empty lh-agenda-empty"><CalendarDays size={33}/><h3>Вільний день</h3><p>Поки немає запланованих справ.</p><button className="button primary" onClick={()=>showAdd('personal',selectedDate)}><Plus size={16}/> Додати завдання</button></div>}</div>
        <div className="lh-agenda-footer"><span><CheckCircle2 size={16}/> Виконано {completed} з {dayTasks.length}</span><span><Clock size={16}/> Запланований залишок: {estimatedMinutes?durationText(estimatedMinutes):'0 хв'}</span></div>
       </section><aside className="lh-agenda-side">
        <section className="panel lh-next-panel"><div className="lh-next-head"><div><span className="lh-kicker">НА ГОРИЗОНТІ</span><h2>Наступні справи</h2></div><CalendarClock size={21}/></div><div className="lh-next-switch"><button type="button" className={upcomingMode==='tomorrow'?'active':''} onClick={()=>setUpcomingMode('tomorrow')}>Завтра</button><button type="button" className={upcomingMode==='important'?'active':''} onClick={()=>setUpcomingMode('important')}>Важливі</button></div>{dueSoon.length?dueSoon.map(t=><button type="button" className="lh-upcoming-row" key={t.id} onClick={()=>{setSelectedDate(upcomingMode==='tomorrow'?plusDays(today(),1):t.dueDate);showEdit(t);}}><span className="lh-upcoming-priority" style={{background:priorityColors[t.priority||'normal']}}/><span><strong>{t.title}</strong><small>{pretty(t.dueDate,{day:'numeric',month:'short'})}{t.time?` · ${t.time}`:''}{t.durationMin?` · ${durationText(t.durationMin)}`:''}</small></span><ChevronRight size={15}/></button>):<div className="lh-upcoming-empty"><Coffee size={22}/><p>{upcomingMode==='tomorrow'?'Завтра немає справ.':'Важливих майбутніх справ немає.'}</p></div>}</section>
        <section className="panel lh-small-recap"><div className="lh-recap-icon"><Sparkles size={19}/></div><div><strong>Потрібна допомога з планом?</strong><p>AI-помічник доступний у верхній панелі. Будь-які зміни — лише після твого підтвердження.</p></div></section>
       </aside></div>
      {!tasks.length&&<section className="starter"><div><Lightbulb size={22}/><strong>Швидкий старт</strong><span>Можеш додати регулярний шаблон тільки якщо він тобі підходить.</span></div><button className="button outline" onClick={()=>void templateVideo()}>+ Rank Daily о 19:00</button></section>}
    </>}
    {page==='allTasks'&&<AllTasksPage tasks={tasks} onAdd={()=>showAdd('personal',today())} onEdit={showEdit} onDelete={setConfirmTask} onToggle={(task,date)=>{void safe(()=>window.lifehub.toggleTask(task.id,date),'Відмітку оновлено');}} onMove={(task,date)=>{void safe(()=>window.lifehub.editTask(task.id,{...task,dueDate:date}),'Перенесено на сьогодні');}}/>}
    {page==='power'&&<PowerPage snapshot={snapshot} refresh={refresh} report={setToast}/>}
    {page==='study'&&<PlannerPage categoryFilter="study" heading="Навчання та дедлайни" snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d)=>showAdd('study',d)} onEditTask={showEdit} onDeleteTask={setConfirmTask}/>}
    {page==='planner'&&<PlannerPage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'personal',d,title||'')} onEditTask={showEdit} onDeleteTask={setConfirmTask}/>}
    {page==='projects'&&<ProjectsPage snapshot={snapshot} refresh={refresh} report={setToast}/>}
    {page==='fitness'&&<FitnessStudio snapshot={snapshot} refresh={refresh} report={setToast}/>}
    {page==='cs2train'&&<CS2Page snapshot={snapshot} refresh={refresh} report={setToast}/>}
    {page==='youtube'&&<YoutubePage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'rankdaily',d,title||'')}/>}
    {page==='streams'&&<StreamsPage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'twitch',d,title||'')}/>}
    {page==='news'&&<NewsPage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'personal',d,title||'')}/>}
    {page==='music'&&<MusicPage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'personal',d,title||'')}/>}
    {page==='imports'&&<ChatImportPage hasKey={snapshot.hasKey} report={setToast} onProposal={p=>{setPlan(p);setApproved(p.changes.map((x,i)=>x.valid?i:-1).filter(x=>x>=0));setAiOpen(true);}}/>}
    {page==='studio'&&<RankStudioPage report={setToast}/>}
    {page==='settings'&&<SettingsCenter snapshot={snapshot} refresh={refresh} report={setToast} onClose={()=>changePage(previousPage)}
      ai={<div className="settings-grid"><section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><KeyRound size={22}/></div><div><h2>OpenAI API</h2><p>Планування з GPT-5 mini</p></div><span className={`status ${snapshot.hasKey?'good':'muted-badge'}`}>{snapshot.hasKey?'Підключено':'Не підключено'}</span></div><label className="field-label">Твій секретний API-ключ</label><div className="key-row"><input type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="sk-..." autoComplete="off"/><button disabled={working||!keyInput.trim()} className="button primary" onClick={()=>void safe(async()=>{await window.lifehub.setKey(keyInput);setKeyInput('');},'Ключ зашифровано і збережено')}><Save size={16}/> Зберегти</button></div>{snapshot.hasKey&&<button className="link-danger" onClick={()=>void safe(()=>window.lifehub.removeKey(),'Ключ видалено')}>Видалити збережений ключ</button>}<div className="hint"><ShieldCheck size={18}/><span>Ключ зберігається зашифрованим системою Windows. Запити надсилаються напряму в OpenAI, не через чужий сервер.</span></div></section><section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><Wallet size={22}/></div><div><h2>Бюджет AI</h2><p>Локальний облік витрат за місяць</p></div></div><div className="budget-top"><strong>${snapshot.spent.toFixed(4)}</strong><span>із ${snapshot.limit.toFixed(2)}</span></div><div className="progress big"><span style={{width:`${Math.min(100,snapshot.spent/snapshot.limit*100)}%`}}/></div><p className="warning">Це лише оцінка витрат LifeHub. Ліміт LifeHub локальний, не загальний ліміт акаунта OpenAI. Перевір фактичне використання і бюджет API-проєкту в OpenAI. Облік із затримкою може дещо перевищити ліміт.</p></section></div>}
      notifications={<><div className="settings-grid"><section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><Bell size={22}/></div><div><h2>Нагадування</h2><p>Залишайся в курсі справ</p></div></div><div className="toggle-row"><div><strong>Автозапуск із Windows</strong><p>Працює після встановлення програми</p></div><input type="checkbox" checked={snapshot.autostart} onChange={e=>void safe(()=>window.lifehub.setAutostart(e.target.checked))}/></div><div className="toggle-row"><div><strong>Підсумок дня після 21:00</strong><p>Сповіщення, якщо програма відкрита</p></div><input type="checkbox" checked={snapshot.evening} onChange={e=>void safe(()=>window.lifehub.setEvening(e.target.checked))}/></div></section></div><SmartSettings section="telegram" snapshot={snapshot} refresh={refresh} report={setToast}/></>}
      integrations={<SmartSettings section="integrations" snapshot={snapshot} refresh={refresh} report={setToast}/>}
      data={<><div className="settings-grid"><section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><CloudDownload size={22}/></div><div><h2>Мої дані</h2><p>Резервна копія локальних завдань</p></div></div><button className="button outline" onClick={()=>void safe(()=>window.lifehub.exportData(),'Резервну копію експортовано')}><Download size={17}/> Експортувати JSON</button><p className="muted">У копію не потрапляють API-ключі. Це експорт основних локальних записів, а не повний образ програми; автоматичне відновлення не підтримується.</p></section></div><PersonalImportPanel onComplete={refresh} report={setToast}/><details className="hub-import-settings"><summary><Layers3 size={18}/> Імпорт історії ChatGPT <span>Відкрити інструмент</span></summary><ChatImportPage hasKey={snapshot.hasKey} report={setToast} onProposal={p=>{setPlan(p);setApproved(p.changes.map((x,i)=>x.valid?i:-1).filter(x=>x>=0));setAiOpen(true);}}/></details></>}
      updates={<UpdatesPanel initial={snapshot.update} report={setToast}/>}/>}

   </div>
  </main>
  {aiOpen&&<><div className="drawer-overlay" onClick={()=>setAiOpen(false)}/><aside className="ai-drawer"><div className="drawer-head"><div className="drawer-title"><div className="ai-mark"><Bot size={22}/></div><div><h2>LifeHub AI</h2><small>Твій помічник із планування</small></div></div><button className="icon-button" onClick={()=>setAiOpen(false)}><X size={20}/></button></div><div className="drawer-scroll"><div className="assistant-message"><Sparkles size={18}/><div>Привіт, братан! Напиши, що хочеш запланувати або перенести. Я запропоную зміни — <strong>нічого не збережеться без твого підтвердження</strong>.</div></div><div className="privacy-note"><ShieldCheck size={16}/><span>Для створення пропозиції OpenAI отримує текст запиту та до 60 твоїх завдань (назви, категорії, дати). Зміни застосовуються лише вручну.</span></div>{plan&&<div className="proposal"><div className="proposal-heading"><Sparkles size={17}/> Пропозиція AI</div><p>{plan.summary}</p>{plan.changes.length?plan.changes.map((item,i)=><label className={`proposal-item ${!item.valid?'invalid':''}`} key={i}><input type="checkbox" checked={approved.includes(i)} disabled={!item.valid} onChange={e=>setApproved(v=>e.target.checked?[...v,i]:v.filter(n=>n!==i))}/><span><strong>{item.action==='create'?'+ Створити':'↪ Перенести'}: {item.title}</strong><small>{item.date}{item.time?' о '+item.time:''} · {categories.find(x=>x.id===item.category)?.title}{!item.valid?' · не можна застосувати':''}</small></span></label>):<p className="muted">AI не запропонував змін. Уточни запит.</p>}{approved.length>0&&<button disabled={working} className="button primary wide" onClick={()=>void applyAI()}><Check size={17}/> Застосувати обрані ({approved.length})</button>}<button className="button outline wide" onClick={()=>setPlan(null)}>Відхилити пропозицію</button></div>}</div><div className="drawer-footer"><label htmlFor="ai-input">Твій запит</label><textarea id="ai-input" rows={4} maxLength={1500} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Наприклад: завтра хочу 1 годину CS2 і підготувати ідеї для Twitch..."/><button className="button bright wide" disabled={!prompt.trim()||aiLoading||!snapshot.hasKey} onClick={()=>void requestAI()}>{aiLoading?'Створюю пропозицію…':<><Sparkles size={17}/> Запропонувати план</>}</button><div className="drawer-cost">{snapshot.hasKey?`Використано ~$${snapshot.spent.toFixed(4)} із $5 цього місяця`:'Спочатку додай API-ключ у налаштуваннях'}</div></div></aside></>}
  {modal&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false);}}><div className="modal lh-new-task-modal"><div className="modal-head"><div><span className="lh-kicker">TASK EDITOR</span><h2>{editing?'Редагування справи':'Нова справа'}</h2><p>Зручний час, пріоритет і вимірювання прогресу</p></div><button type="button" className="icon-button" onClick={()=>setModal(false)}><X size={20}/></button></div>
  <form onSubmit={submit}><label className="field-label" htmlFor="lh-task-title">Що плануєш зробити? *</label><input id="lh-task-title" required maxLength={120} autoFocus value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Наприклад, 40 хв на доріжці"/>
   <div className="lh-schedule-box"><span className="lh-box-title"><CalendarClock size={17}/> Коли?</span><div className="form-pair"><div><label className="field-label">Дата</label><LifeDatePicker value={form.dueDate} minDate={today()} onChange={dueDate=>setForm(f=>({...f,dueDate}))}/></div><div><label className="field-label">Час (необов'язково)</label><LifeTimeWheel value={form.time} onChange={time=>setForm(f=>({...f,time,allDay:!time}))}/></div></div><label className="lh-toggle-all-day"><input type="checkbox" checked={form.allDay??true} onChange={e=>setForm(f=>({...f,allDay:e.target.checked,time:e.target.checked?'':f.time}))}/> <span>Без конкретного часу</span><small>Дата залишиться на весь день</small></label></div>
   <div className="form-pair"><div><label className="field-label">Орієнтовна тривалість</label><div className="lh-duration-group"><input type="number" min="0" max={durationUnit==='min'?1440:24} step="any" value={durationUnit==='min'?(form.durationMin||0):Number(((form.durationMin||0)/60).toFixed(2))} onChange={e=>{const value=Number(e.target.value);setForm(f=>({...f,durationMin:Math.max(0,Math.min(1440,Math.round(value*(durationUnit==='hour'?60:1))))}));}}/><select aria-label="Одиниці тривалості" value={durationUnit} onChange={e=>setDurationUnit(e.target.value as 'min'|'hour')}><option value="min">хв</option><option value="hour">год</option></select></div></div><div><label className="field-label">Напрям</label><select className="lh-category-select" value={form.category} onChange={e=>setForm({...form,category:e.target.value as Category})}>{categories.map(x=><option key={x.id} value={x.id}>{x.id==='personal'?'⌂ ':x.id==='rankdaily'?'▶ ':x.id==='twitch'?'◉ ':x.id==='cs2'?'◎ ':x.id==='sport'?'⚡ ':'▤ '}{x.title}</option>)}</select></div></div>
   <label className="field-label">Повторення</label><div className="lh-recurrence-chips">{Object.entries(repeatLabels).map(([value,title])=><button type="button" className={form.recurrence===value?'active':''} key={value} onClick={()=>setForm(f=>({...f,recurrence:value as Recurrence}))}>{value!=='none'&&<RotateCcw size={13}/>} {title}</button>)}</div>
   <label className="field-label">Важливість</label><div className="lh-priority-choices">{priorityOrder.map(value=><label key={value} className={form.priority===value?'selected':''} style={{'--tone':priorityColors[value]} as CSSProperties}><input type="radio" name="task-priority" value={value} checked={form.priority===value} onChange={()=>setForm(f=>({...f,priority:value}))}/><span className="lh-priority-dot"/>{priorityNames[value]}</label>)}</div>
   <label className="field-label">Як відстежувати результат?</label><div className="lh-tracking-choices">{([{id:'check',title:'Готово / не готово',hint:'Одна галочка',icon:Check},{id:'counter',title:'Кількісний прогрес',hint:'Вода, повтори, кілометри',icon:Activity},{id:'minutes',title:'Часовий прогрес',hint:'Хвилини навчання чи тренування',icon:Timer}] as const).map(x=><label className={form.progressType===x.id?'selected':''} key={x.id}><input type="radio" name="progress-type" checked={form.progressType===x.id} onChange={()=>setForm(f=>({...f,progressType:x.id,unit:x.id==='minutes'?'хв':x.id==='check'?'':f.unit||'',target:x.id==='check'?1:x.id==='minutes'?60:f.target||1}))}/><x.icon size={18}/><span><strong>{x.title}</strong><small>{x.hint}</small></span></label>)}</div>
   {form.progressType!=='check'&&<div className="form-pair lh-target-row"><div><label className="field-label">Ціль</label><input type="number" min="0.001" max="1000000" step="any" value={form.target||1} onChange={e=>setForm(f=>({...f,target:Number(e.target.value)}))}/></div><div><label className="field-label">Одиниця</label><input disabled={form.progressType==='minutes'} maxLength={24} value={form.progressType==='minutes'?'хв':form.unit||''} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} placeholder="л, км, повторів"/></div></div>}
   <label className="field-label">Нотатка</label><textarea rows={3} value={form.note} maxLength={500} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Деталі, місце, підготовка… (необов'язково)"/>
   <div className="modal-actions"><button type="button" className="button outline" onClick={()=>setModal(false)}>Скасувати</button><button type="submit" disabled={working} className="button primary"><Save size={16}/> Зберегти справу</button></div></form></div></div>}
  {confirmTask&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmTask(null);}}><div className="modal hub-confirm-modal"><div className="modal-head"><div><h2>Видалити справу?</h2><p>{confirmTask.title}</p></div><button className="icon-button" onClick={()=>setConfirmTask(null)}><X size={20}/></button></div><p>Ця дія прибере запис із твого календаря та історії.</p><div className="modal-actions"><button className="button outline" onClick={()=>setConfirmTask(null)}>Залишити</button><button className="button danger" onClick={()=>{const id=confirmTask.id;setConfirmTask(null);void safe(()=>window.lifehub.deleteTask(id),'Справу видалено');}}>Видалити</button></div></div></div>}
  {toast&&<div className="toast"><CircleHelp size={17}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
