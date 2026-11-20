import {useMemo,useState} from 'react';
import {Activity,Camera,Check,ChevronDown,FileVideo,Info,Minus,Plus,Save,Search,Trash2,Video} from 'lucide-react';
import {exercises,programs,safeRoutine} from './fitness-data';
import type {Routine} from './fitness-data';
import type {WorkspaceItem} from './types';
import './fitness-workout.css';

type SetLog={reps:string;kg:string;seconds:string;done:boolean};
type ExerciseLog={key:string;id:string;title:string;sets:SetLog[]};
type Props={gear:string;history:WorkspaceItem[];report:(message:string)=>void;refresh:()=>Promise<void>;initialTitle?:string;initialDate?:string;onSaved?:()=>Promise<void>};
const newSet=():SetLog=>({reps:'',kg:'',seconds:'',done:false});
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const digits=(s:string,max:number)=>{if(!s.trim())return null;const n=Number(s);return Number.isFinite(n)&&n>=0&&n<=max?n:null};
const templates=programs.flatMap(p=>p.routines.map((r,index)=>({id:p.id+':'+index,title:r.title,r})));
const getTemplate=(name:string)=>templates.find(p=>p.title===name)?.id||'custom';
const routineById=(id:string)=>templates.find(p=>p.id===id)?.r;
const fromRoutine=(r:Routine,gear:string):ExerciseLog[]=>safeRoutine(r,gear).steps.map((step,i)=>({key:step.id+'-'+i,id:step.id,title:exercises.find(x=>x.id===step.id)?.title||step.id,sets:Array.from({length:Math.min(12,step.sets)},()=>newSet())}));
export function FitnessWorkoutTracker({gear,history,report,refresh,initialTitle,initialDate,onSaved}:Props){
 const starting=getTemplate(initialTitle||'');
 const [template,setTemplate]=useState(starting);
 const [title,setTitle]=useState(initialTitle||'Моє тренування');
 const [date,setDate]=useState(initialDate||today());
 const [duration,setDuration]=useState('30');
 const [note,setNote]=useState('');
 const [filter,setFilter]=useState('');
 const [expanded,setExpanded]=useState<string|null>(null);
 const [entries,setEntries]=useState<ExerciseLog[]>(()=>routineById(starting)?fromRoutine(routineById(starting)!,gear):[]);
 const [video,setVideo]=useState<{id:string;title:string;bytes:number}|null>(null);
 const [busy,setBusy]=useState(false);
 const [showHistory,setShowHistory]=useState(false);
 const completed=entries.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0);
 const total=entries.reduce((n,e)=>n+e.sets.length,0);
 const available=useMemo(()=>exercises.filter(e=>(e.title+' '+e.muscle).toLowerCase().includes(filter.toLowerCase())).slice(0,50),[filter]);
 function applyTemplate(id:string){
  setTemplate(id);const r=routineById(id);
  if(r){setEntries(fromRoutine(r,gear));setTitle(r.title);setDuration(String(r.duration));}
  else{setEntries([]);setTitle('Моє тренування');}
 }
 function addExercise(id:string){
  const e=exercises.find(v=>v.id===id);if(!e)return;
  setEntries(prev=>[...prev,{key:e.id+'-'+Date.now()+'-'+prev.length,id:e.id,title:e.title,sets:[newSet()]}]);setFilter('');
 }
 function changeSet(key:string,index:number,field:keyof SetLog,value:string|boolean){setEntries(old=>old.map(e=>e.key!==key?e:{...e,sets:e.sets.map((s,i)=>index===i?{...s,[field]:value}:s)}));}
 function appendSet(key:string){setEntries(old=>old.map(e=>e.key===key?{...e,sets:e.sets.length<15?[...e.sets,newSet()]:e.sets}:e));}
 function removeSet(key:string,index:number){setEntries(old=>old.map(e=>e.key===key?{...e,sets:e.sets.filter((_,i)=>i!==index)}:e));}
 async function importVideo(){
  setBusy(true);try{const data=await window.lifehub.fitnessImportVideo();if(data){setVideo(data);report('Відео додано локально на цьому ПК.');}}
  catch(e){report(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 async function save(){
  const time=digits(duration,600);
  if(!title.trim()||time===null||time===0){report('Вкажи назву і тривалість (1–600 хв).');return;}
  if(!entries.length||!completed){report('Познач хоча б один реально виконаний підхід.');return;}
  for(const e of entries)for(const s of e.sets){
    if((s.reps&&digits(s.reps,1000)===null)||(s.kg&&digits(s.kg,500)===null)||(s.seconds&&digits(s.seconds,3600)===null)){report('Перевір числа повторів, ваги і секунд.');return;}
    if(s.done&&!s.reps&&!s.seconds){report('Для виконаного підходу вкажи повтори або секунди.');return;}
  }
  setBusy(true);
  try{
   const exerciseLogs=entries.map(e=>({id:e.id,title:e.title,sets:e.sets.filter(s=>s.done).map(s=>({reps:digits(s.reps,1000),kg:digits(s.kg,500),seconds:digits(s.seconds,3600),done:true}))})).filter(e=>e.sets.length);
   const summary=exerciseLogs.map(e=>e.title+': '+e.sets.map(s=>[s.reps!==null?s.reps+' повт.':'',s.seconds!==null?s.seconds+' с':'',s.kg!==null?s.kg+' кг':''].filter(Boolean).join(' / ')).join('; ')).join('\n');
   await window.lifehub.addWorkspace('gym',{title:title.trim(),date,duration:time,setting:'home',exercises:summary.slice(0,3000),exerciseLogs,note:note.trim().slice(0,1500),mediaId:video?.id||'',mediaTitle:video?.title||''});
   await refresh();if(onSaved)await onSaved();
   report('Збережено: '+completed+' виконаних підходів.');
   setEntries([]);setTemplate('custom');setTitle('Моє тренування');setNote('');setVideo(null);setDuration('30');setShowHistory(true);
  }catch(e){report(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 return <div className="fw">
  <div className="fw-intro"><div><span className="fs-eyebrow">WORKOUT LOGGER</span><h2>Що ти зробив насправді?</h2><p>Вправи, підходи, повторення, робоча вага. Записуємо лише підтверджені результати.</p></div><span className="fw-progress">{completed}/{total} підходів</span></div>
  <div className="fs-form-grid">
   <label className="fs-field"><span>Готовий план або свій список</span><select value={template} onChange={e=>applyTemplate(e.target.value)}><option value="custom">Свій список вправ</option>{templates.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
   <label className="fs-field"><span>Назва заняття</span><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={130}/></label>
   <label className="fs-field"><span>Дата</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label className="fs-field"><span>Тривалість, хв</span><input type="number" min="1" max="600" value={duration} onChange={e=>setDuration(e.target.value)}/></label>
  </div>
  <div className="fw-add"><h3>Додати вправу</h3><label className="fw-search"><Search size={16}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Наприклад: присідання, планка, гантелі"/></label>
   {filter&&<div className="fw-search-results">{available.map(e=><button key={e.id} onClick={()=>addExercise(e.id)}><Plus size={15}/><strong>{e.title}</strong><small>{e.muscle}</small></button>)}</div>}
   {!filter&&<div className="fw-fast">{exercises.slice(0,8).map(e=><button key={e.id} onClick={()=>addExercise(e.id)}><Plus size={13}/>{e.title}</button>)}</div>}
  </div>
  {entries.length===0&&<div className="fs-empty"><Activity size={30}/><strong>Ще немає вправ</strong><p>Вибери програму або додай свої вправи через пошук.</p></div>}
  <div className="fw-exercises">{entries.map((e,i)=>{const info=exercises.find(x=>x.id===e.id);return <section className="fw-exercise" key={e.key}><header><div className="fw-ex-no">{i+1}</div><div><h3>{e.title}</h3><small>{info?.muscle} · {e.sets.filter(s=>s.done).length}/{e.sets.length} виконано</small></div><div className="fw-ex-actions"><button title="Техніка" onClick={()=>setExpanded(expanded===e.key?null:e.key)}><Info size={16}/></button><button title="Прибрати вправу" onClick={()=>setEntries(prev=>prev.filter(x=>x.key!==e.key))}><Trash2 size={16}/></button></div></header>
    {expanded===e.key&&<div className="fw-technique"><ol>{info?.instructions.map((s,k)=><li key={k}>{s}</li>)}</ol><p>{info?.caution}</p></div>}
    <div className="fw-set-head"><span>Підхід</span><span>Повтори</span><span>Вага, кг</span><span>Секунди</span><span>Зробив</span><span/></div>
    {e.sets.map((s,k)=><div className={'fw-set '+(s.done?'done':'')} key={k}><span>#{k+1}</span><input aria-label={'Повтори '+(k+1)} type="number" min="0" max="1000" placeholder="—" value={s.reps} onChange={v=>changeSet(e.key,k,'reps',v.target.value)}/><input aria-label={'Вага '+(k+1)} type="number" min="0" max="500" step=".5" placeholder="—" value={s.kg} onChange={v=>changeSet(e.key,k,'kg',v.target.value)}/><input aria-label={'Секунди '+(k+1)} type="number" min="0" max="3600" placeholder="—" value={s.seconds} onChange={v=>changeSet(e.key,k,'seconds',v.target.value)}/><button className={'fw-done '+(s.done?'active':'')} onClick={()=>changeSet(e.key,k,'done',!s.done)} title="Виконано">{s.done?<Check size={16}/>:<span/>}</button><button onClick={()=>removeSet(e.key,k)} title="Видалити підхід"><Minus size={15}/></button></div>)}
    <button className="fw-add-set" onClick={()=>appendSet(e.key)} disabled={e.sets.length>=15}><Plus size={15}/> Додати підхід</button>
   </section>})}</div>
  <section className="fw-media"><div><div className="fw-media-heading"><FileVideo size={19}/><strong>Моє відео техніки (необов’язково)</strong></div><p>MP4/WebM/MOV до 250 МБ. Зберігається тільки на цьому комп’ютері, в AI не надсилається.</p>{video&&<div className="fw-video"><Video size={16}/><span>{video.title}</span><button onClick={()=>void window.lifehub.fitnessOpenVideo(video.id).catch(err=>report(String(err)))}>Переглянути</button><button onClick={()=>setVideo(null)}>Від’єднати</button></div>}</div><button className="fs-btn ghost" disabled={busy} onClick={()=>void importVideo()}><Camera size={16}/> {video?'Замінити':'Додати відео'}</button></section>
  <label className="fs-field"><span>Як пройшло тренування</span><textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Що було складно, що покращити?"/></label>
  <div className="fw-save"><div><strong>{completed} виконаних підходів</strong><small>Результат збережеться в історії</small></div><button className="fs-btn primary" disabled={busy||!completed} onClick={()=>void save()}><Save size={17}/> Зберегти тренування</button></div>
  <div className="fw-history"><button className="fw-history-toggle" onClick={()=>setShowHistory(!showHistory)}>Мої останні тренування ({history.length}) <ChevronDown size={16}/></button>
   {showHistory&&<div>{history.slice(0,8).map(r=><div className="fw-history-row" key={r.id}><div><strong>{String(r.title)}</strong><small>{String(r.date||'')} · {String(r.duration??'—')} хв · {Array.isArray(r.exerciseLogs)?r.exerciseLogs.reduce((n:number,e:{sets?:unknown[]})=>n+(Array.isArray(e.sets)?e.sets.length:0),0)+' підходів':'старий запис'}</small>{r.note?<p>{String(r.note).slice(0,250)}</p>:null}</div>{typeof r.mediaId==='string'&&r.mediaId&&<button className="fs-btn ghost" onClick={()=>void window.lifehub.fitnessOpenVideo(String(r.mediaId)).catch(err=>report(String(err)))}><Video size={15}/> {String(r.mediaTitle||'Відео')}</button>}</div>)}{!history.length&&<p>Журнал ще порожній.</p>}</div>}
  </div>
 </div>;
}