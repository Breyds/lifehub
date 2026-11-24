'use strict';
// RSS-only public sources. No scraping authenticated pages and no simulated popularity metrics.
const FEEDS={
 anime:{label:'Аніме',queries:['anime announcement OR anime trailer OR anime premiere','manga news OR anime season']},
 games:{label:'Ігри',queries:['video game releases OR gaming announcements','Steam OR PlayStation OR Xbox OR Nintendo gaming news']},
 internet:{label:'Інтернет',queries:['social media platform news OR creator economy','YouTube OR TikTok OR Twitch OR Reddit updates','internet culture OR viral online trends']},
 world:{label:'Світ',queries:['world international news','global economy OR science OR diplomacy']},
 tech:{label:'Технології',queries:['technology product announcements OR AI news','hardware OR software OR consumer electronics news']},
 europe:{label:'Європа',queries:['Europe latest news','European economy OR European technology']},
 america:{label:'Америка',queries:['United States Canada news','Latin America news']},
 asia:{label:'Азія',queries:['Japan Korea China news','South Asia OR Southeast Asia news']},
 africa:{label:'Африка',queries:['Africa latest news','African economy OR technology']},
 cis:{label:'СНД / регіон',queries:['Kazakhstan OR Uzbekistan OR Kyrgyzstan news','Russia OR Armenia OR Georgia OR Moldova news']},
 ukraine:{label:'Україна',queries:['Україна новини технології економіка культура','Україна суспільство спорт ігри новини'],locale:'uk'},
 deals:{label:'Акції UA',queries:['Україна знижки розпродаж чорна п’ятниця Rozetka Comfy Foxtrot Allo','Україна акції знижки Telemart Brain MOYO Епіцентр Citrus','Україна розпродаж техніка смартфони комп’ютери ігри'],locale:'uk'}
};
const IMAGE_FEEDS={
 world:[['BBC News','https://feeds.bbci.co.uk/news/world/rss.xml'],['Al Jazeera','https://www.aljazeera.com/xml/rss/all.xml']],
 europe:[['BBC News','https://feeds.bbci.co.uk/news/world/europe/rss.xml'],['Euronews','https://www.euronews.com/rss?level=theme&name=news']],
 america:[['BBC News','https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml'],['NPR','https://feeds.npr.org/1004/rss.xml']],
 asia:[['BBC News','https://feeds.bbci.co.uk/news/world/asia/rss.xml'],['Japan Times','https://www.japantimes.co.jp/feed/']],
 africa:[['BBC News','https://feeds.bbci.co.uk/news/world/africa/rss.xml'],['Africanews','https://www.africanews.com/feed/']],
 tech:[['BBC News','https://feeds.bbci.co.uk/news/technology/rss.xml'],['TechCrunch','https://techcrunch.com/feed/'],['Ars Technica','https://feeds.arstechnica.com/arstechnica/index']],
 games:[['IGN','https://feeds.ign.com/ign/games-all'],['PC Gamer','https://www.pcgamer.com/rss/'],['GameSpot','https://www.gamespot.com/feeds/mashup/']],
 anime:[['Anime News Network','https://www.animenewsnetwork.com/all/rss.xml'],['Anime Corner','https://animecorner.me/feed/'],['Anime Trending','https://www.anitrendz.com/news/feed/']],
 internet:[['The Verge','https://www.theverge.com/rss/index.xml'],['TechCrunch Social','https://techcrunch.com/category/social/feed/'],['Tubefilter','https://www.tubefilter.com/feed/'],['Mashable','https://mashable.com/feeds/rss/all']],
 cis:[['The Moscow Times','https://www.themoscowtimes.com/rss/news'],['The Astana Times','https://astanatimes.com/feed/']],
 ukraine:[['Українська правда','https://www.pravda.com.ua/rss/'],['Суспільне','https://suspilne.media/rss/'],['Економічна правда','https://www.epravda.com.ua/rss/'],['ITC.ua','https://itc.ua/ua/feed/']],
 deals:[]
};
function decodeEntities(s){return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(?:amp|lt|gt|quot|apos|#39|#(\d+)|#x([a-f0-9]+));/gi,(whole,decimal,hex)=>{if(decimal)return String.fromCodePoint(Math.min(1114111,Number(decimal)));if(hex)return String.fromCodePoint(Math.min(1114111,parseInt(hex,16)));return ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"})[whole.toLowerCase()]||whole;}).replace(/<[^>]*>/g,'').trim();}
function tag(xml,name){const match=xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'));return match?decodeEntities(match[1]):'';}
function parseRss(xml,category,limit=22,fallbackSource='Google News'){const out=[];for(const match of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
 const e=match[1],title=tag(e,'title').slice(0,230),url=tag(e,'link').slice(0,800),pubDate=tag(e,'pubDate'),source=tag(e,'source').slice(0,80)||fallbackSource;if(!title||!/^https:\/\//.test(url))continue;
 const parsed=Date.parse(pubDate);if(!Number.isFinite(parsed))continue;
 // Optional original RSS image. No guessed stock photo or scraping remote pages.
 const media=e.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["'][^>]*>/i);
 const embedded=e.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i) ||
  e.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
 let imageUrl='';try{const candidate=decodeEntities(media?.[1]||embedded?.[1]||'');if(candidate&&new URL(candidate).protocol==='https:'&&!/\.(?:mp3|mp4|m4a|webm)(?:[?#]|$)/i.test(candidate))imageUrl=candidate.slice(0,1000);}catch{}
 out.push({id:require('node:crypto').createHash('sha256').update(url).digest('hex').slice(0,18),title,url,source,category,imageUrl,publishedAt:new Date(parsed).toISOString()});if(out.length>=limit)break;
 }return out;}
const crypto=require('node:crypto');
function normalizedTitle(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();}
function isDeal(t){return /(?:знижк|розпродаж|чорн.{0,8}п.ятниц|black friday|cyber monday|акці[яїй]|промокод|вигідн.{0,10}пропозиц)/iu.test(t.title);}
function balancedItems(items,categories,perCategory=45){
 const seen=new Set(),out=[];
 for(const category of categories){
  const unique=new Map();
  for(const t of items.filter(t=>t.category===category)){
   const k=normalizedTitle(t.title.replace(/\s+-\s+[^-]+$/,''));
   const old=unique.get(k);
   if(!old||(!old.imageUrl&&t.imageUrl)||((!!old.imageUrl===!!t.imageUrl)&&t.publishedAt>old.publishedAt))unique.set(k,t);
  }
  const rows=[...unique.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  let count=0;
  for(const t of rows){
   const k=category+'|'+normalizedTitle(t.title);
   if(seen.has(k)||category==='deals'&&!isDeal(t))continue;
   seen.add(k);out.push(t);if(++count>=perCategory)break;
  }
 }
 return out;
}
async function fetchNews(categories,fetcher=fetch){
 const allowed=[...new Set(categories)].filter(c=>Object.hasOwn(FEEDS,c));
 const queries=allowed.flatMap(category=>{
  const f=FEEDS[category],locale=f.locale==='uk'?'hl=uk&gl=UA&ceid=UA:uk':'hl=en-US&gl=US&ceid=US:en';
  return f.queries.map(query=>({category,url:'https://news.google.com/rss/search?q='+encodeURIComponent('('+query+') when:7d')+'&'+locale,source:'search'})).concat((IMAGE_FEEDS[category]||[]).map(([label,url])=>({category,url,source:'publisher',label})));
 });
 let errors=0,items=[],sourceCounts={},categoryStats={};
 const cutoff=Date.now()-8*86400000;
 for(let i=0;i<queries.length;i+=12){
  const batch=queries.slice(i,i+12);
  const settled=await Promise.allSettled(batch.map(async({category,url,source,label})=>{
   const response=await fetcher(url,{headers:{'User-Agent':'LifeHub/0.8 (RSS personal reader)'},signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const xml=await response.text();if(xml.length>2_000_000)throw new Error('Feed too large');
   return parseRss(xml,category,source==='publisher'?22:25,label||'Google News').filter(x=>Date.parse(x.publishedAt)>=cutoff);
  }));
  settled.forEach((r,j)=>{const cat=batch[j].category;const stat=categoryStats[cat]||(categoryStats[cat]={ok:0,failed:0,count:0});if(r.status==='fulfilled'){stat.ok++;items.push(...r.value);}else{stat.failed++;errors++;}});
 }
 items=balancedItems(items,allowed);
 for(const item of items){categoryStats[item.category].count++;sourceCounts[item.source]=(sourceCounts[item.source]||0)+1;}
 return {items,errors,totalSources:queries.length,fetchedAt:new Date().toISOString(),categoryStats,sourceCounts,schema:2};
}
function preferredScore(item,feedback){const reactions=Object.entries(feedback||{}).filter(([_key,val])=>val&&typeof val==='object');let weight=0;for(const [_key,f] of reactions){if(f.category===item.category)weight+=f.vote==='interesting'?2:-2;}
 const ageH=Math.max(0,(Date.now()-Date.parse(item.publishedAt))/3600000);const recent=Math.max(0,48-ageH)/48;return recent+Math.max(-2,Math.min(2,weight/8));}
module.exports={FEEDS,parseRss,decodeEntities,fetchNews,preferredScore,balancedItems,isDeal};
