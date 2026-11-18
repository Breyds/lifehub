import {useEffect,useState} from 'react';
import {Bell,KeyRound,Music2,Radio,Save,Zap,ShieldCheck,ExternalLink} from 'lucide-react';
import type {Snapshot} from './types';
type Props={snapshot:Snapshot;refresh:()=>Promise<void>;report:(message:string)=>void};
export function SmartSettings({snapshot,refresh,report}:Props){
 const [telegramToken,setTelegramToken]=useState(''),[auddToken,setAuddToken]=useState(''),[youtubeToken,setYoutubeToken]=useState(''),[blackout,setBlackout]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{setBlackout(snapshot.blackoutSchedule||'');},[snapshot.blackoutSchedule]);
 async function action(fn:()=>Promise<unknown>,success:string){setBusy(true);try{await fn();await refresh();report(success);}catch(e){report(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <div className="settings-grid smart-settings">
  <section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><Bell size={22}/></div><div><h2>Telegram-нагадування</h2><p>Тільки твої особисті сповіщення</p></div><span className="status muted-badge">{snapshot.telegram.connected?'Підключено':'Не підключено'}</span></div>
   <p className="muted">Створи бота в @BotFather, відкрий його та надішли <code>/start</code>. Встав токен нижче. Не надсилай його в ChatGPT або GitHub.</p>
   {!snapshot.telegram.connected?<div className="key-row"><input type="password" value={telegramToken} placeholder="123456:AA..." onChange={e=>setTelegramToken(e.target.value)} autoComplete="off"/><button className="button primary" disabled={busy||!telegramToken.trim()} onClick={()=>void action(async()=>{await window.lifehub.connectTelegram(telegramToken);setTelegramToken('');},'Telegram-бота підключено')}>Підключити</button></div>:<><div className="toggle-row"><div><strong>Надсилати нагадування в Telegram</strong><p>Лише коли LifeHub працює на ПК</p></div><input type="checkbox" checked={snapshot.telegram.enabled} onChange={e=>void action(()=>window.lifehub.enableTelegram(e.target.checked),'Налаштування Telegram збережено')}/></div><div className="hub-tool-row"><button className="hub-soft-button" disabled={busy} onClick={()=>void action(()=>window.lifehub.testTelegram(),'Тестове повідомлення надіслано')}>Тестове повідомлення</button><button className="hub-soft-button" disabled={busy} onClick={()=>void action(()=>window.lifehub.disconnectTelegram(),'Бота відключено')}>Відключити</button></div></>}
  </section>
  <section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><Music2 size={22}/></div><div><h2>Розпізнавання музики</h2><p>AudD — окремий сервіс, не OpenAI</p></div><span className="status muted-badge">{snapshot.audDConnected?'Підключено':'Немає токена'}</span></div>
   <p className="muted">AudD порівнює вибраний локальний аудіофрагмент із базою пісень. Автоматичного завантаження звуку з TikTok поки немає. AudD може тарифікуватися окремо.</p>
   <div className="key-row"><input type="password" placeholder="AudD API Token" value={auddToken} onChange={e=>setAuddToken(e.target.value)} autoComplete="off"/><button className="button primary" disabled={busy||!auddToken.trim()} onClick={()=>void action(async()=>{await window.lifehub.saveAudDToken(auddToken);setAuddToken('');},'AudD токен збережено зашифровано')}><Save size={15}/> Зберегти</button></div>
   <div className="hub-tool-row"><button className="hub-soft-button" onClick={()=>void window.lifehub.openLink('https://audd.io/').catch(e=>report(String(e)))}>AudD <ExternalLink size={14}/></button>{snapshot.audDConnected&&<button className="hub-soft-button" disabled={busy} onClick={()=>void action(()=>window.lifehub.removeAudDToken(),'Токен AudD видалено')}>Відключити</button>}</div>
  </section>
  <section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><Radio size={22}/></div><div><h2>YouTube Data API</h2><p>Підтверджена статистика публічних відео</p></div><span className="status muted-badge">{snapshot.youtubeConnected?'Підключено':'Не підключено'}</span></div>
   <p className="muted">Для Trend Radar створи окремий ключ YouTube Data API v3 у Google Cloud. Він не дає доступ до публікації на твоєму каналі. Google застосовує власні квоти.</p>
   <div className="key-row"><input type="password" placeholder="Google API key" value={youtubeToken} onChange={e=>setYoutubeToken(e.target.value)} autoComplete="off"/><button className="button primary" disabled={busy||!youtubeToken.trim()} onClick={()=>void action(async()=>{await window.lifehub.saveYouTubeKey(youtubeToken);setYoutubeToken('');},'YouTube API ключ збережено')}><KeyRound size={15}/> Зберегти</button></div>
   {snapshot.youtubeConnected&&<button className="hub-soft-button" disabled={busy} onClick={()=>void action(()=>window.lifehub.removeYouTubeKey(),'Ключ YouTube видалено')}>Видалити ключ</button>}
  </section>
  <section className="panel settings-panel"><div className="setting-header"><div className="setting-icon"><Zap size={22}/></div><div><h2>Графік світла</h2><p>Ручне введення на поточний день</p></div></div>
   <p className="muted">Вкажи години, коли не буде світла, наприклад <code>09:00-12:00, 16:00-19:00</code>. AI враховуватиме цей графік у пропозиціях, але не перевіряє його автоматично.</p>
   <textarea rows={2} value={blackout} placeholder="09:00-12:00, 16:00-19:00" onChange={e=>setBlackout(e.target.value)} maxLength={320}/>
   <div className="hub-tool-row"><button className="button primary" disabled={busy} onClick={()=>void action(()=>window.lifehub.saveBlackouts(blackout),'Ручний графік відключень збережено')}><Save size={15}/> Зберегти графік</button><button className="hub-soft-button" disabled={busy} onClick={()=>{setBlackout('');void action(()=>window.lifehub.saveBlackouts(''),'Графік очищено');}}>Очистити</button></div>
   <p className="muted"><ShieldCheck size={14}/> Це не офіційні дані ДТЕК/обленерго. Перевіряй актуальність вручну, особливо при аварійних відключеннях.</p>
  </section>
 </div>;
}
