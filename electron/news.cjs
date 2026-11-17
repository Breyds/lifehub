'use strict';
// RSS-only public sources. No scraping authenticated pages and no simulated popularity metrics.
const FEEDS={
 anime:{label:'Аніме',query:'anime new season OR anime announcement OR anime release'},
 games:{label:'Ігри',query:'gaming trailer OR video game release OR GTA VI'},
 internet:{label:'Інтернет',query:'YouTube Shorts trending OR streamer viral video OR TikTok trend'},
 world:{label:'Світ',query:'Ukraine world news today'},
 tech:{label:'Технології',query:'AI technology product announcement'},
 europe:{label:'Європа',query:'Europe latest news'},
 america:{label:'Америка',query:'United States Canada Latin America major news'},
 asia:{label:'Азія',query:'Asia Japan Korea China major news'},
 africa:{label:'Африка',query:'Africa latest major news'},
 cis:{label:'СНД / регіон',query:'Ukraine eastern Europe central Asia major news'},
 music_us:{label:'Музика · світ',query:'new music releases Friday album single pop hip hop'},
 music_ru:{label:'Музика · RU',query:'новинки музыки пятница вышел сингл альбом'}
};
function decodeEntities(s){return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(?:amp|lt|gt|quot|apos|#39|#(\d+)|#x([a-f0-9]+));/gi,(whole,decimal,hex)=>{if(decimal)return String.fromCodePoint(Math.min(1114111,Number(decimal)));if(hex)return String.fromCodePoint(Math.min(1114111,parseInt(hex,16)));return ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"})[whole.toLowerCase()]||whole;}).replace(/<[^>]*>/g,'').trim();}
function tag(xml,name){const match=xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'));return match?decodeEntities(match[1]):'';}
function parseRss(xml,category,limit=22){const out=[];for(const match of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
 const e=match[1],title=tag(e,'title').slice(0,230),url=tag(e,'link').slice(0,800),pubDate=tag(e,'pubDate'),source=tag(e,'source').slice(0,80)||'Google News';if(!title||!/^https:\/\//.test(url))continue;
 const parsed=Date.parse(pubDate);if(!Number.isFinite(parsed))continue;
 // Optional original RSS image. No guessed stock photo or scraping remote pages.
 const media=e.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["'][^>]*>/i);
 let imageUrl='';try{const candidate=decodeEntities(media?.[1]||'');if(candidate&&new URL(candidate).protocol==='https:')imageUrl=candidate.slice(0,1000);}catch{}
 out.push({id:require('node:crypto').createHash('sha256').update(url).digest('hex').slice(0,18),title,url,source,category,imageUrl,publishedAt:new Date(parsed).toISOString()});if(out.length>=limit)break;
 }return out;}
async function fetchNews(categories,fetcher=fetch){const allowed=categories.filter(c=>Object.hasOwn(FEEDS,c));const settled=await Promise.allSettled(allowed.map(async category=>{
 const query=FEEDS[category].query;const url=`https://news.google.com/rss/search?q=${encodeURIComponent(query+' when:2d')}&hl=en-US&gl=US&ceid=US:en`;
 const response=await fetcher(url,{headers:{'User-Agent':'LifeHub/0.3 (personal news reader; RSS)'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const xml=await response.text();if(xml.length>2_000_000)throw new Error('Feed too large');return parseRss(xml,category);
 }));let errors=0,items=[];for(const r of settled){if(r.status==='fulfilled')items.push(...r.value);else errors++;}
 items=items.filter((item,i,a)=>a.findIndex(x=>x.url===item.url)===i).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,180);return {items,errors,totalSources:allowed.length,fetchedAt:new Date().toISOString()};}
function preferredScore(item,feedback){const reactions=Object.entries(feedback||{}).filter(([_key,val])=>val&&typeof val==='object');let weight=0;for(const [_key,f] of reactions){if(f.category===item.category)weight+=f.vote==='interesting'?2:-2;}
 const ageH=Math.max(0,(Date.now()-Date.parse(item.publishedAt))/3600000);const recent=Math.max(0,48-ageH)/48;return recent+Math.max(-2,Math.min(2,weight/8));}
module.exports={FEEDS,parseRss,decodeEntities,fetchNews,preferredScore};
