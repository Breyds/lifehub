import {useEffect,useState} from 'react';
import {Zap,RefreshCw,Save,ShieldAlert,Clock,ExternalLink} from 'lucide-react';
import type {Snapshot,PowerLive} from './types';
type Address={settlement:string;street:string;house:string};
type Props={snapshot:Snapshot;refresh:()=>Promise<void>;report:(msg:string)=>void};
const dayKey=(n=0)=>{
 const d=new Date();d.setDate(d.getDate()+n);
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
};
const statuses:Record<string,string>={on:'Є світло',off:'Немає світла',possible:'Можливе відключення',unknown:'Невідомо'};
function Timeline({day}:{day:NonNullable<PowerLive['days']>[number]}){
 const toMin=(s:string)=>{const [h,m]=s.split(':').map(Number);return h*60+m;};
 return <div className="hub-electric-day"><h3>{new Date(day.date+'T12:00:00').toLocaleDateString('uk-UA',{weekday:'long',day:'numeric',month:'long'})}</h3>
  <div className="hub-electric-timeline" aria-label="Періоди світла на добу">{day.slots.map((s,i)=><span key={i} className={'power-'+s.status} style={{flexGrow:Math.max(1,toMin(s.end)-toMin(s.start))}} title={`${s.start}–${s.end}: ${statuses[s.status]||'Невідомо'}`}/>)}</div>
  <div className="hub-electric-periods">{day.slots.filter(s=>s.status!=='unknown').map((s,i)=><div key={i} className={'power-'+s.status}><strong>{s.start}–{s.end}</strong><span>{statuses[s.status]||'Невідомо'}</span></div>)}</div>
 </div>;
}
export function PowerPage({snapshot,refresh,report}:Props){
 const [address,setAddress]=useState<Address>(snapshot.powerAddress||{settlement:'',street:'',house:''});
 const [saving,setSaving]=useState(false),[fetching,setFetching]=useState(false),[groupSaving,setGroupSaving]=useState(false);
 const [group,setGroup]=useState(snapshot.powerGroup||'');
 useEffect(()=>{setAddress(snapshot.powerAddress);},[snapshot.powerAddress.settlement,snapshot.powerAddress.street,snapshot.powerAddress.house]);
 useEffect(()=>setGroup(snapshot.powerGroup||''),[snapshot.powerGroup]);
 const current=snapshot.powerLive,verified=current?.status==='verified',isMirror=current?.status==='mirror',showDays=verified||isMirror||current?.status==='stale',today=dayKey(),tomorrow=dayKey(1),days=current?.days||[];
 async function save(){setSaving(true);try{await window.lifehub.savePowerAddress(address);await refresh();report('Адресу збережено локально. Тепер натисни «Оновити графік».');}catch(e){report(e instanceof Error?e.message:String(e));}finally{setSaving(false);}}
 async function saveGroup(){setGroupSaving(true);try{await window.lifehub.savePowerGroup(group);await refresh();report('Чергу збережено для резервного графіка');}catch(e){report(e instanceof Error?e.message:String(e));}finally{setGroupSaving(false);}}
 async function fetchSchedule(){setFetching(true);try{const result=await window.lifehub.fetchPower();await refresh();report(result.message||'Перевірку завершено');}catch(e){report(e instanceof Error?e.message:String(e));}finally{setFetching(false);}}
 return <div className="hub-workspace hub-power-page">
  <div className="hub-heading"><div><div className="hub-kicker">PERSONAL / ELECTRICITY</div><h1><Zap size={27}/> Світло</h1><p>Графік за твоєю адресою на сьогодні й завтра. Дані лише з ДТЕК, без вигаданих годин.</p></div><button className="button primary" disabled={fetching||saving||!snapshot.powerAddress.house} onClick={()=>void fetchSchedule()}><RefreshCw size={16}/>{fetching?'Перевіряю ДТЕК…':'Оновити графік'}</button></div>
  <section className="hub-surface hub-power-address"><h2>Адреса для ДТЕК</h2><p>Введи один раз. Зберігається локально на цьому комп’ютері; надсилається лише для перевірки до ДТЕК.</p>
   <div className="hub-address-fields"><label><span>Населений пункт</span><input value={address.settlement} maxLength={100} onChange={e=>setAddress({...address,settlement:e.target.value})}/></label><label><span>Вулиця</span><input value={address.street} maxLength={120} onChange={e=>setAddress({...address,street:e.target.value})}/></label><label><span>Будинок</span><input value={address.house} maxLength={20} onChange={e=>setAddress({...address,house:e.target.value})}/></label></div>
   <button className="hub-soft-button" disabled={saving||fetching||!address.house.trim()} onClick={()=>void save()}><Save size={15}/>{saving?'Збереження…':'Зберегти адресу'}</button>
  </section>
  <section className="hub-surface hub-power-backup"><h2>Резервний графік за чергою</h2><p>Якщо ДТЕК блокує визначення черги за адресою, один раз обери свою чергу з офіційного графіка. LifeHub братиме сьогодні/завтра з публічного дзеркала. Воно не підтверджує, що ця черга належить твоєму будинку.</p><div className="hub-tool-row"><select aria-label="Моя черга ДТЕК" value={group} onChange={e=>setGroup(e.target.value)}><option value="">Чергу не визначено</option>{Array.from({length:6},(_,i)=>i+1).flatMap(i=>[1,2].map(n=><option key={`${i}.${n}`} value={`GPV${i}.${n}`}>{i}.{n}</option>))}</select><button className="hub-soft-button" disabled={groupSaving} onClick={()=>void saveGroup()}><Save size={14}/> {groupSaving?'Зберігаю…':'Зберегти чергу'}</button></div><p className="hub-footnote">Дані дзеркала можуть запізнюватися. Перевір точність черги на <button type="button" className="hub-inline-link" onClick={()=>void window.lifehub.openLink("https://www.dtek-krem.com.ua/ua/shutdowns").catch(e=>report(String(e)))}>офіційному сайті</button>.</p></section>
  <section className="hub-surface hub-power-results"><div className="hub-section-head"><div><h2>Графік ДТЕК</h2><p>{current?.checkedAt?'Перевірка: '+new Date(current.checkedAt).toLocaleString('uk-UA'):'Ще не перевіряли'}</p></div><span className={'hub-electric-badge '+(verified?'is-verified':isMirror?'is-mirror':'')}>{verified?'Дані ДТЕК':isMirror?'Дзеркало · перевір чергу':current?.status==='stale'?'Застарілі дані':'Немає підтвердження'}</span></div>
   <p className="hub-electric-note">{current?.message||'Збережи адресу та онови графік.'}</p>
   <div className="hub-electric-legend"><span className="power-on">Є світло</span><span className="power-off">Немає світла</span><span className="power-possible">Можливо</span><span className="power-unknown">Немає даних</span></div>
   <div className="hub-electric-days">{[today,tomorrow].map(date=>{const day=days.find(x=>x.date===date);return day&&showDays?<Timeline key={date} day={day}/>:<div className="hub-electric-day" key={date}><h3>{new Date(date+'T12:00:00').toLocaleDateString('uk-UA',{weekday:'long',day:'numeric',month:'long'})}</h3><div className="hub-electric-no-data"><ShieldAlert size={20}/> Немає підтвердженого розкладу на цю дату. Це не означає, що світло буде цілий день.</div></div>;})}</div>
   <p className="hub-footnote"><Clock size={14}/> Графіки можуть змінюватися протягом дня. Поки ДТЕК не підтвердив години, AI не повинен використовувати їх як факт.</p>
   <button className="hub-soft-button" onClick={()=>void window.lifehub.openLink('https://www.dtek-krem.com.ua/ua/shutdowns').catch(e=>report(String(e)))}>Порівняти з офіційним сайтом <ExternalLink size={14}/></button>
  </section>
 </div>;
}
