import {useEffect,useMemo,useRef,useState} from 'react';
import type {WheelEvent} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,Clock,Check,ChevronDown} from 'lucide-react';

const pad=(v:number)=>String(v).padStart(2,'0');
const dateString=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const ukMonth=new Intl.DateTimeFormat('uk-UA',{month:'long',year:'numeric'});
const ukDate=new Intl.DateTimeFormat('uk-UA',{day:'numeric',month:'long',year:'numeric'});

/** Self-contained date picker, never relies on Windows native controls or remote scripts. */
export function LifeDatePicker({value,onChange}:{value:string;onChange:(date:string)=>void}){
 const parsed=new Date((/^\d{4}-\d{2}-\d{2}$/.test(value)?value:dateString(new Date()))+'T12:00:00');
 const [open,setOpen]=useState(false),[month,setMonth]=useState(()=>new Date(parsed.getFullYear(),parsed.getMonth(),1));
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const handler=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',handler);return()=>document.removeEventListener('pointerdown',handler);},[open]);
 function move(n:number){setMonth(m=>new Date(m.getFullYear(),m.getMonth()+n,1));}
 const cells=useMemo(()=>{const start=new Date(month.getFullYear(),month.getMonth(),1);const monday=(start.getDay()+6)%7;return Array.from({length:42},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i-monday+1));},[month]);
 return <div className="lh-date-control" ref={root}>
  <button type="button" className="lh-date-trigger" aria-expanded={open} onClick={()=>{setMonth(new Date(parsed.getFullYear(),parsed.getMonth(),1));setOpen(o=>!o);}}><CalendarDays size={17}/>{ukDate.format(parsed)}<ChevronDown size={15}/></button>
  {open&&<div className="lh-datepicker-popup" role="dialog" aria-label="Вибір дати">
   <div className="lh-cal-head"><button type="button" aria-label="Попередній місяць" onClick={()=>move(-1)}><ChevronLeft size={18}/></button><strong>{ukMonth.format(month)}</strong><button type="button" aria-label="Наступний місяць" onClick={()=>move(1)}><ChevronRight size={18}/></button></div>
   <div className="lh-cal-grid">{['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d=><span className="lh-cal-weekday" key={d}>{d}</span>)}{cells.map((d,i)=>{const v=dateString(d);return <button type="button" key={i} className={`lh-cal-day ${v===value?'selected':''} ${d.getMonth()!==month.getMonth()?'outside':''} ${v===dateString(new Date())?'is-today':''}`} onClick={()=>{onChange(v);setOpen(false);}}>{d.getDate()}</button>;})}</div>
   <button type="button" className="lh-cal-today" onClick={()=>{onChange(dateString(new Date()));setOpen(false);}}>Перейти на сьогодні</button>
  </div>}
 </div>;
}

/** 12-hour tactile wheels, stored as 24h HH:mm; keyboard and native mouse wheel supported. */
export function LifeTimeWheel({value,onChange}:{value:string;onChange:(time:string)=>void}){
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
 const h24=/^\d{2}:\d{2}$/.test(value)?Number(value.slice(0,2)):9;
 const mins=/^\d{2}:\d{2}$/.test(value)?Number(value.slice(3,5)):0;
 const hour12=h24%12||12,ampm=h24>=12?'PM':'AM';
 const set=(hour:number,minute:number,half:string)=>onChange(`${pad(hour%12+(half==='PM'?12:0))}:${pad(minute)}`);
 useEffect(()=>{if(!open)return;const handler=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',handler);return()=>document.removeEventListener('pointerdown',handler);},[open]);
 const wheel=(e:WheelEvent,values:number[],current:number,onPick:(n:number)=>void)=>{e.preventDefault();const at=values.indexOf(current);onPick(values[(at+(e.deltaY>0?1:values.length-1))%values.length]);};
 function column(values:number[],current:number,onPick:(n:number)=>void,name:string){return <div className="lh-wheel-col" role="listbox" aria-label={name} tabIndex={0} onWheel={e=>wheel(e,values,current,onPick)} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();onPick(values[(values.indexOf(current)+(e.key==='ArrowDown'?1:values.length-1))%values.length]);}}}>{values.map(n=><button type="button" role="option" aria-selected={n===current} className={n===current?'active':''} onClick={()=>onPick(n)} key={n}>{pad(n)}</button>)}</div>;}
 return <div className="lh-time-control" ref={root}>
  <button className="lh-date-trigger" type="button" aria-expanded={open} onClick={()=>{if(!value)set(h24,mins,ampm);setOpen(o=>!o);}}><Clock size={17}/>{value||'Вибрати час'}<ChevronDown size={15}/></button>
  {open&&<div className="lh-time-popup" role="dialog" aria-label="Вибір часу"><div className="lh-time-title">Прокручуй або вибирай час</div><div className="lh-time-wheels">{column(Array.from({length:12},(_,i)=>i+1),hour12,n=>set(n,mins,ampm),'Година')}{column(Array.from({length:60},(_,i)=>i),mins,n=>set(hour12,n,ampm),'Хвилини')}<div className="lh-wheel-col meridiem" role="group" aria-label="Половина дня">{['AM','PM'].map(part=><button type="button" className={part===ampm?'active':''} onClick={()=>set(hour12,mins,part)} key={part}>{part}</button>)}</div></div><div className="lh-time-footer"><button type="button" onClick={()=>{onChange('');setOpen(false);}}>Без часу</button><button type="button" className="done" onClick={()=>setOpen(false)}><Check size={15}/> Готово</button></div></div>}
 </div>;
}
