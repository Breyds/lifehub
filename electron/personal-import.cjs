'use strict';
/** Local-only, explicit-review importer for LifeHub Personal Import v1.
 * Never schedule a task without a user-supplied date. Does not import tokens,
 * medical profiles, historical items or preferences automatically.
 */
const {KINDS}=require('./workspace.cjs');
const {validDate,cleanTask}=require('./logic.cjs');
const neat=s=>String(s??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('uk-UA');
const clean=s=>String(s??'').trim().slice(0,200);
function candidates(raw){
 if(!raw||raw.format!=='lifehub-personal-review-import'||!raw.proposedData||typeof raw.proposedData!=='object')throw Error('Це не LifeHub Personal Import JSON');
 const list=[];
 const work=raw.proposedData.workspace;
 if(work&&typeof work==='object')for(const kind of KINDS){
  for(const item of (Array.isArray(work[kind])?work[kind].slice(0,150):[])){
   if(!item||typeof item!=='object'||!clean(item.title))continue;
   const id=`workspace:${kind}:${list.length}`;
   list.push({id,title:clean(item.title),kind,recordType:'workspace',status:item._review?.decision==='ready'?'ready':'review',reason:clean(item._review?.note),raw:item});
  }
 }
 for(const item of (Array.isArray(raw.proposedData.taskDrafts)?raw.proposedData.taskDrafts.slice(0,100):[])){
  if(!item||typeof item!=='object'||!clean(item.title))continue;
  list.push({id:`draft:${list.length}`,title:clean(item.title),kind:'tasks',recordType:'draft',status:'review',reason:clean(item.reason),recurrence:['daily','weekly','weekdays'].includes(item.recurrenceProposal)?item.recurrenceProposal:'none',time:/^\d{2}:\d{2}$/.test(item.timeProposal||'')?item.timeProposal:'',raw:item});
 }
 return list.slice(0,300);
}
function publicCandidates(list,db){return list.map(x=>{
 const exists=x.recordType==='workspace'?(db.workspace[x.kind]||[]).some(y=>neat(y.title)===neat(x.title)):
 db.tasks.some(t=>neat(t.title)===neat(x.title) && t.category===x.raw.category);
 return {id:x.id,title:x.title,kind:x.kind,recordType:x.recordType,reason:x.reason,status:exists?'duplicate':x.status,recurrence:x.recurrence,time:x.time,exists};
});}
function applyCandidates(db,list,chosen,addItem){
 if(!Array.isArray(chosen)||chosen.length>300)throw Error('Некоректний список записів');
 const ids=new Set();const staged=[];let ignored=0;
 for(const pick of chosen){
  if(!pick||typeof pick.id!=='string'||ids.has(pick.id))continue;ids.add(pick.id);
  const x=list.find(c=>c.id===pick.id);
  if(!x)throw Error('Невідомий запис у файлі імпорту');
  if(x.recordType==='workspace'){
   if((db.workspace[x.kind]||[]).some(t=>neat(t.title)===neat(x.title))){ignored++;continue;}
   staged.push({type:'workspace',kind:x.kind,raw:x.raw});
  }else{
   if(!validDate(pick.date))throw Error(`Для «${x.title}» потрібно вибрати дату`);
   const task=cleanTask({title:x.title,category:x.raw.category,dueDate:pick.date,time:x.time||'',allDay:!x.time,recurrence:x.recurrence,priority:['normal','high','critical','urgent'].includes(x.raw.priorityProposal)?x.raw.priorityProposal:'normal',progressType:x.raw.progressProposal?.type==='counter'?'counter':'check',target:x.raw.progressProposal?.target||1,unit:x.raw.progressProposal?.unit||'',note:clean(x.reason)});
   if(db.tasks.some(t=>neat(t.title)===neat(task.title)&&t.category===task.category&&t.dueDate===task.dueDate&&t.recurrence===task.recurrence)){ignored++;continue;}
   staged.push({type:'task',raw:task});
  }
 }
 // Prepare on a copy first, so one malformed item cannot partially import earlier records.
 const nextWorkspace=structuredClone(db.workspace),nextTasks=db.tasks.slice();
 for(const entry of staged){if(entry.type==='workspace')addItem(nextWorkspace,entry.kind,entry.raw);else nextTasks.push(entry.raw);}
 db.workspace=nextWorkspace;db.tasks=nextTasks;
 return {added:staged.length,skipped:ignored,workspace:staged.filter(x=>x.type==='workspace').length,tasks:staged.filter(x=>x.type==='task').length};
}
module.exports={candidates,publicCandidates,applyCandidates};
