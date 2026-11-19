import {useEffect,useState} from 'react';
import {CalendarDays,CheckCircle2,ChevronDown,Clock3,ExternalLink,Info,MapPin,Pencil,RefreshCw,Save,ShieldAlert,TriangleAlert,Zap} from 'lucide-react';
import type {PowerLive,Snapshot} from './types';
import {hourText,hourView,kyivToday,nextDay,statusName,summaryFor,timeRange} from './power-grid';
import type {PowerDay,PowerStatus} from './power-grid';
import './power-studio.css';

type Address={settlement:string;street:string;house:string};
type Props={snapshot:Snapshot;refresh:()=>Promise<void>;report:(message:string)=>void};
type Range='today'|'tomorrow'|'week';
type Selected={date:string;hour:number};
const DTEK_URL='https://www.dtek-krem.com.ua/ua/shutdowns';
const groups=Array.from({length:6},(_,i)=>i+1).flatMap(i=>[1,2].map(n=>String(i)+'.'+String(n)));
const pretty=(date:string,short=false)=>new Date(date+'T12:00:00').toLocaleDateString('uk-UA',short?{weekday:'short',day:'numeric',month:'short'}:{weekday:'long',day:'numeric',month:'long'});
const updatedText=(iso:string)=>{if(!iso)return 'Не оновлювався';const n=Date.parse(iso);return Number.isFinite(n)?new Date(n).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Немає даних';};
const groupName=(value:string)=>value?value.replace(/^GPV/,''):'Не визначено';
const nowKyivHour=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Kyiv',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());return Number(parts.find(p=>p.type==='hour')?.value||0);};

function HourGrid({dates,current,picked,onPick,mode}:{dates:string[];current:PowerLive;mode:Range;picked:Selected|null;onPick:(x:Selected)=>void}){
 const today=kyivToday(),currentHour=nowKyivHour();
 const available=['verified','mirror','stale'].includes(current.status);
 const actual=current.days||[],forecast=current.weeklyDays||[];
 const rows=dates.map(date=>{
  const direct=available?actual.find(d=>d.date===date):undefined;
  const predicted=available?forecast.find(d=>d.date===date):undefined;
  const source=direct?'daily':predicted?'forecast':'unknown';
  const day:PowerDay|undefined=direct||predicted;
  return {date,source,day,summary:summaryFor(day)};
 });
 return <>
  <div className="lh-power-grid-scroll" role="region" aria-label="Погодинний графік електроенергії" tabIndex={0}>
   <div className="lh-power-grid">
    <div className="lh-power-grid-label lh-power-hour-label"><span>Дата / година</span></div>
    {Array.from({length:24},(_,h)=><div key={h} className={'lh-power-grid-hour'+(today===dates[0]&&h===currentHour?' current':'')}><span>{String(h).padStart(2,'0')}</span></div>)}
    {rows.map(({date,source,day,summary})=><div className={'lh-power-grid-row'+(date===today?' is-today':'')} key={date}>
      <div className="lh-power-grid-date"><strong>{pretty(date,true)}</strong><span>{source==='daily'?(current.status==='verified'?'ДТЕК · добовий':'Добовий · дзеркало'):source==='forecast'?'Прогноз тижня':'Даних немає'}</span>{day&&<small>{Math.round(summary.known/48*100)}% годин відомо</small>}</div>
      {Array.from({length:24},(_,h)=>{
       const halves=hourView(day,h).halves;
       const chosen=picked?.date===date&&picked.hour===h;
       const title=pretty(date)+', '+hourText(h)+'–'+(h===23?'24:00':hourText(h+1))+'; '+timeRange(h,0)+' — '+statusName[halves[0]]+'; '+timeRange(h,1)+' — '+statusName[halves[1]]+(source==='forecast'?'; тижневий прогноз':'');
       return <button key={h} type="button" className={'lh-power-hour-cell'+(date===today&&h===currentHour?' now':'')+(chosen?' chosen':'')} title={title} aria-label={title} aria-pressed={chosen} onClick={()=>onPick({date,hour:h})}>
        <span className={'lh-power-half state-'+halves[0]}/><span className={'lh-power-half state-'+halves[1]}/>
       </button>;
      })}
    </div>)}
   </div>
  </div>
  <p className="lh-power-grid-note"><Info size={15}/> {mode==='week'?'Наступні 7 днів. Тижневий графік — прогноз; підтверджені години ДТЕК мають пріоритет.':'Натисни на годину, щоб побачити її перші та другі 30 хвилин.'} Сірі клітинки — дані відсутні, це не гарантія світла.</p>
 </>;
}

export function PowerPage({snapshot,refresh,report}:Props){
 const saved=snapshot.powerAddress||{settlement:'',street:'',house:''};
 const [address,setAddress]=useState<Address>(saved);
 const [editing,setEditing]=useState(!saved.house);
 const [saving,setSaving]=useState(false);
 const [fetching,setFetching]=useState(false);
 const [manualQueue,setManualQueue]=useState(snapshot.powerGroup||'');
 const [queueSaving,setQueueSaving]=useState(false);
 const [range,setRange]=useState<Range>('week');
 const [picked,setPicked]=useState<Selected|null>(null);
 useEffect(()=>setAddress(snapshot.powerAddress),[snapshot.powerAddress.settlement,snapshot.powerAddress.street,snapshot.powerAddress.house]);
 useEffect(()=>setManualQueue(snapshot.powerGroup||''),[snapshot.powerGroup]);
 const current=snapshot.powerLive;
 const today=kyivToday(),tomorrow=nextDay(today,1);
 const dateRange=range==='today'?[today]:range==='tomorrow'?[tomorrow]:Array.from({length:7},(_,n)=>nextDay(today,n));
 const selected=picked&&dateRange.includes(picked.date)?picked:null;
 const actual=selected?current.days?.find(d=>d.date===selected.date):undefined;
 const forecast=selected?current.weeklyDays?.find(d=>d.date===selected.date):undefined;
 const chosenDay:PowerDay|undefined=['verified','mirror','stale'].includes(current.status)?actual||forecast:undefined;
 const chosenHalves=selected?hourView(chosenDay,selected.hour).halves:null;
 const sourceAvailable=['verified','mirror','stale'].includes(current.status);
 const sourceLabel=current.status==='verified'?'Офіційний добовий графік':current.status==='mirror'?'Неофіційне дзеркало':current.status==='stale'?'Застарілі дані':'Графік не отримано';
 const addrLabel=saved.house?[saved.settlement,saved.street,saved.house].join(', '):'Адресу не збережено';
 const groupOrigin=snapshot.powerGroupOrigin==='official'?'Чергу визначив ДТЕК':snapshot.powerGroupOrigin==='manual'?'Чергу обрано вручну':'Черга не підтверджена';
 const allDates=dateRange.map(date=>current.days?.find(d=>d.date===date)||current.weeklyDays?.find(d=>d.date===date));
 const knownHours=sourceAvailable?allDates.reduce((sum,day)=>sum+summaryFor(day).known,0)/2:0;
 const totalHours=dateRange.length*24;
 async function fetchSchedule(){setFetching(true);try{const result=await window.lifehub.fetchPower();await refresh();report(result.message||'Дані перевірено');}catch(e){report(String(e instanceof Error?e.message:e));}finally{setFetching(false);}}
 async function saveAddress(){
  if(!address.settlement.trim()||!address.street.trim()||!address.house.trim()){report('Заповни місто, вулицю та будинок');return;}
  setSaving(true);
  try{
   await window.lifehub.savePowerAddress(address);await refresh();setEditing(false);
   setFetching(true);
   try{const result=await window.lifehub.fetchPower();await refresh();report(result.message||'Адресу збережено й перевірено');}
   catch(e){report('Адресу збережено. Перевірка: '+String(e instanceof Error?e.message:e));}
   finally{setFetching(false);}
  }catch(e){report(String(e instanceof Error?e.message:e));}finally{setSaving(false);}
 }
 async function saveGroup(){setQueueSaving(true);try{await window.lifehub.savePowerGroup(manualQueue);await refresh();report('Резервну чергу збережено. Перевір її відповідність адресі на ДТЕК.');}catch(e){report(String(e instanceof Error?e.message:e));}finally{setQueueSaving(false);}}
 function openOfficial(){void window.lifehub.openLink(DTEK_URL).catch(e=>report(String(e)));}
 return <div className="lh-power-studio">
  <header className="lh-power-hero"><div><span className="lh-power-eyebrow"><Zap size={15}/> LIFEHUB / POWER MONITOR</span><h1>Світло під контролем.</h1><p>Графік відключень за адресою. Швидкий перегляд по годинах без зайвих переходів.</p></div>
   <div className="lh-power-hero-actions"><button className="lh-power-refresh" type="button" disabled={!saved.house||fetching||saving} onClick={()=>void fetchSchedule()}><RefreshCw size={17} className={fetching?'spin':''}/>{fetching?'Оновлення…':'Оновити графік'}</button><button className="lh-power-official" type="button" onClick={openOfficial}><ExternalLink size={15}/> ДТЕК</button></div>
  </header>
  <section className="lh-power-summary">
   <div className="lh-power-summary-card"><span><MapPin size={17}/> МОЯ АДРЕСА</span><strong>{addrLabel}</strong><button onClick={()=>setEditing(v=>!v)}><Pencil size={14}/>{editing?'Згорнути':'Змінити адресу'}</button></div>
   <div className="lh-power-summary-card"><span><Zap size={17}/> ЧЕРГА</span><strong>{groupName(snapshot.powerGroup)}</strong><small>{groupOrigin}</small></div>
   <div className="lh-power-summary-card"><span><Clock3 size={17}/> ОСТАННЯ ПЕРЕВІРКА</span><strong>{updatedText(current.checkedAt)}</strong><small>{current.sourceUpdatedAt?'Джерело: '+updatedText(current.sourceUpdatedAt):'Час: Київ'}</small></div>
   <div className="lh-power-summary-card"><span><CalendarDays size={17}/> ПОКРИТТЯ ТАБЛИЦІ</span><strong>{Math.round(knownHours)} / {totalHours} год</strong><small>Невідомі години не вважаються світлом</small></div>
  </section>
  {editing&&<section className="lh-power-address-panel"><div className="lh-power-panel-header"><div><h2>Збережена адреса</h2><p>LifeHub спробує визначити чергу й отримати графік через ДТЕК.</p></div><span>Локально на ПК</span></div><div className="lh-power-address-fields"><label>Місто / село<input value={address.settlement} maxLength={100} placeholder="Наприклад, Фастів" onChange={e=>setAddress(v=>({...v,settlement:e.target.value}))}/></label><label>Вулиця / провулок<input value={address.street} maxLength={120} placeholder="Наприклад, пров. Поштовий" onChange={e=>setAddress(v=>({...v,street:e.target.value}))}/></label><label>Будинок<input value={address.house} maxLength={20} placeholder="26" onChange={e=>setAddress(v=>({...v,house:e.target.value}))}/></label></div><div className="lh-power-address-actions"><button disabled={saving||fetching||!address.house.trim()} type="button" onClick={()=>void saveAddress()}><Save size={16}/>{saving?'Збереження…':'Зберегти й отримати графік'}</button>{saved.house&&<button type="button" onClick={()=>{setAddress(saved);setEditing(false);}}>Скасувати</button>}</div></section>}
  <section className="lh-power-panel lh-power-chart-panel">
   <div className="lh-power-panel-header"><div><span className="lh-power-kicker">OUTAGE SCHEDULE</span><h2>Погодинний графік</h2><p>{sourceLabel}</p></div><div className="lh-power-tabs">{([{id:'today',text:'Сьогодні'},{id:'tomorrow',text:'Завтра'},{id:'week',text:'7 днів'}] as const).map(x=><button type="button" key={x.id} className={range===x.id?'active':''} onClick={()=>{setRange(x.id);setPicked(null);}}>{x.text}</button>)}</div></div>
   <div className={'lh-power-notice '+(current.status==='verified'?'verified':current.status==='mirror'?'mirror':'warning')}>{current.status==='verified'?<CheckCircle2 size={18}/>:current.status==='mirror'?<Info size={18}/>:<ShieldAlert size={18}/>}<span>{current.message||'Збережи адресу та онови графік.'}{current.status==='stale'?' Дані застарілі, перевір їх повторно.':''}</span></div>
   <div className="lh-power-legend"><span><i className="state-on"/> Є світло</span><span><i className="state-off"/> Немає світла</span><span><i className="state-possible"/> Можливо</span><span><i className="state-unknown"/> Невідомо</span><span className="lh-power-legend-partial"><i><b className="state-off"/><b className="state-on"/></i> 30 хв / 30 хв</span></div>
   <HourGrid dates={dateRange} current={current} mode={range} picked={selected} onPick={setPicked}/>
   {selected&&chosenHalves&&<div className="lh-power-hour-details"><div><span className="lh-power-kicker">ОБРАНА ГОДИНА</span><h3>{pretty(selected.date)} · {hourText(selected.hour)}–{selected.hour===23?'24:00':hourText(selected.hour+1)}</h3><p>{actual?(current.status==='verified'?'Офіційні години ДТЕК':'Добові дані дзеркала'):forecast?'Прогноз на тиждень — не факт відключення':'Години не опубліковані'}</p></div><div className="lh-power-detail-halves">{([0,1] as const).map(n=><div key={n}><i className={'state-'+chosenHalves[n]}/><strong>{timeRange(selected.hour,n)}</strong><span>{statusName[chosenHalves[n]]}</span></div>)}</div><button onClick={()=>setPicked(null)}>Закрити</button></div>}
   <div className="lh-power-source-note"><TriangleAlert size={16}/><span>Це графік, а не датчик фактичної напруги. Графіки можуть змінюватися. {current.forecastStale?'Тижневий прогноз застарілий. ':''}AI використовує тільки свіжий підтверджений добовий графік.</span></div>
  </section>
  <details className="lh-power-backup"><summary><ChevronDown size={17}/><strong>Не вдається визначити чергу?</strong><small>Резервне налаштування, якщо ДТЕК блокує запити</small></summary><div className="lh-power-backup-body"><p>Можеш вручну вибрати чергу, яку перевірив на офіційному сайті. Дзеркало показує графік черги, але <strong>не підтверджує</strong>, що це твій будинок. <button onClick={openOfficial}>Перевірити на ДТЕК <ExternalLink size={13}/></button></p><div><select aria-label="Резервна черга ДТЕК" value={manualQueue} onChange={e=>setManualQueue(e.target.value)}><option value="">Чергу не визначено</option>{groups.map(g=><option key={g} value={'GPV'+g}>Черга {g}</option>)}</select><button onClick={()=>void saveGroup()} disabled={queueSaving}><Save size={15}/>{queueSaving?'Збереження…':'Зберегти чергу'}</button></div></div></details>
 </div>;
}
