'use strict';
// Public-link diagnostics only. We NEVER request a user's favorites or infer audio metadata.
// No private TikTok data or arbitrary URL fetching; the only network request is TikTok oEmbed.
function classifyTikTokUrl(value){
 if(typeof value!=='string'||value.length>1200)return {kind:'invalid',message:'Встав посилання TikTok завдовжки до 1200 символів.'};
 let url;try{url=new URL(value.trim());}catch{return {kind:'invalid',message:'Некоректне посилання.'};}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||!['tiktok.com','www.tiktok.com','m.tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(host))return {kind:'invalid',message:'Потрібне HTTPS-посилання саме на TikTok.'};
 if(['vm.tiktok.com','vt.tiktok.com'].includes(host))return {kind:'short',url:url.href,message:'Це коротке посилання. Відкрий його та скопіюй повний URL відео. Автоматично переходити за скороченнями LifeHub не буде.'};
 if(/^\/@[^/]+\/video\/\d+(?:\/|$)/.test(url.pathname))return {kind:'video',url:url.href,message:'Публічний ролик. Перевіряємо його метадані через TikTok oEmbed.'};
 if(/\b(collection|collections|favorite|favorites|playlist|saved|bookmark)\b/i.test(url.pathname+url.search))return {kind:'collection',url:url.href,message:'Посилання на колекцію розпізнано, але публічний TikTok API не повертає список твоїх «Збережених» через таку адресу. Поки додавай окремі ролики.'};
 return {kind:'unknown',url:url.href,message:'Це посилання TikTok, але не на окремий ролик. Автоматично прочитати з нього колекцію чи аудіотреки LifeHub зараз не може.'};
}
async function checkTikTokUrl(value,fetcher=fetch){
 const parsed=classifyTikTokUrl(value);
 if(parsed.kind!=='video')return {status:parsed.kind,message:parsed.message,url:parsed.url||'',title:'',author:''};
 try{
  const endpoint='https://www.tiktok.com/oembed?url='+encodeURIComponent(parsed.url);
  const res=await fetcher(endpoint,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if(!res.ok)return {status:'unavailable',url:parsed.url,title:'',author:'',message:`TikTok не надав відкритих даних для відео (HTTP ${res.status}). Відкрий його в браузері.`};
  const raw=await res.text();if(raw.length>20000)throw new Error('Відповідь занадто велика');
  const item=JSON.parse(raw);
  if(item.provider_name!=='TikTok')throw new Error('Не підтверджено джерело');
  return {status:'video',url:parsed.url,title:String(item.title||'').slice(0,220),author:String(item.author_name||'').slice(0,100),message:'Публічний ролик доступний через TikTok oEmbed. Назва та автор перевірені; назву пісні / звук цей API не визначає.'};
 }catch{return {status:'unavailable',url:parsed.url,title:'',author:'',message:'Публічне прев’ю зараз недоступне (мережа або обмеження TikTok). Це не перевірка твоїх збережених і не розпізнавання музики.'};}
}
module.exports={classifyTikTokUrl,checkTikTokUrl};
