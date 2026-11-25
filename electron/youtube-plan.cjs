'use strict';
const {validDate}=require('./logic.cjs');
function planOptions(raw,now=new Date()){
 const days=Number(raw?.days),shorts=Number(raw?.shorts),longs=Number(raw?.longs),start=String(raw?.start||'');
 const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 if(![7,14,30].includes(days)||!Number.isInteger(shorts)||!Number.isInteger(longs)||shorts<0||longs<0||shorts+longs<1||shorts+longs>30||!validDate(start)||start<today)throw Error('Період 7/14/30 днів, від 1 до 30 роликів, дата не в минулому');
 return {days,shorts,longs,start,brief:String(raw.brief||'').slice(0,700)};
}
const schema={type:'object',additionalProperties:false,properties:{strategy:{type:'string'},items:{type:'array',items:{type:'object',additionalProperties:false,properties:{day:{type:'integer'},format:{type:'string',enum:['short','long']},title:{type:'string'},hook:{type:'string'},script:{type:'string'},note:{type:'string'},referenceId:{type:'string'}},required:['day','format','title','hook','script','note','referenceId']}}},required:['strategy','items']};
function validatePlan(raw,options,refs=[]){
 if(!Array.isArray(raw?.items)||raw.items.length!==options.shorts+options.longs)throw Error('AI повернув неправильну кількість роликів. Зменш кількість або повтори.');
 const count=f=>raw.items.filter(x=>x.format===f).length;
 if(count('short')!==options.shorts||count('long')!==options.longs)throw Error('AI не дотримався поділу Shorts/Long');
 const t=(x,n)=>String(x??'').trim().slice(0,n),seen=new Set(),lookup=new Map(refs.map(x=>[x.id,x.url]));
 const items=raw.items.map(x=>{
  const title=t(x.title,130),day=Number(x.day);if(!title||!Number.isInteger(day)||day<1||day>options.days||seen.has(title.toLowerCase()))throw Error('Некоректні або дубльовані ідеї AI');
  seen.add(title.toLowerCase());const d=new Date(options.start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+day-1);
  return {title,date:d.toISOString().slice(0,10),format:x.format,hook:t(x.hook,500),script:t(x.script,8000),note:t(x.note,1800),url:lookup.get(x.referenceId)||''};
 });
 return {strategy:t(raw.strategy,8000),items};
}
module.exports={planOptions,schema,validatePlan};
