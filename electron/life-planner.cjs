'use strict';
const {validDate,validTime,scheduledOccurs,taskDone,CATEGORIES,PRIORITIES}=require('./logic.cjs');
const {createHash}=require('node:crypto');
const defaults={thoughts:'',wake:'09:00',sleep:'00:00',freeMinutes:180,maxPlannedMinutes:480,buffer:10,days:7,includeProjects:true};
const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
const clock=n=>n===1440?'24:00':String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
function addDay(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function settings(raw){const r=raw||{},num=(x,def,lo,hi)=>Number.isInteger(x)&&x>=lo&&x<=hi?x:def;const wake=validTime(r.wake)&&r.wake?r.wake:defaults.wake,sleep=validTime(r.sleep)&&r.sleep?r.sleep:defaults.sleep;if(wake===sleep)throw Error('Час сну та підйому не можуть збігатися');return {thoughts:String(r.thoughts||'').slice(0,6000),wake,sleep,freeMinutes:num(r.freeMinutes,180,60,720),maxPlannedMinutes:num(r.maxPlannedMinutes,480,60,960),buffer:num(r.buffer,10,0,60),days:num(r.days,7,1,28),includeProjects:r.includeProjects!==false};}
const obj=props=>({type:'object',properties:props,required:Object.keys(props),additionalProperties:false}),str={type:'string'},int={type:'integer'};
const schema=obj({summary:str,assumptions:{type:'array',items:str},items:{type:'array',items:obj({title:str,note:str,category:{type:'string',enum:CATEGORIES},priority:{type:'string',enum:PRIORITIES},durationMinutes:int,chunkMinutes:int,earliest:str,deadline:str,fixedTime:str,group:str})},blocked:{type:'array',items:obj({date:str,start:str,end:str,reason:str})}});
function fingerprint(tasks){return createHash('sha256').update(JSON.stringify(tasks)).digest('hex');}
function build(raw,config,tasks,today,nowMinute=0){
 const s=settings(config);if(!validDate(today))throw Error('Некоректна дата');const endDate=addDay(today,s.days-1),wake=minutes(s.wake),bed=minutes(s.sleep),end=bed>wake?bed:1440,notes=[],unscheduled=[],blocks=[];
 const days=Array.from({length:s.days},(_,i)=>({date:addDay(today,i),occupancy:new Uint8Array(1440),planned:0,rest:0,existing:[],newTasks:[]}));
 const byDate=new Map(days.map(d=>[d.date,d]));if(bed<wake&&bed!==0)notes.push('Сон переходить через північ. Нічний час після 00:00 не використовується для нових справ.');
 const mark=(d,a,b,value)=>{for(let i=Math.max(0,a);i<Math.min(1440,b);i++)if(!d.occupancy[i])d.occupancy[i]=value;};
 const available=d=>d.occupancy.reduce((n,v)=>n+(v===0?1:0),0);
 function reserve(d,count,value,reverse=false){let taken=0;for(let j=0;j<1440&&taken<count;j++){const i=reverse?1439-j:j;if(!d.occupancy[i]){d.occupancy[i]=value;taken++;}}return taken;}
 function intervals(d,value){const out=[];let start=-1;for(let i=0;i<=1440;i++){if(i<1440&&d.occupancy[i]===value){if(start<0)start=i;}else if(start>=0){out.push({start:clock(start),end:clock(i),minutes:i-start});start=-1;}}return out;}
 for(const d of days){mark(d,0,wake,1);mark(d,end,1440,1);if(d.date===today)mark(d,0,Math.min(1440,Math.max(0,nowMinute+5)),1);}
 const orderedTasks=[...tasks].sort((a,b)=>Number(!!b.time)-Number(!!a.time));
 for(const d of days){
  const prev=addDay(d.date,-1);
  for(const t of tasks){if(t.time&&validTime(t.time)&&scheduledOccurs(t,prev)){const dur=Math.min(1440,Number(t.durationMin)||30),overflow=minutes(t.time)+dur+s.buffer-1440;if(overflow>0)mark(d,0,overflow,1);}}
  for(const t of orderedTasks){if(!scheduledOccurs(t,d.date))continue;const dur=Math.min(1440,Math.max(1,Number(t.durationMin)||30));if(!t.durationMin&&!taskDone(t,d.date))notes.push(d.date+' · '+t.title+': тривалість невідома, зарезервовано 30 хв.');
   if(t.time&&validTime(t.time)){const start=minutes(t.time);mark(d,start,start+dur+s.buffer,1);d.planned+=dur;d.existing.push({title:t.title,start:t.time,end:clock(Math.min(1440,start+dur)),minutes:dur});}
   else if(!taskDone(t,d.date)){d.planned+=dur;d.existing.push({title:t.title,start:'',end:'',minutes:dur});const got=reserve(d,dur+s.buffer,1);if(got<dur+s.buffer)notes.push(d.date+' · недостатньо часу на вже заплановану справу без часу: '+t.title);}
  }
 }
 for(const b of (Array.isArray(raw?.blocked)?raw.blocked:[]).slice(0,80)){const d=byDate.get(b.date);if(!d||!validTime(b.start)||!validTime(b.end)||!b.start||!b.end||minutes(b.start)>=minutes(b.end))continue;mark(d,minutes(b.start),minutes(b.end),1);d.existing.push({title:String(b.reason||'Зайнятий час').slice(0,120),start:b.start,end:b.end,minutes:minutes(b.end)-minutes(b.start)});}
 const items=(Array.isArray(raw?.items)?raw.items:[]).slice(0,50).map((x,i)=>{
  const title=String(x?.title||'').trim().slice(0,120),earliest=x.earliest||today,deadline=x.deadline||endDate;
  if(!title||(x.fixedTime&&earliest<today)||!validDate(earliest)||!validDate(deadline)||deadline<earliest||!Number.isInteger(x.durationMinutes)||x.durationMinutes<5||x.durationMinutes>6000||!Number.isInteger(x.chunkMinutes)||x.chunkMinutes<5||x.chunkMinutes>720||!validTime(x.fixedTime||'')){unscheduled.push({title:title||'Невідома справа',minutes:Math.max(0,Number(x.durationMinutes)||0),reason:'Некоректна оцінка або дата AI'});return null;}
  return {title,note:String(x.note||'').slice(0,360),category:CATEGORIES.includes(x.category)?x.category:'personal',priority:PRIORITIES.includes(x.priority)?x.priority:'normal',duration:x.durationMinutes,chunk:x.chunkMinutes,earliest:earliest<today?today:earliest,deadline:deadline>endDate?endDate:deadline,fixedTime:x.fixedTime||'',group:String(x.group||'').trim().slice(0,120),index:i};
 }).filter(Boolean);
 const groupCursor=new Map();
 const groupBlocked=new Set();
 const norm=t=>String(t).trim().toLocaleLowerCase('uk-UA');
 function fit(d,start,duration){return blocks.length<400&&start>=wake&&start+duration<=end&&d.planned+duration<=s.maxPlannedMinutes&&start>=0&&start+duration<=1440&&d.occupancy.subarray(start,Math.min(1440,start+duration+s.buffer)).every(v=>v===0);}
 function schedule(d,x,start,duration){mark(d,start,start+duration+s.buffer,3);d.planned+=duration;const title=x.title,task={title,category:x.category,dueDate:d.date,time:clock(start),allDay:false,recurrence:'none',priority:x.priority,durationMin:duration,progressType:'check',note:('[LifePlanner] '+x.note+(x.group?' · Проєкт/ціль: '+x.group:'')).slice(0,500)};d.newTasks.push(task);blocks.push(task);if(x.group)groupCursor.set(x.group,d.date+'T'+clock(start+duration));}
 // Fixed commitments go first. No slot is allocated if it would remove the protected rest allowance.
 for(const x of items.filter(x=>x.fixedTime)){const d=byDate.get(x.earliest),start=minutes(x.fixedTime),duplicate=d&&tasks.some(t=>scheduledOccurs(t,d.date)&&norm(t.title)===norm(x.title)&&t.time===x.fixedTime);if(duplicate){notes.push(x.title+' — уже є в календарі.');continue;}if(!d||d.date>x.deadline||x.group||!fit(d,start,x.duration)||available(d)<x.duration+s.buffer+s.freeMinutes){unscheduled.push({title:x.title,minutes:x.duration,reason:'Фіксований час конфліктує з календарем, сном, відпочинком або денним лімітом'});if(x.group)groupBlocked.add(x.group);continue;}schedule(d,x,start,x.duration);}
 for(const d of days){d.rest=reserve(d,s.freeMinutes,2,true);if(d.rest<s.freeMinutes)notes.push(d.date+' · уже наявні зобов’язання залишили лише '+d.rest+' хв захищеного вільного часу. Нові справи не витісняють відпочинок.');}
 // Groups retain the input order; deadlines prioritize independent groups, not later stages.
 const flex=items.filter(x=>!x.fixedTime);
 const groupDeadline=new Map();for(const x of flex)if(x.group)groupDeadline.set(x.group,[groupDeadline.get(x.group)||x.deadline,x.deadline].sort()[0]);
 flex.sort((a,b)=>(groupDeadline.get(a.group)||a.deadline).localeCompare(groupDeadline.get(b.group)||b.deadline)||a.index-b.index);
 for(const x of flex){let remaining=x.duration;
  if(x.group&&groupBlocked.has(x.group)){unscheduled.push({title:x.title,minutes:remaining,reason:'Попередній етап не вмістився'});continue;}
  // An existing plan for the exact same objective is not automatically duplicated.
  const existing=tasks.filter(t=>t.dueDate>=today&&t.dueDate<=x.deadline&&norm(t.title)===norm(x.title));
  if(existing.length){notes.push(x.title+' — уже є '+existing.length+' справ(и) з такою назвою; перевір їх перед повторним плануванням.');if(x.group)groupBlocked.add(x.group);unscheduled.push({title:x.title,minutes:remaining,reason:'Можливий дублікат наявної справи'});continue;}
  const candidates=days.filter(d=>d.date>=x.earliest&&d.date<=x.deadline&&d.rest>=s.freeMinutes);
  // One session per day first, then use additional slots if a deadline requires them.
  for(let pass=0;pass<20&&remaining>0;pass++){
   let added=false;
   for(const d of candidates){if(!remaining)break;const cursor=x.group?groupCursor.get(x.group):null;if(cursor&&d.date<cursor.slice(0,10))continue;
    const begin=Math.max(wake,cursor&&d.date===cursor.slice(0,10)?minutes(cursor.slice(11)):0);
    const preferred=Math.min(remaining,x.chunk,Math.max(0,s.maxPlannedMinutes-d.planned));
    let found=false;
    for(let length=preferred;length>=Math.min(15,remaining);length=length>15?Math.max(15,length-5):0){for(let start=Math.ceil(begin/5)*5;start+length<=end;start+=5){if(fit(d,start,length)){schedule(d,x,start,length);remaining-=length;added=found=true;break;}}if(found)break;}
   }
   if(!added)break;
  }
  if(remaining){unscheduled.push({title:x.title,minutes:remaining,reason:'Не вистачає вільних слотів до дедлайну'});if(x.group)groupBlocked.add(x.group);}
 }
 return {summary:String(raw?.summary||'').slice(0,1500),assumptions:[...new Set([...(Array.isArray(raw?.assumptions)?raw.assumptions.slice(0,30).map(x=>String(x).slice(0,350)):[]),...notes])].slice(0,100),tasks:blocks.sort((a,b)=>(a.dueDate+a.time).localeCompare(b.dueDate+b.time)),unscheduled,days:days.map(d=>({date:d.date,existing:d.existing,rest:intervals(d,2),restMinutes:d.rest,plannedMinutes:d.planned,remainingMinutes:available(d)}))};
}
module.exports={defaults,settings,schema,build,fingerprint,addDay};
