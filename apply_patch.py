from pathlib import Path
p=Path(__file__).parent

def edit(file,fn):
 path=p/file
 a=path.read_text(encoding='utf8')
 b=fn(a)
 if b==a: print('WARN unchanged',file)
 path.write_text(b,encoding='utf8')


def main_change(s):
 s=s.replace("const {fetchMusicCharts}=require('./music.cjs');","const {fetchMusicCharts}=require('./music.cjs');\nconst {checkTikTokUrl}=require('./tiktok.cjs');")
 marker="ipcMain.handle('music:refresh',()=>refreshMusic(true));"
 assert marker in s
 s=s.replace(marker,marker+"\nipcMain.handle('music:tiktok-check',(_event,url)=>checkTikTokUrl(url));")
 marker="ipcMain.handle('news:rank',()=>db.news.items.slice().sort((a,b)=>preferredScore(b,db.newsFeedback)-preferredScore(a,db.newsFeedback)));"
 assert marker in s
 s=s.replace(marker,"ipcMain.handle('news:unrate',(_event,id)=>{if(typeof id!=='string'||!db.newsFeedback[id])return false;delete db.newsFeedback[id];save();return true;});\n"+marker)
 # existing users with music categories should not still get music in news
 s=s.replace("const fetched=await fetchNews(db.preferences.newsCategories);","const fetched=await fetchNews(db.preferences.newsCategories.filter(c=>!['music_us','music_ru'].includes(c)));")
 return s
edit('electron/main.cjs',main_change)

def preload(s):
 s=s.replace("rateNews:(id,vote)=>ipcRenderer.invoke('news:feedback',id,vote),","rateNews:(id,vote)=>ipcRenderer.invoke('news:feedback',id,vote),\n  unrateNews:(id)=>ipcRenderer.invoke('news:unrate',id),")
 s=s.replace("refreshMusic:()=>ipcRenderer.invoke('music:refresh'),","refreshMusic:()=>ipcRenderer.invoke('music:refresh'),\n  checkTikTok:(url)=>ipcRenderer.invoke('music:tiktok-check',url),")
 return s
edit('electron/preload.cjs',preload)

def types(s):
 s=s.replace("rateNews:(id:string,vote:'interesting'|'not')=>Promise<boolean>;","rateNews:(id:string,vote:'interesting'|'not')=>Promise<boolean>;\n    unrateNews:(id:string)=>Promise<boolean>;")
 s=s.replace("refreshMusic:()=>Promise<MusicCharts>;","refreshMusic:()=>Promise<MusicCharts>;\n    checkTikTok:(url:string)=>Promise<{status:'invalid'|'short'|'video'|'collection'|'unknown'|'unavailable';message:string;url:string;title:string;author:string}>;")
 return s
edit('src/types.d.ts',types)

def workspace(s):
 s=s.replace("'anime','games','internet','world','tech','music_us','music_ru'","'anime','games','internet','world','tech'")
 s=s.replace("'anime','games','internet','world','tech','europe','america','asia','africa','cis','music_us','music_ru'","'anime','games','internet','world','tech','europe','america','asia','africa','cis'")
 return s
edit('electron/workspace.cjs',workspace)

def news(s):
 # only direct source: music is separate module; remove two from feeds
 s=s.replace(" cis:{label:'СНД / регіон',query:'Ukraine eastern Europe central Asia major news'},\n music_us:{label:'Музика · світ',query:'new music releases Friday album single pop hip hop'},\n music_ru:{label:'Музика · RU',query:'новинки музыки пятница вышел сингл альбом'}"," cis:{label:'СНД / регіон',query:'Ukraine eastern Europe central Asia major news'}")
 return s
edit('electron/news.cjs',news)

def css(s):
 s+='''
/* v0.4.2: unobtrusive, dark scrollbars for all scrollable panels (Chromium + Firefox).
   Keeps mouse-wheel/keyboard scrolling intact; scroll thumbs remain visible on hover. */
.app, .app * { scrollbar-width:thin; scrollbar-color:#333b37 transparent; }
.app ::-webkit-scrollbar { width:7px; height:7px; }
.app ::-webkit-scrollbar-track { background:transparent; }
.app ::-webkit-scrollbar-thumb { border-radius:12px; background:#313832; border:1px solid #161b17; }
.app ::-webkit-scrollbar-thumb:hover { background:var(--hub-accent); }
.app .sidebar { scrollbar-color:#303930 transparent; }
.app .sidebar::-webkit-scrollbar { width:6px; }
.app .sidebar::-webkit-scrollbar-thumb { background:#29352c; }
.app .hub-news-filter-note {display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;color:#9fac9d;margin-top:-5px}
.app .hub-news-placeholder {height:150px;display:flex;align-items:center;justify-content:center;gap:14px;background:linear-gradient(135deg,#233129,#181b20);color:#77a88a;border-radius:8px;margin:-1px -1px 15px;padding:18px}
.app .hub-news-placeholder span {font-size:11px;letter-spacing:1px;font-weight:850;text-transform:uppercase;color:#a3b7a7}
.app .hub-news-placeholder.is-games {background:linear-gradient(125deg,#252c3d,#171a23);color:#97b6f0}
.app .hub-news-placeholder.is-anime {background:linear-gradient(125deg,#352a3a,#1c1922);color:#cea8e8}
.app .hub-news-placeholder.is-world, .app .hub-news-placeholder.is-europe, .app .hub-news-placeholder.is-america {background:linear-gradient(125deg,#25343c,#192021);color:#9dc7ce}
.app .hub-news-placeholder.is-tech {background:linear-gradient(125deg,#243638,#161d21);color:#9ed8d5}
.app .hub-news-actions .is-danger {background:#422c31;border-color:#6c4249;color:#ffc2c4}
.app .hub-collection-status {margin-top:14px;background:#252b26;border:1px solid #3a4a3d;padding:13px 15px;border-radius:9px;color:#d2ddcf;font-size:12px;line-height:1.7}
.app .hub-collection-status strong {display:block;margin-bottom:4px;color:var(--hub-accent)}
.app .hub-collection-status p {margin:0;white-space:pre-wrap}
.app .hub-collection-status small {display:block;color:#a6b4aa;margin-top:5px}
.app .hub-news-paging {display:flex;justify-content:center;margin-top:14px}
'''
 return s
edit('src/studio.css',css)
