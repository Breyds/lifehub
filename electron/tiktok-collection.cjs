'use strict';
// Opt-in scan of a TikTok collection visible in a restricted, separate Electron browser.
// Does NOT extract cookies, download video/audio or use private TikTok endpoints.
const {classifyTikTokUrl}=require('./tiktok.cjs');
const LIMIT=80;
function sanitizeCollectionVideo(item){
 try{
  const u=new URL(String(item.url||''));
  if(u.protocol!=='https:'||!['www.tiktok.com','tiktok.com','m.tiktok.com'].includes(u.hostname))return null;
  const m=u.pathname.match(/^\/@([^/]+)\/video\/(\d{10,25})/);
  if(!m)return null;
  return {url:`https://www.tiktok.com/@${m[1]}/video/${m[2]}`,title:String(item.title||'').replace(/\s+/g,' ').trim().slice(0,180),author:'@'+m[1],sound:String(item.sound||'').replace(/\s+/g,' ').trim().slice(0,120)};
 }catch{return null;}
}
function dedupeVideos(items){const seen=new Set();const out=[];for(const item of items){const x=sanitizeCollectionVideo(item);if(!x||seen.has(x.url))continue;seen.add(x.url);out.push(x);if(out.length>=LIMIT)break;}return out;}
function isCollectionUrl(raw){const x=classifyTikTokUrl(raw);return x.kind==='collection'?x.url:'';}
function canScanUrl(raw){const x=classifyTikTokUrl(raw);return x.kind==='collection'||x.kind==='short';}
let activeWindow=null;
const SCAN_JS=`(async()=>{
 const found = new Map();
 const remember = () => {
   const nodes = [...document.querySelectorAll('a[href*="/video/"]')];
   for(const anchor of nodes){
     const href=anchor.href||anchor.getAttribute('href')||'';
     const card=anchor.closest('article')||anchor.closest('[data-e2e*="video"]')||anchor.parentElement?.parentElement||anchor;
     const title=(anchor.getAttribute('aria-label')||card?.getAttribute('aria-label')||card?.innerText||anchor.innerText||'').trim().slice(0,180);
     const sound=(card?.querySelector('[data-e2e*="music"],[data-e2e*="sound"]')?.textContent||'').trim().slice(0,120);
     if(!found.has(href))found.set(href,{url:href,title,sound});
   }
 };
 for(let i=0;i<4;i++){
   remember();window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
   await new Promise(resolve=>setTimeout(resolve,400));
 }
 remember();
 return {count:found.size,videos:[...found.values()].slice(0,100),pageTitle:document.title||''};
})()`;
async function scanCollectionInWindow(raw,BrowserWindow,owner,interactive=false){
 const parsed=classifyTikTokUrl(raw);if(!canScanUrl(raw))throw new Error('Потрібне посилання на TikTok-колекцію');const url=parsed.url;
 const win=activeWindow&&!activeWindow.isDestroyed()?activeWindow:new BrowserWindow({width:1100,height:790,parent:owner||undefined,title:'TikTok · перегляд колекції LifeHub',autoHideMenuBar:true,show:interactive,webPreferences:{partition:'persist:lifehub-tiktok',nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 if(interactive)win.show();activeWindow=win;win.on('closed',()=>{if(activeWindow===win)activeWindow=null;});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 let current=url;
 win.webContents.on('will-navigate',(e,target)=>{try{const u=new URL(target);if(u.protocol!=='https:'||!(u.hostname==='tiktok.com'||u.hostname.endsWith('.tiktok.com')))e.preventDefault();}catch{e.preventDefault();}});
 try{
  if(win.webContents.getURL()!==url&&win.webContents.getURL()&&parsed.kind!=='short')await Promise.race([win.loadURL(url),new Promise((_,reject)=>setTimeout(()=>reject(new Error('TikTok не відповідає')),15000))]);
  else if(!win.webContents.getURL())await Promise.race([win.loadURL(url),new Promise((_,reject)=>setTimeout(()=>reject(new Error('TikTok не відповідає')),22000))]);
  await new Promise(resolve=>setTimeout(resolve,1000));
  const resolved=classifyTikTokUrl(win.webContents.getURL());
  if(resolved.kind!=='collection'){if(!win.isDestroyed())win.close();return {status:resolved.kind==='short'?'short':'unknown',url:resolved.url||url,title:'',author:'',videos:[],message:'Коротке посилання не перенаправило на доступну колекцію. Відкрий його у звичайному браузері й скопіюй повну адресу TikTok-колекції.'};}
  let rawList=await win.webContents.executeJavaScript(SCAN_JS,true);
  let videos=dedupeVideos(rawList?.videos||[]);
  // TikTok may ask to log in. Keep the restricted browser open; user can log in there and retry.
  if(!videos.length){if(!interactive&&!win.isDestroyed())win.close();return {status:'collection',url,message:'Сторінку відкрито, але відео не вдалося прочитати. Якщо потрібен вхід, скористайся окремою кнопкою авторизації. Ніякі паролі не передаються LifeHub.',title:'',author:'',videos:[]};}
  win.close();
  return {status:'collection',url,message:`Знайдено ${videos.length} доступних відео. Це ще не означає ${videos.length} розпізнаних пісень: для частини роликів TikTok не показує назву аудіо.`,title:'',author:'',videos};
 }catch(e){if(!win.isDestroyed())win.close();return {status:'unavailable',url,message:'Не вдалося прочитати TikTok-колекцію: '+String(e.message||e).slice(0,180),title:'',author:'',videos:[]};}
}
module.exports={sanitizeCollectionVideo,dedupeVideos,isCollectionUrl,canScanUrl,scanCollectionInWindow};
