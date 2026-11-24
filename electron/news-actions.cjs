'use strict';
const norm=s=>String(s||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const stop=new Set('the a an to of in for on and is are from with by at as new news this that after over into will has have not says more how what why у в на за до для та і й з із про що як це не по від після до новини новость новости новый новая новые это для что как при'.split(' '));
function tokens(title){return [...new Set((norm(title).match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(w=>!stop.has(w)))].slice(0,24);}
function disposition(db,id,action){
 const article=db.news.items.find(x=>x.id===id);
 if(!article)throw new Error('Новина більше не доступна. Онови стрічку.');
 if(!['interesting','not','save'].includes(action))throw new Error('Невідома дія');
 db.newsDismissed=db.newsDismissed||{};db.newsFeedback=db.newsFeedback||{};db.newsSaved=db.newsSaved||[];
 const at=new Date().toISOString();db.newsDismissed[id]=at;
 if(action!=='save')db.newsFeedback[id]={vote:action,category:article.category,title:article.title,source:article.source,keywords:tokens(article.title),at};
 if(action==='save'&&!db.newsSaved.some(x=>x.id===id))db.newsSaved.unshift(article);
 db.news.items=db.news.items.filter(x=>x.id!==id);
 const threshold=Date.now()-45*86400000;
 for(const [key,stamp] of Object.entries(db.newsDismissed))if(Date.parse(stamp)<threshold)delete db.newsDismissed[key];
 db.newsFeedback=Object.fromEntries(Object.entries(db.newsFeedback).sort((a,b)=>String(a[1].at).localeCompare(String(b[1].at))).slice(-800));
 db.newsSaved=db.newsSaved.slice(0,150);return true;
}
function filterIncoming(items,db){
 const dismissed=db.newsDismissed||{},likes=db.newsFeedback||{},saved=new Set((db.newsSaved||[]).map(x=>x.id)),muted=new Set((db.newsMutedSources||[]).map(norm));
 return items.filter(x=>!dismissed[x.id]&&!likes[x.id]&&!saved.has(x.id)&&!muted.has(norm(x.source)));
}
function score(item,feedback,now=Date.now()){
 const terms=new Set(tokens(item.title));let category=0,topic=0,source=0;
 for(const f of Object.values(feedback||{})){
  if(!f||!['interesting','not'].includes(f.vote))continue;
  const age=Math.max(0,(now-(Date.parse(f.at)||now))/86400000),w=(f.vote==='interesting'?1:-1.65)*Math.pow(.5,age/30);
  if(f.category===item.category)category+=w;
  if(f.source&&norm(f.source)===norm(item.source))source+=w;
  const overlap=(f.keywords||tokens(f.title)).filter(x=>terms.has(x)).length;
  topic+=Math.min(3,overlap)*w;
 }
 const affinity=Math.tanh(category/6)*1.7+Math.tanh(topic/5)*2.8+Math.tanh(source/5)*.8;
 const ageH=Math.max(0,(now-Date.parse(item.publishedAt))/3600000)||0;
 return {score:affinity+Math.max(0,1-ageH/168)+(item.imageUrl?.length?.valueOf()?0.12:0),affinity,reason:affinity>1.2?'Схоже на вподобане':ageH<6?'Свіжа новина':''};
}
function rankNews(items,feedback,now=Date.now()){
 const pool=items.map(x=>({...x,...score(x,feedback,now)})).sort((a,b)=>b.score-a.score||b.publishedAt.localeCompare(a.publishedAt));
 const out=[];
 while(pool.length){
  let idx=0;
  if(out.length>=2){const recent=out.slice(-2);const found=pool.findIndex(x=>!recent.every(y=>y.category===x.category)&&!recent.every(y=>norm(y.source)===norm(x.source)));if(found>=0)idx=found;}
  out.push(pool.splice(idx,1)[0]);
 }
 return out;
}
function muteSource(db,source,muted=true){
 const name=String(source||'').trim().slice(0,100);if(!name)throw Error('Невідоме джерело');
 const list=(db.newsMutedSources||[]).filter(x=>norm(x)!==norm(name));if(muted)list.push(name);
 db.newsMutedSources=list.slice(-100);return true;
}
module.exports={disposition,filterIncoming,rankNews,score,tokens,muteSource};
