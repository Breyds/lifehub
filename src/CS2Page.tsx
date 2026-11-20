import {useMemo,useState} from 'react';
import {Activity,BarChart3,BookOpen,CalendarDays,Camera,Check,CheckCircle2,ChevronDown,Clock3,Crosshair,ExternalLink,FileVideo,Flag,Flame,Gamepad2,Image as ImageIcon,Info,KeyRound,Link2,LoaderCircle,Plus,RefreshCw,Save,ShieldAlert,Sparkles,Target,Trash2,Upload,Users,X} from 'lucide-react';
import type {CS2Goals,CS2Utility,Snapshot,WorkspaceItem} from './types';
import './cs2-studio.css';

type Props={snapshot:Snapshot;refresh:()=>Promise<void>;report:(message:string)=>void};
type Page='overview'|'sessions'|'faceit'|'demos'|'utility'|'analytics';
type Session={id:string;title:string;date:string;mode:string;map:string;duration:number|null;kills:number|null;deaths:number|null;headshots:number|null;hsPercent:number|null;accuracy:number|null;assists:number|null;rating:number|null;dmKills:number|null;botKills:number|null;matches:number|null;note:string;imageId:string};
const mapList=['Mirage','Dust2','Inferno','Nuke','Ancient','Anubis','Overpass','Cache','Train','Vertigo','Other'];
const modeList=[{id:'dm',name:'Deathmatch'},{id:'bots',name:'Боти'},{id:'aim',name:'Aim-тренування'},{id:'match',name:'Матч'},{id:'utility',name:'Гранати'},{id:'other',name:'Інше'}];
const types=[{id:'smoke',label:'Smoke'},{id:'flash',label:'Flash'},{id:'molotov',label:'Molotov'},{id:'he',label:'HE'}] as const;
const defaultGoals:CS2Goals={dmKills:500,botKills:1000,matches:5,minutes:120};
const defaultWeek:CS2Goals={dmKills:3500,botKills:7000,matches:20,minutes:840};
const fmt=(n:number,d=0)=>Number.isFinite(n)?n.toLocaleString('uk-UA',{maximumFractionDigits:d}):'—';
const value=(raw:unknown)=>{const v=Number(raw);return raw===null||raw===undefined||raw===''||!Number.isFinite(v)?0:v;};
const numeric=(raw:unknown)=>raw===null||raw===undefined||raw===''?null:Number.isFinite(Number(raw))?Number(raw):null;
const pad=(n:number)=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const shift=(date:string,n:number)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const startWeek=(date:string)=>{const d=new Date(date+'T12:00:00');return shift(date,-(d.getDay()+6)%7);};
const clean=(x:WorkspaceItem):Session=>({id:x.id,title:String(x.title||'CS2 тренування'),date:String(x.date||''),mode:String(x.mode||(Number(x.dmKills)?'dm':Number(x.botKills)?'bots':'other')),map:String(x.map||'Other'),duration:numeric(x.duration),kills:numeric(x.kills),deaths:numeric(x.deaths),headshots:numeric(x.headshots),hsPercent:numeric(x.hsPercent),accuracy:numeric(x.accuracy),assists:numeric(x.assists),rating:numeric(x.rating),dmKills:numeric(x.dmKills),botKills:numeric(x.botKills),matches:numeric(x.matches),note:String(x.note||''),imageId:String(x.imageId||'')});
const sum=(items:Session[],field:keyof Session)=>items.reduce((n,x)=>n+value(x[field]),0);
const goalLabels:{key:keyof CS2Goals;name:string;unit:string;icon:typeof Target}[]=[{key:'dmKills',name:'DM-фраги',unit:'фрагів',icon:Crosshair},{key:'botKills',name:'Боти',unit:'фрагів',icon:Target},{key:'matches',name:'Матчі',unit:'матчів',icon:Gamepad2},{key:'minutes',name:'Практика',unit:'хв',icon:Clock3}];
const periodStat=(items:Session[],key:keyof CS2Goals)=>key==='minutes'?sum(items,'duration'):sum(items,key);
const guideMaps=['Mirage','Dust2','Nuke','Inferno','Ancient','Anubis','Overpass','Cache'];
const curated:{map:string;title:string;type:'smoke'|'flash'|'molotov'|'he';why:string}[]=[
 {map:'Mirage',title:'Window smoke з T-spawn',type:'smoke',why:'Контроль mid та свобода руху для команди'},
 {map:'Mirage',title:'Connector smoke',type:'smoke',why:'Відрізати ротацію CT під вихід на A'},
 {map:'Mirage',title:'CT smoke на A',type:'smoke',why:'Безпечніший захід із Ramp/Palace'},
 {map:'Inferno',title:'Banana control molotov',type:'molotov',why:'Відтіснити ранні позиції захисту'},
 {map:'Inferno',title:'CT smoke на B',type:'smoke',why:'Вихід із Banana на B'},
 {map:'Dust2',title:'Xbox smoke',type:'smoke',why:'Контроль переходу з mid на short'},
 {map:'Dust2',title:'Long cross smoke',type:'smoke',why:'Допомагає команді зайняти A'},
 {map:'Nuke',title:'Outside crossing smokes',type:'smoke',why:'Перехід T-команди назовні'},
 {map:'Ancient',title:'Mid control smoke',type:'smoke',why:'Зменшує кількість відкритих кутів у mid'},
 {map:'Anubis',title:'B entrance smoke',type:'smoke',why:'Підготовка виходу на B'}
];
const guideUrl=(map:string)=>'https://csnades.gg/'+(map==='Dust2'?'dust2':map.toLowerCase());
const humanDate=(date:string)=>date?new Date(date+'T12:00:00').toLocaleDateString('uk-UA',{day:'numeric',month:'short'}):'—';
const startForm=()=>({title:'DM · тренування',date:today(),mode:'dm',map:'Other',duration:'',kills:'',deaths:'',headshots:'',hsPercent:'',accuracy:'',assists:'',rating:'',matches:'',note:'',imageId:''});
type FormState=ReturnType<typeof startForm>;
const tabs:{id:Page;name:string;icon:typeof Target}[]=[{id:'overview',name:'Мій прогрес',icon:Target},{id:'sessions',name:'Журнал',icon:BookOpen},{id:'faceit',name:'FACEIT',icon:Users},{id:'demos',name:'Демки',icon:FileVideo},{id:'utility',name:'Гранати',icon:Flame},{id:'analytics',name:'Аналітика',icon:BarChart3}];

function Meter({current,target}:{current:number;target:number}){return <div className="cs2-meter"><span style={{width:Math.min(100,100*current/Math.max(1,target))+'%'}}/></div>;}
function StatCard({title,number,subtitle,icon:Icon}:{title:string;number:string;subtitle:string;icon:typeof Target}){return <div className="cs2-stat"><Icon size={22}/><div><strong>{number}</strong><span>{title}</span><small>{subtitle}</small></div></div>;}
function goalsSummary(logs:Session[],targets:CS2Goals){return goalLabels.map(g=>({...g,current:periodStat(logs,g.key),target:targets[g.key]||0}));}

export function CS2Page({snapshot,refresh,report}:Props){
 const [tab,setTab]=useState<Page>('overview');
 const logs=useMemo(()=>snapshot.workspace.cs2logs.map(clean).sort((a,b)=>b.date.localeCompare(a.date)),[snapshot.workspace.cs2logs]);
 const [goals,setGoals]=useState<CS2Goals>(snapshot.preferences.cs2Targets||defaultGoals);
 const [weekly,setWeekly]=useState<CS2Goals>(snapshot.preferences.cs2WeeklyTargets||defaultWeek);
 const [goalEditing,setGoalEditing]=useState(false);
 const [saving,setSaving]=useState(false);
 const [recordId,setRecordId]=useState<string|null>(null);
 const [form,setForm]=useState<FormState>(startForm);
 const [preview,setPreview]=useState('');
 const [screenshotBusy,setScreenshotBusy]=useState(false);
 const [faceitKey,setFaceitKey]=useState('');
 const [faceitNick,setFaceitNick]=useState(snapshot.cs2.faceitNickname||'');
 const [faceitBusy,setFaceitBusy]=useState(false);
 const [demoBusy,setDemoBusy]=useState(false);
 const [demoNotes,setDemoNotes]=useState<Record<string,string>>({});
 const [coachPrompt,setCoachPrompt]=useState('Перевір мої останні тренування й FACEIT-матчі. Дай 3 конкретні рекомендації, як підвищити стабільність у дуелях.');
 const [coachAnswer,setCoachAnswer]=useState('');
 const [coachBusy,setCoachBusy]=useState(false);
 const [mapFilter,setMapFilter]=useState('all');
 const [utilityDraft,setUtilityDraft]=useState({title:'',map:'Mirage',type:'smoke' as CS2Utility['type'],url:'',note:''});
 const [utilityBusy,setUtilityBusy]=useState(false);
 const now=today(),week=startWeek(now),weekEnd=shift(week,6);
 const todayLogs=logs.filter(x=>x.date===now),weekLogs=logs.filter(x=>x.date>=week&&x.date<=weekEnd);
 const daily=goalsSummary(todayLogs,goals),weeklyNow=goalsSummary(weekLogs,weekly);
 const faceit=snapshot.cs2.faceitData;
 const maps=useMemo(()=>{
  const collected=new Map<string,{map:string;sessions:number;kills:number;deaths:number;faceitGames:number;wins:number;hs:number;hsCount:number}>();
  for(const x of logs){const map=mapList.includes(x.map)?x.map:'Other',row=collected.get(map)||{map,sessions:0,kills:0,deaths:0,faceitGames:0,wins:0,hs:0,hsCount:0};row.sessions++;row.kills+=value(x.kills);row.deaths+=value(x.deaths);if(x.hsPercent!==null){row.hs+=x.hsPercent;row.hsCount++;}collected.set(map,row);}
  for(const x of faceit?.matches||[]){const map=mapList.includes(x.map)?x.map:'Other',row=collected.get(map)||{map,sessions:0,kills:0,deaths:0,faceitGames:0,wins:0,hs:0,hsCount:0};row.faceitGames++;row.wins+=x.win?1:0;row.kills+=value(x.kills);row.deaths+=value(x.deaths);if(x.hsPercent!==null){row.hs+=x.hsPercent;row.hsCount++;}collected.set(map,row);}
  return [...collected.values()].sort((a,b)=>b.sessions+b.faceitGames-a.sessions-a.faceitGames);
 },[logs,faceit]);
 const last14=Array.from({length:14},(_,i)=>shift(now,i-13)).map(date=>({date,dm:sum(logs.filter(x=>x.date===date),'dmKills'),bots:sum(logs.filter(x=>x.date===date),'botKills'),matches:sum(logs.filter(x=>x.date===date),'matches')}));
 const topDM=Math.max(1,...last14.map(x=>x.dm));
 const own= (faceit?.matches||[]).length;
 const covered=logs.filter(x=>x.imageId).length;
 const last7=Array.from({length:7},(_,i)=>shift(now,i-6)).map(date=>({date,trained:logs.some(x=>x.date===date&&((x.duration||0)>0||value(x.dmKills)>0||value(x.botKills)>0||value(x.matches)>0))}));
 async function run(label:string,call:()=>Promise<unknown>){setSaving(true);try{await call();await refresh();report(label);}catch(e){report(String(e instanceof Error?e.message:e));}finally{setSaving(false);}}
 const editSession=async(item:Session)=>{
  setRecordId(item.id);
  setForm({title:item.title,date:item.date,mode:item.mode,map:item.map,duration:String(item.duration??''),kills:String(item.kills??''),deaths:String(item.deaths??''),headshots:String(item.headshots??''),hsPercent:String(item.hsPercent??''),accuracy:String(item.accuracy??''),assists:String(item.assists??''),rating:String(item.rating??''),matches:String(item.matches??''),note:item.note,imageId:item.imageId});
  setPreview('');
  if(item.imageId)try{setPreview(await window.lifehub.cs2ReadImage(item.imageId));}catch{}
  setTab('sessions');
  window.scrollTo({top:0,behavior:'smooth'});
 };
 const reset=()=>{setForm(startForm());setRecordId(null);setPreview('');};
 async function screenshot(){
  setScreenshotBusy(true);
  try{const v=await window.lifehub.cs2ImportImage();if(v){setPreview(v.preview);setForm(x=>({...x,imageId:v.id}));report('Скріншот додано локально. Можеш розпізнати AI або заповнити дані вручну.');}}
  catch(e){report(String(e));}finally{setScreenshotBusy(false);}
 }
 async function readScreenshot(){
  if(!form.imageId)return;
  setScreenshotBusy(true);try{const v=await window.lifehub.cs2AnalyzeImage(form.imageId);
   setForm(x=>({...x,mode:v.mode,map:v.map,kills:v.kills===null?'':String(v.kills),deaths:v.deaths===null?'':String(v.deaths),headshots:v.headshots===null?'':String(v.headshots),hsPercent:v.hsPercent===null?'':String(v.hsPercent),accuracy:v.accuracy===null?'':String(v.accuracy),assists:v.assists===null?'':String(v.assists),rating:v.rating===null?'':String(v.rating),duration:v.duration===null?'':String(v.duration),matches:v.matches===null?'':String(v.matches),note:[x.note,v.note].filter(Boolean).join('\n').slice(0,1500)}));
   report('AI заповнив чернетку ('+v.confidence+'). Перевір цифри перед збереженням.');await refresh();
  }catch(e){report(String(e));}finally{setScreenshotBusy(false);}
 }
 async function saveSession(){
  if(!form.title.trim())return report('Додай назву заняття');
  const payload={...form,title:form.title.trim(),date:form.date,mode:form.mode,practice:modeList.find(x=>x.id===form.mode)?.name||'CS2',note:form.note};
  await run('Заняття збережено',()=>recordId?window.lifehub.editWorkspace('cs2logs',recordId,payload):window.lifehub.addWorkspace('cs2logs',payload));
  reset();
 }
 async function fetchFaceit(){
  setFaceitBusy(true);try{
   if(faceitKey.trim()){await window.lifehub.cs2SaveFaceitKey(faceitKey.trim());setFaceitKey('');}
   const result=await window.lifehub.cs2SyncFaceit(faceitNick.trim());await refresh();report('FACEIT: отримано '+result.matches.length+' детальних результатів із '+result.historyCount+' записів історії.');
  }catch(e){report(String(e instanceof Error?e.message:e));}finally{setFaceitBusy(false);}
 }
 async function askCoach(){
  setCoachBusy(true);try{const r=await window.lifehub.cs2Coach(coachPrompt);setCoachAnswer(r.text);await refresh();}catch(e){report(String(e));}finally{setCoachBusy(false);}
 }
 async function storeUtility(raw:Partial<CS2Utility>,label='Гранату збережено'){setUtilityBusy(true);try{await window.lifehub.cs2SaveUtility(raw);await refresh();report(label);}catch(e){report(String(e));}finally{setUtilityBusy(false);}}
 function openUrl(url:string){void window.lifehub.openLink(url).catch(e=>report(String(e)));}
 return <div className="cs2-studio hub-workspace">
   <header className="cs2-hero"><div><span className="cs2-eyebrow"><Crosshair size={15}/> PERFORMANCE / CS2 LAB</span><h1>Грай з метою. <em>Прокачуй результат.</em></h1><p>Тренування, скріншоти, FACEIT, гранати й відстеження росту — в одному місці.</p></div><div className="cs2-hero-side"><span><Activity size={15}/> {logs.length} занять у журналі</span><button onClick={()=>{reset();setTab('sessions');}}><Plus size={17}/> Записати результат</button></div></header>
   <div className="cs2-tabbar">{tabs.map(item=>{const Icon=item.icon;return <button key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}><Icon size={17}/>{item.name}</button>;})}</div>
   {tab==='overview'&&<>
     <div className="cs2-stats-grid"><StatCard title="DM за тиждень" number={fmt(sum(weekLogs,'dmKills'))} subtitle="Підтверджено твоїми записами" icon={Crosshair}/><StatCard title="Боти за тиждень" number={fmt(sum(weekLogs,'botKills'))} subtitle="Завдані вбивства" icon={Target}/><StatCard title="Зіграні матчі" number={fmt(sum(weekLogs,'matches'))} subtitle="З ручного журналу" icon={Gamepad2}/><StatCard title="Хвилини тренувань" number={fmt(sum(weekLogs,'duration'))} subtitle={week+' — '+weekEnd} icon={Clock3}/></div>
     <section className="cs2-panel"><div className="cs2-panel-head"><div><span className="cs2-eyebrow">DISCIPLINE / GOALS</span><h2>Щоденні й тижневі цілі</h2><p>Ураховуються тільки записані тренування, а не проведені в грі години автоматично.</p></div><button className="cs2-ghost" onClick={()=>setGoalEditing(x=>!x)}><Target size={16}/> {goalEditing?'Готово':'Налаштувати'}</button></div>
      <div className="cs2-goals-grid">{([{name:'Сьогодні',items:daily,goals,set:setGoals},{name:'Цей тиждень',items:weeklyNow,goals:weekly,set:setWeekly}] as const).map(section=><div className="cs2-goal-column" key={section.name}><h3><Flag size={17}/>{section.name}</h3>{section.items.map(g=><div className="cs2-goal" key={g.key}><div><span>{g.name}</span>{goalEditing?<input aria-label={section.name+' ціль '+g.name} type="number" min="0" max="100000" value={section.goals[g.key]} onChange={e=>section.set(x=>({...x,[g.key]:Number(e.target.value)||0}))}/>:<strong>{fmt(g.current)} / {fmt(g.target)} <small>{g.unit}</small></strong>}</div><Meter current={g.current} target={g.target}/></div>)}</div>)}</div>
      {goalEditing&&<button className="cs2-primary" disabled={saving} onClick={()=>void run('Цілі на день і тиждень збережено',()=>window.lifehub.setPreferences({cs2Targets:goals,cs2WeeklyTargets:weekly}))}><Save size={16}/> Зберегти цілі</button>}
     </section>
     <div className="cs2-two"><section className="cs2-panel"><div className="cs2-panel-head"><div><h2>Останні 7 днів</h2><p>Чесна історія тренувань, без штрафів за відпочинок.</p></div></div><div className="cs2-days">{last7.map(x=><div className={'cs2-day '+(x.trained?'trained':'')} key={x.date}><span>{new Date(x.date+'T12:00:00').toLocaleDateString('uk-UA',{weekday:'short'})}</span><b>{x.trained?<Check size={20}/>:<span>–</span>}</b><small>{humanDate(x.date)}</small></div>)}</div><label className="cs2-notify"><input type="checkbox" checked={snapshot.cs2.reminders} onChange={e=>void run('Нагадування оновлено',()=>window.lifehub.cs2SetReminders(e.target.checked))}/> Нагадувати після 20:00, якщо немає запису тренування <span>(Telegram, якщо підключений)</span></label></section>
     <section className="cs2-panel"><div className="cs2-panel-head"><div><h2>Швидкий старт</h2><p>Те, що найбільше допоможе бачити свій прогрес.</p></div></div><div className="cs2-action-list"><button onClick={()=>{reset();setTab('sessions');}}><Camera size={19}/><span><strong>Завантажити скріншот</strong><small>DM, боти, матчі — з розпізнаванням після твоєї згоди</small></span><ChevronDown size={16}/></button><button onClick={()=>setTab('faceit')}><Users size={19}/><span><strong>Підключити FACEIT</strong><small>ELO, останні матчі, статистика по картах</small></span><ChevronDown size={16}/></button><button onClick={()=>setTab('utility')}><Flame size={19}/><span><strong>Вивчити 1 гранату</strong><small>Посилання на реальні гіди CSNADES</small></span><ChevronDown size={16}/></button></div></section></div>
   </>}
   {tab==='sessions'&&<div className="cs2-two cs2-session-layout"><section className="cs2-panel"><div className="cs2-panel-head"><div><span className="cs2-eyebrow">TRAINING LOG</span><h2>{recordId?'Редагування заняття':'Запис результату'}</h2><p>Введи реальну статистику або додай скріншот. Невідомі цифри залишай порожніми.</p></div>{recordId&&<button className="cs2-ghost" onClick={reset}><X size={16}/> Скасувати</button>}</div>
    <div className="cs2-form">
     <label className="wide">Назва<input value={form.title} maxLength={130} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></label>
     <label>Дата<input type="date" value={form.date} min="2000-01-01" max={now} onChange={e=>setForm(v=>({...v,date:e.target.value}))}/></label>
     <label>Режим<select value={form.mode} onChange={e=>setForm(v=>({...v,mode:e.target.value,title:modeList.find(z=>z.id===e.target.value)?.name||v.title}))}>{modeList.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>
     <label>Карта<select value={form.map} onChange={e=>setForm(v=>({...v,map:e.target.value}))}>{mapList.map(x=><option key={x}>{x}</option>)}</select></label>
     {([{k:'kills',n:'Вбивства'},{k:'deaths',n:'Смерті'},{k:'headshots',n:'Хедшоти (кількість)'},{k:'hsPercent',n:'HS %'},{k:'assists',n:'Асисти'},{k:'accuracy',n:'Accuracy %'},{k:'rating',n:'Rating'},{k:'duration',n:'Тривалість, хв'},{k:'matches',n:'Матчів'}] as const).map(({k,n})=><label key={k}>{n}<input type="number" min="0" max={k==='duration'?600:k==='hsPercent'||k==='accuracy'?100:k==='rating'?5:100000} step={['hsPercent','accuracy','rating'].includes(k)?'0.01':'1'} placeholder="Необов'язково" value={form[k]} onChange={e=>setForm(v=>({...v,[k]:e.target.value}))}/></label>)}
     <label className="wide">Висновки й помилки<textarea rows={3} value={form.note} maxLength={1500} placeholder="Що вийшло, де помилявся, що тренувати завтра…" onChange={e=>setForm(v=>({...v,note:e.target.value}))}/></label>
    </div>
    <div className="cs2-photo"><div className="cs2-photo-actions"><button className="cs2-ghost" disabled={screenshotBusy} onClick={()=>void screenshot()}><Upload size={16}/> Додати скрін</button><button className="cs2-ghost" disabled={!form.imageId||screenshotBusy||!snapshot.hasKey} onClick={()=>void readScreenshot()}>{screenshotBusy?<LoaderCircle size={16}/>:<Sparkles size={16}/>} Розпізнати AI</button></div>{preview&&<img src={preview} alt="Скріншот статистики CS2"/>}<p><Info size={14}/> AI заповнює лише чернетку. Перевір цифри; витрати API списуються тільки після кнопки «Розпізнати».</p></div>
    <button className="cs2-primary cs2-save-session" disabled={saving||!form.title||!form.date} onClick={()=>void saveSession()}><Save size={17}/>{saving?'Збереження…':recordId?'Зберегти зміни':'Зберегти заняття'}</button></section>
    <section className="cs2-panel cs2-session-history"><div className="cs2-panel-head"><div><h2>Журнал занять</h2><p>{logs.length} записів, збережено локально</p></div><span className="cs2-chip">{covered} зі скрінами</span></div><div className="cs2-records">{logs.slice(0,90).map(row=><div className="cs2-record" key={row.id}><div><span className="cs2-record-date">{humanDate(row.date)} · {row.map} · {modeList.find(x=>x.id===row.mode)?.name||'Тренування'}</span><strong>{row.title}</strong><small>{row.kills!==null?row.kills+' kills · ':''}{row.deaths!==null?row.deaths+' deaths · ':''}{row.hsPercent!==null?fmt(row.hsPercent,1)+'% HS · ':''}{row.duration!==null?row.duration+' хв':''}{row.imageId?' · 📷':''}</small>{row.note&&<p>{row.note}</p>}</div><div><button title="Редагувати" onClick={()=>void editSession(row)}><PencilIcon/></button><button title="Видалити" onClick={()=>{if(window.confirm('Видалити цей запис?'))void run('Запис видалено',()=>window.lifehub.deleteWorkspace('cs2logs',row.id));}}><Trash2 size={17}/></button></div></div>)}{!logs.length&&<p className="cs2-muted">Ще немає занять. Додай перший DM, тренування ботів або результат матчу.</p>}</div></section></div>}
   {tab==='faceit'&&<><section className="cs2-panel"><div className="cs2-panel-head"><div><span className="cs2-eyebrow">OFFICIAL DATA</span><h2>FACEIT · Твій профіль</h2><p>Офіційний FACEIT Data API. Дані надходять безпосередньо з FACEIT, а ключ зберігається зашифрованим у Windows.</p></div>{snapshot.cs2.faceitConnected&&<button className="cs2-ghost" onClick={()=>{if(window.confirm('Від’єднати FACEIT і очистити отриману статистику?'))void run('FACEIT відключено',()=>window.lifehub.cs2DisconnectFaceit());}}>Відключити</button>}</div><div className="cs2-faceit-connect">
     {!snapshot.cs2.faceitConnected&&<label>FACEIT API key (окремий ключ розробника)<input type="password" autoComplete="off" placeholder="Встав ключ із developers.faceit.com" value={faceitKey} onChange={e=>setFaceitKey(e.target.value)}/></label>}
     <label>Мій нік FACEIT<input value={faceitNick} maxLength={40} placeholder="Нік у FACEIT" onChange={e=>setFaceitNick(e.target.value)}/></label>
     <button className="cs2-primary" disabled={faceitBusy||!faceitNick.trim()||(!snapshot.cs2.faceitConnected&&!faceitKey.trim())} onClick={()=>void fetchFaceit()}>{faceitBusy?<LoaderCircle size={17}/>:<RefreshCw size={17}/>} {faceitBusy?'Завантажую…':'Підключити / оновити'}</button>
    </div><div className="cs2-footnote"><KeyRound size={15}/> Це не пароль від акаунта. Ключ створюється у <button onClick={()=>openUrl('https://developers.faceit.com/')}>FACEIT Developers <ExternalLink size={13}/></button>. Без ключа імпорт статистики не працює, але ручний журнал повністю доступний.</div></section>
    {faceit&&<><div className="cs2-faceit-profile"><div className="cs2-faceit-avatar">{faceit.player.avatar?<img src={faceit.player.avatar} alt="Аватар FACEIT"/>:<Users size={27}/>}</div><div><span>FACEIT PROFILE</span><h2>{faceit.player.nickname}</h2><p>{faceit.player.region||'Регіон невідомий'} · перевірено {new Date(faceit.checkedAt).toLocaleString('uk-UA')}</p></div><div className="cs2-faceit-elo"><strong>{faceit.player.elo??'—'}</strong><span>ELO · LEVEL {faceit.player.level??'—'}</span></div><button onClick={()=>openUrl(faceit.player.url)}><ExternalLink size={18}/></button></div>
      <div className="cs2-two"><section className="cs2-panel"><div className="cs2-panel-head"><div><h2>Останні детальні матчі</h2><p>{faceit.matches.length} карт · опубліковані FACEIT метрики</p></div></div><div className="cs2-faceit-games">{faceit.matches.map(m=><div key={m.id+'-'+m.map}><span className={'cs2-outcome '+(m.win?'win':'loss')}>{m.win?'W':'L'}</span><strong>{m.map}</strong><span>{m.kills??'–'} / {m.deaths??'–'} / {m.assists??'–'}</span><small>{m.hsPercent===null?'HS —':m.hsPercent+'% HS'} · {m.rating===null?'rating —':m.rating+' rating'}</small><button title="Відкрити матч" onClick={()=>openUrl('https://www.faceit.com/en/cs2/room/'+encodeURIComponent(m.id))}><ExternalLink size={16}/></button></div>)}{!faceit.matches.length&&<p className="cs2-muted">У останніх матчах не знайдено детальної статистики. Це не означає, що матчів немає.</p>}</div></section>
      <section className="cs2-panel"><h2>Підтверджені метрики</h2><div className="cs2-faceit-lifetime">{Object.entries(faceit.overview).slice(0,18).map(([k,v])=><div key={k}><span>{k}</span><strong>{String(v??'—').slice(0,90)}</strong></div>)}</div><p className="cs2-muted">{faceit.note}</p></section></div>
    </>}
   </>}
   {tab==='demos'&&<><section className="cs2-panel"><div className="cs2-panel-head"><div><span className="cs2-eyebrow">MATCH REVIEW</span><h2>Демки FACEIT / CS2</h2><p>Завантажуй файли демо, занотовуй раунди й ситуації для AI-тренера.</p></div><button className="cs2-primary" disabled={demoBusy} onClick={async()=>{setDemoBusy(true);try{const d=await window.lifehub.cs2ImportDemo();if(d){await refresh();report('Демку збережено локально. Для автоматичних ігрових подій потрібен Source 2 парсер.');}}catch(e){report(String(e));}finally{setDemoBusy(false);}}}><Upload size={17}/>{demoBusy?'Імпорт…':'Додати .dem / .gz / .zip'}</button></div><div className="cs2-notice"><ShieldAlert size={19}/><span><strong>Важливо:</strong> зберігання демки вже працює, але автоматичний покадровий парсер Source 2 ще не інтегровано. AI не аналізує невидимі раунди або позиціонування; він може коментувати твої позначені моменти й наявну статистику FACEIT.</span></div>
    <div className="cs2-demo-list">{snapshot.cs2.demos.map(d=><div className="cs2-demo" key={d.id}><div className="cs2-demo-header"><FileVideo size={23}/><div><strong>{d.title}</strong><small>{fmt(d.bytes/1048576,1)} МБ · {humanDate(d.addedAt.slice(0,10))} · чекає сумісний парсер</small></div></div><p>{d.note}</p>{(d.moments||[]).map(m=><div className="cs2-demo-moment" key={m.id}><Clock3 size={14}/>{m.text}</div>)}<form onSubmit={e=>{e.preventDefault();if(!demoNotes[d.id]?.trim())return;void run('Момент додано',()=>window.lifehub.cs2DemoNote(d.id,demoNotes[d.id])).then(()=>setDemoNotes(v=>({...v,[d.id]:''})));}}><input value={demoNotes[d.id]||''} placeholder="Раунд 8 · 01:12 — програв дуель на B, опис…" maxLength={1800} onChange={e=>setDemoNotes(v=>({...v,[d.id]:e.target.value}))}/><button disabled={!demoNotes[d.id]?.trim()}><Plus size={16}/> Момент</button></form></div>)}{!snapshot.cs2.demos.length&&<p className="cs2-muted">Ще немає демо. Скачай .dem із матчу FACEIT та додай його тут.</p>}</div></section>
     <section className="cs2-panel cs2-coach"><div className="cs2-panel-head"><div><h2><Sparkles size={19}/> AI-розбір за наявними даними</h2><p>Показує конкретні висновки за ручними результатами, FACEIT і твоїми нотатками до раундів.</p></div></div><textarea value={coachPrompt} rows={4} onChange={e=>setCoachPrompt(e.target.value)} maxLength={1500}/><button className="cs2-primary" disabled={coachBusy||!snapshot.hasKey} onClick={()=>void askCoach()}><Sparkles size={17}/>{coachBusy?'Аналізую…':'Запросити розбір'}</button>{!snapshot.hasKey&&<p className="cs2-muted">Потрібен OpenAI API у налаштуваннях ($5 загальний бюджет).</p>}{coachAnswer&&<pre className="cs2-ai-answer">{coachAnswer}</pre>}</section>
    </>}
   {tab==='utility'&&<><section className="cs2-panel"><div className="cs2-panel-head"><div><span className="cs2-eyebrow">UTILITY LAB</span><h2>Бібліотека гранат</h2><p>Підбирай потрібні гранати, вивчай техніку за відео та позначай, скільки разів повторив.</p></div><span className="cs2-chip"><CheckCircle2 size={14}/> {snapshot.cs2.utilities.filter(x=>x.learned).length} вивчено</span></div><div className="cs2-map-filters"><button className={mapFilter==='all'?'active':''} onClick={()=>setMapFilter('all')}>Усі карти</button>{guideMaps.map(m=><button key={m} className={mapFilter===m?'active':''} onClick={()=>setMapFilter(m)}>{m}</button>)}</div><h3>Рекомендовано почати</h3><div className="cs2-utility-grid">{curated.filter(c=>mapFilter==='all'||c.map===mapFilter).map(c=><div className="cs2-utility-card" key={c.map+c.title}><span><Flame size={17}/>{c.map} · {c.type}</span><strong>{c.title}</strong><p>{c.why}</p><div><button onClick={()=>openUrl(guideUrl(c.map))}><ExternalLink size={15}/> Відеогіди</button><button onClick={()=>void storeUtility({title:c.title,map:c.map,type:c.type,url:guideUrl(c.map),note:c.why},'Гранату додано до практики')}><Plus size={15}/> У мої</button></div></div>)}</div><p className="cs2-muted">Відео/лінії кидка потрібно перевірити в актуальній версії гри; кнопка відкриває сторінку конкретної карти в CSNADES, а не вигаданий нами таймінг.</p></section>
      <div className="cs2-two"><section className="cs2-panel"><div className="cs2-panel-head"><div><h2>Моя практика гранат</h2><p>Заведи власний чекліст та рахуй повторення.</p></div></div><div className="cs2-utility-saved">{snapshot.cs2.utilities.filter(u=>mapFilter==='all'||u.map===mapFilter).map(u=><div key={u.id} className={'cs2-utility-row '+(u.learned?'learned':'')}><button title="Перемкнути вивчення" onClick={()=>void storeUtility({...u,learned:!u.learned},'Статус гранати оновлено')}>{u.learned?<Check size={18}/>:<span/>}</button><div><strong>{u.title}</strong><small>{u.map} · {u.type} · {u.reps} повторень</small></div><button title="+1 практика" onClick={()=>void storeUtility({...u,reps:u.reps+1},'Повторення додано')}>+1</button>{u.url&&<button title="Відкрити відеогід" onClick={()=>openUrl(u.url)}><Link2 size={15}/></button>}<button title="Видалити" onClick={()=>void run('Гранату видалено',()=>window.lifehub.cs2DeleteUtility(u.id))}><Trash2 size={16}/></button></div>)}{!snapshot.cs2.utilities.length&&<p className="cs2-muted">Додай гранату із прикладів або створи власну.</p>}</div></section>
      <section className="cs2-panel"><h2>Додати свою гранату</h2><div className="cs2-form"><label className="wide">Назва<input value={utilityDraft.title} placeholder="Наприклад, smoke Window зі spawn" maxLength={130} onChange={e=>setUtilityDraft(x=>({...x,title:e.target.value}))}/></label><label>Карта<select value={utilityDraft.map} onChange={e=>setUtilityDraft(x=>({...x,map:e.target.value}))}>{mapList.map(m=><option key={m}>{m}</option>)}</select></label><label>Тип<select value={utilityDraft.type} onChange={e=>setUtilityDraft(x=>({...x,type:e.target.value as CS2Utility['type']}))}>{types.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label><label className="wide">URL відео чи гайду<input value={utilityDraft.url} placeholder="https://…" onChange={e=>setUtilityDraft(x=>({...x,url:e.target.value}))}/></label><label className="wide">Для чого й як тренувати<textarea rows={3} value={utilityDraft.note} onChange={e=>setUtilityDraft(x=>({...x,note:e.target.value}))}/></label></div><button className="cs2-primary" disabled={utilityBusy||!utilityDraft.title.trim()} onClick={()=>void storeUtility(utilityDraft).then(()=>setUtilityDraft({title:'',map:utilityDraft.map,type:'smoke',url:'',note:''}))}><Save size={16}/> Зберегти</button></section></div></>}
   {tab==='analytics'&&<><div className="cs2-stats-grid"><StatCard title="Сесій загалом" number={fmt(logs.length)} subtitle="Ручний журнал" icon={CalendarDays}/><StatCard title="Середній HS" number={fmt(logs.filter(x=>x.hsPercent!==null).reduce((n,x)=>n+value(x.hsPercent),0)/Math.max(1,logs.filter(x=>x.hsPercent!==null).length),1)+'%'} subtitle="Лише виміряні сесії" icon={Crosshair}/><StatCard title="Скріншотів" number={fmt(covered)} subtitle="Локально на ПК" icon={ImageIcon}/><StatCard title="FACEIT карт" number={fmt(own)} subtitle="Реальні відповіді API" icon={Users}/></div>
     <div className="cs2-two"><section className="cs2-panel"><div className="cs2-panel-head"><div><h2>DM — останні 14 днів</h2><p>Кожен стовпець — сума записаних фрагів за день.</p></div></div><div className="cs2-chart">{last14.map(d=><div key={d.date} title={d.date+': '+d.dm+' DM'}><strong>{d.dm||''}</strong><span style={{height:Math.max(3,d.dm/topDM*150)+'px'}}/><small>{d.date.slice(8)}</small></div>)}</div></section><section className="cs2-panel"><h2>Персональні рекорди</h2><div className="cs2-personal-bests"><div><span>Найбільше DM за день</span><strong>{fmt(Math.max(0,...last14.map(d=>d.dm)))}</strong></div><div><span>Найбільше ботів за день (14 днів)</span><strong>{fmt(Math.max(0,...last14.map(d=>d.bots)))}</strong></div><div><span>Найкращий HS у журналі</span><strong>{fmt(Math.max(0,...logs.map(x=>x.hsPercent||0)),1)}%</strong></div><div><span>Найбільше сесій за день</span><strong>{fmt(Math.max(0,...last14.map(x=>logs.filter(z=>z.date===x.date).length)))}</strong></div></div></section></div>
     <section className="cs2-panel"><div className="cs2-panel-head"><div><h2>Статистика по картах</h2><p>Дані ручного журналу та FACEIT відображаються окремо. Для K/D використовуються лише записи з кількістю смертей.</p></div></div><div className="cs2-map-table"><div className="cs2-map-head"><span>Карта</span><span>Тренувань</span><span>FACEIT</span><span>Виграно</span><span>Фраги</span><span>Смерті</span><span>K/D*</span><span>HS %*</span></div>{maps.map(x=><div key={x.map}><strong>{x.map}</strong><span>{x.sessions}</span><span>{x.faceitGames}</span><span>{x.wins}</span><span>{x.kills}</span><span>{x.deaths}</span><span>{x.deaths?fmt(x.kills/x.deaths,2):'—'}</span><span>{x.hsCount?fmt(x.hs/x.hsCount,1)+'%':'—'}</span></div>)}{!maps.length&&<p className="cs2-muted">Заповни журнал або підключи FACEIT, щоб побачити порівняння карт.</p>}</div><p className="cs2-muted">* Показник K/D — умовний, якщо в деяких записах бракує смертей. HS% — середнє лише з відомих значень, не зважене за кількістю вбивств.</p></section></>}
 </div>;
}
function PencilIcon(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20l-5 1 1-5z"/></svg>;}
