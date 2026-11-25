'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {telegramRequest,validToken}=require('../electron/telegram.cjs');
const {handleMessage,handleCallback,keyboard}=require('../electron/telegram-menu.cjs');
const {cleanTasks,differences}=require('../electron/telegram-sync.cjs');
const {occurs,taskDone}=require('../electron/logic.cjs');
const {fetchMirror,normalizeGroup}=require('../electron/dtek-mirror.cjs');
const token=process.env.TELEGRAM_BOT_TOKEN,chat=String(process.env.TELEGRAM_CHAT_ID||''),key=process.env.LIFEHUB_SYNC_KEY||'';
if(!validToken(token)||!/^\d+$/.test(chat)||key.length<32||key.length>256)throw Error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID and LIFEHUB_SYNC_KEY (32+ characters).');
const file=path.resolve(process.env.LIFEHUB_STATE_FILE||'./data/telegram.json');fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
let state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{active:false,enabled:false,tasks:[],pending:[],offset:0,notified:[],eveningShown:[],powerLive:{},powerGroup:'',lastSync:''};
function save(){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(state),{mode:0o600});fs.renameSync(tmp,file);}
function authorized(req){const h=String(req.headers.authorization||'');const a=crypto.createHash('sha256').update(h).digest(),b=crypto.createHash('sha256').update('Bearer '+key).digest();return crypto.timingSafeEqual(a,b);}
function reply(res,code,data){res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));}
function time(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return {date:p.year+'-'+p.month+'-'+p.day,clock:p.hour+':'+p.minute};}
async function body(req){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>5*1024*1024)throw Error('Request too large');parts.push(chunk);}return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');}
function safePower(raw){if(!raw||typeof raw!=='object')return {};const slot=s=>s&&/^\d{2}:\d{2}$/.test(s.start)&&/^\d{2}:\d{2}$/.test(s.end)&&['on','off','possible','unknown'].includes(s.status);const days=a=>(Array.isArray(a)?a:[]).slice(0,7).filter(d=>d&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)).map(d=>({date:d.date,slots:(Array.isArray(d.slots)?d.slots:[]).filter(slot).slice(0,48).map(s=>({start:s.start,end:s.end,status:s.status}))}));return {status:String(raw.status||'').slice(0,30),checkedAt:String(raw.checkedAt||'').slice(0,40),source:String(raw.source||'').slice(0,250),sourceUpdatedAt:String(raw.sourceUpdatedAt||'').slice(0,40),forecastSource:String(raw.forecastSource||'').slice(0,250),group:normalizeGroup(raw.group),message:String(raw.message||'').slice(0,300),days:days(raw.days),weeklyDays:days(raw.weeklyDays)};}
const server=http.createServer(async(req,res)=>{try{
 if(req.method!=='POST'||!['/health','/sync','/stop'].includes(req.url)){reply(res,404,{ok:false});return;}
 if(!authorized(req)){reply(res,401,{ok:false});return;}const data=await body(req);
 if(String(data.chatId||'')!==chat){reply(res,403,{ok:false});return;}
 if(req.url==='/health'){reply(res,200,{ok:true,botId:token.split(':')[0],chatId:chat,active:state.active});return;}
 if(req.url==='/stop'){if(state.pending.length){reply(res,409,{ok:false});return;}state.active=false;state.enabled=false;save();reply(res,200,{ok:true});return;}
 const incoming=cleanTasks(data.tasks);
 const ack=new Set(Array.isArray(data.ack)?data.ack.filter(x=>typeof x==='string'):[]);
 state.pending=state.pending.filter(p=>!ack.has(p.id));
 if(!state.pending.length){state.tasks=incoming;state.powerLive=safePower(data.powerLive);state.powerGroup=normalizeGroup(data.powerGroup);state.lastSync=new Date().toISOString();state.active=true;state.enabled=data.enabled===true;state.taskReminders=data.taskReminders!==false;state.privateNotificationText=data.privateNotificationText===true;state.evening=data.evening===true;state.notified=[...new Set([...state.notified,...(Array.isArray(data.notified)?data.notified.filter(x=>typeof x==='string'&&x.length<160):[])])].slice(-10000);}
 save();reply(res,200,{ok:true,pending:state.pending,lastSync:state.lastSync});
 }catch{reply(res,400,{ok:false});}});
let busy=false,reminding=false;
async function poll(){if(busy||!state.active||!state.enabled)return;busy=true;try{
 const items=await telegramRequest(token,'getUpdates',{offset:state.offset||0,limit:30,timeout:0,allowed_updates:['message','callback_query']});
 for(const item of items){if(!state.active||!state.enabled)break;const msg=item.message||item.callback_query?.message,callback=item.callback_query;
 if(msg?.chat?.type!=='private'||String(msg.chat.id)!==chat||(callback&&String(callback.from?.id)!==chat)){state.offset=Math.max(state.offset||0,item.update_id+1);save();continue;}
 if(callback)await telegramRequest(token,'answerCallbackQuery',{callback_query_id:callback.id}).catch(()=>{});
 if(!callback&&/^(?:\/power(?:@\w+)?|⚡ Світло)$/i.test(String(msg.text||'').trim())&&state.powerGroup){const old=state.powerLive;const date=time().date;const official=old.status==='verified'&&old.days?.some(d=>d.date===date)&&Date.now()-Date.parse(old.checkedAt)<6*3600000;if(!official){const fresh=await fetchMirror(state.powerGroup).catch(()=>null);if(fresh)state.powerLive=fresh;}}
 if(!state.active||!state.enabled)break;
 const before=JSON.parse(JSON.stringify(state.tasks)),today=time().date;
 const result=callback?handleCallback(state,callback.data,today):handleMessage(state,msg.text,today);
 if(result.changed){if(state.pending.length>=1000){state.tasks=before;result.text='Ліміт несинхронізованих змін. Відкрий LifeHub на ПК.';}else state.pending.push(...differences(before,state.tasks));}
 state.offset=Math.max(state.offset||0,item.update_id+1);save();
 await telegramRequest(token,'sendMessage',{chat_id:chat,text:result.text.slice(0,3900),reply_markup:result.reply_markup||keyboard});
 }
 }catch{console.error('Telegram polling failed (retry scheduled)');}finally{busy=false;}}
async function reminders(){if(reminding||!state.active||!state.enabled)return;reminding=true;try{const {date,clock}=time();
 if(state.taskReminders)for(const t of state.tasks){if(!state.active||!state.enabled)break;const id=t.id+'|'+date+'|'+t.time;if(t.time&&t.time<=clock&&occurs(t,date)&&!taskDone(t,date)&&!state.notified.includes(id)){await telegramRequest(token,'sendMessage',{chat_id:chat,text:state.privateNotificationText?'🔔 LifeHub: є запланована справа.':'🔔 '+t.title+' ('+t.time+')'});state.notified.push(id);state.notified=state.notified.slice(-10000);save();}}
 if(state.active&&state.enabled&&state.evening&&clock>='21:00'&&!state.eveningShown.includes(date)){await telegramRequest(token,'sendMessage',{chat_id:chat,text:'🌙 LifeHub: перевір виконані справи й заплануй завтра.'});state.eveningShown.push(date);state.eveningShown=state.eveningShown.slice(-90);save();}
 }catch{console.error('Reminder delivery failed (retry scheduled)');}finally{reminding=false;}}
server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('LifeHub Telegram sync server ready; TLS must terminate at your reverse proxy.'));
setInterval(()=>void poll(),5000);setInterval(()=>void reminders(),30000);void poll();void reminders();
