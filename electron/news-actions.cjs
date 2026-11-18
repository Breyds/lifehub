'use strict';
// The 'not interesting' action retains only an article ID tombstone to avoid re-showing;
// no text, image or dislike category is kept. Likes keep category + headline to learn taste.
function disposition(db,id,action){
 const article=db.news.items.find(x=>x.id===id);
 if(!article)throw new Error('Новина більше не доступна. Онови стрічку.');
 if(!['interesting','not','save'].includes(action))throw new Error('Невідома дія');
 db.newsDismissed=db.newsDismissed||{};db.newsFeedback=db.newsFeedback||{};db.newsSaved=db.newsSaved||[];
 db.newsDismissed[id]=new Date().toISOString();
 if(action==='interesting')db.newsFeedback[id]={vote:'interesting',category:article.category,title:article.title,at:new Date().toISOString()};
 if(action==='save'&&!db.newsSaved.some(x=>x.id===id))db.newsSaved.unshift(article);
 if(action==='not')delete db.newsFeedback[id];
 db.news.items=db.news.items.filter(x=>x.id!==id);
 // Bounded history; age out dismissed IDs after 45 days.
 const threshold=Date.now()-45*86400000;
 for(const [key,stamp] of Object.entries(db.newsDismissed))if(Date.parse(stamp)<threshold)delete db.newsDismissed[key];
 db.newsSaved=db.newsSaved.slice(0,150);
 return true;
}
function filterIncoming(items,db){const dismissed=db.newsDismissed||{},likes=db.newsFeedback||{},saved=new Set((db.newsSaved||[]).map(x=>x.id));return items.filter(x=>!dismissed[x.id]&&!likes[x.id]&&!saved.has(x.id));}
module.exports={disposition,filterIncoming};
