import {useState} from 'react';
import {FileJson,ShieldCheck,CheckCircle2} from 'lucide-react';
import type {PersonalImportRecord} from './types';

const kindNames:Record<string,string>={projects:'Проєкти',channels:'YouTube-канали',ideas:'Ідеї',programs:'Програми',tasks:'Чернетки справ',songs:'Музика',streams:'Стріми'};
const today=()=>new Date().toLocaleDateString('sv-SE');
/** Dedicated import preview for the user-approved personal-review export; NEVER silently inserts tasks. */
export function PersonalImportPanel({onComplete,report}:{onComplete:()=>Promise<void>;report:(s:string)=>void}){
 const [records,setRecords]=useState<PersonalImportRecord[]>([]),[selected,setSelected]=useState<string[]>([]),[dates,setDates]=useState<Record<string,string>>({}),[loading,setLoading]=useState(false),[loaded,setLoaded]=useState(false);
 async function open(){setLoading(true);try{const result=await window.lifehub.previewPersonalImport();if(result){setRecords(result.records);setSelected(result.records.filter(x=>x.status==='ready'&&!x.exists&&x.recordType==='workspace').map(x=>x.id));setDates({});setLoaded(true);}}catch(e){report(String(e));}finally{setLoading(false);}}
 async function apply(){setLoading(true);try{const selectedRows=records.filter(x=>selected.includes(x.id));const missing=selectedRows.find(x=>x.recordType==='draft'&&!dates[x.id]);if(missing){report(`Спочатку вибери дату для «${missing.title}»`);return;}const res=await window.lifehub.applyPersonalImport(selectedRows.map(x=>({id:x.id,date:dates[x.id]})));report(`Імпорт: додано ${res.added}, пропущено дублікатів ${res.skipped}`);setSelected([]);setLoaded(false);setRecords([]);await onComplete();}catch(e){report(String(e));}finally{setLoading(false);}}
 return <section className="panel lh-import-panel"><div className="setting-header"><div className="setting-icon"><FileJson size={22}/></div><div><h2>Особистий JSON LifeHub</h2><p>Проєкти й чернетки з наших чатів · перевір перед додаванням</p></div></div>
  <p className="lh-import-hint"><ShieldCheck size={16}/> Файл аналізується локально. Існуючі дані не перезаписуються; чернетки без обраної дати не потрапляють у календар.</p>
  <button type="button" className="button outline" disabled={loading} onClick={()=>void open()}><FileJson size={16}/> Вибрати LifeHub-Personal-Import.json</button>
  {loaded&&<><div className="lh-import-caption">Знайдено {records.length} пропозицій. Позначені як «Можна додати» проєкти вибрані за замовчуванням, справи — ні.</div><div className="lh-import-items">{records.map(x=><div className={`lh-import-row ${x.exists?'duplicate':''}`} key={x.id}>
   <label><input type="checkbox" disabled={x.exists||loading} checked={selected.includes(x.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,x.id]:v.filter(id=>id!==x.id))}/><span><strong>{x.title}</strong><small>{kindNames[x.kind]||x.kind} · {x.status==='duplicate'?'Вже є у LifeHub':x.status==='ready'?'Можна додати':'Потрібно підтвердити'}</small>{x.reason&&<small>{x.reason}</small>}</span></label>
   {x.recordType==='draft'&&selected.includes(x.id)&&<div className="lh-import-date"><span>Дата початку</span><input type="date" min={today()} value={dates[x.id]||''} onChange={e=>setDates(d=>({...d,[x.id]:e.target.value}))}/><small>{x.recurrence!=='none'?`Повторення: ${x.recurrence}`:'Одноразова справа'}</small></div>}
  </div>)}</div><div className="lh-import-footer"><span>Вибрано: {selected.length}</span><button type="button" className="button primary" disabled={!selected.length||loading} onClick={()=>void apply()}><CheckCircle2 size={16}/> Підтвердити імпорт</button></div></>}
 </section>;
}
