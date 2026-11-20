import {useMemo,useState} from 'react';
import type {ChangeEvent} from 'react';
import {Activity,ArrowRight,BookOpen,CalendarDays,Camera,Check,CheckCircle2,ChevronRight,Download,ExternalLink,Heart,Home,Info,Plus,Save,Search,Settings2,Sparkles,TrendingUp,Utensils,Weight,Dumbbell} from 'lucide-react';
import type {Snapshot,WorkspaceItem,Task} from './types';
import {addDays,applicable,exercises,localISO,monday,programs,routineText,safeRoutine,weeklySchedule} from './fitness-data';
import type {FitnessGoal,FitnessProgram,Level,Routine} from './fitness-data';
import './fitness-studio.css';

type Tab='overview'|'week'|'library'|'programs'|'nutrition'|'cardio'|'progress'|'coach';
type Props={snapshot:Snapshot;refresh:()=>Promise<void>;report:(message:string)=>void};
const today=()=>localISO(new Date());
const days=['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
const tabs:{id:Tab;label:string;icon:typeof Activity}[]=[
 {id:'overview',label:'Огляд',icon:Home},{id:'week',label:'Мій тиждень',icon:CalendarDays},
 {id:'library',label:'Вправи',icon:Dumbbell},{id:'programs',label:'Програми',icon:BookOpen},
 {id:'nutrition',label:'Харчування',icon:Utensils},{id:'cardio',label:'Кардіо',icon:Activity},
 {id:'progress',label:'Прогрес',icon:TrendingUp},{id:'coach',label:'AI-тренер',icon:Sparkles}
];
const goalLabels:Record<FitnessGoal,string>={general:'Загальна форма',loss:'Здорові звички та рух',muscle:'Сила й м’язи',endurance:'Витривалість'};
const levelLabels:Record<Level,string>={beginner:'Початківець',intermediate:'Є досвід',advanced:'Досвідчений'};
const formatDate=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('uk-UA',{day:'numeric',month:'short'});
const num=(v:unknown)=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const isComplete=(t:Task,date:string)=>Array.isArray(t.completions)&&t.completions.includes(date);
const items=(x:WorkspaceItem[])=>x.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
const unit=(n:number|null,suffix:string)=>n===null?'—':String(n).replace('.',',')+' '+suffix;
function Focus({label,number,detail}:{label:string;number:string;detail:string}){return <div className="fs-kpi"><span>{label}</span><strong>{number}</strong><small>{detail}</small></div>;}
function Notice({children}:{children:React.ReactNode}){return <p className="fs-notice"><Info size={16}/>{children}</p>;}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="fs-field"><span>{label}</span>{children}</label>;}
function ExerciseSteps({id}:{id:string}){const e=exercises.find(x=>x.id===id);return e?<div className="fs-ex-steps"><ol>{e.instructions.map((s,i)=><li key={i}>{s}</li>)}</ol><p><Info size={14}/> {e.caution}</p></div>:null;}

export function FitnessStudio({snapshot,refresh,report}:Props){
 const f=snapshot.preferences.fitness;
 const [tab,setTab]=useState<Tab>('overview');
 const [editing,setEditing]=useState(false);
 const [wizardStep,setWizardStep]=useState(0);
 const [goal,setGoal]=useState<FitnessGoal>(f.goal as FitnessGoal);
 const [level,setLevel]=useState<Level>(f.experience as Level);
 const [age,setAge]=useState(String(f.age||''));
 const [height,setHeight]=useState(String(f.height||''));
 const [weight,setWeight]=useState(String(f.currentWeight||''));
 const [activity,setActivity]=useState(f.activity||'moderate');
 const [gear,setGear]=useState(f.homeEquipment||'Без інвентарю');
 const [constraints,setConstraints]=useState(f.constraints||'');
 const [time,setTime]=useState(String(f.sessionMinutes||30));
 const [available,setAvailable]=useState<number[]>(f.availableWeekdays?.length?f.availableWeekdays:[1,3,5]);
 const [reminder,setReminder]=useState(true);
 const [busy,setBusy]=useState(false);
 const [chosen,setChosen]=useState('home-base');
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState('all');
 const [opened,setOpened]=useState<string|null>(null);
 const [workout,setWorkout]=useState<Routine|null>(null);
 const [workoutNote,setWorkoutNote]=useState('');
 const [workoutDate,setWorkoutDate]=useState(today());
 const [mealTitle,setMealTitle]=useState('');
 const [calories,setCalories]=useState('');
 const [protein,setProtein]=useState('');
 const [mealNote,setMealNote]=useState('');
 const [photo,setPhoto]=useState<{title:string;calories:number|null;protein:number|null;note:string;photoData:string}|null>(null);
 const [cardioMinutes,setCardioMinutes]=useState('');
 const [cardioKm,setCardioKm]=useState('');
 const [cardioSpeed,setCardioSpeed]=useState('');
 const [cardioIncline,setCardioIncline]=useState('');
 const [measureKg,setMeasureKg]=useState('');
 const [measureWaist,setMeasureWaist]=useState('');
 const [aiQuestion,setAiQuestion]=useState('Оціни мій прогрес за останніми тренуваннями та допоможи скоригувати наступний тиждень.');
 const [aiAnswer,setAiAnswer]=useState('');
 const [aiBusy,setAiBusy]=useState(false);
 const now=today(),start=monday(now),end=addDays(start,6);
 const onBoarded=!!f.onboardedAt;
 const weights=useMemo(()=>items(snapshot.workspace.weight).filter(x=>num(x.kg)!==null),[snapshot.workspace.weight]);
 const cardio=useMemo(()=>items(snapshot.workspace.cardio),[snapshot.workspace.cardio]);
 const gyms=useMemo(()=>items(snapshot.workspace.gym),[snapshot.workspace.gym]);
 const meals=useMemo(()=>items(snapshot.workspace.meals),[snapshot.workspace.meals]);
 const myPrograms=useMemo(()=>items(snapshot.workspace.programs),[snapshot.workspace.programs]);
 const weekly=useMemo(()=>snapshot.tasks.filter(t=>t.category==='sport'&&t.note?.includes('[FitnessStudio]')&&t.dueDate>=start&&t.dueDate<=end).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),[snapshot.tasks,start,end]);
 const weighedThisWeek=weights.some(w=>String(w.date)>=start&&String(w.date)<=end);
 const completed=weekly.filter(t=>isComplete(t,t.dueDate)).length;
 const myGear=f.homeEquipment||'Без інвентарю';
 const relevant=useMemo(()=>programs.filter(p=>p.goal===f.goal||p.goal==='any'||p.goal==='general'),[f.goal]);
 const popular=useMemo(()=>exercises.filter(e=>(filter==='all'||e.gear===filter)&&(e.title+' '+e.muscle).toLowerCase().includes(search.toLowerCase())).slice(0,60),[filter,search]);
 const nextStart=start>=now?start:addDays(start,7);
 const suggested=programs.find(p=>p.id===chosen)||programs[0];
 const levelText=levelLabels[f.experience as Level]||'Початківець';

 async function run(message:string,action:()=>Promise<unknown>){setBusy(true);try{await action();await refresh();report(message);}catch(e){report(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 function toggleDay(n:number){setAvailable(v=>v.includes(n)?v.filter(d=>d!==n):[...v,n].sort());}
 async function saveProfile(){
  const a=num(age),h=num(height),w=num(weight),mins=num(time);
  if(!a||a<13||a>110||!h||h<100||h>260||!w||w<25||w>500||!mins||mins<15||mins>120||!available.length||!gear.trim()){
   report('Заповни вік, зріст, вагу, інвентар, час і хоча б один день занять. Для неповнолітніх план потребує участі дорослого.');return;
  }
  await run('Фітнес-профіль збережено. Персональний простір відкрито.',async()=>{
   await window.lifehub.setPreferences({fitness:{...f,goal,experience:level,age:a,height:h,currentWeight:w,activity,weeklyDays:available.length,availableWeekdays:available,sessionMinutes:mins,homeEquipment:gear.trim(),constraints:constraints.trim()||'Не зазначено',onboardedAt:today()}});
   if(reminder&&!snapshot.tasks.some(t=>t.category==='sport'&&t.title==='Контроль ваги · щотижневий замір')){
    await window.lifehub.addTask({title:'Контроль ваги · щотижневий замір',category:'sport',dueDate:nextStart,time:'',recurrence:'weekly',note:'Плановий добровільний замір: один раз на тиждень у зручних умовах. [FitnessStudio]',durationMin:3,progressType:'check'});
   }
   setEditing(false);setTab('overview');
  });
 }
 async function addProgram(p:FitnessProgram){
  const count=Math.min(p.routines.length,Math.max(1,available.length||f.weeklyDays||3));
  const assigned=weeklySchedule(p,nextStart,count,myGear);
  const chosenDays=(f.availableWeekdays?.length?f.availableWeekdays:available).slice().sort((a,b)=>a-b).slice(0,count);
  const schedule=assigned.map((row,i)=>({date:addDays(nextStart,(chosenDays[i]||i+1)-1),routine:row.routine})).sort((a,b)=>a.date.localeCompare(b.date));
  const existing=snapshot.tasks.filter(t=>t.category==='sport'&&t.note?.includes('[FitnessStudio]')&&t.dueDate>=nextStart&&t.dueDate<=addDays(nextStart,6)&&t.title!=='Контроль ваги · щотижневий замір');
  if(existing.length){report('На наступний тиждень уже є план LifeHub. Спочатку заверши або відредагуй його, щоб не створити дублікати.');setTab('week');return;}
  await run('Програму додано до плану на наступний тиждень',async()=>{
   await window.lifehub.addWorkspace('programs',{title:p.name,date:today(),focus:p.goal==='endurance'?'cardio':'gym',content:p.description+'\n\n'+schedule.map(x=>x.date+' — '+x.routine.title+'\n'+routineText(x.routine)).join('\n\n')});
   for(const row of schedule)await window.lifehub.addTask({title:row.routine.title,category:'sport',dueDate:row.date,time:'',recurrence:'none',note:'Програма: '+p.name+' [FitnessStudio]\n'+routineText(row.routine),durationMin:row.routine.duration,progressType:'check',priority:'normal'});
   setTab('week');
  });
 }
 async function completeTask(t:Task){await run(isComplete(t,t.dueDate)?'Позначку знято':'Тренування виконано',()=>window.lifehub.toggleTask(t.id,t.dueDate));}
 async function saveWorkout(){
  if(!workout){report('Вибери тренування.');return;}
  await run('Тренування записане у журнал',async()=>{await window.lifehub.addWorkspace('gym',{title:workout.title,date:workoutDate,duration:workout.duration,setting:'home',exercises:routineText(workout),note:workoutNote});setWorkout(null);setWorkoutNote('');});
 }
 async function scanMeal(){setBusy(true);try{const result=await window.lifehub.analyzeFoodPhoto();if(result)setPhoto(result);await refresh();}catch(e){report(String(e));}finally{setBusy(false);}}
 async function saveScannedMeal(){if(!photo)return;await run('Страву збережено у харчовий журнал',async()=>{await window.lifehub.addWorkspace('meals',{title:photo.title,date:today(),calories:photo.calories,protein:photo.protein,note:photo.note,photoData:photo.photoData});setPhoto(null);});}
 async function saveMeal(){
  if(!mealTitle.trim()){report('Вкажи назву страви');return;}
  await run('Харчування збережено',async()=>{await window.lifehub.addWorkspace('meals',{title:mealTitle,date:today(),calories:num(calories),protein:num(protein),note:mealNote});setMealTitle('');setCalories('');setProtein('');setMealNote('');});
 }
 async function saveCardio(){
  if(!num(cardioMinutes)||Number(cardioMinutes)<=0){report('Введи тривалість заняття');return;}
  await run('Кардіо записано',async()=>{await window.lifehub.addWorkspace('cardio',{title:'Доріжка / кардіо',date:today(),duration:num(cardioMinutes),distance:num(cardioKm),speed:num(cardioSpeed),incline:num(cardioIncline),note:'Ручний запис · FitShow / доріжка'});setCardioMinutes('');setCardioKm('');setCardioSpeed('');setCardioIncline('');});
 }
 async function importCSV(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file)return;e.target.value='';
  if(file.size>2_000_000){report('Максимальний файл CSV — 2 МБ');return;}
  const raw=await file.text();const lines=raw.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  if(lines.length<2){report('CSV порожній');return;}
  const sep=lines[0].includes(';')?';':',';const cols=lines[0].split(sep).map(x=>x.trim().toLowerCase().replace(/["']/g,''));
  const find=(re:RegExp)=>cols.findIndex(c=>re.test(c));
  const dateAt=find(/date|datum|дата/),minAt=find(/duration|minutes|elapsed|тривал|час/),kmAt=find(/distance|kilometers|kilometres|дистанц|відстан/),speedAt=find(/speed|швидк/);
  if(dateAt<0||minAt<0){report('Не знайшов дату і тривалість. Потрібен CSV з колонками date, duration (можна distance, speed). Автосинхронізація FitShow не заявлена.');return;}
  let count=0;
  await run('CSV імпортовано (нових сесій: '+Math.min(30,lines.length-1)+')',async()=>{
   for(let i=1;i<Math.min(lines.length,31);i++){
    const cells=lines[i].split(sep).map(x=>x.trim().replace(/^"|"$/g,''));
    const date=cells[dateAt]||'',duration=Number((cells[minAt]||'').replace(',','.'));
    const dateISO=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:/^\d{2}\.\d{2}\.\d{4}$/.test(date)?date.slice(6)+'-'+date.slice(3,5)+'-'+date.slice(0,2):'';
    if(!dateISO||!Number.isFinite(duration)||duration<=0||duration>600)continue;
    const note='CSV '+file.name+' · рядок '+(i+1);
    if(snapshot.workspace.cardio.some(x=>x.note===note))continue;
    const read=(idx:number)=>idx<0?null:num(cells[idx]?.replace(',','.'));
    await window.lifehub.addWorkspace('cardio',{title:'Кардіо · імпорт',date:dateISO,duration,distance:read(kmAt),speed:read(speedAt),note});count++;
   }
   report('Імпортовано занять: '+count);
  });
 }
 async function saveWeight(){
  const kg=num(measureKg),waist=num(measureWaist);
  if(!kg||kg<25||kg>500){report('Введи коректну вагу');return;}
  await run('Щотижневий замір збережено',async()=>{
   await window.lifehub.addWorkspace('weight',{title:'Контроль ваги',date:today(),kg,waist,note:'Фітнес-замір'});
   await window.lifehub.setPreferences({fitness:{...f,currentWeight:kg}});
   setMeasureKg('');setMeasureWaist('');
  });
 }
 async function askCoach(kind:'fitness'|'nutrition'='fitness'){
  if(!aiQuestion.trim()){report('Напиши питання для AI');return;}
  setAiBusy(true);try{const r=await window.lifehub.aiInsight(kind,aiQuestion.slice(0,1800));setAiAnswer(r.text);await refresh();}catch(e){report(e instanceof Error?e.message:String(e));}finally{setAiBusy(false);}
 }
 const exerciseContent=(r:Routine)=>r.steps.map(s=><div className="fs-step" key={s.id}><div><strong>{exercises.find(e=>e.id===s.id)?.title||s.id}</strong><small>{s.sets} × {s.reps} · відпочинок {s.rest||0} с</small></div><button onClick={()=>{setTab('library');setOpened(s.id);}}><ChevronRight size={16}/></button></div>);

 return <div className="fs">
  <header className="fs-hero">
   <div><span className="fs-eyebrow"><Heart size={15}/> LIFEHUB / FITNESS STUDIO</span><h1>Твоя форма. <em>Твій прогрес.</em></h1><p>Персональний план на тиждень, тренування, харчування, кардіо та зрозуміла аналітика.</p></div>
   {onBoarded&&!editing&&<button className="fs-btn ghost" onClick={()=>{setEditing(true);setWizardStep(0);}}><Settings2 size={16}/> Мої параметри</button>}
  </header>
  {!onBoarded||editing?<section className="fs-onboarding">
   <div className="fs-panel-head"><div><span className="fs-eyebrow">PERSONAL SETUP</span><h2>{editing?'Оновити фітнес-профіль':'Спочатку познайомимося'}</h2><p>Три короткі кроки, після яких відкриється персональний Fitness Studio. Ці дані залишаються локально на ПК.</p></div><span className="fs-count">{wizardStep+1} / 3</span></div>
   <div className="fs-wizard-steps">{[0,1,2].map(n=><span key={n} className={wizardStep>=n?'active':''}/>)}</div>
   {wizardStep===0&&<div className="fs-form-grid">
    <Field label="Головна ціль"><select value={goal} onChange={e=>setGoal(e.target.value as FitnessGoal)}>{Object.entries(goalLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
    <Field label="Рівень підготовки"><select value={level} onChange={e=>setLevel(e.target.value as Level)}>{Object.entries(levelLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
    <Field label="Вік"><input type="number" min="13" max="110" value={age} onChange={e=>setAge(e.target.value)} placeholder="Років"/></Field>
    <Field label="Щоденна активність"><select value={activity} onChange={e=>setActivity(e.target.value)}><option value="low">Переважно сиджу</option><option value="moderate">Помірна</option><option value="high">Багато рухаюсь</option></select></Field>
    <Field label="Зріст (см)"><input type="number" min="100" max="260" value={height} onChange={e=>setHeight(e.target.value)}/></Field>
    <Field label="Поточна вага (кг)"><input type="number" min="25" max="500" step=".1" value={weight} onChange={e=>setWeight(e.target.value)}/></Field>
   </div>}
   {wizardStep===1&&<div className="fs-onboard-details">
    <div className="fs-form-grid">
     <Field label="Інвентар вдома"><input value={gear} maxLength={250} onChange={e=>setGear(e.target.value)} placeholder="Наприклад: доріжка FitShow, гантелі, килимок"/></Field>
     <Field label="Скільки хвилин на тренування"><input type="number" min="15" max="120" value={time} onChange={e=>setTime(e.target.value)}/></Field>
    </div>
    <Field label="Травми, обмеження, дискомфорт (або «немає»)"><textarea rows={3} value={constraints} onChange={e=>setConstraints(e.target.value)} placeholder="Врахуємо під час підбору занять"/></Field>
    <div><strong>У які дні зручно займатися?</strong><div className="fs-day-pills">{days.map((name,i)=><button key={i} className={available.includes(i+1)?'active':''} onClick={()=>toggleDay(i+1)}>{name}</button>)}</div><small>План розподіляє навантаження з відновленням; більше днів не означає щодня важко тренуватися.</small></div>
   </div>}
   {wizardStep===2&&<div className="fs-review">
    <div><span>Ціль</span><strong>{goalLabels[goal]}</strong></div><div><span>Рівень</span><strong>{levelLabels[level]}</strong></div><div><span>Графік</span><strong>{available.map(x=>days[x-1]).join(', ')||'Не обрано'} · {time} хв</strong></div><div><span>Інвентар</span><strong>{gear}</strong></div>
    <label className="fs-check"><input type="checkbox" checked={reminder} onChange={e=>setReminder(e.target.checked)}/> Додати делікатне щотижневе нагадування про замір ваги</label>
    <Notice>AI не замінює лікаря чи тренера. Якщо є травма, незвичні симптоми або медичні обмеження, узгодь інтенсивність із фахівцем. Для підлітків потрібна участь дорослого.</Notice>
   </div>}
   <div className="fs-actions">
    {wizardStep>0&&<button className="fs-btn ghost" onClick={()=>setWizardStep(v=>v-1)}>Назад</button>}
    {editing&&<button className="fs-btn ghost" onClick={()=>setEditing(false)}>Скасувати</button>}
    <button className="fs-btn primary" disabled={busy} onClick={()=>wizardStep<2?setWizardStep(v=>v+1):void saveProfile()}>{wizardStep===2?<><Check size={17}/> Зберегти і відкрити</>:<>Продовжити <ArrowRight size={17}/></>}</button>
   </div>
  </section>:<>
   <nav className="fs-tabs">{tabs.map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}><t.icon size={16}/>{t.label}</button>)}</nav>
   {tab==='overview'&&<div className="fs-grid-layout">
    <section className="fs-panel fs-span">
     <div className="fs-panel-head"><div><span className="fs-eyebrow">YOUR WEEK</span><h2>План на цей тиждень</h2><p>{formatDate(start)} — {formatDate(end)} · {goalLabels[f.goal as FitnessGoal]} · {levelText}</p></div><button className="fs-btn ghost" onClick={()=>setTab('week')}>Переглянути <ArrowRight size={15}/></button></div>
     <div className="fs-kpis"><Focus label="Заплановано" number={String(weekly.length)} detail="Занять на цей тиждень"/><Focus label="Виконано" number={String(completed)} detail="З підтвердженням"/><Focus label="Записи" number={String(gyms.length+cardio.length)} detail="Тренувань і кардіо"/><Focus label="Вага" number={unit(num(weights[0]?.kg)??f.currentWeight,'кг')} detail="Останній замір"/></div>
     {weekly.length?<div className="fs-week-mini">{weekly.slice(0,5).map(t=><button key={t.id} className={isComplete(t,t.dueDate)?'done':''} onClick={()=>void completeTask(t)}><span>{formatDate(t.dueDate)}</span><strong>{t.title}</strong>{isComplete(t,t.dueDate)?<CheckCircle2 size={18}/>:<span className="fs-empty-check"/>}</button>)}</div>:<div className="fs-empty"><CalendarDays size={30}/><strong>Поки немає розписаного тижня</strong><p>Вибери програму — LifeHub розкладе вправи по датах.</p><button className="fs-btn primary" onClick={()=>setTab('programs')}>Вибрати програму <ArrowRight size={16}/></button></div>}
    </section>
    <section className="fs-panel">
     <div className="fs-panel-head"><div><h2>Перевірка прогресу</h2><p>Без тиску: коротка оцінка раз на тиждень.</p></div><Weight size={21}/></div>
     {weighedThisWeek?<p className="fs-success"><CheckCircle2 size={18}/> Замір цього тижня записано</p>:<p className="fs-highlight">На цьому тижні ще немає заміру ваги.</p>}
     <button className="fs-btn ghost" onClick={()=>setTab('progress')}>Вага та заміри <ArrowRight size={15}/></button>
    </section>
    <section className="fs-panel">
     <div className="fs-panel-head"><div><h2>Коуч LifeHub</h2><p>Поради на основі записаних тренувань.</p></div><Sparkles size={20}/></div>
     <p>Запитай, що покращити в програмі, як розподілити навантаження або як підтримувати регулярність.</p>
     <button className="fs-btn primary" onClick={()=>setTab('coach')}>AI-тренер <ArrowRight size={16}/></button>
    </section>
   </div>}
   {tab==='week'&&<div className="fs-stack">
    <section className="fs-panel"><div className="fs-panel-head"><div><span className="fs-eyebrow">WEEKLY SCHEDULE</span><h2>Мій тижневий план</h2><p>Заняття з бібліотеки потрапляють у «Сьогодні» і звичайний планувальник LifeHub.</p></div><button className="fs-btn primary" onClick={()=>setTab('programs')}><Plus size={16}/> Додати програму</button></div>
     <div className="fs-calendar">{days.map((d,i)=>{const date=addDays(start,i);const rows=weekly.filter(t=>t.dueDate===date);return <div key={d} className={'fs-calendar-day '+(date===now?'current':'')}><span>{d}<strong>{formatDate(date)}</strong></span>{rows.map(t=><button key={t.id} onClick={()=>void completeTask(t)} className={isComplete(t,date)?'done':''}><span>{t.title}</span><small>{t.durationMin||30} хв</small>{isComplete(t,date)?<Check size={16}/>:<span className="fs-empty-check"/>}</button>)}{!rows.length&&<em>Відновлення / вільний день</em>}</div>;})}</div>
     <Notice>Позначай виконання лише після заняття. Пропущений день можна скоригувати в загальному планувальнику, без штрафів.</Notice>
    </section>
    <section className="fs-panel"><h2>Записати фактичне тренування</h2><p>План — це намір, а журнал — те, що реально зроблено.</p>
     <div className="fs-form-grid"><Field label="Тренування"><select value={workout?.title||''} onChange={e=>{const found=programs.flatMap(p=>p.routines).find(r=>r.title===e.target.value)||null;setWorkout(found);}}><option value="">Вибери шаблон</option>{programs.flatMap(p=>p.routines).map((r,i)=><option key={r.title+i} value={r.title}>{r.title}</option>)}</select></Field><Field label="Дата"><input type="date" value={workoutDate} onChange={e=>setWorkoutDate(e.target.value)}/></Field></div>
     {workout&&<div className="fs-log-preview">{exerciseContent(safeRoutine(workout,myGear))}</div>}
     <Field label="Результат, відчуття, фактичні повтори, вага"><textarea rows={3} value={workoutNote} onChange={e=>setWorkoutNote(e.target.value)} placeholder="Наприклад: 3×10, останній підхід важко, дискомфорту немає"/></Field>
     <button disabled={!workout||busy} className="fs-btn primary" onClick={()=>void saveWorkout()}><Save size={16}/> Записати у журнал</button>
     {gyms.length>0&&<div className="fs-history"><h3>Нещодавні силові</h3>{gyms.slice(0,5).map(x=><div key={x.id}><strong>{String(x.title)}</strong><small>{formatDate(String(x.date||now))} · {unit(num(x.duration),'хв')}</small></div>)}</div>}
    </section>
   </div>}
   {tab==='library'&&<section className="fs-panel"><div className="fs-panel-head"><div><span className="fs-eyebrow">EXERCISE LIBRARY</span><h2>Каталог вправ</h2><p>Детальна техніка, рівень, інвентар і відеопошук за назвою вправи.</p></div><span className="fs-count">{exercises.length} вправ</span></div>
    <div className="fs-filter-row"><label className="fs-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Знайти вправу або м’язи"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Усі категорії</option><option value="bodyweight">Без інвентарю</option><option value="mat">Килимок</option><option value="dumbbells">Гантелі</option><option value="bands">Еспандери</option><option value="treadmill">Доріжка</option><option value="chair">Опора / платформа</option></select></div>
    <div className="fs-ex-grid">{popular.map(e=><article className="fs-ex-card" key={e.id}><div className="fs-ex-top"><span className="fs-icon"><Dumbbell size={19}/></span><small>{levelLabels[e.level]}</small></div><strong>{e.title}</strong><p>{e.muscle}</p><div className="fs-ex-controls"><button onClick={()=>setOpened(opened===e.id?null:e.id)}>{opened===e.id?'Згорнути':'Техніка'} <ChevronRight size={15}/></button><button onClick={()=>void window.lifehub.openLink('https://www.youtube.com/results?search_query='+encodeURIComponent(e.search)).catch(err=>report(String(err)))} title="Пошук відеоприкладів на YouTube"><ExternalLink size={15}/> Відео</button></div>{opened===e.id&&<ExerciseSteps id={e.id}/>}</article>)}</div>
   </section>}
   {tab==='programs'&&<section className="fs-panel"><div className="fs-panel-head"><div><span className="fs-eyebrow">PROGRAMS / COLLECTIONS</span><h2>Готові програми</h2><p>Авторські програми LifeHub, натхненні форматом фітнес-каталогів. Не копії Nike Training Club і не офіційні плани спортсменів.</p></div><span className="fs-count">{programs.length} добірок</span></div>
    <div className="fs-feature"><Sparkles size={18}/><span><strong>Рекомендовано під твою ціль</strong> · {relevant.slice(0,3).map(p=>p.name).join(' • ')}</span></div>
    <div className="fs-program-grid">{programs.map(p=><article key={p.id} className={'fs-program '+(chosen===p.id?'selected':'')}><div className="fs-program-cover"><span>{p.tag}</span><Dumbbell size={34}/></div><div className="fs-program-body"><strong>{p.name}</strong><p>{p.description}</p><div className="fs-tags"><span>{p.days} дні/тиждень</span><span>{levelLabels[p.level]}</span>{!applicable(p,myGear)&&<span>Потрібна адаптація</span>}</div><button className="fs-btn ghost" onClick={()=>setChosen(chosen===p.id?'':p.id)}>{chosen===p.id?'Обрано — дивись нижче':'Переглянути'}</button></div></article>)}</div>
    {chosen&&<div className="fs-program-detail"><div className="fs-panel-head"><div><h2>{suggested.name}</h2><p>{suggested.description}</p></div><button disabled={busy} className="fs-btn primary" onClick={()=>void addProgram(suggested)}><Plus size={16}/> Додати в мій план</button></div><div className="fs-routine-grid">{suggested.routines.map((r,i)=><div key={i}><strong>Заняття {i+1}. {r.title}</strong><small>{r.duration} хв · {r.kind==='cardio'?'кардіо':r.kind==='mobility'?'мобільність':'силове'}</small>{exerciseContent(safeRoutine(r,myGear))}</div>)}</div><Notice>Дні беруться з твого профілю. Якщо обладнання немає, LifeHub пропонує альтернативи з власною вагою. Перевір вправи з урахуванням обмежень.</Notice></div>}
    {myPrograms.length>0&&<div className="fs-history"><h3>Мої збережені програми</h3>{myPrograms.slice(0,6).map(p=><div key={p.id}><strong>{String(p.title)}</strong><small>{formatDate(String(p.date||now))}</small></div>)}</div>}
   </section>}
   {tab==='nutrition'&&<div className="fs-grid-layout"><section className="fs-panel fs-span"><div className="fs-panel-head"><div><span className="fs-eyebrow">FOOD / AI ASSIST</span><h2>Харчування без складних таблиць</h2><p>Сканер страв, приблизні нутрієнти, журнал та AI-поради.</p></div><Utensils size={22}/></div>
    <Notice>Оцінка страви за фото приблизна: вагу порції та приховані інгредієнти камера не визначає точно. Перевір результат перед збереженням.</Notice>
    <button className="fs-btn primary" disabled={busy} onClick={()=>void scanMeal()}><Camera size={17}/> Сканувати їжу</button>
    {photo&&<div className="fs-photo-result"><img src={photo.photoData} alt="Знімок їжі"/><div><h3>{photo.title}</h3><p>Калорії: {unit(photo.calories,'ккал')} · білок: {unit(photo.protein,'г')}</p><p>{photo.note}</p><button className="fs-btn primary" onClick={()=>void saveScannedMeal()}>Підтвердити та зберегти</button><button className="fs-btn ghost" onClick={()=>setPhoto(null)}>Не зберігати</button></div></div>}
    <h3>Записати вручну</h3><div className="fs-form-grid"><Field label="Страва"><input value={mealTitle} onChange={e=>setMealTitle(e.target.value)} placeholder="Наприклад, рис та курка"/></Field><Field label="Калорійність (необов’язково)"><input type="number" min="0" value={calories} onChange={e=>setCalories(e.target.value)}/></Field><Field label="Білок (г)"><input type="number" min="0" value={protein} onChange={e=>setProtein(e.target.value)}/></Field><Field label="Склад / порція"><input value={mealNote} onChange={e=>setMealNote(e.target.value)}/></Field></div><button disabled={busy} className="fs-btn ghost" onClick={()=>void saveMeal()}><Plus size={16}/> У журнал</button>
    </section><section className="fs-panel"><h2>Порада до раціону</h2><p>AI враховує твій профіль і записи, але не накладає безумовних заборон на продукти.</p><button className="fs-btn primary" onClick={()=>{setTab('coach');setAiQuestion('Порадь збалансоване харчування під мою мету, з огляду на мій журнал. Що можна практично покращити без крайнощів?');}}>Запитати AI <Sparkles size={16}/></button></section>
    <section className="fs-panel"><h2>Останні страви</h2>{meals.slice(0,8).map(m=><div className="fs-simple-row" key={m.id}><div><strong>{String(m.title)}</strong><small>{formatDate(String(m.date||now))}</small></div><span>{unit(num(m.calories),'ккал')}</span></div>)}{!meals.length&&<p>Поки немає записів.</p>}</section></div>}
   {tab==='cardio'&&<div className="fs-stack"><section className="fs-panel"><div className="fs-panel-head"><div><span className="fs-eyebrow">CARDIO / FITSHOW</span><h2>Доріжка та витривалість</h2><p>Плануй кардіо разом із силовими днями, фіксуй дистанцію та швидкість.</p></div><Activity size={24}/></div>
    <div className="fs-form-grid"><Field label="Тривалість, хв"><input type="number" min="1" max="600" value={cardioMinutes} onChange={e=>setCardioMinutes(e.target.value)}/></Field><Field label="Дистанція, км"><input type="number" min="0" step=".01" value={cardioKm} onChange={e=>setCardioKm(e.target.value)}/></Field><Field label="Швидкість, км/год"><input type="number" min="0" step=".1" value={cardioSpeed} onChange={e=>setCardioSpeed(e.target.value)}/></Field><Field label="Нахил, %"><input type="number" min="0" value={cardioIncline} onChange={e=>setCardioIncline(e.target.value)}/></Field></div>
    <button className="fs-btn primary" disabled={busy} onClick={()=>void saveCardio()}><Save size={16}/> Зберегти кардіо</button>
    <div className="fs-integration"><strong>FitShow: імпорт результатів</strong><p>Прямий доступ до акаунта FitShow з Windows поки не підтверджено. Можеш зберігати результати вручну або імпортувати CSV, якщо твоя версія застосунку дозволяє експортувати історію.</p><label className="fs-btn ghost"><Download size={16}/> Імпортувати CSV<input hidden type="file" accept=".csv,text/csv" onChange={e=>void importCSV(e)}/></label><small>Підтримуються стовпці date, duration, distance, speed. Інші формати ще не підключені.</small></div>
    </section><section className="fs-panel"><h2>Історія кардіо</h2>{cardio.slice(0,15).map(c=><div className="fs-simple-row" key={c.id}><div><strong>{String(c.title)}</strong><small>{formatDate(String(c.date||now))}</small></div><span>{unit(num(c.duration),'хв')} · {unit(num(c.distance),'км')}</span></div>)}{!cardio.length&&<p>Поки немає записів.</p>}</section></div>}
   {tab==='progress'&&<div className="fs-grid-layout"><section className="fs-panel fs-span"><div className="fs-panel-head"><div><span className="fs-eyebrow">PROGRESS TRACKING</span><h2>Вага, заміри, регулярність</h2><p>Раз на тиждень занеси результат, щоб бачити загальну тенденцію.</p></div><TrendingUp size={22}/></div><div className="fs-kpis"><Focus label="Остання вага" number={unit(num(weights[0]?.kg)??f.currentWeight,'кг')} detail="Збережений замір"/><Focus label="Силових" number={String(gyms.length)} detail="Всього записів"/><Focus label="Кардіо" number={String(cardio.length)} detail="Всього записів"/><Focus label="План тижня" number={weekly.length?Math.round(100*completed/weekly.length)+'%':'—'} detail="За позначками"/></div>
    {!weighedThisWeek&&<p className="fs-highlight"><Weight size={17}/> Новий тиждень — можна зробити короткий замір.</p>}
    <div className="fs-form-grid"><Field label="Вага (кг)"><input type="number" step=".1" min="25" max="500" value={measureKg} onChange={e=>setMeasureKg(e.target.value)}/></Field><Field label="Талія (см, необов’язково)"><input type="number" step=".1" min="0" value={measureWaist} onChange={e=>setMeasureWaist(e.target.value)}/></Field></div><button className="fs-btn primary" disabled={busy} onClick={()=>void saveWeight()}><Save size={16}/> Зберегти замір</button>
    <div className="fs-chart">{weights.slice(0,12).reverse().map(w=>{const v=num(w.kg)||0;const all=weights.slice(0,12).map(x=>num(x.kg)||0);const min=Math.min(...all,0)||0,max=Math.max(...all,1);return <div key={w.id} className="fs-bar"><span style={{height:(25+75*(v-min)/Math.max(1,max-min))+'%'}} title={v+' кг'}/><small>{formatDate(String(w.date||now))}</small></div>;})}{!weights.length&&<p>Графік з’явиться після перших замірів.</p>}</div>
    <Notice>Вага змінюється через багато факторів. Разовий стрибок не означає, що тренування не працюють. Можна відкласти замір без штрафу.</Notice>
    </section><section className="fs-panel"><h2>Історія замірів</h2>{weights.slice(0,12).map(w=><div className="fs-simple-row" key={w.id}><div><strong>{unit(num(w.kg),'кг')}</strong><small>{formatDate(String(w.date||now))}</small></div><span>{w.waist?'Талія '+w.waist+' см':''}</span></div>)}{!weights.length&&<p>Ще немає замірів.</p>}</section>
    <section className="fs-panel"><h2>Що ще додамо</h2><p>Заміри за фото/відео техніки, перевірка амплітуди рухів і регулярність без примусу. Функцію завантаження відео зробимо окремо з приватним локальним сховищем — зараз вона не підключена.</p></section></div>}
   {tab==='coach'&&<section className="fs-panel fs-ai"><div className="fs-panel-head"><div><span className="fs-eyebrow">LIFEHUB AI COACH</span><h2>Персональні рекомендації</h2><p>AI отримує профіль, недавні тренування та журнали, коли ти натискаєш кнопку запиту.</p></div><Sparkles size={23}/></div>
    <div className="fs-suggestions">{['Зроби мені збалансований план тренувань на 7 днів з урахуванням інвентарю.','Які вправи краще замінити через мої обмеження?','Порадь простий раціон без суворих заборон.','Чи є прогрес і що змінити наступного тижня?'].map(s=><button key={s} onClick={()=>setAiQuestion(s)}>{s}</button>)}</div>
    <Field label="Запит для AI"><textarea rows={5} maxLength={1800} value={aiQuestion} onChange={e=>setAiQuestion(e.target.value)}/></Field><div className="fs-actions"><button disabled={aiBusy} className="fs-btn primary" onClick={()=>void askCoach(/харч|раціон|їж|продукт/i.test(aiQuestion)?'nutrition':'fitness')}><Sparkles size={17}/> {aiBusy?'Аналіз…':'Отримати пораду'}</button><span>Запити витрачають кошти OpenAI API за локальним лімітом.</span></div>
    {aiAnswer&&<div className="fs-ai-result"><h3>Відповідь AI</h3><p>{aiAnswer}</p></div>}
    <Notice>Поради — загальна інформація, а не діагностика чи лікування. AI не аналізує відеотехніку, доки файл не передано через окрему підтверджену функцію.</Notice>
   </section>}
  </>}
 </div>;
}
