'use strict';
// Prefer the image published WITH the article. Wikipedia fallback is permitted only
// for an explicitly named subject and must be labeled as an illustration.
const NAMED_TOPICS=[
 {words:[/jujutsu\s*kaisen/i,/магічн.{0,12}битв/i,/магическ.{0,12}битв/i],article:'Jujutsu_Kaisen'},
 {words:[/grand\s*theft\s*auto\s*(?:vi|6)/i,/\bgta\s*(?:vi|6)\b/i],article:'Grand_Theft_Auto_VI'},
 {words:[/crimean\s+(?:road\s+)?bridge/i,/kerch\s+(?:strait\s+)?bridge/i,/кримськ.{0,12}мост/i,/крымск.{0,12}мост/i],article:'Crimean_Bridge'},
 {words:[/attack\s*on\s*titan/i,/атак[ауе]\s*титан/i],article:'Attack_on_Titan'},
 {words:[/solo\s*leveling/i,/піднятт.{0,12}рівн/i],article:'Solo_Leveling'},
 {words:[/demon\s*slayer/i,/клинок.{0,18}демон/i],article:'Demon_Slayer:_Kimetsu_no_Yaiba'},
 {words:[/\badobe\b/i],article:'Adobe_Inc.'},
 {words:[/\bnintendo\b/i],article:'Nintendo'},
 {words:[/\bplaystation\b/i],article:'PlayStation'},
 {words:[/\bnetflix\b/i],article:'Netflix'},
 {words:[/\bapple\b/i],article:'Apple_Inc.'},
 {words:[/\bmicrosoft\b/i],article:'Microsoft'},
 {words:[/\bsteam\b/i],article:'Steam_(service)'},
 {words:[/\bbitcoin\b/i],article:'Bitcoin'},
 {words:[/\btelegram\b/i],article:'Telegram_(software)'},
 {words:[/\bmeta\b.*\bai\b/i],article:'Meta_Platforms'},
 {words:[/\btiktok\b/i],article:'TikTok'},
 {words:[/\bopenai\b/i],article:'OpenAI'},
 {words:[/sakamoto\s*days/i],article:'Sakamoto_Days'},
 {words:[/spice\s*(?:&|and)\s*wolf/i],article:'Spice_and_Wolf'},
 {words:[/yaiba.*samurai/i,/samurai\s*legend/i],article:'Yaiba:_Samurai_Legend'},
 {words:[/otherworldly\s*munchkin/i],article:"The_Otherworldly_Munchkin:_Let\'s_Speedrun_the_Dungeon_with_Only_1_HP"},
 {words:[/one\s*piece/i],article:'One_Piece'},
 {words:[/chainsaw\s*man/i],article:'Chainsaw_Man'},
 {words:[/my\s*hero\s*academia/i],article:'My_Hero_Academia'},
 {words:[/frieren/i],article:'Frieren'},
 {words:[/blue\s*lock/i],article:'Blue_Lock'},
 {words:[/naruto/i],article:'Naruto'},
 {words:[/bleach/i],article:'Bleach_(TV_series)'}
];
function matchArticle(title){const match=NAMED_TOPICS.find(x=>x.words.some(r=>r.test(String(title||''))));return match?.article||'';}
function safeImageUrl(raw){try{const url=new URL(String(raw||''));if(url.protocol!=='https:'||url.username||url.password||url.href.length>1200||!/^https:\/\//.test(url.href))return '';return url.href;}catch{return '';}}
function decodeAttr(raw){return String(raw||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function extractOGImage(html,pageUrl){
 for(const tag of String(html||'').match(/<meta\b[^>]*>/gi)||[]){
  if(!/\b(?:property|name)\s*=\s*['"](?:og:image|twitter:image)(?::secure_url)?['"]/i.test(tag))continue;
  const content=tag.match(/\bcontent\s*=\s*['"]([^'"]+)['"]/i)?.[1];if(!content)continue;
  try{const url=new URL(decodeAttr(content),pageUrl);const value=safeImageUrl(url.href);if(value)return value;}catch{}
 }
 return '';
}
const TRUSTED_HOSTS=new Set(['bbc.com','bbc.co.uk','reuters.com','aljazeera.com','mashable.com','cbr.com','comicbook.com','techrepublic.com','theverge.com','ign.com','apnews.com','adobe.com','techcrunch.com','polygon.com','gamespot.com','billboard.com','engadget.com','wired.com','variety.com','animenewsnetwork.com','crunchyroll.com','anitrendz.com','gamerant.com','animecorner.me']);
function trustedArticle(url){try{const u=new URL(url);const name=u.hostname.toLowerCase().replace(/^www\./,'');return u.protocol==='https:'&&[...TRUSTED_HOSTS].some(h=>name===h||name.endsWith('.'+h))&&!u.username&&!u.password;}catch{return false;}}
function googleNewsArticle(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='news.google.com'&&u.pathname.startsWith('/rss/articles/');}catch{return false;}}
async function fetchOriginalImage(url,fetcher=fetch){
 if(!trustedArticle(url)&&!googleNewsArticle(url))return null;
 try{const r=await fetcher(url,{signal:AbortSignal.timeout(7000),redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 LifeHub personal news reader'}});
  if(!r.ok||!String(r.headers?.get('content-type')||'').toLowerCase().includes('text/html'))return null;
  const finalUrl=r.url||url;
  // Never trust an image from an unknown redirect destination.
  if(!trustedArticle(finalUrl))return null;
  const html=(await r.text()).slice(0,600000);const img=extractOGImage(html,finalUrl);
  return img?{imageUrl:img,imageCreditUrl:finalUrl,imageCaption:'Фото зі сторінки оригінальної публікації'}:null;
 }catch{return null;}
}
async function fetchWikiImage(article,fetcher=fetch){
 if(!NAMED_TOPICS.some(t=>t.article===article))return null;
 try{const url=`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`;
 const r=await fetcher(url,{headers:{'User-Agent':'LifeHub personal reader (news imagery; https://github.com/Breyds/lifehub)'},signal:AbortSignal.timeout(7000)});
 if(!r.ok)return null;const data=await r.json();const img=data.thumbnail?.source;
 if(!img||!/^https:\/\/upload\.wikimedia\.org\//.test(img))return null;
 return {imageUrl:img.slice(0,1000),imageCreditUrl:typeof data.content_urls?.desktop?.page==='string'&&data.content_urls.desktop.page.startsWith('https://en.wikipedia.org/')?data.content_urls.desktop.page:'',imageCaption:`Ілюстрація теми: ${String(data.title||article).slice(0,80)} (Wikipedia; не фото події)`};
 }catch{return null;}
}
async function enrichNewsImages(items,fetcher=fetch){
 const missing=(items||[]).filter(x=>!x.imageUrl);
 // Only a bounded number of trusted source pages, to avoid hammering websites on refresh.
 const originalLoaded=new Map(await Promise.all(missing.filter(x=>trustedArticle(x.url)||googleNewsArticle(x.url)).sort((a,b)=>Number(trustedArticle(b.url))-Number(trustedArticle(a.url))).slice(0,28).map(async x=>[x.id,await fetchOriginalImage(x.url,fetcher)])));
 const subjects=[...new Set(missing.filter(x=>!originalLoaded.get(x.id)).map(x=>matchArticle(x.title)).filter(Boolean))].slice(0,18);
 const wikiLoaded=new Map(await Promise.all(subjects.map(async name=>[name,await fetchWikiImage(name,fetcher)])));
 return (items||[]).map(x=>{if(x.imageUrl)return x;const y=originalLoaded.get(x.id)||wikiLoaded.get(matchArticle(x.title));return y?{...x,...y}:x;});
}
module.exports={matchArticle,safeImageUrl,extractOGImage,trustedArticle,fetchOriginalImage,fetchWikiImage,enrichNewsImages};
