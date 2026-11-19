export type PowerStatus='on'|'off'|'possible'|'unknown';
export type DaySlot={start:string;end:string;status:PowerStatus};
export type PowerDay={date:string;slots:DaySlot[]};
export type HourView={hour:number;halves:[PowerStatus,PowerStatus]};
export const statusName:Record<PowerStatus,string>={on:'Є світло',off:'Немає світла',possible:'Можливе відключення',unknown:'Немає даних'};
export const hourText=(hour:number)=>String(hour).padStart(2,'0')+':00';
export function kyivToday(now=new Date()):string{
 const pieces=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=(name:string)=>pieces.find(p=>p.type===name)?.value||'';
 return get('year')+'-'+get('month')+'-'+get('day');
}
export function nextDay(value:string,offset:number):string{
 const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
}
const minutes=(x:string)=>{const match=/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.exec(x);if(!match)return null;const [h,m]=x.split(':').map(Number);return h*60+m;};
export function hourView(day:PowerDay|undefined,hour:number):HourView{
 const halves:[PowerStatus,PowerStatus]=['unknown','unknown'];if(!day||hour<0||hour>23)return {hour,halves};
 for(let i=0;i<2;i++){
  const begin=hour*60+i*30,end=begin+30;
  const candidates=new Set<PowerStatus>();
  for(const slot of day.slots||[]){
   const start=minutes(slot.start),stop=minutes(slot.end);
   if(start!==null&&stop!==null&&start<=begin&&stop>=end&&['on','off','possible'].includes(slot.status))candidates.add(slot.status);
  }
  if(candidates.size===1)halves[i]=[...candidates][0];
 }
 return {hour,halves};
}
export function summaryFor(day:PowerDay|undefined){
 if(!day)return {known:0,off:0,on:0,possible:0,unknown:48};
 const halves=Array.from({length:24},(_,i)=>hourView(day,i).halves).flat();
 return {known:halves.filter(s=>s!=='unknown').length,off:halves.filter(s=>s==='off').length,on:halves.filter(s=>s==='on').length,possible:halves.filter(s=>s==='possible').length,unknown:halves.filter(s=>s==='unknown').length};
}
export const timeRange=(hour:number,half:0|1)=>{const start=hour*60+half*30,end=start+30;const fmt=(m:number)=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');return fmt(start)+'–'+fmt(end);};
