'use strict';
// Contextual illustration ONLY for a clearly named topic, never a random stock image.
// The source is Wikipedia's article thumbnail and is labeled accordingly in UI.
const NAMED_TOPICS=[
 {words:[/jujutsu\s*kaisen/i,/магічн.{0,12}битв/i,/магическ.{0,12}битв/i],article:'Jujutsu_Kaisen'},
 {words:[/grand\s*theft\s*auto\s*(?:vi|6)/i,/\bgta\s*(?:vi|6)\b/i],article:'Grand_Theft_Auto_VI'},
 {words:[/attack\s*on\s*titan/i,/атак[ауе]\s*титан/i],article:'Attack_on_Titan'},
 {words:[/solo\s*leveling/i,/піднятт.{0,12}рівн/i],article:'Solo_Leveling'},
 {words:[/demon\s*slayer/i,/клинок.{0,18}демон/i],article:'Demon_Slayer:_Kimetsu_no_Yaiba'},
 {words:[/\bnintendo\b/i],article:'Nintendo'},
 {words:[/\bplaystation\b/i],article:'PlayStation'},
 {words:[/\bnetflix\b/i],article:'Netflix'},
 {words:[/\bapple\b/i],article:'Apple_Inc.'},
 {words:[/\bmicrosoft\b/i],article:'Microsoft'},
 {words:[/\bsteam\b/i],article:'Steam_(service)'}
];
function matchArticle(title){const match=NAMED_TOPICS.find(x=>x.words.some(r=>r.test(String(title||''))));return match?.article||'';}
async function fetchWikiImage(article,fetcher=fetch){
 if(!NAMED_TOPICS.some(t=>t.article===article))return null;
 try{const url=`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`;
 const r=await fetcher(url,{headers:{'User-Agent':'LifeHub personal reader (news imagery; https://github.com/Breyds/lifehub)'},signal:AbortSignal.timeout(7000)});
 if(!r.ok)return null;const data=await r.json();const img=data.thumbnail?.source;
 if(!img||!/^https:\/\/upload\.wikimedia\.org\//.test(img))return null;
 return {imageUrl:img.slice(0,1000),imageCreditUrl:typeof data.content_urls?.desktop?.page==='string'&&data.content_urls.desktop.page.startsWith('https://en.wikipedia.org/')?data.content_urls.desktop.page:'',imageCaption:`Ілюстрація: ${String(data.title||article).slice(0,80)} (Wikipedia)`};
 }catch{return null;}
}
async function enrichNewsImages(items,fetcher=fetch){const names=[...new Set((items||[]).filter(x=>!x.imageUrl).map(x=>matchArticle(x.title)).filter(Boolean))].slice(0,8);
 const loaded=new Map(await Promise.all(names.map(async(name)=>[name,await fetchWikiImage(name,fetcher)])));
 return (items||[]).map(x=>{if(x.imageUrl)return x;const y=loaded.get(matchArticle(x.title));return y?{...x,...y}:x;});
}
module.exports={matchArticle,fetchWikiImage,enrichNewsImages};
