import {Zap} from 'lucide-react';
import {PowerPage} from './PowerPage';
import {useEffect,useMemo,useState} from 'react';
import type {ComponentType,FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Activity,ArrowLeft,ArrowRight,Bell,Bot,CalendarDays,Check,CheckCheck,ChevronRight,
  CircleHelp,Clock,CloudDownload,Crosshair,Download,Dumbbell,Edit3,FolderKanban,
  GraduationCap,Home,KeyRound,Lightbulb,Menu,Plus,Save,Settings,ShieldCheck,
  Sparkles,Trash2,Twitch,Video,Wallet, X,BarChart3, RotateCcw, Flame, Layers3, ArrowUpRight, Compass, CalendarRange, ListTodo, Youtube, Radio, Newspaper, Music2
} from 'lucide-react';
import type {Task,TaskInput,Category,Recurrence,Priority,Snapshot,Plan} from './types';
import './style.css';
import './studio.css';
import {ChatImportPage,RankStudioPage,UpdatesPanel} from './ExtraPages';
import {SmartSettings} from './SmartSettings';
import {PlannerPage,ProjectsPage,FitnessPage,YoutubePage,StreamsPage,NewsPage,MusicPage,WorkspaceSettings} from './WorkspacePages';
const categories:{id:Category;title:string;short:string;icon:ComponentType<{size?:number}>;tone:string}[]=[
  {id:'personal',title:'Особисте',short:'Життя',icon:Home,tone:'slate'},
  {id:'rankdaily',title:'Rank Daily',short:'Контент',icon:Video,tone:'purple'},
  {id:'twitch',title:'Twitch',short:'Стріми',icon:Twitch,tone:'violet'},
  {id:'cs2',title:'CS2',short:'Кіберспорт',icon:Crosshair,tone:'orange'},
  {id:'sport',title:'Спорт',short:'Фізична форма',icon:Dumbbell,tone:'lime'},
  {id:'study',title:'Навчання',short:'Університет',icon:GraduationCap,tone:'blue'}
];
const priorityNames:Record<Priority,string>={low:'Не терміново',normal:'Звичайне',high:'Важливо',critical:'Терміново'};
const repeatLabels:Record<Recurrence,string>={none:'Один раз',daily:'Щодня',weekdays:'Будні дні',weekly:'Щотижня'};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const plusDays=(s:string,n:number)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const pretty=(s:string,options?:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('uk-UA',options||{weekday:'long',day:'numeric',month:'long'}).format(new Date(s+'T12:00:00'));
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00').getTime());
const progressFor=(t:Task,d:string)=>Number(t.progress?.[t.recurrence==='none'?t.dueDate:d]||0);
const isDone=(t:Task,d:string)=>t.completions.includes(t.recurrence==='none'?t.dueDate:d)||(t.progressType==='counter'&&progressFor(t,d)>=Number(t.target||1));
const occurs=(t:Task,d:string)=>{
  if(!validDate(t.dueDate)||!validDate(d))return false;
  if(t.recurrence==='none')return t.dueDate===d||(t.dueDate<d&&!isDone(t,d));
  if(t.dueDate>d)return false;
  if(t.recurrence==='daily')return true;
  if(t.recurrence==='weekdays'){const day=new Date(d+'T12:00:00').getDay();return day!==0&&day!==6;}
  if(t.recurrence==='weekly'){const days=Math.round((Date.parse(d+'T12:00:00Z')-Date.parse(t.dueDate+'T12:00:00Z'))/86400000);return days%7===0;}
  return false;
};
const blank=(cat:Category='personal'):TaskInput=>({title:'',category:cat,dueDate:today(),time:'',allDay:true,recurrence:'none',priority:'normal',progressType:'check',target:1,unit:'',durationMin:0,note:''});
function App(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [page,setPage]=useState<string>('today');
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
 const [allFilter,setAllFilter]=useState<'all'|'critical'|'high'|'repeat'|'other'>('all');
 const [expanded,setExpanded]=useState<string|null>(null);
 const [confirmTask,setConfirmTask]=useState<Task|null>(null);
 async function refresh(){try{setSnapshot(await window.lifehub.load());}catch(e){showError(e);}}
 useEffect(()=>{void refresh();const dispose=window.lifehub.onChanged(()=>void refresh());return dispose;},[]);
 useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(''),4400);return()=>window.clearTimeout(id);},[toast]);
 function showError(err:unknown){setToast(err instanceof Error?err.message:String(err));}
 async function safe(work:()=>Promise<unknown>,success?:string){setWorking(true);try{await work();await refresh();if(success)setToast(success);}catch(e){showError(e);}finally{setWorking(false);}}
 function showAdd(category:Category='personal',date=selectedDate,title=''){setEditing(null);setForm({...blank(category),dueDate:date,title});setModal(true);}
 function showEdit(task:Task){setEditing(task.id);setForm({title:task.title,note:task.note,category:task.category,dueDate:task.dueDate,time:task.time,allDay:task.allDay??!task.time,recurrence:task.recurrence,priority:task.priority||'normal',progressType:task.progressType||'check',target:task.target||1,unit:task.unit||'',durationMin:task.durationMin||0});setModal(true);}
 function submit(e:FormEvent){e.preventDefault();if(!form.title.trim()){showError('Введи назву завдання');return;}
  void safe(()=>editing?window.lifehub.editTask(editing,form):window.lifehub.addTask(form),'Завдання збережено');setModal(false);
 }
 function changePage(p:string){setPage(p);setMenuOpen(false);}
 const tasks=snapshot?.tasks||[];
 const dayTasks=useMemo(()=>tasks.filter(t=>occurs(t,selectedDate)).sort((a,b)=>(isDone(a,selectedDate)?1:0)-(isDone(b,selectedDate)?1:0)||(a.time||'99:99').localeCompare(b.time||'99:99')),[tasks,selectedDate]);
 const completed=dayTasks.filter(t=>isDone(t,selectedDate)).length;
 const estimatedMinutes=dayTasks.filter(t=>!isDone(t,selectedDate)).reduce((sum,t)=>sum+Number(t.durationMin||0),0);
 const pct=dayTasks.length?Math.round(completed/dayTasks.length*100):0;
 const activeCat=categories.find(c=>c.id===page);
 const stats=useMemo(()=>Array.from({length:7},(_,i)=>{const d=plusDays(today(),i-6);const t=tasks.filter(x=>occurs(x,d));return {date:d,all:t.length,done:t.filter(x=>isDone(x,d)).length};}),[tasks]);
 const dueSoon=tasks.filter(t=>t.recurrence==='none'&&t.dueDate>=today()&&!isDone(t,t.dueDate)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,5);
 const navSections=[
  {title:'ПЛАНУВАННЯ',items:[{id:'today',title:'Сьогодні',icon:ListTodo},{id:'planner',title:'Плани',icon:CalendarRange},{id:'projects',title:'Проєкти',icon:FolderKanban},{id:'allTasks',title:'Усі справи',icon:CheckCheck},{id:'power',title:'Світло',icon:Zap}]},
  {title:'ТРЕНУВАННЯ',items:[{id:'fitness',title:'Фізична форма',icon:Dumbbell},{id:'cs2train',title:'CS2 · Практика',icon:Crosshair}]},
  {title:'КОНТЕНТ ТА МЕДІА',items:[{id:'youtube',title:'YouTube',icon:Youtube},{id:'streams',title:'Стріми',icon:Radio},{id:'news',title:'Новини',icon:Newspaper},{id:'music',title:'Музика',icon:Music2}]},
  {title:'ОСОБИСТЕ',items:[{id:'study',title:'Навчання',icon:GraduationCap}]},
  {title:'АНАЛІТИКА',items:[{id:'stats',title:'Статистика',icon:BarChart3}]}
 ];
 const allNav=navSections.flatMap(x=>x.items);
 const englishLabels:Record<string,string>={today:'Today',planner:'Planner',projects:'Projects',allTasks:'All tasks',power:'Power',fitness:'Fitness',cs2train:'CS2 training',youtube:'YouTube',streams:'Streams',news:'News',music:'Music',study:'Studies',stats:'Statistics',imports:'ChatGPT Import',settings:'Settings'};
 const navLabel=(p:{id:string;title:string})=>snapshot?.preferences.language==='en'?(englishLabels[p.id]||p.title):p.title;
 function taskItem(t:Task,date:string,showDate=false){
  const done=isDone(t,date),unavailable=t.recurrence!=='none'&&!occurs(t,date),tone=categories.find(c=>c.id===t.category)?.tone||'slate';
  const target=Math.max(1,Number(t.target||1)),current=progressFor(t,date),counter=t.progressType==='counter';
  const incr=t.unit?.toLowerCase().includes('мл')?250:target>=100?Math.max(1,Math.round(target/10)):target>=10?5:1;
  return <div className={`task ${done?'task-done':''} priority-${t.priority||'normal'}`} key={t.id}>
    <button className={`task-check ${done?'checked':''}`} disabled={unavailable} title={done?'Скасувати виконання':'Відмітити виконаним'} onClick={()=>void safe(()=>window.lifehub.toggleTask(t.id,date))}>{done&&<Check size={15}/>}</button>
    <div className="task-body" onClick={()=>setExpanded(expanded===t.id?null:t.id)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')setExpanded(expanded===t.id?null:t.id);}}>
      <span className="task-title">{t.title}</span>
      <div className="task-meta"><span className={`tag ${tone}`}>{categories.find(c=>c.id===t.category)?.title}</span><span className={`hub-priority priority-${t.priority||'normal'}`}>{priorityNames[t.priority||'normal']}</span><span><Clock size={12}/>{t.time||'Увесь день'}</span>{!!t.durationMin&&<span>≈{t.durationMin} хв</span>}{showDate&&<span><CalendarDays size={12}/>{t.dueDate}</span>}{t.recurrence!=='none'&&<span><RotateCcw size={12}/>{repeatLabels[t.recurrence]}</span>}</div>
      {counter&&<div className="task-meter"><div className="task-meter-track"><span style={{width:`${Math.min(100,current/target*100)}%`}}/></div><small>{current} / {target} {t.unit||'од.'} · {Math.round(current/target*100)}%</small></div>}
      {expanded===t.id&&t.note&&<p className="task-note">{t.note}</p>}
    </div>
    <div className="task-actions">
      {counter&&<div className="task-counter-controls"><button disabled={unavailable||current<=0} title={`−${incr}`} onClick={()=>void safe(()=>window.lifehub.advanceTask(t.id,date,-incr))}>−</button><button disabled={unavailable||current>=target} title={`+${incr}`} onClick={()=>void safe(()=>window.lifehub.advanceTask(t.id,date,incr))}>+{incr}</button></div>}
      <button title="Редагувати" onClick={()=>showEdit(t)}><Edit3 size={15}/></button><button title="Видалити" onClick={()=>setConfirmTask(t)}><Trash2 size={15}/></button>
    </div>
  </div>;
 }
 async function requestAI(){setAiLoading(true);setPlan(null);try{const p=await window.lifehub.aiPlan(prompt,today());setPlan(p);setApproved(p.changes.map((x,i)=>x.valid?i:-1).filter(x=>x>=0));await refresh();}catch(e){showError(e);}finally{setAiLoading(false);}}
 async function applyAI(){const changes=(plan?.changes||[]).filter((_,i)=>approved.includes(i));if(!changes.length)return;
  await safe(()=>window.lifehub.applyPlan(changes),`Підтверджено змін: ${changes.length}`);setPlan(null);setPrompt('');setApproved([]);
 }
 async function templateVideo(){const value:TaskInput={title:'Опублікувати відео Rank Daily',category:'rankdaily',dueDate:today(),time:'19:00',recurrence:'daily',note:'Приклад регулярного завдання. Можна змінити час або вимкнути.'};await safe(()=>window.lifehub.addTask(value),'Шаблон додано');}
 if(!snapshot)return <div className="loading"><Sparkles/> Відкриваємо LifeHub…</div>;
 return <div className={`app theme-${snapshot.preferences.accent} density-${snapshot.preferences.density}`}>
  <aside className={`sidebar ${menuOpen?'sidebar-open':''}`}>
    <div className="brand"><div className="brand-icon brand-fixed"><Compass size={26}/></div><div><strong>LifeHub</strong><small>PERSONAL CONTROL CENTER</small></div></div>
    {navSections.map((group,index)=><div className="nav-group" key={group.title}><div className={`sidebar-section ${index?'section-gap':''}`}>{group.title}</div>{group.items.map(p=><button className={`nav ${page===p.id?'selected':''}`} key={p.id} onClick={()=>changePage(p.id)}><p.icon size={18}/>{navLabel(p)}{p.id==='today'&&dayTasks.length>0&&<span className="nav-count">{dayTasks.length}</span>}</button>)}</div>)}
    <div className="sidebar-bottom"><button className={`nav ${page==='settings'?'selected':''}`} onClick={()=>changePage('settings')}><Settings size={18}/>{navLabel({id:'settings',title:'Налаштування'})}</button><div className="sidebar-foot"><div className="avatar">{snapshot.preferences.avatarData?<img src={snapshot.preferences.avatarData} alt="Мій аватар"/>:'LH'}</div><div><strong>{snapshot.preferences.nickname||'Мій LifeHub'}</strong><small>Локальний профіль</small></div><span className="online-dot"/></div></div>
  </aside>
  <main className="main">
   <header className="topbar"><button className="icon-button mobile-menu" onClick={()=>setMenuOpen(!menuOpen)}><Menu size={20}/></button><span className="crumb">LifeHub <ChevronRight size={14}/> <strong>{page==='today'?'Мій день':navLabel(allNav.find(x=>x.id===page)||{id:page,title:activeCat?.title||'LifeHub'})}</strong></span><div className="top-actions"><span className="local-pill"><span className="green-dot"/> Дані на комп'ютері</span><button className="button outline small" onClick={()=>setAiOpen(true)}><Sparkles size={16}/> AI-помічник</button>{page!=='allTasks'&&<button className="button primary small" onClick={()=>showAdd(activeCat?.id||'personal')}><Plus size={17}/> Завдання</button>}</div></header>
   <div className="content">
    {page==='today'&&<>
      <div className="dashboard-hero"><div className="hero-copy"><div className="hero-overline"><span className="pulse-dot"/> LIFEHUB / PERSONAL OS <span className="hero-overline-line"/></div><h1>Твій день. <span>Твої правила.</span></h1><p>Плани, проєкти, тренування та ідеї — в одному місці. AI допоможе розподілити час, а рішення завжди за тобою.</p><div className="hero-actions"><button className="button bright" onClick={()=>setAiOpen(true)}><Sparkles size={16}/> Спланувати з AI <ArrowUpRight size={16}/></button><button className="button hero-secondary" onClick={()=>showAdd()}><Plus size={16}/> Нова справа</button></div></div><div className="hero-orbit"><div className="orbit-ring orbit-ring-one"/><div className="orbit-ring orbit-ring-two"/><div className="orbit-core"><Compass size={44}/></div><span className="orbit-satellite orbit-a"><Crosshair size={15}/></span><span className="orbit-satellite orbit-b"><Video size={15}/></span><span className="orbit-satellite orbit-c"><Flame size={15}/></span></div></div>
      <div className="eyebrow"><span className="accent-line"/> DAILY FOCUS</div>
      <div className="intro-row compact-intro"><div><h2>Огляд дня</h2><p className="subtitle">Завдання, дедлайни та поступ до цілей</p></div><span className="date-chip"><CalendarDays size={17}/> {pretty(selectedDate)}</span></div>
      <div className="metrics"><div className="metric"><div className="metric-head"><span>Завдань на день</span><CalendarDays size={19}/></div><strong>{dayTasks.length}</strong><small>У твоєму плані</small></div><div className="metric"><div className="metric-head"><span>Виконано</span><CheckCheck size={19}/></div><strong>{completed}</strong><small>Уже позаду</small></div><div className="metric"><div className="metric-head"><span>Прогрес дня</span><Activity size={19}/></div><strong>{pct}<em>%</em></strong><div className="progress"><span style={{width:`${pct}%`}}/></div></div></div>
      <div className="layout-two"><section className="panel task-panel"><div className="panel-head"><div><h2>План на день</h2><p>Відмічай виконане — усе збережеться автоматично{estimatedMinutes>0?` · лишилось ≈${Math.floor(estimatedMinutes/60)} год ${estimatedMinutes%60} хв`:""}</p></div><div className="day-picker"><button onClick={()=>setSelectedDate(plusDays(selectedDate,-1))} title="Попередній день"><ArrowLeft size={16}/></button><button className="day-today" onClick={()=>setSelectedDate(today())}>Сьогодні</button><button onClick={()=>setSelectedDate(plusDays(selectedDate,1))} title="Наступний день"><ArrowRight size={16}/></button></div></div>
      {dayTasks.length?dayTasks.map(t=>taskItem(t,selectedDate)):<div className="empty"><CalendarDays size={35}/><h3>План поки порожній</h3><p>Додай першу справу або попроси AI запропонувати розклад.</p><button className="button primary" onClick={()=>showAdd()}><Plus size={16}/> Додати завдання</button></div>}
      </section><div className="right-stack"><section className="panel ai-card"><div className="ai-symbol"><Sparkles size={22}/></div><h2>Плануй разом з AI</h2><p>Напиши, що хочеш встигнути. AI запропонує зміни, а ти їх перевіриш і підтвердиш.</p><button className="button bright" onClick={()=>setAiOpen(true)}>Скласти план <ArrowRight size={17}/></button></section><section className="panel next-card"><div className="panel-head"><h2>Найближчі справи</h2><span className="mini-label">{dueSoon.length} задач</span></div>{dueSoon.length?dueSoon.map(t=><div className="next-row" key={t.id}><span className={`dot ${categories.find(c=>c.id===t.category)?.tone}`}/><div><strong>{t.title}</strong><small>{pretty(t.dueDate,{day:'numeric',month:'short'})}{t.time?' · '+t.time:''}</small></div></div>):<p className="muted">Немає майбутніх одноразових завдань.</p>}</section></div></div>
      {!tasks.length&&<section className="starter"><div><Lightbulb size={22}/><strong>Швидкий старт</strong><span>Можеш додати готовий шаблон, якщо він відповідає твоєму графіку.</span></div><button className="button outline" onClick={()=>void templateVideo()}>+ Rank Daily щодня о 19:00</button></section>}
    </>}
    {page==='allTasks'&&<>
      <div className="intro-row"><div><h1>Усі справи · за датами</h1><p className="subtitle">Вибирай тип завдань — фільтр працює для всіх дат одразу.</p></div></div>
      <div className="hub-all-filters">{[
       {id:'all',title:'Усі завдання',match:(_t:Task)=>true},
       {id:'critical',title:'Термінові',match:(t:Task)=>t.priority==='critical'},
       {id:'high',title:'Важливі',match:(t:Task)=>t.priority==='high'},
       {id:'repeat',title:'Повторювані',match:(t:Task)=>t.recurrence!=='none'},
       {id:'other',title:'Звичайні',match:(t:Task)=>!['critical','high'].includes(t.priority||'normal')&&t.recurrence==='none'}
      ].map(x=><button key={x.id} className={`hub-filter-tile ${allFilter===x.id?'active':''}`} onClick={()=>setAllFilter(x.id as typeof allFilter)}><strong>{x.title}</strong><span>{tasks.filter(x.match).length}</span></button>)}</div>
      <section className="panel list-panel hub-all-by-date">{tasks.some(t=>allFilter==='all'||(allFilter==='critical'?t.priority==='critical':allFilter==='high'?t.priority==='high':allFilter==='repeat'?t.recurrence!=='none':!['critical','high'].includes(t.priority||'normal')&&t.recurrence==='none'))?
        Array.from(new Set(tasks.filter(t=>allFilter==='all'||(allFilter==='critical'?t.priority==='critical':allFilter==='high'?t.priority==='high':allFilter==='repeat'?t.recurrence!=='none':!['critical','high'].includes(t.priority||'normal')&&t.recurrence==='none')).map(t=>t.dueDate))).sort().map(d=><div key={d} className="hub-date-group"><h2><CalendarDays size={18}/>{pretty(d,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2>
        {[{name:'Критично / терміново',which:(t:Task)=>t.priority==='critical'},
          {name:'Важливо',which:(t:Task)=>t.priority==='high'},
          {name:'Щоденні та повторювані',which:(t:Task)=>!['critical','high'].includes(t.priority||'normal')&&t.recurrence!=='none'},
          {name:'Інші справи',which:(t:Task)=>!['critical','high'].includes(t.priority||'normal')&&t.recurrence==='none'}]
         .map(group=>{const matches=tasks.filter(t=>t.dueDate===d&&group.which(t)&&(allFilter==='all'||(allFilter==='critical'?t.priority==='critical':allFilter==='high'?t.priority==='high':allFilter==='repeat'?t.recurrence!=='none':!['critical','high'].includes(t.priority||'normal')&&t.recurrence==='none'))).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
         return matches.length?<div className="hub-task-class" key={group.name}><h3>{group.name} · {matches.length}</h3>{matches.map(t=><div className="hub-compact-record" key={t.id}><span className={`hub-priority priority-${t.priority||'normal'}`}>{priorityNames[t.priority||'normal']}</span><strong>{t.title}</strong><span>{t.time||'Весь день'}</span>{t.recurrence!=='none'&&<span>· {repeatLabels[t.recurrence]}</span>}{t.note&&<small title={t.note}>{t.note.slice(0,100)}</small>}</div>)}</div>:null;})}</div>)
      :<div className="empty"><FolderKanban size={35}/><h3>Для цього фільтра завдань немає</h3><p>Обери іншу категорію.</p></div>}</section>
    </>}
    {page==='power'&&<PowerPage snapshot={snapshot} refresh={refresh} report={setToast}/>}
    {page==='study'&&<PlannerPage categoryFilter="study" heading="Навчання та дедлайни" snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d)=>showAdd('study',d)} onEditTask={showEdit} onDeleteTask={setConfirmTask}/>}
    {page==='planner'&&<PlannerPage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'personal',d,title||'')} onEditTask={showEdit} onDeleteTask={setConfirmTask}/>}
    {page==='projects'&&<ProjectsPage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'personal',d,title||'')}/>}
    {page==='fitness'&&<FitnessPage kind="fitness" snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'sport',d,title||'')}/>}
    {page==='cs2train'&&<FitnessPage kind="cs2" snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'cs2',d,title||'')}/>}
    {page==='youtube'&&<YoutubePage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'rankdaily',d,title||'')}/>}
    {page==='streams'&&<StreamsPage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'twitch',d,title||'')}/>}
    {page==='news'&&<NewsPage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'personal',d,title||'')}/>}
    {page==='music'&&<MusicPage snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'personal',d,title||'')}/>}
    {page==='imports'&&<ChatImportPage hasKey={snapshot.hasKey} report={setToast} onProposal={p=>{setPlan(p);setApproved(p.changes.map((x,i)=>x.valid?i:-1).filter(x=>x>=0));setAiOpen(true);}}/>}
    {page==='studio'&&<RankStudioPage report={setToast}/>}
    {page==='stats'&&<><h1>Твій прогрес</h1><p className="subtitle">Історія за сім днів — без оцінок і зайвого тиску.</p><div className="metrics"><div className="metric"><div className="metric-head">Виконано за тиждень <CheckCheck size={18}/></div><strong>{stats.reduce((s,x)=>s+x.done,0)}</strong><small>Позначок про виконання</small></div><div className="metric"><div className="metric-head">Усього за тиждень <CalendarDays size={18}/></div><strong>{stats.reduce((s,x)=>s+x.all,0)}</strong><small>Запланованих появ завдань</small></div><div className="metric"><div className="metric-head">Виконання <Activity size={18}/></div><strong>{stats.reduce((s,x)=>s+x.all,0)?Math.round(stats.reduce((s,x)=>s+x.done,0)/stats.reduce((s,x)=>s+x.all,0)*100):0}<em>%</em></strong><small>Частка виконаних</small></div></div><section className="panel chart-panel"><h2>Активність за останні 7 днів</h2><div className="bars">{stats.map(x=><div className="bar-col" key={x.date}><div className="bar-bg"><div className="bar-fill" style={{height:`${x.all?Math.round(x.done/x.all*100):0}%`}}/></div><strong>{x.done}/{x.all}</strong><small>{pretty(x.date,{weekday:'short'})}</small></div>)}</div><p className="muted">Статистика базується на твоїх позначках виконання. Невиконані старі завдання можуть переноситися в наступні дні.</p></section></>}
    {page==='stats'&&<section className="panel chart-panel"><h2>Активність за напрямами</h2><div className="hub-stats-categories">{categories.map(c=>{const dayCount=stats.reduce((n,d)=>n+tasks.filter(t=>t.category===c.id&&occurs(t,d.date)).length,0);const doneCount=stats.reduce((n,d)=>n+tasks.filter(t=>t.category===c.id&&occurs(t,d.date)&&isDone(t,d.date)).length,0);return <div key={c.id} className="hub-stat-category"><span>{c.title}</span><div className="task-meter-track"><span style={{width:`${dayCount?Math.round(doneCount/dayCount*100):0}%`}}/></div><strong>{doneCount}/{dayCount}</strong></div>;})}</div><p className="muted">CS2-сесій: {snapshot.workspace.cs2logs.length} · Кардіо: {snapshot.workspace.cardio.length} · Стрімів: {snapshot.workspace.streams.length} · Проєктів: {snapshot.workspace.projects.length}</p></section>}
    {page==='settings'&&<><h1>Налаштування</h1><p className="subtitle">Приватність, нагадування та підключення AI.</p><div className="settings-grid"><section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><KeyRound size={22}/></div><div><h2>OpenAI API</h2><p>Планування з GPT-5 mini</p></div><span className={`status ${snapshot.hasKey?'good':'muted-badge'}`}>{snapshot.hasKey?'Підключено':'Не підключено'}</span></div><label className="field-label">Твій секретний API-ключ</label><div className="key-row"><input type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="sk-..." autoComplete="off"/><button disabled={working||!keyInput.trim()} className="button primary" onClick={()=>void safe(async()=>{await window.lifehub.setKey(keyInput);setKeyInput('');},'Ключ зашифровано і збережено')}><Save size={16}/> Зберегти</button></div>{snapshot.hasKey&&<button className="link-danger" onClick={()=>void safe(()=>window.lifehub.removeKey(),'Ключ видалено')}>Видалити збережений ключ</button>}<div className="hint"><ShieldCheck size={18}/><span>Ключ зберігається зашифрованим системою Windows. Запити надсилаються напряму в OpenAI, не через чужий сервер.</span></div></section><section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><Wallet size={22}/></div><div><h2>Бюджет AI</h2><p>Локальний облік витрат за місяць</p></div></div><div className="budget-top"><strong>${snapshot.spent.toFixed(4)}</strong><span>із ${snapshot.limit.toFixed(2)}</span></div><div className="progress big"><span style={{width:`${Math.min(100,snapshot.spent/snapshot.limit*100)}%`}}/></div><p className="warning">Це лише оцінка витрат LifeHub. Для захисту від перевитрат увімкни <strong>Enforce a hard limit</strong> $5 у налаштуваннях окремого API-проєкту OpenAI. Облік із затримкою може дещо перевищити ліміт.</p></section><section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><Bell size={22}/></div><div><h2>Нагадування</h2><p>Залишайся в курсі справ</p></div></div><div className="toggle-row"><div><strong>Автозапуск із Windows</strong><p>Працює після встановлення програми</p></div><input type="checkbox" checked={snapshot.autostart} onChange={e=>void safe(()=>window.lifehub.setAutostart(e.target.checked))}/></div><div className="toggle-row"><div><strong>Підсумок дня після 21:00</strong><p>Сповіщення, якщо програма відкрита</p></div><input type="checkbox" checked={snapshot.evening} onChange={e=>void safe(()=>window.lifehub.setEvening(e.target.checked))}/></div></section><section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><CloudDownload size={22}/></div><div><h2>Мої дані</h2><p>Резервна копія локальних завдань</p></div></div><button className="button outline" onClick={()=>void safe(()=>window.lifehub.exportData(),'Резервну копію експортовано')}><Download size={17}/> Експортувати JSON</button><p className="muted">У копію не потрапляє API-ключ. Відновлення з копії додамо в наступному оновленні.</p></section></div></>}
    {page==='settings'&&<SmartSettings snapshot={snapshot} refresh={refresh} report={setToast}/>}
    {page==='settings'&&<WorkspaceSettings snapshot={snapshot} refresh={refresh} report={setToast} onAddTask={(d,c,title)=>showAdd(c||'personal',d,title||'')}/>}
    {page==='settings'&&<details className="hub-import-settings"><summary><Layers3 size={18}/> Імпорт історії ChatGPT <span>Відкрити інструмент</span></summary><ChatImportPage hasKey={snapshot.hasKey} report={setToast} onProposal={p=>{setPlan(p);setApproved(p.changes.map((x,i)=>x.valid?i:-1).filter(x=>x>=0));setAiOpen(true);}}/></details>}
    {page==='settings'&&<div className="update-section"><UpdatesPanel initial={snapshot.update} report={setToast}/></div>}
   </div>
  </main>
  {aiOpen&&<><div className="drawer-overlay" onClick={()=>setAiOpen(false)}/><aside className="ai-drawer"><div className="drawer-head"><div className="drawer-title"><div className="ai-mark"><Bot size={22}/></div><div><h2>LifeHub AI</h2><small>Твій помічник із планування</small></div></div><button className="icon-button" onClick={()=>setAiOpen(false)}><X size={20}/></button></div><div className="drawer-scroll"><div className="assistant-message"><Sparkles size={18}/><div>Привіт, братан! Напиши, що хочеш запланувати або перенести. Я запропоную зміни — <strong>нічого не збережеться без твого підтвердження</strong>.</div></div><div className="privacy-note"><ShieldCheck size={16}/><span>Для створення пропозиції OpenAI отримує текст запиту та до 60 твоїх завдань (назви, категорії, дати). Зміни застосовуються лише вручну.</span></div>{plan&&<div className="proposal"><div className="proposal-heading"><Sparkles size={17}/> Пропозиція AI</div><p>{plan.summary}</p>{plan.changes.length?plan.changes.map((item,i)=><label className={`proposal-item ${!item.valid?'invalid':''}`} key={i}><input type="checkbox" checked={approved.includes(i)} disabled={!item.valid} onChange={e=>setApproved(v=>e.target.checked?[...v,i]:v.filter(n=>n!==i))}/><span><strong>{item.action==='create'?'+ Створити':'↪ Перенести'}: {item.title}</strong><small>{item.date}{item.time?' о '+item.time:''} · {categories.find(x=>x.id===item.category)?.title}{!item.valid?' · не можна застосувати':''}</small></span></label>):<p className="muted">AI не запропонував змін. Уточни запит.</p>}{approved.length>0&&<button disabled={working} className="button primary wide" onClick={()=>void applyAI()}><Check size={17}/> Застосувати обрані ({approved.length})</button>}<button className="button outline wide" onClick={()=>setPlan(null)}>Відхилити пропозицію</button></div>}</div><div className="drawer-footer"><label htmlFor="ai-input">Твій запит</label><textarea id="ai-input" rows={4} maxLength={1500} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Наприклад: завтра хочу 1 годину CS2 і підготувати ідеї для Twitch..."/><button className="button bright wide" disabled={!prompt.trim()||aiLoading||!snapshot.hasKey} onClick={()=>void requestAI()}>{aiLoading?'Створюю пропозицію…':<><Sparkles size={17}/> Запропонувати план</>}</button><div className="drawer-cost">{snapshot.hasKey?`Використано ~$${snapshot.spent.toFixed(4)} із $5 цього місяця`:'Спочатку додай API-ключ у налаштуваннях'}</div></div></aside></>}
  {modal&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false);}}><div className="modal"><div className="modal-head"><div><h2>{editing?'Редагування завдання':'Нове завдання'}</h2><p>Деталі твого плану</p></div><button className="icon-button" onClick={()=>setModal(false)}><X size={20}/></button></div><form onSubmit={submit}><label className="field-label">Назва завдання *</label><input required maxLength={120} autoFocus value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Що потрібно зробити?"/><div className="form-pair"><div><label className="field-label">Дата</label><input type="date" required value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></div><div><label className="field-label">Час</label><input type="time" disabled={form.allDay} value={form.time} onChange={e=>setForm({...form,time:e.target.value,allDay:false})}/></div></div><label className="hub-checkbox-line"><input type="checkbox" checked={form.allDay??true} onChange={e=>setForm({...form,allDay:e.target.checked,time:e.target.checked?'':form.time})}/> Подія на весь день (без обмеження 1 годиною)</label><label className="field-label">Орієнтовна тривалість (хвилини, 0 — без оцінки)</label><input type="number" min="0" max="1440" step="5" value={form.durationMin||0} onChange={e=>setForm({...form,durationMin:Number(e.target.value)})}/><div className="form-pair"><div><label className="field-label">Напрям</label><select value={form.category} onChange={e=>setForm({...form,category:e.target.value as Category})}>{categories.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></div><div><label className="field-label">Повторення</label><select value={form.recurrence} onChange={e=>setForm({...form,recurrence:e.target.value as Recurrence})}>{Object.entries(repeatLabels).map(([val,title])=><option key={val} value={val}>{title}</option>)}</select></div></div><div className="form-pair"><div><label className="field-label">Важливість</label><select value={form.priority||'normal'} onChange={e=>setForm({...form,priority:e.target.value as Priority})}>{Object.entries(priorityNames).map(([v,name])=><option key={v} value={v}>{name}</option>)}</select></div><div><label className="field-label">Як відстежувати?</label><select value={form.progressType||'check'} onChange={e=>setForm({...form,progressType:e.target.value as 'check'|'counter'})}><option value="check">Галочка ✓</option><option value="counter">Кількість / прогрес</option></select></div></div>{form.progressType==='counter'&&<div className="form-pair"><div><label className="field-label">Ціль</label><input type="number" min="1" max="1000000" step="any" value={form.target??1} onChange={e=>setForm({...form,target:Number(e.target.value)})}/></div><div><label className="field-label">Одиниця (мл, км, повторів…)</label><input maxLength={24} value={form.unit||''} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="мл"/></div></div>}<label className="field-label">Нотатка</label><textarea rows={3} value={form.note} maxLength={500} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Необов'язково"/><div className="modal-actions"><button type="button" className="button outline" onClick={()=>setModal(false)}>Скасувати</button><button type="submit" disabled={working} className="button primary"><Save size={16}/> Зберегти</button></div></form></div></div>}
  {confirmTask&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmTask(null);}}><div className="modal hub-confirm-modal"><div className="modal-head"><div><h2>Видалити справу?</h2><p>{confirmTask.title}</p></div><button className="icon-button" onClick={()=>setConfirmTask(null)}><X size={20}/></button></div><p>Ця дія прибере запис із твого календаря та історії.</p><div className="modal-actions"><button className="button outline" onClick={()=>setConfirmTask(null)}>Залишити</button><button className="button danger" onClick={()=>{const id=confirmTask.id;setConfirmTask(null);void safe(()=>window.lifehub.deleteTask(id),'Справу видалено');}}>Видалити</button></div></div></div>}
  {toast&&<div className="toast"><CircleHelp size={17}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
