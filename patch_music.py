from pathlib import Path
p=Path('/mnt/data/lifehub-042/src/WorkspacePages.tsx')
s=p.read_text(encoding='utf8')
old="""const [collection,setCollection]=useState(snapshot.preferences.tiktokCollectionUrl||'');const nextFriday=addDays(nowDate(),(5-new Date().getDay()+7)%7);"""
new="""const [collection,setCollection]=useState(snapshot.preferences.tiktokCollectionUrl||'');const [checking,setChecking]=useState(false);const [checkStatus,setCheckStatus]=useState<{status:string;message:string;title:string;author:string}|null>(null);const nextFriday=addDays(nowDate(),(5-new Date().getDay()+7)%7);"""
assert old in s
s=s.replace(old,new)
old=""" async function exportCsv(){try{const ok=await window.lifehub.exportSongs();if(ok)report('CSV створено');}catch(e){report(String(e));}}"""
new=""" async function exportCsv(){try{const ok=await window.lifehub.exportSongs();if(ok)report('CSV створено');}catch(e){report(String(e));}}
 async function checkCollection(){setChecking(true);setCheckStatus(null);try{const result=await window.lifehub.checkTikTok(collection.trim());setCheckStatus(result);}catch(e){setCheckStatus({status:'error',message:'Помилка перевірки посилання: '+String(e),title:'',author:''});}finally{setChecking(false);}}"""
assert old in s
s=s.replace(old,new)
old="""<p>Збережи посилання для швидкого відкриття. Автоматичний доступ до списку «Збережене» ще не підключений.</p>"""
new="""<p>Перевір посилання зараз: для окремих відео доступний TikTok oEmbed, але список роликів у «Збереженому» наразі недоступний через публічний API.</p>"""
assert old in s
s=s.replace(old,new)
old="""value={collection} onChange={e=>setCollection(e.target.value)} /><button className="button outline" onClick={()=>void saveCollection()}>Зберегти</button>{Boolean(snapshot.preferences.tiktokCollectionUrl)&&<button className="hub-soft-button" onClick={()=>void window.lifehub.openLink(snapshot.preferences.tiktokCollectionUrl)}>Відкрити</button>}</div></section>"""
new="""value={collection} onChange={e=>{setCollection(e.target.value);setCheckStatus(null);}} /><button className="button outline" onClick={()=>void saveCollection()}>Зберегти</button><button className="hub-soft-button" disabled={checking||!collection.trim()} onClick={()=>void checkCollection()}><RefreshCw size={15}/>{checking?'Перевіряю…':'Перевірити зараз'}</button>{Boolean(snapshot.preferences.tiktokCollectionUrl)&&<button className="hub-soft-button" onClick={()=>void window.lifehub.openLink(snapshot.preferences.tiktokCollectionUrl).catch(e=>report(String(e)))}>Відкрити</button>}</div>{checkStatus&&<div className="hub-collection-status" role="status"><strong>{checkStatus.status==='video'?'Публічне відео розпізнано':checkStatus.status==='collection'?'Колекція: список недоступний':checkStatus.status==='short'?'Коротке посилання':checkStatus.status==='invalid'?'Некоректне посилання':checkStatus.status==='unavailable'?'Перевірка відео недоступна':'Перевірку завершено'}</strong><p>{checkStatus.message}</p>{checkStatus.title&&<small>Відео: {checkStatus.title}{checkStatus.author?` · ${checkStatus.author}`:''}</small>}</div>}</section>"""
assert old in s
s=s.replace(old,new)
# Add Spotify search to tracks (UI makes it explicit search, never fake direct track)
old="""<button className="hub-icon-button" title="Відкрити в Apple Music" onClick={()=>void window.lifehub.openLink(t.url).catch(e=>report(String(e)))}><ExternalLink size={15}/></button>"""
new="""<button className="hub-soft-button" title="Пошук цієї пісні у Spotify (не гарантовано точний збіг)" onClick={()=>void window.lifehub.openLink(`https://open.spotify.com/search/${encodeURIComponent(t.title+' '+t.artist)}`).catch(e=>report(String(e)))}>Spotify <ArrowUpRight size={14}/></button><button className="hub-icon-button" title="Відкрити оригінальне джерело Apple Music" onClick={()=>void window.lifehub.openLink(t.url).catch(e=>report(String(e)))}><ExternalLink size={15}/></button>"""
assert old in s
s=s.replace(old,new)
p.write_text(s,encoding='utf8')
